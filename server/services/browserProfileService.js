// Browser Profile Service: Persistent browser context storage per account
// Stores: cookies, localStorage, indexedDB, fingerprint, session cache
// Benefits: More natural than raw cookies, survives restarts, easier account recovery

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// Base directory for all browser profiles
const PROFILES_ROOT = path.join(process.env.BROWSER_PROFILES_DIR || '/opt/arzastore-bot/data/browser-profiles');

// Ensure profiles directory exists
function ensureProfilesDir() {
  if (!fs.existsSync(PROFILES_ROOT)) {
    fs.mkdirSync(PROFILES_ROOT, { recursive: true });
  }
}

// Generate fingerprint for account (UA, screen, plugins, etc.)
function generateFingerprint(account = {}) {
  const components = {
    userAgent: account.user_agent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    screenWidth: Math.random() > 0.5 ? 1920 : 1366,
    screenHeight: Math.random() > 0.5 ? 1080 : 768,
    colorDepth: 24,
    timezone: 'Asia/Jakarta',
    language: 'id-ID',
    plugins: ['PDF Viewer', 'Chrome Remote Desktop Viewer'],
    webgl: `WebGL ${Math.floor(Math.random() * 100)}`,
    canvas: crypto.randomBytes(16).toString('hex'),
  };
  return components;
}

