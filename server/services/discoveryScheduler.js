// Auto-resync discovery untuk semua akun aktif.
// Pendekatan: setInterval dengan jeda antar akun supaya tidak nyalain banyak browser sekaligus.
// Smart scheduling: hanya jalan saat browser idle (tidak ada auto-join/campaign aktif)
// dan di luar jam sibuk (default: 01:00-06:00 WIB).

const db = require('../db/database');
const { discoverGroups, discoverFeedPostIds } = require('./browserDiscovery');
const { logSchedulerEvent } = require('./schedulerLog');
const { getBool, getInt } = require('./systemConfig');

function isEnabled() { return getBool('discovery_auto_sync', 'DISCOVERY_AUTO_SYNC', true); }
function getResyncHours() { return getInt('discovery_resync_hours', 'DISCOVERY_RESYNC_HOURS', 6); }
const ACCOUNT_GAP_MS = 30000; // 30 detik antar akun supaya browser tidak overlap

let running = false;
let timer = null;

function shouldResync(accountId, type, hours) {
  const resyncHours = hours || getResyncHours();
  const row = db.prepare(
    `SELECT MAX(last_seen) as latest FROM ${type === 'groups' ? 'account_groups' : 'account_feed_posts'} WHERE account_id = ?`
  ).get(accountId);
  if (!row?.latest) return true;
  const ageMs = Date.now() - new Date(row.latest).getTime();
  return ageMs > hours * 3600 * 1000;
}

// Cek apakah sekarang adalah idle window (tidak ada auto-join aktif + jam sepi)
function isIdleWindow() {
  const hour = new Date().getHours(); // WIB
  // Jam 01:00-06:00 WIB = jam sepi, aman untuk discovery
  const isQuietHour = hour >= 1 && hour <= 6;

  // Cek apakah ada auto-join job yang sedang aktif (next_run dalam 10 menit ke depan)
  const activeJobs = db.prepare(`
    SELECT COUNT(*) as cnt FROM auto_join_jobs
    WHERE status = 'running'
    AND (next_run IS NULL OR next_run <= datetime('now', '+10 minutes'))
  `).get().cnt;

  // Cek apakah ada campaign yang running
  const activeCampaigns = db.prepare(`
    SELECT COUNT(*) as cnt FROM campaigns WHERE status = 'running'
  `).get().cnt;

  return isQuietHour && activeJobs === 0 && activeCampaigns === 0;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tick() {
  if (!isEnabled()) return;
  if (running) return;

  // Hanya jalan di idle window
  if (!isIdleWindow()) return;

  running = true;
  try {
    const accounts = db.prepare("SELECT id, name FROM fb_accounts WHERE status = 'active'").all();
    let syncedThisTick = 0;
    const resyncHours = getResyncHours();

    for (const acc of accounts) {
      // Re-check idle window setiap akun (bisa berubah)
      if (!isIdleWindow()) {
        console.log('[discovery-scheduler] keluar idle window, stop tick');
        break;
      }

      const needGroups = shouldResync(acc.id, 'groups', resyncHours);
      const needFeed = shouldResync(acc.id, 'feed', resyncHours);
      if (!needGroups && !needFeed) continue;

      try {
        const acct = db.prepare('SELECT user_id FROM fb_accounts WHERE id = ?').get(acc.id);
        const userId = acct?.user_id || null;

        if (needGroups) {
          console.log(`[discovery-scheduler] sync groups: ${acc.name}`);
          const t0 = Date.now();
          const r = await discoverGroups(acc.id);
          logSchedulerEvent({
            type: 'discovery_groups_auto',
            userId,
            targetId: acc.id,
            targetName: acc.name,
            status: r.success ? 'success' : 'failed',
            message: r.success ? `${r.count || 0} grup ditemukan` : (r.error || 'discoverGroups gagal'),
            durationMs: Date.now() - t0,
          });
          await sleep(3000);
        }
        if (needFeed) {
          console.log(`[discovery-scheduler] sync feed: ${acc.name}`);
          const t0 = Date.now();
          const r = await discoverFeedPostIds(acc.id, 30);
          logSchedulerEvent({
            type: 'discovery_feed_auto',
            userId,
            targetId: acc.id,
            targetName: acc.name,
            status: r.success ? 'success' : 'failed',
            message: r.success ? `${r.count || 0} post ID ditemukan` : (r.error || 'discoverFeedPostIds gagal'),
            durationMs: Date.now() - t0,
          });
        }
        syncedThisTick++;
        // Jeda antar akun supaya browser dimatikan dulu sebelum buka yang baru
        await sleep(ACCOUNT_GAP_MS);
      } catch (e) {
        console.error(`[discovery-scheduler] error for ${acc.name}:`, e.message);
        logSchedulerEvent({
          type: 'discovery_auto_tick',
          targetId: acc.id,
          targetName: acc.name,
          status: 'failed',
          message: e.message,
        });
      }

      // Hard cap supaya satu tick tidak kelamaan
      if (syncedThisTick >= 5) break;
    }
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  const resyncHours = getResyncHours();
  const TICK_MS = 30 * 60 * 1000; // cek tiap 30 menit, tapi hanya jalan di idle window
  console.log(`[discovery-scheduler] enabled, resync setiap ${resyncHours} jam, idle window 01:00-06:00 WIB`);
  // Tunggu 2 menit setelah server up
  setTimeout(() => {
    tick().catch(e => console.error('[discovery-scheduler] first tick error:', e.message));
    timer = setInterval(() => {
      tick().catch(e => console.error('[discovery-scheduler] tick error:', e.message));
    }, TICK_MS);
  }, 120000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
