// Routes Auto-Join Group: CRUD + start/stop + logs
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { runJobOnce, isJobRunning } = require('../services/autoJoinScheduler');

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

function ownsAccount(userId, accountId) {
  if (!accountId) return false;
  return !!db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
}

function getJob(userId, jobId) {
  return db.prepare('SELECT * FROM auto_join_jobs WHERE id = ? AND user_id = ?').get(jobId, userId);
}

router.get('/', (req, res) => {
  const jobs = db.prepare(
    `SELECT j.*, a.name AS account_name FROM auto_join_jobs j
     LEFT JOIN fb_accounts a ON a.id = j.account_id
     WHERE j.user_id = ? ORDER BY j.created_at DESC`
  ).all(req.userId);
  res.json(jobs.map(j => ({ ...j, group_urls: (() => { try { return JSON.parse(j.group_urls || '[]'); } catch { return []; } })() })));
});

router.post('/', (req, res) => {
  const {
    name, account_id, source = 'niche', keyword, group_urls = [],
    daily_limit = 5, join_delay_min = 90, join_delay_max = 240,
    active_hours_start = 8, active_hours_end = 22,
    answer_template = '',
    use_ai_answer = 0, ai_context = '', ai_tone = 'natural',
    quality_filter_enabled = 1, min_posts_per_day = 125, min_avg_comments = 3,
  } = req.body || {};

  if (!name || !account_id) return res.status(400).json({ error: 'name dan account_id wajib' });
  if (!ownsAccount(req.userId, account_id)) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  if (source === 'niche' && !keyword) return res.status(400).json({ error: 'Untuk source niche, keyword wajib diisi' });
  if (source === 'manual' && (!Array.isArray(group_urls) || group_urls.length === 0)) {
    return res.status(400).json({ error: 'Untuk source manual, group_urls wajib diisi' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO auto_join_jobs (
      id, user_id, name, account_id, source, keyword, group_urls,
      daily_limit, join_delay_min, join_delay_max,
      active_hours_start, active_hours_end,
      answer_template, use_ai_answer, ai_context, ai_tone,
      quality_filter_enabled, min_posts_per_day, min_avg_comments,
      status, last_reset_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?)`
  ).run(
    id, req.userId, name, account_id, source, keyword || null, JSON.stringify(group_urls || []),
    Number(daily_limit) || 5, Number(join_delay_min) || 90, Number(join_delay_max) || 240,
    Number(active_hours_start) ?? 8, Number(active_hours_end) ?? 22,
    answer_template || null,
    use_ai_answer ? 1 : 0, ai_context || null, ai_tone || 'natural',
    quality_filter_enabled ? 1 : 0, Number(min_posts_per_day) || 125, Number(min_avg_comments) || 3,
    new Date().toISOString().slice(0, 10),
  );
  res.json({ id, message: 'Job auto-join dibuat' });
});

router.put('/:id', (req, res) => {
  const job = getJob(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan' });

  const allowed = ['name', 'keyword', 'group_urls', 'daily_limit', 'join_delay_min', 'join_delay_max', 'active_hours_start', 'active_hours_end', 'answer_template', 'source', 'use_ai_answer', 'ai_context', 'ai_tone', 'quality_filter_enabled', 'min_posts_per_day', 'min_avg_comments'];
  const updates = []; const vals = [];
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    let v = req.body[key];
    if (key === 'group_urls') v = JSON.stringify(Array.isArray(v) ? v : []);
    if (key === 'use_ai_answer' || key === 'quality_filter_enabled') v = v ? 1 : 0;
    updates.push(`${key} = ?`);
    vals.push(v);
  }
  if (!updates.length) return res.json({ message: 'Tidak ada perubahan' });
  vals.push(req.params.id);
  db.prepare(`UPDATE auto_join_jobs SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals);
  res.json({ message: 'Job diperbarui' });
});

router.delete('/:id', (req, res) => {
  const job = getJob(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan' });
  db.prepare("UPDATE auto_join_jobs SET status='idle' WHERE id=?").run(req.params.id);
  db.prepare('DELETE FROM auto_join_logs WHERE job_id = ?').run(req.params.id);
  db.prepare('DELETE FROM auto_join_jobs WHERE id = ?').run(req.params.id);
  res.json({ message: 'Job dihapus' });
});

router.post('/:id/start', (req, res) => {
  const job = getJob(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan' });
  db.prepare("UPDATE auto_join_jobs SET status='running', next_run=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ message: 'Job aktif. Scheduler akan menjalankan sesuai jadwal.' });
});

router.post('/:id/stop', (req, res) => {
  const job = getJob(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan' });
  db.prepare("UPDATE auto_join_jobs SET status='idle' WHERE id=?").run(req.params.id);
  res.json({ message: 'Job dihentikan' });
});

router.post('/:id/run-now', async (req, res) => {
  const job = getJob(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan' });
  if (isJobRunning(req.params.id)) return res.status(400).json({ error: 'Job sedang berjalan' });
  res.json({ message: 'Eksekusi 1 grup dimulai' });
  // Set status running supaya counter & next_run jalan
  db.prepare("UPDATE auto_join_jobs SET status='running' WHERE id=?").run(req.params.id);
  const fresh = getJob(req.userId, req.params.id);
  runJobOnce(fresh).catch(err => console.error('[auto-join run-now]', err.message));
});

router.get('/:id/logs', (req, res) => {
  const job = getJob(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan' });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const logs = db.prepare(
    `SELECT group_url, group_name, status, detail, questions, answers, answer_source, created_at FROM auto_join_logs WHERE job_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(req.params.id, limit);
  res.json(logs.map(l => ({
    ...l,
    questions: l.questions ? (() => { try { return JSON.parse(l.questions); } catch { return null; } })() : null,
    answers: l.answers ? (() => { try { return JSON.parse(l.answers); } catch { return null; } })() : null,
  })));
});

module.exports = router;
