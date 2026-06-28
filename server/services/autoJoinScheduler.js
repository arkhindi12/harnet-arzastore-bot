// Scheduler Auto-Join: cek tiap N menit jobs yang due, jalankan join sesuai jam aktif & daily limit.

const db = require('../db/database');
const { joinGroup, logJoin } = require('./autoJoinService');
const obscuraService = require('./obscuraService');
const { logSchedulerEvent } = require('./schedulerLog');
const { setAccountStatus } = require('./accountStatusService');
const { getBool, getInt } = require('./systemConfig');

function getTickMs() { return getInt('autojoin_tick_seconds', 'AUTOJOIN_TICK_MS', 60) * 1000; }
function isEnabled() { return getBool('autojoin_enabled', 'AUTOJOIN_ENABLED', true); }

let timer = null;
const runningJobs = new Set();

function isWithinHours(start, end) {
  const h = new Date().getHours();
  if (start <= end) return h >= start && h <= end;
  return h >= start || h <= end;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function processSpintax(text) {
  if (!text) return text;
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

function pickGroupsForJob(job) {
  const explicit = (() => { try { return JSON.parse(job.group_urls || '[]'); } catch { return []; } })();

  // Ambil grup yang akun belum jadi anggota berdasarkan stored account_groups (akun TIDAK punya url berarti perlu join).
  // Prioritaskan dari niche_groups bertanda imported=0 jika source 'niche' & ada keyword.
  if (job.source === 'niche' && job.keyword) {
    const baseSql = `SELECT ng.id, ng.url, ng.name FROM niche_groups ng
       WHERE ng.user_id = ? AND ng.keyword = ?
       AND NOT EXISTS (
         SELECT 1 FROM auto_join_logs ajl
         WHERE ajl.job_id = ? AND ajl.group_url = ng.url AND ajl.status IN ('joined','requested','already_member','already_requested')
       )`;

    let candidates = [];

    // Pass 1: strict quality filter.
    if (job.quality_filter_enabled) {
      candidates = db.prepare(
        baseSql + `
       AND COALESCE(ng.posts_per_day, 0) >= ? AND COALESCE(ng.avg_comments, 0) >= ?
       ORDER BY COALESCE(ng.posts_per_day, 0) DESC, COALESCE(ng.avg_comments, 0) DESC, (ng.members_estimate IS NULL), ng.members_estimate DESC
       LIMIT 50`
      ).all(job.user_id, job.keyword, job.id, Number(job.min_posts_per_day || 125), Number(job.min_avg_comments || 3));
    }

    // Pass 2: fallback — if strict filter exhausted, relax to any remaining groups for same keyword.
    if (!candidates.length) {
      candidates = db.prepare(
        baseSql + `
       ORDER BY COALESCE(ng.posts_per_day, 0) DESC, COALESCE(ng.avg_comments, 0) DESC, (ng.members_estimate IS NULL), ng.members_estimate DESC
       LIMIT 50`
      ).all(job.user_id, job.keyword, job.id);
    }

    return candidates.map(c => ({ url: c.url, name: c.name }));
  }

  if (job.source === 'manual' && explicit.length) {
    // Filter yang belum sukses dijoin di log job ini
    const done = db.prepare(
      `SELECT group_url FROM auto_join_logs WHERE job_id = ? AND status IN ('joined','requested','already_member','already_requested')`
    ).all(job.id).map(r => r.group_url);
    const set = new Set(done);
    return explicit.filter(u => !set.has(u)).map(u => ({ url: u, name: null }));
  }

  return [];
}

async function runJobOnce(job) {
  if (runningJobs.has(job.id)) return;
  runningJobs.add(job.id);

  try {
    // Reset counter harian
    if (job.last_reset_date !== todayStr()) {
      db.prepare('UPDATE auto_join_jobs SET joined_today = 0, last_reset_date = ? WHERE id = ?').run(todayStr(), job.id);
      job.joined_today = 0;
      job.last_reset_date = todayStr();
    }

    if (!isWithinHours(job.active_hours_start ?? 8, job.active_hours_end ?? 22)) {
      db.prepare(`UPDATE auto_join_jobs SET last_run = CURRENT_TIMESTAMP, next_run = datetime('now', '+15 minutes') WHERE id = ?`).run(job.id);
      logSchedulerEvent({
        type: 'auto_join_skip',
        userId: job.user_id,
        targetId: job.id,
        targetName: job.name,
        status: 'skipped',
        message: 'Di luar jam aktif',
      });
      return;
    }

    if ((job.joined_today || 0) >= (job.daily_limit || 5)) {
      db.prepare(`UPDATE auto_join_jobs SET last_run = CURRENT_TIMESTAMP, next_run = datetime('now', '+30 minutes') WHERE id = ?`).run(job.id);
      logSchedulerEvent({
        type: 'auto_join_skip',
        userId: job.user_id,
        targetId: job.id,
        targetName: job.name,
        status: 'skipped',
        message: 'Daily limit tercapai',
      });
      return;
    }

    const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(job.account_id, job.user_id);
    if (!account) {
      logJoin(job.id, job.account_id, '-', null, 'failed', 'Akun tidak ditemukan');
      db.prepare("UPDATE auto_join_jobs SET status='failed', last_run=CURRENT_TIMESTAMP WHERE id=?").run(job.id);
      return;
    }
    if (account.status !== 'active') {
      logJoin(job.id, job.account_id, '-', null, 'failed', `Akun status ${account.status}`);
      db.prepare(`UPDATE auto_join_jobs SET last_run=CURRENT_TIMESTAMP, next_run=datetime('now','+1 hour') WHERE id=?`).run(job.id);
      return;
    }

    const groups = pickGroupsForJob(job);
    if (groups.length === 0) {
      db.prepare(`UPDATE auto_join_jobs SET last_run=CURRENT_TIMESTAMP, next_run=datetime('now','+30 minutes') WHERE id=?`).run(job.id);
      logSchedulerEvent({
        type: 'auto_join_skip',
        userId: job.user_id,
        targetId: job.id,
        targetName: job.name,
        status: 'skipped',
        message: 'Tidak ada grup target tersedia',
      });
      return;
    }

    // Hanya 1 grup per tick supaya pace alami
    const target = groups[0];
    const t0 = Date.now();
    let r;
    const engine = job.browser_engine || account.browser_engine || 'patchright';
    if (engine === 'obscura') {
      const or = await obscuraService.joinGroup(account, target.url);
      r = {
        status: or.success ? 'requested' : (or.message || '').includes('Sudah member') ? 'already_member' : (or.message || '').includes('Cookie expired') ? 'cookie_expired' : 'failed',
        detail: '[obscura] ' + (or.message || ''),
      };
    } else {
      r = await joinGroup(account, target.url, {
        answer_template: processSpintax(job.answer_template),
        use_ai: !!job.use_ai_answer,
        user_id: job.user_id,
        ai_context: job.ai_context || '',
        ai_tone: job.ai_tone || 'natural',
      });
    }
    const successStatus = ['joined', 'requested', 'already_member', 'already_requested'];
    const isOk = successStatus.includes(r.status);

    // Cookie expired — tandai akun dan pause job
    if (r.status === 'cookie_expired') {
      await setAccountStatus(job.account_id, 'expired'); // update + notif Telegram
      db.prepare("UPDATE auto_join_jobs SET status = 'paused', last_run = CURRENT_TIMESTAMP WHERE id = ?").run(job.id);
      logJoin(job.id, job.account_id, target.url, target.name, 'cookie_expired', r.detail || 'Cookies expired');
      logSchedulerEvent({
        type: 'auto_join_run',
        userId: job.user_id,
        targetId: job.id,
        targetName: job.name,
        status: 'failed',
        message: `Cookie expired — job di-pause. Update cookies akun lalu jalankan ulang.`,
        durationMs: Date.now() - t0,
      });
      return;
    }

    logJoin(job.id, job.account_id, target.url, target.name, r.status, r.detail || null, {
      questions: r.questions || null,
      answers: r.answers || null,
      answer_source: r.answer_source || null,
    });

    // Simpan ke account_groups dengan keyword + join_status
    if (isOk) {
      const { v4: uid } = require('uuid');
      const groupId = target.url.match(/\/groups\/([^/?#]+)/)?.[1] || target.url;
      const joinStatus = (r.status === 'joined' || r.status === 'already_member') ? 'joined' : 'requested';
      db.prepare(`
        INSERT INTO account_groups (id, account_id, group_id, name, url, keyword, join_status, joined_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(account_id, group_id) DO UPDATE SET
          name = COALESCE(excluded.name, name),
          url = excluded.url,
          keyword = COALESCE(excluded.keyword, keyword),
          join_status = excluded.join_status,
          joined_at = COALESCE(joined_at, CURRENT_TIMESTAMP),
          last_seen = CURRENT_TIMESTAMP
      `).run(uid(), job.account_id, groupId, target.name || null, target.url, job.keyword || null, joinStatus);
    }

    db.prepare(
      `UPDATE auto_join_jobs SET
         last_run = CURRENT_TIMESTAMP,
         next_run = datetime('now', ? ),
         joined_today = joined_today + ?,
         total_joined = total_joined + ?,
         total_failed = total_failed + ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      `+${Math.floor(((job.join_delay_min || 90) + (job.join_delay_max || 240)) / 2)} seconds`,
      (r.status === 'joined' || r.status === 'requested') ? 1 : 0,
      (r.status === 'joined' || r.status === 'requested') ? 1 : 0,
      isOk ? 0 : 1,
      job.id
    );

    logSchedulerEvent({
      type: 'auto_join_run',
      userId: job.user_id,
      targetId: job.id,
      targetName: job.name,
      status: isOk ? 'success' : 'failed',
      message: `${target.url} → ${r.status}${r.detail ? ' · ' + r.detail : ''}`,
      durationMs: Date.now() - t0,
    });
  } catch (e) {
    console.error('[auto-join] runJobOnce error:', e.message, e.stack);
    logJoin(job.id, job.account_id, '-', null, 'error', e.message);
    db.prepare(`UPDATE auto_join_jobs SET last_run=CURRENT_TIMESTAMP, next_run=datetime('now','+15 minutes') WHERE id=?`).run(job.id);
  } finally {
    runningJobs.delete(job.id);
  }
}

async function tick() {
  // Ambil job yang status running dan due (next_run <= now atau next_run NULL)
  const due = db.prepare(
    `SELECT * FROM auto_join_jobs WHERE status = 'running' AND (next_run IS NULL OR next_run <= datetime('now'))`
  ).all();

  for (const job of due) {
    if (runningJobs.has(job.id)) continue;
    // Jangan paralel: jalankan satu per satu untuk menghindari overlap browser
    await runJobOnce(job).catch(e => console.error('[auto-join] tick error:', e.message, e.stack));
  }
}

function start() {
  if (!isEnabled()) {
    console.log('[auto-join-scheduler] disabled via config');
    return;
  }
  if (timer) return;
  const TICK_MS = getTickMs();
  console.log(`[auto-join-scheduler] enabled, tick setiap ${(TICK_MS / 1000).toFixed(0)} detik`);
  setTimeout(() => {
    tick().catch(e => console.error('[auto-join-scheduler] first tick error:', e.message));
    timer = setInterval(() => {
      tick().catch(e => console.error('[auto-join-scheduler] tick error:', e.message));
    }, TICK_MS);
  }, 30000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function isJobRunning(jobId) {
  return runningJobs.has(jobId);
}

module.exports = { start, stop, tick, runJobOnce, isJobRunning };
