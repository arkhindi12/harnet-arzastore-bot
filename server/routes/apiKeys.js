const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

router.get('/', (req, res) => {
  const keys = db.prepare('SELECT id, name, key_prefix, is_active, last_used, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(keys);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama API key diperlukan' });

  const existing = db.prepare('SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ? AND is_active = 1').get(req.userId);
  if (existing.cnt >= 5) return res.status(400).json({ error: 'Maksimal 5 API key aktif per user' });

  const rawKey = 'fbac_' + crypto.randomBytes(24).toString('hex');
  const prefix = rawKey.substring(0, 12) + '...';
  const id = uuidv4();

  db.prepare('INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?, ?)').run(id, req.userId, name, hashKey(rawKey), prefix);

  res.json({ id, name, key: rawKey, key_prefix: prefix, message: 'Simpan API key ini sekarang — tidak akan ditampilkan lagi!' });
});

router.delete('/:id', (req, res) => {
  const key = db.prepare('SELECT id FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!key) return res.status(404).json({ error: 'API key tidak ditemukan' });
  db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'API key dinonaktifkan' });
});

module.exports = router;
