const express = require('express');
const router = express.Router();
const { rotateCookies, addToPool, removeFromPool, listPool } = require('../services/cookieRotationService');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// GET /api/cookie-rotation/:accountId — list pool
router.get('/:accountId', (req, res) => {
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.accountId, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  res.json({ pool: listPool(req.params.accountId) });
});

// POST /api/cookie-rotation/:accountId/add — tambah slot ke pool
router.post('/:accountId/add', (req, res) => {
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.accountId, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const { cookies, label } = req.body;
  if (!cookies) return res.status(400).json({ error: 'cookies wajib diisi' });
  const r = addToPool(req.params.accountId, cookies, label);
  res.json(r);
});

// DELETE /api/cookie-rotation/:accountId/:slotId — hapus slot
router.delete('/:accountId/:slotId', (req, res) => {
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.accountId, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const r = removeFromPool(req.params.accountId, req.params.slotId);
  res.json(r);
});

// POST /api/cookie-rotation/:accountId/rotate — manual rotate
router.post('/:accountId/rotate', async (req, res) => {
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.accountId, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const r = await rotateCookies(req.params.accountId);
  res.json(r);
});

module.exports = router;
