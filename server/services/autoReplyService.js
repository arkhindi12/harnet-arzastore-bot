const axios = require('axios');
const { createProxyAgent, getCookieHeader, randomUA, getDtsgToken, getUserId, calculateJazoest, normalizeFacebookError } = require('./facebookService');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const runningReplies = new Set();
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return sleep((Math.random() * (max - min) + min) * 1000); }

function formatFbError(error, context = 'auto_reply') {
  if (!error) return null;
  if (typeof error === 'object' && error.code) return `${error.code}: ${error.message}. ${error.recommendation || ''}`.trim();
  const normalized = normalizeFacebookError(error, context);
  return `${normalized.code}: ${normalized.message}. ${normalized.recommendation}`;
}

function processSpintax(text) {
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

async function fetchPostComments(cookieString, postUrl, proxyUrl = null) {
  const ua = randomUA();
  const comments = [];
  const agent = createProxyAgent(proxyUrl);
  const proxyConfig = agent ? { httpsAgent: agent, httpAgent: agent, proxy: false } : {};
  try {
    const res = await axios.get(postUrl, {
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
    const html = res.data;
    const dtsg = getDtsgToken(html);

    const commentPattern = /"id":"(\d{10,})","body":\{"text":"([^"]{1,500})"\}.*?"author":\{"id":"[^"]+","name":"([^"]+)"/g;
    let m;
    while ((m = commentPattern.exec(html)) !== null) {
      comments.push({ commentId: m[1], text: m[2], authorName: m[3] });
    }

    const altPattern = /"comment_id":"(\d+)","message":"([^"]{1,300})","commenter_name":"([^"]+)"/g;
    let am;
    const existingIds = new Set(comments.map(c => c.commentId));
    while ((am = altPattern.exec(html)) !== null) {
      if (!existingIds.has(am[1])) {
        comments.push({ commentId: am[1], text: am[2], authorName: am[3] });
        existingIds.add(am[1]);
      }
    }

    return { comments, dtsg, ua };
  } catch (err) {
    return { comments: [], error: err.message };
  }
}

async function replyToComment(cookieString, postUrl, commentId, replyText, dtsg, ua, pageId = null, proxyUrl = null) {
  const userId = getUserId(cookieString);
  if (!dtsg || !userId) return { success: false, error: 'Missing DTSG or userId' };
  const agent = createProxyAgent(proxyUrl);
  const proxyConfig = agent ? { httpsAgent: agent, httpAgent: agent, proxy: false } : {};

  const postIdMatch = postUrl.match(/\/posts\/(\d+)|story_fbid=(\d+)|\/permalink\.php.*?story_fbid=(\d+)|\/(\d{15,})/);
  const postId = postIdMatch ? (postIdMatch[1] || postIdMatch[2] || postIdMatch[3] || postIdMatch[4]) : null;
  if (!postId) return { success: false, error: 'Cannot extract post ID' };

  const isPageReply = !!pageId;
  const actorId = isPageReply ? pageId : userId;

  try {
    const params = new URLSearchParams({
      'fb_dtsg': dtsg,
      'variables': JSON.stringify({
        feedbackID: Buffer.from(`feedback:${postId}`).toString('base64'),
        parentCommentID: commentId,
        message: { text: replyText },
        isPage: isPageReply,
        ...(isPageReply ? { actor_id: pageId } : {}),
      }),
      'doc_id': '7834038266652962',
      '__user': userId,
      '__a': '1',
      'jazoest': calculateJazoest(dtsg),
    });

    if (isPageReply) {
      params.set('__csr', '');
      params.set('fb_api_caller_class', 'RelayModern');
    }

    const res = await axios.post('https://www.facebook.com/api/graphql/', params, {
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua || randomUA(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': postUrl,
        'Origin': 'https://www.facebook.com',
        'X-FB-Friendly-Name': 'CometUFICreateCommentMutation',
        ...(isPageReply ? { 'X-FB-Page-Actor': pageId } : {}),
      },
      timeout: 20000,
      ...proxyConfig,
    });
    const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    if (txt.includes('"comment"') || txt.includes('"id"')) return { success: true };
    if (txt.includes('error')) return { success: false, error: 'Facebook menolak permintaan - pastikan akun adalah admin halaman' };
    return { success: false, error: 'Unknown response' };
  } catch (err) {
    return { success: false, error: err.message };
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

async function runAutoReplyOnce(replyId) {
  const ar = db.prepare('SELECT * FROM auto_replies WHERE id = ?').get(replyId);
  if (!ar) return;

  const account = db.prepare("SELECT * FROM fb_accounts WHERE id = ? AND status = 'active'").get(ar.reply_account_id);
  if (!account) return;

  const postUrls = JSON.parse(ar.post_urls || '[]');
  const keywords = JSON.parse(ar.keywords || '[]');
  const repliedIds = new Set(JSON.parse(ar.replied_comment_ids || '[]'));
  let totalReplied = 0;
  const maxReplies = ar.max_replies_per_run || 10;

  for (const postUrl of postUrls) {
    if (!runningReplies.has(replyId)) break;
    if (totalReplied >= maxReplies) break;

    const { comments, dtsg, ua } = await fetchPostComments(account.cookies, postUrl, account.proxy);

    for (const comment of comments) {
      if (!runningReplies.has(replyId)) break;
      if (totalReplied >= maxReplies) break;
      if (repliedIds.has(comment.commentId)) continue;

      const matchedKw = matchesKeywords(comment.text, keywords);
      if (matchedKw) {
        const reply = processSpintax(ar.reply_template);
        const pageId = ar.reply_mode === 'as_page' ? ar.page_id : null;
        const result = await replyToComment(account.cookies, postUrl, comment.commentId, reply, dtsg, ua, pageId, account.proxy);

        const logId = uuidv4();
        db.prepare(`INSERT INTO auto_reply_logs (id, reply_id, post_url, commenter_name, comment_text, matched_keyword, reply_sent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(logId, replyId, postUrl, comment.authorName, comment.text.slice(0, 200), matchedKw, reply, result.success ? 'success' : 'failed');
        if (!result.success) {
          db.prepare(`UPDATE auto_reply_logs SET status = ? WHERE id = ?`)
            .run(formatFbError(result.code ? result : result.error, 'auto_reply.comment') || 'failed', logId);
        }

        repliedIds.add(comment.commentId);
        if (result.success) {
          totalReplied++;
          db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(account.id);
          await randomDelay(5, 15);
        }
      }
    }
    await sleep(3000);
  }

  const trimmedReplied = [...repliedIds].slice(-1000);
  const nextRun = new Date(Date.now() + ar.check_interval * 60 * 1000).toISOString();
  db.prepare(`UPDATE auto_replies SET replied_comment_ids = ?, total_replied = total_replied + ?, last_check = CURRENT_TIMESTAMP, next_check = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(JSON.stringify(trimmedReplied), totalReplied, nextRun, replyId);

  try {
    const { logSchedulerEvent } = require('./schedulerLog');
    logSchedulerEvent({
      type: 'auto_reply_check',
      userId: ar.user_id,
      targetId: replyId,
      targetName: ar.name,
      status: totalReplied > 0 ? 'success' : 'info',
      message: `Auto-reply "${ar.name}" — ${totalReplied} balasan dikirim`,
    });
  } catch {}
}

async function startAutoReply(replyId) {
  if (runningReplies.has(replyId)) return { error: 'Auto-reply sudah berjalan' };
  const ar = db.prepare('SELECT * FROM auto_replies WHERE id = ?').get(replyId);
  if (!ar) return { error: 'Auto-reply tidak ditemukan' };

  runningReplies.add(replyId);
  db.prepare("UPDATE auto_replies SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(replyId);

  (async () => {
    try {
      while (runningReplies.has(replyId)) {
        await runAutoReplyOnce(replyId);
        if (!runningReplies.has(replyId)) break;
        const fresh = db.prepare('SELECT check_interval FROM auto_replies WHERE id = ?').get(replyId);
        const waitMs = (fresh?.check_interval || 30) * 60 * 1000;
        const chunk = 15000;
        let waited = 0;
        while (waited < waitMs && runningReplies.has(replyId)) {
          await sleep(chunk);
          waited += chunk;
        }
      }
    } finally {
      runningReplies.delete(replyId);
      db.prepare("UPDATE auto_replies SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(replyId);
    }
  })();

  return { message: 'Auto-reply dimulai' };
}

function stopAutoReply(replyId) {
  runningReplies.delete(replyId);
  db.prepare("UPDATE auto_replies SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(replyId);
  return { message: 'Auto-reply dihentikan' };
}

function isRunning(replyId) { return runningReplies.has(replyId); }

module.exports = { startAutoReply, stopAutoReply, isRunning };
