const express = require('express');
const { v4: uuidv4 } = require('uuid');
const midtransClient = require('midtrans-client');
const db = require('../db/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

function getPaySettings() {
  const rows = db.prepare('SELECT key, value FROM payment_settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

function createSnap(settings) {
  return new midtransClient.Snap({
    isProduction: settings.midtrans_is_production === '1',
    serverKey: settings.midtrans_server_key,
    clientKey: settings.midtrans_client_key,
  });
}

router.get('/settings', adminMiddleware, (req, res) => {
  const s = getPaySettings();
  res.json({
    ...s,
    midtrans_server_key: s.midtrans_server_key ? '***' + s.midtrans_server_key.slice(-6) : '',
    midtrans_client_key: s.midtrans_client_key || '',
    _has_server_key: !!s.midtrans_server_key,
  });
});

router.put('/settings', adminMiddleware, (req, res) => {
  try {
    const allowed = ['midtrans_server_key', 'midtrans_client_key', 'midtrans_is_production', 'payment_enabled',
      'manual_payment_enabled', 'qris_image_url', 'qris_name',
      'bank_name', 'bank_account_number', 'bank_account_name',
      'bank_name_2', 'bank_account_number_2', 'bank_account_name_2',
    ];
    const current = getPaySettings();
    const update = db.prepare('INSERT OR REPLACE INTO payment_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        let val = req.body[key];
        if (key === 'midtrans_server_key' && val.startsWith('***')) {
          val = current.midtrans_server_key || '';
        }
        update.run(key, String(val));
      }
    }
    res.json({ message: 'Pengaturan pembayaran berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/create', authMiddleware, async (req, res) => {
  const { plan_id, method } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'Plan ID diperlukan' });

  try {
    const settings = getPaySettings();
    if (settings.payment_enabled !== '1') return res.status(400).json({ error: 'Pembayaran sedang dinonaktifkan.' });

    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1').get(plan_id);
    if (!plan) return res.status(404).json({ error: 'Plan tidak ditemukan' });

    const user = db.prepare('SELECT id, username, full_name FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    // Generate kode unik 3 digit (100-999)
    const uniqueCode = Math.floor(Math.random() * 900) + 100;
    const totalAmount = plan.price + uniqueCode;
    const orderId = `ARZ-${Date.now()}-${user.id.slice(0,6).toUpperCase()}`;
    const payId = uuidv4();

    // Jika method = 'manual' ATAU midtrans tidak dikonfigurasi → pembayaran manual
    const useMidtrans = method !== 'manual' && !!settings.midtrans_server_key;

    if (useMidtrans) {
      const snap = createSnap(settings);
      const parameter = {
        transaction_details: { order_id: orderId, gross_amount: totalAmount },
        credit_card: { secure: true },
        customer_details: { first_name: user.full_name || user.username, email: `${user.username}@arzabot.user` },
        item_details: [
          { id: plan.id, price: plan.price, quantity: 1, name: `${plan.name} - ${plan.duration_days} Hari` },
          { id: 'unique_code', price: uniqueCode, quantity: 1, name: `Kode Unik` },
        ],
        callbacks: {
          finish: `${req.headers.origin || ''}/payment/finish`,
          error: `${req.headers.origin || ''}/payment/error`,
          pending: `${req.headers.origin || ''}/payment/pending`,
        },
      };
      const transaction = await snap.createTransaction(parameter);
      db.prepare(`INSERT INTO payments (id, user_id, plan_id, order_id, amount, status, snap_token, snap_redirect_url)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .run(payId, req.userId, plan_id, orderId, totalAmount, transaction.token, transaction.redirect_url);
      return res.json({
        method: 'midtrans',
        snap_token: transaction.token,
        snap_redirect_url: transaction.redirect_url,
        order_id: orderId,
        amount: totalAmount,
        unique_code: uniqueCode,
        client_key: settings.midtrans_client_key,
        is_production: settings.midtrans_is_production === '1',
      });
    }

    // Manual payment (QRIS / Bank Transfer)
    if (settings.manual_payment_enabled !== '1') return res.status(400).json({ error: 'Pembayaran manual belum diaktifkan admin.' });

    db.prepare(`INSERT INTO payments (id, user_id, plan_id, order_id, amount, status, payment_type)
      VALUES (?, ?, ?, ?, ?, 'pending', 'manual')`)
      .run(payId, req.userId, plan_id, orderId, totalAmount);

    // Kumpulkan info pembayaran manual
    const manualInfo = {
      method: 'manual',
      order_id: orderId,
      plan_name: plan.name,
      plan_price: plan.price,
      unique_code: uniqueCode,
      total_amount: totalAmount,
      qris_image_url: settings.qris_image_url || null,
      qris_name: settings.qris_name || null,
      banks: [],
    };
    if (settings.bank_name && settings.bank_account_number) {
      manualInfo.banks.push({ bank: settings.bank_name, number: settings.bank_account_number, name: settings.bank_account_name });
    }
    if (settings.bank_name_2 && settings.bank_account_number_2) {
      manualInfo.banks.push({ bank: settings.bank_name_2, number: settings.bank_account_number_2, name: settings.bank_account_name_2 });
    }
    res.json(manualInfo);
  } catch (err) {
    res.status(500).json({ error: 'Gagal membuat transaksi: ' + err.message });
  }
});

router.post('/notification', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const settings = getPaySettings();
    const snap = createSnap(settings);
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    const notification = await snap.transaction.notification(body);

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
    if (!payment) return res.status(404).json({ error: 'Order not found' });

    let newStatus = 'pending';
    if (transactionStatus === 'capture') {
      newStatus = fraudStatus === 'challenge' ? 'pending' : 'paid';
    } else if (transactionStatus === 'settlement') {
      newStatus = 'paid';
    } else if (['cancel', 'deny', 'failure'].includes(transactionStatus)) {
      newStatus = 'failed';
    } else if (transactionStatus === 'expire') {
      newStatus = 'expired';
    }

    db.prepare('UPDATE payments SET status=?, payment_type=?, midtrans_transaction_id=?, paid_at=CASE WHEN ? = ? THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE order_id=?')
      .run(newStatus, notification.payment_type || '', notification.transaction_id || '', newStatus, 'paid', orderId);

    if (newStatus === 'paid') {
      const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(payment.plan_id);
      if (plan) {
        const user = db.prepare('SELECT expires_at FROM users WHERE id = ?').get(payment.user_id);
        const baseDate = user?.expires_at && new Date(user.expires_at) > new Date() ? new Date(user.expires_at) : new Date();
        const newExpiry = new Date(baseDate.getTime() + plan.duration_days * 86400000);
        db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(newExpiry.toISOString(), payment.user_id);
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', authMiddleware, (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, sp.name as plan_name, sp.duration_days, sp.price as plan_price
      FROM payments p
      LEFT JOIN subscription_plans sp ON p.plan_id = sp.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 20
    `).all(req.userId);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ambil pending payment terakhir + info pembayaran manual (tanpa subscription check)
router.get('/my-pending', authMiddleware, (req, res) => {
  try {
    const payment = db.prepare(`
      SELECT p.*, sp.name as plan_name, sp.duration_days, sp.price as plan_price
      FROM payments p
      LEFT JOIN subscription_plans sp ON p.plan_id = sp.id
      WHERE p.user_id = ? AND p.status = 'pending'
      ORDER BY p.created_at DESC LIMIT 1
    `).get(req.userId);
    if (!payment) return res.json({ has_pending: false });

    const settings = getPaySettings();
    const banks = [];
    if (settings.bank_name && settings.bank_account_number) banks.push({ bank: settings.bank_name, number: settings.bank_account_number, name: settings.bank_account_name });
    if (settings.bank_name_2 && settings.bank_account_number_2) banks.push({ bank: settings.bank_name_2, number: settings.bank_account_number_2, name: settings.bank_account_name_2 });

    // Hitung kode unik dari amount - plan_price
    const uniqueCode = payment.amount - (payment.plan_price || 0);

    res.json({
      has_pending: true,
      order_id: payment.order_id,
      plan_name: payment.plan_name,
      plan_price: payment.plan_price,
      unique_code: uniqueCode > 0 ? uniqueCode : 0,
      total_amount: payment.amount,
      qris_image_url: settings.qris_image_url || null,
      qris_name: settings.qris_name || null,
      banks,
      created_at: payment.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/all', adminMiddleware, (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, u.username, u.full_name, sp.name as plan_name, sp.duration_days
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN subscription_plans sp ON p.plan_id = sp.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: konfirmasi pembayaran manual
router.post('/confirm/:orderId', adminMiddleware, (req, res) => {
  try {
    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(req.params.orderId);
    if (!payment) return res.status(404).json({ error: 'Pembayaran tidak ditemukan' });
    if (payment.status === 'paid') return res.json({ message: 'Sudah dikonfirmasi sebelumnya' });

    db.prepare("UPDATE payments SET status = 'paid', payment_type = COALESCE(payment_type, 'manual'), paid_at = CURRENT_TIMESTAMP WHERE order_id = ?").run(req.params.orderId);

    // Aktifkan langganan user
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(payment.plan_id);
    if (plan) {
      const user = db.prepare('SELECT expires_at FROM users WHERE id = ?').get(payment.user_id);
      const baseDate = user?.expires_at && new Date(user.expires_at) > new Date() ? new Date(user.expires_at) : new Date();
      const newExpiry = new Date(baseDate.getTime() + plan.duration_days * 86400000);
      db.prepare('UPDATE users SET expires_at = ?, is_trial = 0 WHERE id = ?').run(newExpiry.toISOString(), payment.user_id);
    }

    res.json({ message: 'Pembayaran dikonfirmasi. Langganan user aktif.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify/:orderId', authMiddleware, async (req, res) => {
  try {
    const settings = getPaySettings();
    if (!settings.midtrans_server_key) return res.status(400).json({ error: 'Gateway belum dikonfigurasi' });

    const snap = createSnap(settings);
    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').get(req.params.orderId, req.userId);
    if (!payment) return res.status(404).json({ error: 'Pembayaran tidak ditemukan' });

    if (payment.status === 'paid') return res.json({ status: 'paid', payment });

    const statusRes = await snap.transaction.status(req.params.orderId);
    let newStatus = payment.status;
    if (['capture', 'settlement'].includes(statusRes.transaction_status)) newStatus = 'paid';
    else if (['cancel', 'deny', 'failure'].includes(statusRes.transaction_status)) newStatus = 'failed';
    else if (statusRes.transaction_status === 'expire') newStatus = 'expired';

    if (newStatus !== payment.status) {
      db.prepare('UPDATE payments SET status=?, payment_type=? WHERE order_id=?').run(newStatus, statusRes.payment_type || '', req.params.orderId);
      if (newStatus === 'paid') {
        const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(payment.plan_id);
        if (plan) {
          const user = db.prepare('SELECT expires_at FROM users WHERE id = ?').get(req.userId);
          const baseDate = user?.expires_at && new Date(user.expires_at) > new Date() ? new Date(user.expires_at) : new Date();
          const newExpiry = new Date(baseDate.getTime() + plan.duration_days * 86400000);
          db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(newExpiry.toISOString(), req.userId);
        }
      }
    }
    res.json({ status: newStatus, payment: { ...payment, status: newStatus } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload bukti pembayaran
router.post('/upload-proof', authMiddleware, (req, res) => {
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  const { v4: uid } = require('uuid');

  const UPLOAD_DIR = path.join(__dirname, '../../data/uploads');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (r, f, cb) => cb(null, UPLOAD_DIR),
    filename: (r, f, cb) => { const ext = path.extname(f.originalname).toLowerCase() || '.jpg'; cb(null, `proof_${uid()}${ext}`); },
  });
  const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (r, f, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    cb(null, allowed.includes(path.extname(f.originalname).toLowerCase()));
  }});

  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Gagal upload' });
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id wajib' });

    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').get(order_id, req.userId);
    if (!payment) return res.status(404).json({ error: 'Pembayaran tidak ditemukan' });

    const proofUrl = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE payments SET payment_proof_url = ? WHERE order_id = ?').run(proofUrl, order_id);

    res.json({ success: true, proof_url: proofUrl, message: 'Bukti pembayaran berhasil diupload. Admin akan mengkonfirmasi.' });
  });
});

module.exports = router;
