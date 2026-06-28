const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { createProxyAgent, getCookieHeader, getUserId, getDtsgToken, randomUA, calculateJazoest, normalizeFacebookError, parseCookies } = require('./facebookService');

const runningPlans = new Set();

// Reset semua plan yang status-nya 'running' di DB tapi sebenarnya tidak hidup lagi
// (terjadi setelah server restart / crash). Dipanggil sekali saat module di-load.
try {
  const reset = db.prepare("UPDATE warming_plans SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE status = 'running'").run();
  if (reset.changes > 0) {
    console.log(`[warming] reset ${reset.changes} plan dari 'running' ke 'idle' setelah server restart`);
  }
} catch (e) {
  console.error('[warming] gagal reset stale running plans:', e.message);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return sleep((Math.random() * (max - min) + min) * 1000); }

async function fetchPage(cookieString, url, proxy = null, userAgent = null) {
  const ua = userAgent || randomUA();
  const agent = proxy ? createProxyAgent(proxy) : null;
  const cookieHeader = getCookieHeader(cookieString);
  const urlsToTry = [url];
  if (url.includes('www.facebook.com')) {
    urlsToTry.push(url.replace('https://www.facebook.com', 'https://m.facebook.com'));
    urlsToTry.push(url.replace('https://www.facebook.com', 'https://mbasic.facebook.com'));
  }

  let lastError = null;
  let fallback = null;
  for (const targetUrl of urlsToTry) {
    const isMbasic = targetUrl.includes('mbasic.facebook.com');
    const isMobile = targetUrl.includes('m.facebook.com') || isMbasic;
    const useUA = isMbasic
      ? 'Nokia3110c/2.0 (05.10) Profile/MIDP-2.0 Configuration/CLDC-1.1'
      : isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        : ua;
    const config = {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': useUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'Referer': isMobile ? 'https://m.facebook.com/' : 'https://www.facebook.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: status => status < 500,
    };
    if (agent) {
      config.httpsAgent = agent;
      config.httpAgent = agent;
      config.proxy = false;
    }

    try {
      const res = await axios.get(targetUrl, config);
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (res.status >= 400) {
        lastError = `HTTP ${res.status} saat akses ${targetUrl}`;
        continue;
      }
      const dtsg = getDtsgToken(html);
      const hasLoggedInMarkers = html.includes('DTSGInitialData') || html.includes('fb_dtsg') || html.includes('CurrentUserInitialData') || html.includes('actorID');
      const strongCheckpoint = /\/checkpoint\//i.test(html) || /confirm your identity|verify your account|pemeriksaan keamanan|akunmu dikunci|account temporarily locked/i.test(html);
      if (strongCheckpoint && !hasLoggedInMarkers) {
        throw new Error(`Facebook mengembalikan halaman checkpoint/security untuk ${targetUrl}`);
      }
      if (/login|Log in|Masuk/i.test(html) && !html.includes('c_user') && !hasLoggedInMarkers) {
        throw new Error(`Facebook mengembalikan halaman login untuk ${targetUrl}`);
      }
      if (dtsg) return { html, dtsg, ua: useUA };
      if (!fallback) fallback = { html, dtsg: null, ua: useUA };
      lastError = `No DTSG di ${targetUrl}`;
      continue;
    } catch (e) {
      lastError = e.message;
    }
  }
  if (fallback) return fallback;
  throw new Error(lastError || `Gagal akses ${url}`);
}

function extractFeedPostIds(html) {
  const ids = new Set();
  const clean = String(html || '')
    .replace(/\\u0025/g, '%')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/');
  const patterns = [
    /"storyID":"(\d{8,})"/g,
    /"story_id":"(\d{8,})"/g,
    /"post_id":"(\d{8,})"/g,
    /"topLevelPostID":"(\d{8,})"/g,
    /"top_level_post_id":"(\d{8,})"/g,
    /story_fbid[=:](\d{8,})/g,
    /ft_ent_identifier[=:](\d{8,})/g,
    /mf_story_key[=:](\d{8,})/g,
    /\/posts\/(?:pfbid)?(\d{8,})/g,
    /\/permalink\/(\d{8,})/g,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(clean)) !== null) ids.add(m[1]);
  }
  return [...ids].filter(id => /^\d+$/.test(id)).slice(0, 30);
}

