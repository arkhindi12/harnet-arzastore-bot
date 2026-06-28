// Rate limiting middleware untuk mencegah abuse
const rateLimit = require('express-rate-limit');

// Login: max 10 percobaan per 15 menit per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip untuk localhost (development)
    const ip = req.ip || req.connection.remoteAddress;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
});

// Register: max 5 akun baru per jam per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak pendaftaran dari IP ini. Coba lagi dalam 1 jam.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI generate: max 60 request per menit per user (bukan per IP karena pakai auth)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Terlalu banyak request AI. Tunggu sebentar.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip, // per user kalau sudah auth
});

// General API: max 300 request per menit per IP (anti-scraping)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Terlalu banyak request. Tunggu sebentar.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip untuk static assets
    return req.path.startsWith('/assets/') || req.path.startsWith('/uploads/');
  },
});

module.exports = { loginLimiter, registerLimiter, aiLimiter, generalLimiter };
