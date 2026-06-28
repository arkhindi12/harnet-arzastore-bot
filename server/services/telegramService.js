const axios = require('axios');
const db = require('../db/database');

async function sendTelegram(userId, message) {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings || !settings.telegram_bot_token || !settings.telegram_chat_id) return;

  try {
    await axios.post(`https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`, {
      chat_id: settings.telegram_chat_id,
      text: message,
      parse_mode: 'HTML',
    }, { timeout: 10000 });
  } catch (e) {
    console.error('[Telegram] Gagal kirim notifikasi:', e.message);
  }
}

async function notifyCampaignDone(userId, campaignName, success, failed) {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings?.notify_campaign_complete) return;
  await sendTelegram(userId,
    `✅ <b>Kampanye Selesai</b>\n\n📢 <b>${campaignName}</b>\n✓ Berhasil: ${success}\n✗ Gagal: ${failed}\n⏰ ${new Date().toLocaleString('id-ID')}`
  );
}

async function notifyCheckpoint(userId, accountName) {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings?.notify_checkpoint) return;
  await sendTelegram(userId,
    `⚠️ <b>Akun Checkpoint!</b>\n\n👤 Akun: <b>${accountName}</b>\nSegera login manual dan update cookies.\n⏰ ${new Date().toLocaleString('id-ID')}`
  );
}

async function notifyTaskError(userId, taskName, errorMsg) {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings?.notify_task_error) return;
  await sendTelegram(userId,
    `❌ <b>Task Error</b>\n\n📋 Task: <b>${taskName}</b>\n🔴 Error: ${errorMsg}\n⏰ ${new Date().toLocaleString('id-ID')}`
  );
}

async function notifyKeywordHit(userId, keyword, groupName, commentSent) {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings?.notify_campaign_complete) return;
  await sendTelegram(userId,
    `🎯 <b>Keyword Terdeteksi!</b>\n\n🔍 Keyword: <b>"${keyword}"</b>\n👥 Grup: ${groupName}\n💬 Komentar dikirim: ${commentSent}\n⏰ ${new Date().toLocaleString('id-ID')}`
  );
}

async function testTelegram(userId) {
  await sendTelegram(userId,
    `🔔 <b>Test Notifikasi ArzaBot</b>\n\nKoneksi Telegram berhasil! Anda akan menerima notifikasi di sini.\n⏰ ${new Date().toLocaleString('id-ID')}`
  );
}

async function notifyAccountDead(userId, accountName) {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings?.notify_task_error) return;
  await sendTelegram(userId,
    `🚨 <b>Akun Bermasalah!</b>\n\n👤 Akun: <b>${accountName}</b>\nTerdeteksi gagal berkali-kali — kemungkinan dikunci atau sesi habis.\n⚠️ Segera periksa dan perbarui cookies akun ini.\n⏰ ${new Date().toLocaleString('id-ID')}`
  );
}

async function notifyWeeklyReport(userId, stats) {
  await sendTelegram(userId,
    `📊 <b>Laporan Mingguan ArzaBot</b>\n\n` +
    `📅 Periode: ${stats.weekLabel}\n\n` +
    `📢 <b>Kampanye</b>\n` +
    `  • Total dijalankan: ${stats.campaigns}\n` +
    `  • Komentar berhasil: ${stats.success}\n` +
    `  • Komentar gagal: ${stats.failed}\n` +
    `  • Tingkat keberhasilan: ${stats.rate}%\n\n` +
    `👥 <b>Akun</b>\n` +
    `  • Aktif: ${stats.activeAccounts}\n` +
    `  • Bermasalah: ${stats.deadAccounts}\n\n` +
    `Semangat terus minggu ini! 🚀\n⏰ ${new Date().toLocaleString('id-ID')}`
  );
}

module.exports = { sendTelegram, notifyCampaignDone, notifyCheckpoint, notifyTaskError, notifyKeywordHit, testTelegram, notifyAccountDead, notifyWeeklyReport };
