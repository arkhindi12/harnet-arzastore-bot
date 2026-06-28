const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getRecentLogs, getLogCounts } = require('../services/schedulerLog');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const { type, limit, offset } = req.query;
  const isAdmin = req.userRole === 'admin';
  const logs = getRecentLogs({
    userId: isAdmin ? null : req.userId,
    type: type || null,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
  });
  res.json(logs);
});

router.get('/stats', (req, res) => {
  const isAdmin = req.userRole === 'admin';
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const counts = getLogCounts({
    userId: isAdmin ? null : req.userId,
    since,
  });
  res.json(counts);
});

router.get('/types', (req, res) => {
  const db = require('../db/database');
  const isAdmin = req.userRole === 'admin';
  let sql = 'SELECT DISTINCT type FROM scheduler_logs WHERE 1=1';
  const params = [];
  if (!isAdmin) { sql += ' AND (user_id = ? OR user_id IS NULL)'; params.push(req.userId); }
  sql += ' ORDER BY type ASC';
  res.json(db.prepare(sql).all(...params).map(r => r.type));
});

module.exports = router;
