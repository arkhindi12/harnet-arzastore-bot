const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', registerLimiter, async (req, res) => {
  const { username, password, full_name, referral_code } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password diperlukan' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
    const role = userCount.cnt === 0 ? 'admin' : 'user';

    const hashed = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const refCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const trialEnd = role === 'admin' ? null : new Date(Date.now() + 3 * 86400000).toISOString();
    const isTrial = role === 'admin' ? 0 : 1;

    db.prepare('INSERT INTO users (id, username, password, role, full_name, is_active, referral_code, is_trial, trial_end) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)').run(id, username, hashed, role, full_name || null, refCode, isTrial, trialEnd);

    if (referral_code && role !== 'admin') {
      const referrer = db.prepare('SELECT id, expires_at FROM users WHERE referral_code = ?').get(referral_code.toUpperCase());
      if (referrer && referrer.id !== id) {
        const bonusDays = 7;
        const newExpiry = referrer.expires_at
          ? new Date(new Date(referrer.expires_at).getTime() + bonusDays * 86400000).toISOString()
          : new Date(Date.now() + bonusDays * 86400000).toISOString();
        db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(newExpiry, referrer.id);
        db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, bonus_days) VALUES (?, ?, ?, ?)').run(uuidv4(), referrer.id, id, bonusDays);
      }
    }

    const token = jwt.sign({ userId: id, role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username, id, role, is_trial: isTrial, trial_end: trialEnd });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mendaftar: ' + err.message });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password diperlukan' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' });
    }

    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return res.status(403).json({ error: `Masa aktif akun Anda telah berakhir pada ${new Date(user.expires_at).toLocaleDateString('id-ID')}. Hubungi administrator.` });
    }

    const role = user.role || 'user';
    const token = jwt.sign({ userId: user.id, role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username, id: user.id, role, expires_at: user.expires_at });
  } catch (err) {
    res.status(500).json({ error: 'Gagal login: ' + err.message });
  }
});

router.get('/me', require('../middleware/auth').authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, role, full_name, is_active, expires_at, referral_code, is_trial, trial_end, is_reseller, reseller_margin, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  const { getUserLimits } = require('../services/planLimits');
  const limits = getUserLimits(req.userId);

  // Hitung status subscription
  const now = new Date();
  let subscriptionStatus = 'expired';
  let daysLeft = 0;
  if (user.role === 'admin') {
    subscriptionStatus = 'admin';
  } else if (user.is_trial && user.trial_end && new Date(user.trial_end) > now) {
    subscriptionStatus = 'trial';
    daysLeft = Math.ceil((new Date(user.trial_end) - now) / 86400000);
  } else if (user.expires_at && new Date(user.expires_at) > now) {
    subscriptionStatus = 'active';
    daysLeft = Math.ceil((new Date(user.expires_at) - now) / 86400000);
  } else {
    // Cek pending payment
    const pending = db.prepare("SELECT id FROM payments WHERE user_id = ? AND status = 'pending' LIMIT 1").get(req.userId);
    if (pending) subscriptionStatus = 'payment_pending';
  }

  res.json({
    ...user,
    role: user.role || 'user',
    subscription_status: subscriptionStatus,
    days_left: daysLeft,
    limits: limits || null,
  });
});

