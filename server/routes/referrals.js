const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/my', (req, res) => {
  const user = db.prepare('SELECT id, username, referral_code, is_reseller, reseller_margin, reseller_balance, reseller_commission_per_referral, expires_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  if (!user.referral_code) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, req.userId);
    user.referral_code = code;
  }

  const referrals = db.prepare(`
    SELECT r.id, r.bonus_days, r.commission_amount, r.created_at, u.username as referred_username
    FROM referrals r
    JOIN users u ON u.id = r.referred_id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
  `).all(req.userId);

  const totalBonusDays = referrals.reduce((s, r) => s + r.bonus_days, 0);
  const totalCommission = referrals.reduce((s, r) => s + (r.commission_amount || 0), 0);

  const withdrawals = db.prepare(`
    SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(req.userId);

  const pendingWithdrawal = withdrawals.find(w => w.status === 'pending');

  res.json({
    referral_code: user.referral_code,
    referral_link: `/register?ref=${user.referral_code}`,
    total_referrals: referrals.length,
    total_bonus_days: totalBonusDays,
    total_commission: totalCommission,
    is_reseller: user.is_reseller === 1,
    reseller_margin: user.reseller_margin || 30,
    reseller_balance: user.reseller_balance || 0,
    reseller_commission_per_referral: user.reseller_commission_per_referral || 50000,
    has_pending_withdrawal: !!pendingWithdrawal,
    referrals,
    withdrawals,
  });
});

router.post('/apply', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Kode referral diperlukan' });

  const referrer = db.prepare('SELECT id, username, expires_at, is_reseller, reseller_margin, reseller_commission_per_referral FROM users WHERE referral_code = ?').get(code.toUpperCase());
  if (!referrer) return res.status(404).json({ error: 'Kode referral tidak valid' });
  if (referrer.id === req.userId) return res.status(400).json({ error: 'Tidak bisa pakai kode referral sendiri' });

  const existing = db.prepare('SELECT id FROM referrals WHERE referred_id = ?').get(req.userId);
  if (existing) return res.status(400).json({ error: 'Kamu sudah pernah menggunakan kode referral' });

  const bonusDays = referrer.is_reseller ? (referrer.reseller_margin || 30) : 7;
  const commissionAmount = referrer.is_reseller ? (referrer.reseller_commission_per_referral || 50000) : 0;

  const newExpiry = referrer.expires_at
    ? new Date(new Date(referrer.expires_at).getTime() + bonusDays * 86400000).toISOString()
    : new Date(Date.now() + bonusDays * 86400000).toISOString();

  db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(newExpiry, referrer.id);

  if (commissionAmount > 0) {
    db.prepare('UPDATE users SET reseller_balance = reseller_balance + ? WHERE id = ?').run(commissionAmount, referrer.id);
  }

  db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, bonus_days, commission_amount) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), referrer.id, req.userId, bonusDays, commissionAmount);

  res.json({ message: `Kode referral berhasil! ${referrer.username} mendapat bonus ${bonusDays} hari${commissionAmount > 0 ? ` dan komisi Rp${commissionAmount.toLocaleString('id-ID')}` : ''}.` });
});

router.post('/withdraw', (req, res) => {
  const { amount, payment_method, payment_details, notes } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Jumlah withdraw tidak valid' });
  if (!payment_method) return res.status(400).json({ error: 'Metode pembayaran diperlukan' });
  if (!payment_details) return res.status(400).json({ error: 'Detail rekening diperlukan' });

  const user = db.prepare('SELECT is_reseller, reseller_balance FROM users WHERE id = ?').get(req.userId);
  if (!user?.is_reseller) return res.status(403).json({ error: 'Hanya reseller yang dapat melakukan withdrawal' });
  if ((user.reseller_balance || 0) < amount) return res.status(400).json({ error: 'Saldo tidak mencukupi' });

  const existing = db.prepare('SELECT id FROM withdrawals WHERE user_id = ? AND status = ?').get(req.userId, 'pending');
  if (existing) return res.status(400).json({ error: 'Kamu masih memiliki permintaan withdrawal yang sedang diproses' });

  const minWithdraw = 100000;
  if (amount < minWithdraw) return res.status(400).json({ error: `Minimum withdrawal Rp${minWithdraw.toLocaleString('id-ID')}` });

  db.prepare('UPDATE users SET reseller_balance = reseller_balance - ? WHERE id = ?').run(amount, req.userId);
  db.prepare('INSERT INTO withdrawals (id, user_id, amount, status, payment_method, payment_details, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), req.userId, amount, 'pending', payment_method, payment_details, notes || null);

  res.json({ message: 'Permintaan withdrawal berhasil dikirim. Admin akan memproses dalam 1-3 hari kerja.' });
});

router.get('/admin/all', (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const rows = db.prepare(`
    SELECT r.*, u1.username as referrer, u2.username as referred
    FROM referrals r
    JOIN users u1 ON u1.id = r.referrer_id
    JOIN users u2 ON u2.id = r.referred_id
    ORDER BY r.created_at DESC LIMIT 200
  `).all();
  res.json(rows);
});

router.get('/admin/resellers', (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const resellers = db.prepare(`
    SELECT u.id, u.username, u.is_reseller, u.reseller_margin, u.reseller_balance,
           u.reseller_commission_per_referral, u.expires_at,
           COUNT(r.id) as total_referrals,
           COALESCE(SUM(r.commission_amount), 0) as total_commission_earned
    FROM users u
    LEFT JOIN referrals r ON r.referrer_id = u.id
    WHERE u.is_reseller = 1
    GROUP BY u.id
    ORDER BY total_referrals DESC
  `).all();
  res.json(resellers);
});

router.get('/admin/all-users-reseller', (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const users = db.prepare(`
    SELECT id, username, is_reseller, reseller_margin, reseller_commission_per_referral, reseller_balance, expires_at
    FROM users WHERE role != 'admin' ORDER BY username ASC
  `).all();
  res.json(users);
});

router.post('/admin/set-reseller', (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const { user_id, is_reseller, margin, commission_per_referral } = req.body;
  db.prepare('UPDATE users SET is_reseller = ?, reseller_margin = ?, reseller_commission_per_referral = ? WHERE id = ?')
    .run(is_reseller ? 1 : 0, margin || 30, commission_per_referral || 50000, user_id);
  res.json({ message: 'Status reseller diperbarui' });
});

router.post('/admin/adjust-balance', (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const { user_id, amount, note } = req.body;
  if (!user_id || amount === undefined) return res.status(400).json({ error: 'Data tidak lengkap' });
  db.prepare('UPDATE users SET reseller_balance = reseller_balance + ? WHERE id = ?').run(amount, user_id);
  res.json({ message: `Saldo disesuaikan sebesar Rp${Math.abs(amount).toLocaleString('id-ID')}` });
});

router.get('/admin/withdrawals', (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const rows = db.prepare(`
    SELECT w.*, u.username
    FROM withdrawals w
    JOIN users u ON u.id = w.user_id
    ORDER BY
      CASE w.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      w.created_at DESC
    LIMIT 200
  `).all();
  res.json(rows);
});

router.put('/admin/withdrawals/:id', (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const { status, admin_notes } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status tidak valid' });

  const wd = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id);
  if (!wd) return res.status(404).json({ error: 'Withdrawal tidak ditemukan' });
  if (wd.status !== 'pending') return res.status(400).json({ error: 'Withdrawal sudah diproses' });

  if (status === 'rejected') {
    db.prepare('UPDATE users SET reseller_balance = reseller_balance + ? WHERE id = ?').run(wd.amount, wd.user_id);
  }

  db.prepare('UPDATE withdrawals SET status = ?, admin_notes = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, admin_notes || null, req.params.id);

  res.json({ message: `Withdrawal ${status === 'approved' ? 'disetujui' : 'ditolak'}` });
});

module.exports = router;
