// Daily DB backup service.
// - Pakai SQLite Online Backup API (db.backup) supaya aman walau ada write konkuren.
// - Disimpan di data/backups/app-YYYY-MM-DD-HHMM.db
// - Rotasi: simpan 7 hari terakhir (configurable via BACKUP_KEEP_DAYS env).
// - Jadwal: tiap 24 jam, dijalankan dari index.js.

const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const DATA_DIR = path.join(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_DAYS = parseInt(process.env.BACKUP_KEEP_DAYS || '7', 10);

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function pad(n) { return n.toString().padStart(2, '0'); }
function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function runBackup() {
  const filename = `app-${timestamp()}.db`;
  const target = path.join(BACKUP_DIR, filename);

  try {
    await db.backup(target);
    const sizeMB = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
    console.log(`[db-backup] backup berhasil: ${filename} (${sizeMB} MB)`);
    rotateOldBackups();
    return { success: true, filename, sizeMB };
  } catch (err) {
    console.error(`[db-backup] backup gagal:`, err.message);
    return { success: false, error: err.message };
  }
}

function rotateOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('app-') && f.endsWith('.db'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    let removed = 0;
    for (const f of files) {
      // Selalu simpan minimal 1 backup terbaru
      if (f === files[0]) continue;
      if (f.mtime < cutoff) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, f.name));
          removed++;
        } catch {}
      }
    }
    if (removed > 0) console.log(`[db-backup] rotasi: hapus ${removed} backup lama (>${KEEP_DAYS} hari)`);
  } catch (err) {
    console.error('[db-backup] rotasi gagal:', err.message);
  }
}

function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { name: f, size_mb: +(stat.size / 1024 / 1024).toFixed(2), created: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.created.localeCompare(a.created));
  } catch {
    return [];
  }
}

let intervalHandle = null;

function start() {
  // Jalankan pertama kali setelah 5 menit (kasih waktu server stabil)
  setTimeout(() => {
    runBackup().catch(() => {});
    intervalHandle = setInterval(() => {
      runBackup().catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);
  console.log(`[db-backup] enabled — backup tiap 24 jam, simpan ${KEEP_DAYS} hari ke ${BACKUP_DIR}`);
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

module.exports = { start, stop, runBackup, listBackups };
