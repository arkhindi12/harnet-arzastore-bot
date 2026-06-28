const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'fb-auto-comment-secret-key-2024';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role || 'user';
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak. Hanya admin.' });
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
}

// Middleware cek langganan aktif (trial atau paid)
function subscriptionMiddleware(req, res, next) {
  // Admin selalu lewat
  if (req.userRole === 'admin') return next();

  const user = db.prepare('SELECT is_trial, trial_end, expires_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(403).json({ error: 'User tidak ditemukan', code: 'NO_USER' });

  const now = new Date();

  // Trial aktif
  if (user.is_trial && user.trial_end && new Date(user.trial_end) > now) {
    req.subscriptionStatus = 'trial';
    return next();
  }

  // Langganan aktif
  if (user.expires_at && new Date(user.expires_at) > now) {
    req.subscriptionStatus = 'active';
    return next();
  }

  // Cek apakah ada payment pending (baru daftar, belum bayar)
  const pendingPayment = db.prepare("SELECT id FROM payments WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").get(req.userId);
  if (pendingPayment) {
    return res.status(403).json({
      error: 'Langganan belum aktif. Selesaikan pembayaran terlebih dahulu.',
      code: 'PAYMENT_PENDING',
    });
  }

  return res.status(403).json({
    error: 'Langganan sudah habis. Perpanjang langganan untuk melanjutkan.',
    code: 'SUBSCRIPTION_EXPIRED',
  });
}

module.exports = { authMiddleware, adminMiddleware, subscriptionMiddleware, JWT_SECRET };
