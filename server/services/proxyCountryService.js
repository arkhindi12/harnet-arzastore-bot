// Proxy Country Detection: cek negara IP proxy via free geolocation API.
// Dipakai untuk warning user kalau proxy country beda dari cookie origin.

const axios = require('axios');
const { createProxyAgent } = require('./facebookService');

// Cache hasil lookup supaya tidak spam API
const cache = new Map(); // proxyUrl → { country, code, ts }
const CACHE_TTL = 3600000; // 1 jam
const CACHE_MAX_SIZE = 1000;

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (now - v.ts > CACHE_TTL) cache.delete(k);
  }
  if (cache.size > CACHE_MAX_SIZE) {
    const overflow = cache.size - CACHE_MAX_SIZE;
    const keys = [...cache.keys()].slice(0, overflow);
    for (const k of keys) cache.delete(k);
  }
}, 30 * 60 * 1000).unref();

async function detectProxyCountry(proxyUrl, timeoutMs = 8000) {
  if (!proxyUrl) return null;

  // Cek cache
  const cached = cache.get(proxyUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  try {
    const agent = createProxyAgent(proxyUrl);
    if (!agent) return null;

    // Pakai ip-api.com (gratis, 45 req/menit)
    const res = await axios.get('http://ip-api.com/json/?fields=status,country,countryCode,city,isp,proxy,hosting', {
      httpsAgent: agent,
      httpAgent: agent,
      proxy: false,
      timeout: timeoutMs,
    });

    if (res.data?.status === 'success') {
      const result = {
        country: res.data.country,
        code: res.data.countryCode,
        city: res.data.city || '',
        isp: res.data.isp || '',
        is_datacenter: !!(res.data.proxy || res.data.hosting),
        ts: Date.now(),
      };
      cache.set(proxyUrl, result);
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

// Detect cookie origin country dari timezone/locale hint di cookie
// Facebook xs cookie kadang punya region hint, tapi tidak reliable.
// Fallback: anggap Indonesia kalau tidak bisa detect.
function guessCookieOriginCountry(cookieString) {
  // Heuristic: kalau ada datr cookie, biasanya dari device pertama kali login.
  // Tidak ada cara pasti detect country dari cookie saja.
  // Default: Indonesia (karena target market app ini Indonesia)
  return { code: 'ID', country: 'Indonesia' };
}

function isCountryMismatch(proxyCountryCode, cookieCountryCode = 'ID') {
  if (!proxyCountryCode) return false; // tidak bisa detect = anggap OK
  const proxy = proxyCountryCode.toUpperCase();
  const cookie = (cookieCountryCode || 'ID').toUpperCase();

  if (proxy === cookie) return false; // match

  // Negara tetangga yang masih "aman" (Southeast Asia)
  const seaCountries = ['ID', 'SG', 'MY', 'TH', 'PH', 'VN', 'BN', 'KH', 'LA', 'MM', 'TL'];
  if (seaCountries.includes(proxy) && seaCountries.includes(cookie)) {
    return false; // masih 1 region, low risk
  }

  return true; // mismatch, high risk
}

function getRiskLevel(proxyCountryCode, cookieCountryCode = 'ID') {
  if (!proxyCountryCode) return 'unknown';
  const proxy = proxyCountryCode.toUpperCase();
  const cookie = (cookieCountryCode || 'ID').toUpperCase();

  if (proxy === cookie) return 'safe'; // sama persis
  const seaCountries = ['ID', 'SG', 'MY', 'TH', 'PH', 'VN', 'BN'];
  if (seaCountries.includes(proxy) && seaCountries.includes(cookie)) return 'low'; // tetangga
  return 'high'; // beda region
}

module.exports = { detectProxyCountry, guessCookieOriginCountry, isCountryMismatch, getRiskLevel };
