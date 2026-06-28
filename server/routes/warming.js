const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { startWarming, stopWarming, isRunning, DEFAULT_SCHEDULE } = require('../services/warmingService');

// DB migration: add like_urls column if not exists
try { db.exec('ALTER TABLE warming_plans ADD COLUMN like_urls TEXT DEFAULT NULL'); } catch {}

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/schedule-template', (req, res) => res.json(DEFAULT_SCHEDULE));

router.get('/', (req, res) => {
  const plans = db.prepare(`
    SELECT wp.*, fa.name as account_name, fa.status as account_status
    FROM warming_plans wp
    LEFT JOIN fb_accounts fa ON wp.account_id = fa.id
    WHERE wp.user_id = ? ORDER BY wp.created_at DESC
  `).all(req.userId);
  res.json(plans.map(p => {
    // Reconcile status DB vs runner: kalau DB bilang 'running' tapi runner tidak punya plan ini,
    // status riil-nya 'idle'. Ini hanya tampilan response, tidak update DB di sini.
    const live = isRunning(p.id);
    const realStatus = p.status === 'running' && !live ? 'idle' : p.status;
    return {
      ...p,
      status: realStatus,
      is_running: live,
      schedule: JSON.parse(p.schedule || '[]'),
      like_urls: p.like_urls ? JSON.parse(p.like_urls) : [],
    };
  }));
});

router.post('/', (req, res) => {
  const { name, account_id, total_days, schedule, like_urls, niche, profile_data, auto_post_status, auto_setup_profile, browser_engine } = req.body;
  if (!name || !account_id) return res.status(400).json({ error: 'Nama dan akun wajib diisi' });
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id=? AND user_id=?').get(account_id, req.userId);
  if (!account) return res.status(400).json({ error: 'Akun tidak ditemukan' });
  const id = uuidv4();
  const accountDefaultEngine = db.prepare('SELECT browser_engine FROM fb_accounts WHERE id = ? AND user_id = ?').get(account_id, req.userId)?.browser_engine || 'patchright';
  const likeUrlsJson = Array.isArray(like_urls) && like_urls.length ? JSON.stringify(like_urls) : (typeof like_urls === 'string' && like_urls.trim() ? JSON.stringify(like_urls.split('\n').map(u=>u.trim()).filter(Boolean)) : null);
  db.prepare(`INSERT INTO warming_plans (id, user_id, account_id, name, total_days, schedule, like_urls, niche, profile_data, auto_post_status, auto_setup_profile, browser_engine) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.userId, account_id, name, total_days || 14, JSON.stringify(schedule || DEFAULT_SCHEDULE), likeUrlsJson, niche || null, profile_data ? JSON.stringify(profile_data) : null, auto_post_status ? 1 : 0, auto_setup_profile ? 1 : 0, ['patchright','obscura'].includes(browser_engine) ? browser_engine : accountDefaultEngine);
  res.json({ id, message: 'Rencana warming dibuat' });
});

router.put('/:id', (req, res) => {
  const plan = db.prepare('SELECT * FROM warming_plans WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!plan) return res.status(404).json({ error: 'Plan tidak ditemukan' });
  if (isRunning(req.params.id)) return res.status(400).json({ error: 'Hentikan warming dulu sebelum edit' });

  const { name, account_id, total_days, schedule, like_urls } = req.body;

  if (account_id && account_id !== plan.account_id) {
    const account = db.prepare('SELECT id FROM fb_accounts WHERE id=? AND user_id=?').get(account_id, req.userId);
    if (!account) return res.status(400).json({ error: 'Akun tidak ditemukan' });
  }

  let likeUrlsJson = plan.like_urls;
  if (like_urls !== undefined) {
    if (Array.isArray(like_urls) && like_urls.length) {
      likeUrlsJson = JSON.stringify(like_urls);
    } else if (typeof like_urls === 'string' && like_urls.trim()) {
      likeUrlsJson = JSON.stringify(like_urls.split('\n').map(u => u.trim()).filter(Boolean));
    } else {
      likeUrlsJson = null;
    }
  }

  db.prepare(`UPDATE warming_plans SET
    name = ?,
    account_id = ?,
    total_days = ?,
    schedule = ?,
    like_urls = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`).run(
      name || plan.name,
      account_id || plan.account_id,
      total_days || plan.total_days,
      schedule ? JSON.stringify(schedule) : plan.schedule,
      likeUrlsJson,
      req.params.id
    );

  res.json({ message: 'Rencana warming diperbarui' });
});

router.delete('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM warming_plans WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!p) return res.status(404).json({ error: 'Plan tidak ditemukan' });
  if (isRunning(req.params.id)) stopWarming(req.params.id);
  db.prepare('DELETE FROM warming_logs WHERE plan_id=?').run(req.params.id);
  db.prepare('DELETE FROM warming_plans WHERE id=?').run(req.params.id);
  res.json({ message: 'Plan dihapus' });
});

router.post('/:id/start', async (req, res) => {
  const p = db.prepare('SELECT * FROM warming_plans WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!p) return res.status(404).json({ error: 'Plan tidak ditemukan' });
  const result = await startWarming(req.params.id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/:id/stop', (req, res) => {
  const p = db.prepare('SELECT * FROM warming_plans WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!p) return res.status(404).json({ error: 'Plan tidak ditemukan' });
  res.json(stopWarming(req.params.id));
});

router.post('/:id/run-now', async (req, res) => {
  const p = db.prepare('SELECT * FROM warming_plans WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!p) return res.status(404).json({ error: 'Plan tidak ditemukan' });
  if (isRunning(req.params.id)) return res.status(400).json({ error: 'Sudah berjalan' });
  res.json({ message: 'Menjalankan warming hari ini...' });
  startWarming(req.params.id).catch(console.error);
});

router.get('/:id/logs', (req, res) => {
  const p = db.prepare('SELECT * FROM warming_plans WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!p) return res.status(404).json({ error: 'Plan tidak ditemukan' });
  const logs = db.prepare('SELECT * FROM warming_logs WHERE plan_id=? ORDER BY created_at DESC LIMIT 200').all(req.params.id);
  res.json(logs);
});

module.exports = router;
