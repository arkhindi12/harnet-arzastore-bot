// Personal Inbox Conversation Service via Browser (Patchright).
// Polling-based: tiap N menit buka Messenger, baca unread, AI reply, kirim.
// Ringan karena lewat browserQueue (max 2 concurrent).

const { enqueue: browserEnqueue, launchBrowser } = require('./browserQueue');
const { v4: uuidv4 } = require('uuid');
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
    name, value: String(value), domain: '.facebook.com', path: '/', httpOnly: false, secure: true, sameSite: 'None',
  }));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getOrCreateConversation(botId, senderId, senderName) {
  let conv = db.prepare("SELECT * FROM page_conversations WHERE bot_id = ? AND sender_id = ? AND status = 'active'").get(botId, senderId);
  if (!conv) {
    const id = uuidv4();
    db.prepare("INSERT INTO page_conversations (id, bot_id, sender_id, sender_name, messages, round_count, status, last_message_at) VALUES (?, ?, ?, ?, '[]', 0, 'active', CURRENT_TIMESTAMP)")
      .run(id, botId, senderId, senderName || null);
    conv = db.prepare('SELECT * FROM page_conversations WHERE id = ?').get(id);
  }
  return conv;
}

function appendMessage(convId, role, text) {
  const conv = db.prepare('SELECT messages FROM page_conversations WHERE id = ?').get(convId);
  const msgs = JSON.parse(conv?.messages || '[]');
  msgs.push({ role, text, time: new Date().toISOString() });
  const trimmed = msgs.slice(-20);
  db.prepare('UPDATE page_conversations SET messages = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(trimmed), convId);
  return trimmed;
}

function incrementRound(convId) {
  db.prepare('UPDATE page_conversations SET round_count = round_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(convId);
}

function closeConversation(convId) {
  db.prepare("UPDATE page_conversations SET status = 'closed', escalated = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(convId);
}

async function generatePersonalReply(bot, conversation, incomingMessage) {
  const { generateText } = require('./groqService');
  const productInfo = bot.product_info || '';
  const waNumber = bot.wa_number || '';
  const personaName = bot.persona_name || 'Saya';
  const personaStyle = bot.persona_style || 'ramah';
  const maxRounds = bot.max_rounds || 5;
  const currentRound = (conversation.round_count || 0) + 1;
  const isLastRound = currentRound >= maxRounds;

  const msgs = JSON.parse(conversation.messages || '[]');

  const systemPrompt = `Kamu adalah ${personaName}, pemilik akun Facebook personal yang sedang membalas DM.
Gaya bicara: ${personaStyle}.
${productInfo ? `Info produk/bisnis: ${productInfo}` : ''}

ATURAN:
- Jawab bahasa Indonesia, singkat (maks 2-3 kalimat)
- Jangan bilang kamu AI/bot
- Terdengar seperti manusia biasa yang balas chat
- Kalau customer tertarik beli, arahkan ke WA: ${waNumber || '(tanya nomor)'}
${isLastRound ? `- INI RONDE TERAKHIR. Tutup dengan mengarahkan ke WhatsApp ${waNumber}.` : ''}

Jawab HANYA teks balasan.`;

  const aiMessages = [{ role: 'system', content: systemPrompt }];
  for (const m of msgs.slice(-10)) {
    aiMessages.push({ role: m.role === 'customer' ? 'user' : 'assistant', content: m.text });
  }
  aiMessages.push({ role: 'user', content: incomingMessage });

  try {
    const result = await generateText(bot.user_id, aiMessages, { temperature: 0.7, max_tokens: 150 });
    let reply = (result.text || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    if (isLastRound && waNumber && !reply.includes(waNumber)) {
      reply += `\n\nChat WA aku ya: ${waNumber}`;
    }
    return reply || 'Makasih udah chat! 🙏';
  } catch {
    return waNumber ? `Makasih udah chat! Lanjut di WA ya: ${waNumber}` : 'Makasih udah chat! Nanti aku bales lagi ya 🙏';
  }
}

async function pollPersonalInbox(bot) {
  const account = db.prepare('SELECT * FROM fb_accounts WHERE id = ?').get(bot.account_id);
  if (!account) return { success: false, error: 'Akun tidak ditemukan' };
  if (account.status !== 'active') return { success: false, error: 'Akun tidak aktif' };

  return browserEnqueue(async () => {
    const browser = await launchBrowser();
    try {
      const context = await browser.newContext({
        userAgent: account.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 800 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
        proxy: parseProxyUrl(account.proxy),
      });
      await context.addCookies(cookiesToPlaywright(account.cookies));
      const page = await context.newPage();

      // Buka Messenger
      await page.goto('https://www.facebook.com/messages/t/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Tutup popup
      await page.evaluate(() => {
        const closers = document.querySelectorAll('[role="button"][aria-label="Tutup"], [role="button"][aria-label="Close"]');
        for (const el of closers) if (el.offsetParent) el.click();
      });
      await page.waitForTimeout(1000);

      // Cari unread conversations (dot biru / bold text)
      const unreadThreads = await page.evaluate(() => {
        const threads = [];
        // Cari semua thread items di sidebar messenger
        const items = document.querySelectorAll('[role="row"], [role="listitem"], [data-testid="mwthreadlist-item"]');
        for (const item of items) {
          if (!item.offsetParent) continue;
          // Cek apakah ada indikator unread (font-weight bold, dot biru, aria-label "unread")
          const text = item.innerText || '';
          const isUnread = item.querySelector('[data-visualcompletion="ignore"]') ||
            item.getAttribute('aria-label')?.includes('unread') ||
            item.getAttribute('aria-label')?.includes('belum dibaca') ||
            (item.querySelector('span[dir="auto"]')?.style?.fontWeight === '700');

          if (isUnread || text.includes('●')) {
            // Ambil link thread
            const link = item.querySelector('a[href*="/messages/t/"]');
            const href = link?.getAttribute('href') || '';
            const threadId = href.match(/\/messages\/t\/(\d+)/)?.[1] || '';
            const name = item.querySelector('[role="heading"], [data-testid="mwthreadlist-item-name"]')?.textContent?.trim() ||
              link?.textContent?.trim()?.split('\n')?.[0] || '';
            if (threadId) threads.push({ threadId, name, href });
          }
        }
        return threads.slice(0, 3); // Max 3 unread per poll
      });

      if (unreadThreads.length === 0) {
        await page.close(); await context.close();
        return { success: true, processed: 0, message: 'Tidak ada pesan baru' };
      }

      let processed = 0;

      for (const thread of unreadThreads) {
        try {
          // Buka thread
          await page.goto(`https://www.facebook.com/messages/t/${thread.threadId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(3000);

          // Baca pesan terakhir dari lawan bicara
          const lastMessage = await page.evaluate(() => {
            const msgs = document.querySelectorAll('[role="row"][class*="message"], [data-testid="incoming_group"], div[class*="__fb-light-mode"]');
            // Fallback: ambil semua text di area chat
            const chatArea = document.querySelector('[role="main"]');
            if (!chatArea) return null;
            const allText = chatArea.innerText || '';
            const lines = allText.split('\n').filter(l => l.trim() && l.length > 1 && l.length < 500);
            // Pesan terakhir biasanya di bawah
            return lines.length > 0 ? lines[lines.length - 1] : null;
          });

          if (!lastMessage) continue;

          // Cek conversation di DB
          const conv = getOrCreateConversation(bot.id, thread.threadId, thread.name);
          if (conv.status === 'closed') continue;
          if (conv.round_count >= (bot.max_rounds || 5)) continue;

          // Cek apakah pesan ini sudah pernah diproses (compare last message)
          const existingMsgs = JSON.parse(conv.messages || '[]');
          const lastCustomerMsg = existingMsgs.filter(m => m.role === 'customer').pop();
          if (lastCustomerMsg && lastCustomerMsg.text === lastMessage) continue; // sudah diproses

          // Simpan pesan customer
          appendMessage(conv.id, 'customer', lastMessage);

          // Delay natural
          const delay = Math.min((bot.auto_reply_delay_sec || 30) * 1000, 60000);
          await sleep(delay);

          // Generate reply
          const freshConv = db.prepare('SELECT * FROM page_conversations WHERE id = ?').get(conv.id);
          const reply = await generatePersonalReply(bot, freshConv, lastMessage);

          // Ketik dan kirim reply di browser
          const sent = await page.evaluate(async (replyText) => {
            // Cari composer/input area
            const composer = document.querySelector('[role="textbox"][contenteditable="true"]') ||
              document.querySelector('[aria-label*="Pesan"], [aria-label*="Message"], [aria-placeholder*="Aa"]');
            if (!composer) return false;

            composer.focus();
            await new Promise(r => setTimeout(r, 300));

            // Clear dan ketik
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, replyText);
            await new Promise(r => setTimeout(r, 500));

            // Klik tombol kirim atau tekan Enter
            const sendBtn = document.querySelector('[aria-label="Kirim"], [aria-label="Send"], [aria-label="Press enter to send"]');
            if (sendBtn) { sendBtn.click(); return true; }

            // Fallback: tekan Enter
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            return true;
          }, reply);

          if (sent) {
            appendMessage(conv.id, 'bot', reply);
            incrementRound(conv.id);
            db.prepare('UPDATE page_bots SET total_messages_sent = total_messages_sent + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(bot.id);
            processed++;

            const updatedConv = db.prepare('SELECT round_count FROM page_conversations WHERE id = ?').get(conv.id);
            if (updatedConv.round_count >= (bot.max_rounds || 5)) {
              closeConversation(conv.id);
            }
          }

          await sleep(2000);
        } catch (e) {
          console.error(`[personal-inbox] thread ${thread.threadId} error:`, e.message);
        }
      }

      await page.close(); await context.close();
      return { success: true, processed, threads: unreadThreads.length };
    } finally {
      await browser.close().catch(() => {});
    }
  }, account.user_id);
}

module.exports = { pollPersonalInbox, generatePersonalReply };
