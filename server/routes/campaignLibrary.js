const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const templates = db.prepare('SELECT * FROM campaign_templates WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(templates.map(t => ({
    ...t,
    targets: JSON.parse(t.targets || '[]'),
    account_ids: JSON.parse(t.account_ids || '[]'),
  })));
});

router.post('/', (req, res) => {
  const { name, description, targets, comment_template, account_ids, delay_min, delay_max,
    active_hours_start, active_hours_end, session_size, session_break_min, session_break_max,
    max_errors, daily_limit, auto_rotate } = req.body;
  if (!name?.trim() || !comment_template?.trim()) return res.status(400).json({ error: 'Nama dan template komentar wajib diisi' });
  const id = uuidv4();
  db.prepare(`INSERT INTO campaign_templates (id, user_id, name, description, targets, comment_template, account_ids,
    delay_min, delay_max, active_hours_start, active_hours_end, session_size, session_break_min, session_break_max,
    max_errors, daily_limit, auto_rotate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.userId, name.trim(), description || '', JSON.stringify(targets || []),
      comment_template.trim(), JSON.stringify(account_ids || []),
      delay_min ?? 5, delay_max ?? 30, active_hours_start ?? 0, active_hours_end ?? 23,
      session_size ?? 10, session_break_min ?? 10, session_break_max ?? 30,
      max_errors ?? 3, daily_limit ?? 0, auto_rotate ? 1 : 0);
  res.json({ id, message: 'Template kampanye disimpan' });
});

router.post('/from-campaign/:campaignId', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.campaignId, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });
  const id = uuidv4();
  const name = req.body.name || `Template dari: ${campaign.name}`;
  db.prepare(`INSERT INTO campaign_templates (id, user_id, name, description, targets, comment_template, account_ids,
    delay_min, delay_max, active_hours_start, active_hours_end, session_size, session_break_min, session_break_max,
    max_errors, daily_limit, auto_rotate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.userId, name, campaign.description || '', campaign.targets, campaign.comment_template, campaign.account_ids,
      campaign.delay_min, campaign.delay_max, campaign.active_hours_start, campaign.active_hours_end,
      campaign.session_size, campaign.session_break_min, campaign.session_break_max,
      campaign.max_errors, campaign.daily_limit, campaign.auto_rotate);
  res.json({ id, message: 'Kampanye disimpan sebagai template' });
});

router.put('/:id', (req, res) => {
  const tmpl = db.prepare('SELECT * FROM campaign_templates WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tmpl) return res.status(404).json({ error: 'Template tidak ditemukan' });
  const { name, description, targets, comment_template, account_ids, delay_min, delay_max,
    active_hours_start, active_hours_end, session_size, session_break_min, session_break_max,
    max_errors, daily_limit, auto_rotate } = req.body;
  db.prepare(`UPDATE campaign_templates SET name=?, description=?, targets=?, comment_template=?, account_ids=?,
    delay_min=?, delay_max=?, active_hours_start=?, active_hours_end=?, session_size=?, session_break_min=?,
    session_break_max=?, max_errors=?, daily_limit=?, auto_rotate=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(name ?? tmpl.name, description ?? tmpl.description, JSON.stringify(targets ?? JSON.parse(tmpl.targets)),
      comment_template ?? tmpl.comment_template, JSON.stringify(account_ids ?? JSON.parse(tmpl.account_ids)),
      delay_min ?? tmpl.delay_min, delay_max ?? tmpl.delay_max,
      active_hours_start ?? tmpl.active_hours_start, active_hours_end ?? tmpl.active_hours_end,
      session_size ?? tmpl.session_size, session_break_min ?? tmpl.session_break_min,
      session_break_max ?? tmpl.session_break_max, max_errors ?? tmpl.max_errors,
      daily_limit ?? tmpl.daily_limit, auto_rotate !== undefined ? (auto_rotate ? 1 : 0) : tmpl.auto_rotate,
      req.params.id);
  res.json({ message: 'Template diperbarui' });
});

router.delete('/:id', (req, res) => {
  const tmpl = db.prepare('SELECT * FROM campaign_templates WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tmpl) return res.status(404).json({ error: 'Template tidak ditemukan' });
  db.prepare('DELETE FROM campaign_templates WHERE id = ?').run(req.params.id);
  res.json({ message: 'Template dihapus' });
});

module.exports = router;
