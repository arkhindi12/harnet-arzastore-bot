const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { generateText, validateKey, listProviders, fetchModels } = require('../services/groqService');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.use(authMiddleware);

const SYSTEM_PROMPTS = {
  comment: `Kamu adalah asisten penjualan profesional Indonesia. Buat komentar Facebook yang natural, ramah, dan menarik untuk promosi produk/jasa. Gunakan bahasa Indonesia sehari-hari. Komentar harus terlihat seperti ditulis manusia, bukan bot. Maksimal 2-3 kalimat. Sertakan ajakan bertindak (WA, DM, dll).`,
  description: `Kamu adalah copywriter e-commerce Indonesia profesional. Buat deskripsi produk yang menarik, informatif, dan persuasif untuk dijual di Facebook Marketplace. Gunakan bullet point jika perlu. Sertakan keunggulan produk, kondisi, dan alasan mengapa pembeli harus beli sekarang.`,
  title: `Kamu adalah copywriter iklan Indonesia. Buat judul iklan yang singkat (max 60 karakter), menarik, dan mengandung keyword penting. Judul harus memancing rasa ingin tahu dan klik. Tulis hanya judulnya saja, tanpa penjelasan.`,
  reply: `Kamu adalah customer service profesional Indonesia. Buat template balasan komentar yang ramah, natural, dan helpful. Sertakan sapaan, jawaban singkat, dan arahkan ke kontak (WA/DM). Gunakan {WA|DM} untuk variasi. Maksimal 2 kalimat.`,
  group_post: `Kamu adalah ahli pemasaran digital Indonesia. Buat konten postingan untuk grup Facebook yang menarik, dengan hook di awal, manfaat produk/jasa, dan call-to-action. Gunakan emoji secukupnya. Natural dan tidak terkesan spam.`,
  spintax: `Kamu adalah copywriter Indonesia. Buat template dengan format spintax untuk variasi komentar/postingan otomatis. Format: {pilihan1|pilihan2|pilihan3}. Contoh: {Halo|Hi|Selamat pagi} kak, {produk kami tersedia|stok masih ada}! Buat 1 template dengan minimal 3 bagian spintax.`,
  keyword: `Kamu adalah analis pasar digital Indonesia. Buat daftar keyword/kata kunci yang sering digunakan pembeli potensial saat mencari produk tersebut di grup Facebook jual beli. Format: 1 keyword per baris, tanpa nomor, tanpa penjelasan. Maksimal 10 keyword.`,
  custom: `Kamu adalah asisten AI untuk Facebook marketing Indonesia. Bantu pengguna dengan permintaan mereka.`,
};

router.get('/providers', (req, res) => {
  res.json(listProviders());
});

