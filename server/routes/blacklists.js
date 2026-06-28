const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM blacklists WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { url, type, note } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'URL wajib diisi' });
  const existing = db.prepare('SELECT id FROM blacklists WHERE user_id = ? AND url = ?').get(req.userId, url.trim());
  if (existing) return res.status(400).json({ error: 'URL ini sudah ada di blacklist' });
  const id = uuidv4();
  db.prepare('INSERT INTO blacklists (id, user_id, url, type, note) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.userId, url.trim(), type || 'post', note?.trim() || null);
  res.json({ id, message: 'URL ditambahkan ke blacklist' });
});

router.post('/bulk', (req, res) => {
  const { urls, type } = req.body;
  if (!Array.isArray(urls) || !urls.length) return res.status(400).json({ error: 'URLs wajib diisi' });
  let added = 0;
  for (const url of urls) {
    if (!url?.trim()) continue;
    const existing = db.prepare('SELECT id FROM blacklists WHERE user_id = ? AND url = ?').get(req.userId, url.trim());
    if (!existing) {
      db.prepare('INSERT INTO blacklists (id, user_id, url, type) VALUES (?, ?, ?, ?)').run(uuidv4(), req.userId, url.trim(), type || 'post');
      added++;
    }
  }
  res.json({ added, message: `${added} URL ditambahkan ke blacklist` });
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT id FROM blacklists WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!item) return res.status(404).json({ error: 'Item tidak ditemukan' });
  db.prepare('DELETE FROM blacklists WHERE id = ?').run(req.params.id);
  res.json({ message: 'Dihapus dari blacklist' });
});

router.delete('/', (req, res) => {
  db.prepare('DELETE FROM blacklists WHERE user_id = ?').run(req.userId);
  res.json({ message: 'Blacklist dikosongkan' });
});

module.exports = router;
