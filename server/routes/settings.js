const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { testTelegram } = require('../services/telegramService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const s = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  if (!s) return res.json({ telegram_bot_token: '', telegram_chat_id: '', notify_campaign_complete: 1, notify_checkpoint: 1, notify_task_error: 1 });
  res.json({ ...s, telegram_bot_token: s.telegram_bot_token ? '***' + s.telegram_bot_token.slice(-6) : '', _has_token: !!s.telegram_bot_token });
});

router.put('/', (req, res) => {
  const { telegram_bot_token, telegram_chat_id, notify_campaign_complete, notify_checkpoint, notify_task_error } = req.body;
  const existing = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  const realToken = telegram_bot_token?.startsWith('***') ? (existing?.telegram_bot_token || '') : (telegram_bot_token || '');
  if (existing) {
    db.prepare(`UPDATE user_settings SET telegram_bot_token=?, telegram_chat_id=?, notify_campaign_complete=?, notify_checkpoint=?, notify_task_error=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
      .run(realToken, telegram_chat_id || '', notify_campaign_complete ? 1 : 0, notify_checkpoint ? 1 : 0, notify_task_error ? 1 : 0, req.userId);
  } else {
    db.prepare(`INSERT INTO user_settings (id, user_id, telegram_bot_token, telegram_chat_id, notify_campaign_complete, notify_checkpoint, notify_task_error) VALUES (?,?,?,?,?,?,?)`)
      .run(uuidv4(), req.userId, realToken, telegram_chat_id || '', notify_campaign_complete ? 1 : 0, notify_checkpoint ? 1 : 0, notify_task_error ? 1 : 0);
  }
  res.json({ message: 'Pengaturan berhasil disimpan' });
});

router.post('/test-telegram', async (req, res) => {
  const s = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  if (!s?.telegram_bot_token || !s?.telegram_chat_id) return res.status(400).json({ error: 'Token dan Chat ID Telegram belum dikonfigurasi' });
  try {
    await testTelegram(req.userId);
    res.json({ message: 'Pesan test berhasil dikirim ke Telegram!' });
  } catch (err) { res.status(500).json({ error: 'Gagal kirim: ' + err.message }); }
});

module.exports = router;