// Fetch daftar model dari provider (perlu API key)
router.post('/fetch-models', async (req, res) => {
  const { provider, api_key, base_url } = req.body || {};
  if (!provider) return res.status(400).json({ error: 'Provider wajib' });
  if (!api_key?.trim()) return res.status(400).json({ error: 'API key wajib' });

  try {
    const models = await fetchModels(provider, api_key.trim(), base_url || null);
    res.json({ models });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Fetch models pakai key yang sudah tersimpan (by ID)
router.post('/keys/:id/fetch-models', async (req, res) => {
  const key = db.prepare('SELECT * FROM groq_keys WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!key) return res.status(404).json({ error: 'Key tidak ditemukan' });

  try {
    const models = await fetchModels(key.provider || 'groq', key.api_key, key.base_url);
    res.json({ models });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/keys', (req, res) => {
  const keys = db.prepare('SELECT id, label, provider, model, base_url, status, requests_today, last_used, created_at, updated_at FROM groq_keys WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(keys);
});

router.post('/keys', async (req, res) => {
  const { api_key, label, provider = 'groq', model, base_url } = req.body;
  if (!api_key?.trim()) return res.status(400).json({ error: 'API key wajib diisi' });
  const trimmedKey = api_key.trim();

  const existing = db.prepare('SELECT id FROM groq_keys WHERE user_id = ? AND api_key = ?').get(req.userId, trimmedKey);
  if (existing) return res.status(400).json({ error: 'API key ini sudah ditambahkan' });

  if (provider === 'custom' && !base_url) {
    return res.status(400).json({ error: 'Base URL wajib diisi untuk provider custom' });
  }

  const validation = await validateKey(trimmedKey, provider, model, base_url);
  if (!validation.valid) return res.status(400).json({ error: 'API key tidak valid: ' + validation.error });

  const id = uuidv4();
  db.prepare('INSERT INTO groq_keys (id, user_id, api_key, label, provider, model, base_url) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.userId, trimmedKey, label || `${provider} ${id.slice(-6)}`, provider, model || null, base_url || null);
  res.json({ id, message: 'AI key berhasil ditambahkan dan divalidasi', provider, model: validation.model });
});

router.patch('/keys/:id', (req, res) => {
  const key = db.prepare('SELECT * FROM groq_keys WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!key) return res.status(404).json({ error: 'Key tidak ditemukan' });
  const { label, model, base_url } = req.body;
  db.prepare('UPDATE groq_keys SET label=?, model=?, base_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(label ?? key.label, model ?? key.model, base_url ?? key.base_url, req.params.id);
  res.json({ message: 'Key diperbarui' });
});

router.delete('/keys/:id', (req, res) => {
  const key = db.prepare('SELECT * FROM groq_keys WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!key) return res.status(404).json({ error: 'Key tidak ditemukan' });
  db.prepare('DELETE FROM groq_keys WHERE id=?').run(req.params.id);
  res.json({ message: 'Key dihapus' });
});

router.post('/keys/:id/activate', (req, res) => {
  const key = db.prepare('SELECT * FROM groq_keys WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!key) return res.status(404).json({ error: 'Key tidak ditemukan' });
  db.prepare("UPDATE groq_keys SET status='active', reset_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);
  res.json({ message: 'Key diaktifkan kembali' });
});

router.post("/generate", aiLimiter, async (req, res) => {
  const { type = 'custom', context, extra_instruction, language = 'id' } = req.body;
  if (!context?.trim()) return res.status(400).json({ error: 'Context/topik wajib diisi' });

  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.custom;
  const userPrompt = extra_instruction
    ? `Topik/Produk: ${context}\n\nInstruksi tambahan: ${extra_instruction}`
    : `Topik/Produk: ${context}`;

  try {
    const result = await generateText(req.userId, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate banyak variasi sekaligus
router.post("/generate-batch", aiLimiter, async (req, res) => {
  const { type = 'comment', context, count = 5 } = req.body;
  if (!context?.trim()) return res.status(400).json({ error: 'Context wajib diisi' });

  const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.custom;
  const n = Math.min(count, 10);
  const userPrompt = `Topik/Produk: ${context}\n\nBuat ${n} variasi berbeda. Format output: pisahkan setiap variasi dengan baris kosong dan awali dengan nomor (1., 2., dll).`;

  try {
    const result = await generateText(req.userId, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/spin', async (req, res) => {
  const { text, count = 5 } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Teks komentar wajib diisi' });
  const n = Math.min(count, 20);
  try {
    const result = await generateText(req.userId, [
      { role: 'system', content: `Kamu adalah pakar variasi konten marketing Indonesia. Tugasmu: buat ${n} variasi berbeda dari komentar/teks yang diberikan. Setiap variasi harus memiliki makna sama tapi kata-kata berbeda — ganti sinonim, ubah struktur kalimat, variasikan sapaan. Pertahankan tone dan target audiens. Format output: setiap variasi di baris baru diawali nomor (1., 2., dst). Jangan tambahkan penjelasan, langsung tulis variasi saja.` },
      { role: 'user', content: `Teks asli:\n"${text.trim()}"\n\nBuat ${n} variasi:` },
    ]);
    const lines = (result.text || '').split('\n').filter(l => /^\d+\./.test(l.trim()));
    const variations = lines.map(l => l.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim()).filter(Boolean);
    res.json({ variations, raw: result.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/smart-comment', async (req, res) => {
  const { post_text, topic, tone = 'natural', extra } = req.body;
  if (!post_text?.trim() && !topic?.trim()) {
    return res.status(400).json({ error: 'Minimal isi post_text (status FB) atau topic' });
  }
  const toneMap = {
    natural: 'sopan, ramah, terdengar manusiawi',
    casual: 'santai, akrab seperti teman',
    formal: 'formal dan sopan',
    enthusiastic: 'antusias dengan emoji ringan',
    persuasive: 'persuasif untuk menarik pembeli',
  };
  const toneDesc = toneMap[tone] || toneMap.natural;
  const systemPrompt = `Kamu asisten yang menulis komentar Facebook dalam bahasa Indonesia. Komentar HARUS:
- relevan dengan isi status atau topik yang diberikan
- ${toneDesc}
- maksimal 2 kalimat singkat
- terdengar seperti komentar manusia biasa, bukan iklan kasar
- tanpa tagar berlebih, tanpa caps lock, tanpa emoji berlebihan
- BUKAN copy paste kalimat dari status
Jawab HANYA komentarnya, tanpa pembuka, tanpa penjelasan.`;

  let userPrompt = '';
  if (post_text?.trim()) userPrompt += `Status Facebook:\n"${post_text.trim().slice(0, 600)}"\n\n`;
  if (topic?.trim()) userPrompt += `Topik/produk yang ingin saya soroti: ${topic.trim()}\n`;
  if (extra?.trim()) userPrompt += `Catatan: ${extra.trim()}\n`;
  userPrompt += '\nTulis 1 komentar yang nyambung dengan status di atas dan halus mengaitkan ke topik saya.';

  try {
    const result = await generateText(req.userId, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.85, max_tokens: 200 });
    const clean = (result.text || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    res.json({ ...result, text: clean });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', (req, res) => {
  const keys = db.prepare('SELECT COUNT(*) as total, SUM(status=\'active\') as active, SUM(requests_today) as total_requests FROM groq_keys WHERE user_id=?').get(req.userId);
  res.json(keys);
});

module.exports = router;
