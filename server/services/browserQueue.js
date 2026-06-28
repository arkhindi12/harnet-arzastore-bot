// Global Browser Queue dengan Priority berdasarkan plan user.
// Urutan prioritas: Ultimate (1) > Pro (2) > Starter (3) > Trial (4) > Unknown (5)
// Task dengan priority lebih tinggi (angka lebih kecil) didahulukan.

const db = require('../db/database');
const { getInt, get, getBool } = require('./systemConfig');
const { chromium, firefox, webkit } = require('patchright');

function getMaxConcurrent() {
  return getInt('browser_max_concurrent', 'BROWSER_MAX_CONCURRENT', 2);
}

function getBrowserEngine() {
  const engine = get('browser_engine', 'BROWSER_ENGINE', 'chromium');
  if (engine === 'firefox') return firefox;
  if (engine === 'webkit') return webkit;
  return chromium;
}

function getBrowserEngineName() {
  return get('browser_engine', 'BROWSER_ENGINE', 'chromium');
}

function isHeadless() {
  return getBool('browser_headless', 'BROWSER_HEADLESS', true);
}

function parseProxyUrl(proxyUrl) {
  if (!proxyUrl) return undefined;
  try {
    const url = new URL(proxyUrl);
    const result = { server: `${url.protocol}//${url.hostname}:${url.port}` };
    if (url.username) result.username = decodeURIComponent(url.username);
    if (url.password) result.password = decodeURIComponent(url.password);
    return result;
  } catch {
    return { server: proxyUrl };
  }
}

// Launch browser sesuai config admin
// Global browser semaphore — hanya 1 browser boleh jalan sekaligus (server 2GB RAM)
let activeBrowsers = 0;
const browserWaitQueue = [];
const MAX_WAIT_MS = 120000; // max 2 menit menunggu slot

async function waitForBrowserSlot() {
  if (activeBrowsers < 1) {
    activeBrowsers++;
    return;
  }
  return new Promise((resolve, reject) => {
    let resolved = false;
    const entry = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      // activeBrowsers sudah di-increment oleh releaseBrowserSlot saat dia memanggil kita
      resolve();
    };
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      const idx = browserWaitQueue.indexOf(entry);
      if (idx !== -1) browserWaitQueue.splice(idx, 1);
      reject(new Error('Browser slot timeout — server sibuk, coba lagi nanti'));
    }, MAX_WAIT_MS);
    browserWaitQueue.push(entry);
  });
}

function releaseBrowserSlot() {
  activeBrowsers = Math.max(0, activeBrowsers - 1);
  // Kalau ada yang nunggu, kasih slot ke yang pertama (FIFO)
  while (browserWaitQueue.length > 0 && activeBrowsers < 1) {
    const entry = browserWaitQueue.shift();
    activeBrowsers++;
    try { entry(); } catch (e) { /* timeout sudah di-handle */ }
  }
}

async function launchBrowser(extraArgs = []) {
  await waitForBrowserSlot();
  const engine = getBrowserEngine();
  const engineName = getBrowserEngineName();
  const headless = isHeadless();

  const opts = {
    headless: false,
    args: [
      '--headless=new',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-software-rasterizer',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-first-run',
      '--disable-crashpad',
      ...extraArgs,
    ],
  };

  try {
    const browser = await engine.launch(opts);
    // Wrap close to release slot (only once)
    let slotReleased = false;
    const releaseOnce = () => { if (!slotReleased) { slotReleased = true; releaseBrowserSlot(); } };
    const originalClose = browser.close.bind(browser);
    browser.close = async () => {
      try { await originalClose(); } catch {} finally { releaseOnce(); }
    };
    browser.on('disconnected', releaseOnce);
    return browser;
  } catch (e) {
    releaseBrowserSlot();
    throw e;
  }
}

