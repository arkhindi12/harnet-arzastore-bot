// Routes: Niche Group Discovery + Group Quality Score (Sprint 2).

const express = require('express');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { friendlyError } = require('../middleware/friendlyError');
const {
  searchNicheGroups,
  listNicheGroups,
  listKeywords,
  importNicheGroupsToAccount,
  getRunningStatus,
  getRecentRuns,
  enrichGroupDetail,
} = require('../services/nicheGroupService');
const { listForUser: listGroupQuality, recordOutcome: recordGroupOutcome } = require('../services/groupQualityService');

const router = express.Router();
router.use(authMiddleware);
router.use(subscriptionMiddleware);

// === Niche search ===
// POST /api/niche/search { account_id, keyword, max? }
router.post('/search', async (req, res) => {
  const { account_id, keyword, max, browser_engine } = req.body || {};
  if (!account_id || !keyword) return res.status(400).json({ error: 'account_id dan keyword wajib diisi' });
  // Jalan async di background, tapi tetap return promise singkat agar UI bisa langsung lihat hasil setelah selesai
  try {
    const account = db.prepare('SELECT browser_engine FROM fb_accounts WHERE id = ? AND user_id = ?').get(account_id, req.userId);
    const r = await searchNicheGroups(req.userId, account_id, String(keyword).trim(), { max, browser_engine: browser_engine || account?.browser_engine || 'patchright' });
    if (!r.success) return res.status(400).json(r);
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'Gagal pencarian niche: ' + err.message });
  }
});

// GET /api/niche/groups?keyword=&limit=
router.get('/groups', (req, res) => {
  const groups = listNicheGroups(req.userId, { keyword: req.query.keyword, limit: req.query.limit });
  res.json(groups);
});

// GET /api/niche/keywords
router.get('/keywords', (req, res) => {
  res.json(listKeywords(req.userId));
});

// POST /api/niche/import { account_id, ids: [] }
router.post('/import', (req, res) => {
  const { account_id, ids } = req.body || {};
  if (!account_id || !Array.isArray(ids)) return res.status(400).json({ error: 'account_id dan ids[] wajib diisi' });
  const r = importNicheGroupsToAccount(req.userId, account_id, ids);
  if (!r.success) return res.status(400).json(r);
  res.json(r);
});

// DELETE /api/niche/keywords  body: { keywords: ['kw1','kw2'] }
router.delete('/keywords', (req, res) => {
  const list = Array.isArray(req.body?.keywords) ? req.body.keywords.filter(k => typeof k === 'string' && k.trim()) : [];
  if (!list.length) return res.status(400).json({ error: 'keywords[] wajib diisi' });
  const placeholders = list.map(() => '?').join(',');
  const info1 = db.prepare(`DELETE FROM niche_groups WHERE user_id = ? AND keyword IN (${placeholders})`).run(req.userId, ...list);
  const info2 = db.prepare(`DELETE FROM niche_search_runs WHERE user_id = ? AND keyword IN (${placeholders})`).run(req.userId, ...list);
  res.json({ success: true, deletedGroups: info1.changes, deletedRuns: info2.changes });
});

// DELETE /api/niche/groups/:id
router.delete('/groups/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM niche_groups WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Grup niche tidak ditemukan' });
  db.prepare('DELETE FROM niche_groups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/niche/runs
router.get('/runs', (req, res) => {
  res.json(getRecentRuns(req.userId, parseInt(req.query.limit) || 30));
});

// GET /api/niche/status
router.get('/status', (req, res) => {
  res.json({ running: getRunningStatus(req.userId) });
});

// === Group Quality Score ===
// GET /api/niche/group-quality
router.get('/group-quality', (req, res) => {
  const rows = listGroupQuality(req.userId, { limit: req.query.limit, minGrade: req.query.minGrade });
  res.json(rows);
});

// POST /api/niche/group-quality/record { group_url, success, error_message?, name? }
router.post('/group-quality/record', (req, res) => {
  const { group_url, success, error_message, name, group_id } = req.body || {};
  if (!group_url) return res.status(400).json({ error: 'group_url wajib' });
  const r = recordGroupOutcome(req.userId, group_url, !!success, error_message || null, name || null, group_id || null);
  res.json({ success: true, result: r });
});

// POST /api/niche/enrich { account_id, group_id }
router.post('/enrich', async (req, res) => {
  const { account_id, group_id } = req.body || {};
  if (!account_id || !group_id) return res.status(400).json({ error: 'account_id dan group_id wajib' });
  try {
    const r = await enrichGroupDetail(req.userId, account_id, group_id);
    if (!r.success) return res.status(400).json({ error: friendlyError(r.error || 'Gagal enrich').message });
    res.json(r);
  } catch (err) {
    const { message } = friendlyError(err);
    res.status(500).json({ error: message });
  }
});

// GET /api/niche/my-groups?account_id=
router.get('/my-groups', (req, res) => {
  const accountId = req.query.account_id;
  let rows;
  if (accountId) {
    rows = db.prepare(`
      SELECT ag.group_id, ag.name, ag.url, ag.keyword, ag.join_status, ag.joined_at, ag.last_seen
      FROM account_groups ag
      JOIN fb_accounts fa ON fa.id = ag.account_id
      WHERE fa.user_id = ? AND ag.account_id = ?
      ORDER BY ag.keyword ASC, ag.joined_at DESC
    `).all(req.userId, accountId);
  } else {
    rows = db.prepare(`
      SELECT ag.group_id, ag.name, ag.url, ag.keyword, ag.join_status, ag.joined_at, ag.last_seen, fa.name as account_name
      FROM account_groups ag
      JOIN fb_accounts fa ON fa.id = ag.account_id
      WHERE fa.user_id = ?
      ORDER BY ag.keyword ASC, ag.joined_at DESC
    `).all(req.userId);
  }
  // Group by keyword
  const grouped = {};
  for (const r of rows) {
    const kw = r.keyword || 'Tanpa Keyword';
    if (!grouped[kw]) grouped[kw] = [];
    grouped[kw].push(r);
  }
  res.json({ groups: rows, grouped, total: rows.length });
});

module.exports = router;
