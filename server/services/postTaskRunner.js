const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { upPost, postToGroup, postToMarketplace } = require('./postService');
const { normalizeFacebookError } = require('./facebookService');
const { rankGroups, recordOutcome: recordGroupOutcome } = require('./groupQualityService');

const runningTasks = new Set();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) {
  const ms = (Math.random() * (max - min) + min) * 1000;
  return sleep(ms);
}
function processSpintax(text) {
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

function formatFbError(error, context = 'post_task') {
  if (!error) return null;
  if (typeof error === 'object' && error.code) return `${error.code}: ${error.message}. ${error.recommendation || ''}`.trim();
  const normalized = normalizeFacebookError(error, context);
  return `${normalized.code}: ${normalized.message}. ${normalized.recommendation}`;
}

function extractGroupIdOrSlug(groupUrl) {
  const m = String(groupUrl || '').match(/facebook\.com\/groups\/([^/?#]+)/i);
  return m ? m[1] : String(groupUrl || '');
}

function upsertPageGroupCapability(userId, accountId, pageName, groupUrl, success, errorMsg = null) {
  if (!pageName) return;
  const id = uuidv4();
  const normGroup = extractGroupIdOrSlug(groupUrl);
  db.prepare(`
    INSERT INTO page_group_capability
      (id, user_id, account_id, page_name, group_url, share_success_count, share_fail_count, last_status, last_error, last_tested_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(account_id, page_name, group_url) DO UPDATE SET
      share_success_count = share_success_count + excluded.share_success_count,
      share_fail_count = share_fail_count + excluded.share_fail_count,
      last_status = excluded.last_status,
      last_error = excluded.last_error,
      last_tested_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    id,
    userId,
    accountId,
    pageName,
    normGroup,
    success ? 1 : 0,
    success ? 0 : 1,
    success ? 'success' : 'failed',
    errorMsg || null,
  );
}

function logTaskResult(taskId, accountId, type, target, content, status, errorMsg) {
  const id = uuidv4();
  db.prepare('INSERT INTO post_task_logs (id, task_id, account_id, type, target, content, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, taskId, accountId, type, target, content || '', status, errorMsg || null);
}

async function runOnce(taskId) {
  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ?').get(taskId);
  if (!task) return { error: 'Task tidak ditemukan' };

  const accountIds = JSON.parse(task.account_ids || '[]');
  const config = JSON.parse(task.config || '{}');
  let success = 0;
  let failed = 0;

  for (const accountId of accountIds) {
    if (!runningTasks.has(taskId)) break;

    const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(accountId);
    if (!account || account.status === 'invalid' || account.status === 'checkpoint' || account.status === 'proxy_dead') {
      const reason = !account
        ? 'Akun tidak ditemukan'
        : account.status === 'checkpoint'
          ? 'Akun terkena checkpoint Facebook'
          : account.status === 'proxy_dead'
            ? 'Proxy akun mati. Ganti proxy atau matikan proxy untuk lanjut.'
            : 'Akun invalid atau expired';
      logTaskResult(taskId, accountId, task.type, '-', '', 'failed', formatFbError(reason, 'post_task.account_status'));
      failed++;
      continue;
    }

    let result;

    if (task.type === 'auto_up') {
      const targets = config.targets || [];
      for (const postUrl of targets) {
        if (!runningTasks.has(taskId)) break;
        result = await upPost(account.cookies, postUrl, config.up_text || '{UP|up|Up|naik|Naik}');
        logTaskResult(taskId, accountId, 'auto_up', postUrl, config.up_text || 'UP', result.success ? 'success' : 'failed', result.success ? null : formatFbError(result.code ? result : result.error, 'post_task.auto_up'));
        if (result.success) success++; else failed++;
        db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);
        if (postUrl !== targets[targets.length - 1]) await randomDelay(config.delay_min || 10, config.delay_max || 30);
      }
    } else if (task.type === 'group_post') {
      let groups = config.groups || [];

      // Auto-fallback: kalau user tidak isi grup, pakai stored groups dari discovery
      if (groups.length === 0) {
        try {
          const stored = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(accountId);
          if (stored.length === 0) {
            // Tidak ada stored: trigger sync sekali, lalu pakai hasilnya
            try {
              const { discoverGroups } = require('./browserDiscovery');
              await discoverGroups(accountId);
              const fresh = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(accountId);
              groups = fresh.map(g => g.url);
            } catch {
              groups = [];
            }
          } else {
            groups = stored.map(g => g.url);
          }
        } catch {}
      }

      if (groups.length === 0) {
        logTaskResult(taskId, accountId, 'group_post', '-', '', 'failed', formatFbError('Akun belum punya grup tersimpan dan tidak ada grup yang diisi user', 'post_task.group_post'));
        failed++;
        continue;
      }

      // Prioritaskan grup dengan quality score tinggi
      groups = rankGroups(task.user_id, groups);

      for (const groupUrl of groups) {
        if (!runningTasks.has(taskId)) break;
        result = await postToGroup(account.cookies, groupUrl, {
          text: config.post_text || '',
        });
        const formattedErr = result.success ? null : formatFbError(result.code ? result : result.error, 'post_task.group_post');
        logTaskResult(taskId, accountId, 'group_post', groupUrl, config.post_text || '', result.success ? 'success' : 'failed', formattedErr);
        try { recordGroupOutcome(task.user_id, groupUrl, result.success, formattedErr); } catch {}
        if (result.success) success++; else failed++;
        db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);
        if (groupUrl !== groups[groups.length - 1]) await randomDelay(config.delay_min || 15, config.delay_max || 60);
      }
    } else if (task.type === 'marketplace') {
      const nowHour = new Date().getHours();
      if (config.peak_hours_enabled) {
        const start = config.peak_hours_start ?? 0;
        const end = config.peak_hours_end ?? 23;
        if (nowHour < start || nowHour > end) {
          logTaskResult(taskId, accountId, 'marketplace', 'schedule_check', '', 'info',
            `Di luar jam puncak (${String(start).padStart(2,'0')}:00–${String(end).padStart(2,'0')}:00), dilewati`);
          continue;
        }
      }

      const listings = Array.isArray(config.listings) && config.listings.length > 0
        ? config.listings
        : [{ title: config.title, description: config.description, price_min: config.price, price_max: config.price, category: config.category, condition: config.condition, images: [] }];

      for (let li = 0; li < listings.length; li++) {
        if (!runningTasks.has(taskId)) break;
        const listing = listings[li];
        result = await postToMarketplace(account.cookies, {
          ...listing,
          latitude: config.latitude || -6.2088,
          longitude: config.longitude || 106.8456,
          location_random_offset: config.location_random_offset || 0,
          hide_from_friends: config.hide_from_friends || false,
        });
        const target = listing.title ? listing.title.slice(0, 60) : 'marketplace';
        logTaskResult(taskId, accountId, 'marketplace', target, listing.title || '', result.success ? 'success' : 'failed', result.success ? null : formatFbError(result.code ? result : result.error, 'post_task.marketplace'));
        if (result.success) success++; else failed++;
        db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);
        if (li < listings.length - 1 && runningTasks.has(taskId)) {
          await randomDelay(config.delay_min || 60, config.delay_max || 180);
        }
      }
    } else if (task.type === 'share_post') {
      const { sharePostToGroup } = require('./shareService');
      const { detectGroupType } = require('./smartGroupDetector');

      const postUrls = Array.isArray(config.post_urls) && config.post_urls.length
        ? config.post_urls
        : (config.post_url ? [config.post_url] : []);

      let groups = Array.isArray(config.groups) ? config.groups.filter(Boolean) : [];
      if (groups.length === 0) {
        try {
          const stored = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(accountId);
          if (stored.length === 0) {
            const { discoverGroups } = require('./browserDiscovery');
            await discoverGroups(accountId);
            const fresh = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(accountId);
            groups = fresh.map(g => g.url);
          } else {
            groups = stored.map(g => g.url);
          }
        } catch {}
      }

      if (postUrls.length === 0) {
        logTaskResult(taskId, accountId, 'share_post', '-', '', 'failed', formatFbError('Belum ada post sumber yang dipilih untuk di-share', 'post_task.share_post'));
        failed++;
        continue;
      }
      if (groups.length === 0) {
        logTaskResult(taskId, accountId, 'share_post', '-', '', 'failed', formatFbError('Belum ada grup target dan akun belum punya stored groups', 'post_task.share_post'));
        failed++;
        continue;
      }

      groups = rankGroups(task.user_id, groups);

      const maxGroupsPerRun = Math.min(groups.length, parseInt(config.max_groups_per_run) || 5);
      let shared = 0;

      outer: for (const postUrl of postUrls) {
        for (let gi = 0; gi < groups.length; gi++) {
          if (!runningTasks.has(taskId)) break outer;
          if (shared >= maxGroupsPerRun) break outer;
          const groupUrl = groups[gi];

          // Detect: skip grup listing (tanpa delay)
          let groupType = 'post';
          try { groupType = await detectGroupType(account, groupUrl); } catch {}
          if (groupType === 'sell') {
            logTaskResult(taskId, accountId, 'share_post', `[SKIP] ${groupUrl}`, '', 'skipped', 'Grup jual-beli (listing only), di-skip');
            continue; // tanpa delay, langsung ke grup berikutnya
          }

          // Grup diskusi → share
          const r = await sharePostToGroup(account, postUrl, groupUrl, {
            message: config.message || '',
            shareAs: config.share_as || 'self',
            pageName: config.page_name || '',
          });
          const formattedErr = r.success ? null : formatFbError(r.code ? r : r.error, 'post_task.share_post');
          logTaskResult(taskId, accountId, 'share_post', `${postUrl} -> ${groupUrl}`, config.message || '', r.success ? 'success' : 'failed', formattedErr);
          try { recordGroupOutcome(task.user_id, groupUrl, r.success, formattedErr); } catch {}
          try {
            if ((config.share_as || 'self') === 'page' && config.page_name) {
              upsertPageGroupCapability(task.user_id, accountId, config.page_name, groupUrl, r.success, formattedErr);
            }
          } catch {}
          if (r.success) { success++; shared++; } else failed++;
          db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);
          if (shared < maxGroupsPerRun && runningTasks.has(taskId)) {
            await randomDelay(config.delay_min || 30, config.delay_max || 90);
          }
        }
      }
    } else if (task.type === 'group_listing') {
      const { postGroupListing } = require('./groupListingService');

      let groups = Array.isArray(config.groups) ? config.groups.filter(Boolean) : [];
      if (groups.length === 0) {
        try {
          const stored = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(accountId);
          groups = stored.map(g => g.url);
        } catch {}
      }

      const listings = Array.isArray(config.listings) && config.listings.length > 0
        ? config.listings
        : [{
            title: config.title,
            description: config.description,
            price: config.price ?? config.price_min ?? 0,
            category: config.category,
            condition: config.condition || 'used_good',
            images: config.images || [],
            listing_type: config.listing_type || 'item',
          }];

      if (groups.length === 0) {
        logTaskResult(taskId, accountId, 'group_listing', '-', '', 'failed', formatFbError('Belum ada grup target dan akun belum punya stored groups', 'post_task.group_listing'));
        failed++;
        continue;
      }
      if (!listings[0]?.title) {
        logTaskResult(taskId, accountId, 'group_listing', '-', '', 'failed', formatFbError('Listing belum lengkap (judul kosong)', 'post_task.group_listing'));
        failed++;
        continue;
      }

      groups = rankGroups(task.user_id, groups);
      const maxGroupsPerRun = Math.min(groups.length, parseInt(config.max_groups_per_run) || 3);

      outerListing: for (let li = 0; li < listings.length; li++) {
        const listing = listings[li];
        for (let gi = 0; gi < maxGroupsPerRun; gi++) {
          if (!runningTasks.has(taskId)) break outerListing;
          const groupUrl = groups[gi];
          // Spintax title/description supaya beda tiap grup
          const builtListing = {
            ...listing,
            title: processSpintax(String(listing.title || '')),
            description: processSpintax(String(listing.description || '')),
          };
          const r = await postGroupListing(account, groupUrl, builtListing);
          const formattedErr = r.success ? null : formatFbError(r.code ? r : r.error, 'post_task.group_listing');
          logTaskResult(taskId, accountId, 'group_listing', `${groupUrl}`, builtListing.title, r.success ? 'success' : 'failed', formattedErr);
          try { recordGroupOutcome(task.user_id, groupUrl, r.success, formattedErr); } catch {}
          if (r.success) success++; else failed++;
          db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);
          if (gi < maxGroupsPerRun - 1 && runningTasks.has(taskId)) {
            await randomDelay(config.delay_min || 60, config.delay_max || 180);
          }
        }
      }
    } else if (task.type === 'smart_post') {
      // Smart Post: otomatis detect grup jual-beli vs diskusi
      const { postGroupListing } = require('./groupListingService');
      const { detectGroupType } = require('./smartGroupDetector');

      let groups = Array.isArray(config.groups) ? config.groups.filter(Boolean) : [];
      if (groups.length === 0) {
        try {
          const stored = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 30').all(accountId);
          groups = stored.map(g => g.url);
        } catch {}
      }
      if (groups.length === 0) {
        logTaskResult(taskId, accountId, 'smart_post', '-', '', 'failed', formatFbError('Belum ada grup target', 'post_task.smart_post'));
        failed++;
        continue;
      }

      groups = rankGroups(task.user_id, groups);
      const maxGroupsPerRun = Math.min(groups.length, parseInt(config.max_groups_per_run) || 5);

      for (let gi = 0; gi < maxGroupsPerRun; gi++) {
        if (!runningTasks.has(taskId)) break;
        const groupUrl = groups[gi];

        // Detect tipe grup
        let groupType = 'post';
        try {
          groupType = await detectGroupType(account, groupUrl);
        } catch {}

        let r;
        if (groupType === 'sell' && config.title) {
          // Grup jual-beli → pakai listing
          const listing = {
            title: processSpintax(String(config.title || '')),
            description: processSpintax(String(config.description || config.post_text || '')),
            price: config.price ?? 0,
            category: config.category || '',
            condition: config.condition || 'used_good',
            images: config.images || [],
            listing_type: config.listing_type || 'item',
          };
          r = await postGroupListing(account, groupUrl, listing);
          logTaskResult(taskId, accountId, 'smart_post', `[LISTING] ${groupUrl}`, listing.title, r.success ? 'success' : 'failed', r.success ? null : formatFbError(r.code ? r : r.error, 'post_task.smart_post'));
        } else {
          // Grup diskusi → pakai post biasa
          r = await postToGroup(account.cookies, groupUrl, { text: processSpintax(String(config.post_text || '')) });
          logTaskResult(taskId, accountId, 'smart_post', `[POST] ${groupUrl}`, config.post_text || '', r.success ? 'success' : 'failed', r.success ? null : formatFbError(r.code ? r : r.error, 'post_task.smart_post'));
        }

        try { recordGroupOutcome(task.user_id, groupUrl, r.success, r.success ? null : (r.error || '')); } catch {}
        if (r.success) success++; else failed++;
        db.prepare('UPDATE fb_accounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(accountId);
        if (gi < maxGroupsPerRun - 1 && runningTasks.has(taskId)) {
          await randomDelay(config.delay_min || 30, config.delay_max || 90);
        }
      }
    }

    if (accountId !== accountIds[accountIds.length - 1] && runningTasks.has(taskId)) {
      await randomDelay(5, 15);
    }
  }

  const nextRun = new Date(Date.now() + task.interval_minutes * 60 * 1000).toISOString();
  db.prepare('UPDATE post_tasks SET total_success = total_success + ?, total_failed = total_failed + ?, last_run = CURRENT_TIMESTAMP, next_run = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(success, failed, nextRun, taskId);

  // Log scheduler aktivitas
  try {
    const { logSchedulerEvent } = require('./schedulerLog');
    logSchedulerEvent({
      type: `post_task_${task.type || 'run'}`,
      userId: task.user_id,
      targetId: taskId,
      targetName: task.name,
      status: success > 0 ? 'success' : (failed > 0 ? 'failed' : 'skipped'),
      message: `Post task "${task.name}" — ${success} sukses, ${failed} gagal. Berikutnya: ${task.interval_minutes}m`,
    });
  } catch {}

  return { success, failed };
}

async function runTask(taskId) {
  if (runningTasks.has(taskId)) return { error: 'Task sudah berjalan' };

  const task = db.prepare('SELECT * FROM post_tasks WHERE id = ?').get(taskId);
  if (!task) return { error: 'Task tidak ditemukan' };

  runningTasks.add(taskId);
  db.prepare("UPDATE post_tasks SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(taskId);

  try {
    while (runningTasks.has(taskId)) {
      await runOnce(taskId);

      if (!runningTasks.has(taskId)) break;

      const freshTask = db.prepare('SELECT * FROM post_tasks WHERE id = ?').get(taskId);
      if (!freshTask || freshTask.interval_minutes <= 0) break;

      const waitMs = freshTask.interval_minutes * 60 * 1000;
      const checkInterval = 10000;
      let waited = 0;
      while (waited < waitMs && runningTasks.has(taskId)) {
        await sleep(checkInterval);
        waited += checkInterval;
      }
    }
  } finally {
    runningTasks.delete(taskId);
    db.prepare("UPDATE post_tasks SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(taskId);
  }
}

function stopTask(taskId) {
  if (!runningTasks.has(taskId)) return { error: 'Task tidak berjalan' };
  runningTasks.delete(taskId);
  db.prepare("UPDATE post_tasks SET status = 'idle', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(taskId);
  return { message: 'Task dihentikan' };
}

function isRunning(taskId) { return runningTasks.has(taskId); }

module.exports = { runTask, runOnce, stopTask, isRunning };
