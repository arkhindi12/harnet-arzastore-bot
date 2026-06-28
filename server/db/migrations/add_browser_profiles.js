// Migration: Add persistent browser profile support
// Adds browser_profile_dir to fb_accounts + browser_profiles table

const db = require('../database');

function migrate() {
  console.log('[Migration] Adding browser profile support...');

  // 1. Add browser_profile_dir column to fb_accounts
  try {
    db.prepare(`
      ALTER TABLE fb_accounts 
      ADD COLUMN browser_profile_dir TEXT
    `).run();
    console.log('✅ Added browser_profile_dir column to fb_accounts');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('⚠️  browser_profile_dir already exists, skipping');
    } else {
      throw e;
    }
  }

  // 2. Create browser_profiles table for metadata
  db.prepare(`
    CREATE TABLE IF NOT EXISTS browser_profiles (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      profile_dir TEXT NOT NULL,
      fingerprint TEXT,
      last_used DATETIME,
      size_mb REAL DEFAULT 0,
      cookies_count INTEGER DEFAULT 0,
      localStorage_count INTEGER DEFAULT 0,
      session_storage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES fb_accounts(id) ON DELETE CASCADE
    )
  `).run();
  console.log('✅ Created browser_profiles table');

  // 3. Create index for fast lookup
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_browser_profiles_account 
    ON browser_profiles(account_id)
  `).run();
  console.log('✅ Created index on browser_profiles');

  console.log('[Migration] Browser profile support added successfully');
}

// Run if called directly
if (require.main === module) {
  try {
    migrate();
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  }
}

module.exports = { migrate };
