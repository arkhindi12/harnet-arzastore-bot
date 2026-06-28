/**
 * cookieRotationService.js
 * Manage cookie pool per akun + auto-rotate saat cookies expired.
 */
const db = require('../db/database');

/**
 * Ambil cookies aktif dari pool (yang belum dicoba / paling lama dipakai).
 */
function getNextPoolCookie(accountId) {
  const account = db.prepare('SELECT cookie_pool FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return null;
  let pool = [];
  try { pool = JSON.parse(account.cookie_pool || '[]'); } catch { return null; }
  if (!pool.length) return null;
  // Ambil yang belum expired (slot pertama yang available)
  const available = pool.filter(c => c.status !== 'expired');
  return available[0] || null;
}

/**
 * Rotate cookies akun ke slot berikutnya dari pool.
 * Returns { success, message, rotated }
 */
async function rotateCookies(accountId) {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return { success: false, message: 'Akun tidak ditemukan' };

  let pool = [];
  try { pool = JSON.parse(account.cookie_pool || '[]'); } catch {}
  if (!pool.length) return { success: false, message: 'Cookie pool kosong' };

  // Mark current cookies sebagai expired di pool (jika ada)
  const currentCookies = account.cookies;
  pool = pool.map(c => {
    if (c.cookies === currentCookies) return { ...c, status: 'expired', expired_at: new Date().toISOString() };
    return c;
  });

  // Ambil slot berikutnya yang available
  const next = pool.find(c => c.status !== 'expired');
  if (!next) {
    // Semua expired — update pool + return false
    db.prepare("UPDATE fb_accounts SET cookie_pool = ? WHERE id = ?")
      .run(JSON.stringify(pool), accountId);
    return { success: false, message: 'Semua cookies di pool sudah expired' };
  }

  // Rotate ke cookies baru
  db.prepare("UPDATE fb_accounts SET cookies = ?, status = 'active', cookie_pool = ? WHERE id = ?")
    .run(next.cookies, JSON.stringify(pool), accountId);

  return { success: true, message: `Rotasi ke slot "${next.label || 'unnamed'}" berhasil`, rotated: next.label };
}

/**
 * Tambah cookies ke pool akun.
 */
function addToPool(accountId, cookiesStr, label) {
  const account = db.prepare('SELECT cookie_pool FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return { success: false };
  let pool = [];
  try { pool = JSON.parse(account.cookie_pool || '[]'); } catch {}
  const id = `slot_${Date.now()}`;
  pool.push({ id, cookies: cookiesStr, label: label || `Slot ${pool.length + 1}`, status: 'available', added_at: new Date().toISOString() });
  db.prepare("UPDATE fb_accounts SET cookie_pool = ? WHERE id = ?").run(JSON.stringify(pool), accountId);
  return { success: true, id, total: pool.length };
}

/**
 * Hapus slot dari pool.
 */
function removeFromPool(accountId, slotId) {
  const account = db.prepare('SELECT cookie_pool FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return { success: false };
  let pool = [];
  try { pool = JSON.parse(account.cookie_pool || '[]'); } catch {}
  pool = pool.filter(c => c.id !== slotId);
  db.prepare("UPDATE fb_accounts SET cookie_pool = ? WHERE id = ?").run(JSON.stringify(pool), accountId);
  return { success: true, total: pool.length };
}

/**
 * List pool untuk akun.
 */
function listPool(accountId) {
  const account = db.prepare('SELECT cookie_pool FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return [];
  try { return JSON.parse(account.cookie_pool || '[]').map(c => ({ ...c, cookies: c.cookies?.substring(0, 30) + '...' })); } catch { return []; }
}

module.exports = { rotateCookies, addToPool, removeFromPool, listPool, getNextPoolCookie };
