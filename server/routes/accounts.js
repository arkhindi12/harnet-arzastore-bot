const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { validateAccount, diagnoseAccount } = require('../services/facebookService');
const { testAccountLive } = require('../services/accountTester');
const { setAccountStatus } = require('../services/accountStatusService');
const { friendlyError } = require('../middleware/friendlyError');
const { fetchUserGroups, fetchUserGroupsSmart } = require('../services/groupFetcher');
const { fetchManagedPages } = require('../services/pageFetcher');
const { applyFatiguePolicy } = require('../services/fatigueService');
const { checkAccountLimit } = require('../services/planLimits');
const { deleteAccountCascade } = require('../services/cascadeDelete');

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

function maskProxy(proxy) {
  if (!proxy) return null;
  try {
    const url = new URL(proxy);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return proxy.replace(/:([^@]+)@/, ':***@');
  }
}

router.get('/', (req, res) => {
  const accounts = db.prepare('SELECT id, name, status, proxy, proxy_pool, dead_proxies, user_agent, persona, fatigue_score, fatigue_level, fatigue_updated_at, cooldown_until, last_used, created_at FROM fb_accounts WHERE user_id = ?').all(req.userId);
  res.json(accounts.map(a => ({ ...a, proxy_masked: maskProxy(a.proxy), proxy: a.proxy ? true : false })));
});

