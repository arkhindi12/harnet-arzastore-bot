const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
];

const ACCEPT_LANGUAGES = [
  'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'id-ID,id;q=0.9,en;q=0.8',
  'en-US,en;q=0.9,id;q=0.8',
  'id;q=0.9,en-US;q=0.8,en;q=0.7',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomLang() {
  return ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
}

function parseCookies(cookieString) {
  const str = (cookieString || '').trim();
  const cookies = {};
  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      arr.forEach(c => { if (c.name && c.value !== undefined) cookies[c.name] = String(c.value); });
      return cookies;
    } catch {}
  }
  str.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key.trim()] = val.join('=').trim();
  });
  return cookies;
}

function getCookieHeader(cookieString) {
  const str = cookieString.trim();
  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr
        .filter(c => c.name && c.value !== undefined)
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } catch {}
  }
  return str;
}

function getDtsgToken(html) {
  const match = html.match(/"DTSGInitialData".*?"token":"([^"]+)"/);
  if (match) return match[1];
  const match2 = html.match(/name="fb_dtsg" value="([^"]+)"/);
  if (match2) return match2[1];
  const match3 = html.match(/"DTSGInitData".*?"token":"([^"]+)"/);
  if (match3) return match3[1];
  return null;
}

function getUserId(cookieString) {
  const cookies = parseCookies(cookieString);
  return cookies['c_user'] || cookies['i_user'] || null;
}

function detectCheckpoint(html) {
  if (!html) return false;
  const checkpointKeywords = [
    'checkpoint', 'suspicious', 'verify your account', 'verifikasi akun',
    'security check', 'pemeriksaan keamanan', 'confirm your identity',
    'account has been locked', 'akunmu dikunci', 'suspicious activity',
    'aktivitas mencurigakan', 'please verify', 'harap verifikasi',
    'two-factor', 'autentikasi dua faktor', 'confirm it\'s you',
    'account temporarily locked', 'unusual activity',
  ];
  const lower = html.toLowerCase();
  return checkpointKeywords.some(kw => lower.includes(kw));
}

function createProxyAgent(proxyUrl) {
  if (!proxyUrl || !proxyUrl.trim()) return null;
  const url = proxyUrl.trim();
  try {
    if (url.startsWith('socks5://') || url.startsWith('socks4://') || url.startsWith('socks://')) {
      return new SocksProxyAgent(url);
    }
    return new HttpsProxyAgent(url);
  } catch (e) {
    console.warn('[Proxy] Gagal membuat proxy agent:', e.message);
    return null;
  }
}

function buildAxiosConfig(extra = {}, proxyUrl = null) {
  const agent = createProxyAgent(proxyUrl);
  const config = { ...extra };
  if (agent) {
    config.httpsAgent = agent;
    config.httpAgent = agent;
    config.proxy = false;
  }
  return config;
}

function normalizeFacebookError(error, context = 'facebook') {
  const raw = typeof error === 'string' ? error : (error?.message || 'Error tidak diketahui');
  const lower = raw.toLowerCase();

  if (lower.includes('checkpoint') || lower.includes('security')) {
    return {
      success: false,
      code: 'CHECKPOINT_DETECTED',
      message: 'Facebook meminta checkpoint/security check',
      detail: raw,
      retryable: false,
      recommendation: 'Login manual di browser, selesaikan checkpoint, lalu ambil cookie baru.',
      context,
    };
  }
  if (lower.includes('login')) {
    return {
      success: false,
      code: 'LOGIN_REQUIRED',
      message: 'Facebook meminta login ulang',
      detail: raw,
      retryable: false,
      recommendation: 'Ambil cookie baru dari browser yang sudah login.',
      context,
    };
  }
  if (lower.includes('http 400') || lower.includes('bad request')) {
    return {
      success: false,
      code: 'BAD_REQUEST',
      message: 'Request ditolak Facebook',
      detail: raw,
      retryable: true,
      recommendation: 'Coba User-Agent yang sama dengan browser asal cookie atau gunakan proxy yang konsisten.',
      context,
    };
  }
  if (lower.includes('http 403') || lower.includes('akses ditolak') || lower.includes('forbidden')) {
    return {
      success: false,
      code: 'ACCESS_DENIED',
      message: 'Akses ditolak Facebook',
      detail: raw,
      retryable: false,
      recommendation: 'Akun/session kemungkinan dibatasi. Coba akun lain atau update cookie.',
      context,
    };
  }
  if (lower.includes('timedout') || lower.includes('timeout') || lower.includes('econnreset') || lower.includes('econnrefused')) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Koneksi ke Facebook/proxy bermasalah',
      detail: raw,
      retryable: true,
      recommendation: 'Cek koneksi internet atau proxy akun.',
      context,
    };
  }
  if (lower.includes('post id') || lower.includes('feed')) {
    return {
      success: false,
      code: 'FEED_NOT_READABLE',
      message: 'Feed terbuka tapi tidak bisa diparse',
      detail: raw,
      retryable: true,
      recommendation: 'Warming tetap bisa lanjut dengan browse; aksi like mungkin dilewati.',
      context,
    };
  }

  return {
    success: false,
    code: 'UNKNOWN_FACEBOOK_ERROR',
    message: 'Facebook mengembalikan error tidak dikenal',
    detail: raw,
    retryable: true,
    recommendation: 'Cek cookie, User-Agent, proxy, dan ulangi beberapa saat lagi.',
    context,
  };
}

