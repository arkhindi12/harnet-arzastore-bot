// Routes: Conversation-as-a-Service (Page Inbox Bot)
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { handleIncomingMessage, verifyWebhook } = require('../services/conversationService');

const router = express.Router();

// Facebook Webhook verification (GET) — no auth
const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || 'arzabot_webhook_verify_2026';

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const result = verifyWebhook(mode, token, challenge, VERIFY_TOKEN);
  if (result.valid) return res.status(200).send(result.challenge);
  res.status(403).send('Forbidden');
});

// Facebook Webhook messages (POST) — no auth
router.post('/webhook', express.json(), async (req, res) => {
  // Respond 200 immediately (Facebook requires fast response)
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'page') return;

    for (const entry of (body.entry || [])) {
      const pageId = entry.id;
      for (const event of (entry.messaging || [])) {
        const senderId = event.sender?.id;
        const message = event.message;

        // Skip jika bukan pesan teks atau dari page sendiri
        if (!message || !message.text || event.sender?.id === pageId) continue;
        // Skip echo
        if (message.is_echo) continue;

        const senderName = null; // Facebook tidak kirim nama di webhook, bisa fetch nanti
        const text = message.text;

        // Handle async (jangan block webhook response)
        handleIncomingMessage(pageId, senderId, senderName, text)
          .catch(err => console.error('[conversation-webhook] error:', err.message));
      }
    }
  } catch (err) {
    console.error('[conversation-webhook] parse error:', err.message);
  }
});

// ===== CRUD Page Bots (authenticated) =====
router.use('/bots', authMiddleware, subscriptionMiddleware);

router.get('/bots', (req, res) => {
  const bots = db.prepare(`
    SELECT pb.id, pb.type, pb.account_id, pb.page_id, pb.page_name, pb.is_active,
           pb.persona_name, pb.persona_style, pb.wa_number, pb.max_rounds,
           pb.business_hours_start, pb.business_hours_end, pb.auto_reply_delay_sec,
           pb.poll_interval_sec, pb.total_conversations, pb.total_messages_sent,
           pb.last_poll, pb.created_at, pb.updated_at,
           fa.name as account_name
    FROM page_bots pb
    LEFT JOIN fb_accounts fa ON fa.id = pb.account_id
    WHERE pb.user_id = ? ORDER BY pb.created_at DESC
  `).all(req.userId);
  res.json(bots);
});

router.post('/bots', (req, res) => {
  const {
    type = 'page',
    account_id,
    page_id, page_name, page_access_token,
    persona_name = 'CS', persona_style = 'ramah dan profesional',
    product_info = '', wa_number = '', max_rounds = 5,
    closing_message = '', greeting_message = '',
    business_hours_start = 8, business_hours_end = 22,
    auto_reply_delay_sec = 30, poll_interval_sec = 180,
  } = req.body || {};

  if (type === 'page') {
    if (!page_id || !page_access_token) return res.status(400).json({ error: 'page_id dan page_access_token wajib untuk tipe Page' });
  } else if (type === 'personal') {
    if (!account_id) return res.status(400).json({ error: 'account_id wajib untuk tipe Personal' });
    // Cek akun milik user
    const acc = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(account_id, req.userId);
    if (!acc) return res.status(404).json({ error: 'Akun Facebook tidak ditemukan' });
  } else {
    return res.status(400).json({ error: 'type harus "page" atau "personal"' });
  }

  const existing = type === 'page'
    ? db.prepare('SELECT id FROM page_bots WHERE user_id = ? AND page_id = ?').get(req.userId, page_id)
    : db.prepare('SELECT id FROM page_bots WHERE user_id = ? AND account_id = ? AND type = ?').get(req.userId, account_id, 'personal');
  if (existing) return res.status(400).json({ error: 'Bot untuk akun/page ini sudah ada.' });

  const id = uuidv4();
  db.prepare(`INSERT INTO page_bots (
    id, user_id, type, account_id, page_id, page_name, page_access_token, is_active,
    persona_name, persona_style, product_info, wa_number, max_rounds,
    closing_message, greeting_message, business_hours_start, business_hours_end,
    auto_reply_delay_sec, poll_interval_sec
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.userId, type, account_id || null, page_id || null, page_name || null, page_access_token || null,
      persona_name, persona_style, product_info, wa_number, Number(max_rounds) || 5,
      closing_message, greeting_message, Number(business_hours_start) ?? 8, Number(business_hours_end) ?? 22,
      Number(auto_reply_delay_sec) || 30, Number(poll_interval_sec) || 180);

  res.json({ id, message: type === 'page' ? 'Bot Page berhasil dibuat.' : 'Bot Personal berhasil dibuat. Scheduler akan mulai polling inbox.' });
});

router.put('/bots/:id', (req, res) => {
  const bot = db.prepare('SELECT * FROM page_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!bot) return res.status(404).json({ error: 'Bot tidak ditemukan' });

  const allowed = ['page_name', 'page_access_token', 'is_active', 'persona_name', 'persona_style', 'product_info', 'wa_number', 'max_rounds', 'closing_message', 'greeting_message', 'business_hours_start', 'business_hours_end', 'auto_reply_delay_sec', 'poll_interval_sec'];
  const updates = []; const vals = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      vals.push(key === 'is_active' ? (req.body[key] ? 1 : 0) : req.body[key]);
    }
  }
  if (!updates.length) return res.json({ message: 'Tidak ada perubahan' });
  vals.push(req.params.id);
  db.prepare(`UPDATE page_bots SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals);
  res.json({ message: 'Bot diperbarui' });
});

router.delete('/bots/:id', (req, res) => {
  const bot = db.prepare('SELECT id FROM page_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!bot) return res.status(404).json({ error: 'Bot tidak ditemukan' });
  db.prepare('DELETE FROM page_conversations WHERE bot_id = ?').run(req.params.id);
  db.prepare('DELETE FROM page_bots WHERE id = ?').run(req.params.id);
  res.json({ message: 'Bot dihapus' });
});

router.post('/bots/:id/toggle', (req, res) => {
  const bot = db.prepare('SELECT id, is_active FROM page_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!bot) return res.status(404).json({ error: 'Bot tidak ditemukan' });
  const newState = bot.is_active ? 0 : 1;
  db.prepare('UPDATE page_bots SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newState, req.params.id);
  res.json({ is_active: newState, message: newState ? 'Bot diaktifkan' : 'Bot dinonaktifkan' });
});

// Conversations log
router.get('/bots/:id/conversations', (req, res) => {
  const bot = db.prepare('SELECT id FROM page_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!bot) return res.status(404).json({ error: 'Bot tidak ditemukan' });
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const convs = db.prepare(`
    SELECT id, sender_id, sender_name, round_count, status, escalated, last_message_at, created_at
    FROM page_conversations WHERE bot_id = ? ORDER BY last_message_at DESC LIMIT ?
  `).all(req.params.id, limit);
  res.json(convs);
});

router.get('/conversations/:convId/messages', (req, res) => {
  const conv = db.prepare(`
    SELECT pc.*, pb.user_id FROM page_conversations pc
    JOIN page_bots pb ON pc.bot_id = pb.id
    WHERE pc.id = ? AND pb.user_id = ?
  `).get(req.params.convId, req.userId);
  if (!conv) return res.status(404).json({ error: 'Conversation tidak ditemukan' });
  res.json({ ...conv, messages: JSON.parse(conv.messages || '[]') });
});

module.exports = router;
