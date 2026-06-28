const db = require('../db/database');

function getHeatmapData(userId) {
  const commentData = db.prepare(`
    SELECT 
      CAST(strftime('%H', cl.created_at) AS INTEGER) as hour,
      CAST(strftime('%w', cl.created_at) AS INTEGER) as dow,
      COUNT(*) as total,
      SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END) as success_count
    FROM comment_logs cl
    JOIN campaigns c ON cl.campaign_id = c.id
    WHERE c.user_id = ?
    GROUP BY hour, dow
  `).all(userId);

  const postData = db.prepare(`
    SELECT 
      CAST(strftime('%H', ptl.created_at) AS INTEGER) as hour,
      CAST(strftime('%w', ptl.created_at) AS INTEGER) as dow,
      COUNT(*) as total,
      SUM(CASE WHEN ptl.status = 'success' THEN 1 ELSE 0 END) as success_count
    FROM post_task_logs ptl
    JOIN post_tasks pt ON ptl.task_id = pt.id
    WHERE pt.user_id = ?
    GROUP BY hour, dow
  `).all(userId);

  const combined = {};
  const merge = (row) => {
    const key = `${row.dow}_${row.hour}`;
    if (!combined[key]) combined[key] = { hour: row.hour, dow: row.dow, total: 0, success: 0 };
    combined[key].total += row.total;
    combined[key].success += row.success_count;
  };
  commentData.forEach(merge);
  postData.forEach(merge);

  return Object.values(combined);
}

function getOverallStats(userId) {
  const campaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?').get(userId);
  const accounts = db.prepare("SELECT COUNT(*) as count, SUM(status='active') as active, SUM(status='checkpoint') as checkpoint, SUM(status='invalid') as invalid FROM fb_accounts WHERE user_id = ?").get(userId);
  const comments = db.prepare(`SELECT COUNT(*) as total, SUM(cl.status='success') as success, SUM(cl.status='failed') as failed FROM comment_logs cl JOIN campaigns c ON cl.campaign_id = c.id WHERE c.user_id = ?`).get(userId);
  const posts = db.prepare(`SELECT COUNT(*) as total, SUM(ptl.status='success') as success, SUM(ptl.status='failed') as failed FROM post_task_logs ptl JOIN post_tasks pt ON ptl.task_id = pt.id WHERE pt.user_id = ?`).get(userId);
  const tasks = db.prepare('SELECT COUNT(*) as count FROM post_tasks WHERE user_id = ?').get(userId);
  const monitors = db.prepare('SELECT COUNT(*) as count FROM keyword_monitors WHERE user_id = ?').get(userId);
  const autoreplies = db.prepare('SELECT COUNT(*) as count FROM auto_replies WHERE user_id = ?').get(userId);

  return { campaigns, accounts, comments, posts, tasks, monitors, autoreplies };
}

function getSuccessRateByHour(userId) {
  return db.prepare(`
    SELECT 
      CAST(strftime('%H', cl.created_at) AS INTEGER) as hour,
      COUNT(*) as total,
      SUM(CASE WHEN cl.status='success' THEN 1 ELSE 0 END) as success
    FROM comment_logs cl
    JOIN campaigns c ON cl.campaign_id = c.id
    WHERE c.user_id = ?
    GROUP BY hour ORDER BY hour
  `).all(userId);
}

function getRecentActivity(userId, limit = 50) {
  const comments = db.prepare(`
    SELECT 'comment' as type, cl.status, cl.created_at, cl.target_url as target, cl.comment_text as content, fa.name as account_name
    FROM comment_logs cl
    JOIN campaigns c ON cl.campaign_id = c.id
    JOIN fb_accounts fa ON cl.account_id = fa.id
    WHERE c.user_id = ?
    ORDER BY cl.created_at DESC LIMIT ?
  `).all(userId, limit);

  const posts = db.prepare(`
    SELECT 'post' as type, ptl.status, ptl.created_at, ptl.target, ptl.content, fa.name as account_name
    FROM post_task_logs ptl
    JOIN post_tasks pt ON ptl.task_id = pt.id
    JOIN fb_accounts fa ON ptl.account_id = fa.id
    WHERE pt.user_id = ?
    ORDER BY ptl.created_at DESC LIMIT ?
  `).all(userId, limit);

  return [...comments, ...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

module.exports = { getHeatmapData, getOverallStats, getSuccessRateByHour, getRecentActivity };
