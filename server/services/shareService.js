// Service share post Facebook ke grup via browser headless (Patchright).
// Mendukung share dari profil pribadi (default) atau "as page".

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');

async function withBrowser(account, fn, userId) { return browserEnqueue(() => _withBrowserRaw(account, fn), userId || account?.user_id || null); }
const db = require('../db/database');
const { parseCookies } = require('./facebookService');

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
    name, value: String(value), domain: '.facebook.com', path: '/',
    httpOnly: false, secure: true, sameSite: 'None',
  }));
}

async function _withBrowserRaw(account, fn) {
  const browser = await launchBrowser();
  try {
    const ctx = await browser.newContext({
      userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 800 },
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
      proxy: parseProxyUrl(account.proxy),
    });
    await ctx.addCookies(cookiesToPlaywright(account.cookies));
    const page = await ctx.newPage();
    try {
      return await fn(page, ctx);
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

function pause(ms, jitter = 0.3) {
  const j = ms * jitter * (Math.random() * 2 - 1);
  return new Promise(r => setTimeout(r, Math.max(500, ms + j)));
}

async function closeOverlays(page) {
  try {
    await page.evaluate(() => {
      const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
      for (const el of closers) if (el.offsetParent !== null) el.click();
    });
  } catch {}
  await pause(800);
}

/**
 * Share 1 post ke 1 grup target.
 * @param {Object} account     row dari fb_accounts
 * @param {string} postUrl     URL post sumber (profile/fanpage post)
 * @param {string} groupUrl    URL grup tujuan (https://facebook.com/groups/<id>/)
 * @param {Object} opts
 * @param {string} [opts.message]  caption tambahan saat share
 * @param {string} [opts.shareAs]  'self' (default) | 'page'
 * @param {string} [opts.pageName] nama page kalau shareAs='page'
 * @returns {Promise<{success, message?, error?, code?}>}
 */
async function sharePostToGroup(account, postUrl, groupUrl, opts = {}) {
  const groupIdMatch = (groupUrl || '').match(/facebook\.com\/groups\/([^/?#]+)/);
  if (!groupIdMatch) return { success: false, error: 'URL grup tidak valid', code: 'INVALID_GROUP_URL' };
  const groupId = groupIdMatch[1];

  return await withBrowser(account, async (page) => {
    try {
      // Buka post sumber
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pause(3500);
      await closeOverlays(page);

      // Cek halaman tidak tersedia
      const pageState = await page.evaluate(() => {
        const t = document.body?.innerText || '';
        if (/halaman ini tidak tersedia|content not available|page isn't available|tautan mungkin rusak/i.test(t)) return 'unavailable';
        return 'ok';
      });
      if (pageState !== 'ok') return { success: false, error: 'Post sumber tidak bisa dibuka', code: 'POST_UNAVAILABLE' };

      // Klik tombol Share / Bagikan / Kirim. Coba banyak variasi label karena FB pakai
      // teks beda untuk post biasa, foto, reels, dan locale id-ID vs en-US.
      const shareClicked = await page.evaluate(async () => {
        const article = document.querySelector('[role="article"]');
        if (article) article.scrollIntoView({ block: 'center' });
        await new Promise(r => setTimeout(r, 800));

        const isShareLabel = (label) => {
          const l = label.toLowerCase().trim();
          if (!l) return false;
          // Indonesian
          if (l === 'bagikan' || l === 'berbagi') return true;
          if (l.startsWith('bagikan ') || l.startsWith('berbagi ')) return true;
          if (l.startsWith('kirim ini ke teman') || l.startsWith('kirim ini ke')) return true;
          if (l.startsWith('kirim postingan')) return true;
          // English
          if (l === 'share') return true;
          if (l.startsWith('share ')) return true;
          if (l.startsWith('send this to friends') || l.startsWith('send this to')) return true;
          if (l.startsWith('send post')) return true;
          return false;
        };

        // Pass 1: cari di area article (post body) atau photo viewer dialog
        const inAllowedRegion = (el) => {
          // Reject yang di banner/navigation/komposer
          const banned = el.closest('[role="banner"], [role="navigation"]');
          if (banned) return false;
          // Tapi izinkan dialog photo viewer (FB photo URL render dialog modal)
          return true;
        };

        const candidates = document.querySelectorAll('[role="button"][aria-label]');
        for (const el of candidates) {
          if (!el.offsetParent) continue;
          if (!inAllowedRegion(el)) continue;
          const label = el.getAttribute('aria-label') || '';
          if (!isShareLabel(label)) continue;
          el.scrollIntoView({ block: 'center' });
          el.click();
          return { ok: true, label };
        }

        // Pass 2: tombol non-aria dengan teks Bagikan/Share di footer post
        const allButtons = document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], button');
        for (const el of allButtons) {
          if (!el.offsetParent) continue;
          if (!inAllowedRegion(el)) continue;
          const txt = (el.textContent || '').trim().toLowerCase();
          if (txt === 'bagikan' || txt === 'share' || txt === 'berbagi') {
            el.scrollIntoView({ block: 'center' });
            el.click();
            return { ok: true, label: 'text:' + txt };
          }
        }
        return { ok: false, sampleLabels: [...candidates].slice(0, 30).map(c => c.getAttribute('aria-label')).filter(Boolean) };
      });

      if (!shareClicked.ok) {
        // Fallback: kalau post URL langsung tidak punya tombol share,
        // coba buka halaman fanpage dan cari post di sana (FB sering hide share di direct URL)
        const pageMatch = postUrl.match(/facebook\.com\/([^/]+)\/posts\//);
        if (pageMatch) {
          const pageSlug = pageMatch[1];
          await page.goto(`https://www.facebook.com/${pageSlug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await pause(4000);
          await closeOverlays(page);

          // Cari tombol share di post pertama di halaman fanpage
          const retryShare = await page.evaluate(async () => {
            const articles = document.querySelectorAll('[role="article"]');
            for (const art of articles) {
              const btns = [...art.querySelectorAll('[role="button"][aria-label]')].filter(el => el.offsetParent);
              for (const el of btns) {
                const label = (el.getAttribute('aria-label') || '').toLowerCase();
                if (label.includes('kirim ini') || label.includes('send this') || label.includes('share')) {
                  el.scrollIntoView({ block: 'center' });
                  el.click();
                  return { ok: true, label };
                }
              }
            }
            return { ok: false };
          });

          if (!retryShare.ok) {
            return { success: false, error: 'Tombol Bagikan tidak ditemukan di post maupun halaman fanpage', code: 'SHARE_BUTTON_NOT_FOUND' };
          }
        } else {
          const sample = (shareClicked.sampleLabels || []).slice(0, 5).join(' | ');
          return { success: false, error: `Tombol Bagikan tidak ditemukan${sample ? '. Sample label: ' + sample : ''}`, code: 'SHARE_BUTTON_NOT_FOUND' };
        }
      }
      await pause(2200);

      // Menu/dialog share muncul. Facebook layout baru:
      // 1) Dialog langsung ada "Share to a group" (layout lama), ATAU
      // 2) Dialog punya "Share to" → submenu → "Group" (layout baru 2025+)
      const groupOptionClicked = await page.evaluate(async () => {
        const dialog = document.querySelector('[role="dialog"], [role="menu"]');
        const haystack = dialog || document;
        const items = [...haystack.querySelectorAll('[role="menuitem"], [role="button"], a, [role="link"], span')]
          .filter(el => el.offsetParent);

        // Coba layout lama: langsung ada "Bagikan ke grup" / "Share to a group"
        for (const el of items) {
          const txt = (el.textContent || '').toLowerCase().trim();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase().trim();
          if (txt === 'bagikan ke grup' || txt === 'share to a group' ||
              txt === 'bagikan dalam grup' || txt === 'share to group' ||
              aria === 'bagikan ke grup' || aria === 'share to a group') {
            el.scrollIntoView({ block: 'center' });
            el.click();
            return { ok: true, label: txt || aria, method: 'direct' };
          }
        }

        // Layout baru: klik "Share to" / "Bagikan ke" dulu
        for (const el of items) {
          const txt = (el.textContent || '').toLowerCase().trim();
          if (txt === 'share to' || txt === 'bagikan ke') {
            el.scrollIntoView({ block: 'center' });
            el.click();
            await new Promise(r => setTimeout(r, 2000));

            // Sekarang cari "Group" / "Grup" di submenu
            const subItems = [...document.querySelectorAll('[role="dialog"] [role="menuitem"], [role="dialog"] [role="button"], [role="dialog"] a, [role="dialog"] span')]
              .filter(e => e.offsetParent);
            for (const sub of subItems) {
              const subTxt = (sub.textContent || '').toLowerCase().trim();
              if (subTxt === 'group' || subTxt === 'grup' || subTxt === 'groups') {
                sub.scrollIntoView({ block: 'center' });
                sub.click();
                return { ok: true, label: subTxt, method: 'share_to_submenu' };
              }
            }
            return { ok: false, reason: 'submenu_no_group' };
          }
        }

        return { ok: false, reason: 'no_share_to_option' };
      });

      if (!groupOptionClicked.ok) {
        return { success: false, error: 'Opsi "Bagikan ke grup" tidak ditemukan di menu share', code: 'SHARE_TO_GROUP_OPTION_MISSING' };
      }
      await pause(2500);

      // Dialog grup muncul. Pilih grup sesuai groupId/groupUrl.
      const groupSelected = await page.evaluate(async (targetId) => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;

        // Strategi 1: cari anchor di dalam dialog yang href-nya match group id, lalu klik tile parent-nya
        const anchors = dialog.querySelectorAll('a[href*="/groups/"]');
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          if (href.includes('/groups/' + targetId)) {
            // Cari tile clickable di atas anchor (biasanya [role="button"] parent)
            let p = a;
            for (let i = 0; i < 6 && p; i++) {
              if (p.getAttribute && (p.getAttribute('role') === 'button' || p.tagName === 'BUTTON')) {
                p.scrollIntoView({ block: 'center' });
                p.click();
                return true;
              }
              p = p.parentElement;
            }
            // fallback: klik anchor langsung
            a.scrollIntoView({ block: 'center' });
            a.click();
            return true;
          }
        }
        return false;
      }, groupId);

      if (!groupSelected) {
        // Strategi alternatif: ketik di search box "Cari grup", lalu klik hasil
        const typed = await page.evaluate(async (gid) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;
          const searchInput = dialog.querySelector('input[type="search"], input[aria-label="Cari grup"], input[placeholder*="Cari grup"], input[placeholder*="Search groups"], input[type="text"]');
          if (!searchInput) return false;
          searchInput.focus();
          // Pakai native setter supaya React register perubahan
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(searchInput, '');
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 300));
          setter.call(searchInput, gid);
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }, groupId);
        if (typed) {
          await pause(2500);
          const picked = await page.evaluate((gid) => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return false;
            const anchors = dialog.querySelectorAll('a[href*="/groups/"]');
            for (const a of anchors) {
              const href = a.getAttribute('href') || '';
              if (href.includes('/groups/' + gid)) {
                let p = a;
                for (let i = 0; i < 6 && p; i++) {
                  if (p.getAttribute && (p.getAttribute('role') === 'button' || p.tagName === 'BUTTON')) {
                    p.click();
                    return true;
                  }
                  p = p.parentElement;
                }
                a.click();
                return true;
              }
            }
            return false;
          }, groupId);
          if (!picked) return { success: false, error: 'Grup target tidak muncul di dialog (mungkin akun belum gabung)', code: 'GROUP_NOT_IN_LIST' };
        } else {
          return { success: false, error: 'Tidak bisa pilih grup target di dialog share', code: 'GROUP_PICKER_FAILED' };
        }
      }
      await pause(2500);

      // Optional: pilih "Bagikan sebagai Halaman" kalau opts.shareAs === 'page'
      if (opts.shareAs === 'page' && opts.pageName) {
        await page.evaluate(async (pageName) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;
          // tombol audience selector biasanya bertuliskan "Berbagi sebagai" / "Posting sebagai"
          const audienceBtns = dialog.querySelectorAll('[role="button"][aria-label]');
          for (const el of audienceBtns) {
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('posting sebagai') || label.includes('share as') || label.includes('berbagi sebagai')) {
              el.click();
              return true;
            }
          }
          return false;
        }, opts.pageName);
        await pause(1500);
        await page.evaluate((pageName) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;
          const items = dialog.querySelectorAll('[role="menuitem"], [role="button"], [role="radio"]');
          for (const el of items) {
            if ((el.textContent || '').trim().toLowerCase().includes(pageName.toLowerCase())) {
              el.click();
              return true;
            }
          }
          return false;
        }, opts.pageName);
        await pause(1500);
      }

      // Tulis caption tambahan kalau ada
      if (opts.message && opts.message.trim()) {
        await page.evaluate(async (msg) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;
          const textarea = dialog.querySelector('[contenteditable="true"], textarea');
          if (!textarea) return false;
          textarea.focus();
          // Pakai execCommand untuk content-editable
          if (textarea.getAttribute('contenteditable') === 'true') {
            document.execCommand('insertText', false, msg);
          } else {
            textarea.value = msg;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return true;
        }, opts.message);
        await pause(1200);
      }

      // Klik tombol "Posting" / "Post" / "Bagikan sekarang"
      const submitClicked = await page.evaluate(async () => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        const buttons = dialog.querySelectorAll('[role="button"], button');
        for (const el of buttons) {
          if (!el.offsetParent) continue;
          if (el.getAttribute('aria-disabled') === 'true' || el.disabled) continue;
          const txt = (el.textContent || '').trim().toLowerCase();
          if (txt === 'posting' || txt === 'post' || txt === 'bagikan sekarang' || txt === 'share now' || txt === 'kirim' || txt === 'send' || txt === 'bagikan') {
            el.click();
            return txt;
          }
        }
        return false;
      });

      if (!submitClicked) return { success: false, error: 'Tombol Posting tidak aktif di dialog share', code: 'SUBMIT_BUTTON_DISABLED' };

      // Tunggu konfirmasi
      await pause(4500);

      // Cek apakah dialog tertutup (= sukses) atau ada error
      const afterState = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const errorBanners = document.querySelectorAll('[role="alert"], [aria-live="polite"]');
        let errorText = '';
        for (const e of errorBanners) {
          const t = (e.textContent || '').trim();
          if (t && /gagal|tidak bisa|error|failed/i.test(t)) errorText = t;
        }
        return { dialogStillOpen: !!dialog, errorText };
      });

      if (afterState.errorText) return { success: false, error: afterState.errorText, code: 'FB_ERROR' };
      if (afterState.dialogStillOpen) return { success: false, error: 'Dialog share masih terbuka, belum ada konfirmasi sukses', code: 'NO_CONFIRMATION' };
      return { success: true, message: `Berhasil share ke grup ${groupId}` };
    } catch (e) {
      return { success: false, error: e.message, code: 'EXCEPTION' };
    }
  });
}

module.exports = { sharePostToGroup };
