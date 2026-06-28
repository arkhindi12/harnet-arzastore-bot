const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { postComment: commentOnPost } = require('../services/facebookService');

const router = express.Router();
router.use(authMiddleware);

const runningTests = new Set();
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return sleep((Math.random() * (max - min) + min) * 1000); }
function processSpintax(text) {
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

router.get('/', (req, res) => {
  const tests = db.prepare('SELECT * FROM ab_tests WHERE user_id=? ORDER BY created_at DESC').all(req.userId);
  res.json(tests.map(t => ({ ...t, targets: JSON.parse(t.targets || '[]'), account_ids: JSON.parse(t.account_ids || '[]') })));
});

router.post('/', (req, res) => {
  const { name, targets, template_a, template_b, account_ids, delay_min, delay_max } = req.body;
  if (!name || !targets?.length || !template_a || !template_b || !account_ids?.length)
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  const id = uuidv4();
  db.prepare(`INSERT INTO ab_tests (id, user_id, name, targets, template_a, template_b, account_ids, delay_min, delay_max) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, req.userId, name, JSON.stringify(targets), template_a, template_b, JSON.stringify(account_ids), delay_min || 5, delay_max || 30);
  res.json({ id, message: 'A/B Test dibuat' });
});

router.delete('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM ab_tests WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!t) return res.status(404).json({ error: 'Test tidak ditemukan' });
  if (runningTests.has(req.params.id)) return res.status(400).json({ error: 'Test sedang berjalan' });
  db.prepare('DELETE FROM ab_test_logs WHERE test_id=?').run(req.params.id);
  db.prepare('DELETE FROM ab_tests WHERE id=?').run(req.params.id);
  res.json({ message: 'Test dihapus' });
});

router.post('/:id/start', async (req, res) => {
  const test = db.prepare('SELECT * FROM ab_tests WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!test) return res.status(404).json({ error: 'Test tidak ditemukan' });
  if (runningTests.has(req.params.id)) return res.status(400).json({ error: 'Test sudah berjalan' });

  db.prepare("UPDATE ab_tests SET status='running', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);
  runningTests.add(req.params.id);
  res.json({ message: 'A/B Test dimulai' });

  (async () => {
    try {
      const targets = JSON.parse(test.targets || '[]');
      const accountIds = JSON.parse(test.account_ids || '[]');
      let sa = 0, fa = 0, sb = 0, fb = 0;

      for (let i = 0; i < targets.length; i++) {
        if (!runningTests.has(req.params.id)) break;
        const url = targets[i];
        const variant = i % 2 === 0 ? 'A' : 'B';
        const template = variant === 'A' ? test.template_a : test.template_b;
        const accountId = accountIds[i % accountIds.length];
        const account = db.prepare("SELECT * FROM fb_accounts WHERE id=? AND status='active'").get(accountId);
        if (!account) continue;

        const comment = processSpintax(template);
        const result = await commentOnPost(account.cookies, url, comment);
        const logId = uuidv4();
        db.prepare('INSERT INTO ab_test_logs (id, test_id, account_id, target_url, variant, comment_text, status) VALUES (?,?,?,?,?,?,?)')
          .run(logId, req.params.id, accountId, url, variant, comment, result.success ? 'success' : 'failed');

        if (variant === 'A') { if (result.success) sa++; else fa++; }
        else { if (result.success) sb++; else fb++; }

        await randomDelay(test.delay_min || 5, test.delay_max || 30);
      }

      db.prepare("UPDATE ab_tests SET status='idle', success_a=success_a+?, fail_a=fail_a+?, success_b=success_b+?, fail_b=fail_b+?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .run(sa, fa, sb, fb, req.params.id);
    } finally {
      runningTests.delete(req.params.id);
      db.prepare("UPDATE ab_tests SET status='idle', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);
    }
  })();
});

router.post('/:id/reset', (req, res) => {
  const t = db.prepare('SELECT * FROM ab_tests WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!t) return res.status(404).json({ error: 'Test tidak ditemukan' });
  if (runningTests.has(req.params.id)) return res.status(400).json({ error: 'Hentikan test dulu' });
  db.prepare('DELETE FROM ab_test_logs WHERE test_id=?').run(req.params.id);
  db.prepare("UPDATE ab_tests SET success_a=0, fail_a=0, success_b=0, fail_b=0, status='idle', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);
  res.json({ message: 'Hasil direset' });
});

router.get('/:id/logs', (req, res) => {
  const t = db.prepare('SELECT * FROM ab_tests WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!t) return res.status(404).json({ error: 'Test tidak ditemukan' });
  const logs = db.prepare('SELECT * FROM ab_test_logs WHERE test_id=? ORDER BY created_at DESC LIMIT 200').all(req.params.id);
  res.json(logs);
});

module.exports = router;
