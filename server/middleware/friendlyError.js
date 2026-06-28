// Translate error teknis dari Playwright/browser/Facebook ke pesan yang user-friendly
// Dipanggil di route handler sebelum return error ke frontend

const TECHNICAL_PATTERNS = [
  // Browser/Playwright errors
  {
    pattern: /browserType\.launch.*Target page.*closed|browser has been closed|Target page.*context.*browser/i,
    message: 'Server sedang sibuk memproses permintaan lain. Coba lagi dalam beberapa detik.',
    code: 'SERVER_BUSY',
  },
  {
    pattern: /Browser slot timeout/i,
    message: 'Server sedang sibuk. Permintaan kamu masuk antrian — coba lagi dalam 1-2 menit.',
    code: 'SERVER_BUSY',
  },
  {
    pattern: /Executable doesn.*exist|chrome.*not found|chromium.*not found/i,
    message: 'Terjadi masalah konfigurasi server. Hubungi admin.',
    code: 'SERVER_CONFIG_ERROR',
  },
  {
    pattern: /net::ERR_INVALID_AUTH_CREDENTIALS/i,
    message: 'Proxy tidak bisa digunakan — credentials proxy salah atau IP server belum di-whitelist. Cek pengaturan proxy akun.',
    code: 'PROXY_AUTH_FAILED',
  },
  {
    pattern: /net::ERR_PROXY_CONNECTION_FAILED|net::ERR_TUNNEL_CONNECTION_FAILED/i,
    message: 'Koneksi proxy gagal. Pastikan proxy masih aktif dan bisa diakses.',
    code: 'PROXY_CONNECTION_FAILED',
  },
  {
    pattern: /net::ERR_NAME_NOT_RESOLVED|net::ERR_CONNECTION_REFUSED/i,
    message: 'Tidak bisa terhubung ke Facebook. Cek koneksi internet server.',
    code: 'CONNECTION_FAILED',
  },
  {
    pattern: /page\.goto.*timeout|Navigation timeout/i,
    message: 'Halaman Facebook lambat dimuat. Coba lagi — mungkin Facebook sedang sibuk.',
    code: 'TIMEOUT',
  },
  // Facebook-specific
  {
    pattern: /cookies expired|cookie.*expired|sesi.*habis/i,
    message: 'Cookies akun sudah expired. Login ulang ke Facebook dan update cookies di halaman Akun.',
    code: 'COOKIE_EXPIRED',
  },
  {
    pattern: /checkpoint/i,
    message: 'Akun terkena checkpoint Facebook. Login manual di browser, selesaikan verifikasi, lalu update cookies.',
    code: 'CHECKPOINT',
  },
  {
    pattern: /akun.*dikunci|account.*locked|account.*disabled/i,
    message: 'Akun Facebook dikunci atau dinonaktifkan. Coba login manual untuk melihat status akun.',
    code: 'ACCOUNT_LOCKED',
  },
  // Generic
  {
    pattern: /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i,
    message: 'Koneksi terputus. Coba lagi dalam beberapa saat.',
    code: 'CONNECTION_ERROR',
  },
  {
    pattern: /SqliteError|SQLITE_ERROR/i,
    message: 'Terjadi kesalahan database. Hubungi admin jika masalah berlanjut.',
    code: 'DB_ERROR',
  },
];

/**
 * Translate error teknis ke pesan user-friendly.
 * @param {string|Error} error
 * @returns {{ message: string, code: string, technical: string }}
 */
function friendlyError(error) {
  const msg = typeof error === 'string' ? error : (error?.message || String(error));

  for (const { pattern, message, code } of TECHNICAL_PATTERNS) {
    if (pattern.test(msg)) {
      return { message, code, technical: msg };
    }
  }

  // Kalau tidak match pattern, return pesan asli tapi bersihkan stack trace
  const clean = msg.split('\n')[0].replace(/\s+at\s+.+/g, '').trim();
  return { message: clean || 'Terjadi kesalahan. Coba lagi.', code: 'UNKNOWN', technical: msg };
}

/**
 * Express middleware untuk translate error response.
 * Wrap di route handler: res.error(err) instead of res.status(500).json({ error: err.message })
 */
function errorMiddleware(req, res, next) {
  res.friendlyError = (err, statusCode = 500) => {
    const { message, code, technical } = friendlyError(err);
    console.error(`[API Error] ${req.method} ${req.path} → ${code}: ${technical}`);
    return res.status(statusCode).json({ error: message, code });
  };
  next();
}

module.exports = { friendlyError, errorMiddleware };
