// Profile Setup Service: edit profil Facebook (foto, bio, lokasi, dll) via browser.
// Untuk akun baru yang perlu di-setup supaya terlihat real.

const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');
const { parseCookies } = require('./facebookService');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cookiesToPlaywright(cookieString) {
  const parsed = parseCookies(cookieString);
  return Object.entries(parsed).map(([name, value]) => ({
    name, value: String(value), domain: '.facebook.com', path: '/', secure: true, sameSite: 'None',
  }));
}

// Upload foto profil
async function updateProfilePhoto(account, photoUrl) {
  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      await ctx.addCookies(cookiesToPlaywright(account.cookies));
      const page = await ctx.newPage();

      // Download foto ke temp
      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const tmpFile = path.join(os.tmpdir(), `profile_${uuidv4()}.jpg`);
      const res = await axios.get(photoUrl, { responseType: 'arraybuffer', timeout: 15000 });
      fs.writeFileSync(tmpFile, Buffer.from(res.data));

      // Buka profil
      await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);

      // Klik foto profil (avatar)
      const clicked = await page.evaluate(() => {
        // Cari elemen foto profil yang clickable
        const avatars = document.querySelectorAll('[aria-label*="foto profil"], [aria-label*="profile picture"], [aria-label*="Perbarui foto profil"], [aria-label*="Update profile picture"]');
        for (const el of avatars) {
          if (el.offsetParent) { el.click(); return true; }
        }
        // Fallback: cari SVG camera icon di area profil
        const svgs = document.querySelectorAll('svg[aria-label*="camera"], [role="img"][aria-label*="foto"]');
        for (const el of svgs) {
          const parent = el.closest('[role="button"]') || el.parentElement;
          if (parent) { parent.click(); return true; }
        }
        return false;
      });

      if (!clicked) {
        fs.unlinkSync(tmpFile);
        await page.close(); await ctx.close();
        return { success: false, error: 'Tombol edit foto profil tidak ditemukan' };
      }
      await sleep(2500);

      // Klik "Unggah foto" / "Upload photo"
      const uploadClicked = await page.evaluate(() => {
        const items = document.querySelectorAll('[role="menuitem"], [role="button"], a');
        for (const el of items) {
          const t = (el.textContent || '').trim().toLowerCase();
          if (t.includes('unggah foto') || t.includes('upload photo') || t.includes('pilih foto')) {
            el.click(); return true;
          }
        }
        return false;
      });

      if (uploadClicked) {
        await sleep(1500);
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(tmpFile);
          await sleep(4000);
          // Klik Simpan/Save
          await page.evaluate(() => {
            const btns = document.querySelectorAll('[role="button"], button');
            for (const b of btns) {
              const t = (b.textContent || '').trim().toLowerCase();
              if (t === 'simpan' || t === 'save') { b.click(); return; }
            }
          });
          await sleep(3000);
        }
      }

      fs.unlinkSync(tmpFile);
      await page.close(); await ctx.close();
      return { success: true, action: 'profile_photo' };
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

// Edit bio/intro
async function updateBio(account, bio) {
  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      await ctx.addCookies(cookiesToPlaywright(account.cookies));
      const page = await ctx.newPage();

      await page.goto('https://www.facebook.com/me/about', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);

      // Cari tombol edit bio
      const editClicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('[role="button"], button, a')];
        for (const b of btns) {
          const t = (b.textContent || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          if (t.includes('edit bio') || t.includes('tambahkan bio') || t.includes('add bio') || aria.includes('edit bio')) {
            b.click(); return true;
          }
        }
        return false;
      });

      if (editClicked) {
        await sleep(2000);
        // Isi textarea bio
        await page.evaluate((text) => {
          const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
          for (const el of textareas) {
            if (el.offsetParent) {
              if (el.tagName === 'TEXTAREA') {
                const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
                el.focus();
                desc.set.call(el, text);
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                el.focus();
                document.execCommand('selectAll');
                document.execCommand('insertText', false, text);
              }
              return;
            }
          }
        }, bio);
        await sleep(1000);
        // Klik Simpan
        await page.evaluate(() => {
          const btns = document.querySelectorAll('[role="button"], button');
          for (const b of btns) {
            const t = (b.textContent || '').trim().toLowerCase();
            if (t === 'simpan' || t === 'save') { b.click(); return; }
          }
        });
        await sleep(2000);
      }

      await page.close(); await ctx.close();
      return { success: true, action: 'bio' };
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

