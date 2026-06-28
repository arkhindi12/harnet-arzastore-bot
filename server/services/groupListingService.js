// Service post listing ke grup jual beli (Facebook Group Listing).
// Flow:
// 1. Buka URL grup pakai cookie akun
// 2. Klik tombol "Jual Sesuatu" / "Sell Something" / "Sell"
// 3. Pilih tipe listing (default: Item for Sale / Barang dijual)
// 4. Isi form: foto, judul, harga, kategori, kondisi, deskripsi
// 5. Klik Berikutnya/Next, lalu Publish/Posting
// 6. Verifikasi

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');

async function withBrowser(account, fn, userId) { return browserEnqueue(() => _withBrowserRaw(account, fn), userId || account?.user_id || null); }
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
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
      viewport: { width: 1366, height: 850 },
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadImagesToTemp(urls = []) {
  const files = [];
  if (!Array.isArray(urls)) return files;
  for (const url of urls.slice(0, 10)) {
    if (!url || typeof url !== 'string') continue;
    try {
      const res = await axios.get(url.trim(), { responseType: 'arraybuffer', timeout: 20000, maxContentLength: 15 * 1024 * 1024 });
      const ext = (url.match(/\.(jpg|jpeg|png|webp|gif)/i)?.[1] || 'jpg').toLowerCase();
      const tmpPath = path.join(os.tmpdir(), `fbgl_${uuidv4()}.${ext}`);
      fs.writeFileSync(tmpPath, Buffer.from(res.data));
      files.push(tmpPath);
    } catch (e) {
      // skip image yang gagal download
    }
  }
  return files;
}

function cleanupFiles(files) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch {}
  }
}

