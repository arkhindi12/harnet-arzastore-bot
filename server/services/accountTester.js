// Test akun secara live pakai browser real (Playwright)
// Lebih akurat dari validateAccount yang cuma cek HTTP HTML
// Mendeteksi: cookies expired, checkpoint, akun terkunci, dll.

const { launchBrowser } = require('./browserQueue');
const { parseCookies } = require('./facebookService');

function cookiesToPlaywright(cookieString) {
  const parsed = parseCookies(cookieString);
  return Object.entries(parsed).map(([name, value]) => ({
    name, value: String(value), domain: '.facebook.com', path: '/', secure: true, sameSite: 'None',
  }));
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

/**
 * Test akun Facebook secara live dengan browser real.
 * Buka facebook.com dan cek state halaman.
 *
 * @returns {Promise<{
 *   status: 'active'|'expired'|'checkpoint'|'locked'|'unknown',
 *   message: string,
 *   userName?: string,
 *   userId?: string,
 *   detail?: string,
 * }>}
 */
async function testAccountLive(account) {
  if (!account?.cookies) {
    return { status: 'unknown', message: 'Cookies tidak ada' };
  }

  let browser;
  try {
    browser = await launchBrowser();
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
      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      const result = await page.evaluate(() => {
        const url = window.location.href;
        const text = (document.body?.innerText || '').toLowerCase();
        const title = document.title || '';

        // Cek redirect ke checkpoint
        if (url.includes('/checkpoint/')) return { state: 'checkpoint' };

        // Cek redirect ke login
        if (url.includes('/login') || url.includes('/recover')) return { state: 'expired' };

        // Cek konten halaman login
        const hasLoginForm = !!document.querySelector('input[name="email"], input[name="pass"], #email, #pass');
        const hasLoginText = (text.includes('masuk') && text.includes('buat akun baru')) ||
                             (text.includes('log in') && text.includes('create new account')) ||
                             text.includes('lupa kata sandi') ||
                             text.includes('forgot password');
        if (hasLoginForm || hasLoginText) return { state: 'expired' };

        // Cek pesan akun terkunci/disabled
        const lockPatterns = [
          'akunmu dikunci', 'akun anda telah dinonaktifkan', 'akun ini telah dinonaktifkan',
          'account has been disabled', 'account locked', 'account has been locked',
          'akun anda dikunci', 'we suspect that your account',
        ];
        for (const p of lockPatterns) {
          if (text.includes(p)) return { state: 'locked', detail: p };
        }

        // Cek konfirmasi identitas/checkpoint
        const checkpointPatterns = [
          'konfirmasi identitas', 'verify your identity', 'pemeriksaan keamanan',
          'security check', 'unusual activity', 'aktivitas tidak biasa',
        ];
        for (const p of checkpointPatterns) {
          if (text.includes(p)) return { state: 'checkpoint', detail: p };
        }

        // Cek indikator login berhasil
        const navProfile = document.querySelector('[aria-label="Profil Anda"], [aria-label="Your profile"]');
        const messengerLink = document.querySelector('[aria-label="Messenger"]');
        const notifBell = document.querySelector('[aria-label="Notifikasi"], [aria-label="Notifications"]');

        // Coba ambil nama user dari link profil
        let userName = '';
        const profileLink = document.querySelector('a[role="link"][aria-label][href*="/me"], a[role="link"][aria-label][href*="profile.php"]');
        if (profileLink) {
          userName = profileLink.getAttribute('aria-label') || '';
        }
        // Fallback: cari heading nama
        if (!userName) {
          const h1 = document.querySelector('h1 a, h1 span, h2 a span');
          if (h1) userName = (h1.textContent || '').trim();
        }

        if (navProfile || messengerLink || notifBell) {
          return { state: 'active', userName, title };
        }

        return { state: 'unknown', title, snippet: text.substring(0, 200) };
      });

      await ctx.close().catch(() => {});

      if (result.state === 'active') {
        return {
          status: 'active',
          message: 'Akun aktif dan cookies valid',
          userName: result.userName || 'Facebook User',
        };
      }
      if (result.state === 'expired') {
        return {
          status: 'expired',
          message: 'Cookies expired — akun perlu login ulang',
          detail: 'Halaman menampilkan form login, bukan feed.',
        };
      }
      if (result.state === 'checkpoint') {
        return {
          status: 'checkpoint',
          message: 'Akun terkena checkpoint Facebook',
          detail: result.detail || 'Halaman menampilkan konfirmasi identitas/keamanan.',
        };
      }
      if (result.state === 'locked') {
        return {
          status: 'locked',
          message: 'Akun terkunci atau dinonaktifkan oleh Facebook',
          detail: result.detail || 'Halaman menampilkan pesan akun terkunci.',
        };
      }
      return {
        status: 'unknown',
        message: 'Status tidak bisa ditentukan',
        detail: `Title: ${result.title}. ${result.snippet || ''}`,
      };
    } catch (e) {
      await ctx.close().catch(() => {});
      throw e;
    }
  } catch (e) {
    return {
      status: 'unknown',
      message: 'Gagal test akun',
      detail: e.message,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { testAccountLive };
