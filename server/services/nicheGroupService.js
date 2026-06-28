// Service Auto-Discover Grup Niche.
// User input keyword bisnis → buka Facebook search /search/groups/?q={keyword}
// pakai akun cookie, scroll, ambil daftar grup beserta member estimate.
// Hasil disimpan ke `niche_groups` agar user bisa import ke `account_groups`.

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');
const obscuraService = require('./obscuraService');

async function withBrowser(account, fn, userId) { return browserEnqueue(() => _withBrowserRaw(account, fn), userId || account?.user_id || null); }
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { parseCookies } = require('./facebookService');

const runningSearches = new Set(); // key = `${userId}:${keyword}:${accountId}`

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
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 800 },
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

function parseMembersText(t) {
  if (!t) return null;
  const cleaned = t.replace(/\./g, '').replace(/,/g, '').toLowerCase();
  const m = cleaned.match(/([\d]+(?:\.\d+)?)\s*(rb|ribu|jt|juta|k|m)?/);
  if (!m) return null;
  let num = parseFloat(m[1]);
  const unit = m[2];
  if (unit === 'rb' || unit === 'ribu' || unit === 'k') num *= 1000;
  if (unit === 'jt' || unit === 'juta' || unit === 'm') num *= 1000000;
  return Math.round(num);
}