// Launch browser + create context + humanize page (all-in-one helper)
// Now uses persistent browser profile per account for better stability
async function launchHumanizedContext(account, extraArgs = []) {
  const { humanize } = require('./humanBehavior');
  const { pickBestProxy } = require('./proxyLatencyMonitor');
  const { getOrCreateProfile, getProfilePath, saveCookiesToProfile, syncCookiesFromAccount, updateProfileMetadata } = require('./browserProfileService');

  // Get or create persistent profile for this account
  const profile = account?.id ? getOrCreateProfile(account.id) : null;
  const profilePath = profile?.profileDir;

  // Sync cookies from DB to profile storage (auto-sync setiap launch)
  if (account?.id && account?.cookies) {
    try {
      syncCookiesFromAccount(account.id);
    } catch (e) {
      // Non-blocking, continue even if sync fails
    }
  }

  // Add profile directory if available (persistent)
  // launchPersistentContext returns BrowserContext directly, not Browser
  let browser;
  let context;
  let isPersistent = false;
  const allArgs = [...extraArgs];

  if (profilePath) {
    // Using launchPersistentContext for full persistence (localStorage, IndexedDB survive)
    const { chromium, firefox, webkit } = require('patchright');
    const engine = getBrowserEngine();
    const headless = isHeadless();

    await waitForBrowserSlot();
    const pctx = await engine.launchPersistentContext(profilePath, {
      headless: false,
      args: [
        '--headless=new',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-software-rasterizer',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--no-first-run',
        '--disable-crashpad',
        ...allArgs,
      ],
      viewport: { width: 1366, height: 800 },
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });

    // pctx is BrowserContext, get browser via .browser()
    context = pctx;
    browser = pctx.browser();
    isPersistent = true;

    let slotReleased = false;
    const releaseOnce = () => { if (!slotReleased) { slotReleased = true; releaseBrowserSlot(); } };
    const originalClose = pctx.close.bind(pctx);
    pctx.close = async () => {
      try { await originalClose(); } catch {} finally { releaseOnce(); }
    };
  } else {
    browser = await launchBrowser(allArgs);
    // context akan dibuat di bawah via browser.newContext()
  }

  // Proxy selection: pilih proxy terbaik (latency terendah, alive) dari pool
  let proxyUrl = account?.proxy || null;
  let deadProxies = [];
  try { deadProxies = JSON.parse(account?.dead_proxies || '[]'); } catch {}

  if (account?.proxy_pool) {
    try {
      const pool = JSON.parse(account.proxy_pool);
      if (Array.isArray(pool) && pool.length > 0) {
        // Pilih proxy terbaik berdasarkan latency
        const best = pickBestProxy(pool, deadProxies);
        if (best) proxyUrl = best;
      }
    } catch {}
  } else if (proxyUrl && new Set(deadProxies).has(proxyUrl)) {
    proxyUrl = null;
  }

  // Get fingerprint dari profile untuk consistency
  const fingerprint = profile?.fingerprint || {};
  const userAgent = fingerprint.userAgent || account?.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

  // Create context (skip for persistent — context already exists)
  if (!isPersistent) {
    context = await browser.newContext({
      userAgent,
      viewport: { 
        width: fingerprint.screenWidth || 1366, 
        height: fingerprint.screenHeight || 800 
      },
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
      proxy: parseProxyUrl(proxyUrl),
    });
  }

  // Load cookies dari profile storage (bukan dari text field)
  if (account?.cookies) {
    const { parseCookies } = require('./facebookService');
    const parsed = parseCookies(account.cookies);
    const cookies = Object.entries(parsed).map(([name, value]) => ({
      name, value: String(value), domain: '.facebook.com', path: '/', httpOnly: false, secure: true, sameSite: 'None',
    }));

    // Hanya inject manual untuk non-persistent context.
    // Untuk persistent context, cookies sudah dibaca dari profile storage agar tidak loop redirect.
    if (!isPersistent) {
      await context.addCookies(cookies);
    }
    
    // Simpan cookies ke profile untuk persistence
    if (profile) {
      saveCookiesToProfile(account.id, cookies);
    }
  }

  const page = await context.newPage();
  await humanize(page);

  // Return dengan profile info untuk tracking
  return { 
    browser, context, page, proxyUsed: proxyUrl,
    profile: profile ? { profileId: profile.profileId, profileDir: profile.profileDir } : null,
  };
}

