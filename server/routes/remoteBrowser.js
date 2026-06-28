// Route: Remote Browser Login via WebSocket
const express = require('express');
const { WebSocketServer } = require('ws');
const { authMiddleware } = require('../middleware/auth');
const { startSession, sendInput, closeSession } = require('../services/remoteBrowserService');

const router = express.Router();
router.use(authMiddleware);

router.post('/start', async (req, res) => {
  const { account_id } = req.body || {};
  if (!account_id) return res.status(400).json({ error: 'account_id wajib' });
  try {
    const result = await startSession(account_id, req.userId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/close', async (req, res) => {
  const { account_id } = req.body || {};
  if (account_id) await closeSession(account_id);
  res.json({ ok: true });
});

router.post('/input', async (req, res) => {
  const { account_id, event } = req.body || {};
  if (!account_id || !event) return res.status(400).json({ error: 'account_id dan event wajib' });
  await sendInput(account_id, event);
  res.json({ ok: true });
});

module.exports = router;

module.exports.attachWS = function attachWS(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.pathname.startsWith('/ws/remote-browser/')) { socket.destroy(); return; }

    const token = url.searchParams.get('token');
    const accountId = decodeURIComponent(url.pathname.split('/ws/remote-browser/')[1]);
    if (!token || !accountId) { socket.destroy(); return; }

    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env.JWT_SECRET || 'arzastore-secret-key-2024');
    } catch { socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const { activeSessions } = require('../services/remoteBrowserService');
      const session = activeSessions.get(accountId);
      if (!session) { ws.close(4004, 'No session'); return; }
      session.startStream(ws);
      ws.on('close', () => { clearInterval(session.screenshotInterval); });
      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'input') await sendInput(accountId, msg.event);
        } catch {}
      });
    });
  });
};
