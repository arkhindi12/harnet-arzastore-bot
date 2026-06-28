// Service browser discovery untuk akun Facebook.
// Pakai Patchright (Playwright + anti-detection patches) sebagai sidecar:
// browser hanya nyala saat sync, lalu mati.
// Hasil: daftar grup + post IDs feed disimpan ke DB.

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');

async function withBrowser(account, fn, userId) { return browserEnqueue(() => _withBrowserRaw(account, fn), userId || account?.user_id || null); }
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { parseCookies, createProxyAgent } = require('./facebookService');

function parseProxyUrl(proxyUrl) {
  if (!proxyUrl) return undefined;
  try {
    const url = new URL(proxyUrl);
    return {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch {
    return { server: proxyUrl };
  }
}

// Migrasi DB: simpan hasil discovery
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_groups (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT,
      url TEXT NOT NULL,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, group_id)
    );
    CREATE TABLE IF NOT EXISTS account_feed_posts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      url TEXT,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS discovery_runs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      groups_found INTEGER DEFAULT 0,
      posts_found INTEGER DEFAULT 0,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS account_like_logs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch {}

// Bersihkan URL fake `/permalink/{id}` lama (tidak punya owner)
try {
  db.prepare("DELETE FROM account_feed_posts WHERE url LIKE '%/permalink/%' AND url NOT LIKE '%/groups/%/permalink/%'").run();
} catch {}

// Konversi cookies (string JSON / key=value) ke format Playwright
function cookiesToPlaywright(cookieString) {
  const parsed = parseCookies(cookieString);
  return Object.entries(parsed).map(([name, value]) => ({
    name,
    value: String(value),
    domain: '.facebook.com',
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'None',
  }));
}

async function _withBrowserRaw(account, fn) {
  const launchOptions = {
    headless: true,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  };

  // Patchright stealth: gunakan persistent context jika perlu, untuk discovery satu kali cukup non-persistent.
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
      proxy: parseProxyUrl(account.proxy),
    });

    await context.addCookies(cookiesToPlaywright(account.cookies));

    const page = await context.newPage();
    try {
      return await fn(page, context);
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

function logRun(accountId, type, status, message, extra = {}) {
  db.prepare(
    'INSERT INTO discovery_runs (id, account_id, type, status, message, groups_found, posts_found, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), accountId, type, status, message || null, extra.groups || 0, extra.posts || 0, extra.duration || null);
}

async function discoverGroups(accountId) {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return { success: false, error: 'Akun tidak ditemukan' };

  const startedAt = Date.now();
  try {
    const groups = await withBrowser(account, async (page) => {
      await page.goto('https://www.facebook.com/groups/joins', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      // Cek apakah halaman menampilkan list grup. Kalau redirect ke /feed atau lain, fallback.
      const onJoinsPage = await page.evaluate(() => {
        const url = window.location.href;
        return url.includes('/groups/joins') || url.includes('/joins');
      });

      // Kalau /joins tidak available, coba /your_feed atau /feed
      if (!onJoinsPage) {
        await page.goto('https://www.facebook.com/groups/feed/', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
      }

      // Auto-scroll sampai tidak ada konten baru (max 30 kali untuk safety)
      let prevHeight = 0;
      let stableCount = 0;
      for (let i = 0; i < 30; i++) {
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        if (currentHeight === prevHeight) {
          stableCount++;
          if (stableCount >= 3) break; // 3x stable = stop
        } else {
          stableCount = 0;
        }
        prevHeight = currentHeight;
        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
      }

      // Ambil semua link /groups/{id|slug}/
      return await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/groups/"]');
        const seen = new Map();
        const cleanText = (s) => (s || '')
          .replace(/^Belum dibaca/i, '')
          .replace(/Selamat datang di /i, '')
          .replace(/\.\.\.$/, '')
          .replace(/Sekarang Anda bisa.*$/i, '')
          .trim()
          .slice(0, 80);
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          const m = href.match(/\/groups\/([^/?#]+)(?:\/|$|\?)/);
          if (!m) continue;
          const slug = m[1];
          if (slug === 'feed' || slug === 'discover' || slug === 'create' || slug === 'joins' || slug === 'membership') continue;
          const url = `https://www.facebook.com/groups/${slug}/`;
          const text = cleanText(a.textContent);
          const existing = seen.get(slug);
          if (!existing || (text && text !== slug && (existing.name === slug || existing.name.length < text.length))) {
            seen.set(slug, { id: slug, name: text || slug, url });
          }
        }
        return [...seen.values()];
      });
    });

    const insert = db.prepare(
      'INSERT INTO account_groups (id, account_id, group_id, name, url) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id, group_id) DO UPDATE SET name = excluded.name, url = excluded.url, last_seen = CURRENT_TIMESTAMP'
    );
    const tx = db.transaction((items) => {
      for (const g of items) insert.run(uuidv4(), accountId, g.id, g.name, g.url);
    });
    tx(groups);

    const duration = Date.now() - startedAt;
    logRun(accountId, 'groups', 'success', `${groups.length} grup ditemukan`, { groups: groups.length, duration });
    return { success: true, count: groups.length, groups };
  } catch (err) {
    const duration = Date.now() - startedAt;
    logRun(accountId, 'groups', 'failed', err.message, { duration });
    return { success: false, error: err.message };
  }
}

async function discoverFeedPostIds(accountId, max = 30) {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return { success: false, error: 'Akun tidak ditemukan' };

  const startedAt = Date.now();
  try {
    const posts = await withBrowser(account, async (page) => {
      const collected = new Map();

      const extractFromCurrentPage = async () => {
        return await page.evaluate(() => {
          const items = new Map();
          const normalize = (rawHref) => {
            if (!rawHref) return null;
            let url;
            try { url = new URL(rawHref, 'https://www.facebook.com'); } catch { return null; }
            if (!url.hostname.includes('facebook.com')) return null;
            url.hash = '';
            const keep = ['story_fbid', 'id'];
            const params = new URLSearchParams();
            for (const [k, v] of url.searchParams) if (keep.includes(k)) params.set(k, v);
            url.search = params.toString();
            url.hostname = 'www.facebook.com';
            return url.toString().replace(/\/$/, '');
          };
          const isValidPostUrl = (u) => {
            if (!u) return false;
            if (/\/groups\/[^/]+\/posts\/\d+/i.test(u)) return true;
            if (/\/groups\/[^/]+\/permalink\/\d+/i.test(u)) return true;
            if (/facebook\.com\/[^/]+\/posts\/(?:pfbid)?[A-Za-z0-9]+/i.test(u)) return true;
            if (/\/story\.php\?.*story_fbid=\d+/i.test(u) && /id=\d+/i.test(u)) return true;
            return false;
          };
          const extractPostId = (u) => {
            const m = u.match(/\/posts\/(\d+)/) || u.match(/\/permalink\/(\d+)/) || u.match(/story_fbid=(\d+)/);
            return m ? m[1] : null;
          };
          const anchors = document.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid="]');
          for (const a of anchors) {
            const raw = a.getAttribute('href');
            const norm = normalize(raw);
            if (!norm || !isValidPostUrl(norm)) continue;
            const pid = extractPostId(norm);
            if (!pid) continue;
            if (!items.has(pid)) {
              const title = (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
              items.set(pid, { id: pid, url: norm, title: title || null });
            }
          }
          return [...items.values()];
        });
      };

      // Tahap 1: feed home
      try {
        await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
          await page.waitForTimeout(1500);
        }
        const homeItems = await extractFromCurrentPage();
        for (const it of homeItems) collected.set(it.id, it);
      } catch {}

      // Tahap 2: kalau feed home kosong, ambil dari grup yang sudah tersimpan
      if (collected.size === 0) {
        let storedGroups = db.prepare('SELECT url FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC LIMIT 5').all(accountId);

        // Auto-trigger sync grup kalau kosong
        if (storedGroups.length === 0) {
          try {
            await page.close();
          } catch {}
          // Tidak bisa panggil discoverGroups dari sini karena dia juga bikin browser baru,
          // jadi cukup catat di log dan kembalikan kosong. Scheduler/UI akan trigger groups dulu.
          return [];
        }

        for (const g of storedGroups) {
          if (collected.size >= max) break;
          try {
            await page.goto(g.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            for (let i = 0; i < 6; i++) {
              await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
              await page.waitForTimeout(2000);
            }
            const groupItems = await extractFromCurrentPage();
            for (const it of groupItems) {
              if (!collected.has(it.id)) collected.set(it.id, it);
              if (collected.size >= max) break;
            }
          } catch {}
        }
      }

      return [...collected.values()];
    });

    const top = posts.slice(0, max);
    const insert = db.prepare(
      'INSERT INTO account_feed_posts (id, account_id, post_id, url, last_seen) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(account_id, post_id) DO UPDATE SET url = excluded.url, last_seen = CURRENT_TIMESTAMP'
    );
    const tx = db.transaction((items) => {
      for (const p of items) insert.run(uuidv4(), accountId, p.id, p.url);
    });
    tx(top);

    const duration = Date.now() - startedAt;
    logRun(accountId, 'feed_posts', 'success', `${top.length} post ID ditemukan`, { posts: top.length, duration });
    return { success: true, count: top.length, posts: top };
  } catch (err) {
    const duration = Date.now() - startedAt;
    logRun(accountId, 'feed_posts', 'failed', err.message, { duration });
    return { success: false, error: err.message };
  }
}

function getStoredGroups(accountId) {
  return db.prepare('SELECT group_id, name, url, last_seen FROM account_groups WHERE account_id = ? ORDER BY last_seen DESC').all(accountId);
}

function getStoredFeedPostIds(accountId, limit = 30) {
  return db.prepare('SELECT post_id, url, last_seen FROM account_feed_posts WHERE account_id = ? ORDER BY last_seen DESC LIMIT ?').all(accountId, limit);
}

function getRecentRuns(accountId, limit = 20) {
  return db.prepare('SELECT type, status, message, groups_found, posts_found, duration_ms, created_at FROM discovery_runs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?').all(accountId, limit);
}

async function likePostsViaBrowser(accountId, postsOrIds, maxLikes = 5) {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(accountId);
  if (!account) return { liked: 0, error: 'Akun tidak ditemukan' };
  if (!Array.isArray(postsOrIds) || postsOrIds.length === 0) return { liked: 0, error: 'Tidak ada post target' };

  // Normalisasi input: bisa array string id, atau array {id, url}, atau array string URL
  const targets = postsOrIds.slice(0, maxLikes).map((p) => {
    if (typeof p === 'string') {
      // Cek apakah URL atau ID
      if (p.startsWith('http')) return { id: null, url: p };
      // ID telanjang: ambil URL dari DB kalau ada
      const row = db.prepare('SELECT url FROM account_feed_posts WHERE account_id = ? AND post_id = ?').get(accountId, p);
      return { id: p, url: row?.url || null };
    }
    return { id: p.id || null, url: p.url || null };
  }).filter(t => t.url);

  if (targets.length === 0) {
    return { liked: 0, error: 'Tidak ada URL valid untuk di-like (post ID lama tanpa URL kanonis)' };
  }

  const startedAt = Date.now();
  let liked = 0;
  const detail = [];
  const insertLog = db.prepare('INSERT INTO account_like_logs (id, account_id, url, title, status, detail) VALUES (?, ?, ?, ?, ?, ?)');

  try {
    await withBrowser(account, async (page) => {
      for (const target of targets) {
        const url = target.url;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(3000);

          // Tutup popup notifikasi/dialog yang menutupi post
          await page.evaluate(() => {
            const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
            for (const el of closers) {
              if (el.offsetParent !== null) el.click();
            }
            // Tekan Escape untuk dialog umum
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          });
          await page.waitForTimeout(1000);

          // Deteksi halaman tidak tersedia / dihapus / private
          const pageState = await page.evaluate(() => {
            const text = document.body?.innerText || '';
            const lower = text.toLowerCase();
            if (/halaman ini tidak tersedia|content not available|halaman tidak tersedia|page isn't available|page not available|tautan mungkin rusak/i.test(text)) {
              return { state: 'unavailable', title: document.title };
            }
            if (/log in|masuk untuk melihat/i.test(lower) && !document.cookie.includes('c_user')) {
              return { state: 'login_required', title: document.title };
            }
            return { state: 'ok', title: document.title };
          });

          if (pageState.state !== 'ok') {
            detail.push({ url, status: pageState.state });
            insertLog.run(uuidv4(), accountId, url, pageState.title || null, pageState.state, 'Halaman target tidak bisa dibuka');
            continue;
          }

          // Cari tombol Like yang ada di dalam article/feed
          const result = await page.evaluate(async () => {
            // Strategi: cari semua role=button dengan aria-label exact "Suka" atau "Like" yang visible
            // dan TIDAK di dalam header/navigation/notification panel
            const isInExcludedRegion = (el) => {
              let cur = el;
              while (cur) {
                const role = cur.getAttribute && cur.getAttribute('role');
                if (role === 'banner' || role === 'navigation' || role === 'dialog' || role === 'complementary') return true;
                cur = cur.parentElement;
              }
              return false;
            };

            // Scroll ke article pertama supaya tombol Like ter-render
            const article = document.querySelector('[role="article"]');
            if (article) {
              article.scrollIntoView({ block: 'center' });
              await new Promise(r => setTimeout(r, 1500));
            }

            const candidates = document.querySelectorAll('[role="button"][aria-label]');
            for (const el of candidates) {
              if (!el.offsetParent) continue;
              if (isInExcludedRegion(el)) continue;
              const label = (el.getAttribute('aria-label') || '').toLowerCase().trim();
              const pressed = el.getAttribute('aria-pressed');
              if (label === 'like' || label === 'suka') {
                if (pressed === 'true') return { state: 'already_liked', label };
                el.scrollIntoView({ block: 'center' });
                await new Promise(r => setTimeout(r, 500));
                el.click();
                return { state: 'clicked', label };
              }
              // Some posts use "Hapus suka" / "Remove like" when already liked
              if ((label.startsWith('hapus suka') || label.startsWith('remove like')) && pressed !== 'false') {
                return { state: 'already_liked', label };
              }
            }
            return { state: 'no_like_button' };
          });

          // Verifikasi: tunggu dan cek apakah aria-pressed true sekarang
          if (result.state === 'clicked') {
            await page.waitForTimeout(2500);
            const verified = await page.evaluate(() => {
              const candidates = document.querySelectorAll('[role="button"][aria-label]');
              for (const el of candidates) {
                if (!el.offsetParent) continue;
                const label = (el.getAttribute('aria-label') || '').toLowerCase().trim();
                const pressed = el.getAttribute('aria-pressed');
                if (pressed === 'true' && (label === 'like' || label === 'suka')) return true;
                if (label.startsWith('hapus suka') || label.startsWith('remove like')) return true;
              }
              return false;
            });
            if (verified) {
              liked++;
              detail.push({ url, status: 'liked' });
              insertLog.run(uuidv4(), accountId, url, pageState.title, 'liked', null);
            } else {
              detail.push({ url, status: 'click_not_confirmed' });
              insertLog.run(uuidv4(), accountId, url, pageState.title, 'click_not_confirmed', 'Tombol diklik tapi state tidak berubah');
            }
          } else if (result.state === 'already_liked') {
            liked++;
            detail.push({ url, status: 'already_liked' });
            insertLog.run(uuidv4(), accountId, url, pageState.title, 'already_liked', null);
          } else {
            detail.push({ url, status: result.state });
            insertLog.run(uuidv4(), accountId, url, pageState.title, result.state, 'Tombol Like tidak ditemukan di area post');
          }

          await page.waitForTimeout(2000 + Math.random() * 2000);
        } catch (e) {
          detail.push({ url, status: 'error', error: e.message });
          insertLog.run(uuidv4(), accountId, url, null, 'error', e.message);
        }
      }
    });
  } catch (err) {
    logRun(accountId, 'like_browser', 'failed', err.message, { duration: Date.now() - startedAt });
    return { liked, error: err.message, detail };
  }

  const duration = Date.now() - startedAt;
  logRun(accountId, 'like_browser', liked > 0 ? 'success' : 'failed', `${liked}/${targets.length} like berhasil`, { posts: liked, duration });
  return { liked, total: targets.length, detail };
}

function getRecentLikeLogs(accountId, limit = 20) {
  return db.prepare('SELECT url, title, status, detail, created_at FROM account_like_logs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?').all(accountId, limit);
}

module.exports = { discoverGroups, discoverFeedPostIds, getStoredGroups, getStoredFeedPostIds, getRecentRuns, likePostsViaBrowser, getRecentLikeLogs };
