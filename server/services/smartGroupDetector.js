// Smart Group Detector: buka grup, detect apakah ada tombol "Sell Something" atau cuma composer biasa.
// Return: 'sell' (grup jual-beli) atau 'post' (grup diskusi biasa)

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');
const { parseCookies } = require('./facebookService');
const db = require('../db/database');

// Cache hasil detect per grup (tidak perlu cek ulang tiap kali)
const groupTypeCache = new Map(); // groupUrl → { type, checkedAt }
const CACHE_TTL = 86400000; // 24 jam
const CACHE_MAX_SIZE = 5000;

// Periodic cleanup supaya tidak leak memory
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of groupTypeCache.entries()) {
    if (now - v.checkedAt > CACHE_TTL) groupTypeCache.delete(k);
  }
  if (groupTypeCache.size > CACHE_MAX_SIZE) {
    const overflow = groupTypeCache.size - CACHE_MAX_SIZE;
    const keys = [...groupTypeCache.keys()].slice(0, overflow);
    for (const k of keys) groupTypeCache.delete(k);
  }
}, 60 * 60 * 1000).unref(); // tiap 1 jam

async function detectGroupType(account, groupUrl) {
  // Cek cache dulu
  const cached = groupTypeCache.get(groupUrl);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) return cached.type;

  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID',
      });
      await ctx.addCookies(Object.entries(parseCookies(account.cookies)).map(([name, value]) => ({
        name, value: String(value), domain: '.facebook.com', path: '/', secure: true, sameSite: 'None',
      })));
      const page = await ctx.newPage();

      await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await new Promise(r => setTimeout(r, 3500));

      // Detect: ada tombol "Jual Sesuatu" / "Sell Something"?
      const type = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('[role="button"], button, a, span, div')];
        for (const el of buttons) {
          const t = (el.textContent || '').trim().toLowerCase();
          if (t === 'jual sesuatu' || t === 'sell something' || t === 'jual' || t === 'sell' || t === 'buat listing' || t === 'create listing') {
            return 'sell';
          }
        }
        return 'post';
      });

      await page.close(); await ctx.close();
      groupTypeCache.set(groupUrl, { type, checkedAt: Date.now() });
      return type;
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

module.exports = { detectGroupType };
