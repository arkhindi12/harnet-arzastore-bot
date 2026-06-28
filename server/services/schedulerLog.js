// Centralized scheduler activity logger
// Tujuan: catat tiap eksekusi scheduler/cron yang sukses/gagal supaya user bisa audit.

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

// Migrasi tabel
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduler_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      status TEXT NOT NULL,
      message TEXT,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS scheduler_logs_user_idx ON scheduler_logs(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS scheduler_logs_type_idx ON scheduler_logs(type, created_at DESC);
  `);
} catch (e) {
  console.error('[scheduler-log] migration failed:', e.message);
}

const stmt = db.prepare(
  'INSERT INTO scheduler_logs (id, user_id, type, target_id, target_name, status, message, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

function logSchedulerEvent(event) {
  try {
    stmt.run(
      uuidv4(),
      event.userId || null,
      event.type,
      event.targetId || null,
      event.targetName || null,
      event.status || 'success',
      event.message || null,
      event.durationMs || null
    );
  } catch (e) {
    console.error('[scheduler-log] insert failed:', e.message, '| event:', event.type);
  }
}

async function withSchedulerLog(meta, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    logSchedulerEvent({
      ...meta,
      status: meta.statusOnSuccess || 'success',
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    const sep = meta.message ? ' | ' : '';
    logSchedulerEvent({
      ...meta,
      status: 'failed',
      message: `${meta.message || ''}${sep}${err.message}`.trim(),
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

function getRecentLogs({ userId = null, type = null, limit = 100, offset = 0 } = {}) {
  let sql = 'SELECT * FROM scheduler_logs WHERE 1=1';
  const params = [];
  if (userId) { sql += ' AND (user_id = ? OR user_id IS NULL)'; params.push(userId); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Math.min(limit, 500), offset);
  return db.prepare(sql).all(...params);
}

function getLogCounts({ userId = null, since = null } = {}) {
  let sql = 'SELECT type, status, COUNT(*) as cnt FROM scheduler_logs WHERE 1=1';
  const params = [];
  if (userId) { sql += ' AND (user_id = ? OR user_id IS NULL)'; params.push(userId); }
  if (since) { sql += ' AND created_at >= ?'; params.push(since); }
  sql += ' GROUP BY type, status';
  return db.prepare(sql).all(...params);
}

function cleanupOldLogs(days = 30) {
  try {
    const result = db.prepare(`DELETE FROM scheduler_logs WHERE created_at < datetime('now', '-${parseInt(days, 10)} days')`).run();
    if (result.changes > 0) {
      console.log(`[scheduler-log] cleaned up ${result.changes} log lama (>${days} hari)`);
    }
  } catch (e) { console.error('[scheduler-log] cleanup failed:', e.message); }
}

module.exports = { logSchedulerEvent, withSchedulerLog, getRecentLogs, getLogCounts, cleanupOldLogs };