// Priority: dihitung dinamis dari harga plan (makin mahal = priority lebih tinggi)
// Admin = 0, lalu plan diurutkan dari termahal (priority 1) ke termurah, trial = paling bawah.
const DEFAULT_PRIORITY = 100;
const TRIAL_PRIORITY = 90;

// Cache plan priorities (refresh tiap 60 detik)
let planPriorityCache = null;
let planCacheTime = 0;

function getPlanPriorityMap() {
  if (planPriorityCache && Date.now() - planCacheTime < 60000) return planPriorityCache;
  try {
    // Ambil semua plan, sort by price DESC (termahal dulu)
    const plans = db.prepare('SELECT name, price FROM subscription_plans WHERE is_active = 1 ORDER BY price DESC').all();
    const map = {};
    plans.forEach((p, idx) => {
      // Priority 1 = termahal, 2 = kedua termahal, dst
      map[p.name.toLowerCase().trim()] = idx + 1;
    });
    planPriorityCache = map;
    planCacheTime = Date.now();
    return map;
  } catch {
    return {};
  }
}

let running = 0;
const queue = [];

function getPriorityForUser(userId) {
  if (!userId) return DEFAULT_PRIORITY;

  try {
    const user = db.prepare('SELECT role, is_trial, trial_end, expires_at FROM users WHERE id = ?').get(userId);
    if (!user) return DEFAULT_PRIORITY;
    if (user.role === 'admin') return 0; // Admin selalu paling prioritas

    const now = new Date();

    // Trial aktif
    if (user.is_trial && user.trial_end && new Date(user.trial_end) > now) {
      return TRIAL_PRIORITY;
    }

    // Langganan aktif — cari plan dari payment terakhir
    if (user.expires_at && new Date(user.expires_at) > now) {
      const payment = db.prepare(`
        SELECT sp.name, sp.price FROM payments p
        JOIN subscription_plans sp ON p.plan_id = sp.id
        WHERE p.user_id = ? AND p.status = 'paid'
        ORDER BY p.paid_at DESC LIMIT 1
      `).get(userId);

      if (payment) {
        const planMap = getPlanPriorityMap();
        const planName = (payment.name || '').toLowerCase().trim();
        const priority = planMap[planName];
        if (priority !== undefined) return priority;
        // Fallback: hitung dari harga relatif (makin mahal = makin kecil priority number)
        return Math.max(1, 50 - Math.floor((payment.price || 0) / 10000));
      }
    }

    return DEFAULT_PRIORITY;
  } catch {
    return DEFAULT_PRIORITY;
  }
}

function enqueue(fn, userId) {
  const priority = getPriorityForUser(userId);

  return new Promise((resolve, reject) => {
    const task = { fn, resolve, reject, priority, userId, createdAt: Date.now() };

    // Insert sorted: lower priority number = earlier in queue
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (priority < queue[i].priority) {
        queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) queue.push(task);

    processQueue();
  });
}

async function processQueue() {
  const MAX_CONCURRENT = getMaxConcurrent();
  if (running >= MAX_CONCURRENT || queue.length === 0) return;

  running++;
  const task = queue.shift();

  try {
    const result = await task.fn();
    task.resolve(result);
  } catch (err) {
    task.reject(err);
  } finally {
    running--;
    setImmediate(processQueue);
  }
}

function getStatus() {
  const MAX_CONCURRENT = getMaxConcurrent();
  const byPriority = {};
  for (const t of queue) {
    const label = t.priority === 0 ? 'admin' : t.priority >= 90 ? 'trial' : t.priority >= 50 ? 'free/expired' : `plan_p${t.priority}`;
    byPriority[label] = (byPriority[label] || 0) + 1;
  }

  return {
    running,
    queued: queue.length,
    queued_by_priority: byPriority,
    max_concurrent: MAX_CONCURRENT,
  };
}

// Helper: wrap any async function that uses browser through the queue
function withQueue(asyncFn) {
  return (...args) => enqueue(() => asyncFn(...args));
}

module.exports = { enqueue, withQueue, getStatus, getMaxConcurrent, getPriorityForUser, launchBrowser, launchHumanizedContext, getBrowserEngineName, isHeadless };
