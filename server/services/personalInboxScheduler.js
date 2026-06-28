// Scheduler: poll personal inbox bots yang aktif.
// Cek tiap 60 detik apakah ada bot personal yang due untuk poll.

const db = require('../db/database');
const { pollPersonalInbox } = require('./personalInboxService');
const { logSchedulerEvent } = require('./schedulerLog');
const { getBool } = require('./systemConfig');

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  if (!getBool('autojoin_enabled', null, true)) return; // reuse general toggle
  running = true;

  try {
    // Ambil bot personal yang aktif dan due untuk poll
    const bots = db.prepare(`
      SELECT pb.*, fa.name as account_name FROM page_bots pb
      LEFT JOIN fb_accounts fa ON fa.id = pb.account_id
      WHERE pb.type = 'personal' AND pb.is_active = 1
        AND (pb.last_poll IS NULL OR pb.last_poll <= datetime('now', '-' || pb.poll_interval_sec || ' seconds'))
    `).all();

    for (const bot of bots) {
      try {
        const t0 = Date.now();
        const result = await pollPersonalInbox(bot);

        db.prepare('UPDATE page_bots SET last_poll = CURRENT_TIMESTAMP WHERE id = ?').run(bot.id);

        if (result.processed > 0) {
          logSchedulerEvent({
            type: 'personal_inbox_poll',
            userId: bot.user_id,
            targetId: bot.id,
            targetName: bot.page_name || bot.account_name || 'Personal Bot',
            status: 'success',
            message: `${result.processed} pesan dibalas dari ${result.threads} thread`,
            durationMs: Date.now() - t0,
          });
        }
      } catch (e) {
        console.error(`[personal-inbox-scheduler] bot ${bot.id} error:`, e.message);
        db.prepare('UPDATE page_bots SET last_poll = CURRENT_TIMESTAMP WHERE id = ?').run(bot.id);
      }
    }
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  console.log('[personal-inbox-scheduler] enabled, cek tiap 60 detik');
  setTimeout(() => {
    tick().catch(e => console.error('[personal-inbox-scheduler] first tick:', e.message));
    timer = setInterval(() => tick().catch(e => console.error('[personal-inbox-scheduler] tick:', e.message)), 60000);
  }, 45000); // start 45 detik setelah boot
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
