const axios = require('axios');
const { getCookieHeader, getUserId, getDtsgToken, randomUA, createProxyAgent } = require('./facebookService');

function extractGroupsFromHtml(html) {
  const groups = [];
  const seen = new Set();
  const clean = String(html || '')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/');

  const patterns = [
    /"name":"([^"]{3,80})","url":"(https?:\/\/www\.facebook\.com\/groups\/[^"]+)"/g,
    /{"__typename":"Group","id":"(\d+)","name":"([^"]+)"/g,
  ];

  const p1 = /"name":"([^"]{3,80})","url":"(https:\\\/\\\/www\.facebook\.com\\\/groups\\\/[^"]+)"/g;
  let m;
  while ((m = p1.exec(clean)) !== null) {
    const name = m[1].replace(/\\u[\dA-F]{4}/gi, c => String.fromCharCode(parseInt(c.slice(2), 16)));
    const url = m[2];
    const key = url;
    if (!seen.has(key) && !url.includes('create') && !url.includes('feed')) {
      seen.add(key);
      groups.push({ name: name.trim(), url: url.split('?')[0] });
    }
  }

  if (groups.length < 3) {
    const urls = [...clean.matchAll(/(?:facebook\.com|m\.facebook\.com|mbasic\.facebook\.com)\/groups\/([a-zA-Z0-9._-]+)/g)];
    for (const mu of urls) {
      const slug = mu[1];
      if (['feed', 'create', 'discover', 'membership', 'search'].includes(slug)) continue;
      const url = `https://www.facebook.com/groups/${slug}`;
      if (!seen.has(url)) {
        seen.add(url);
        groups.push({ name: slug, url });
      }
    }
  }

  return groups;
}

async function fetchGroupsViaGraphQL(cookieString, proxyUrl = null) {
  const userId = getUserId(cookieString);
  const ua = randomUA();
  const agent = proxyUrl ? createProxyAgent(proxyUrl) : null;
  const proxyConfig = agent ? { httpsAgent: agent, httpAgent: agent, proxy: false } : {};
  const cookieHeader = getCookieHeader(cookieString);

  const homeRes = await axios.get('https://www.facebook.com/', {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      'Referer': 'https://www.facebook.com/',
    },
    timeout: 15000,
    ...proxyConfig,
  });

  const dtsg = getDtsgToken(homeRes.data);
  if (!dtsg) return { groups: [], error: 'Token tidak ditemukan - coba validasi cookies dulu' };

  const graphRes = await axios.post('https://www.facebook.com/api/graphql/', new URLSearchParams({
    'fb_dtsg': dtsg,
    'variables': JSON.stringify({
      count: 50,
      cursor: null,
      scale: 1,
    }),
    'doc_id': '6950734521609935',
    '__user': userId,
    '__a': '1',
    '__req': Math.random().toString(36).slice(2, 5),
  }), {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': ua,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://www.facebook.com/groups/feed/',
      'Origin': 'https://www.facebook.com',
      'X-FB-Friendly-Name': 'GroupsCometFeedRegularStoriesProviderQuery',
    },
    timeout: 20000,
    ...proxyConfig,
  });

  const txt = typeof graphRes.data === 'string' ? graphRes.data : JSON.stringify(graphRes.data);
  return { groups: extractGroupsFromHtml(txt), dtsg, ua };
}

async function fetchGroupsFromPage(cookieString, proxyUrl = null) {
  const ua = randomUA();
  const mobileUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  const agent = proxyUrl ? createProxyAgent(proxyUrl) : null;
  const proxyConfig = agent ? { httpsAgent: agent, httpAgent: agent, proxy: false } : {};
  const cookieHeader = getCookieHeader(cookieString);
  const urls = [
    'https://www.facebook.com/groups/feed/',
    'https://m.facebook.com/groups/?seemore',
    'https://m.facebook.com/groups/feed/',
    'https://mbasic.facebook.com/groups/?seemore',
  ];
  const errors = [];

  for (const url of urls) {
    const isMobile = url.includes('m.facebook.com') || url.includes('mbasic.facebook.com');
    try {
      const res = await axios.get(url, {
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': isMobile ? mobileUa : ua,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          'Referer': isMobile ? 'https://m.facebook.com/' : 'https://www.facebook.com/',
        },
        timeout: 15000,
        validateStatus: status => status < 500,
        ...proxyConfig,
      });
      if (res.status >= 400) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const groups = extractGroupsFromHtml(res.data);
      if (groups.length) return { groups, ua, sourceUrl: url };
      errors.push(`${url}: tidak ada grup terdeteksi`);
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }

  return { groups: [], ua, error: errors.join(' | ') };
}

