const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { runCampaign, stopCampaign, isRunning } = require('../services/campaignRunner');

const router = express.Router();
router.use(authMiddleware);

router.post('/campaigns/:id/start', async (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });

  if (isRunning(req.params.id)) {
    return res.status(400).json({ error: 'Kampanye sudah berjalan' });
  }

  res.json({ message: 'Kampanye dimulai', status: 'running' });

  runCampaign(req.params.id).then(result => {
    console.log(`Kampanye ${req.params.id} selesai:`, result);
  }).catch(err => {
    console.error(`Kampanye ${req.params.id} error:`, err);
    db.prepare("UPDATE campaigns SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  });
});

router.post('/campaigns/:id/stop', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });

  const result = stopCampaign(req.params.id);
  if (result.error) return res.status(400).json(result);

  res.json(result);
});

router.get('/campaigns/:id/status', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM comment_logs WHERE campaign_id = ?
  `).get(req.params.id);

  res.json({
    status: campaign.status,
    running: isRunning(req.params.id),
    stats,
  });
});

module.exports = router;
