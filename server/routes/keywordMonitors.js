const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { startMonitor, stopMonitor, isRunning } = require('../services/keywordMonitorService');

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/', (req, res) => {
  const monitors = db.prepare('SELECT * FROM keyword_monitors WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(monitors.map(m => ({
    ...m,
    group_urls: JSON.parse(m.group_urls || '[]'),
    keywords: JSON.parse(m.keywords || '[]'),
    account_ids: JSON.parse(m.account_ids || '[]'),
  })));
});

router.post('/', (req, res) => {
  const { name, group_urls, keywords, comment_template, account_ids, delay_min, delay_max, check_interval, max_comments_per_run } = req.body;
  if (!name || !keywords?.length || !comment_template || !account_ids?.length)
    return res.status(400).json({ error: 'Nama, keyword, template, dan akun wajib diisi (grup boleh kosong, akan otomatis pakai grup tersimpan dari discovery)' });
  const id = uuidv4();
  db.prepare(`INSERT INTO keyword_monitors (id, user_id, name, group_urls, keywords, comment_template, account_ids, delay_min, delay_max, check_interval, max_comments_per_run)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.userId, name, JSON.stringify(group_urls || []), JSON.stringify(keywords), comment_template, JSON.stringify(account_ids), delay_min || 5, delay_max || 30, check_interval || 15, max_comments_per_run || 5);
  res.json({ id, message: 'Monitor berhasil dibuat' });
});

router.put('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM keyword_monitors WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!m) return res.status(404).json({ error: 'Monitor tidak ditemukan' });
  if (isRunning(req.params.id)) return res.status(400).json({ error: 'Hentikan monitor dulu' });
  const { name, group_urls, keywords, comment_template, account_ids, delay_min, delay_max, check_interval, max_comments_per_run } = req.body;
  db.prepare(`UPDATE keyword_monitors SET name=?, group_urls=?, keywords=?, comment_template=?, account_ids=?, delay_min=?, delay_max=?, check_interval=?, max_comments_per_run=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(name || m.name, JSON.stringify(group_urls || JSON.parse(m.group_urls)), JSON.stringify(keywords || JSON.parse(m.keywords)), comment_template || m.comment_template, JSON.stringify(account_ids || JSON.parse(m.account_ids)), delay_min ?? m.delay_min, delay_max ?? m.delay_max, check_interval ?? m.check_interval, max_comments_per_run ?? m.max_comments_per_run, req.params.id);
  res.json({ message: 'Monitor diperbarui' });
});

router.delete('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM keyword_monitors WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!m) return res.status(404).json({ error: 'Monitor tidak ditemukan' });
  if (isRunning(req.params.id)) stopMonitor(req.params.id);
  db.prepare('DELETE FROM keyword_monitor_logs WHERE monitor_id=?').run(req.params.id);
  db.prepare('DELETE FROM keyword_monitors WHERE id=?').run(req.params.id);
  res.json({ message: 'Monitor dihapus' });
});

router.post('/:id/start', async (req, res) => {
  const m = db.prepare('SELECT * FROM keyword_monitors WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!m) return res.status(404).json({ error: 'Monitor tidak ditemukan' });
  const result = await startMonitor(req.params.id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/:id/stop', (req, res) => {
  const m = db.prepare('SELECT * FROM keyword_monitors WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!m) return res.status(404).json({ error: 'Monitor tidak ditemukan' });
  res.json(stopMonitor(req.params.id));
});

router.get('/:id/logs', (req, res) => {
  const m = db.prepare('SELECT * FROM keyword_monitors WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!m) return res.status(404).json({ error: 'Monitor tidak ditemukan' });
  const logs = db.prepare(`SELECT kml.*, fa.name as account_name FROM keyword_monitor_logs kml LEFT JOIN fb_accounts fa ON kml.account_id=fa.id WHERE kml.monitor_id=? ORDER BY kml.created_at DESC LIMIT 200`).all(req.params.id);
  res.json(logs);
});

module.exports = router;
