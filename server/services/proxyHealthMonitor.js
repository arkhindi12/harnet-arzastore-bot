// Proxy Health Monitor v2:
// - Cek semua proxy (utama + pool) per akun
// - Tandai proxy yang dead di field `dead_proxies` (JSON array)
// - Akun hanya di-pause kalau SEMUA proxy mati
// - Batch parallel check (max 10 concurrent) untuk efisiensi
// - Hanya cek akun yang status active/proxy_dead (skip yang lain)

const db = require('../db/database');
const { checkProxyHealth } = require('./antiDetectionService');
const { logSchedulerEvent } = require('./schedulerLog');

let timer = null;
let running = false;
const TICK_MS = 600000; // 10 menit
const MAX_PARALLEL_CHECKS = 10; // max 10 proxy dicek bersamaan

// Batch check proxies dengan concurrency limit
async function batchCheckProxies(proxies, maxConcurrent = MAX_PARALLEL_CHECKS) {
  const results = new Map(); // proxy → { ok, reason, latency }
  let idx = 0;

  async function worker() {
    while (idx < proxies.length) {
      const i = idx++;
      const proxy = proxies[i];
      const result = await checkProxyHealth(proxy, 6000);
      results.set(proxy, result);
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, proxies.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function tick() {
  if (running) return;
  running = true;

  try {
    const accounts = db.prepare(`
      SELECT id, user_id, name, proxy, proxy_pool, dead_proxies, status
      FROM fb_accounts
      WHERE status IN ('active', 'proxy_dead')
        AND ((proxy IS NOT NULL AND proxy != '') OR (proxy_pool IS NOT NULL AND proxy_pool != '[]'))
    `).all();

    // Kumpulkan semua unique proxy dari semua akun
    const proxyToAccounts = new Map(); // proxy → [accId, ...]
    const accountProxies = new Map(); // accId → [proxy, ...]

    for (const acc of accounts) {
      const proxies = [];
      if (acc.proxy) proxies.push(acc.proxy);
      try {
        const pool = JSON.parse(acc.proxy_pool || '[]');
        if (Array.isArray(pool)) proxies.push(...pool.filter(p => p && typeof p === 'string'));
      } catch {}

      const unique = [...new Set(proxies)];
      accountProxies.set(acc.id, unique);

      for (const p of unique) {
        if (!proxyToAccounts.has(p)) proxyToAccounts.set(p, []);
        proxyToAccounts.get(p).push(acc.id);
      }
    }

    // Batch check semua unique proxy (deduplicated across accounts)
    const allUniqueProxies = [...proxyToAccounts.keys()];
    if (allUniqueProxies.length === 0) { running = false; return; }

    const results = await batchCheckProxies(allUniqueProxies);

    // Update per akun
    for (const acc of accounts) {
      const proxies = accountProxies.get(acc.id) || [];
      if (proxies.length === 0) continue;

      const deadList = proxies.filter(p => !results.get(p)?.ok);
      const aliveList = proxies.filter(p => results.get(p)?.ok);

      // Handle proxy mati berdasarkan source
      if (deadList.length > 0) {
        const currentAcc = db.prepare('SELECT proxy, proxy_pool, proxy_source FROM fb_accounts WHERE id = ?').get(acc.id);
        let pool = [];
        try { pool = JSON.parse(currentAcc?.proxy_pool || '[]'); } catch {}

        if (currentAcc?.proxy_source === 'proxifly') {
          // Proxifly: hapus yang mati (akan di-refresh otomatis tiap 5 menit)
          const newPool = pool.filter(p => !deadList.includes(p));
          const removed = pool.length - newPool.length;
          if (removed > 0) {
            db.prepare('UPDATE fb_accounts SET proxy_pool = ?, dead_proxies = ? WHERE id = ?')
              .run(JSON.stringify(newPool), JSON.stringify(deadList), acc.id);
            if (deadList.includes(currentAcc?.proxy) && aliveList.length > 0) {
              db.prepare('UPDATE fb_accounts SET proxy = ? WHERE id = ?').run(aliveList[0], acc.id);
            }
            logSchedulerEvent({
              type: 'proxy_health_check', userId: acc.user_id, targetId: acc.id, targetName: acc.name,
              status: 'warning',
              message: `${removed} proxy gratis mati dihapus. Sisa ${newPool.length}. Pool akan di-refresh dari Proxifly.`,
            });
          }
        } else {
          // Manual/dedicated: JANGAN hapus, cuma tandai dead (skip saat rotasi)
          // Proxy dedicated bisa down sementara lalu hidup lagi
          const prevDead = (() => { try { return JSON.parse(acc.dead_proxies || '[]'); } catch { return []; } })();
          const deadChanged = JSON.stringify(deadList.sort()) !== JSON.stringify(prevDead.sort());
          if (deadChanged) {
            db.prepare('UPDATE fb_accounts SET dead_proxies = ? WHERE id = ?').run(JSON.stringify(deadList), acc.id);
            // Kalau proxy utama mati, ganti ke yang hidup
            if (deadList.includes(currentAcc?.proxy) && aliveList.length > 0) {
              db.prepare('UPDATE fb_accounts SET proxy = ? WHERE id = ?').run(aliveList[0], acc.id);
            }
            logSchedulerEvent({
              type: 'proxy_health_check', userId: acc.user_id, targetId: acc.id, targetName: acc.name,
              status: 'warning',
              message: `${deadList.length}/${proxies.length} proxy down (di-skip, tidak dihapus). ${aliveList.length} masih aktif. Proxy dedicated akan dicek lagi nanti.`,
            });
          }
        }
      } else {
        // Semua hidup — clear dead_proxies
        const prevDead = (() => { try { return JSON.parse(acc.dead_proxies || '[]'); } catch { return []; } })();
        if (prevDead.length > 0) {
          db.prepare("UPDATE fb_accounts SET dead_proxies = '[]' WHERE id = ?").run(acc.id);
        }
      }

      const allDead = aliveList.length === 0 && deadList.length > 0;

      if (allDead && acc.status === 'active') {
        db.prepare("UPDATE fb_accounts SET status = 'proxy_dead' WHERE id = ?").run(acc.id);
        logSchedulerEvent({
          type: 'proxy_health_check', userId: acc.user_id, targetId: acc.id, targetName: acc.name,
          status: 'failed',
          message: `Semua proxy mati dan dihapus. Akun di-pause.${acc.proxy_source === 'proxifly' ? ' Menunggu refresh dari Proxifly (tiap 5 menit).' : ' Tambah proxy baru untuk melanjutkan.'}`,
        });
      } else if (!allDead && acc.status === 'proxy_dead') {
        db.prepare("UPDATE fb_accounts SET status = 'active' WHERE id = ?").run(acc.id);
        logSchedulerEvent({
          type: 'proxy_health_check', userId: acc.user_id, targetId: acc.id, targetName: acc.name,
          status: 'success',
          message: `${aliveList.length} proxy aktif. Akun di-restore.`,
        });
      }
    }
  } catch (e) {
    console.error('[proxy-monitor] tick error:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  console.log('[proxy-monitor] enabled, cek tiap 10 menit (max 10 parallel)');
  setTimeout(() => {
    tick().catch(e => console.error('[proxy-monitor] first tick:', e.message));
    timer = setInterval(() => tick().catch(e => console.error('[proxy-monitor] tick:', e.message)), TICK_MS);
  }, 60000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
