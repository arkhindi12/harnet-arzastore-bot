const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/settings', (req, res) => {
  let s = db.prepare('SELECT * FROM roi_settings WHERE user_id = ?').get(req.userId);
  if (!s) {
    db.prepare('INSERT OR IGNORE INTO roi_settings (user_id) VALUES (?)').run(req.userId);
    s = { user_id: req.userId, reach_per_comment: 85, cpm_idr: 20000 };
  }
  res.json(s);
});

router.put('/settings', (req, res) => {
  const { reach_per_comment, cpm_idr } = req.body;
  db.prepare('INSERT OR REPLACE INTO roi_settings (user_id, reach_per_comment, cpm_idr, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
    .run(req.userId, reach_per_comment || 85, cpm_idr || 20000);
  res.json({ message: 'Pengaturan ROI disimpan' });
});

router.get('/estimate', (req, res) => {
  const s = db.prepare('SELECT * FROM roi_settings WHERE user_id = ?').get(req.userId) || { reach_per_comment: 85, cpm_idr: 20000 };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const thisMonth = db.prepare(`
    SELECT COUNT(*) as cnt FROM comment_logs cl
    JOIN campaigns c ON c.id = cl.campaign_id
    WHERE c.user_id = ? AND cl.status = 'success' AND date(cl.created_at) >= ?
  `).get(req.userId, startOfMonth);

  const lastMonth = db.prepare(`
    SELECT COUNT(*) as cnt FROM comment_logs cl
    JOIN campaigns c ON c.id = cl.campaign_id
    WHERE c.user_id = ? AND cl.status = 'success' AND date(cl.created_at) BETWEEN ? AND ?
  `).get(req.userId, startOfLastMonth, endOfLastMonth);

  const allTime = db.prepare(`
    SELECT COUNT(*) as cnt FROM comment_logs cl
    JOIN campaigns c ON c.id = cl.campaign_id
    WHERE c.user_id = ? AND cl.status = 'success'
  `).get(req.userId);

  const calc = (comments) => {
    const reach = comments * s.reach_per_comment;
    const adValue = Math.round((reach / 1000) * s.cpm_idr);
    return { comments, reach, adValue };
  };

  res.json({
    this_month: calc(thisMonth.cnt),
    last_month: calc(lastMonth.cnt),
    all_time: calc(allTime.cnt),
    settings: s,
  });
});

module.exports = router;
