const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { postComment, normalizeFacebookError } = require('./facebookService');
const { notifyCampaignDone } = require('./telegramService');
const { setAccountStatus } = require('./accountStatusService');
const { triggerWebhook } = require('./webhookService');
const { generateText } = require('./groqService');
const { parseCookies } = require('./facebookService');
const { applyFatiguePolicy, isAccountCoolingDown } = require('./fatigueService');

const runningCampaigns = new Set();
const stoppedByUser = new Set();
const postTextCache = new Map(); // url → { text, expiresAt }
const POST_CACHE_TTL_MS = 30 * 60 * 1000; // 30 menit
const POST_CACHE_MAX_SIZE = 500; // max 500 URL di cache

// Bersihkan cache expired tiap 10 menit supaya tidak bocor memory.
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [url, entry] of postTextCache.entries()) {
    if (entry.expiresAt < now) {
      postTextCache.delete(url);
      removed++;
    }
  }
  // Kalau masih kebanyakan, hapus yang paling lama (FIFO)
  if (postTextCache.size > POST_CACHE_MAX_SIZE) {
    const overflow = postTextCache.size - POST_CACHE_MAX_SIZE;
    const keys = [...postTextCache.keys()].slice(0, overflow);
    for (const k of keys) postTextCache.delete(k);
    removed += keys.length;
  }
  if (removed > 0) console.log(`[campaignRunner] cache cleanup: ${removed} entry dihapus, sisa ${postTextCache.size}`);
}, 10 * 60 * 1000).unref();

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');
const obscuraService = require('./obscuraService');

