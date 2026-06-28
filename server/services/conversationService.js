// Conversation-as-a-Service: AI auto-reply inbox Facebook Page via Graph API.
// Alur:
// 1. Facebook kirim webhook saat ada pesan masuk ke Page
// 2. Service cari bot config untuk page_id tersebut
// 3. Load conversation history dari DB
// 4. AI generate balasan sesuai persona + product info + context
// 5. Kirim balasan via Graph API Send Message
// 6. Kalau sudah max_rounds, kirim closing message + nomor WA

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const GRAPH_API = 'https://graph.facebook.com/v19.0';

function getBotByPageId(pageId) {
  return db.prepare('SELECT * FROM page_bots WHERE page_id = ? AND is_active = 1').get(pageId);
}

function getOrCreateConversation(botId, senderId, senderName) {
  let conv = db.prepare('SELECT * FROM page_conversations WHERE bot_id = ? AND sender_id = ? AND status = ?').get(botId, senderId, 'active');
  if (!conv) {
    const id = uuidv4();
    db.prepare('INSERT INTO page_conversations (id, bot_id, sender_id, sender_name, messages, round_count, status, last_message_at) VALUES (?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)')
      .run(id, botId, senderId, senderName || null, '[]', 'active');
    conv = db.prepare('SELECT * FROM page_conversations WHERE id = ?').get(id);
  }
  return conv;
}

function appendMessage(convId, role, text) {
  const conv = db.prepare('SELECT messages FROM page_conversations WHERE id = ?').get(convId);
  const msgs = JSON.parse(conv?.messages || '[]');
  msgs.push({ role, text, time: new Date().toISOString() });
  // Keep last 20 messages for context
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

async function sendMessage(pageAccessToken, recipientId, text) {
  try {
    await axios.post(`${GRAPH_API}/me/messages`, {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    }, {
      params: { access_token: pageAccessToken },
      timeout: 15000,
    });
    return { success: true };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('[conversation-service] sendMessage error:', msg);
    return { success: false, error: msg };
  }
}

async function generateReply(bot, conversation, incomingMessage) {
  const { generateText } = require('./groqService');

  const productInfo = bot.product_info || 'Tidak ada info produk spesifik.';
  const waNumber = bot.wa_number || '';
  const personaName = bot.persona_name || 'CS';
  const personaStyle = bot.persona_style || 'ramah dan profesional';
  const maxRounds = bot.max_rounds || 5;
  const currentRound = (conversation.round_count || 0) + 1;
  const isLastRound = currentRound >= maxRounds;

  const msgs = JSON.parse(conversation.messages || '[]');

  const systemPrompt = `Kamu adalah ${personaName}, customer service di Facebook Page.
Gaya bicara: ${personaStyle}.
Info produk/bisnis: ${productInfo}

ATURAN WAJIB:
- Jawab dalam bahasa Indonesia, singkat (maks 3 kalimat)
- Jangan bilang kamu AI/bot/otomatis
- Jangan pakai caps lock berlebihan
- Kalau customer tanya harga/stok, jawab sesuai info produk
- Kalau customer sudah tertarik/mau beli, arahkan ke WhatsApp: ${waNumber || '(belum diset)'}
${isLastRound ? `- INI RONDE TERAKHIR. Wajib tutup percakapan dengan mengarahkan ke WhatsApp ${waNumber} untuk lanjut order.` : ''}
- Kalau customer bilang terima kasih/sudah cukup, tutup dengan sopan

Jawab HANYA teks balasan, tanpa tanda kutip, tanpa penjelasan.`;

  const aiMessages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  for (const m of msgs.slice(-10)) {
    aiMessages.push({
      role: m.role === 'customer' ? 'user' : 'assistant',
      content: m.text,
    });
  }
  // Add current incoming message
  aiMessages.push({ role: 'user', content: incomingMessage });

  try {
    const result = await generateText(bot.user_id, aiMessages, {
      temperature: 0.7,
      max_tokens: 200,
    });
    let reply = (result.text || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();

    // Kalau ronde terakhir dan reply belum mention WA, append
    if (isLastRound && waNumber && !reply.includes(waNumber)) {
      reply += `\n\nUntuk lanjut order, silakan chat WA kami di ${waNumber} ya kak 🙏`;
    }

    return reply || 'Terima kasih sudah menghubungi kami! 🙏';
  } catch (err) {
    console.error('[conversation-service] AI error:', err.message);
    // Fallback
    if (waNumber) return `Terima kasih sudah menghubungi! Untuk info lebih lanjut, silakan WA kami di ${waNumber} ya kak 🙏`;
    return 'Terima kasih sudah menghubungi! Admin kami akan segera membalas. 🙏';
  }
}

function isWithinBusinessHours(bot) {
  const hour = new Date().getHours();
  const start = bot.business_hours_start ?? 8;
  const end = bot.business_hours_end ?? 22;
  if (start <= end) return hour >= start && hour <= end;
  return hour >= start || hour <= end;
}

async function handleIncomingMessage(pageId, senderId, senderName, messageText) {
  const bot = getBotByPageId(pageId);
  if (!bot) return { handled: false, reason: 'no_bot_config' };
  if (!bot.is_active) return { handled: false, reason: 'bot_inactive' };

  // Cek jam operasional
  if (!isWithinBusinessHours(bot)) {
    return { handled: false, reason: 'outside_business_hours' };
  }

  // Get/create conversation
  const conv = getOrCreateConversation(bot.id, senderId, senderName);

  // Kalau conversation sudah closed/escalated, skip
  if (conv.status === 'closed') return { handled: false, reason: 'conversation_closed' };

  // Cek max rounds
  if (conv.round_count >= (bot.max_rounds || 5)) {
    // Sudah di-close sebelumnya, skip
    return { handled: false, reason: 'max_rounds_reached' };
  }

  // Simpan pesan customer
  appendMessage(conv.id, 'customer', messageText);

  // Delay sebelum reply (supaya natural)
  const delay = (bot.auto_reply_delay_sec || 30) * 1000;
  await new Promise(r => setTimeout(r, Math.min(delay, 60000)));

  // Generate AI reply
  const freshConv = db.prepare('SELECT * FROM page_conversations WHERE id = ?').get(conv.id);
  const reply = await generateReply(bot, freshConv, messageText);

  // Kirim reply
  const sendResult = await sendMessage(bot.page_access_token, senderId, reply);

  if (sendResult.success) {
    appendMessage(conv.id, 'bot', reply);
    incrementRound(conv.id);
    db.prepare('UPDATE page_bots SET total_messages_sent = total_messages_sent + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(bot.id);

    // Cek apakah ini ronde terakhir → close conversation
    const updatedConv = db.prepare('SELECT round_count FROM page_conversations WHERE id = ?').get(conv.id);
    if (updatedConv.round_count >= (bot.max_rounds || 5)) {
      closeConversation(conv.id);
    }
  }

  return { handled: true, reply, sendResult };
}

// Verify webhook dari Facebook
function verifyWebhook(mode, token, challenge, expectedToken) {
  if (mode === 'subscribe' && token === expectedToken) {
    return { valid: true, challenge };
  }
  return { valid: false };
}

module.exports = { handleIncomingMessage, verifyWebhook, getBotByPageId };
