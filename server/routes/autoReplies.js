const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { startAutoReply, stopAutoReply, isRunning } = require('../services/autoReplyService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const replies = db.prepare('SELECT ar.*, fa.name as reply_account_name FROM auto_replies ar LEFT JOIN fb_accounts fa ON ar.reply_account_id = fa.id WHERE ar.user_id=? ORDER BY ar.created_at DESC').all(req.userId);
  res.json(replies.map(r => ({ ...r, post_urls: JSON.parse(r.post_urls || '[]'), keywords: JSON.parse(r.keywords || '[]') })));
});

router.post('/', (req, res) => {
  const { name, post_urls, keywords, reply_template, reply_account_id, check_interval, max_replies_per_run, reply_mode, page_id, page_name } = req.body;
  if (!name || !post_urls?.length || !keywords?.length || !reply_template || !reply_account_id)
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  if (reply_mode === 'as_page' && !page_id)
    return res.status(400).json({ error: 'Page ID wajib diisi untuk mode Balas sebagai Halaman' });
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id=? AND user_id=?').get(reply_account_id, req.userId);
  if (!account) return res.status(400).json({ error: 'Akun reply tidak ditemukan' });
  const id = uuidv4();
  db.prepare(`INSERT INTO auto_replies (id, user_id, name, post_urls, keywords, reply_template, reply_account_id, check_interval, max_replies_per_run, reply_mode, page_id, page_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.userId, name, JSON.stringify(post_urls), JSON.stringify(keywords), reply_template, reply_account_id, check_interval || 30, max_replies_per_run || 10, reply_mode || 'personal', page_id || null, page_name || null);
  res.json({ id, message: 'Auto-reply dibuat' });
});

router.put('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM auto_replies WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: 'Auto-reply tidak ditemukan' });
  if (isRunning(req.params.id)) return res.status(400).json({ error: 'Hentikan dulu' });
  const { name, post_urls, keywords, reply_template, reply_account_id, check_interval, max_replies_per_run } = req.body;
  db.prepare(`UPDATE auto_replies SET name=?, post_urls=?, keywords=?, reply_template=?, reply_account_id=?, check_interval=?, max_replies_per_run=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(name || r.name, JSON.stringify(post_urls || JSON.parse(r.post_urls)), JSON.stringify(keywords || JSON.parse(r.keywords)), reply_template || r.reply_template, reply_account_id || r.reply_account_id, check_interval ?? r.check_interval, max_replies_per_run ?? r.max_replies_per_run, req.params.id);
  res.json({ message: 'Auto-reply diperbarui' });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM auto_replies WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: 'Auto-reply tidak ditemukan' });
  if (isRunning(req.params.id)) stopAutoReply(req.params.id);
  db.prepare('DELETE FROM auto_reply_logs WHERE reply_id=?').run(req.params.id);
  db.prepare('DELETE FROM auto_replies WHERE id=?').run(req.params.id);
  res.json({ message: 'Auto-reply dihapus' });
});

router.post('/:id/start', async (req, res) => {
  const r = db.prepare('SELECT * FROM auto_replies WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: 'Auto-reply tidak ditemukan' });
  const result = await startAutoReply(req.params.id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/:id/stop', (req, res) => {
  const r = db.prepare('SELECT * FROM auto_replies WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: 'Auto-reply tidak ditemukan' });
  res.json(stopAutoReply(req.params.id));
});

router.get('/:id/logs', (req, res) => {
  const r = db.prepare('SELECT * FROM auto_replies WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: 'Auto-reply tidak ditemukan' });
  const logs = db.prepare('SELECT * FROM auto_reply_logs WHERE reply_id=? ORDER BY created_at DESC LIMIT 200').all(req.params.id);
  res.json(logs);
});

module.exports = router;