function logRun(userId, accountId, keyword, status, found, durationMs, message) {
  db.prepare(
    'INSERT INTO niche_search_runs (id, user_id, account_id, keyword, status, found, duration_ms, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), userId, accountId || null, keyword, status, found || 0, durationMs || null, message || null);
}

async function searchNicheGroups(userId, accountId, keyword, options = {}) {
  const engine = options.browser_engine || 'patchright';
  if (engine === 'obscura') {
    const t0 = Date.now();
    const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
    if (!account) return { status: 'error', message: 'Akun tidak ditemukan' };
    try {
      const r = await obscuraService.searchGroups(account, keyword, options.max || 20);
      const groups = r.groups || [];
      const { v4: uuidv4 } = require('uuid');
      let saved = 0;
      for (const g of groups) {
        try {
          db.prepare(`INSERT OR IGNORE INTO niche_groups (id,user_id,account_id,keyword,group_id,name,url,discovered_at)
            VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).run(uuidv4(), userId, accountId, keyword, g.group_id, g.name, g.url);
          saved++;
        } catch(e2) {}
      }
      logRun(userId, accountId, keyword, 'completed', saved, Date.now()-t0, '[obscura] ' + saved + ' grup ditemukan');
      return { status: 'completed', found: saved, groups };
    } catch(e) {
      logRun(userId, accountId, keyword, 'error', 0, Date.now()-t0, e.message);
      return { status: 'error', message: e.message };
    }
  }
  // patchright flow below
  if (!keyword || keyword.trim().length < 2) {
    return { success: false, error: 'Keyword minimal 2 karakter' };
  }

  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!account) return { success: false, error: 'Akun tidak ditemukan' };

  const key = `${userId}:${keyword}:${accountId}`;
  if (runningSearches.has(key)) return { success: false, error: 'Pencarian niche dengan keyword ini sedang berjalan' };
  runningSearches.add(key);

  const startedAt = Date.now();
  const max = Math.max(5, Math.min(parseInt(options.max) || 30, 80));

  try {
    const groups = await withBrowser(account, async (page) => {
      const url = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(keyword)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);

      // Handle warning "Are you sure you want to continue?" (keyword sensitif)
      const warningHandled = await page.evaluate(async () => {
        const text = (document.body?.innerText || '').toLowerCase();
        if (text.includes('are you sure you want to continue') || text.includes('yakin ingin melanjutkan') || text.includes('sometimes associated with') || text.includes('berkaitan dengan ketelanjangan')) {
          // Cari span/elemen leaf yang berisi teks "Lanjutkan" atau "Continue"
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          while (walker.nextNode()) {
            const el = walker.currentNode;
            const t = (el.textContent || '').trim();
            if (el.children.length === 0 && /^(continue|lanjutkan)$/i.test(t)) {
              // Naik ke parent yang clickable (div/span/a dengan cursor pointer atau role)
              let target = el;
              for (let i = 0; i < 5; i++) {
                target = target.parentElement;
                if (!target) break;
                const style = window.getComputedStyle(target);
                const role = target.getAttribute('role');
                if (role === 'button' || role === 'link' || target.tagName === 'A' || target.tagName === 'BUTTON' || style.cursor === 'pointer') {
                  target.click();
                  await new Promise(r => setTimeout(r, 3000));
                  return true;
                }
              }
              // Fallback: klik span langsung
              el.click();
              await new Promise(r => setTimeout(r, 3000));
              return true;
            }
          }
        }
        return false;
      });
      if (warningHandled) await page.waitForTimeout(3000);

      // Tutup popup/notifikasi
      await page.evaluate(() => {
        const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
        for (const el of closers) if (el.offsetParent) el.click();
      });
      await page.waitForTimeout(800);

      // Scroll sampai cukup
      const collected = new Map();
      const maxScroll = Math.max(6, Math.ceil(max / 5));
      for (let i = 0; i < maxScroll; i++) {
        const items = await page.evaluate(() => {
          const out = new Map();
          const containers = document.querySelectorAll('[role="article"], [role="listitem"], div[aria-label*="grup"], div[aria-label*="group"]');
          const candidates = containers.length ? containers : [document.body];
          const anchors = document.querySelectorAll('a[href*="/groups/"]');
          for (const a of anchors) {
            const href = a.getAttribute('href') || '';
            const m = href.match(/\/groups\/([^/?#]+)\/?/);
            if (!m) continue;
            const slug = m[1];
            if (['feed', 'discover', 'create', 'joins', 'membership', 'browse'].includes(slug)) continue;
            const fullUrl = `https://www.facebook.com/groups/${slug}/`;
            // cari container terdekat untuk nama + member text
            let card = a;
            for (let i = 0; i < 6 && card; i++) {
              if (card.matches && card.matches('[role="article"]')) break;
              card = card.parentElement;
            }
            const cardEl = card || a.parentElement;
            const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
            const cardText = (cardEl?.innerText || '').replace(/\s+/g, ' ').trim();
            // Nama grup: text anchor kalau panjang, kalau tidak coba ambil heading di card
            let name = text;
            if (!name || name.length < 4) {
              const h = cardEl?.querySelector('h2, [role="heading"], strong');
              if (h) name = (h.textContent || '').replace(/\s+/g, ' ').trim();
            }
            if (!name) name = slug;
            // Member text: cari "anggota" / "members" di cardText
            const memberMatch = cardText.match(/([\d.,]+\s*(?:rb|ribu|jt|juta|k|m)?)\s*(?:anggota|members|member)/i);
            const membersText = memberMatch ? memberMatch[1] : null;
            // Privacy
            let privacy = null;
            if (/grup publik|public group/i.test(cardText)) privacy = 'public';
            else if (/grup privat|private group/i.test(cardText)) privacy = 'private';
            const description = cardText.split('\n').filter(s => s && s.length > 20 && s.length < 200).slice(0, 1)[0] || null;
            if (!out.has(slug)) {
              out.set(slug, { id: slug, url: fullUrl, name: name.slice(0, 120), members_text: membersText, privacy, description });
            }
          }
          return [...out.values()];
        });

        for (const it of items) {
          if (!collected.has(it.id)) collected.set(it.id, it);
          if (collected.size >= max) break;
        }
        if (collected.size >= max) break;

        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
        await page.waitForTimeout(1800);
      }

      return [...collected.values()];
    });

    const enriched = groups.map(g => ({
      ...g,
      members_estimate: parseMembersText(g.members_text),
    }));

    const insert = db.prepare(
      `INSERT INTO niche_groups (id, user_id, account_id, keyword, group_id, name, url, members_text, members_estimate, privacy, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, keyword, url) DO UPDATE SET
         name = excluded.name,
         members_text = excluded.members_text,
         members_estimate = excluded.members_estimate,
         privacy = excluded.privacy,
         description = excluded.description,
         account_id = excluded.account_id`
    );
    const tx = db.transaction((items) => {
      for (const g of items) {
        insert.run(uuidv4(), userId, accountId, keyword, g.id, g.name, g.url, g.members_text || null, g.members_estimate || null, g.privacy || null, g.description || null);
      }
    });
    tx(enriched);

    const duration = Date.now() - startedAt;
    logRun(userId, accountId, keyword, 'success', enriched.length, duration, `${enriched.length} grup ditemukan`);
    return { success: true, count: enriched.length, groups: enriched };
  } catch (err) {
    const duration = Date.now() - startedAt;
    logRun(userId, accountId, keyword, 'failed', 0, duration, err.message);
    return { success: false, error: err.message };
  } finally {
    runningSearches.delete(key);
  }
}

