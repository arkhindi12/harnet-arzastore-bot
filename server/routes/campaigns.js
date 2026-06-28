const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { checkCampaignLimit } = require('../services/planLimits');

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get('/', (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  const result = campaigns.map(c => ({
    ...c,
    targets: JSON.parse(c.targets || '[]'),
    account_ids: JSON.parse(c.account_ids || '[]'),
  }));
  res.json(result);
});

router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });

  const logs = db.prepare(`
    SELECT cl.*, fa.name as account_name 
    FROM comment_logs cl 
    LEFT JOIN fb_accounts fa ON cl.account_id = fa.id 
    WHERE cl.campaign_id = ? 
    ORDER BY cl.created_at DESC 
    LIMIT 100
  `).all(req.params.id);

  res.json({
    ...campaign,
    targets: JSON.parse(campaign.targets || '[]'),
    account_ids: JSON.parse(campaign.account_ids || '[]'),
    logs,
  });
});

router.post('/', (req, res) => {
  // Cek limit kampanye
  const limitCheck = checkCampaignLimit(req.userId);
  if (!limitCheck.allowed) {
    return res.status(403).json({ error: limitCheck.error, code: 'CAMPAIGN_LIMIT_REACHED' });
  }

  const {
    name, description, targets, comment_template, account_ids,
    delay_min, delay_max, schedule_time, repeat_interval,
    daily_limit, active_hours_start, active_hours_end,
    session_size, session_break_min, session_break_max, max_errors,
    ai_smart_comment, ai_topic, ai_tone,
    browser_engine,
  } = req.body;

  const useAi = ai_smart_comment ? 1 : 0;
  if (!name || !targets?.length || !account_ids?.length) {
    return res.status(400).json({ error: 'Nama, target URL, dan akun diperlukan' });
  }
  if (!useAi && !comment_template) {
    return res.status(400).json({ error: 'Template komentar wajib diisi (atau aktifkan Smart AI Comment + isi topik)' });
  }
  if (useAi && !ai_topic?.trim()) {
    return res.status(400).json({ error: 'Topik wajib diisi untuk Smart AI Comment' });
  }

  for (const accountId of account_ids) {
    const account = db.prepare('SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?').get(accountId, req.userId);
    if (!account) return res.status(400).json({ error: `Akun ${accountId} tidak ditemukan` });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO campaigns (
      id, user_id, name, description, targets, comment_template, account_ids,
      delay_min, delay_max, status, schedule_time, repeat_interval,
      daily_limit, active_hours_start, active_hours_end,
      session_size, session_break_min, session_break_max, max_errors,
      ai_smart_comment, ai_topic, ai_tone, browser_engine
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.userId, name, description || '',
    JSON.stringify(targets), comment_template || '', JSON.stringify(account_ids),
    delay_min || 5, delay_max || 30, schedule_time || null, repeat_interval || 0,
    daily_limit || 0, active_hours_start ?? 0, active_hours_end ?? 23,
    session_size || 10, session_break_min || 10, session_break_max || 30, max_errors || 3,
    useAi, ai_topic || null, ai_tone || 'natural'
  );

  res.json({ id, message: 'Kampanye berhasil dibuat' });
});

router.put('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });

  if (campaign.status === 'running') {
    return res.status(400).json({ error: 'Tidak bisa mengedit kampanye yang sedang berjalan' });
  }

  const {
    name, description, targets, comment_template, account_ids,
    delay_min, delay_max, schedule_time, repeat_interval,
    daily_limit, active_hours_start, active_hours_end,
    session_size, session_break_min, session_break_max, max_errors,
    ai_smart_comment, ai_topic, ai_tone,
    browser_engine,
  } = req.body;

  db.prepare(`
    UPDATE campaigns SET 
      name = ?, description = ?, targets = ?, comment_template = ?, account_ids = ?,
      delay_min = ?, delay_max = ?, schedule_time = ?, repeat_interval = ?,
      daily_limit = ?, active_hours_start = ?, active_hours_end = ?,
      session_size = ?, session_break_min = ?, session_break_max = ?, max_errors = ?,
      ai_smart_comment = ?, ai_topic = ?, ai_tone = ?, browser_engine = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name || campaign.name,
    description ?? campaign.description,
    targets ? JSON.stringify(targets) : campaign.targets,
    comment_template ?? campaign.comment_template,
    account_ids ? JSON.stringify(account_ids) : campaign.account_ids,
    delay_min ?? campaign.delay_min,
    delay_max ?? campaign.delay_max,
    schedule_time ?? campaign.schedule_time,
    repeat_interval ?? campaign.repeat_interval,
    daily_limit ?? campaign.daily_limit ?? 0,
    active_hours_start ?? campaign.active_hours_start ?? 0,
    active_hours_end ?? campaign.active_hours_end ?? 23,
    session_size ?? campaign.session_size ?? 10,
    session_break_min ?? campaign.session_break_min ?? 10,
    session_break_max ?? campaign.session_break_max ?? 30,
    max_errors ?? campaign.max_errors ?? 3,
    ai_smart_comment !== undefined ? (ai_smart_comment ? 1 : 0) : (campaign.ai_smart_comment ?? 0),
    browser_engine !== undefined ? (['patchright','obscura'].includes(browser_engine) ? browser_engine : 'patchright') : (campaign.browser_engine || 'patchright'),
    ai_topic !== undefined ? (ai_topic || null) : campaign.ai_topic,
    ai_tone !== undefined ? (ai_tone || 'natural') : (campaign.ai_tone || 'natural'),
    req.params.id
  );

  res.json({ message: 'Kampanye berhasil diperbarui' });
});

router.post('/:id/duplicate', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });
  const newId = uuidv4();
  db.prepare(`
    INSERT INTO campaigns (
      id, user_id, name, description, targets, comment_template, account_ids,
      delay_min, delay_max, status, schedule_time, repeat_interval,
      daily_limit, active_hours_start, active_hours_end,
      session_size, session_break_min, session_break_max, max_errors,
      schedule_start, schedule_end, auto_rotate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId, req.userId, `${campaign.name} (Salinan)`, campaign.description,
    campaign.targets, campaign.comment_template, campaign.account_ids,
    campaign.delay_min, campaign.delay_max, campaign.schedule_time, campaign.repeat_interval,
    campaign.daily_limit, campaign.active_hours_start, campaign.active_hours_end,
    campaign.session_size, campaign.session_break_min, campaign.session_break_max, campaign.max_errors,
    campaign.schedule_start || null, campaign.schedule_end || null, campaign.auto_rotate ?? 1
  );
  res.json({ id: newId, message: 'Kampanye berhasil diduplikasi' });
});

router.get('/:id/export', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });
  const logs = db.prepare(`
    SELECT cl.*, fa.name as account_name
    FROM comment_logs cl
    LEFT JOIN fb_accounts fa ON cl.account_id = fa.id
    WHERE cl.campaign_id = ? ORDER BY cl.created_at DESC
  `).all(req.params.id);

  const escape = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const headers = ['Waktu', 'Akun', 'URL Target', 'Komentar', 'Status', 'Pesan Error'];
  const rows = logs.map(l => [
    escape(new Date(l.created_at).toLocaleString('id-ID')),
    escape(l.account_name || ''),
    escape(l.target_url || ''),
    escape(l.comment_text || ''),
    escape(l.status || ''),
    escape(l.error_message || ''),
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const filename = `kampanye-${campaign.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
});

router.post('/:id/pause', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });
  const { stopCampaign } = require('../services/campaignRunner');
  stopCampaign(req.params.id);
  db.prepare("UPDATE campaigns SET status='paused', paused_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);
  res.json({ message: 'Kampanye dijeda', status: 'paused' });
});

router.delete('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });

  try {
    // Stop runner kalau masih jalan supaya tidak nulis ke row yang barusan dihapus
    if (campaign.status === 'running') {
      try {
        const { stopCampaign, isRunning } = require('../services/campaignRunner');
        if (isRunning(req.params.id)) stopCampaign(req.params.id);
      } catch {}
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM comment_logs WHERE campaign_id = ?').run(req.params.id);
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    });
    tx();

    res.json({ message: 'Kampanye berhasil dihapus' });
  } catch (err) {
    console.error('[campaigns.delete] gagal:', err);
    res.status(500).json({ error: 'Gagal menghapus kampanye: ' + err.message });
  }
});

router.get('/:id/logs', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });

  const logs = db.prepare(`
    SELECT cl.*, fa.name as account_name 
    FROM comment_logs cl 
    LEFT JOIN fb_accounts fa ON cl.account_id = fa.id 
    WHERE cl.campaign_id = ? 
    ORDER BY cl.created_at DESC 
    LIMIT 200
  `).all(req.params.id);

  res.json(logs);
});

module.exports = router;
