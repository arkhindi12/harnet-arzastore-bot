// Human Behavior Simulation: inject random mouse movement, scroll jitter,
// typing delay, dan viewport variation ke browser page.
// Tujuan: bikin pattern browser terlihat manusiawi, bukan bot.

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Inject ke page setelah dibuat
async function humanize(page) {
  // 1. Random viewport sedikit berbeda tiap session
  const width = randomInt(1280, 1440);
  const height = randomInt(720, 900);
  await page.setViewportSize({ width, height });

  // 2. Inject mouse movement simulator
  await page.addInitScript(() => {
    // Override navigator properties yang sering dicek
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Simulate random mouse events di background
    let mouseActive = true;
    const randomMove = () => {
      if (!mouseActive) return;
      const x = Math.floor(Math.random() * window.innerWidth);
      const y = Math.floor(Math.random() * window.innerHeight);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
      setTimeout(randomMove, Math.random() * 8000 + 3000); // tiap 3-11 detik
    };
    setTimeout(randomMove, Math.random() * 3000 + 1000);

    // Cleanup saat page unload
    window.addEventListener('beforeunload', () => { mouseActive = false; });
  });
}

// Scroll dengan pattern manusia (tidak langsung ke bawah)
async function humanScroll(page, times = 3, pauseMin = 1000, pauseMax = 2500) {
  for (let i = 0; i < times; i++) {
    const scrollAmount = randomInt(300, 800);
    const duration = randomInt(200, 600);

    await page.evaluate(({ amount, dur }) => {
      return new Promise(resolve => {
        const start = window.scrollY;
        const startTime = Date.now();
        const step = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / dur, 1);
          // Easing: ease-out
          const eased = 1 - Math.pow(1 - progress, 3);
          window.scrollTo(0, start + amount * eased);
          if (progress < 1) requestAnimationFrame(step);
          else resolve();
        };
        step();
      });
    }, { amount: scrollAmount, dur: duration });

    // Pause random antara scroll
    const pause = randomInt(pauseMin, pauseMax);
    await new Promise(r => setTimeout(r, pause));
  }
}

// Ketik dengan delay per karakter (seperti manusia)
async function humanType(page, selector, text, opts = {}) {
  const minDelay = opts.minDelay || 30;
  const maxDelay = opts.maxDelay || 120;
  const mistakeChance = opts.mistakeChance || 0.03; // 3% chance typo

  const el = await page.$(selector);
  if (!el) return false;

  await el.click();
  await new Promise(r => setTimeout(r, randomInt(200, 500)));

  for (let i = 0; i < text.length; i++) {
    // Occasional typo + backspace
    if (Math.random() < mistakeChance && text.length > 3) {
      const wrongChar = String.fromCharCode(randomInt(97, 122));
      await page.keyboard.type(wrongChar, { delay: randomInt(minDelay, maxDelay) });
      await new Promise(r => setTimeout(r, randomInt(100, 300)));
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, randomInt(50, 150)));
    }

    await page.keyboard.type(text[i], { delay: randomInt(minDelay, maxDelay) });

    // Occasional longer pause (thinking)
    if (Math.random() < 0.05) {
      await new Promise(r => setTimeout(r, randomInt(300, 800)));
    }
  }
  return true;
}

// Random delay yang terlihat natural
async function humanDelay(minMs = 500, maxMs = 2000) {
  const base = randomInt(minMs, maxMs);
  // Kadang ada "hesitation" lebih lama
  const hesitation = Math.random() < 0.1 ? randomInt(1000, 3000) : 0;
  await new Promise(r => setTimeout(r, base + hesitation));
}

// Klik dengan mouse movement ke target (bukan teleport)
async function humanClick(page, selector) {
  const el = await page.$(selector);
  if (!el) return false;

  const box = await el.boundingBox();
  if (!box) return false;

  // Target point dengan sedikit offset random (tidak selalu center)
  const x = box.x + box.width * randomFloat(0.3, 0.7);
  const y = box.y + box.height * randomFloat(0.3, 0.7);

  // Move mouse ke target dengan beberapa step
  const steps = randomInt(3, 8);
  const currentX = randomInt(0, 800);
  const currentY = randomInt(0, 600);

  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const eased = 1 - Math.pow(1 - progress, 2);
    const mx = currentX + (x - currentX) * eased + randomInt(-3, 3);
    const my = currentY + (y - currentY) * eased + randomInt(-3, 3);
    await page.mouse.move(mx, my);
    await new Promise(r => setTimeout(r, randomInt(10, 40)));
  }

  // Pause sebelum klik (manusia tidak langsung klik)
  await new Promise(r => setTimeout(r, randomInt(50, 200)));
  await page.mouse.click(x, y);
  return true;
}

// Proxy rotation helper
function getRandomProxy(proxies) {
  if (!Array.isArray(proxies) || proxies.length === 0) return null;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

module.exports = {
  humanize,
  humanScroll,
  humanType,
  humanDelay,
  humanClick,
  randomInt,
  randomFloat,
  getRandomProxy,
};