async function likePost(cookieString, postId, proxy = null, userAgent = null) {
  const { html, dtsg, ua } = await fetchPage(cookieString, 'https://www.facebook.com/', proxy, userAgent);
  if (!dtsg) return { success: false, error: 'No DTSG' };
  const userId = getUserId(cookieString);

  const feedbackId = Buffer.from(`feedback:${postId}`).toString('base64');
  try {
    const res = await axios.post('https://www.facebook.com/api/graphql/', new URLSearchParams({
      'fb_dtsg': dtsg,
      'variables': JSON.stringify({
        input: {
          feedback_id: feedbackId,
          feedback_reaction: 'LIKE',
          feedback_source: 'OBJECT',
          is_tracking_encrypted: true,
          actor_id: userId,
          client_mutation_id: uuidv4(),
        },
      }),
      'doc_id': '7714697988553899',
      '__user': userId,
      '__a': '1',
      'jazoest': calculateJazoest(dtsg),
    }), {
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.facebook.com/',
        'Origin': 'https://www.facebook.com',
        'X-FB-Friendly-Name': 'CometUFIFeedbackReactMutation',
      },
      timeout: 15000,
    });
    const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    if (txt.includes('"viewer_feedback_reaction_info"') || txt.includes('"feedback"')) {
      return { success: true };
    }
    return { success: false, error: 'No reaction confirmed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractPostIdFromUrl(url) {
  const patterns = [
    /story_fbid[=:]?(\d{8,})/,
    /\/posts\/(\d{8,})/,
    /\/permalink\/(\d{8,})/,
    /[?&]v=(\d{8,})/,
    /\/(\d{15,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function likeRandomPosts(cookieString, count, proxy = null, userAgent = null, manualUrls = [], accountId = null) {
  let liked = 0;
  let lastError = null;

  // Bangun daftar target {id, url}
  let candidates = [];

  // 1. URL manual: pakai apa adanya
  if (manualUrls && manualUrls.length > 0) {
    candidates = manualUrls.map((u) => ({ id: extractPostIdFromUrl(u), url: u })).filter(t => t.url);
    if (candidates.length === 0) lastError = 'URL manual tidak valid';
  }

  // 2. Stored feed (URL kanonis dari browser discovery)
  if (candidates.length === 0 && accountId) {
    try {
      const stored = db.prepare('SELECT post_id, url FROM account_feed_posts WHERE account_id = ? AND url IS NOT NULL AND url != \'\' ORDER BY last_seen DESC LIMIT 30').all(accountId);
      candidates = stored.map(r => ({ id: r.post_id, url: r.url }));
    } catch (e) {
      lastError = `Stored feed error: ${e.message}`;
    }
  }

  // 3. Auto-trigger discovery kalau masih kosong
  if (candidates.length === 0 && accountId) {
    try {
      const { discoverFeedPostIds } = require('./browserDiscovery');
      await discoverFeedPostIds(accountId, 30);
      const fresh = db.prepare('SELECT post_id, url FROM account_feed_posts WHERE account_id = ? AND url IS NOT NULL AND url != \'\' ORDER BY last_seen DESC LIMIT 30').all(accountId);
      candidates = fresh.map(r => ({ id: r.post_id, url: r.url }));
    } catch (e) {
      lastError = `Auto-discovery feed gagal: ${e.message}`;
    }
  }

  // 4. Like via browser headless
  if (candidates.length > 0 && accountId) {
    try {
      const { likePostsViaBrowser } = require('./browserDiscovery');
      const r = await likePostsViaBrowser(accountId, candidates, count);
      if (r.liked > 0) {
        return { count: r.liked, error: null, source: 'browser_like', detail: r.detail };
      }
      lastError = r.error || `Browser like gagal 0/${r.total || candidates.length}`;
    } catch (e) {
      lastError = `Browser like error: ${e.message}`;
    }
  }

  // 5. Tidak ada candidate sama sekali
  if (candidates.length === 0) {
    return { count: 0, error: lastError || 'Tidak ada post target untuk di-like' };
  }

  const feedUrls = [
    'https://www.facebook.com/',
    'https://www.facebook.com/?sk=h_chr',
    'https://m.facebook.com/home.php',
    'https://m.facebook.com/',
    'https://mbasic.facebook.com/home.php',
    'https://mbasic.facebook.com/',
  ];

  try {
    let postIds = [];
    for (const feedUrl of feedUrls) {
      try {
        const { html } = await fetchPage(cookieString, feedUrl, proxy, userAgent);
        postIds = extractFeedPostIds(html);
        if (postIds.length) break;
        lastError = `Feed terbuka tapi tidak menemukan post ID di ${feedUrl}`;
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!postIds.length) {
      return { count: 0, error: lastError || 'Tidak menemukan post ID di feed. Kemungkinan HTML Facebook berubah atau feed tidak terbuka.' };
    }

    for (const postId of postIds.slice(0, count)) {
      const r = await likePost(cookieString, postId, proxy, userAgent);
      if (r.success) liked++;
      else lastError = r.error;
      await randomDelay(3, 8);
    }
  } catch (e) { lastError = e.message; }
  return { count: liked, error: liked === 0 ? lastError : null };
}

async function viewRandomPages(cookieString, count, proxy = null, userAgent = null) {
  const pages = [
    'https://www.facebook.com/',
    'https://www.facebook.com/groups/feed/',
    'https://www.facebook.com/marketplace/',
    'https://www.facebook.com/watch/',
    'https://www.facebook.com/friends/',
  ];
  let viewed = 0;
  const errors = [];
  for (let i = 0; i < Math.min(count, pages.length); i++) {
    try {
      await fetchPage(cookieString, pages[i], proxy, userAgent);
      viewed++;
      await randomDelay(2, 5);
    } catch (e) { errors.push(e.message); }
  }
  return { count: viewed, error: viewed === 0 ? errors.slice(0, 3).join(' | ') : null };
}

function logWarmingAction(planId, day, action, target, status, err) {
  db.prepare('INSERT INTO warming_logs (id, plan_id, day_number, action, target, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), planId, day, action, target, status, err || null);
}

function getFallbackBrowseCount(dayConfig) {
  return Math.min(5, Math.max(2, Math.ceil((dayConfig.likes || 0) / 3)));
}

const DEFAULT_SCHEDULE = [
  { day: 1, likes: 5, views: 3, comments: 0 },
  { day: 2, likes: 8, views: 5, comments: 0 },
  { day: 3, likes: 10, views: 5, comments: 1 },
  { day: 4, likes: 12, views: 8, comments: 1 },
  { day: 5, likes: 15, views: 10, comments: 2 },
  { day: 7, likes: 18, views: 10, comments: 3 },
  { day: 10, likes: 20, views: 12, comments: 5 },
  { day: 14, likes: 25, views: 15, comments: 7 },
];

// Post status di timeline sendiri (AI generate sesuai niche)
const obscuraService = require('./obscuraService');

async function postOwnStatus(account, niche, userId) {
  // Use obscura if plan specifies it
  const plan = (() => { try { const db = require('../db/database'); return db.prepare('SELECT browser_engine FROM warming_plans WHERE account_id=? AND user_id=?').get(account.id, userId); } catch(e) { return null; } })();
  const engine = plan?.browser_engine || account.browser_engine || 'patchright';
  if (engine === 'obscura') {
    try {
      const r = await obscuraService.checkLogin(account);
      return { success: r.loggedIn, detail: r.loggedIn ? 'obscura: akun aktif' : 'obscura: tidak login' };
    } catch(e) { return { success: false, detail: e.message }; }
  }
  const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');

  // Generate status text via AI
  let statusText = '';
  try {
    const { generateText } = require('./groqService');
    const result = await generateText(userId, [
      { role: 'system', content: `Kamu menulis status Facebook pendek (1-2 kalimat) dalam bahasa Indonesia. Topik/niche: ${niche || 'umum'}. Gaya: natural, seperti orang biasa posting sehari-hari. Boleh pakai 1-2 emoji. Jangan pakai hashtag berlebihan. Jangan bilang kamu AI. Jawab HANYA teks statusnya.` },
      { role: 'user', content: `Buatkan 1 status Facebook pendek tentang ${niche || 'kehidupan sehari-hari'}. Variasikan: bisa sharing pengalaman, opini ringan, motivasi singkat, atau aktivitas harian.` },
    ], { temperature: 0.9, max_tokens: 100 });
    statusText = (result.text || '').replace(/^["']+|["']+$/g, '').trim();
  } catch {
    // Fallback kalau AI gagal
    const fallbacks = [
      'Hari yang produktif! \ud83d\udcaa',
      'Semangat pagi \u2615',
      'Alhamdulillah lancar semua hari ini \ud83d\ude4f',
      'Weekend vibes \ud83c\udf1f',
      'Kerja keras pasti ada hasilnya \ud83d\udcaf',
    ];
    statusText = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  if (!statusText) return { success: false, error: 'Gagal generate status' };

  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      await ctx.addCookies(Object.entries(parseCookies(account.cookies)).map(([name, value]) => ({
        name, value: String(value), domain: '.facebook.com', path: '/', secure: true, sameSite: 'None',
      })));
      const page = await ctx.newPage();

      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3500);

      // Klik composer "Apa yang Anda pikirkan?" / "What's on your mind?"
      const composerClicked = await page.evaluate(() => {
        const els = document.querySelectorAll('[role="button"], [role="textbox"], span, div');
        for (const el of els) {
          const t = (el.textContent || '').trim().toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const placeholder = (el.getAttribute('aria-placeholder') || '').toLowerCase();
          if (t.includes('apa yang anda pikirkan') || t.includes("what's on your mind") || aria.includes('buat postingan') || aria.includes('create a post') || placeholder.includes('apa yang') || placeholder.includes("what's on")) {
            el.click(); return true;
          }
        }
        return false;
      });

      if (!composerClicked) {
        await page.close(); await ctx.close();
        return { success: false, error: 'Composer tidak ditemukan' };
      }
      await sleep(2500);

      // Ketik di composer dialog
      const typed = await page.evaluate((text) => {
        const editors = document.querySelectorAll('[role="textbox"][contenteditable="true"], [aria-label*="pikirkan"] [contenteditable], [aria-label*="mind"] [contenteditable]');
        for (const el of editors) {
          if (el.offsetParent) {
            el.focus();
            document.execCommand('insertText', false, text);
            return true;
          }
        }
        return false;
      }, statusText);

      if (!typed) {
        await page.close(); await ctx.close();
        return { success: false, error: 'Gagal ketik di composer' };
      }
      await sleep(1500);

      // Klik tombol "Posting" / "Post"
      const posted = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"], button');
        for (const b of btns) {
          const t = (b.textContent || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          if ((t === 'posting' || t === 'post' || t === 'kirim' || aria === 'posting' || aria === 'post') && b.offsetParent) {
            b.click(); return true;
          }
        }
        return false;
      });

      await sleep(3000);
      await page.close(); await ctx.close();
      return { success: posted, statusText, error: posted ? null : 'Tombol posting tidak ditemukan' };
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

async function runWarmingDay(planId) {
  const plan = db.prepare('SELECT * FROM warming_plans WHERE id = ?').get(planId);
  if (!plan) return;

  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(plan.account_id);
  if (!account || account.status === 'invalid') {
    db.prepare("UPDATE warming_plans SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(planId);
    return;
  }

  let schedule = DEFAULT_SCHEDULE;
  try {
    const parsed = JSON.parse(plan.schedule || 'null');
    if (Array.isArray(parsed) && parsed.length > 0) {
      schedule = parsed;
    }
  } catch {
    schedule = DEFAULT_SCHEDULE;
  }
  const currentDay = plan.current_day + 1;
  const dayConfig = schedule.reduce((prev, s) => s.day <= currentDay ? s : prev, schedule[0]);

  let totalActions = 0;

  if (dayConfig.views > 0) {
    const v = await viewRandomPages(account.cookies, dayConfig.views, account.proxy, account.user_agent);
    logWarmingAction(planId, currentDay, 'browse', `${v.count} halaman dikunjungi`, v.count > 0 ? 'success' : 'failed', v.error);
    totalActions += v.count;
    await sleep(2000);
  }

  if (dayConfig.likes > 0) {
    let likeUrls = [];
    try { likeUrls = plan.like_urls ? JSON.parse(plan.like_urls) : []; } catch {}

    // Auto-sync feed kalau belum ada post tersimpan + tidak ada URL manual
    const storedCount = db.prepare('SELECT COUNT(*) as cnt FROM account_feed_posts WHERE account_id = ?').get(account.id)?.cnt || 0;
    if (storedCount === 0 && likeUrls.length === 0) {
      try {
        const { discoverFeedPostIds } = require('./browserDiscovery');
        await discoverFeedPostIds(account.id, 30);
      } catch (e) {
        // sync gagal: lanjut, biar likeRandomPosts log error sendiri
      }
    }

    const liked = await likeRandomPosts(account.cookies, dayConfig.likes, account.proxy, account.user_agent, likeUrls, account.id);
    if (liked.count > 0) {
      logWarmingAction(planId, currentDay, 'like', `${liked.count} postingan disukai`, 'success', null);
      totalActions += liked.count;
    } else {
      const normalized = normalizeFacebookError(liked.error || 'Like tidak tersedia untuk akun/session ini', 'warming.like');
      logWarmingAction(planId, currentDay, 'like', 'Like dilewati, diganti browse tambahan', 'skipped', `${normalized.code}: ${normalized.message}. ${normalized.recommendation}`);
      const fallbackCount = getFallbackBrowseCount(dayConfig);
      const fallback = await viewRandomPages(account.cookies, fallbackCount, account.proxy, account.user_agent);
      const fallbackError = fallback.error ? normalizeFacebookError(fallback.error, 'warming.fallback_browse') : null;
      logWarmingAction(
        planId,
        currentDay,
        'browse',
        `${fallback.count} halaman fallback dikunjungi`,
        fallback.count > 0 ? 'success' : 'failed',
        fallbackError ? `${fallbackError.code}: ${fallbackError.message}. ${fallbackError.recommendation}` : null
      );
      totalActions += fallback.count;
    }
    await sleep(3000);
  }

  // Auto post status (AI generate sesuai niche)
  if (plan.auto_post_status && currentDay >= 3) { // mulai hari ke-3 supaya akun sudah "warm"
    try {
      const userId = db.prepare('SELECT user_id FROM fb_accounts WHERE id = ?').get(account.id)?.user_id;
      const r = await postOwnStatus(account, plan.niche || '', userId);
      logWarmingAction(planId, currentDay, 'post_status', r.statusText || 'AI status', r.success ? 'success' : 'failed', r.error);
      totalActions += r.success ? 1 : 0;
    } catch (e) {
      logWarmingAction(planId, currentDay, 'post_status', 'Gagal post status', 'failed', e.message);
    }
    await sleep(3000);
  }

  // Auto setup profile (bertahap, 1 field per hari, MULAI HARI KE-4, HANYA 5 HARI)
  if (plan.auto_setup_profile && plan.profile_data && currentDay >= 4 && currentDay <= 8) {
    try {
      const profileData = JSON.parse(plan.profile_data);
      const fields = ['photo', 'bio', 'city', 'workplace', 'school'];
      const fieldKeys = { photo: 'photo_url', bio: 'bio', city: 'city', workplace: 'workplace', school: 'school' };
      // Hari 4 = field 0 (photo), hari 5 = field 1 (bio), dst
      const fieldIdx = currentDay - 4;
      const field = fields[fieldIdx];
      const value = profileData[fieldKeys[field]];
      if (value) {
        const { updateProfilePhoto, updateBio, updateLocation, updateWorkplace, updateSchool } = require('./profileSetupService');
        let r;
        switch (field) {
          case 'photo': r = await updateProfilePhoto(account, value); break;
          case 'bio': r = await updateBio(account, value); break;
          case 'city': r = await updateLocation(account, value); break;
          case 'workplace': r = await updateWorkplace(account, value); break;
          case 'school': r = await updateSchool(account, value); break;
        }
        logWarmingAction(planId, currentDay, 'setup_profile', `${field}: ${value.slice(0, 50)}`, r?.success ? 'success' : 'failed', r?.error);
        totalActions += r?.success ? 1 : 0;
      }
    } catch (e) {
      logWarmingAction(planId, currentDay, 'setup_profile', 'Gagal setup profil', 'failed', e.message);
    }
    await sleep(2000);
  }

  const nextDay = currentDay >= plan.total_days ? plan.total_days : currentDay;
  const isComplete = currentDay >= plan.total_days;
  const nextRun = isComplete ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`UPDATE warming_plans SET current_day = ?, status = ?, last_run = CURRENT_TIMESTAMP, next_run = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(nextDay, isComplete ? 'completed' : 'running', nextRun, planId);

  // Log scheduler aktivitas
  try {
    const { logSchedulerEvent } = require('./schedulerLog');
    logSchedulerEvent({
      type: isComplete ? 'warming_completed' : 'warming_day',
      userId: plan.user_id,
      targetId: planId,
      targetName: plan.name,
      status: totalActions > 0 ? 'success' : 'skipped',
      message: isComplete
        ? `Warming "${plan.name}" selesai (${plan.total_days} hari, ${totalActions} aksi hari ini)`
        : `Hari ${currentDay}/${plan.total_days}: ${totalActions} aksi (browse/like/komentar)`,
    });
  } catch {}

  return { day: currentDay, totalDays: plan.total_days, actions: totalActions, complete: isComplete };
}

async function startWarming(planId) {
  if (runningPlans.has(planId)) return { error: 'Warming sudah berjalan' };
  const plan = db.prepare('SELECT * FROM warming_plans WHERE id = ?').get(planId);
  if (!plan) return { error: 'Plan tidak ditemukan' };

  runningPlans.add(planId);
  db.prepare("UPDATE warming_plans SET status = 'running', started_at = CASE WHEN started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(planId);

  (async () => {
    try {
      while (runningPlans.has(planId)) {
        const result = await runWarmingDay(planId);
        if (!result || result.complete) break;

        const fresh = db.prepare('SELECT next_run FROM warming_plans WHERE id = ?').get(planId);
        if (!fresh?.next_run) break;

        const waitMs = new Date(fresh.next_run).getTime() - Date.now();
        const chunk = 60000;
        let waited = 0;
        while (waited < waitMs && runningPlans.has(planId)) {
          await sleep(chunk);
          waited += chunk;
        }
      }
    } finally {
      runningPlans.delete(planId);
      const p = db.prepare('SELECT status FROM warming_plans WHERE id = ?').get(planId);
      if (p && p.status === 'running') {
        db.prepare("UPDATE warming_plans SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(planId);
      }
    }
  })();

  return { message: 'Warming dimulai' };
}

function stopWarming(planId) {
  runningPlans.delete(planId);
  db.prepare("UPDATE warming_plans SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(planId);
  return { message: 'Warming dihentikan' };
}

function isRunning(planId) { return runningPlans.has(planId); }

module.exports = { startWarming, stopWarming, isRunning, DEFAULT_SCHEDULE, viewRandomPages, likeRandomPosts };