async function validateAccount(cookieString, proxyUrl = null, userAgent = null) {
  try {
    // Cek apakah cookies memiliki c_user (user ID)
    const userId = getUserId(cookieString);
    if (!userId) {
      const normalized = normalizeFacebookError('Cookies tidak memiliki c_user (User ID)', 'account.validate');
      return { valid: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
    }

    // Cek apakah cookies memiliki xs (session token)
    const cookies = parseCookies(cookieString);
    if (!cookies['xs']) {
      const normalized = normalizeFacebookError('Cookies tidak memiliki xs (session token)', 'account.validate');
      return { valid: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
    }

    const strictValidation = process.env.FB_STRICT_VALIDATION === 'true';
    if (!strictValidation) {
      return {
        valid: true,
        userId,
        name: `Facebook ${userId}`,
        warning: 'Validasi struktur cookie berhasil. Validasi online Facebook dilewati karena mode strict nonaktif.',
      };
    }

    const ua = userAgent || randomUA();
    const response = await axios.get('https://www.facebook.com/', buildAxiosConfig({
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': randomLang(),
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      timeout: 20000,
      maxRedirects: 5,
    }, proxyUrl));

    const html = response.data;

    if (detectCheckpoint(html)) {
      const normalized = normalizeFacebookError('Akun terkena checkpoint Facebook', 'account.validate');
      return { valid: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation, checkpoint: true };
    }

    // Cek berbagai indikator login
    const isLoggedIn = html.includes('"actorID"') || 
                       html.includes('"USER_ID"') || 
                       html.includes('c_user') ||
                       html.includes('"userID"') ||
                       html.includes('ACCOUNT_ID') ||
                       html.includes('CurrentUserInitialData') ||
                       !html.includes('login');

    // Cari nama user
    let name = 'Akun Facebook';
    const namePatterns = [
      /"NAME":"([^"]+)"/,
      /"name":"([^"]+)"/,
      /"fullName":"([^"]+)"/,
      /"firstName":"([^"]+)"/,
    ];
    
    for (const pattern of namePatterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].length > 0 && match[1] !== 'null') {
        name = match[1];
        break;
      }
    }

    return {
      valid: isLoggedIn,
      userId,
      name: name || 'Akun Facebook',
    };
  } catch (err) {
    const normalized = normalizeFacebookError(
      err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT'
        ? `Proxy error: ${err.message}`
        : err.message,
      'account.validate'
    );
    return { valid: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
  }
}

async function getPageToken(cookieString, targetUrl, proxyUrl = null, userAgent = null) {
  try {
    const ua = userAgent || randomUA();
    const response = await axios.get(targetUrl, buildAxiosConfig({
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': randomLang(),
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.facebook.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'max-age=0',
      },
      timeout: 20000,
    }, proxyUrl));

    const html = response.data;

    if (detectCheckpoint(html)) {
      return { html, dtsg: null, checkpoint: true };
    }

    const dtsg = getDtsgToken(html);
    return { html, dtsg, checkpoint: false };
  } catch (err) {
    return { html: null, dtsg: null, checkpoint: false, error: err.message };
  }
}

