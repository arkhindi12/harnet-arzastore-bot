const axios = require('axios');
const { createProxyAgent, getCookieHeader, randomUA, normalizeFacebookError, postComment: commentOnPost } = require('./facebookService');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { notifyKeywordHit } = require('./telegramService');

const runningMonitors = new Set();
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return sleep((Math.random() * (max - min) + min) * 1000); }


function extractPostsFromHtml(html, groupUrl) {
  const posts = [];
  const seen = new Set();

  const postPatterns = [
    /(?:\/groups\/[^/]+\/permalink\/|\/groups\/[^/]+\/posts\/)(\d+)/g,
    /story_fbid=(\d+)/g,
    /"storyID":"(\d+)"/g,
  ];

  for (const pattern of postPatterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const postId = m[1];
      if (seen.has(postId) || postId.length < 10) continue;
      seen.add(postId);
      const groupMatch = groupUrl.match(/facebook\.com\/groups\/([^/?#]+)/);
      const groupSlug = groupMatch ? groupMatch[1] : 'unknown';
      posts.push({
        postId,
        url: `https://www.facebook.com/groups/${groupSlug}/posts/${postId}/`,
      });
    }
  }

  const textBlocks = [];
  const textPattern = /"message":\{"text":"([^"]{10,})"\}/g;
  let tm;
  while ((tm = textPattern.exec(html)) !== null) {
    textBlocks.push(tm[1].replace(/\\n/g, ' ').replace(/\\u[\dA-F]{4}/gi, c => String.fromCharCode(parseInt(c.slice(2), 16))));
  }

  return posts.map((p, i) => ({ ...p, text: textBlocks[i] || '' }));
}

function formatFbError(error, context = 'keyword_monitor') {
  if (!error) return null;
  if (typeof error === 'object' && error.code) return `${error.code}: ${error.message}. ${error.recommendation || ''}`.trim();
  const normalized = normalizeFacebookError(error, context);
  return `${normalized.code}: ${normalized.message}. ${normalized.recommendation}`;
}

async function fetchGroupPosts(cookieString, groupUrl, proxyUrl = null) {
  const ua = randomUA();
  const agent = createProxyAgent(proxyUrl);
  const proxyConfig = agent ? { httpsAgent: agent, httpAgent: agent, proxy: false } : {};
  try {
    const res = await axios.get(groupUrl, {
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'Referer': 'https://www.facebook.com/',
      },
      timeout: 20000,
      ...proxyConfig,
    });
    return { posts: extractPostsFromHtml(res.data, groupUrl), html: res.data };
  } catch (err) {
    return { posts: [], error: formatFbError(err.message, 'keyword_monitor.fetch_group') };
  }
}

function matchesKeywords(text, keywords) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase().trim())) return kw;
  }
  return null;
}

