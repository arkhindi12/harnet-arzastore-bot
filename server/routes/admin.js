const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { adminMiddleware } = require('../middleware/auth');
const { deleteUserCascade } = require('../services/cascadeDelete');

const router = express.Router();

router.get('/stats', adminMiddleware, (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as cnt FROM users").get().cnt;
    const activeUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE is_active = 1").get().cnt;
    const expiredUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE expires_at IS NOT NULL AND expires_at < datetime('now')").get().cnt;
    const totalAccounts = db.prepare("SELECT COUNT(*) as cnt FROM fb_accounts").get().cnt;
    const activeAccounts = db.prepare("SELECT COUNT(*) as cnt FROM fb_accounts WHERE status = 'active'").get().cnt;
    const totalCampaigns = db.prepare("SELECT COUNT(*) as cnt FROM campaigns").get().cnt;
    const runningCampaigns = db.prepare("SELECT COUNT(*) as cnt FROM campaigns WHERE status = 'running'").get().cnt;
    const totalComments = db.prepare("SELECT COUNT(*) as cnt FROM comment_logs WHERE status = 'success'").get().cnt;

    res.json({
      totalUsers, activeUsers, expiredUsers,
      totalAccounts, activeAccounts,
      totalCampaigns, runningCampaigns,
      totalComments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', adminMiddleware, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.expires_at, u.created_at, u.notes,
        (SELECT COUNT(*) FROM fb_accounts WHERE user_id = u.id) as account_count,
        (SELECT COUNT(*) FROM campaigns WHERE user_id = u.id) as campaign_count,
        (SELECT COUNT(*) FROM comment_logs cl JOIN campaigns c ON cl.campaign_id = c.id WHERE c.user_id = u.id AND cl.status = 'success') as total_comments,
        (SELECT MAX(cl.created_at) FROM comment_logs cl JOIN campaigns c ON cl.campaign_id = c.id WHERE c.user_id = u.id) as last_active
      FROM users u
      ORDER BY u.created_at DESC
    `).all();
    res.json(users.map(u => ({ ...u, is_active: u.is_active !== 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', adminMiddleware, async (req, res) => {
  const { username, password, full_name, role, expires_at, notes, is_active } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password diperlukan' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username sudah digunakan' });

    const hashed = await bcrypt.hash(password, 10);
    const id = uuidv4();
    db.prepare(`INSERT INTO users (id, username, password, full_name, role, is_active, expires_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, username, hashed, full_name || null, role || 'user', is_active !== false ? 1 : 0, expires_at || null, notes || null);

    res.json({ id, username, full_name, role: role || 'user', is_active: is_active !== false, expires_at: expires_at || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { username, password, full_name, role, expires_at, notes, is_active } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (username && username !== user.username) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
      if (existing) return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    let hashedPass = user.password;
    if (password && password.length >= 6) {
      hashedPass = await bcrypt.hash(password, 10);
    }

    db.prepare(`UPDATE users SET
      username = ?, password = ?, full_name = ?, role = ?,
      is_active = ?, expires_at = ?, notes = ?
      WHERE id = ?`).run(
      username || user.username,
      hashedPass,
      full_name !== undefined ? full_name : user.full_name,
      role || user.role,
      is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
      expires_at !== undefined ? (expires_at || null) : user.expires_at,
      notes !== undefined ? notes : user.notes,
      id
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', adminMiddleware, (req, res) => {
  const { id } = req.params;
  try {
    if (req.userId === id) return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    deleteUserCascade(id);
    res.json({ success: true, message: 'User dan semua data terkait berhasil dihapus' });
  } catch (err) {
    console.error('[admin.deleteUser] gagal:', err);
    res.status(500).json({ error: 'Gagal menghapus user: ' + err.message });
  }
});

router.post('/users/:id/toggle', adminMiddleware, (req, res) => {
  const { id } = req.params;
  try {
    if (req.userId === id) return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri' });
    const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    const newStatus = user.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, id);
    res.json({ is_active: newStatus === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/seo', adminMiddleware, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM site_seo').all();
    const seo = {};
    rows.forEach(r => { seo[r.key] = r.value; });
    res.json(seo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/seo', adminMiddleware, (req, res) => {
  try {
    const update = db.prepare('INSERT OR REPLACE INTO site_seo (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const allowed = [
      'site_title','site_name','meta_description','meta_keywords','meta_author','meta_robots',
      'og_title','og_description','og_image','og_url','og_type','og_site_name',
      'twitter_card','twitter_title','twitter_description','twitter_image','twitter_site',
      'canonical_url','theme_color','favicon_url',
      'brand_name','brand_tagline','brand_logo_url','brand_icon_url','brand_primary_color','brand_logo_size',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update.run(key, req.body[key] || '');
      }
    }
    res.json({ message: 'Pengaturan SEO berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// System Config (server settings editable dari admin)
router.get('/system-config', adminMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value, label, description, updated_at FROM system_config ORDER BY key').all();
  res.json(rows);
});

router.put('/system-config', adminMiddleware, (req, res) => {
  const { invalidateCache } = require('../services/systemConfig');
  const update = db.prepare('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
  const allowed = ['browser_max_concurrent', 'browser_engine', 'browser_headless', 'discovery_auto_sync', 'discovery_resync_hours', 'autojoin_enabled', 'autojoin_tick_seconds', 'proxy_recommendation'];
  let changed = 0;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      update.run(String(req.body[key]), key);
      changed++;
    }
  }
  invalidateCache();
  res.json({ message: `${changed} config berhasil disimpan. Beberapa perubahan berlaku setelah restart scheduler.` });
});

// GET /api/admin/health — system health check
router.get('/health', adminMiddleware, (req, res) => {
  try {
    const { getStatus } = require('../services/browserQueue');
    const browserStatus = getStatus();

    // Akun bermasalah
    const problemAccounts = db.prepare(`
      SELECT name, status, user_id FROM fb_accounts
      WHERE status IN ('expired', 'checkpoint', 'locked', 'invalid', 'problematic')
    `).all();

    // Scheduler status
    const autoJoinJobs = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(status='running') as running,
        SUM(status='paused') as paused,
        SUM(status='failed') as failed
      FROM auto_join_jobs
    `).get();

    const campaigns = db.prepare(`
      SELECT COUNT(*) as total, SUM(status='running') as running
      FROM campaigns
    `).get();

    const warmingPlans = db.prepare(`
      SELECT COUNT(*) as total, SUM(status='running') as running, SUM(status='idle') as idle
      FROM warming_plans
    `).get();

    // Recent errors (last 1 hour)
    const recentErrors = db.prepare(`
      SELECT COUNT(*) as cnt FROM scheduler_logs
      WHERE status = 'failed' AND created_at > datetime('now', '-1 hour')
    `).get().cnt;

    // DB size
    const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get()?.size || 0;

    // Memory usage
    const memUsage = process.memoryUsage();

    res.json({
      status: problemAccounts.length > 0 || recentErrors > 10 ? 'warning' : 'ok',
      timestamp: new Date().toISOString(),
      browser: browserStatus,
      accounts: {
        problem_count: problemAccounts.length,
        problems: problemAccounts.map(a => ({ name: a.name, status: a.status })),
      },
      schedulers: {
        auto_join: autoJoinJobs,
        campaigns,
        warming: warmingPlans,
      },
      errors_last_hour: recentErrors,
      database: {
        size_mb: (dbSize / 1024 / 1024).toFixed(2),
      },
      memory: {
        heap_used_mb: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
        heap_total_mb: (memUsage.heapTotal / 1024 / 1024).toFixed(1),
        rss_mb: (memUsage.rss / 1024 / 1024).toFixed(1),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/alert-test — test Telegram alert ke admin
router.post('/alert-test', adminMiddleware, async (req, res) => {
  try {
    const { sendTelegram } = require('../services/telegramService');
    await sendTelegram(req.userId,
      `🔔 <b>Test Alert Admin ArzaBot</b>\n\nSistem monitoring aktif. Kamu akan menerima alert saat ada masalah.\n⏰ ${new Date().toLocaleString('id-ID')}`
    );
    res.json({ message: 'Alert test dikirim ke Telegram kamu' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/backups — list semua backup DB
router.get('/backups', adminMiddleware, (req, res) => {
  try {
    const { listBackups } = require('../services/dbBackup');
    res.json({ backups: listBackups() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/backups/run — trigger backup manual sekarang
router.post('/backups/run', adminMiddleware, async (req, res) => {
  try {
    const { runBackup } = require('../services/dbBackup');
    const result = await runBackup();
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ message: 'Backup berhasil', ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