router.post('/', async (req, res) => {
  const { name, cookies, proxy, user_agent, persona, browser_engine } = req.body;
  if (!name || !cookies) {
    return res.status(400).json({ error: 'Nama dan cookies diperlukan' });
  }

  // Cek limit akun
  const limitCheck = checkAccountLimit(req.userId);
  if (!limitCheck.allowed) {
    return res.status(403).json({ error: limitCheck.error, code: 'ACCOUNT_LIMIT_REACHED' });
  }

  try {
    const validation = await validateAccount(cookies, proxy || null, user_agent || null);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Cookies tidak valid atau sudah expired', detail: validation.error });
    }

    const id = uuidv4();
    const displayName = name || validation.name || 'Akun Facebook';
    db.prepare('INSERT INTO fb_accounts (id, user_id, name, cookies, status, proxy, user_agent, persona, browser_engine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.userId, displayName, cookies, 'active', proxy || null, user_agent || null, persona || 'natural', browser_engine || 'patchright');

    res.json({ id, name: displayName, status: 'active', message: 'Akun berhasil ditambahkan', fbName: validation.name });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambahkan akun: ' + err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, cookies, proxy, user_agent, persona, browser_engine } = req.body;
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });

  if (cookies) {
    const ua = user_agent !== undefined ? (user_agent || null) : account.user_agent;
    const validation = await validateAccount(cookies, proxy !== undefined ? (proxy || null) : account.proxy, ua);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Cookies tidak valid', detail: validation.error });
    }
    db.prepare('UPDATE fb_accounts SET name = ?, cookies = ?, status = ?, proxy = ?, user_agent = ?, persona = ?, browser_engine = ?, last_used = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name || account.name, cookies, 'active', proxy !== undefined ? (proxy || null) : account.proxy, ua, persona || account.persona || 'natural', req.params.id);
  } else {
    const updates = [];
    const vals = [];
    if (name) { updates.push('name = ?'); vals.push(name); }
    if (proxy !== undefined) { updates.push('proxy = ?'); vals.push(proxy || null); }
    if (user_agent !== undefined) { updates.push('user_agent = ?'); vals.push(user_agent || null); }
    if (persona !== undefined) { updates.push('persona = ?'); vals.push(persona || 'natural'); }
    if (req.body.proxy_pool !== undefined) { updates.push('proxy_pool = ?'); vals.push(JSON.stringify(req.body.proxy_pool || [])); }
    if (req.body.proxy_source !== undefined) { updates.push('proxy_source = ?'); vals.push(req.body.proxy_source || 'manual'); }
    if (req.body.proxy_country !== undefined) { updates.push('proxy_country = ?'); vals.push(req.body.proxy_country || null); }
    if (updates.length) {
      vals.push(req.params.id);
      db.prepare(`UPDATE fb_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    }
  }

  res.json({ message: 'Akun berhasil diperbarui' });
});

router.delete('/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });

  try {
    deleteAccountCascade(req.params.id);
    res.json({ message: 'Akun berhasil dihapus' });
  } catch (err) {
    console.error('[accounts.delete] gagal hapus akun:', err);
    res.status(500).json({ error: 'Gagal menghapus akun: ' + err.message });
  }
});

router.get('/:id/pages', async (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  if (account.status !== 'active') return res.status(400).json({ error: `Akun berstatus "${account.status}"`, pages: [] });
  try {
    // SAFE MODE default: hindari fetch live ke /pages karena bisa memicu checkpoint.
    // Ambil dulu dari data historis (capability + task config).
    const forceLive = String(req.query.force || '0') === '1';

    const pageSet = new Set();
    const pages = [];
    const addPage = (name, id = '') => {
      const n = String(name || '').trim();
      if (!n) return;
      const key = n.toLowerCase();
      if (pageSet.has(key)) return;
      pageSet.add(key);
      pages.push({ id, name: n, source: 'cached' });
    };

    // 1) Dari capability map
    const capRows = db.prepare(`
      SELECT page_name, MAX(last_tested_at) as last_seen
      FROM page_group_capability
      WHERE account_id = ? AND user_id = ?
      GROUP BY page_name
      ORDER BY last_seen DESC
      LIMIT 50
    `).all(req.params.id, req.userId);
    capRows.forEach(r => addPage(r.page_name));

    // 2) Dari post_tasks config (share_as page)
    const taskRows = db.prepare(`
      SELECT config FROM post_tasks
      WHERE user_id = ? AND type = 'share_post'
      ORDER BY created_at DESC
      LIMIT 100
    `).all(req.userId);
    for (const t of taskRows) {
      try {
        const cfg = JSON.parse(t.config || '{}');
        if ((cfg.share_as || 'self') === 'page' && cfg.page_name) addPage(cfg.page_name);
      } catch {}
    }

    // 3) Kalau user minta force live ATAU cache kosong, fetch live dari Facebook
    if (forceLive || pages.length === 0) {
      const live = await fetchManagedPages(account.cookies, account.proxy, account);
      (live || []).forEach(p => {
        if (typeof p === 'string') addPage(p);
        else addPage(p.name, p.id || '');
      });
      return res.json({ pages, success: true, source: forceLive ? 'cached+live(force)' : 'cached+live(auto)' });
    }

    return res.json({ pages, success: true, source: 'cached_only' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal memuat halaman: ' + err.message, pages: [] });
  }
});

// GET /api/accounts/:id/page-capability?page_name=...
router.get('/:id/page-capability', (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });

  const pageName = (req.query.page_name || '').trim();
  if (!pageName) return res.status(400).json({ error: 'page_name wajib diisi' });

  const rows = db.prepare(`
    SELECT page_name, group_url, share_success_count, share_fail_count, last_status, last_error, last_tested_at
    FROM page_group_capability
    WHERE account_id = ? AND user_id = ? AND lower(page_name) = lower(?)
    ORDER BY share_success_count DESC, last_tested_at DESC
  `).all(req.params.id, req.userId, pageName);

  res.json({
    page_name: pageName,
    total_groups: rows.length,
    success_groups: rows.filter(r => r.share_success_count > 0).length,
    failed_groups: rows.filter(r => r.share_fail_count > 0 && r.share_success_count === 0).length,
    groups: rows,
  });
});

router.get('/:id/groups', async (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  if (account.status !== 'active') return res.status(400).json({ error: `Akun berstatus "${account.status}", hanya akun aktif yang bisa digunakan` });

  try {
    const result = await fetchUserGroupsSmart(account.id, account.cookies, account.proxy);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal memuat grup: ' + err.message, groups: [] });
  }
});

router.get('/:id/proxy', (req, res) => {
  const account = db.prepare('SELECT proxy, user_agent, proxy_pool, proxy_source, proxy_country FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  let pool = [];
  try { pool = JSON.parse(account.proxy_pool || '[]'); } catch {}
  res.json({ proxy: account.proxy || '', user_agent: account.user_agent || '', proxy_pool: pool, proxy_source: account.proxy_source || 'manual', proxy_country: account.proxy_country || '' });
});

router.get('/:id/diagnostics', async (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });

  try {
    const diagnostics = await diagnoseAccount(account.cookies, account.proxy, account.user_agent);
    res.json({ account: account.name, diagnostics });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mendiagnosa akun: ' + err.message });
  }
});

router.post('/:id/fatigue/recalculate', (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  try {
    const result = applyFatiguePolicy(account.id);
    const updated = db.prepare('SELECT fatigue_score, fatigue_level, fatigue_updated_at, cooldown_until FROM fb_accounts WHERE id = ?').get(account.id);
    res.json({ success: true, metrics: result, account: updated });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghitung fatigue: ' + err.message });
  }
});

// Setup profil Facebook (foto, bio, lokasi) - langsung
router.post('/:id/setup-profile', async (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  if (account.status !== 'active') return res.status(400).json({ error: 'Akun harus berstatus aktif' });

  const { photo_url, bio, city, workplace, school, mode } = req.body || {};
  if (!photo_url && !bio && !city && !workplace && !school) return res.status(400).json({ error: 'Minimal isi salah satu field' });

  // Mode: 'instant' (semua sekaligus) atau 'gradual' (1 per hari)
  if (mode === 'gradual') {
    const { v4: uid } = require('uuid');
    const fields = [];
    if (photo_url) fields.push({ field: 'photo', value: photo_url });
    if (bio) fields.push({ field: 'bio', value: bio });
    if (city) fields.push({ field: 'city', value: city });
    if (workplace) fields.push({ field: 'workplace', value: workplace });
    if (school) fields.push({ field: 'school', value: school });

    const today = new Date();
    fields.forEach((f, i) => {
      const scheduledDate = new Date(today.getTime() + i * 86400000).toISOString().slice(0, 10);
      db.prepare('INSERT INTO profile_setup_queue (id, user_id, account_id, field, value, status, scheduled_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uid(), req.userId, req.params.id, f.field, f.value, 'pending', scheduledDate);
    });

    return res.json({ success: true, mode: 'gradual', scheduled: fields.length, message: `${fields.length} perubahan dijadwalkan (1 per hari mulai hari ini)` });
  }

  // Mode instant
  try {
    const { setupProfile } = require('../services/profileSetupService');
    const result = await setupProfile(account, { photo_url, bio, city, workplace, school });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Gagal setup profil: ' + err.message });
  }
});

// Lihat queue setup profil
router.get('/:id/setup-queue', (req, res) => {
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const queue = db.prepare('SELECT * FROM profile_setup_queue WHERE account_id = ? ORDER BY scheduled_date ASC').all(req.params.id);
  res.json(queue);
});

router.post('/bulk-import', async (req, res) => {
  const { accounts } = req.body;
  if (!Array.isArray(accounts) || !accounts.length) return res.status(400).json({ error: 'Data akun wajib diisi' });
  const results = { success: 0, failed: 0, errors: [] };
  for (const acc of accounts) {
    const { name, cookies, proxy } = acc;
    if (!name || !cookies) { results.failed++; results.errors.push(`${name || 'Tanpa nama'}: Nama dan cookies wajib diisi`); continue; }
    try {
      const validation = await validateAccount(cookies, proxy || null);
      if (!validation.valid) { results.failed++; results.errors.push(`${name}: Cookies tidak valid`); continue; }
      const id = uuidv4();
      db.prepare('INSERT INTO fb_accounts (id, user_id, name, cookies, status, proxy) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, req.userId, name, cookies, 'active', proxy || null);
      results.success++;
    } catch (e) { results.failed++; results.errors.push(`${name}: ${e.message}`); }
  }
  res.json({ ...results, message: `${results.success} akun berhasil diimpor, ${results.failed} gagal` });
});

router.post('/batch-validate', async (req, res) => {
  const accounts = db.prepare('SELECT * FROM fb_accounts WHERE user_id = ?').all(req.userId);
  const results = [];
  for (const account of accounts) {
    const validation = await validateAccount(account.cookies, account.proxy);
    let newStatus = 'invalid';
    if (validation.valid) newStatus = 'active';
    else if (validation.checkpoint) newStatus = 'checkpoint';
    db.prepare('UPDATE fb_accounts SET status = ? WHERE id = ?').run(newStatus, account.id);
    results.push({ id: account.id, name: account.name, status: newStatus, valid: validation.valid, checkpoint: validation.checkpoint });
  }
  res.json(results);
});

router.get('/:id/stats', (req, res) => {
  const account = db.prepare('SELECT id, name FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const overall = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM comment_logs WHERE account_id = ?
  `).get(req.params.id);
  const today = new Date().toISOString().slice(0, 10);
  const todayStats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success
    FROM comment_logs WHERE account_id = ? AND date(created_at) = ?
  `).get(req.params.id, today);
  const byCampaign = db.prepare(`
    SELECT c.name as campaign_name,
      COUNT(*) as total,
      SUM(CASE WHEN cl.status='success' THEN 1 ELSE 0 END) as success
    FROM comment_logs cl
    LEFT JOIN campaigns c ON cl.campaign_id = c.id
    WHERE cl.account_id = ?
    GROUP BY cl.campaign_id ORDER BY total DESC LIMIT 10
  `).all(req.params.id);
  res.json({ account: account.name, overall, today: todayStats, byCampaign });
});

router.get('/:id/activity', (req, res) => {
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  const logs = db.prepare(`
    SELECT cl.*, c.name as campaign_name
    FROM comment_logs cl
    LEFT JOIN campaigns c ON cl.campaign_id = c.id
    WHERE cl.account_id = ?
    ORDER BY cl.created_at DESC LIMIT 100
  `).all(req.params.id);
  res.json(logs);
});

router.post('/:id/validate', async (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });

  const validation = await validateAccount(account.cookies, account.proxy);
  let newStatus = 'invalid';
  if (validation.valid) newStatus = 'active';
  else if (validation.checkpoint) newStatus = 'checkpoint';
  db.prepare('UPDATE fb_accounts SET status = ? WHERE id = ?').run(newStatus, req.params.id);

  res.json({ valid: validation.valid, status: newStatus, fbName: validation.name, error: validation.error, checkpoint: validation.checkpoint });
});

// Test akun secara live pakai browser (lebih akurat untuk deteksi cookie expired)
router.post('/:id/test-live', async (req, res) => {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });

  try {
    const result = await testAccountLive(account);

    // Update status di DB sesuai hasil + kirim notifikasi kalau bermasalah
    if (result.status === 'active') {
      db.prepare("UPDATE fb_accounts SET status = 'active', last_used = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    } else if (['expired', 'checkpoint', 'locked'].includes(result.status)) {
      await setAccountStatus(req.params.id, result.status);
    }

    res.json(result);
  } catch (e) {
    const { message } = friendlyError(e);
    res.status(500).json({ error: message });
  }
});

router.get('/leaderboard', (req, res) => {
  const accounts = db.prepare(`
    SELECT a.id, a.name, a.status, a.last_used,
      COALESCE(a.total_success, 0) as total_success,
      COALESCE(a.total_failed, 0) as total_failed,
      COALESCE(a.total_comments, 0) as total_comments
    FROM fb_accounts a
    WHERE a.user_id = ?
    ORDER BY total_success DESC
  `).all(req.userId);
  res.json(accounts);
});

// Bulk update cookies endpoint
router.post('/bulk-update-cookies', async (req, res) => {
  const { updates } = req.body; // Array of { account_id, cookies, user_agent?, proxy? }
  
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'Updates array diperlukan dan tidak boleh kosong' });
  }

  if (updates.length > 50) {
    return res.status(400).json({ error: 'Maksimal 50 akun per request' });
  }

  const results = [];
  const errors = [];

  for (const update of updates) {
    const { account_id, cookies, user_agent, proxy } = update;
    
    if (!account_id || !cookies) {
      errors.push({ account_id, error: 'account_id dan cookies diperlukan' });
      continue;
    }

    try {
      // Verifikasi akun milik user ini
      const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(account_id, req.userId);
      if (!account) {
        errors.push({ account_id, error: 'Akun tidak ditemukan atau bukan milik Anda' });
        continue;
      }

      // Validasi cookies baru
      const ua = user_agent || account.user_agent;
      const proxyUrl = proxy !== undefined ? (proxy || null) : account.proxy;
      const validation = await validateAccount(cookies, proxyUrl, ua);
      
      if (!validation.valid) {
        errors.push({ account_id, error: `Cookies invalid: ${validation.error}` });
        continue;
      }

      // Update database
      db.prepare(`
        UPDATE fb_accounts 
        SET cookies = ?, user_agent = ?, proxy = ?, status = 'active', last_used = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(cookies, ua || null, proxyUrl, account_id);

      // Log audit
      db.prepare(`
        INSERT INTO cookie_update_logs (id, user_id, account_id, old_cookie_len, new_cookie_len, ua_changed, proxy_changed, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        uuidv4(),
        req.userId,
        account_id,
        account.cookies ? account.cookies.length : 0,
        cookies.length,
        ua !== account.user_agent ? 1 : 0,
        proxyUrl !== account.proxy ? 1 : 0,
        'success'
      );

      results.push({
        account_id,
        name: account.name,
        status: 'updated',
        fbName: validation.name,
      });

    } catch (err) {
      errors.push({ account_id, error: err.message });
    }
  }

  // Return summary
  res.json({
    summary: {
      total: updates.length,
      success: results.length,
      failed: errors.length,
    },
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// Cookie age report

// POST /api/accounts/health-check-all — cek semua akun aktif
router.post('/health-check-all', async (req, res) => {
  const db = require('../db/database');
  const { setAccountStatus } = require('../services/accountStatusService');
  const { validateAccount } = require('../services/facebookService');
  const accounts = db.prepare("SELECT * FROM fb_accounts WHERE user_id = ? AND status IN ('active','expired','invalid')").all(req.userId);
  if (!accounts.length) return res.json({ checked: 0, results: [] });
  const results = [];
  for (const acc of accounts) {
    try {
      const v = await validateAccount(acc.cookies, acc.proxy, acc.user_agent);
      let newStatus = 'active';
      if (!v.valid) newStatus = v.checkpoint ? 'checkpoint' : 'expired';
      await setAccountStatus(acc.id, newStatus);
      db.prepare("UPDATE fb_accounts SET last_health_check = CURRENT_TIMESTAMP WHERE id = ?").run(acc.id);
      results.push({ id: acc.id, name: acc.name, status: newStatus, changed: acc.status !== newStatus });
    } catch(e) {
      results.push({ id: acc.id, name: acc.name, status: 'unknown', error: e.message });
    }
  }
  res.json({ checked: accounts.length, results });
});

router.get('/cookie-status', (req, res) => {
  const accounts = db.prepare(`
    SELECT id, name, cookies, last_used, created_at, status
    FROM fb_accounts
    WHERE user_id = ?
  `).all(req.userId);

  const report = accounts.map(a => {
    let cookieAge = null;
    if (a.cookies) {
      try {
        const parsed = {};
        for (const part of a.cookies.split(';')) {
          const i = part.indexOf('=');
          if (i > 0) {
            const k = part.slice(0, i).trim();
            const v = part.slice(i + 1).trim();
            if (k) parsed[k] = v;
          }
        }
        const xs = parsed.xs;
        if (xs) {
          const parts = xs.split(':');
          for (const p of parts) {
            const n = Number(p);
            if (n && n > 1500000000 && n < Date.now() / 1000 + 1000) {
              cookieAge = Math.floor((Date.now() / 1000 - n) / 86400);
              break;
            }
          }
        }
      } catch (e) {}
    }

    const riskLevel = !cookieAge ? 'unknown'
      : cookieAge > 120 ? 'critical'
      : cookieAge > 90 ? 'high'
      : cookieAge > 60 ? 'medium'
      : 'low';

    return {
      id: a.id,
      name: a.name,
      status: a.status,
      cookie_age_days: cookieAge,
      risk_level: riskLevel,
      last_used: a.last_used,
      created_at: a.created_at,
      action: riskLevel === 'critical' || riskLevel === 'high' ? 'REFRESH_NEEDED' : 'OK',
    };
  });

  res.json({
    total: report.length,
    critical: report.filter(r => r.risk_level === 'critical').length,
    high: report.filter(r => r.risk_level === 'high').length,
    medium: report.filter(r => r.risk_level === 'medium').length,
    low: report.filter(r => r.risk_level === 'low').length,
    unknown: report.filter(r => r.risk_level === 'unknown').length,
    accounts: report,
  });
});

module.exports = router;
