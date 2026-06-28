// Service Anti-Detection: kumpulkan metric per akun untuk dashboard.
// Tidak panggil Facebook real-time — semua dihitung dari DB cache & state lokal supaya cepat.

const db = require('../db/database');
const { computeFatigueForAccount } = require('./fatigueService');
const axios = require('axios');
const { createProxyAgent } = require('./facebookService');

function parseCookies(str) {
  if (!str) return {};
  const out = {};
  for (const part of str.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function cookieAgeDays(cookieStr) {
  // FB cookie tidak punya issuedAt; kita pakai datr (~ID device awal). Kalau ada `xs`,
  // ambil bagian timestamp dari xs (format: id:salt:0:timestamp:hash).
  try {
    const parsed = parseCookies(cookieStr);
    const xs = parsed.xs;
    if (xs) {
      // xs token punya beberapa segment dipisah :; biasanya segment 4 (index 3) berisi timestamp creation
      const parts = decodeURIComponent(xs).split(':');
      for (const p of parts) {
        const n = Number(p);
        if (n && n > 1500000000 && n < Date.now() / 1000 + 1000) {
          return Math.floor((Date.now() / 1000 - n) / 86400);
        }
      }
    }
    return null;
  } catch { return null; }
}

function fingerprintBuckets(accounts) {
  // Bucket akun yang share user_agent atau proxy yang sama → potensi mass-detection.
  const uaMap = new Map();
  const proxyMap = new Map();
  for (const a of accounts) {
    if (a.user_agent) {
      const list = uaMap.get(a.user_agent) || [];
      list.push(a.id);
      uaMap.set(a.user_agent, list);
    }
    if (a.proxy) {
      const list = proxyMap.get(a.proxy) || [];
      list.push(a.id);
      proxyMap.set(a.proxy, list);
    }
  }
  const sharedUA = [...uaMap.entries()].filter(([, ids]) => ids.length > 1);
  const sharedProxy = [...proxyMap.entries()].filter(([, ids]) => ids.length > 1);
  return { sharedUA, sharedProxy };
}

function recentErrorTrend(accountId) {
  const last24 = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM comment_logs
    WHERE account_id = ? AND created_at >= datetime('now', '-24 hours')
  `).get(accountId) || {};
  const last7d = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM comment_logs
    WHERE account_id = ? AND created_at >= datetime('now', '-7 days')
  `).get(accountId) || {};
  return {
    last24: {
      total: Number(last24.total || 0),
      success: Number(last24.success || 0),
      failed: Number(last24.failed || 0),
      failRatio: Number(last24.total || 0) > 0 ? Number((last24.failed || 0) / last24.total) : 0,
    },
    last7d: {
      total: Number(last7d.total || 0),
      success: Number(last7d.success || 0),
      failed: Number(last7d.failed || 0),
      failRatio: Number(last7d.total || 0) > 0 ? Number((last7d.failed || 0) / last7d.total) : 0,
    },
  };
}

function topErrorReasons(accountId, limit = 5) {
  return db.prepare(`
    SELECT error_message, COUNT(*) as count
    FROM comment_logs
    WHERE account_id = ? AND status = 'failed' AND error_message IS NOT NULL
      AND created_at >= datetime('now', '-7 days')
    GROUP BY error_message
    ORDER BY count DESC
    LIMIT ?
  `).all(accountId, limit);
}

function riskScore(input) {
  // 0..100. Tinggi = makin berisiko.
  let score = 0;
  if (input.fatigue_level === 'high') score += 40;
  else if (input.fatigue_level === 'medium') score += 20;

  if (input.failRatio24 > 0.5) score += 25;
  else if (input.failRatio24 > 0.3) score += 15;

  if (input.cookieAgeDays !== null && input.cookieAgeDays > 60) score += 10;
  else if (input.cookieAgeDays !== null && input.cookieAgeDays > 120) score += 20;

  if (input.proxyShared) score += 15;
  if (input.uaShared) score += 15;

  if (input.cooldownActive) score += 10;
  if (input.status === 'checkpoint') score += 25;
  if (input.status === 'invalid' || input.status === 'problematic') score += 20;
  return Math.min(100, score);
}

function riskLevel(score) {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function recommendationsFor(account, metrics) {
  const tips = [];
  if (metrics.fatigue_level === 'high') tips.push('Akun fatigue tinggi — istirahatkan dulu, jangan dipakai 12 jam ke depan.');
  if (metrics.failRatio24 > 0.4) tips.push('Tingkat gagal 24 jam tinggi — kurangi load atau ganti proxy.');
  if (metrics.cookieAgeDays !== null && metrics.cookieAgeDays > 90) tips.push('Cookie sudah lebih dari 90 hari — pertimbangkan refresh cookie dari login baru.');
  if (metrics.uaShared) tips.push('User agent dipakai bersama akun lain — ganti dengan UA unik per akun.');
  if (metrics.proxyShared) tips.push('Proxy dipakai bersama akun lain — minimal 1 IP per 2 akun.');
  if (account.status === 'checkpoint') tips.push('Akun sedang checkpoint — selesaikan verifikasi manual dulu.');
  if (!account.proxy) tips.push('Akun belum pakai proxy — risk lebih tinggi untuk multi-akun.');
  if (!tips.length) tips.push('Akun terlihat sehat. Jaga ritme aktivitas dan rotasi konten.');
  return tips;
}

async function checkProxyHealth(proxyUrl, timeoutMs = 8000) {
  if (!proxyUrl) return { ok: null, reason: 'no_proxy' };

  // Multi-target fallback: kalau target pertama down, coba target lain
  // Ini mencegah false positive "proxy dead" hanya karena 1 server down
  const targets = [
    { url: 'http://ip-api.com/json/?fields=query', parse: d => d?.query },
    { url: 'http://ifconfig.me/ip', parse: d => typeof d === 'string' ? d.trim() : null },
    { url: 'http://httpbin.org/ip', parse: d => d?.origin },
    { url: 'http://checkip.amazonaws.com', parse: d => typeof d === 'string' ? d.trim() : null },
  ];

  const agent = createProxyAgent(proxyUrl);
  if (!agent) return { ok: false, reason: 'agent_failed' };

  let lastError = null;
  let bestLatency = Infinity;

  // Retry: coba max 2 putaran, tiap putaran coba target berbeda
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const target of targets) {
      try {
        const start = Date.now();
        const res = await axios.get(target.url, {
          httpsAgent: agent,
          httpAgent: agent,
          proxy: false,
          timeout: timeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
        });
        const latency = Date.now() - start;
        if (latency < bestLatency) bestLatency = latency;

        // 407 = target endpoint ini reject — coba endpoint lain dulu
        // (httpbin.org diketahui 407 untuk beberapa proxy, tapi proxy sebenarnya jalan)
        if (res.status === 407) {
          lastError = 'auth_failed_407';
          continue;
        }

        // Cek auth error di body — skip ke endpoint lain
        const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');
        if (/invalid.*credential|not authenticated|auth.*required|ip.*not.*authorized/i.test(body)) {
          lastError = 'auth_failed_body';
          continue;
        }

        // Status 200-399 = OK
        if (res.status >= 200 && res.status < 400) {
          const ip = target.parse(res.data);
          return { ok: true, status: res.status, latency, ip: ip || undefined };
        }

        // Non-2xx non-auth: coba target lain
        lastError = `http_${res.status}`;
      } catch (e) {
        lastError = e.code || e.message;
        // ECONNREFUSED / auth error → proxy pasti mati, stop langsung
        if (e.code === 'ECONNREFUSED' || e.code === 'ERR_SOCKET_CLOSED') {
          return { ok: false, reason: lastError };
        }
        // Timeout / network error → coba target lain
        continue;
      }
    }

    // Sebelum retry kedua, tunggu sebentar
    if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
  }

  return { ok: false, reason: lastError || 'all_targets_failed', latency: bestLatency < Infinity ? bestLatency : undefined };
}