// Register + auto-generate password + create payment (untuk checkout dari landing)
router.post('/register-and-pay', async (req, res) => {
  const { username, email, phone, plan_id, referral_code } = req.body;
  if (!username || !email || !phone) {
    return res.status(400).json({ error: 'Username, email, dan nomor HP wajib diisi' });
  }
  if (!plan_id) {
    return res.status(400).json({ error: 'Plan ID wajib dipilih' });
  }
  if (username.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });
  if (phone.length < 8) return res.status(400).json({ error: 'Nomor HP minimal 8 digit' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username sudah digunakan. Coba username lain.' });

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) return res.status(400).json({ error: 'Email sudah terdaftar. Silakan login.' });

    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1').get(plan_id);
    if (!plan) return res.status(404).json({ error: 'Plan tidak ditemukan' });

    // Auto-generate password 8 karakter
    const rawPassword = crypto.randomBytes(4).toString('hex'); // 8 char hex
    const hashed = await bcrypt.hash(rawPassword, 10);
    const id = uuidv4();
    const refCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    db.prepare('INSERT INTO users (id, username, password, email, phone, role, full_name, is_active, referral_code, is_trial, trial_end) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, NULL)')
      .run(id, username, hashed, email, phone, 'user', username, refCode);

    // Handle referral
    if (referral_code) {
      const referrer = db.prepare('SELECT id, expires_at FROM users WHERE referral_code = ?').get(referral_code.toUpperCase());
      if (referrer && referrer.id !== id) {
        const bonusDays = 7;
        const newExpiry = referrer.expires_at
          ? new Date(new Date(referrer.expires_at).getTime() + bonusDays * 86400000).toISOString()
          : new Date(Date.now() + bonusDays * 86400000).toISOString();
        db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(newExpiry, referrer.id);
        db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, bonus_days) VALUES (?, ?, ?, ?)').run(uuidv4(), referrer.id, id, bonusDays);
      }
    }

    // Generate kode unik + buat payment
    const uniqueCode = Math.floor(Math.random() * 900) + 100;
    const totalAmount = plan.price + uniqueCode;
    const orderId = `ARZ-${Date.now()}-${id.slice(0,6).toUpperCase()}`;
    const payId = uuidv4();

    // Cek apakah pakai midtrans atau manual
    const paySettings = {};
    db.prepare('SELECT key, value FROM payment_settings').all().forEach(r => { paySettings[r.key] = r.value; });

    const useMidtrans = !!paySettings.midtrans_server_key;

    if (useMidtrans) {
      try {
        const midtransClient = require('midtrans-client');
        const snap = new midtransClient.Snap({
          isProduction: paySettings.midtrans_is_production === '1',
          serverKey: paySettings.midtrans_server_key,
          clientKey: paySettings.midtrans_client_key,
        });
        const transaction = await snap.createTransaction({
          transaction_details: { order_id: orderId, gross_amount: totalAmount },
          customer_details: { first_name: username, email, phone },
          item_details: [
            { id: plan.id, price: plan.price, quantity: 1, name: `${plan.name} - ${plan.duration_days} Hari` },
            { id: 'unique_code', price: uniqueCode, quantity: 1, name: 'Kode Unik' },
          ],
        });
        db.prepare('INSERT INTO payments (id, user_id, plan_id, order_id, amount, status, snap_token, snap_redirect_url) VALUES (?, ?, ?, ?, ?, \'pending\', ?, ?)')
          .run(payId, id, plan_id, orderId, totalAmount, transaction.token, transaction.redirect_url);

        const token = jwt.sign({ userId: id, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({
          success: true,
          method: 'midtrans',
          token, username, user_id: id,
          password: rawPassword,
          snap_token: transaction.token,
          snap_redirect_url: transaction.redirect_url,
          order_id: orderId,
          amount: totalAmount,
          unique_code: uniqueCode,
        });
      } catch (midErr) {
        // Fallback ke manual kalau midtrans error
      }
    }

    // Manual payment
    db.prepare("INSERT INTO payments (id, user_id, plan_id, order_id, amount, status, payment_type) VALUES (?, ?, ?, ?, ?, 'pending', 'manual')")
      .run(payId, id, plan_id, orderId, totalAmount);

    const token = jwt.sign({ userId: id, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });

    const manualInfo = {
      success: true,
      method: 'manual',
      token, username, user_id: id,
      password: rawPassword,
      order_id: orderId,
      plan_name: plan.name,
      plan_price: plan.price,
      unique_code: uniqueCode,
      total_amount: totalAmount,
      qris_image_url: paySettings.qris_image_url || null,
      qris_name: paySettings.qris_name || null,
      banks: [],
    };
    if (paySettings.bank_name && paySettings.bank_account_number) {
      manualInfo.banks.push({ bank: paySettings.bank_name, number: paySettings.bank_account_number, name: paySettings.bank_account_name });
    }
    if (paySettings.bank_name_2 && paySettings.bank_account_number_2) {
      manualInfo.banks.push({ bank: paySettings.bank_name_2, number: paySettings.bank_account_number_2, name: paySettings.bank_account_name_2 });
    }
    res.json(manualInfo);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mendaftar: ' + err.message });
  }
});

module.exports = router;
