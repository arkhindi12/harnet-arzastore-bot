// Helper: cek limit fitur berdasarkan subscription plan user.
// Return { allowed, limit, current, plan_name }

const db = require('../db/database');

const TRIAL_LIMITS = {
  max_accounts: 3,
  max_campaigns: 5,
};

function getUserLimits(userId) {
  const user = db.prepare('SELECT role, is_trial, trial_end, expires_at FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  // Admin selalu unlimited
  if (user.role === 'admin') {
    return { plan: 'Admin', max_accounts: 0, max_campaigns: 0 };
  }

  const now = new Date();
  const isTrial = user.is_trial && user.trial_end && new Date(user.trial_end) > now;
  const isActive = user.expires_at && new Date(user.expires_at) > now;

  if (isTrial) {
    return { plan: 'Trial', max_accounts: TRIAL_LIMITS.max_accounts, max_campaigns: TRIAL_LIMITS.max_campaigns };
  }

  if (isActive) {
    // Cari plan dari payment terakhir yang paid
    const payment = db.prepare(`
      SELECT sp.max_accounts, sp.max_campaigns, sp.name
      FROM payments p
      JOIN subscription_plans sp ON p.plan_id = sp.id
      WHERE p.user_id = ? AND p.status = 'paid'
      ORDER BY p.paid_at DESC LIMIT 1
    `).get(userId);
    if (payment) {
      return {
        plan: payment.name,
        max_accounts: payment.max_accounts || 0, // 0 = unlimited
        max_campaigns: payment.max_campaigns || 0,
      };
    }
    // Fallback: unlimited kalau ada expires_at tapi tidak ada payment record (admin set manual)
    return { plan: 'Custom', max_accounts: 0, max_campaigns: 0 };
  }

  return null; // expired
}

function checkAccountLimit(userId) {
  const limits = getUserLimits(userId);
  if (!limits) return { allowed: false, error: 'Langganan tidak aktif' };
  if (limits.max_accounts === 0) return { allowed: true }; // unlimited

  const current = db.prepare('SELECT COUNT(*) as cnt FROM fb_accounts WHERE user_id = ?').get(userId)?.cnt || 0;
  if (current >= limits.max_accounts) {
    return { allowed: false, error: `Batas akun tercapai (${current}/${limits.max_accounts}). Upgrade paket untuk menambah akun.`, current, limit: limits.max_accounts, plan: limits.plan };
  }
  return { allowed: true, current, limit: limits.max_accounts, plan: limits.plan };
}

function checkCampaignLimit(userId) {
  const limits = getUserLimits(userId);
  if (!limits) return { allowed: false, error: 'Langganan tidak aktif' };
  if (limits.max_campaigns === 0) return { allowed: true }; // unlimited

  const current = db.prepare("SELECT COUNT(*) as cnt FROM campaigns WHERE user_id = ? AND status != 'completed'").get(userId)?.cnt || 0;
  if (current >= limits.max_campaigns) {
    return { allowed: false, error: `Batas kampanye tercapai (${current}/${limits.max_campaigns}). Upgrade paket untuk menambah kampanye.`, current, limit: limits.max_campaigns, plan: limits.plan };
  }
  return { allowed: true, current, limit: limits.max_campaigns, plan: limits.plan };
}

module.exports = { getUserLimits, checkAccountLimit, checkCampaignLimit, TRIAL_LIMITS };
