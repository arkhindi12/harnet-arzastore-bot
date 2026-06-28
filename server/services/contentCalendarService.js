/**
 * contentCalendarService.js
 * Eksekusi posting terjadwal dari content_calendar.
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { postToGroup, postToProfile } = require('./postService');

async function runCalendarItem(item) {
  const accountIds = JSON.parse(item.account_ids || '[]');
  const targetGroups = JSON.parse(item.target_groups || '[]');
  const results = [];

  for (const accountId of accountIds) {
    const account = db.prepare("SELECT * FROM fb_accounts WHERE id=?").get(accountId);
    if (!account) { results.push({ accountId, status: 'error', message: 'Akun tidak ditemukan' }); continue; }
    if (account.status !== 'active') { results.push({ accountId, status: 'skip', message: `Akun ${account.status}` }); continue; }

    const targets = targetGroups.length > 0 ? targetGroups : [null];
    for (const target of targets) {
      try {
        let r;
        if (item.post_type === 'profile') {
          r = await postToProfile(account, item.content, item.media_url);
        } else {
          r = await postToGroup(account, target, item.content, item.media_url);
        }
        const logId = uuidv4();
        db.prepare("INSERT INTO content_calendar_logs (id,calendar_id,user_id,account_id,target,status,message) VALUES (?,?,?,?,?,?,?)")
          .run(logId, item.id, item.user_id, accountId, target || 'profile', 'success', r?.message || 'Posted');
        results.push({ accountId, target, status: 'success' });
      } catch(e) {
        const logId = uuidv4();
        db.prepare("INSERT INTO content_calendar_logs (id,calendar_id,user_id,account_id,target,status,message) VALUES (?,?,?,?,?,?,?)")
          .run(logId, item.id, item.user_id, accountId, target || 'profile', 'error', e.message);
        results.push({ accountId, target, status: 'error', message: e.message });
      }
    }
  }

  // Update last_run_at + run_count + next scheduled_at kalau repeat
  db.prepare("UPDATE content_calendar SET last_run_at=CURRENT_TIMESTAMP, run_count=run_count+1, error_msg=NULL WHERE id=?").run(item.id);

  if (item.repeat_type !== 'none' && item.repeat_interval > 0) {
    const next = new Date(item.scheduled_at);
    if (item.repeat_type === 'hourly') next.setHours(next.getHours() + item.repeat_interval);
    else if (item.repeat_type === 'daily') next.setDate(next.getDate() + item.repeat_interval);
    else if (item.repeat_type === 'weekly') next.setDate(next.getDate() + item.repeat_interval * 7);
    db.prepare("UPDATE content_calendar SET scheduled_at=?, status='scheduled' WHERE id=?").run(next.toISOString(), item.id);
  } else {
    db.prepare("UPDATE content_calendar SET status='done' WHERE id=?").run(item.id);
  }

  return results;
}

/**
 * Cek semua item terjadwal yang sudah lewat waktu → jalankan.
 * Dipanggil tiap menit dari index.js.
 */
async function tickCalendarScheduler() {
  const now = new Date().toISOString();
  const due = db.prepare("SELECT * FROM content_calendar WHERE status='scheduled' AND scheduled_at <= ?").all(now);
  for (const item of due) {
    db.prepare("UPDATE content_calendar SET status='running' WHERE id=?").run(item.id);
    try {
      await runCalendarItem(item);
    } catch(e) {
      db.prepare("UPDATE content_calendar SET status='error', error_msg=? WHERE id=?").run(e.message, item.id);
    }
  }
}

module.exports = { runCalendarItem, tickCalendarScheduler };
