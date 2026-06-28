// Routes Anti-Detection Dashboard
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { buildDashboard, checkProxyHealth } = require('../services/antiDetectionService');
const db = require('../db/database');

const router = express.Router();
router.use(authMiddleware);

// GET /api/anti-detection/dashboard?check_proxy=1
router.get('/dashboard', async (req, res) => {
  try {
    const data = await buildDashboard(req.userId, { checkProxy: req.query.check_proxy === '1' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Gagal membangun dashboard: ' + err.message });
  }
});

// POST /api/anti-detection/check-proxy { account_id }
router.post('/check-proxy', async (req, res) => {
  const { account_id } = req.body || {};
  if (!account_id) return res.status(400).json({ error: 'account_id wajib' });
  const acc = db.prepare('SELECT id, proxy FROM fb_accounts WHERE id = ? AND user_id = ?').get(account_id, req.userId);
  if (!acc) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const result = await checkProxyHealth(acc.proxy);
  res.json(result);
});

// POST /api/anti-detection/check-proxy-country { proxy_url }
router.post('/check-proxy-country', async (req, res) => {
  const { proxy_url } = req.body || {};
  if (!proxy_url) return res.status(400).json({ error: 'proxy_url wajib' });
  try {
    const { detectProxyCountry, getRiskLevel } = require('../services/proxyCountryService');
    const info = await detectProxyCountry(proxy_url);
    if (!info) return res.json({ detected: false, message: 'Tidak bisa detect country (proxy timeout atau format salah)' });
    const risk = getRiskLevel(info.code, 'ID');
    res.json({
      detected: true,
      country: info.country,
      code: info.code,
      city: info.city,
      isp: info.isp,
      is_datacenter: info.is_datacenter,
      risk_level: risk,
      message: risk === 'safe' ? 'Proxy dari Indonesia, aman!' : risk === 'low' ? `Proxy dari ${info.country} (Asia Tenggara), resiko rendah.` : `Proxy dari ${info.country}, resiko tinggi! Disarankan pakai proxy Indonesia.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