function extractPostId(url) {
  const patterns = [
    /\/posts\/(\d+)/,
    /story_fbid=(\d+)/,
    /pfbid([A-Za-z0-9]+)/,
    /\/(\d{15,})/,
    /v=(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function postComment(cookieString, targetUrl, commentText, proxyUrl = null, userAgent = null) {
  const userId = getUserId(cookieString);
  if (!userId) {
    const normalized = normalizeFacebookError('Tidak bisa mendapatkan User ID dari cookies', 'comment.post');
    return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
  }

  const { html, dtsg, checkpoint, error: pageError } = await getPageToken(cookieString, targetUrl, proxyUrl, userAgent);

  if (checkpoint) {
    const normalized = normalizeFacebookError('Akun terkena checkpoint Facebook - butuh verifikasi manual', 'comment.post');
    return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation, checkpoint: true };
  }

  if (!html) {
    const normalized = normalizeFacebookError(`Gagal memuat halaman: ${pageError}`, 'comment.post');
    return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
  }

  if (!dtsg) {
    const normalized = normalizeFacebookError('Tidak bisa mendapatkan token DTSG (cookies mungkin expired)', 'comment.post');
    return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
  }

  const postId = extractPostId(targetUrl);
  if (!postId) {
    const normalized = normalizeFacebookError('Tidak bisa mengekstrak Post ID dari URL', 'comment.post');
    return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
  }

  const ua = userAgent || randomUA();

  try {
    const response = await axios.post(
      'https://www.facebook.com/api/graphql/',
      new URLSearchParams({
        'fb_dtsg': dtsg,
        'variables': JSON.stringify({
          'feedbackID': Buffer.from(`feedback:${postId}`).toString('base64'),
          'message': { 'text': commentText },
          'isPage': false,
          'UFI2CommentsProvider_commentsKey': 'UFI2CommentsProvider/default',
        }),
        'doc_id': '7834038266652962',
        '__user': userId,
        '__a': '1',
        'jazoest': calculateJazoest(dtsg),
      }),
      buildAxiosConfig({
        headers: {
          'Cookie': getCookieHeader(cookieString),
          'User-Agent': ua,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': targetUrl,
          'Origin': 'https://www.facebook.com',
          'Accept': '*/*',
          'Accept-Language': randomLang(),
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'X-FB-Friendly-Name': 'CometUFICreateCommentMutation',
          'X-FB-LSD': dtsg.substring(0, 10),
        },
        timeout: 20000,
      }, proxyUrl)
    );

    const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    if (detectCheckpoint(responseText)) {
      const normalized = normalizeFacebookError('Akun terkena checkpoint Facebook', 'comment.post');
      return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation, checkpoint: true };
    }

    if (responseText.includes('"comment"') || responseText.includes('"id"')) {
      if (responseText.includes('error') && !responseText.includes('"comment"')) {
        const normalized = normalizeFacebookError('Facebook menolak komentar (rate limited atau blocked)', 'comment.post');
        return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
      }
      return { success: true, message: 'Komentar berhasil dikirim' };
    }

    if (responseText.includes('spam') || responseText.includes('block')) {
      const normalized = normalizeFacebookError('Komentar diblokir sebagai spam oleh Facebook', 'comment.post');
      return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
    }

    const normalized = normalizeFacebookError('Response tidak dikenal dari Facebook', 'comment.post');
    return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
  } catch (err) {
    const normalized = normalizeFacebookError(
      err.response?.status === 400
        ? 'Bad Request - cookies mungkin expired atau invalid'
        : err.response?.status === 403
          ? 'Akses ditolak - akun mungkin dibatasi'
          : err.message,
      'comment.post'
    );
    return { success: false, error: normalized.message, detail: normalized.detail, code: normalized.code, recommendation: normalized.recommendation };
  }
}

function calculateJazoest(dtsg) {
  let sum = 0;
  for (const char of dtsg) {
    sum += char.charCodeAt(0);
  }
  return `2${sum}`;
}

async function searchPosts(keyword, cookieString, proxy = null) {
  const headers = {
    'Cookie': getCookieHeader(cookieString),
    'User-Agent': randomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': randomLang(),
    'Referer': 'https://www.facebook.com/',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'navigate',
  };
  const config = { headers, timeout: 20000, maxRedirects: 3 };
  if (proxy) config.httpsAgent = createProxyAgent(proxy);

  try {
    const url = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(keyword)}&filters=eyJycF9jcmVhdGlvbl90aW1lIjoieyBcIm5hbWVcIjogXCJjcmVhdGlvbl90aW1lXCIsIFwidHlwZVwiOiBcInJhbmdlXCIsIFwiYXJnc1wiOiBcIlwiIH0ifQ%3D%3D`;
    const resp = await axios.get(url, config);
    const html = resp.data;

    if (detectCheckpoint(html)) {
      return { success: false, checkpoint: true, urls: [] };
    }

    const urls = new Set();
    const patterns = [
      /https?:\/\/www\.facebook\.com\/(?:[\w.]+)\/posts\/(?:pfbid)?[\w]+/g,
      /https?:\/\/www\.facebook\.com\/permalink\.php\?story_fbid=[\w]+&id=[\w]+/g,
      /https?:\/\/www\.facebook\.com\/groups\/[\w.]+\/permalink\/[\w]+/g,
      /https?:\/\/www\.facebook\.com\/photo\/\?fbid=[\w]+/g,
    ];

    const cleanHtml = html.replace(/\\u003C/gi, '<').replace(/\\u003E/gi, '>').replace(/\\u0026/g, '&').replace(/\\/g, '');

    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(cleanHtml)) !== null) {
        const u = m[0].split('"')[0].split("'")[0].split('\\')[0];
        if (!u.includes('search') && u.length > 40) urls.add(u);
      }
    }

    const postIds = [...cleanHtml.matchAll(/"post_id":"(\d+)"/g)].map(m => m[1]);
    for (const id of postIds.slice(0, 10)) {
      urls.add(`https://www.facebook.com/permalink.php?story_fbid=${id}&id=${id}`);
    }

    return { success: true, urls: [...urls].slice(0, 20), total: urls.size };
  } catch (err) {
    return { success: false, error: err.message, urls: [] };
  }
}

