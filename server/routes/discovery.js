const express = require('express');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const {
  discoverGroups,
  discoverFeedPostIds,
  getStoredGroups,
  getStoredFeedPostIds,
  getRecentRuns,
  getRecentLikeLogs,
} = require('../services/browserDiscovery');

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

const runningSyncs = new Set();

function ownsAccount(accountId, userId) {
  return !!db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
}

// Sync grup pakai browser headless (jalan async di background, response cepat).
router.post('/accounts/:id/sync-groups', (req, res) => {
  const accountId = req.params.id;
  if (!ownsAccount(accountId, req.userId)) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const key = `groups:${accountId}`;
  if (runningSyncs.has(key)) return res.status(400).json({ error: 'Sync grup sedang berjalan untuk akun ini' });

  runningSyncs.add(key);
  res.json({ message: 'Sync grup dimulai di background. Cek hasil di /accounts/:id/groups beberapa saat lagi.' });

  discoverGroups(accountId)
    .catch((err) => console.error('[discovery] groups error:', err.message))
    .finally(() => runningSyncs.delete(key));
});

// Sync post IDs feed pakai browser headless.
router.post('/accounts/:id/sync-feed', (req, res) => {
  const accountId = req.params.id;
  if (!ownsAccount(accountId, req.userId)) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const key = `feed:${accountId}`;
  if (runningSyncs.has(key)) return res.status(400).json({ error: 'Sync feed sedang berjalan untuk akun ini' });

  runningSyncs.add(key);
  res.json({ message: 'Sync feed dimulai di background.' });

  discoverFeedPostIds(accountId, 30)
    .catch((err) => console.error('[discovery] feed error:', err.message))
    .finally(() => runningSyncs.delete(key));
});

// Ambil daftar grup tersimpan untuk akun.
router.get('/accounts/:id/stored-groups', (req, res) => {
  const accountId = req.params.id;
  if (!ownsAccount(accountId, req.userId)) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  res.json(getStoredGroups(accountId));
});

// Ambil daftar post feed tersimpan untuk akun.
router.get('/accounts/:id/stored-feed', (req, res) => {
  const accountId = req.params.id;
  if (!ownsAccount(accountId, req.userId)) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  res.json(getStoredFeedPostIds(accountId, parseInt(req.query.limit) || 30));
});

// Riwayat sync untuk akun.
router.get('/accounts/:id/discovery-runs', (req, res) => {
  const accountId = req.params.id;
  if (!ownsAccount(accountId, req.userId)) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  res.json(getRecentRuns(accountId, parseInt(req.query.limit) || 20));
});

// Status sync yang berjalan (untuk semua akun user).
router.get('/status', (req, res) => {
  const accounts = db.prepare('SELECT id FROM fb_accounts WHERE user_id = ?').all(req.userId);
  const status = {};
  for (const a of accounts) {
    status[a.id] = {
      groups: runningSyncs.has(`groups:${a.id}`),
      feed: runningSyncs.has(`feed:${a.id}`),
    };
  }
  res.json(status);
});

// Log per-URL untuk aksi like
router.get('/accounts/:id/like-logs', (req, res) => {
  const accountId = req.params.id;
  if (!ownsAccount(accountId, req.userId)) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  res.json(getRecentLikeLogs(accountId, parseInt(req.query.limit) || 30));
});

module.exports = router;
