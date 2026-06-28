const db = require('../db/database');

function toLevel(score) {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function computeFatigueForAccount(accountId) {
  const dayRow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM comment_logs
    WHERE account_id = ? AND created_at >= datetime('now', '-24 hours')
  `).get(accountId) || {};

  const total = Number(dayRow.total || 0);
  const failed = Number(dayRow.failed || 0);
  const success = Number(dayRow.success || 0);

  const failRatio = total > 0 ? failed / total : 0;

  // Points:
  // - volume: 0..40
  // - failure ratio: 0..45
  // - burst activity (3 jam terakhir): 0..15
  const volumeScore = Math.min(40, total * 1.25);
  const failScore = Math.min(45, failRatio * 70);

  const burstRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM comment_logs
    WHERE account_id = ? AND created_at >= datetime('now', '-3 hours')
  `).get(accountId) || { total: 0 };
  const burst = Number(burstRow.total || 0);
  const burstScore = Math.min(15, Math.max(0, burst - 8));

  const score = Math.max(0, Math.min(100, volumeScore + failScore + burstScore));
  const level = toLevel(score);

  return { score, level, total, success, failed, failRatio };
}

function applyFatiguePolicy(accountId) {
  const f = computeFatigueForAccount(accountId);

  let cooldownUntil = null;
  // Cooldown adaptive
  if (f.level === 'high') {
    cooldownUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  } else if (f.level === 'medium' && f.failRatio > 0.45 && f.total >= 12) {
    cooldownUntil = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  }

  db.prepare(`
    UPDATE fb_accounts
    SET fatigue_score = ?,
        fatigue_level = ?,
        fatigue_updated_at = CURRENT_TIMESTAMP,
        cooldown_until = ?
    WHERE id = ?
  `).run(Number(f.score.toFixed(2)), f.level, cooldownUntil, accountId);

  return { ...f, cooldownUntil };
}

function isAccountCoolingDown(account) {
  if (!account?.cooldown_until) return false;
  return new Date(account.cooldown_until).getTime() > Date.now();
}

module.exports = {
  computeFatigueForAccount,
  applyFatiguePolicy,
  isAccountCoolingDown,
};
