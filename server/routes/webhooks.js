const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const WEBHOOK_EVENTS = [
  'campaign.started', 'campaign.completed', 'campaign.stopped', 'campaign.paused',
  'account.dead', 'account.checkpoint', 'comment.success', 'comment.failed',
  'weekly.report'
];

router.get('/events', (req, res) => res.json(WEBHOOK_EVENTS));

router.get('/', (req, res) => {
  const webhooks = db.prepare('SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(webhooks.map(w => ({ ...w, events: JSON.parse(w.events || '[]') })));
});

router.post('/', (req, res) => {
  const { name, url, events = [], secret } = req.body;
  if (!name?.trim() || !url?.trim()) return res.status(400).json({ error: 'Nama dan URL wajib diisi' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'URL tidak valid' }); }
  const id = uuidv4();
  db.prepare('INSERT INTO webhooks (id, user_id, name, url, events, secret) VALUES (?,?,?,?,?,?)').run(
    id, req.userId, name.trim(), url.trim(), JSON.stringify(events), secret || null
  );
  res.json({ id, message: 'Webhook berhasil ditambahkan' });
});

router.put('/:id', (req, res) => {
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!wh) return res.status(404).json({ error: 'Webhook tidak ditemukan' });
  const { name, url, events, secret, is_active } = req.body;
  db.prepare('UPDATE webhooks SET name=?, url=?, events=?, secret=?, is_active=? WHERE id=?').run(
    name ?? wh.name, url ?? wh.url, JSON.stringify(events ?? JSON.parse(wh.events)), secret ?? wh.secret,
    is_active !== undefined ? (is_active ? 1 : 0) : wh.is_active, req.params.id
  );
  res.json({ message: 'Webhook diperbarui' });
});

router.delete('/:id', (req, res) => {
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!wh) return res.status(404).json({ error: 'Webhook tidak ditemukan' });
  db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Webhook dihapus' });
});

router.post('/:id/test', async (req, res) => {
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!wh) return res.status(404).json({ error: 'Webhook tidak ditemukan' });
  const { triggerWebhook } = require('../services/webhookService');
  await triggerWebhook(req.userId, 'test', { message: 'Ini adalah test webhook dari ArzaBot' });
  res.json({ message: 'Test webhook dikirim' });
});

module.exports = router;