async function fetchGroupsFromMembership(cookieString, proxyUrl = null) {
  const ua = randomUA();
  const agent = proxyUrl ? createProxyAgent(proxyUrl) : null;
  const proxyConfig = agent ? { httpsAgent: agent, httpAgent: agent, proxy: false } : {};
  const cookieHeader = getCookieHeader(cookieString);
  const userId = getUserId(cookieString);

  const homeRes = await axios.get('https://www.facebook.com/', {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: 15000,
    ...proxyConfig,
  });
  const dtsg = getDtsgToken(homeRes.data);
  if (!dtsg) return { groups: [], error: 'Gagal mendapat token' };

  const res = await axios.post('https://www.facebook.com/api/graphql/', new URLSearchParams({
    'fb_dtsg': dtsg,
    'variables': JSON.stringify({ count: 30, cursor: null }),
    'doc_id': '5715071428551549',
    '__user': userId,
    '__a': '1',
  }), {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': ua,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://www.facebook.com/groups/membership/',
      'Origin': 'https://www.facebook.com',
    },
    timeout: 20000,
    ...proxyConfig,
  });

  const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  const groups = extractGroupsFromHtml(txt);

  const extraPattern = /"node":\{"id":"(\d+)","name":"([^"]+)","url":"(https:[^"]+groups[^"]+)"/g;
  let m;
  const seen = new Set(groups.map(g => g.url));
  while ((m = extraPattern.exec(txt)) !== null) {
    const url = m[3].replace(/\\\//g, '/').split('?')[0];
    const name = m[2];
    if (!seen.has(url) && url.includes('/groups/')) {
      seen.add(url);
      groups.push({ name, url });
    }
  }

  return { groups, dtsg, ua };
}

async function fetchUserGroups(cookieString, proxyUrl = null) {
  const errors = [];

  try {
    const r1 = await fetchGroupsViaGraphQL(cookieString, proxyUrl);
    if (r1.groups && r1.groups.length > 0) {
      return { success: true, groups: dedup(r1.groups), source: 'graphql' };
    }
    if (r1.error) errors.push(r1.error);
  } catch (e) { errors.push(`GraphQL: ${e.message}`); }

  try {
    const r2 = await fetchGroupsFromMembership(cookieString, proxyUrl);
    if (r2.groups && r2.groups.length > 0) {
      return { success: true, groups: dedup(r2.groups), source: 'membership' };
    }
    if (r2.error) errors.push(r2.error);
  } catch (e) { errors.push(`Membership: ${e.message}`); }

  try {
    const r3 = await fetchGroupsFromPage(cookieString, proxyUrl);
    if (r3.groups && r3.groups.length > 0) {
      return { success: true, groups: dedup(r3.groups), source: 'page' };
    }
    if (r3.error) errors.push(`Page: ${r3.error}`);
  } catch (e) { errors.push(`Page: ${e.message}`); }

  return {
    success: false,
    groups: [],
    error: 'Tidak berhasil memuat grup. Pastikan cookies aktif dan akun sudah bergabung di beberapa grup.',
    detail: errors.join(' | '),
  };
}

function dedup(groups) {
  const seen = new Set();
  return groups.filter(g => {
    const key = g.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchUserGroupsSmart(accountId, cookieString, proxyUrl = null) {
  const db = require('../db/database');

  // 1. Cek stored groups dulu (hasil discovery browser sebelumnya)
  try {
    const stored = db.prepare('SELECT group_id, name, url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC').all(accountId);
    if (stored.length > 0) {
      const ageRow = db.prepare('SELECT MAX(last_seen) as latest FROM account_groups WHERE account_id = ?').get(accountId);
      return {
        success: true,
        groups: stored.map(s => ({ id: s.group_id, name: s.name, url: s.url })),
        source: 'stored_browser',
        last_synced: ageRow?.latest || null,
      };
    }
  } catch (e) {
    // tabel belum ada / gagal akses: lanjut ke fallback axios
  }

  // 2. Coba axios path (cepat tapi sering 400)
  const axiosResult = await fetchUserGroups(cookieString, proxyUrl);
  if (axiosResult.success) return axiosResult;

  // 3. Fallback ke browser discovery (lambat tapi paling akurat)
  try {
    const { discoverGroups, getStoredGroups } = require('./browserDiscovery');
    const r = await discoverGroups(accountId);
    if (r.success) {
      const stored = getStoredGroups(accountId);
      return {
        success: true,
        groups: stored.map(s => ({ id: s.group_id, name: s.name, url: s.url })),
        source: 'browser_live',
      };
    }
    return {
      success: false,
      groups: [],
      error: r.error || 'Browser discovery gagal',
      detail: axiosResult.detail,
    };
  } catch (e) {
    return {
      success: false,
      groups: [],
      error: `Browser discovery error: ${e.message}`,
      detail: axiosResult.detail,
    };
  }
}

module.exports = { fetchUserGroups, fetchUserGroupsSmart };