function listNicheGroups(userId, opts = {}) {
  const params = [userId];
  let where = 'WHERE user_id = ?';
  if (opts.keyword) {
    where += ' AND keyword = ?';
    params.push(opts.keyword);
  }
  const limit = Math.max(10, Math.min(parseInt(opts.limit) || 100, 300));
  return db.prepare(
    `SELECT id, account_id, keyword, group_id, name, url, members_text, members_estimate, privacy, description, imported, posts_per_day, activity_level, avg_comments, enriched_at, discovered_at FROM niche_groups ${where} ORDER BY discovered_at DESC LIMIT ${limit}`
  ).all(...params);
}

function listKeywords(userId) {
  return db.prepare(
    'SELECT keyword, COUNT(*) as count, MAX(discovered_at) as last_at FROM niche_groups WHERE user_id = ? GROUP BY keyword ORDER BY last_at DESC'
  ).all(userId);
}

function importNicheGroupsToAccount(userId, accountId, ids) {
  const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!account) return { success: false, error: 'Akun tidak ditemukan' };
  if (!Array.isArray(ids) || ids.length === 0) return { success: false, error: 'Tidak ada grup yang dipilih' };

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM niche_groups WHERE user_id = ? AND id IN (${placeholders})`
  ).all(userId, ...ids);

  const insertGroup = db.prepare(
    `INSERT INTO account_groups (id, account_id, group_id, name, url, last_seen)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(account_id, group_id) DO UPDATE SET name = excluded.name, url = excluded.url, last_seen = CURRENT_TIMESTAMP`
  );
  const markImported = db.prepare('UPDATE niche_groups SET imported = 1 WHERE id = ?');
  const tx = db.transaction((items) => {
    for (const g of items) {
      insertGroup.run(uuidv4(), accountId, g.group_id || g.url, g.name, g.url);
      markImported.run(g.id);
    }
  });
  tx(rows);
  return { success: true, imported: rows.length };
}

function getRunningStatus(userId) {
  return [...runningSearches].filter(k => k.startsWith(`${userId}:`)).map(k => {
    const [, keyword, accountId] = k.split(':');
    return { keyword, account_id: accountId };
  });
}

function getRecentRuns(userId, limit = 30) {
  return db.prepare(
    'SELECT keyword, account_id, status, found, duration_ms, message, created_at FROM niche_search_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, Math.max(5, Math.min(limit, 100)));
}

module.exports = {
  searchNicheGroups,
  listNicheGroups,
  listKeywords,
  importNicheGroupsToAccount,
  getRunningStatus,
  getRecentRuns,
  enrichGroupDetail,
};

// Enrichment: buka halaman About grup, parse stats (posts/day, activity)
async function enrichGroupDetail(userId, accountId, nicheGroupId) {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!account) return { success: false, error: 'Akun tidak ditemukan' };

  const group = db.prepare('SELECT * FROM niche_groups WHERE id = ? AND user_id = ?').get(nicheGroupId, userId);
  if (!group) return { success: false, error: 'Grup tidak ditemukan' };

  const { launchBrowser } = require('./browserQueue');
  const { parseCookies } = require('./facebookService');

  const browser = await launchBrowser();
  try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      const cookies = Object.entries(parseCookies(account.cookies)).map(([name, value]) => ({
        name, value: String(value), domain: '.facebook.com', path: '/', secure: true, sameSite: 'None',
      }));
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();

      // Buka halaman About grup (lebih reliable daripada feed)
      const aboutUrl = group.url.replace(/\/$/, '') + '/about';
      await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Deteksi cookie expired (halaman login)
      const isLoginPage = await page.evaluate(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        const url = window.location.href;
        return url.includes('/login') || url.includes('/checkpoint') ||
          (text.includes('masuk') && text.includes('buat akun baru')) ||
          (text.includes('log in') && text.includes('create new account'));
      });
      if (isLoginPage) {
        await ctx.close().catch(() => {});
        return { success: false, error: `Cookies akun "${account.name}" expired — login ulang dan update cookies` };
      }

      // Tutup popup
      await page.evaluate(() => {
        const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
        for (const el of closers) if (el.offsetParent) el.click();
      });
      await page.waitForTimeout(1000);

      // Parse stats dari halaman About
      const stats = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        let postsToday = 0;
        let postsMonth = 0;
        let totalMembers = 0;
        let newMembersWeek = 0;

        for (const line of lines) {
          // "40+ postingan per hari" / "40+ posts per day" / "30+ postingan/hari"
          const perDayMatch = line.match(/(\d+[.,]?\d*)\+?\s*(?:postingan|post)s?\s*\/?\s*(?:per\s*)?hari|(\d+[.,]?\d*)\+?\s*posts?\s*\/?\s*(?:per\s*)?day/i);
          if (perDayMatch) {
            const num = perDayMatch[1] || perDayMatch[2];
            if (num) postsToday = parseFloat(num.replace(',', '.'));
          }

          // "17 postingan baru hari ini" / "17 new posts today"
          const todayMatch = line.match(/(\d+[.,]?\d*)\s*(?:postingan baru hari ini|new post.*today|post.*hari ini)/i);
          if (todayMatch) postsToday = Math.max(postsToday, parseFloat(todayMatch[1].replace(',', '.')));

          // "88 dalam sebulan terakhir" / "88 in the last month"
          const monthMatch = line.match(/(\d+[.,]?\d*)\s*(?:dalam sebulan|in the last month|sebulan terakhir|past month)/i);
          if (monthMatch) postsMonth = parseFloat(monthMatch[1].replace(',', '.'));

          // "1.119 anggota total" / "1,119 total members" / "19 rb anggota" / "19k members"
          const memberMatch = line.match(/(\d+[.,]?\d*)\s*(rb|k|ribu|thousand|jt|m|juta|million)?\s*(?:anggota|member)/i);
          if (memberMatch) {
            let n = parseFloat(memberMatch[1].replace(/\./g, '').replace(',', '.'));
            const unit = (memberMatch[2] || '').toLowerCase();
            if (['rb', 'k', 'ribu', 'thousand'].includes(unit)) n *= 1000;
            else if (['jt', 'm', 'juta', 'million'].includes(unit)) n *= 1000000;
            totalMembers = Math.max(totalMembers, Math.round(n));
          }

          // "+ 820 dalam minggu lalu" / "+ 820 in the last week"
          const weekMatch = line.match(/\+?\s*(\d+[.,]?\d*)\s*(?:dalam minggu|in the last week|minggu lalu|past week)/i);
          if (weekMatch) newMembersWeek = parseFloat(weekMatch[1].replace(',', '.'));
        }

        // Estimasi posts per day
        let postsPerDay = postsToday;
        if (!postsPerDay && postsMonth > 0) postsPerDay = Math.round(postsMonth / 30 * 10) / 10;

        return { postsToday, postsMonth, postsPerDay, totalMembers, newMembersWeek };
      });

      await page.close();
      await ctx.close();

      // Determine activity level
      let activityLevel = 'low';
      if (stats.postsPerDay >= 10) activityLevel = 'high';
      else if (stats.postsPerDay >= 3) activityLevel = 'medium';

      // Estimasi avg comments (dari posts/day — rough heuristic)
      // Grup aktif biasanya 2-5 komentar per post
      const avgComments = stats.postsPerDay >= 10 ? 4 : stats.postsPerDay >= 3 ? 2.5 : 1;

      // Update DB
      db.prepare(`UPDATE niche_groups SET posts_per_day = ?, activity_level = ?, avg_comments = ?, members_estimate = CASE WHEN ? > 0 THEN ? ELSE members_estimate END, enriched_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(stats.postsPerDay || 0, activityLevel, avgComments, stats.totalMembers, stats.totalMembers, nicheGroupId);

      return {
        success: true,
        posts_per_day: stats.postsPerDay || 0,
        posts_today: stats.postsToday,
        posts_month: stats.postsMonth,
        activity_level: activityLevel,
        avg_comments: avgComments,
        total_members: stats.totalMembers,
        new_members_week: stats.newMembersWeek,
      };
    } finally {
      await browser.close().catch(() => {});
    }
}
