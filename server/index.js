const express = require('express');
const cors = require('cors');
const path = require('path');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// Behind nginx reverse proxy
app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General rate limit untuk semua API endpoint
app.use('/api/', generalLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/remote-browser', require('./routes/remoteBrowser'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/runner', require('./routes/runner'));
app.use('/api/post-tasks', require('./routes/postTasks'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/keyword-monitors', require('./routes/keywordMonitors'));
app.use('/api/warming', require('./routes/warming'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api/niche', require('./routes/niche'));
app.use('/api/anti-detection', require('./routes/antiDetection'));
app.use('/api/auto-join', require('./routes/autoJoin'));
app.use('/api/conversation', require('./routes/conversation'));
app.use('/api/upload', require('./routes/upload'));

// Browser queue status (admin)
app.get('/api/browser-queue', (req, res) => {
  const { getStatus } = require('./services/browserQueue');
  res.json(getStatus());
});

// Proxy recommendation (public, untuk dashboard user)
app.get('/api/proxy-recommendation', (req, res) => {
  try {
    const db = require('./db/database');
    const row = db.prepare("SELECT value FROM system_config WHERE key = 'proxy_recommendation'").get();
    if (row?.value) return res.json(JSON.parse(row.value));
    res.json({ title: '', providers: [] });
  } catch { res.json({ title: '', providers: [] }); }
});

// Proxy latency status (authenticated)
app.get('/api/proxy-latency', (req, res) => {
  const { getAllLatencies } = require('./services/proxyLatencyMonitor');
  res.json(getAllLatencies());
});

// Serve uploaded files
app.use('/uploads', require('express').static(require('path').join(__dirname, '../data/uploads')));
app.use('/api/scheduler-logs', require('./routes/schedulerLogs'));
app.use('/api/cookie-rotation', require('./routes/cookieRotation'));
app.use('/api/content-calendar', require('./routes/contentCalendar'));
app.use('/api/ab-tests', require('./routes/abTests'));
app.use('/api/auto-replies', require('./routes/autoReplies'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));

// Public branding endpoint (no auth)
app.get('/api/branding', (req, res) => {
  try {
    const db = require('./db/database');
    const rows = db.prepare("SELECT key, value FROM site_seo WHERE key LIKE 'brand_%' OR key = 'favicon_url'").all();
    const branding = {};
    rows.forEach(r => { branding[r.key] = r.value; });
    res.json(branding);
  } catch (err) {
    res.json({ brand_name: 'ArzaBot', brand_logo_url: '', brand_icon_url: '', favicon_url: '/favicon.svg', brand_primary_color: '#2563eb', brand_tagline: '' });
  }
});
app.use('/api/plans', require('./routes/plans'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/feature-requests', require('./routes/featureRequests'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/blacklists', require('./routes/blacklists'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/campaign-library', require('./routes/campaignLibrary'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/api-keys', require('./routes/apiKeys'));
app.use('/api/roi', require('./routes/roi'));
app.use('/api/landing', require('./routes/landing'));
app.use('/api/proxies', require('./routes/proxies'));
app.use('/api/browser-profiles', require('./routes/browserProfiles'));

app.post('/api/search-posts', require('./middleware/auth').authMiddleware, async (req, res) => {
  try {
    const { keyword, account_id } = req.body;
    if (!keyword || !account_id) return res.status(400).json({ error: 'Keyword dan akun diperlukan' });
    const db = require('./db/database');
    const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(account_id, req.userId);
    if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan' });
    const { searchPosts } = require('./services/facebookService');
    const result = await searchPosts(keyword, account.cookies, account.proxy);
    res.json(result);
  } catch (err) {
    console.error('[search-posts]', err);
    res.status(500).json({ error: 'Gagal mencari post: ' + err.message });
  }
});

app.get('/api/seo/public', (req, res) => {
  try {
    const db = require('./db/database');
    const rows = db.prepare('SELECT key, value FROM site_seo').all();
    const seo = {};
    rows.forEach(r => { seo[r.key] = r.value; });
    res.json(seo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const clientBuildPath = path.join(__dirname, '../client/dist');
const fs = require('fs');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  // Catchall untuk SPA — TAPI jangan tangkap /api/* (biar return 404 JSON, bukan index.html)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// 404 fallback untuk /api/* kalau client build tidak ada
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
  try {
    const discoveryScheduler = require('./services/discoveryScheduler');
    discoveryScheduler.start();
  } catch (e) {
    console.error('[discovery-scheduler] gagal start:', e.message);
  }
  try {
    const autoJoinScheduler = require('./services/autoJoinScheduler');
    autoJoinScheduler.start();
  } catch (e) {
    console.error('[auto-join-scheduler] gagal start:', e.message);
  }
  try {
    const personalInboxScheduler = require('./services/personalInboxScheduler');
    personalInboxScheduler.start();
  } catch (e) {
    console.error('[personal-inbox-scheduler] gagal start:', e.message);
  }
  try {
    const proxyHealthMonitor = require('./services/proxyHealthMonitor');
    proxyHealthMonitor.start();
  } catch (e) {
    console.error('[proxy-monitor] gagal start:', e.message);
  }
  try {
    const proxyRefreshScheduler = require('./services/proxyRefreshScheduler');
    proxyRefreshScheduler.start();
  } catch (e) {
    console.error('[proxy-refresh] gagal start:', e.message);
  }
  try {
    const proxyLatencyMonitor = require('./services/proxyLatencyMonitor');
    proxyLatencyMonitor.start();
  } catch (e) {
    console.error('[proxy-latency] gagal start:', e.message);
  }
  try {
    const profileSetupScheduler = require('./services/profileSetupScheduler');
    profileSetupScheduler.start();
  } catch (e) {
    console.error('[profile-setup-scheduler] gagal start:', e.message);
  }

  // DB backup harian
  try {
    const dbBackup = require('./services/dbBackup');
    dbBackup.start();
  } catch (e) {
    console.error('[db-backup] gagal start:', e.message);
  }

  // Daily account health report — jam 8 pagi WIB
  try {
    const { sendDailyAccountHealthReport } = require('./services/accountStatusService');
    const now = new Date();
    const next8am = new Date();
    next8am.setHours(8, 0, 0, 0);
    if (next8am <= now) next8am.setDate(next8am.getDate() + 1);
    const msUntil8am = next8am - now;
    setTimeout(() => {
      sendDailyAccountHealthReport().catch(e => console.error('[account-health] error:', e.message));
      setInterval(() => {
        sendDailyAccountHealthReport().catch(e => console.error('[account-health] error:', e.message));
      }, 24 * 60 * 60 * 1000);
    }, msUntil8am);
    console.log(`[account-health] laporan harian dijadwalkan jam 08:00 WIB`);
  } catch (e) {
    console.error('[account-health] gagal start:', e.message);
  }
});


  // Periodic health check — tiap 6 jam
  try {
    const { checkAllAccountsForUser } = require('./services/accountStatusService');
    const healthDb = require('./db/database');
    setInterval(async () => {
      try {
        const users = healthDb.prepare("SELECT DISTINCT user_id FROM fb_accounts WHERE status = 'active'").all();
        for (const { user_id } of users) {
          await checkAllAccountsForUser(user_id).catch(() => {});
        }
        console.log('[periodic-health-check] selesai cek semua akun aktif');
      } catch(e) { console.error('[periodic-health-check] error:', e.message); }
    }, 6 * 60 * 60 * 1000).unref(); // tiap 6 jam
    console.log('[periodic-health-check] scheduler aktif, interval 6 jam');
  } catch(e) {
    console.error('[periodic-health-check] gagal start:', e.message);
  }

  // Content Calendar scheduler tick
try {
  const { tickCalendarScheduler } = require('./services/contentCalendarService');
  setInterval(() => {
    tickCalendarScheduler().catch(e => console.error('[calendar] tick error:', e.message));
  }, 60 * 1000).unref();
  console.log('[calendar] scheduler aktif, tick tiap 1 menit');
} catch(e) { console.error('[calendar] gagal start:', e.message); }

// Scheduled campaigns cron (check every minute)
const { runCampaign, isRunning } = require('./services/campaignRunner');
const { logSchedulerEvent } = require('./services/schedulerLog');
setInterval(() => {
  try {
    const db = require('./db/database');
    const now = new Date();
    const scheduled = db.prepare(`
      SELECT * FROM campaigns WHERE status = 'idle' AND schedule_start IS NOT NULL AND schedule_start != ''
    `).all();
    for (const c of scheduled) {
      if (!c.schedule_start) continue;
      const start = new Date(c.schedule_start);
      if (start <= now && !isRunning(c.id)) {
        console.log(`[Scheduler] Auto-start kampanye: ${c.name}`);
        logSchedulerEvent({ type: 'campaign_auto_start', userId: c.user_id, targetId: c.id, targetName: c.name, status: 'success', message: `Kampanye dimulai otomatis sesuai jadwal (${c.schedule_start})` });
        runCampaign(c.id).catch(e => {
          console.error('[Scheduler] Error:', e.message);
          logSchedulerEvent({ type: 'campaign_auto_start', userId: c.user_id, targetId: c.id, targetName: c.name, status: 'failed', message: e.message });
        });
      }
    }
    const running = db.prepare(`SELECT * FROM campaigns WHERE status = 'running' AND schedule_end IS NOT NULL AND schedule_end != ''`).all();
    for (const c of running) {
      if (!c.schedule_end) continue;
      const end = new Date(c.schedule_end);
      if (end <= now && isRunning(c.id)) {
        const { stopCampaign } = require('./services/campaignRunner');
        console.log(`[Scheduler] Auto-stop kampanye: ${c.name}`);
        stopCampaign(c.id);
        logSchedulerEvent({ type: 'campaign_auto_stop', userId: c.user_id, targetId: c.id, targetName: c.name, status: 'success', message: `Kampanye dihentikan otomatis (jadwal selesai ${c.schedule_end})` });
      }
    }
  } catch (e) {
    console.error('[Scheduler] Error:', e.message);
    logSchedulerEvent({ type: 'campaign_scheduler_tick', status: 'failed', message: e.message });
  }
}, 60000);

// Post tasks scheduler (check next_run every minute)
const { runTask: runPostTask, isRunning: isPostTaskRunning } = require('./services/postTaskRunner');
setInterval(() => {
  try {
    const db = require('./db/database');
    const now = new Date();
    const tasks = db.prepare(`
      SELECT * FROM post_tasks 
      WHERE status = 'idle' 
      AND next_run IS NOT NULL 
      AND datetime(next_run) <= datetime('now')
    `).all();
    
    for (const t of tasks) {
      if (isPostTaskRunning(t.id)) continue;
      console.log(`[PostTask Scheduler] Auto-run: ${t.name} (${t.type})`);
      logSchedulerEvent({ 
        type: `post_task_auto_run`, 
        userId: t.user_id, 
        targetId: t.id, 
        targetName: t.name, 
        status: 'success', 
        message: `Post task "${t.name}" dimulai otomatis sesuai jadwal (next_run: ${t.next_run})` 
      });
      
      runPostTask(t.id).catch(e => {
        console.error(`[PostTask Scheduler] Error running ${t.id}:`, e.message);
        logSchedulerEvent({ 
          type: 'post_task_auto_run', 
          userId: t.user_id, 
          targetId: t.id, 
          targetName: t.name, 
          status: 'failed', 
          message: e.message 
        });
      });
    }
  } catch (e) {
    console.error('[PostTask Scheduler] Error:', e.message);
    logSchedulerEvent({ type: 'post_task_scheduler_tick', status: 'failed', message: e.message });
  }
}, 60000);

// Weekly report cron (every Monday 08:00)
const { notifyWeeklyReport } = require('./services/telegramService');
setInterval(() => {
  try {
    const now = new Date();
    if (now.getDay() !== 1 || now.getHours() !== 8 || now.getMinutes() !== 0) return;
    const db2 = require('./db/database');
    const oneWeekAgo = new Date(now - 7 * 86400000).toISOString();
    const weekLabel = `${new Date(now - 7 * 86400000).toLocaleDateString('id-ID')} – ${now.toLocaleDateString('id-ID')}`;
    const users = db2.prepare('SELECT id FROM users WHERE is_active = 1').all();
    for (const u of users) {
      const stats = db2.prepare(`
        SELECT COUNT(DISTINCT campaign_id) as campaigns,
          SUM(status='success') as success, SUM(status='failed') as failed
        FROM comment_logs cl
        JOIN campaigns c ON cl.campaign_id = c.id
        WHERE c.user_id = ? AND cl.created_at >= ?
      `).get(u.id, oneWeekAgo);
      const total = (stats.success || 0) + (stats.failed || 0);
      const rate = total > 0 ? Math.round((stats.success / total) * 100) : 0;
      const accounts = db2.prepare("SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status = 'problematic' THEN 1 ELSE 0 END) as dead FROM fb_accounts WHERE user_id = ?").get(u.id);
      notifyWeeklyReport(u.id, {
        weekLabel, campaigns: stats.campaigns || 0,
        success: stats.success || 0, failed: stats.failed || 0, rate,
        activeAccounts: accounts?.active || 0, deadAccounts: accounts?.dead || 0,
      }).then(() => {
        logSchedulerEvent({ type: 'weekly_report', userId: u.id, status: 'success', message: `Laporan mingguan dikirim (${total} komentar, ${rate}% sukses)` });
      }).catch((err) => {
        logSchedulerEvent({ type: 'weekly_report', userId: u.id, status: 'failed', message: err.message });
      });
    }
  } catch (e) {
    console.error('[WeeklyCron] Error:', e.message);
    logSchedulerEvent({ type: 'weekly_report_tick', status: 'failed', message: e.message });
  }
}, 60000);

// Daily cleanup of old scheduler logs (jam 03:00 lokal)
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 3 && now.getMinutes() === 0) {
    const { cleanupOldLogs } = require('./services/schedulerLog');
    cleanupOldLogs(30);
  }
}, 60000);

try { require('./routes/remoteBrowser').attachWS(server); } catch (e) { console.error('[remote-browser-ws] gagal attach:', e.message); }

module.exports = app;
