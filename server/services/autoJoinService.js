// Service Auto-Join Group via browser (Patchright).
// - Buka URL grup dengan cookie akun
// - Klik tombol "Gabung Grup" / "Join Group"
// - Kalau ada pertanyaan keanggotaan, jawab dengan template (kalau tersedia) atau skip
// - Verifikasi status: requested / joined / already_member / failed
//
// Catatan: untuk grup yang require approval, status "requested" sudah dianggap success.

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');

async function withBrowser(account, fn, userId) { return browserEnqueue(() => _withBrowserRaw(account, fn), userId || account?.user_id || null); }
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { parseCookies } = require('./facebookService');

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function joinGroup(account, groupUrl, opts = {}) {
  const answerTemplate = (opts.answer_template || '').trim();
  const useAI = !!opts.use_ai;
  const aiUserId = opts.user_id || null;
  const aiContext = opts.ai_context || ''; // bio singkat tentang pemilik akun (mis. "saya pebisnis sepatu Bandung")
  const aiTone = opts.ai_tone || 'natural';

  return await withBrowser(account, async (page) => {
    try {
      await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(3500);

      // Deteksi halaman login (cookies expired)
      const isLoginPage = await page.evaluate(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        const url = window.location.href;
        return url.includes('/login') || url.includes('/checkpoint') ||
          (text.includes('masuk') && text.includes('buat akun baru')) ||
          (text.includes('log in') && text.includes('create new account'));
      });
      if (isLoginPage) {
        return { status: 'cookie_expired', detail: 'Cookies expired — akun perlu login ulang dan update cookies' };
      }

      // Tutup overlay/popup
      await page.evaluate(() => {
        const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
        for (const el of closers) if (el.offsetParent) el.click();
      });
      await page.waitForTimeout(800);

      // Cek state grup
      const initial = await page.evaluate(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        const buttons = [...document.querySelectorAll('[role="button"], a, button')]
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            text: (el.textContent || '').trim().toLowerCase(),
            ariaLabel: (el.getAttribute('aria-label') || '').toLowerCase(),
          }))
          .filter(b => b.text || b.ariaLabel);

        const findBtn = (matchers) => buttons.find(b =>
          matchers.some(m => b.text === m || b.text.startsWith(m + ' ') || b.ariaLabel === m || b.ariaLabel.startsWith(m + ' '))
        );

        // Deteksi sudah member — JANGAN pakai 'gabung' karena "Gabung ke grup" juga match
        const joined = !!findBtn(['sudah bergabung', 'joined', 'leave group', 'tinggalkan grup', 'kelola keanggotaan', 'undang']);
        const requested = !!findBtn(['membatalkan permintaan', 'cancel request', 'permintaan dikirim', 'request sent']);
        // Deteksi bisa join — "gabung ke grup", "gabung grup", "join group"
        const joinable = !!findBtn(['gabung ke grup', 'gabung grup', 'join group', 'join this group']);
        const unavailable = /halaman tidak tersedia|content isn't available|page isn't available|tautan rusak/i.test(text);

        return { joined, requested, joinable, unavailable, title: document.title };
      });

      if (initial.unavailable) {
        return { status: 'unavailable', detail: 'Grup tidak tersedia / dihapus / private' };
      }
      if (initial.requested) {
        return { status: 'already_requested', detail: 'Permintaan join sebelumnya masih pending' };
      }
      if (initial.joinable) {
        // Ada tombol join — lanjut proses gabung
      } else if (initial.joined) {
        return { status: 'already_member', detail: 'Akun sudah jadi anggota grup' };
      } else {
        return { status: 'no_join_button', detail: 'Tombol gabung tidak ditemukan' };
      }

      // Klik tombol join utama
      const clicked = await page.evaluate(() => {
        const isLabel = (s, m) => s === m || s.startsWith(m + ' ');
        const buttons = [...document.querySelectorAll('[role="button"], button, a[role="button"]')]
          .filter(el => el.offsetParent !== null);
        for (const el of buttons) {
          const txt = (el.textContent || '').trim().toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          // Hindari tombol yang ada di header/banner navigation
          const banned = el.closest('[role="banner"], [role="navigation"]');
          if (banned) continue;
          if (
            isLabel(txt, 'gabung ke grup') || isLabel(txt, 'gabung grup') || isLabel(txt, 'join group') ||
            isLabel(aria, 'gabung ke grup') || isLabel(aria, 'gabung grup') || isLabel(aria, 'join group') ||
            txt === 'join' || aria === 'join'
          ) {
            el.scrollIntoView({ block: 'center' });
            el.click();
            return true;
          }
        }
        return false;
      });

      if (!clicked) {
        return { status: 'no_join_button', detail: 'Tombol gabung tidak ditemukan saat klik' };
      }

      await sleep(2500);

      // Cek apakah muncul pertanyaan keanggotaan, ambil JUGA teks pertanyaannya
      const questions = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return null;
        const inputs = [...dialog.querySelectorAll('textarea, input[type="text"]')]
          .filter(el => el.offsetParent !== null);
        if (!inputs.length) return null;

        // Cari teks pertanyaan terdekat untuk tiap input
        const findQuestion = (input) => {
          // Strategi: naik ke parent terdekat yang juga punya text node atau heading,
          // ambil teks block sebelum input.
          let cur = input;
          for (let i = 0; i < 6 && cur; i++) {
            const parent = cur.parentElement;
            if (!parent) break;
            // Ambil semua child sebelum input dan gabungkan teksnya
            const children = [...parent.children];
            const idx = children.indexOf(cur);
            if (idx > 0) {
              const before = children.slice(0, idx)
                .map(c => (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim())
                .filter(t => t && t.length >= 4 && t.length <= 400);
              if (before.length) {
                // ambil yang paling dekat (paling akhir)
                const candidate = before[before.length - 1];
                // skip kalau teks itu cuma label generik
                if (!/^(jawab|tulis jawaban|tanggapan|your answer|answer)$/i.test(candidate)) {
                  return candidate;
                }
              }
            }
            cur = parent;
          }
          return input.placeholder || input.getAttribute('aria-label') || '';
        };

        return inputs.map((el, idx) => ({
          idx,
          question: findQuestion(el).slice(0, 400),
          placeholder: el.placeholder || '',
          name: el.getAttribute('name') || '',
        }));
      });

      if (questions && questions.length > 0) {
        // Tentukan jawaban per pertanyaan
        let answers = [];
        let aiUsed = false;
        let answerSource = 'template';

        if (useAI && aiUserId) {
          try {
            const { generateText } = require('./groqService');
            const toneMap = {
              natural: 'sopan, ramah, dan natural',
              casual: 'santai dan akrab',
              formal: 'formal dan profesional',
              friendly: 'ramah dan hangat',
              enthusiastic: 'antusias secukupnya',
            };
            const toneDesc = toneMap[aiTone] || toneMap.natural;
            const groupTitle = await page.title().catch(() => '');

            const sys = `Kamu menulis jawaban pertanyaan keanggotaan grup Facebook bahasa Indonesia.
Gaya: ${toneDesc}.
Aturan WAJIB:
- jawab sesuai pertanyaan, ringkas (maks 2 kalimat)
- jangan pakai caps lock atau emoji berlebihan
- jangan menyebut bot/AI/otomasi
- kalau pertanyaan tipe ya/tidak ("setuju aturan?", "tidak akan spam?"), jawab afirmatif singkat ("Ya, saya setuju.")
- kalau pertanyaan domisili, jawab kota/area saja
- kalau pertanyaan minat/alasan join, kaitkan halus dengan minat pengguna kalau ada
Kembalikan HANYA teks jawaban tanpa tanda kutip, tanpa penjelasan tambahan.`;

            const generated = [];
            for (const q of questions) {
              const userPrompt = [
                groupTitle ? `Grup: "${groupTitle.slice(0, 100)}"` : '',
                aiContext ? `Profil saya: ${aiContext.slice(0, 200)}` : '',
                `Pertanyaan: "${q.question}"`,
                'Tulis jawaban natural dan singkat.',
              ].filter(Boolean).join('\n');
              try {
                const result = await generateText(aiUserId, [
                  { role: 'system', content: sys },
                  { role: 'user', content: userPrompt },
                ], { temperature: 0.7, max_tokens: 120 });
                let answer = (result.text || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
                if (!answer) throw new Error('AI kembalikan kosong');
                generated.push(answer);
              } catch (e) {
                // fallback per item: pakai template kalau ada, kalau tidak skip
                if (answerTemplate) generated.push(answerTemplate);
                else generated.push('');
              }
            }
            answers = generated;
            aiUsed = generated.some(a => a);
            answerSource = aiUsed ? 'ai' : 'template';
          } catch (e) {
            // AI total gagal, fallback ke template
            answers = questions.map(() => answerTemplate);
            answerSource = 'template_fallback';
          }
        } else {
          answers = questions.map(() => answerTemplate);
        }

        // Kalau semua jawaban kosong (tidak ada AI dan tidak ada template), skip
        if (answers.every(a => !a || !a.trim())) {
          await page.evaluate(() => {
            const closers = document.querySelectorAll('[role="dialog"] [aria-label="Tutup"], [role="dialog"] [aria-label="Close"]');
            for (const el of closers) if (el.offsetParent) el.click();
          });
          return {
            status: 'needs_answer',
            detail: `${questions.length} pertanyaan keanggotaan, jawaban tidak tersedia${useAI ? ' (AI gagal generate)' : ''}`,
            questions: questions.map(q => q.question),
          };
        }

        // Isi tiap pertanyaan dengan jawaban masing-masing (urut sesuai index)
        await page.evaluate(async (answersArr) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;
          const inputs = [...dialog.querySelectorAll('textarea, input[type="text"]')]
            .filter(el => el.offsetParent !== null);
          const setter = (el, value) => {
            const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            desc.set.call(el, value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          for (let i = 0; i < inputs.length; i++) {
            const el = inputs[i];
            const value = answersArr[i] || answersArr[answersArr.length - 1] || '';
            if (!value) continue;
            el.focus();
            setter(el, value);
            await new Promise(r => setTimeout(r, 350));
          }
          return true;
        }, answers);

        await sleep(1200);

        // Klik tombol kirim/submit di dialog
        const submitted = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;
          const buttons = [...dialog.querySelectorAll('[role="button"], button')]
            .filter(el => el.offsetParent !== null);
          for (const el of buttons) {
            const txt = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            if (
              txt === 'kirim' || txt === 'submit' || txt === 'gabung' || txt === 'join' ||
              txt === 'kirim permintaan' || txt === 'send request' ||
              aria === 'kirim' || aria === 'gabung' || aria === 'join'
            ) {
              el.click();
              return true;
            }
          }
          return false;
        });

        if (!submitted) {
          return {
            status: 'submit_failed',
            detail: 'Pertanyaan terisi tapi tombol submit tidak ditemukan',
            questions: questions.map(q => q.question),
            answers,
            answer_source: answerSource,
          };
        }
        await sleep(3000);

        // Tandai metadata supaya dipulangkan saat status final
        opts.__last_questions = questions.map(q => q.question);
        opts.__last_answers = answers;
        opts.__answer_source = answerSource;
      }

      // Verifikasi state akhir
      await sleep(4000);
      const finalState = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('[role="button"], a, button')]
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            text: (el.textContent || '').trim().toLowerCase(),
            aria: (el.getAttribute('aria-label') || '').toLowerCase(),
          }));
        const find = (m) => buttons.some(b => b.text === m || b.text.startsWith(m + ' ') || b.aria === m || b.aria.startsWith(m + ' '));
        if (find('membatalkan permintaan') || find('cancel request') || find('permintaan dikirim') || find('request sent')) {
          return 'requested';
        }
        if (find('sudah bergabung') || find('bergabung') || find('joined') || find('leave group') || find('tinggalkan grup') || find('kelola keanggotaan') || find('invite') || find('undang')) {
          return 'joined';
        }
        // Cek apakah tombol join sudah hilang (artinya berhasil)
        const stillJoinable = find('gabung ke grup') || find('gabung grup') || find('join group');
        if (!stillJoinable) return 'joined';
        return 'unknown';
      });

      if (finalState === 'joined') return {
        status: 'joined',
        questions: opts.__last_questions || null,
        answers: opts.__last_answers || null,
        answer_source: opts.__answer_source || null,
      };
      if (finalState === 'requested') return {
        status: 'requested',
        questions: opts.__last_questions || null,
        answers: opts.__last_answers || null,
        answer_source: opts.__answer_source || null,
      };
      return { status: 'click_not_confirmed', detail: 'Tombol diklik tapi state tidak jelas' };
    } catch (e) {
      return { status: 'error', detail: e.message };
    }
  });
}

function logJoin(jobId, accountId, groupUrl, groupName, status, detail, meta = {}) {
  const questions = meta.questions ? JSON.stringify(meta.questions) : null;
  const answers = meta.answers ? JSON.stringify(meta.answers) : null;
  const source = meta.answer_source || null;
  db.prepare(
    'INSERT INTO auto_join_logs (id, job_id, account_id, group_url, group_name, status, detail, questions, answers, answer_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), jobId, accountId, groupUrl, groupName || null, status, detail || null, questions, answers, source);
}

module.exports = { joinGroup, logJoin };
