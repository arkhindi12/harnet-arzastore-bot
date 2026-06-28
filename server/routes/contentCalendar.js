const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// GET /api/content-calendar
router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM content_calendar WHERE user_id=? ORDER BY scheduled_at ASC').all(req.userId);
  res.json(items.map(i => ({
    ...i,
    account_ids: JSON.parse(i.account_ids || '[]'),
    target_groups: JSON.parse(i.target_groups || '[]'),
  })));
});

// POST /api/content-calendar
router.post('/', (req, res) => {
  const { title, content, media_url, account_ids, target_groups, scheduled_at, repeat_type, repeat_interval, post_type } = req.body;
  if (!title || !content || !scheduled_at || !account_ids?.length)
    return res.status(400).json({ error: 'title, content, scheduled_at, account_ids wajib diisi' });
  const id = uuidv4();
  db.prepare(`INSERT INTO content_calendar (id,user_id,title,content,media_url,account_ids,target_groups,scheduled_at,repeat_type,repeat_interval,post_type)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, req.userId, title, content, media_url||null,
    JSON.stringify(account_ids), JSON.stringify(target_groups||[]),
    scheduled_at, repeat_type||'none', repeat_interval||0, post_type||'group');
  res.json({ id, message: 'Jadwal dibuat' });
});

// PUT /api/content-calendar/:id
router.put('/:id', (req, res) => {
  const item = db.prepare('SELECT id FROM content_calendar WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!item) return res.status(404).json({ error: 'Tidak ditemukan' });
  const { title, content, media_url, account_ids, target_groups, scheduled_at, repeat_type, repeat_interval, post_type } = req.body;
  db.prepare(`UPDATE content_calendar SET title=?,content=?,media_url=?,account_ids=?,target_groups=?,scheduled_at=?,repeat_type=?,repeat_interval=?,post_type=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(title, content, media_url||null, JSON.stringify(account_ids||[]), JSON.stringify(target_groups||[]),
      scheduled_at, repeat_type||'none', repeat_interval||0, post_type||'group', req.params.id);
  res.json({ message: 'Jadwal diperbarui' });
});

// DELETE /api/content-calendar/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM content_calendar WHERE id=? AND user_id=?').run(req.params.id, req.userId);
  db.prepare('DELETE FROM content_calendar_logs WHERE calendar_id=?').run(req.params.id);
  res.json({ message: 'Jadwal dihapus' });
});

// GET /api/content-calendar/:id/logs
router.get('/:id/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM content_calendar_logs WHERE calendar_id=? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  res.json(logs);
});

// POST /api/content-calendar/:id/run-now — manual trigger
router.post('/:id/run-now', async (req, res) => {
  const item = db.prepare('SELECT * FROM content_calendar WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!item) return res.status(404).json({ error: 'Tidak ditemukan' });
  try {
    const { runCalendarItem } = require('../services/contentCalendarService');
    const results = await runCalendarItem(item);
    res.json({ message: 'Selesai', results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
