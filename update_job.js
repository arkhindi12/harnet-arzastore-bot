const db = require('better-sqlite3')('/opt/arzastore-bot/data/app.db');

console.log('TZ:', process.env.TZ);
console.log('Current hour:', new Date().getHours());
console.log('Current time:', new Date().toISOString());

// Update active_hours_start to 7 and reset next_run
db.prepare(`UPDATE auto_join_jobs 
  SET active_hours_start = 7, 
      next_run = datetime('now', '-1 minute')
  WHERE status = 'running'`).run();

const job = db.prepare('SELECT * FROM auto_join_jobs WHERE status = "running"').get();
console.log('\nJob config:');
console.log('  Name:', job.name);
console.log('  Active hours:', job.active_hours_start, '-', job.active_hours_end);
console.log('  Daily limit:', job.daily_limit);
console.log('  Joined today:', job.joined_today);
console.log('  Next run:', job.next_run);
console.log('  Last run:', job.last_run);

// Check reset mechanism
console.log('\nChecking for daily reset logic...');
const schLog = db.prepare('SELECT * FROM scheduler_logs WHERE type LIKE "%reset%" ORDER BY created_at DESC LIMIT 5').all();
console.log('Reset logs:', schLog.length);