function processSpintax(text) {
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

async function runMonitorOnce(monitorId) {
  const monitor = db.prepare('SELECT * FROM keyword_monitors WHERE id = ?').get(monitorId);
  if (!monitor) return;

  let groupUrls = JSON.parse(monitor.group_urls || '[]');
  const keywords = JSON.parse(monitor.keywords || '[]');
  const accountIds = JSON.parse(monitor.account_ids || '[]');

  // Auto-fallback: kalau user tidak isi grup, pakai stored groups dari discovery akun pertama
  if (groupUrls.length === 0 && accountIds.length > 0) {
    try {
      const firstAcc = accountIds[0];
      const stored = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(firstAcc);
      if (stored.length === 0) {
        try {
          const { discoverGroups } = require('./browserDiscovery');
          await discoverGroups(firstAcc);
          const fresh = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(firstAcc);
          groupUrls = fresh.map(g => g.url);
        } catch {}
      } else {
        groupUrls = stored.map(g => g.url);
      }
    } catch {}
  }

  if (!groupUrls.length || !keywords.length || !accountIds.length) return;

  const seenPosts = new Set(JSON.parse(monitor.seen_post_ids || '[]'));
  let triggered = 0;
  const maxComments = monitor.max_comments_per_run || 5;
  let accountIdx = 0;

  for (const groupUrl of groupUrls) {
    if (!runningMonitors.has(monitorId)) break;
    if (triggered >= maxComments) break;

    const account = db.prepare("SELECT * FROM fb_accounts WHERE id = ? AND status = 'active'").get(accountIds[accountIdx % accountIds.length]);
    if (!account) continue;

    const { posts } = await fetchGroupPosts(account.cookies, groupUrl, account.proxy);

    for (const post of posts) {
      if (!runningMonitors.has(monitorId)) break;
      if (triggered >= maxComments) break;
      if (seenPosts.has(post.postId)) continue;

      seenPosts.add(post.postId);
      const matchedKeyword = matchesKeywords(post.text, keywords);

      if (matchedKeyword) {
        const comment = processSpintax(monitor.comment_template || 'Halo, ada yang bisa saya bantu?');
        const result = await commentOnPost(account.cookies, post.url, comment, account.proxy);

        const logId = uuidv4();
        db.prepare(`INSERT INTO keyword_monitor_logs (id, monitor_id, account_id, post_url, post_excerpt, matched_keyword, comment_sent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(logId, monitorId, account.id, post.url, (post.text || '').slice(0, 200), matchedKeyword, comment, result.success ? 'success' : 'failed');

        if (result.success) {
          triggered++;
          db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(account.id);
          const groupName = groupUrl.split('/').filter(Boolean).pop();
          notifyKeywordHit(monitor.user_id, matchedKeyword, groupName, comment).catch(() => {});
          accountIdx++;
          await randomDelay(monitor.delay_min || 5, monitor.delay_max || 30);
        }
      }
    }

    await sleep(3000);
  }

  const trimmedSeen = [...seenPosts].slice(-500);
  const nextRun = new Date(Date.now() + monitor.check_interval * 60 * 1000).toISOString();
  db.prepare(`UPDATE keyword_monitors SET seen_post_ids = ?, last_check = CURRENT_TIMESTAMP, next_check = ?, total_triggered = total_triggered + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(JSON.stringify(trimmedSeen), nextRun, triggered, monitorId);

  try {
    const { logSchedulerEvent } = require('./schedulerLog');
    logSchedulerEvent({
      type: 'keyword_monitor_check',
      userId: monitor.user_id,
      targetId: monitorId,
      targetName: monitor.name,
      status: triggered > 0 ? 'success' : 'info',
      message: `Monitor "${monitor.name}" cek ${groupUrls.length} grup, ${triggered} komentar dikirim`,
    });
  } catch {}
}

async function startMonitor(monitorId) {
  if (runningMonitors.has(monitorId)) return { error: 'Monitor sudah berjalan' };
  const monitor = db.prepare('SELECT * FROM keyword_monitors WHERE id = ?').get(monitorId);
  if (!monitor) return { error: 'Monitor tidak ditemukan' };

  runningMonitors.add(monitorId);
  db.prepare("UPDATE keyword_monitors SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(monitorId);

  (async () => {
    try {
      while (runningMonitors.has(monitorId)) {
        await runMonitorOnce(monitorId);
        if (!runningMonitors.has(monitorId)) break;
        const fresh = db.prepare('SELECT check_interval FROM keyword_monitors WHERE id = ?').get(monitorId);
        const waitMs = (fresh?.check_interval || 15) * 60 * 1000;
        const chunk = 10000;
        let waited = 0;
        while (waited < waitMs && runningMonitors.has(monitorId)) {
          await sleep(chunk);
          waited += chunk;
        }
      }
    } finally {
      runningMonitors.delete(monitorId);
      db.prepare("UPDATE keyword_monitors SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(monitorId);
    }
  })();

  return { message: 'Monitor dimulai' };
}

function stopMonitor(monitorId) {
  if (!runningMonitors.has(monitorId)) return { error: 'Monitor tidak berjalan' };
  runningMonitors.delete(monitorId);
  db.prepare("UPDATE keyword_monitors SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(monitorId);
  return { message: 'Monitor dihentikan' };
}

function isRunning(monitorId) { return runningMonitors.has(monitorId); }

module.exports = { startMonitor, stopMonitor, isRunning };
