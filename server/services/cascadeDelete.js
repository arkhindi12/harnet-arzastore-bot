// Helper terpadu untuk cascade delete.
// SQLite di project ini punya banyak FK ke fb_accounts(id) & users(id) tapi
// tidak pakai ON DELETE CASCADE. Helper ini bersihkan semua child rows
// dalam satu transaction supaya integrity terjaga & DELETE tidak gagal FK.

const db = require('../db/database');

// Tabel yang punya FOREIGN KEY (account_id) -> fb_accounts(id)
const ACCOUNT_CHILD_TABLES_FK = [
  'comment_logs',
  'post_task_logs',
  // warming_plans di-handle terpisah karena ada warming_logs yang refer ke plan_id
];

// Tabel lain yang menyimpan account_id (tanpa FK eksplisit) — bersihkan supaya tidak orphan
const ACCOUNT_CHILD_TABLES_NOFK = [
  'niche_groups',
  'niche_search_runs',
  'page_bots',
  'auto_join_jobs',
  'auto_join_logs',
  'profile_setup_queue',
  'page_group_capability',
  'ab_test_logs',
  'keyword_monitor_logs',
  'account_groups',
  'account_feed_posts',
  'account_like_logs',
];

/**
 * Hapus akun FB beserta semua data turunannya.
 * @param {string} accountId
 */
function deleteAccountCascade(accountId) {
  const tx = db.transaction(() => {
    // Tabel dengan FK eksplisit
    for (const t of ACCOUNT_CHILD_TABLES_FK) {
      try { db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).run(accountId); } catch {}
    }

    // warming_plans -> warming_logs (logs tidak punya FK, hapus by plan_id)
    try {
      const plans = db.prepare('SELECT id FROM warming_plans WHERE account_id = ?').all(accountId);
      const delLogs = db.prepare('DELETE FROM warming_logs WHERE plan_id = ?');
      for (const p of plans) delLogs.run(p.id);
      db.prepare('DELETE FROM warming_plans WHERE account_id = ?').run(accountId);
    } catch {}

    // Tabel tanpa FK
    for (const t of ACCOUNT_CHILD_TABLES_NOFK) {
      try { db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).run(accountId); } catch {}
    }

    // Hapus browser profile directory
    try {
      const { deleteProfile } = require('./browserProfileService');
      deleteProfile(accountId);
    } catch {}

    // Akhirnya, hapus akun
    db.prepare('DELETE FROM fb_accounts WHERE id = ?').run(accountId);
  });
  tx();
}

/**
 * Hapus user beserta semua data terkait.
 * Dipanggil dari /api/admin/users/:id.
 * @param {string} userId
 */
function deleteUserCascade(userId) {
  const tx = db.transaction(() => {
    // Hapus semua FB akun user (cascade ke logs juga)
    const accounts = db.prepare('SELECT id FROM fb_accounts WHERE user_id = ?').all(userId);
    for (const a of accounts) {
      // panggil inline tx (sudah dalam tx besar)
      for (const t of ACCOUNT_CHILD_TABLES_FK) {
        try { db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).run(a.id); } catch {}
      }
      try {
        const plans = db.prepare('SELECT id FROM warming_plans WHERE account_id = ?').all(a.id);
        const delLogs = db.prepare('DELETE FROM warming_logs WHERE plan_id = ?');
        for (const p of plans) delLogs.run(p.id);
        db.prepare('DELETE FROM warming_plans WHERE account_id = ?').run(a.id);
      } catch {}
      for (const t of ACCOUNT_CHILD_TABLES_NOFK) {
        try { db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).run(a.id); } catch {}
      }
    }
    try { db.prepare('DELETE FROM fb_accounts WHERE user_id = ?').run(userId); } catch {}

    // Campaign + comment_logs (FK)
    try {
      const camps = db.prepare('SELECT id FROM campaigns WHERE user_id = ?').all(userId);
      const delCommentLogs = db.prepare('DELETE FROM comment_logs WHERE campaign_id = ?');
      for (const c of camps) delCommentLogs.run(c.id);
      db.prepare('DELETE FROM campaigns WHERE user_id = ?').run(userId);
    } catch {}

    // Post tasks + logs
    try {
      const tasks = db.prepare('SELECT id FROM post_tasks WHERE user_id = ?').all(userId);
      const delTaskLogs = db.prepare('DELETE FROM post_task_logs WHERE task_id = ?');
      for (const t of tasks) delTaskLogs.run(t.id);
      db.prepare('DELETE FROM post_tasks WHERE user_id = ?').run(userId);
    } catch {}

    // Tabel-tabel lain yang ber-user_id
    const userOwned = [
      'keyword_monitors', 'keyword_monitor_logs',
      'auto_replies', 'auto_reply_logs',
      'ab_tests', 'ab_test_logs',
      'auto_join_jobs', 'auto_join_logs',
      'webhooks', 'api_keys', 'blacklists',
      'comment_templates', 'campaign_templates',
      'feature_requests', 'feature_votes',
      'groq_keys', 'niche_groups', 'niche_search_runs',
      'page_bots', 'profile_setup_queue', 'page_group_capability',
      'group_quality', 'roi_settings', 'user_settings',
      'warming_plans', 'warming_logs',
      'referrals', 'withdrawals', 'payments',
      'team_members', 'teams',
    ];
    for (const t of userOwned) {
      try { db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId); } catch {}
    }
    // Beberapa tabel pakai owner_id / referrer_id / referred_id
    try { db.prepare('DELETE FROM teams WHERE owner_id = ?').run(userId); } catch {}
    try { db.prepare('DELETE FROM referrals WHERE referrer_id = ? OR referred_id = ?').run(userId, userId); } catch {}

    // Akhirnya, hapus user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  tx();
}

module.exports = { deleteAccountCascade, deleteUserCascade };
