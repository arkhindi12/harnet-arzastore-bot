const axios = require('axios');

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
];
function rUA() { return UA_POOL[Math.floor(Math.random() * UA_POOL.length)]; }

function extractPagesFromHtml(html) {
  const pages = [];
  const seen = new Set();

  // Pattern 1: GraphQL response with page data
  const patterns = [
    /"pageID":"(\d+)","name":"([^"]+)"/g,
    /"page_id":"(\d+)","name":"([^"]+)"/g,
    /"id":"(\d{10,})","name":"([^"]{2,60})","__typename":"Page"/g,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        pages.push({ id: m[1], name: m[2] });
      }
    }
  }

  // Pattern: linked pages
  const allPageIds = new Set([...html.matchAll(/"pageID":"(\d+)"/g)].map(m => m[1]));
  allPageIds.forEach(pid => {
    if (!seen.has(pid)) {
      const nameMatch = new RegExp(`"pageID":"${pid}"[^}]*?"name":"([^"]+)"`, 'g').exec(html);
      if (nameMatch) {
        seen.add(pid);
        pages.push({ id: pid, name: nameMatch[1] });
      }
    }
  });

  // Pattern: from bookmarks pages JSON
  const bookmarkPattern = /"id":"(\d{10,})","url":"[^"]*","name":"([^"]{2,60})","isPage":true/g;
  let bm;
  while ((bm = bookmarkPattern.exec(html)) !== null) {
    if (!seen.has(bm[1])) {
      seen.add(bm[1]);
      pages.push({ id: bm[1], name: bm[2] });
    }
  }

  return pages;
}

// Fetch managed pages pakai browser (Playwright) — lebih reliable daripada HTTP
async function fetchManagedPagesBrowser(account) {
  const { launchBrowser } = require('./browserQueue');
  const { parseCookies } = require('./facebookService');

  let browser;
  try {
    browser = await launchBrowser();
    const ctx = await browser.newContext({
      userAgent: account.user_agent || rUA(),
      viewport: { width: 1366, height: 800 },
      locale: 'id-ID',
    });
    const cookies = Object.entries(parseCookies(account.cookies)).map(([name, value]) => ({
      name, value: String(value), domain: '.facebook.com', path: '/', secure: true, sameSite: 'None',
    }));
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();

    // Buka /pages/?category=your_pages
    await page.goto('https://www.facebook.com/pages/?category=your_pages', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(4000);

    // Cek apakah ke login page
    const isLogin = await page.evaluate(() => {
      const url = window.location.href;
      const text = (document.body?.innerText || '').toLowerCase();
      return url.includes('/login') || (text.includes('masuk') && text.includes('buat akun baru'));
    });
    if (isLogin) {
      await ctx.close();
      return { pages: [], error: 'Cookies expired — login ulang akun' };
    }

    // Extract pages dari DOM dan dari script tags (GraphQL data)
    const result = await page.evaluate(() => {
      const pages = [];
      const seen = new Set();

      // Cara 1: Parse innerText body — ada section "Pages you manage" / "Halaman yang Anda kelola"
      const bodyText = document.body?.innerText || '';
      const sectionStart = bodyText.search(/pages you manage|halaman yang anda kelola|halaman yang dikelola/i);
      // End markers: section lain
      const endMarkers = [
        'deactivated and deleted',
        'halaman yang dinonaktifkan',
        'halaman yang anda ikuti',
        'followed pages',
        'liked pages',
        'invites',
        'discover',
        'create page',
      ];
      let sectionEnd = bodyText.length;
      for (const marker of endMarkers) {
        const idx = bodyText.toLowerCase().indexOf(marker, sectionStart + 1);
        if (idx > sectionStart && idx < sectionEnd) sectionEnd = idx;
      }

      if (sectionStart >= 0) {
        const slice = bodyText.substring(sectionStart, sectionEnd);
        const lines = slice.split('\n').map(l => l.trim()).filter(Boolean);
        // Skip header line, ambil baris yang bukan label
        const skipPatterns = /^(\d+\s*)?(notifications?|messages?|create post|promote|new|message|notifikasi|pesan|buat postingan|promosikan|notification|activate|aktifkan|deactivate|nonaktifkan)/i;
        const headerPattern = /^(pages you manage|halaman yang anda kelola|halaman yang dikelola)/i;
        for (const line of lines) {
          if (headerPattern.test(line)) continue;
          if (skipPatterns.test(line)) continue;
          if (line.length < 2 || line.length > 80) continue;
          if (/^\d+$/.test(line)) continue;
          // Bisa jadi nama page
          if (!seen.has(line)) {
            seen.add(line);
            pages.push({ id: '', name: line });
          }
        }
      }

      // Cara 2: Pattern GraphQL dari script
      const html = document.documentElement.outerHTML;
      const patterns = [
        /"page":\{"id":"(\d{10,})","name":"([^"]{2,80})"/g,
        /"__typename":"Page","id":"(\d{10,})","name":"([^"]{2,80})"/g,
        /"id":"(\d{10,})","name":"([^"]{2,80})"[^}]*?"__typename":"Page"/g,
        /"pageID":"(\d+)","name":"([^"]+)"/g,
      ];
      for (const pattern of patterns) {
        let m;
        while ((m = pattern.exec(html)) !== null) {
          const name = m[2].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
          // Match dengan page yang sudah di-extract dari text (cocokan nama untuk dapat ID)
          const existing = pages.find(p => p.name === name && !p.id);
          if (existing) {
            existing.id = m[1];
          } else if (!seen.has(name)) {
            seen.add(name);
            pages.push({ id: m[1], name });
          }
        }
      }

      return { pages: pages.filter(p => p.name), url: window.location.href };
    });

    await ctx.close();
    return { pages: result.pages, url: result.url };
  } catch (e) {
    return { pages: [], error: e.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// HTTP-only fallback (cepat tapi kurang reliable)
async function fetchManagedPages(cookieString, proxyUrl = null, account = null) {
  // Kalau ada account object, pakai browser approach (lebih reliable)
  if (account) {
    try {
      const r = await fetchManagedPagesBrowser(account);
      if (r.pages?.length > 0) return r.pages;
      // Fallback ke HTTP kalau browser gagal
    } catch {}
  }

  const ua = rUA();
  const headers = {
    'Cookie': cookieString.trim(),
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Referer': 'https://www.facebook.com/',
  };

  const urls = [
    'https://www.facebook.com/pages/?category=your_pages',
    'https://www.facebook.com/bookmarks/pages',
    'https://www.facebook.com/pages/creation/',
  ];

  let allPages = [];
  const seenIds = new Set();

  for (const url of urls) {
    try {
      const res = await axios.get(url, { headers, timeout: 15000 });
      const found = extractPagesFromHtml(res.data);
      for (const p of found) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allPages.push(p);
        }
      }
      if (allPages.length > 0) break;
    } catch (e) {
      continue;
    }
  }

  return allPages;
}

module.exports = { fetchManagedPages, fetchManagedPagesBrowser };
