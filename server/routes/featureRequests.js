const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  try {
    const sort = req.query.sort || 'votes';
    const status = req.query.status || 'all';
    const orderBy = sort === 'new' ? 'fr.created_at DESC' : 'fr.vote_count DESC, fr.created_at DESC';
    const statusFilter = status !== 'all' ? `AND fr.status = '${status}'` : '';

    const rows = db.prepare(`
      SELECT fr.*, u.username as author_name,
        CASE WHEN fv.id IS NOT NULL THEN 1 ELSE 0 END as has_voted
      FROM feature_requests fr
      LEFT JOIN users u ON fr.user_id = u.id
      LEFT JOIN feature_votes fv ON fv.feature_id = fr.id AND fv.user_id = ?
      WHERE fr.status != 'rejected' ${statusFilter}
      ORDER BY ${orderBy}
      LIMIT 100
    `).all(req.userId);
    res.json(rows.map(r => ({ ...r, has_voted: !!r.has_voted })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, (req, res) => {
  const { title, description, category } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Judul fitur wajib diisi' });
  if (title.length > 120) return res.status(400).json({ error: 'Judul maksimal 120 karakter' });
  try {
    const recent = db.prepare(`SELECT COUNT(*) as cnt FROM feature_requests WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`).get(req.userId);
    if (recent.cnt >= 5) return res.status(429).json({ error: 'Terlalu banyak request dalam 1 jam. Coba lagi nanti.' });

    const id = uuidv4();
    db.prepare(`INSERT INTO feature_requests (id, user_id, title, description, category) VALUES (?, ?, ?, ?, ?)`)
      .run(id, req.userId, title.trim(), description?.trim() || '', category || 'umum');
    res.json({ id, message: 'Request fitur berhasil dikirim!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/vote', authMiddleware, (req, res) => {
  const { id } = req.params;
  try {
    const feature = db.prepare('SELECT id, vote_count FROM feature_requests WHERE id = ?').get(id);
    if (!feature) return res.status(404).json({ error: 'Request tidak ditemukan' });

    const existing = db.prepare('SELECT id FROM feature_votes WHERE user_id = ? AND feature_id = ?').get(req.userId, id);
    if (existing) {
      db.prepare('DELETE FROM feature_votes WHERE user_id = ? AND feature_id = ?').run(req.userId, id);
      db.prepare('UPDATE feature_requests SET vote_count = MAX(0, vote_count - 1) WHERE id = ?').run(id);
      return res.json({ voted: false, vote_count: Math.max(0, feature.vote_count - 1) });
    } else {
      db.prepare('INSERT INTO feature_votes (id, user_id, feature_id) VALUES (?, ?, ?)').run(uuidv4(), req.userId, id);
      db.prepare('UPDATE feature_requests SET vote_count = vote_count + 1 WHERE id = ?').run(id);
      return res.json({ voted: true, vote_count: feature.vote_count + 1 });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin', adminMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT fr.*, u.username as author_name,
        (SELECT COUNT(*) FROM feature_votes fv WHERE fv.feature_id = fr.id) as vote_count_actual
      FROM feature_requests fr
      LEFT JOIN users u ON fr.user_id = u.id
      ORDER BY fr.vote_count DESC, fr.created_at DESC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/:id', adminMiddleware, (req, res) => {
  const { status, admin_note } = req.body;
  const validStatus = ['pending', 'planned', 'in_progress', 'done', 'rejected'];
  if (status && !validStatus.includes(status)) return res.status(400).json({ error: 'Status tidak valid' });
  try {
    db.prepare('UPDATE feature_requests SET status=?, admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(status || 'pending', admin_note || '', req.params.id);
    res.json({ message: 'Status diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/:id', adminMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM feature_votes WHERE feature_id = ?').run(req.params.id);
    db.prepare('DELETE FROM feature_requests WHERE id = ?').run(req.params.id);
    res.json({ message: 'Request dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
