const axios = require('axios');
const db = require('../db/database');
const crypto = require('crypto');

async function triggerWebhook(userId, event, data) {
  const webhooks = db.prepare("SELECT * FROM webhooks WHERE user_id = ? AND is_active = 1").all(userId);
  for (const wh of webhooks) {
    let events = [];
    try { events = JSON.parse(wh.events || '[]'); } catch {}
    if (events.length > 0 && !events.includes(event) && !events.includes('*')) continue;

    const payload = { event, data, timestamp: new Date().toISOString(), source: 'ArzaBot' };
    const body = JSON.stringify(payload);
    const headers = { 'Content-Type': 'application/json', 'X-ArzaBot-Event': event };
    if (wh.secret) {
      headers['X-ArzaBot-Signature'] = 'sha256=' + crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
    }

    try {
      await axios.post(wh.url, payload, { headers, timeout: 10000 });
      db.prepare('UPDATE webhooks SET last_triggered = CURRENT_TIMESTAMP, total_sent = total_sent + 1 WHERE id = ?').run(wh.id);
    } catch (e) {
      console.error(`[Webhook] Failed to send to ${wh.url}:`, e.message);
    }
  }
}

module.exports = { triggerWebhook };
