// Service Group Quality Score.
// Hitung skor grup berdasarkan riwayat sukses/gagal post & share di grup itu.
// Skor: 0..100. Grade: A (>=80), B (>=60), C (>=40), D (<40).
// Dipakai task runner untuk prioritaskan grup score tinggi.

const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function gradeFor(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function getOrCreate(userId, groupUrl, groupName = null, groupId = null) {
  const row = db.prepare('SELECT * FROM group_quality WHERE user_id = ? AND group_url = ?').get(userId, groupUrl);
  if (row) return row;
  const id = uuidv4();
  db.prepare(
    'INSERT INTO group_quality (id, user_id, group_url, group_id, name, success_count, failed_count, score, grade) VALUES (?, ?, ?, ?, ?, 0, 0, 50, ?)'
  ).run(id, userId, groupUrl, groupId, groupName, gradeFor(50));
  return db.prepare('SELECT * FROM group_quality WHERE id = ?').get(id);
}

function recordOutcome(userId, groupUrl, success, errorMsg = null, groupName = null, groupId = null) {
  if (!userId || !groupUrl) return null;
  const row = getOrCreate(userId, groupUrl, groupName, groupId);

  // Smoothed score: setiap sukses +5, gagal -10, baseline 50.
  const successCount = (row.success_count || 0) + (success ? 1 : 0);
  const failedCount = (row.failed_count || 0) + (success ? 0 : 1);

  const total = successCount + failedCount;
  const successRatio = total > 0 ? successCount / total : 0.5;
  // Pendekatan: blend antara baseline 50, success ratio, dan recency.
  let score = 50 + successRatio * 50 - (1 - successRatio) * 50;
  score = Math.max(0, Math.min(100, score));

  // Pinalti tambahan kalau gagal beruntun terlalu sering
  if (failedCount >= 3 && successCount === 0) score = Math.min(score, 25);

  const grade = gradeFor(score);

  db.prepare(`
    UPDATE group_quality
    SET success_count = ?,
        failed_count = ?,
        score = ?,
        grade = ?,
        last_success = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE last_success END,
        last_failed = CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE last_failed END,
        notes = CASE WHEN ? IS NOT NULL THEN ? ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(successCount, failedCount, Number(score.toFixed(2)), grade,
    success ? 1 : 0, success ? 1 : 0, errorMsg || null, errorMsg || null, row.id);

  return { id: row.id, score, grade };
}

function listForUser(userId, opts = {}) {
  const limit = Number(opts.limit || 200);
  const minGrade = opts.minGrade || null;
  let rows = db.prepare(
    'SELECT id, group_url, group_id, name, success_count, failed_count, score, grade, last_success, last_failed, updated_at FROM group_quality WHERE user_id = ? ORDER BY score DESC, success_count DESC LIMIT ?'
  ).all(userId, limit);
  if (minGrade) {
    const order = ['D', 'C', 'B', 'A'];
    const min = order.indexOf(minGrade);
    rows = rows.filter(r => order.indexOf(r.grade) >= min);
  }
  return rows;
}

function rankGroups(userId, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  // Ambil score per URL, default 50 (C) untuk yang belum ada
  const placeholders = urls.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT group_url, score, grade FROM group_quality WHERE user_id = ? AND group_url IN (${placeholders})`
  ).all(userId, ...urls);
  const map = new Map(rows.map(r => [r.group_url, r]));
  // Sort descending by score; unknown → 50 default
  return [...urls].sort((a, b) => {
    const sa = map.get(a)?.score ?? 50;
    const sb = map.get(b)?.score ?? 50;
    return sb - sa;
  });
}

module.exports = { recordOutcome, listForUser, rankGroups, gradeFor };
