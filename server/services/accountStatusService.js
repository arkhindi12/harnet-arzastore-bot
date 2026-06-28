// Centralized account status management.
// Semua perubahan status akun harus lewat sini supaya notifikasi otomatis terpanggil.

const db = require('../db/database');
const { rotateCookies } = require('./cookieRotationService');
const { sendTelegram } = require('./telegramService');

// Cooldown notifikasi per akun (jangan spam notif yang sama)
const notifCooldown = new Map(); // key: `${userId}:${accountId}:${status}` → timestamp
const COOLDOWN_MS = 30 * 60 * 1000; // 30 menit

// Periodic cleanup supaya tidak leak: hapus entry yang sudah lewat cooldown
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of notifCooldown.entries()) {
    if (now - v > COOLDOWN_MS * 2) notifCooldown.delete(k);
  }
}, 30 * 60 * 1000).unref();

function shouldNotify(userId, accountId, status) {
  const key = `${userId}:${accountId}:${status}`;
  const last = notifCooldown.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) return false;
  notifCooldown.set(key, Date.now());
  return true;
}

const STATUS_MESSAGES = {
  expired: (name) => `🔴 <b>Cookies Akun Expired!</b>\n\n👤 Akun: <b>${name}</b>\n\nCookies akun ini sudah tidak valid. Semua fitur otomasi untuk akun ini dihentikan sementara.\n\n💡 <b>Cara memperbaiki:</b>\n1. Login ke Facebook di browser\n2. Ambil cookies baru (pakai ekstensi J2Team/EditThisCookie)\n3. Update cookies di halaman Akun\n\n⏰ ${new Date().toLocaleString('id-ID')}`,
  checkpoint: (name) => `⚠️ <b>Akun Kena Checkpoint!</b>\n\n👤 Akun: <b>${name}</b>\n\nFacebook meminta verifikasi identitas untuk akun ini.\n\n💡 <b>Cara memperbaiki:</b>\n1. Login ke Facebook di browser\n2. Selesaikan verifikasi yang diminta\n3. Ambil cookies baru dan update di halaman Akun\n\n⏰ ${new Date().toLocaleString('id-ID')}`,
  locked: (name) => `🔒 <b>Akun Terkunci!</b>\n\n👤 Akun: <b>${name}</b>\n\nFacebook mengunci atau menonaktifkan akun ini.\n\n💡 Coba login manual di browser untuk melihat status akun. Jika akun dinonaktifkan permanen, hapus dari daftar dan ganti dengan akun lain.\n\n⏰ ${new Date().toLocaleString('id-ID')}`,
  invalid: (name) => `❌ <b>Akun Tidak Valid!</b>\n\n👤 Akun: <b>${name}</b>\n\nCookies akun tidak valid atau sudah kadaluarsa.\n\n💡 Update cookies akun ini untuk melanjutkan otomasi.\n\n⏰ ${new Date().toLocaleString('id-ID')}`,
};

/**
 * Update status akun + kirim notifikasi Telegram kalau status berubah ke bermasalah.
 * @param {string} accountId
 * @param {string} newStatus - 'active'|'expired'|'checkpoint'|'locked'|'invalid'|'proxy_dead'
 * @param {object} opts - { skipNotif: bool }
 */
async function setAccountStatus(accountId, newStatus, opts = {}) {
  const account = db.prepare('SELECT id, name, status, user_id FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return;

  const oldStatus = account.status;

  // Update DB
  db.prepare('UPDATE fb_accounts SET status = ? WHERE id = ?').run(newStatus, accountId);

  // Auto-rotate cookies jika expired dan ada pool
  if (newStatus === 'expired') {
    rotateCookies(accountId).then(r => {
      if (r.success) {
        console.log(`[cookie-rotation] akun ${accountId} auto-rotated: ${r.message}`);
      }
    }).catch(() => {});
  }

  // Kirim notifikasi kalau status berubah ke bermasalah
  if (!opts.skipNotif && oldStatus !== newStatus) {
    const problemStatuses = ['expired', 'checkpoint', 'locked', 'invalid'];
    if (problemStatuses.includes(newStatus) && shouldNotify(account.user_id, accountId, newStatus)) {
      const msgFn = STATUS_MESSAGES[newStatus];
      if (msgFn) {
        sendTelegram(account.user_id, msgFn(account.name)).catch(() => {});
      }
    }
  }

  return { oldStatus, newStatus, changed: oldStatus !== newStatus };
}

/**
 * Cek semua akun aktif milik user, update status kalau ada yang bermasalah.
 * Dipanggil oleh scheduler secara berkala.
 */
async function checkAllAccountsForUser(userId) {
  const accounts = db.prepare("SELECT * FROM fb_accounts WHERE user_id = ? AND status = 'active'").all(userId);
  const results = [];

  for (const acc of accounts) {
    try {
      const { testAccountLive } = require('./accountTester');
      const r = await testAccountLive(acc);

      if (r.status !== 'active') {
        await setAccountStatus(acc.id, r.status === 'expired' ? 'expired' : r.status === 'checkpoint' ? 'checkpoint' : r.status === 'locked' ? 'locked' : 'invalid');
        results.push({ name: acc.name, status: r.status, message: r.message });
      }
    } catch (e) {
      // Skip kalau browser busy
    }
  }

  return results;
}

/**
 * Kirim notifikasi ringkasan akun bermasalah ke semua user.
 * Dipanggil sekali sehari.
 */
async function sendDailyAccountHealthReport() {
  const users = db.prepare("SELECT DISTINCT user_id FROM fb_accounts").all();

  for (const { user_id } of users) {
    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(user_id);
    if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) continue;

    const accounts = db.prepare('SELECT name, status FROM fb_accounts WHERE user_id = ?').all(user_id);
    if (!accounts.length) continue;

    const active = accounts.filter(a => a.status === 'active').length;
    const expired = accounts.filter(a => a.status === 'expired').length;
    const checkpoint = accounts.filter(a => a.status === 'checkpoint').length;
    const locked = accounts.filter(a => a.status === 'locked').length;
    const problems = expired + checkpoint + locked;

    if (problems === 0) continue; // Tidak perlu laporan kalau semua OK

    const lines = [
      `📊 <b>Laporan Harian Akun</b>`,
      ``,
      `✅ Aktif: ${active}`,
      expired > 0 ? `🔴 Cookies Expired: ${expired}` : null,
      checkpoint > 0 ? `⚠️ Checkpoint: ${checkpoint}` : null,
      locked > 0 ? `🔒 Terkunci: ${locked}` : null,
      ``,
      problems > 0 ? `⚡ Ada <b>${problems} akun bermasalah</b> yang perlu diperbarui cookies-nya.` : null,
      ``,
      `⏰ ${new Date().toLocaleString('id-ID')}`,
    ].filter(Boolean).join('\n');

    sendTelegram(user_id, lines).catch(() => {});
  }
}

module.exports = { setAccountStatus, checkAllAccountsForUser, sendDailyAccountHealthReport };
