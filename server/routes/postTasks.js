const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { runTask, runOnce, stopTask, isRunning } = require('../services/postTaskRunner');

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/', (req, res) => {
  const { type } = req.query;
  let query = 'SELECT * FROM post_tasks WHERE user_id = ?';
  const params = [req.userId];
  if (type) { query += ' AND type = ?'; params.push(type); }
  query += ' ORDER BY created_at DESC';
  const tasks = db.prepare(query).all(...params);
  res.json(tasks.map(t => ({ ...t, account_ids: JSON.parse(t.account_ids || '[]'), config: JSON.parse(t.config || '{}') })));
});

router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  const logs = db.prepare(`
    SELECT ptl.*, fa.name as account_name
    FROM post_task_logs ptl
    LEFT JOIN fb_accounts fa ON ptl.account_id = fa.id
    WHERE ptl.task_id = ?
    ORDER BY ptl.created_at DESC LIMIT 100
  `).all(req.params.id);

  res.json({ ...task, account_ids: JSON.parse(task.account_ids || '[]'), config: JSON.parse(task.config || '{}'), logs });
});

router.post('/', (req, res) => {
  const { type, name, account_ids, config, interval_minutes, browser_engine } = req.body;
  if (!type || !name || !account_ids?.length || !config) {
    return res.status(400).json({ error: 'Type, nama, akun, dan konfigurasi diperlukan' });
  }

  const VALID_TYPES = ['auto_up', 'group_post', 'marketplace', 'share_post', 'group_listing', 'smart_post'];
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Tipe tidak valid' });

  for (const aid of account_ids) {
    if (!db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(aid, req.userId)) {
      return res.status(400).json({ error: `Akun ${aid} tidak ditemukan` });
    }
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO post_tasks (id, user_id, type, name, account_ids, config, status, interval_minutes)
    VALUES (?, ?, ?, ?, ?, ?, 'idle', ?)
  `).run(id, req.userId, type, name, JSON.stringify(account_ids), JSON.stringify(config), interval_minutes || 60);

  res.json({ id, message: 'Task berhasil dibuat' });
});

router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  if (isRunning(req.params.id)) return res.status(400).json({ error: 'Task sedang berjalan, hentikan dulu' });

  const { name, account_ids, config, interval_minutes } = req.body;
  db.prepare(`UPDATE post_tasks SET name = ?, account_ids = ?, config = ?, interval_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(name || task.name, JSON.stringify(account_ids || JSON.parse(task.account_ids)), JSON.stringify(config || JSON.parse(task.config)), interval_minutes ?? task.interval_minutes, req.params.id);

  res.json({ message: 'Task berhasil diperbarui' });
});

router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  try {
    if (isRunning(req.params.id)) stopTask(req.params.id);

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM post_task_logs WHERE task_id = ?').run(req.params.id);
      db.prepare('DELETE FROM post_tasks WHERE id = ?').run(req.params.id);
    });
    tx();

    res.json({ message: 'Task berhasil dihapus' });
  } catch (err) {
    console.error('[postTasks.delete] gagal:', err);
    res.status(500).json({ error: 'Gagal menghapus task: ' + err.message });
  }
});

router.post('/:id/start', (req, res) => {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  if (isRunning(req.params.id)) return res.status(400).json({ error: 'Task sudah berjalan' });

  res.json({ message: 'Task dimulai', status: 'running' });
  runTask(req.params.id).catch(err => {
    console.error(`Task ${req.params.id} error:`, err);
  });
});

router.post('/:id/stop', (req, res) => {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  const result = stopTask(req.params.id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/:id/run-once', (req, res) => {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  if (isRunning(req.params.id)) return res.status(400).json({ error: 'Task sedang berjalan' });

  res.json({ message: 'Menjalankan task sekali...' });
  runOnce(req.params.id).catch(err => {
    console.error(`[postTasks.run-once] ${req.params.id} error:`, err.message);
  });
});

router.get('/:id/logs', (req, res) => {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  const logs = db.prepare(`
    SELECT ptl.*, fa.name as account_name
    FROM post_task_logs ptl
    LEFT JOIN fb_accounts fa ON ptl.account_id = fa.id
    WHERE ptl.task_id = ?
    ORDER BY ptl.created_at DESC LIMIT 200
  `).all(req.params.id);

  res.json(logs);
});

module.exports = router;
