// Proxy Latency Monitor: cek latency tiap proxy di pool tiap 1 menit.
// Simpan hasil di memory cache (tidak perlu DB karena berubah terus).
// launchHumanizedContext akan pilih proxy dengan latency terendah.

const { checkProxyHealth } = require('./antiDetectionService');

// Cache: proxyUrl → { latency, ok, checkedAt }
const latencyCache = new Map();
let timer = null;
let running = false;

const TICK_MS = 60000; // 1 menit
const MAX_PARALLEL = 10;

function getLatency(proxyUrl) {
  const cached = latencyCache.get(proxyUrl);
  if (!cached) return null;
  // Expired setelah 2 menit
  if (Date.now() - cached.checkedAt > 120000) return null;
  return cached;
}

function getAllLatencies() {
  const result = {};
  for (const [url, data] of latencyCache) {
    result[url] = data;
  }
  return result;
}

// Pilih proxy terbaik dari pool (latency terendah, alive)
function pickBestProxy(pool, deadProxies = []) {
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const deadSet = new Set(deadProxies);
  const alive = pool.filter(p => !deadSet.has(p));
  if (alive.length === 0) return null;

  // Sort by latency (lowest first), unknown latency = 9999
  const sorted = [...alive].sort((a, b) => {
    const la = getLatency(a);
    const lb = getLatency(b);
    const latA = (la?.ok && la?.latency) ? la.latency : 9999;
    const latB = (lb?.ok && lb?.latency) ? lb.latency : 9999;
    return latA - latB;
  });

  // Pilih dari top 3 terbaik secara random (supaya tidak selalu 1 proxy)
  const top = sorted.slice(0, Math.min(3, sorted.length));
  return top[Math.floor(Math.random() * top.length)];
}

// Batch check latency
async function batchCheck(proxies) {
  let idx = 0;
  async function worker() {
    while (idx < proxies.length) {
      const i = idx++;
      const proxy = proxies[i];
      const result = await checkProxyHealth(proxy, 5000);
      latencyCache.set(proxy, {
        ok: result.ok,
        latency: result.latency || null,
        status: result.status,
        reason: result.reason,
        checkedAt: Date.now(),
      });
    }
  }
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, proxies.length) }, () => worker());
  await Promise.all(workers);
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const db = require('../db/database');
    // Ambil semua akun aktif yang punya proxy
    const accounts = db.prepare(`
      SELECT id, proxy, proxy_pool, proxy_source, dead_proxies FROM fb_accounts
      WHERE status IN ('active', 'proxy_dead')
        AND ((proxy IS NOT NULL AND proxy != '') OR (proxy_pool IS NOT NULL AND proxy_pool != '[]'))
    `).all();

    const allProxies = new Set();
    for (const acc of accounts) {
      if (acc.proxy) allProxies.add(acc.proxy);
      try {
        const pool = JSON.parse(acc.proxy_pool || '[]');
        if (Array.isArray(pool)) pool.forEach(p => { if (p) allProxies.add(p); });
      } catch {}
    }

    if (allProxies.size === 0) { running = false; return; }

    await batchCheck([...allProxies]);

    // Setelah cek latency, update proxy utama tiap akun ke yang terbaik
    for (const acc of accounts) {
      let pool = [];
      try { pool = JSON.parse(acc.proxy_pool || '[]'); } catch {}
      if (pool.length === 0) continue;

      let deadProxies = [];
      try { deadProxies = JSON.parse(acc.dead_proxies || '[]'); } catch {}

      const best = pickBestProxy(pool, deadProxies);
      if (best && best !== acc.proxy) {
        db.prepare('UPDATE fb_accounts SET proxy = ? WHERE id = ?').run(best, acc.id);
      }
    }
  } catch (e) {
    console.error('[proxy-latency] tick error:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  console.log('[proxy-latency] enabled, cek tiap 1 menit');
  setTimeout(() => {
    tick().catch(() => {});
    timer = setInterval(() => tick().catch(() => {}), TICK_MS);
  }, 30000); // mulai 30 detik setelah boot
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick, getLatency, getAllLatencies, pickBestProxy };
