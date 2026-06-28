// Proxy Pool Auto-Refresh: sync proxy pool dari Proxifly tiap N menit
// untuk akun yang proxy_source = 'proxifly'.
// Proxifly update list tiap beberapa menit, scheduler ini ikut sync.

const axios = require('axios');
const db = require('../db/database');
const { logSchedulerEvent } = require('./schedulerLog');

let timer = null;
let running = false;
const TICK_MS = 600000; // 10 menit — refresh proxy pool dari Proxifly tiap 10 menit

let cachedProxies = null;
let cacheTime = 0;
const CACHE_TTL = 55000; // 55 detik cache (sedikit di bawah tick 60 detik supaya selalu fresh)

async function fetchProxiflyAll() {
  if (cachedProxies && Date.now() - cacheTime < CACHE_TTL) return cachedProxies;
  try {
    const res = await axios.get('https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.json', { timeout: 15000 });
    cachedProxies = Array.isArray(res.data) ? res.data : [];
    cacheTime = Date.now();
    return cachedProxies;
  } catch {
    return cachedProxies || [];
  }
}

function filterByCountry(proxies, country) {
  return proxies.filter(p => {
    const c = (p.geolocation?.country || p.country || '').toLowerCase();
    return c === country.toLowerCase();
  });
}

function formatProxy(p) {
  if (p.proxy) return p.proxy;
  const proto = p.protocol || p.protocols?.[0] || 'http';
  return `${proto}://${p.ip}:${p.port}`;
}

async function tick() {
  if (running) return;
  running = true;

  try {
    // Ambil akun yang pakai proxifly sebagai source
    const accounts = db.prepare(`
      SELECT id, user_id, name, proxy_country
      FROM fb_accounts
      WHERE proxy_source = 'proxifly' AND proxy_country IS NOT NULL AND proxy_country != ''
    `).all();

    if (accounts.length === 0) { running = false; return; }

    // Fetch semua proxy dari Proxifly (1x, di-cache)
    const allProxies = await fetchProxiflyAll();
    if (allProxies.length === 0) { running = false; return; }

    // Group akun by country supaya tidak filter berulang
    const countryAccounts = new Map();
    for (const acc of accounts) {
      const country = acc.proxy_country;
      if (!countryAccounts.has(country)) countryAccounts.set(country, []);
      countryAccounts.get(country).push(acc);
    }

    for (const [country, accs] of countryAccounts) {
      const filtered = filterByCountry(allProxies, country);
      if (filtered.length === 0) continue;

      const urls = filtered.slice(0, 20).map(formatProxy).filter(Boolean);
      if (urls.length === 0) continue;

      const poolJson = JSON.stringify(urls);

      // Pilih proxy utama berdasarkan latency terbaik
      let mainProxy = urls[0];
      try {
        const { pickBestProxy } = require('./proxyLatencyMonitor');
        const best = pickBestProxy(urls, []);
        if (best) mainProxy = best;
      } catch {}

      for (const acc of accs) {
        // Update proxy pool + proxy utama (latency terbaik)
        db.prepare('UPDATE fb_accounts SET proxy = ?, proxy_pool = ?, dead_proxies = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(mainProxy, poolJson, '[]', acc.id);
      }

      // Log sekali per country
      logSchedulerEvent({
        type: 'proxy_pool_refresh',
        userId: accs[0].user_id,
        targetName: `${country} (${accs.length} akun)`,
        status: 'success',
        message: `Pool di-refresh: ${urls.length} proxy baru dari Proxifly untuk ${accs.length} akun.`,
      });
    }
  } catch (e) {
    console.error('[proxy-refresh] tick error:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  console.log('[proxy-refresh] enabled, sync Proxifly tiap 10 menit');
  setTimeout(() => {
    tick().catch(e => console.error('[proxy-refresh] first tick:', e.message));
    timer = setInterval(() => tick().catch(e => console.error('[proxy-refresh] tick:', e.message)), TICK_MS);
  }, 45000); // mulai 45 detik setelah boot
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