async function fetchPostText(url, account, timeoutMs = 25000, engine = 'patchright') {
  if (engine === 'obscura') {
    try {
      const r2 = await obscuraService.getGroupInfo(account, url);
      return r2.title || '';
    } catch(e) { return ''; }
  }

  const cached = postTextCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  return browserEnqueue(async () => {
  let browser;
  try {
    browser = await launchBrowser();
    const cookies = Object.entries(parseCookies(account.cookies)).map(([name, value]) => ({
      name, value: String(value), domain: '.facebook.com', path: '/', secure: true, sameSite: 'None',
    }));
    const ctx = await browser.newContext({
      userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(3500);

    // Tutup popup notifikasi
    await page.evaluate(() => {
      const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
      for (const el of closers) if (el.offsetParent !== null) el.click();
    });
    await page.waitForTimeout(800);

    const text = await page.evaluate(() => {
      const article = document.querySelector('[role="article"]');
      if (!article) return '';
      // "Lihat selengkapnya" / "See more"
      const seeMore = article.querySelectorAll('[role="button"]');
      for (const b of seeMore) {
        const t = (b.textContent || '').trim().toLowerCase();
        if (t === 'lihat selengkapnya' || t === 'see more') {
          try { b.click(); } catch {}
        }
      }
      const txt = (article.innerText || '').trim();
      // Bersihkan baris UI yang umum
      const cleaned = txt.split('\n').filter(l => {
        const ll = l.trim();
        if (!ll) return false;
        if (/^suka$|^like$|^komentar$|^comment$|^bagikan$|^share$/i.test(ll)) return false;
        if (/^\d+\s*(jam|hari|menit|min|hr|d|w|bulan)/i.test(ll)) return false;
        return true;
      }).join('\n').slice(0, 1500);
      return cleaned;
    });
    postTextCache.set(url, { text, expiresAt: Date.now() + POST_CACHE_TTL_MS });
    return text;
  } catch (e) {
    return '';
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  }, account?.user_id); // end browserEnqueue
}

async function generateSmartComment(userId, postText, topic, tone, persona = 'natural') {
  const toneMap = {
    natural: 'sopan, ramah, terdengar manusiawi',
    casual: 'santai, akrab seperti teman',
    formal: 'formal dan sopan',
    enthusiastic: 'antusias dengan emoji ringan',
    persuasive: 'persuasif untuk menarik pembeli',
  };
  const toneDesc = toneMap[tone] || toneMap.natural;
  const personaMap = {
    natural: 'gaya netral alami',
    formal: 'gaya formal sopan',
    casual: 'gaya santai sehari-hari',
    friendly: 'gaya ramah hangat',
    sales: 'gaya soft-selling halus tanpa memaksa',
    expert: 'gaya ahli, meyakinkan, tetap ringkas',
    humor: 'gaya ringan sedikit humor, tidak norak',
  };
  const personaDesc = personaMap[persona] || personaMap.natural;
  const systemPrompt = `Kamu menulis komentar Facebook bahasa Indonesia. Komentar HARUS:
- relevan dengan isi status
- ${toneDesc}
- persona: ${personaDesc}
- maksimal 2 kalimat singkat
- terdengar seperti komentar manusia
- tanpa caps lock atau emoji berlebihan
Jawab HANYA komentarnya, tanpa pembuka.`;
  let userPrompt = '';
  if (postText) userPrompt += `Status:\n"${postText.slice(0, 600)}"\n\n`;
  if (topic) userPrompt += `Topik saya: ${topic}\n`;
  userPrompt += '\nTulis 1 komentar relevan yang halus mengaitkan ke topik saya.';

  const result = await generateText(userId, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.85, max_tokens: 200 });
  return (result.text || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minSec, maxSec) {
  const jitter = Math.random() * 0.4 - 0.2;
  const sec = Math.random() * (maxSec - minSec) + minSec;
  const ms = (sec + sec * jitter) * 1000;
  return sleep(Math.max(ms, 1000));
}

function randomMinutesDelay(minMin, maxMin) {
  const ms = (Math.random() * (maxMin - minMin) + minMin) * 60 * 1000;
  return sleep(ms);
}

function processTemplate(template, vars = {}) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  const spintaxRegex = /\{([^{}]+)\}/g;
  result = result.replace(spintaxRegex, (match, options) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
  return result;
}

function isWithinActiveHours(start, end) {
  const hour = new Date().getHours();
  if (start <= end) {
    return hour >= start && hour <= end;
  }
  return hour >= start || hour <= end;
}

function getDailyCommentCount(accountId, campaignId) {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM comment_logs 
    WHERE account_id = ? AND campaign_id = ? AND status = 'success'
    AND date(created_at) = ?
  `).get(accountId, campaignId, today);
  return row?.cnt || 0;
}

function formatFbError(error, context = 'campaign.comment') {
  if (!error) return null;
  if (typeof error === 'object' && error.code) {
    return `${error.code}: ${error.message}. ${error.recommendation || ''}`.trim();
  }
  const normalized = normalizeFacebookError(error, context);
  return `${normalized.code}: ${normalized.message}. ${normalized.recommendation}`;
}

function logComment(campaignId, accountId, targetUrl, commentText, status, errorMsg) {
  const logId = uuidv4();
  db.prepare(
    'INSERT INTO comment_logs (id, campaign_id, account_id, target_url, comment_text, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(logId, campaignId, accountId, targetUrl, commentText, status, errorMsg || null);
}

async function runCampaign(campaignId) {
  if (runningCampaigns.has(campaignId)) {
    return { error: 'Kampanye sudah berjalan' };
  }

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return { error: 'Kampanye tidak ditemukan' };

  const targets = JSON.parse(campaign.targets || '[]');
  const accountIds = JSON.parse(campaign.account_ids || '[]');

  if (!targets.length || !accountIds.length) {
    return { error: 'Target atau akun tidak tersedia' };
  }

  const safeStart = campaign.active_hours_start ?? 0;
  const safeEnd = campaign.active_hours_end ?? 23;
  const dailyLimit = campaign.daily_limit ?? 0;
  const sessionSize = campaign.session_size ?? 10;
  const sessionBreakMin = campaign.session_break_min ?? 10;
  const sessionBreakMax = campaign.session_break_max ?? 30;
  const maxErrors = campaign.max_errors ?? 3;

  if (!isWithinActiveHours(safeStart, safeEnd)) {
    return { error: `Kampanye hanya aktif antara jam ${safeStart}:00 - ${safeEnd}:59` };
  }

  runningCampaigns.add(campaignId);
  db.prepare("UPDATE campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
  triggerWebhook(campaign.user_id, 'campaign.started', { campaignId, name: campaign.name }).catch(() => {});

  let totalSuccess = 0;
  let totalFailed = 0;
  let globalCommentCount = 0;

  try {
    const blacklistedUrls = new Set(
      db.prepare('SELECT url FROM blacklists WHERE user_id = ?').all(campaign.user_id).map(r => r.url)
    );

    for (const accountId of accountIds) {
      if (!runningCampaigns.has(campaignId)) break;

      const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(accountId);
      if (!account) {
        for (const t of targets) logComment(campaignId, accountId, t, '', 'failed', 'Akun tidak ditemukan');
        totalFailed += targets.length;
        continue;
      }

      if (account.status === 'invalid' || account.status === 'checkpoint' || account.status === 'proxy_dead') {
        const err = account.status === 'checkpoint'
          ? formatFbError('Akun terkena checkpoint Facebook', 'campaign.account_status')
          : account.status === 'proxy_dead'
            ? formatFbError('Proxy akun mati. Ganti proxy atau matikan proxy untuk lanjut.', 'campaign.account_status')
            : formatFbError('Akun invalid atau expired', 'campaign.account_status');
        for (const t of targets) logComment(campaignId, accountId, t, '', 'failed', err);
        totalFailed += targets.length;
        continue;
      }

      if (isAccountCoolingDown(account)) {
        for (const t of targets) logComment(campaignId, accountId, t, '', 'failed', `ACCOUNT_COOLDOWN: Akun cooling down sampai ${new Date(account.cooldown_until).toLocaleString('id-ID')}`);
        totalFailed += targets.length;
        continue;
      }

      if (dailyLimit > 0) {
        const todayCount = getDailyCommentCount(accountId, campaignId);
        if (todayCount >= dailyLimit) {
          for (const t of targets) logComment(campaignId, accountId, t, '', 'failed', `Batas harian ${dailyLimit} komentar sudah tercapai`);
          totalFailed += targets.length;
          continue;
        }
      }

      let consecutiveErrors = 0;
      let accountCommentCount = 0;

      for (const target of targets) {
        if (!runningCampaigns.has(campaignId)) break;

        if (blacklistedUrls.has(target)) {
          logComment(campaignId, accountId, target, '', 'failed', 'URL dalam blacklist, dilewati');
          totalFailed++;
          continue;
        }

        if (!isWithinActiveHours(safeStart, safeEnd)) {
          logComment(campaignId, accountId, target, '', 'failed', 'Di luar jam operasional, kampanye dijeda');
          break;
        }

        if (dailyLimit > 0) {
          const todayCount = getDailyCommentCount(accountId, campaignId);
          if (todayCount >= dailyLimit) {
            logComment(campaignId, accountId, target, '', 'failed', `Batas harian ${dailyLimit} komentar tercapai untuk akun ini`);
            break;
          }
        }

        const userVars = (() => { try { return JSON.parse(campaign.variables || '{}'); } catch { return {}; } })();

        let commentText;
        if (campaign.ai_smart_comment) {
          // Smart AI: ambil isi status, generate komentar relevan
          try {
            const postText = await fetchPostText(target, account, 25000, campaign.browser_engine || account.browser_engine || 'patchright');
            commentText = await generateSmartComment(campaign.user_id, postText, campaign.ai_topic || '', campaign.ai_tone || 'natural', account.persona || 'natural');
            if (!commentText) {
              const fallback = (campaign.comment_template || '').trim();
              commentText = fallback || `Halo, ${campaign.ai_topic || 'sangat menarik'}!`;
              logComment(campaignId, accountId, target, '', 'failed', 'AI tidak menghasilkan komentar, pakai fallback');
            }
          } catch (aiErr) {
            const fallback = (campaign.comment_template || '').trim();
            if (!fallback) {
              logComment(campaignId, accountId, target, '', 'failed', `AI gagal: ${aiErr.message}`);
              totalFailed++;
              consecutiveErrors++;
              await randomDelay(campaign.delay_min, campaign.delay_max);
              continue;
            }
            commentText = processTemplate(fallback, {
              account: account.name, date: new Date().toLocaleDateString('id-ID'),
              time: new Date().toLocaleTimeString('id-ID'), target, ...userVars,
            });
          }
        } else {
          const templates = campaign.comment_template.includes('\n---\n')
            ? campaign.comment_template.split('\n---\n').map(t => t.trim()).filter(Boolean)
            : [campaign.comment_template];
          const templateIndex = accountIds.indexOf(accountId) % templates.length;
          const chosenTemplate = templates[templateIndex];
          commentText = processTemplate(chosenTemplate, {
            account: account.name,
            date: new Date().toLocaleDateString('id-ID'),
            time: new Date().toLocaleTimeString('id-ID'),
            target: target,
            ...userVars,
          });
        }

        const result = await postComment(account.cookies, target, commentText, account.proxy || null, account.user_agent || null);

        const formattedError = result.success ? null : formatFbError(result.code ? result : result.error, 'campaign.comment');
        logComment(campaignId, accountId, target, commentText, result.success ? 'success' : 'failed', formattedError);
        db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);

        if (result.success) {
          totalSuccess++;
          accountCommentCount++;
          globalCommentCount++;
          consecutiveErrors = 0;
        } else {
          totalFailed++;
          consecutiveErrors++;

          if (result.checkpoint) {
            setAccountStatus(accountId, 'checkpoint').catch(() => {});
            console.log(`[Runner] Akun ${account.name} terkena checkpoint, dilewati.`);
            break;
          }

          if (['BAD_REQUEST', 'LOGIN_REQUIRED', 'ACCESS_DENIED'].includes(result.code) || result.error?.includes('expired') || result.error?.includes('invalid') || result.error?.includes('Bad Request')) {
            setAccountStatus(accountId, 'expired').catch(() => {});
            console.log(`[Runner] Akun ${account.name} invalid/expired, dilewati.`);
            triggerWebhook(campaign.user_id, 'account.dead', { account: account.name, reason: formattedError || result.error }).catch(() => {});
            break;
          }

          if (consecutiveErrors >= maxErrors) {
            setAccountStatus(accountId, 'expired').catch(() => {});
            console.log(`[Runner] Akun ${account.name} sudah ${maxErrors} error berturut-turut, dilewati.`);
            triggerWebhook(campaign.user_id, 'account.dead', { account: account.name, reason: `${maxErrors} error berturut-turut` }).catch(() => {});
            break;
          }
        }

        applyFatiguePolicy(accountId);

        const isLastTarget = target === targets[targets.length - 1];
        if (!isLastTarget || accountId !== accountIds[accountIds.length - 1]) {
          if (accountCommentCount > 0 && accountCommentCount % sessionSize === 0) {
            console.log(`[Runner] Sesi ${accountCommentCount} komentar selesai, istirahat ${sessionBreakMin}-${sessionBreakMax} menit...`);
            logComment(campaignId, accountId, 'system', `Istirahat sesi ${accountCommentCount / sessionSize}`, 'info', `Jeda ${sessionBreakMin}-${sessionBreakMax} menit`);
            if (runningCampaigns.has(campaignId)) {
              await randomMinutesDelay(sessionBreakMin, sessionBreakMax);
            }
          } else {
            await randomDelay(campaign.delay_min, campaign.delay_max);
          }
        }
      }

      if (accountId !== accountIds[accountIds.length - 1] && runningCampaigns.has(campaignId)) {
        const switchDelay = Math.random() * 10 + 5;
        await sleep(switchDelay * 1000);
      }
    }
  } finally {
    const wasStopped = stoppedByUser.has(campaignId);
    stoppedByUser.delete(campaignId);
    runningCampaigns.delete(campaignId);
    const finalStatus = wasStopped ? 'stopped' : 'completed';
    db.prepare("UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(finalStatus, campaignId);
    notifyCampaignDone(campaign.user_id, campaign.name, totalSuccess, totalFailed).catch(() => {});
    triggerWebhook(campaign.user_id, wasStopped ? 'campaign.stopped' : 'campaign.completed', { campaignId, name: campaign.name, success: totalSuccess, failed: totalFailed }).catch(() => {});
  }

  return { success: totalSuccess, failed: totalFailed, total: totalSuccess + totalFailed };
}

function stopCampaign(campaignId) {
  if (!runningCampaigns.has(campaignId)) {
    return { error: 'Kampanye tidak sedang berjalan' };
  }
  stoppedByUser.add(campaignId);
  runningCampaigns.delete(campaignId);
  db.prepare("UPDATE campaigns SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
  return { message: 'Kampanye dihentikan' };
}

function isRunning(campaignId) {
  return runningCampaigns.has(campaignId);
}

module.exports = { runCampaign, stopCampaign, isRunning };
