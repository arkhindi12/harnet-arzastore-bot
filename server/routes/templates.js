const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM comment_templates WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, content, category } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama template wajib diisi' });
  if (!content?.trim()) return res.status(400).json({ error: 'Konten template wajib diisi' });
  const id = uuidv4();
  db.prepare('INSERT INTO comment_templates (id, user_id, name, content, category) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.userId, name.trim(), content.trim(), category || 'umum');
  res.json({ id, message: 'Template berhasil disimpan' });
});

router.put('/:id', (req, res) => {
  const tpl = db.prepare('SELECT id FROM comment_templates WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tpl) return res.status(404).json({ error: 'Template tidak ditemukan' });
  const { name, content, category } = req.body;
  db.prepare('UPDATE comment_templates SET name=?, content=?, category=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name || '', content || '', category || 'umum', req.params.id);
  res.json({ message: 'Template diperbarui' });
});

router.delete('/:id', (req, res) => {
  const tpl = db.prepare('SELECT id FROM comment_templates WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tpl) return res.status(404).json({ error: 'Template tidak ditemukan' });
  db.prepare('DELETE FROM comment_templates WHERE id = ?').run(req.params.id);
  res.json({ message: 'Template dihapus' });
});

module.exports = router;