async function diagnoseAccount(cookieString, proxyUrl = null, userAgent = null) {
  const cookies = parseCookies(cookieString);
  const userId = getUserId(cookieString);
  const diagnostics = {
    cookie_present: !!cookieString,
    has_c_user: !!cookies.c_user,
    has_xs: !!cookies.xs,
    has_datr: !!cookies.datr,
    user_id: userId || null,
    web_ok: false,
    mobile_ok: false,
    dtsg_found: false,
    checkpoint: false,
    login_redirect: false,
    feed_readable: false,
    error: null,
    recommendation: null,
  };

  if (!diagnostics.has_c_user || !diagnostics.has_xs) {
    diagnostics.error = 'Cookie dasar tidak lengkap';
    diagnostics.recommendation = 'Gunakan cookie yang memiliki c_user dan xs';
    return diagnostics;
  }

  const ua = userAgent || randomUA();
  const targets = [
    { key: 'web_ok', url: 'https://www.facebook.com/' },
    { key: 'mobile_ok', url: 'https://m.facebook.com/' },
  ];

  for (const target of targets) {
    try {
      const response = await axios.get(target.url, buildAxiosConfig({
        headers: {
          'Cookie': getCookieHeader(cookieString),
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': randomLang(),
          'Referer': target.url,
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: status => status < 500,
      }, proxyUrl));

      const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      if (response.status < 400) diagnostics[target.key] = true;
      if (detectCheckpoint(html)) diagnostics.checkpoint = true;
      if (/login|Log in|Masuk/i.test(html) && !html.includes('c_user') && !html.includes('DTSGInitialData') && !html.includes('fb_dtsg')) {
        diagnostics.login_redirect = true;
      }
      if (getDtsgToken(html)) diagnostics.dtsg_found = true;
      if (/storyID|post_id|topLevelPostID|story_fbid|ft_ent_identifier/i.test(html)) diagnostics.feed_readable = true;
    } catch (err) {
      diagnostics.error = diagnostics.error || err.message;
    }
  }

  if (diagnostics.checkpoint) diagnostics.recommendation = 'Selesaikan checkpoint/login challenge di browser lalu ambil cookie baru';
  else if (diagnostics.login_redirect) diagnostics.recommendation = 'Cookie masih tersimpan tapi Facebook meminta login ulang';
  else if (!diagnostics.web_ok && !diagnostics.mobile_ok) diagnostics.recommendation = 'Coba isi User-Agent yang sama dengan browser asal dan gunakan proxy yang konsisten';
  else if (!diagnostics.feed_readable) diagnostics.recommendation = 'Akun bisa browse, tapi feed sulit diparse untuk automasi';
  else diagnostics.recommendation = 'Akun cukup sehat untuk browsing dasar';

  return diagnostics;
}

module.exports = { validateAccount, postComment, getUserId, detectCheckpoint, createProxyAgent, searchPosts, diagnoseAccount, getCookieHeader, parseCookies, randomUA, randomLang, buildAxiosConfig, getDtsgToken, calculateJazoest, normalizeFacebookError };
