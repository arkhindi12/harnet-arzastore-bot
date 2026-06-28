// Profile Setup Scheduler: jalankan 1 perubahan profil per hari per akun.
// Cek tiap 30 menit apakah ada task yang due hari ini.

const db = require('../db/database');
const { updateProfilePhoto, updateBio, updateLocation, updateWorkplace, updateSchool } = require('./profileSetupService');
const { logSchedulerEvent } = require('./schedulerLog');

let timer = null;
let running = false;
const TICK_MS = 1800000; // 30 menit

function todayStr() { return new Date().toISOString().slice(0, 10); }

async function tick() {
  if (running) return;
  running = true;

  try {
    const today = todayStr();
    // Ambil task yang scheduled hari ini dan belum dieksekusi
    const tasks = db.prepare(`
      SELECT q.*, a.name as account_name
      FROM profile_setup_queue q
      JOIN fb_accounts a ON a.id = q.account_id
      WHERE q.status = 'pending' AND q.scheduled_date <= ? AND a.status = 'active'
      ORDER BY q.scheduled_date ASC, q.created_at ASC
      LIMIT 5
    `).all(today);

    for (const task of tasks) {
      const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(task.account_id);
      if (!account || account.status !== 'active') {
        db.prepare("UPDATE profile_setup_queue SET status = 'skipped', result = 'Akun tidak aktif' WHERE id = ?").run(task.id);
        continue;
      }

      let result;
      try {
        switch (task.field) {
          case 'photo': result = await updateProfilePhoto(account, task.value); break;
          case 'bio': result = await updateBio(account, task.value); break;
          case 'city': result = await updateLocation(account, task.value); break;
          case 'workplace': result = await updateWorkplace(account, task.value); break;
          case 'school': result = await updateSchool(account, task.value); break;
          default: result = { success: false, error: 'Field tidak dikenal' };
        }
      } catch (e) {
        result = { success: false, error: e.message };
      }

      db.prepare("UPDATE profile_setup_queue SET status = ?, executed_at = CURRENT_TIMESTAMP, result = ? WHERE id = ?")
        .run(result.success ? 'done' : 'failed', JSON.stringify(result), task.id);

      logSchedulerEvent({
        type: 'profile_setup',
        userId: task.user_id,
        targetId: task.account_id,
        targetName: `${task.account_name} → ${task.field}`,
        status: result.success ? 'success' : 'failed',
        message: result.success ? `Profil ${task.field} berhasil diupdate` : (result.error || 'Gagal'),
      });
    }
  } catch (e) {
    console.error('[profile-setup-scheduler] tick error:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  console.log('[profile-setup-scheduler] enabled, cek tiap 30 menit');
  setTimeout(() => {
    tick().catch(() => {});
    timer = setInterval(() => tick().catch(() => {}), TICK_MS);
  }, 120000); // mulai 2 menit setelah boot
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