async function buildDashboard(userId, opts = {}) {
  const accounts = db.prepare(`
    SELECT id, name, status, proxy, user_agent, persona,
           fatigue_score, fatigue_level, fatigue_updated_at, cooldown_until,
           cookies, last_used, created_at
    FROM fb_accounts
    WHERE user_id = ?
  `).all(userId);

  const { sharedUA, sharedProxy } = fingerprintBuckets(accounts);
  const sharedUASet = new Set(sharedUA.flatMap(([, ids]) => ids));
  const sharedProxySet = new Set(sharedProxy.flatMap(([, ids]) => ids));

  const checkProxy = !!opts.checkProxy;
  const out = [];

  for (const a of accounts) {
    const fatigue = computeFatigueForAccount(a.id);
    const trend = recentErrorTrend(a.id);
    const errorReasons = topErrorReasons(a.id, 5);
    const cookieAge = cookieAgeDays(a.cookies);

    const cooldownActive = !!(a.cooldown_until && new Date(a.cooldown_until).getTime() > Date.now());
    let proxyHealth = null;
    if (checkProxy) {
      proxyHealth = await checkProxyHealth(a.proxy);
    }

    const score = riskScore({
      fatigue_level: a.fatigue_level || fatigue.level,
      failRatio24: trend.last24.failRatio,
      cookieAgeDays: cookieAge,
      proxyShared: sharedProxySet.has(a.id),
      uaShared: sharedUASet.has(a.id),
      cooldownActive,
      status: a.status,
    });
    const level = riskLevel(score);

    out.push({
      id: a.id,
      name: a.name,
      status: a.status,
      proxy: a.proxy ? true : false,
      proxy_shared: sharedProxySet.has(a.id),
      user_agent: a.user_agent,
      ua_shared: sharedUASet.has(a.id),
      persona: a.persona || 'natural',
      fatigue: { score: a.fatigue_score, level: a.fatigue_level || fatigue.level, updated_at: a.fatigue_updated_at },
      cooldown_until: a.cooldown_until,
      cooldown_active: cooldownActive,
      cookie_age_days: cookieAge,
      last_used: a.last_used,
      trend,
      top_errors: errorReasons,
      proxy_health: proxyHealth,
      risk_score: score,
      risk_level: level,
      recommendations: recommendationsFor(a, {
        fatigue_level: a.fatigue_level || fatigue.level,
        failRatio24: trend.last24.failRatio,
        cookieAgeDays: cookieAge,
        proxyShared: sharedProxySet.has(a.id),
        uaShared: sharedUASet.has(a.id),
      }),
    });
  }

  // Sort risiko tertinggi pertama
  out.sort((a, b) => b.risk_score - a.risk_score);

  const summary = {
    total: out.length,
    critical: out.filter(x => x.risk_level === 'critical').length,
    high: out.filter(x => x.risk_level === 'high').length,
    medium: out.filter(x => x.risk_level === 'medium').length,
    low: out.filter(x => x.risk_level === 'low').length,
    cooldown: out.filter(x => x.cooldown_active).length,
    shared_ua_groups: sharedUA.length,
    shared_proxy_groups: sharedProxy.length,
  };

  return { summary, accounts: out, fingerprint: { sharedUA, sharedProxy } };
}

module.exports = { buildDashboard, checkProxyHealth };
