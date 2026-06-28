// Remote Browser Service — stream browser ke dashboard via WebSocket screenshots
const { chromium } = require('patchright');
const { getOrCreateProfile, saveCookiesToProfile } = require('./browserProfileService');
const db = require('../db/database');

const activeSessions = new Map(); // accountId -> session

async function startSession(accountId, userId) {
  if (activeSessions.has(accountId)) return { existing: true };

  const acc = db.prepare('SELECT * FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!acc) throw new Error('Akun tidak ditemukan');
  if (!acc.proxy) throw new Error('Akun belum punya proxy. Set proxy dulu sebelum login manual.');

  const profile = getOrCreateProfile(accountId);

  let proxyConfig = {};
  try {
    const u = new URL(acc.proxy);
    proxyConfig = {
      server: `${u.protocol}//${u.hostname}:${u.port}`,
      ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    };
  } catch {
    proxyConfig = { server: acc.proxy };
  }

  const browser = await chromium.launchPersistentContext(profile.profileDir, {
    headless: true,
    proxy: proxyConfig,
    viewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    ignoreHTTPSErrors: true,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  });

  const pages = browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  try { await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch {}

  const session = { browser, page, accountId, userId, ws: null, cookieSaved: false };
  activeSessions.set(accountId, session);

  // Poll for c_user cookie every 3s
  session.cookiePoller = setInterval(async () => {
    try {
      const cookies = await browser.cookies();
      const cUser = cookies.find(c => c.name === 'c_user');
      if (cUser && !session.cookieSaved) {
        session.cookieSaved = true;
        saveCookiesToProfile(accountId, cookies);
        const cookiesStr = JSON.stringify(cookies);
        db.prepare("UPDATE fb_accounts SET cookies = ?, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(cookiesStr, accountId);
        console.log(`[remote-browser] cookies saved for ${accountId}`);
        if (session.ws && session.ws.readyState === 1) {
          session.ws.send(JSON.stringify({ type: 'cookies_saved', message: 'Login berhasil! Cookies tersimpan otomatis.' }));
        }
      }
    } catch {}
  }, 3000);

  // Screenshot stream: start when WS connects
  session.startStream = (ws) => {
    session.ws = ws;
    session.screenshotInterval = setInterval(async () => {
      if (!ws || ws.readyState !== 1) return;
      try {
        const buf = await page.screenshot({ type: 'jpeg', quality: 55 });
        ws.send(buf);
      } catch {}
    }, 300);
  };

  return { started: true };
}

async function sendInput(accountId, event) {
  const session = activeSessions.get(accountId);
  if (!session) return;
  const { page } = session;
  try {
    if (event.type === 'click') {
      await page.mouse.click(event.x, event.y, { button: event.button === 2 ? 'right' : 'left' });
    } else if (event.type === 'dblclick') {
      await page.mouse.dblclick(event.x, event.y);
    } else if (event.type === 'move') {
      await page.mouse.move(event.x, event.y);
    } else if (event.type === 'scroll') {
      await page.mouse.move(event.x, event.y);
      await page.mouse.wheel(event.deltaX || 0, event.deltaY || 0);
    } else if (event.type === 'keydown') {
      await page.keyboard.press(event.key);
    } else if (event.type === 'type') {
      await page.keyboard.type(event.text, { delay: 30 });
    } else if (event.type === 'navigate') {
      await page.goto(event.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } else if (event.type === 'back') {
      await page.goBack();
    } else if (event.type === 'forward') {
      await page.goForward();
    } else if (event.type === 'reload') {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  } catch (e) {
    console.error('[remote-browser input]', e.message);
  }
}

async function closeSession(accountId) {
  const session = activeSessions.get(accountId);
  if (!session) return;
  clearInterval(session.screenshotInterval);
  clearInterval(session.cookiePoller);
  try { await session.browser.close(); } catch {}
  activeSessions.delete(accountId);
  console.log(`[remote-browser] session closed for ${accountId}`);
}

module.exports = { startSession, sendInput, closeSession, activeSessions };
