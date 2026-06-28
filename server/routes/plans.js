const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const plans = db.prepare(`SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, price ASC`).all();
    res.json(plans.map(p => ({ ...p, features: JSON.parse(p.features || '[]'), is_popular: !!p.is_popular })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', adminMiddleware, (req, res) => {
  try {
    const plans = db.prepare(`SELECT * FROM subscription_plans ORDER BY sort_order ASC, price ASC`).all();
    res.json(plans.map(p => ({ ...p, features: JSON.parse(p.features || '[]'), is_popular: !!p.is_popular, is_active: !!p.is_active })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', adminMiddleware, (req, res) => {
  const { name, description, price, duration_days, max_accounts, max_campaigns, features, badge, is_popular, is_active, sort_order } = req.body;
  if (!name || !price || !duration_days) return res.status(400).json({ error: 'Nama, harga, dan durasi wajib diisi' });
  try {
    const id = uuidv4();
    db.prepare(`INSERT INTO subscription_plans (id, name, description, price, duration_days, max_accounts, max_campaigns, features, badge, is_popular, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, name, description || '', price, duration_days, max_accounts || 0, max_campaigns || 0, JSON.stringify(features || []), badge || '', is_popular ? 1 : 0, is_active !== false ? 1 : 0, sort_order || 0);
    res.json({ id, message: 'Plan berhasil dibuat' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', adminMiddleware, (req, res) => {
  const { name, description, price, duration_days, max_accounts, max_campaigns, features, badge, is_popular, is_active, sort_order } = req.body;
  try {
    db.prepare(`UPDATE subscription_plans SET name=?, description=?, price=?, duration_days=?, max_accounts=?, max_campaigns=?, features=?, badge=?, is_popular=?, is_active=?, sort_order=? WHERE id=?`)
      .run(name, description || '', price, duration_days, max_accounts || 0, max_campaigns || 0, JSON.stringify(features || []), badge || '', is_popular ? 1 : 0, is_active !== false ? 1 : 0, sort_order || 0, req.params.id);
    res.json({ message: 'Plan berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', adminMiddleware, (req, res) => {
  try {
    db.prepare('UPDATE subscription_plans SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Plan dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
