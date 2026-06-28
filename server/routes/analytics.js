const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getHeatmapData, getOverallStats, getSuccessRateByHour, getRecentActivity } = require('../services/analyticsService');

const router = express.Router();
router.use(authMiddleware);

router.get('/heatmap', (req, res) => res.json(getHeatmapData(req.userId)));
router.get('/stats', (req, res) => res.json(getOverallStats(req.userId)));
router.get('/hourly', (req, res) => res.json(getSuccessRateByHour(req.userId)));
router.get('/activity', (req, res) => res.json(getRecentActivity(req.userId, parseInt(req.query.limit) || 50)));

router.get('/daily', (req, res) => {
  const db = require('../db/database');
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`
    SELECT date(cl.created_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN cl.status='success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN cl.status='failed' THEN 1 ELSE 0 END) as failed
    FROM comment_logs cl
    JOIN campaigns c ON cl.campaign_id = c.id
    WHERE c.user_id = ? AND cl.created_at >= date('now', ? || ' days')
    GROUP BY date(cl.created_at)
    ORDER BY date ASC
  `).all(req.userId, `-${days}`);
  res.json(rows);
});

router.get('/campaigns-overview', (req, res) => {
  const db = require('../db/database');
  const rows = db.prepare(`
    SELECT c.name, c.status,
      COUNT(cl.id) as total,
      SUM(CASE WHEN cl.status='success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN cl.status='failed' THEN 1 ELSE 0 END) as failed
    FROM campaigns c
    LEFT JOIN comment_logs cl ON c.id = cl.campaign_id
    WHERE c.user_id = ?
    GROUP BY c.id ORDER BY total DESC LIMIT 10
  `).all(req.userId);
  res.json(rows);
});

module.exports = router;