// Create new browser profile for account
function createProfile(accountId) {
  ensureProfilesDir();
  const profileId = uuidv4();
  const profileDir = path.join(PROFILES_ROOT, accountId, profileId);
  
  // Create subdirectories
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(path.join(profileDir, 'Default', 'Cache'), { recursive: true });
  fs.mkdirSync(path.join(profileDir, 'Default', 'Code Cache'), { recursive: true });
  fs.mkdirSync(path.join(profileDir, 'Default', 'IndexedDB'), { recursive: true });
  fs.mkdirSync(path.join(profileDir, 'Default', 'Service Worker'), { recursive: true });
  fs.mkdirSync(path.join(profileDir, 'Default', 'Session Storage'), { recursive: true });
  fs.mkdirSync(path.join(profileDir, 'Default', 'Local Storage'), { recursive: true });

  // Create profile metadata
  const fingerprint = generateFingerprint();
  
  // Store in DB
  const profileEntry = {
    id: profileId,
    account_id: accountId,
    profile_dir: profileDir,
    fingerprint: JSON.stringify(fingerprint),
    last_used: new Date().toISOString(),
    size_mb: 0,
    cookies_count: 0,
    localStorage_count: 0,
    session_storage_count: 0,
  };

  db.prepare(`
    INSERT INTO browser_profiles 
    (id, account_id, profile_dir, fingerprint, last_used, size_mb, cookies_count, localStorage_count, session_storage_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    profileEntry.id, profileEntry.account_id, profileEntry.profile_dir, profileEntry.fingerprint,
    profileEntry.last_used, profileEntry.size_mb, profileEntry.cookies_count,
    profileEntry.localStorage_count, profileEntry.session_storage_count
  );

  // Update fb_accounts with profile dir
  db.prepare('UPDATE fb_accounts SET browser_profile_dir = ? WHERE id = ?').run(profileDir, accountId);

  return { profileId, profileDir, fingerprint };
}

// Get or create profile for account
function getOrCreateProfile(accountId) {
  let profile = db.prepare('SELECT * FROM browser_profiles WHERE account_id = ? ORDER BY last_used DESC LIMIT 1').get(accountId);
  
  if (profile) {
    // Update last_used
    db.prepare('UPDATE browser_profiles SET last_used = ? WHERE id = ?').run(
      new Date().toISOString(), profile.id
    );
    return {
      profileId: profile.id,
      profileDir: profile.profile_dir,
      fingerprint: JSON.parse(profile.fingerprint || '{}'),
    };
  }

  return createProfile(accountId);
}

// Save cookies to profile (will be loaded via Playwright later)
function saveCookiesToProfile(accountId, cookies) {
  const profile = getOrCreateProfile(accountId);
  const cookiesFile = path.join(profile.profileDir, 'cookies.json');
  
  fs.writeFileSync(cookiesFile, JSON.stringify(cookies, null, 2));
  
  // Update count in DB
  db.prepare('UPDATE browser_profiles SET cookies_count = ? WHERE id = ?').run(
    cookies.length, profile.profileId
  );
}

// Load cookies from profile
function loadCookiesFromProfile(accountId) {
  const profile = db.prepare('SELECT profile_dir FROM browser_profiles WHERE account_id = ? LIMIT 1').get(accountId);
  if (!profile) return [];
  
  const cookiesFile = path.join(profile.profile_dir, 'cookies.json');
  if (!fs.existsSync(cookiesFile)) return [];
  
  try {
    return JSON.parse(fs.readFileSync(cookiesFile, 'utf-8'));
  } catch {
    return [];
  }
}

// Sync cookies from fb_accounts.cookies field to profile storage
function syncCookiesFromAccount(accountId) {
  const accountDb = require('../db/database');
  const account = accountDb.prepare('SELECT cookies FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account || !account.cookies) return { synced: false, reason: 'No cookies in account' };

  const { parseCookies } = require('./facebookService');
  const parsed = parseCookies(account.cookies);
  const cookies = Object.entries(parsed).map(([name, value]) => ({
    name,
    value: String(value),
    domain: '.facebook.com',
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'None',
  }));

  if (cookies.length === 0) return { synced: false, reason: 'No valid cookies parsed' };

  saveCookiesToProfile(accountId, cookies);
  return { synced: true, count: cookies.length };
}

// Get profile directory path (for Playwright --user-data-dir)
function getProfilePath(accountId) {
  const profile = db.prepare('SELECT profile_dir FROM browser_profiles WHERE account_id = ? ORDER BY last_used DESC LIMIT 1').get(accountId);
  return profile?.profile_dir || null;
}

// Calculate profile size on disk
function getProfileSize(profileDir) {
  if (!fs.existsSync(profileDir)) return 0;
  
  let size = 0;
  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else {
        size += stat.size;
      }
    }
  }
  walk(profileDir);
  return Math.round(size / 1024 / 1024 * 100) / 100; // MB
}

// Export profile as zip (for backup)
async function exportProfile(accountId) {
  const profile = db.prepare('SELECT * FROM browser_profiles WHERE account_id = ? ORDER BY last_used DESC LIMIT 1').get(accountId);
  if (!profile) throw new Error('Profile not found');
  
  const archiver = require('archiver');
  const archiveFile = path.join(os.tmpdir(), `profile-${accountId}-${Date.now()}.zip`);
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(archiveFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      const size = fs.statSync(archiveFile).size;
      resolve({ archiveFile, size });
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(profile.profile_dir, false);
    archive.finalize();
  });
}

// Delete profile
function deleteProfile(accountId) {
  const profile = db.prepare('SELECT * FROM browser_profiles WHERE account_id = ? ORDER BY last_used DESC LIMIT 1').get(accountId);
  if (!profile) return false;
  
  if (fs.existsSync(profile.profile_dir)) {
    fs.rmSync(profile.profile_dir, { recursive: true, force: true });
  }
  
  db.prepare('DELETE FROM browser_profiles WHERE account_id = ?').run(accountId);
  db.prepare('UPDATE fb_accounts SET browser_profile_dir = NULL WHERE id = ?').run(accountId);
  
  return true;
}

// Get profile stats
function getProfileStats(accountId) {
  const profile = db.prepare('SELECT * FROM browser_profiles WHERE account_id = ? ORDER BY last_used DESC LIMIT 1').get(accountId);
  if (!profile) return null;
  
  const sizeMb = getProfileSize(profile.profile_dir);
  
  return {
    profileId: profile.id,
    accountId: profile.account_id,
    profileDir: profile.profile_dir,
    fingerprint: JSON.parse(profile.fingerprint || '{}'),
    lastUsed: profile.last_used,
    sizeMb,
    cookiesCount: profile.cookies_count,
    localStorageCount: profile.localStorage_count,
    sessionStorageCount: profile.session_storage_count,
    createdAt: profile.created_at,
  };
}

// Update profile metadata after browser session
function updateProfileMetadata(accountId, stats = {}) {
  const profile = db.prepare('SELECT id FROM browser_profiles WHERE account_id = ? ORDER BY last_used DESC LIMIT 1').get(accountId);
  if (!profile) return;
  
  db.prepare(`
    UPDATE browser_profiles 
    SET last_used = ?, size_mb = ?, cookies_count = ?, localStorage_count = ?, session_storage_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    stats.sizeMb || 0,
    stats.cookiesCount || 0,
    stats.localStorageCount || 0,
    stats.sessionStorageCount || 0,
    profile.id
  );
}

module.exports = {
  ensureProfilesDir,
  generateFingerprint,
  createProfile,
  getOrCreateProfile,
  saveCookiesToProfile,
  loadCookiesFromProfile,
  syncCookiesFromAccount,
  getProfilePath,
  getProfileSize,
  exportProfile,
  deleteProfile,
  getProfileStats,
  updateProfileMetadata,
};