// Edit lokasi/kota
async function updateLocation(account, city) {
  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      await ctx.addCookies(cookiesToPlaywright(account.cookies));
      const page = await ctx.newPage();

      await page.goto('https://www.facebook.com/me/about_places', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);

      // Cari tombol "Tambahkan kota saat ini" / "Add current city"
      const addClicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('[role="button"], button, a')];
        for (const b of btns) {
          const t = (b.textContent || '').trim().toLowerCase();
          if (t.includes('tambahkan kota') || t.includes('add current city') || t.includes('edit') || t.includes('tambah')) {
            b.click(); return true;
          }
        }
        return false;
      });

      if (addClicked) {
        await sleep(2000);
        // Ketik kota di input
        const input = await page.$('input[type="text"], input[aria-label*="Kota"], input[aria-label*="City"]');
        if (input) {
          await input.fill(city);
          await sleep(2000);
          // Pilih suggestion pertama
          await page.evaluate(() => {
            const items = document.querySelectorAll('[role="option"], [role="listbox"] li, [role="listbox"] [role="button"]');
            if (items[0]) items[0].click();
          });
          await sleep(1500);
          // Simpan
          await page.evaluate(() => {
            const btns = document.querySelectorAll('[role="button"], button');
            for (const b of btns) {
              const t = (b.textContent || '').trim().toLowerCase();
              if (t === 'simpan' || t === 'save') { b.click(); return; }
            }
          });
          await sleep(2000);
        }
      }

      await page.close(); await ctx.close();
      return { success: true, action: 'location' };
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

// Setup profil lengkap (semua sekaligus atau bertahap)
async function setupProfile(account, profile, opts = {}) {
  const results = [];
  const delay = opts.delayBetween || 5000; // 5 detik antar aksi

  if (profile.photo_url) {
    const r = await updateProfilePhoto(account, profile.photo_url);
    results.push({ field: 'photo', ...r });
    await sleep(delay);
  }

  if (profile.bio) {
    const r = await updateBio(account, profile.bio);
    results.push({ field: 'bio', ...r });
    await sleep(delay);
  }

  if (profile.city) {
    const r = await updateLocation(account, profile.city);
    results.push({ field: 'location', ...r });
    await sleep(delay);
  }

  if (profile.workplace) {
    const r = await updateWorkplace(account, profile.workplace);
    results.push({ field: 'workplace', ...r });
    await sleep(delay);
  }

  if (profile.school) {
    const r = await updateSchool(account, profile.school);
    results.push({ field: 'school', ...r });
  }

  return { success: true, results };
}

// Edit tempat kerja
async function updateWorkplace(account, workplace) {
  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      await ctx.addCookies(cookiesToPlaywright(account.cookies));
      const page = await ctx.newPage();

      await page.goto('https://www.facebook.com/me/about_work_and_education', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);

      // Klik "Tambahkan tempat kerja" / "Add a workplace"
      const addClicked = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[role="button"], button, a')];
        for (const el of els) {
          const t = (el.textContent || '').trim().toLowerCase();
          if (t.includes('tambahkan tempat kerja') || t.includes('add a workplace') || t.includes('tambah tempat kerja')) {
            el.click(); return true;
          }
        }
        return false;
      });

      if (addClicked) {
        await sleep(2000);
        // Cari input dan ketik nama perusahaan
        const input = await page.$('input[aria-label*="Perusahaan"], input[aria-label*="Company"], input[placeholder*="perusahaan"], input[placeholder*="company"], input[type="text"]');
        if (input) {
          await input.fill(workplace);
          await sleep(2000);
          // Pilih suggestion pertama atau buat baru
          await page.evaluate(() => {
            const items = document.querySelectorAll('[role="option"], [role="listbox"] [role="button"], ul li');
            if (items[0]) items[0].click();
          });
          await sleep(1500);
          // Simpan
          await page.evaluate(() => {
            const btns = document.querySelectorAll('[role="button"], button');
            for (const b of btns) {
              const t = (b.textContent || '').trim().toLowerCase();
              if (t === 'simpan' || t === 'save') { b.click(); return; }
            }
          });
          await sleep(2000);
        }
      }

      await page.close(); await ctx.close();
      return { success: true, action: 'workplace' };
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

// Edit sekolah/universitas
async function updateSchool(account, school) {
  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      await ctx.addCookies(cookiesToPlaywright(account.cookies));
      const page = await ctx.newPage();

      await page.goto('https://www.facebook.com/me/about_work_and_education', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);

      // Klik "Tambahkan sekolah" / "Add school"
      const addClicked = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[role="button"], button, a')];
        for (const el of els) {
          const t = (el.textContent || '').trim().toLowerCase();
          if (t.includes('tambahkan sma') || t.includes('tambahkan universitas') || t.includes('tambahkan sekolah') || t.includes('add high school') || t.includes('add college') || t.includes('add school')) {
            el.click(); return true;
          }
        }
        return false;
      });

      if (addClicked) {
        await sleep(2000);
        const input = await page.$('input[aria-label*="Sekolah"], input[aria-label*="School"], input[placeholder*="sekolah"], input[placeholder*="school"], input[type="text"]');
        if (input) {
          await input.fill(school);
          await sleep(2000);
          await page.evaluate(() => {
            const items = document.querySelectorAll('[role="option"], [role="listbox"] [role="button"], ul li');
            if (items[0]) items[0].click();
          });
          await sleep(1500);
          await page.evaluate(() => {
            const btns = document.querySelectorAll('[role="button"], button');
            for (const b of btns) {
              const t = (b.textContent || '').trim().toLowerCase();
              if (t === 'simpan' || t === 'save') { b.click(); return; }
            }
          });
          await sleep(2000);
        }
      }

      await page.close(); await ctx.close();
      return { success: true, action: 'school' };
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

module.exports = { updateProfilePhoto, updateBio, updateLocation, updateWorkplace, updateSchool, setupProfile };