// Set value pakai native setter supaya React register perubahan
async function fillReactInput(page, selectorOrEl, value) {
  return await page.evaluate(({ selector, value }) => {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    el.focus();
    desc.set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { selector: selectorOrEl, value });
}

async function clickByLabel(page, labels, opts = {}) {
  // labels: array string (lowercase). Cari elemen [role=button] / a / button visible yang teks/aria match.
  return await page.evaluate(({ labels, allowDialog, exact }) => {
    const arr = labels.map(l => l.toLowerCase());
    const buttons = [...document.querySelectorAll('[role="button"], button, a, [role="tab"], [role="menuitem"], [role="link"]')];
    for (const el of buttons) {
      if (!el.offsetParent) continue;
      if (!allowDialog) {
        const banned = el.closest('[role="banner"], [role="navigation"]');
        if (banned) continue;
      }
      const txt = (el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      for (const l of arr) {
        const match = exact
          ? (txt === l || aria === l)
          : (txt === l || txt.startsWith(l + ' ') || aria === l || aria.startsWith(l + ' ') || txt.includes(l) || aria.includes(l));
        if (match) {
          el.scrollIntoView({ block: 'center' });
          el.click();
          return l;
        }
      }
    }
    return null;
  }, { labels, allowDialog: !!opts.allowDialog, exact: !!opts.exact });
}

async function postGroupListing(account, groupUrl, listing = {}) {
  const {
    title,
    description = '',
    price,
    category = '',           // mis. "Pakaian & Aksesoris", "Elektronik"
    condition = 'used_good', // 'new' | 'used_like_new' | 'used_good' | 'used_fair'
    images = [],
    listing_type = 'item',   // 'item' (default), 'vehicle', 'home'
  } = listing;

  if (!title || !String(title).trim()) return { success: false, error: 'Judul listing wajib', code: 'NO_TITLE' };
  if (price == null) return { success: false, error: 'Harga wajib (boleh 0 untuk gratis)', code: 'NO_PRICE' };

  const imageFiles = await downloadImagesToTemp(images);

  try {
    const result = await withBrowser(account, async (page) => {
      try {
        await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(3500);

        // Tutup overlay
        await page.evaluate(() => {
          const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
          for (const el of closers) if (el.offsetParent) el.click();
        });
        await page.waitForTimeout(800);

        // Pastikan akun adalah anggota grup
        const memberCheck = await page.evaluate(() => {
          const text = (document.body?.innerText || '').toLowerCase();
          if (/halaman tidak tersedia|page isn't available/i.test(text)) return 'unavailable';
          // Tombol "Gabung Grup" muncul = belum member
          const buttons = [...document.querySelectorAll('[role="button"], button')]
            .filter(el => el.offsetParent !== null);
          for (const el of buttons) {
            const t = (el.textContent || '').trim().toLowerCase();
            if (t === 'gabung grup' || t === 'join group' || t === 'gabung' || t === 'join') return 'not_member';
          }
          return 'ok';
        });
        if (memberCheck === 'unavailable') return { success: false, error: 'Grup tidak tersedia / dihapus', code: 'GROUP_UNAVAILABLE' };
        if (memberCheck === 'not_member') return { success: false, error: 'Akun belum jadi anggota grup ini', code: 'NOT_MEMBER' };

        // Klik tombol Jual Sesuatu / Sell Something
        const sellClicked = await clickByLabel(page, [
          'jual sesuatu', 'jual',
          'sell something', 'sell',
          'buat listing', 'create listing',
        ]);
        if (!sellClicked) {
          return { success: false, error: 'Tombol "Jual Sesuatu" tidak ditemukan di grup. Mungkin grup ini bukan grup jual-beli.', code: 'SELL_BUTTON_NOT_FOUND' };
        }
        await sleep(2500);

        // Pilih tipe listing
        const typeLabels = listing_type === 'vehicle'
          ? ['kendaraan dijual', 'vehicle for sale', 'kendaraan']
          : listing_type === 'home'
            ? ['rumah dijual atau disewa', 'home for sale or rent', 'properti']
            : ['barang dijual', 'item for sale', 'barang', 'item'];

        const typeClicked = await clickByLabel(page, typeLabels, { allowDialog: true });
        if (!typeClicked) {
          // Beberapa varian langsung skip step ini, lanjut saja
          // Tapi kalau dialog "Create new listing" masih ada dan tidak ada match, error.
          const stillOnTypePicker = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return false;
            const text = dialog.innerText.toLowerCase();
            return text.includes('listing type') || text.includes('jenis listing') || text.includes('create new listing') || text.includes('buat listing baru');
          });
          if (stillOnTypePicker) {
            return { success: false, error: 'Tipe listing tidak ditemukan di dialog (mungkin format grup berbeda)', code: 'LISTING_TYPE_NOT_FOUND' };
          }
        }
        await sleep(3000);

        // Upload foto kalau ada
        if (imageFiles.length > 0) {
          try {
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(imageFiles);
              await sleep(3500);
            }
          } catch (e) {
            // skip kalau gagal upload, post tetap lanjut tanpa foto
          }
        }

        // Isi field-field. Strategi: cari label/aria-label yang match.
        const fillFieldByLabel = async (labels, value) => {
          return await page.evaluate(({ labels, value }) => {
            const arr = labels.map(l => l.toLowerCase());
            const dialog = document.querySelector('[role="dialog"]') || document;

            // 1. Cari input/textarea by aria-label
            const inputs = [...dialog.querySelectorAll('input, textarea, [contenteditable="true"]')]
              .filter(el => el.offsetParent !== null);

            const setReact = (el, val) => {
              if (el.getAttribute('contenteditable') === 'true') {
                el.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, val);
                return true;
              }
              const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
              const desc = Object.getOwnPropertyDescriptor(proto, 'value');
              el.focus();
              desc.set.call(el, val);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            };

            for (const el of inputs) {
              const aria = (el.getAttribute('aria-label') || '').toLowerCase();
              const placeholder = (el.placeholder || '').toLowerCase();
              for (const l of arr) {
                if (aria === l || aria.startsWith(l) || placeholder === l || placeholder.startsWith(l) || aria.includes(l) || placeholder.includes(l)) {
                  setReact(el, val);
                  return true;
                }
              }
            }

            // 2. Cari label dengan text → ambil input pasangannya
            const allLabels = [...dialog.querySelectorAll('label, [role="label"]')];
            for (const lab of allLabels) {
              const txt = (lab.textContent || '').trim().toLowerCase();
              if (arr.some(l => txt === l || txt.startsWith(l))) {
                // Cari input/textarea/contenteditable di dekatnya
                const forId = lab.getAttribute('for');
                let input = forId ? document.getElementById(forId) : null;
                if (!input) input = lab.querySelector('input, textarea, [contenteditable="true"]');
                if (!input) input = lab.parentElement?.querySelector('input, textarea, [contenteditable="true"]');
                if (input) {
                  setReact(input, val);
                  return true;
                }
              }
            }
            return false;
          }, { labels, value: String(value) });
        };

        // Title
        const titleFilled = await fillFieldByLabel(['judul', 'title'], title);
        if (!titleFilled) {
          // fallback: input pertama yang visible
          await page.evaluate((value) => {
            const dialog = document.querySelector('[role="dialog"]') || document;
            const inputs = [...dialog.querySelectorAll('input[type="text"], input:not([type])')]
              .filter(el => el.offsetParent !== null);
            if (inputs[0]) {
              const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
              inputs[0].focus();
              desc.set.call(inputs[0], value);
              inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, String(title));
        }
        await sleep(700);

        // Price
        await fillFieldByLabel(['harga', 'price'], String(price));
        await sleep(500);

        // Description
        if (description) {
          await fillFieldByLabel(['deskripsi', 'description', 'detail'], description);
          await sleep(500);
        }

        // Category (kalau diisi user, coba pilih)
        if (category) {
          const opened = await clickByLabel(page, ['kategori', 'category'], { allowDialog: true });
          if (opened) {
            await sleep(1200);
            await clickByLabel(page, [category.toLowerCase()], { allowDialog: true });
            await sleep(800);
          }
        }

        // Condition
        const condMap = {
          new: ['baru', 'new'],
          used_like_new: ['seperti baru', 'used - like new', 'like new'],
          used_good: ['bekas - kondisi baik', 'used - good', 'kondisi baik'],
          used_fair: ['bekas - kondisi cukup', 'used - fair', 'kondisi cukup'],
        };
        const condLabels = condMap[condition] || condMap.used_good;
        const condOpened = await clickByLabel(page, ['kondisi', 'condition'], { allowDialog: true });
        if (condOpened) {
          await sleep(1000);
          await clickByLabel(page, condLabels, { allowDialog: true });
          await sleep(600);
        }

        // Klik tombol Berikutnya / Next
        const nextLabels = ['berikutnya', 'next', 'lanjut'];
        let nextClicked = await clickByLabel(page, nextLabels, { allowDialog: true });
        if (nextClicked) await sleep(2500);

        // Beberapa flow ada step "Post in group" yang perlu di-confirm sebagai grup ini
        // Klik next sekali lagi kalau ada
        nextClicked = await clickByLabel(page, nextLabels, { allowDialog: true });
        if (nextClicked) await sleep(2000);

        // Klik Posting / Publish / Terbitkan
        const publishLabels = ['posting', 'publish', 'terbitkan', 'kirim'];
        let publishClicked = await clickByLabel(page, publishLabels, { allowDialog: true });

        // Kadang tombol publish baru muncul setelah scroll
        if (!publishClicked) {
          await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) dialog.scrollTop = dialog.scrollHeight;
          });
          await sleep(800);
          publishClicked = await clickByLabel(page, publishLabels, { allowDialog: true });
        }

        if (!publishClicked) {
          return { success: false, error: 'Tombol Posting/Publish tidak ditemukan', code: 'PUBLISH_BUTTON_NOT_FOUND' };
        }
        await sleep(5000);

        // Verifikasi: dialog ditutup atau muncul notifikasi sukses / "menunggu persetujuan"
        const finalState = await page.evaluate(() => {
          const text = (document.body?.innerText || '').toLowerCase();
          if (/listing.*berhasil|berhasil dibuat|listing.*posted|posted to|berhasil diposting/i.test(text)) return 'posted';
          if (/menunggu persetujuan|pending approval|pending review/i.test(text)) return 'pending_approval';
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return 'dialog_closed'; // anggap sukses
          return 'unknown';
        });

        if (finalState === 'posted' || finalState === 'pending_approval' || finalState === 'dialog_closed') {
          return { success: true, status: finalState, message: finalState === 'pending_approval' ? 'Menunggu persetujuan admin' : 'Listing berhasil dipost' };
        }
        return { success: false, error: 'Tidak bisa mengonfirmasi status post listing', code: 'UNCONFIRMED' };
      } catch (e) {
        return { success: false, error: e.message, code: 'BROWSER_EXCEPTION' };
      }
    });

    return result;
  } finally {
    cleanupFiles(imageFiles);
  }
}

module.exports = { postGroupListing };
