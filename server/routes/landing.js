const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const DEFAULT_SECTIONS = [
  { id: 's_hero', type: 'hero', visible: true, data: {
    badge: '✨ Tools Facebook Automation Paling Lengkap di Indonesia',
    title: 'Dominasi Facebook — Auto Comment, Auto Join, Auto Jual, Semua dari Satu Dashboard',
    subtitle: 'Lebih dari sekadar auto-comment. Sekarang dengan AI Anti-Burnout, Smart AI Persona, Auto-Discover Niche, Auto Join Grup + AI Answer, Auto Jual via Sell Something, Group Quality Score, dan Anti-Detection Dashboard. Hemat waktu, raih pelanggan baru, akun tetap aman.',
    cta_primary: 'Coba Gratis 3 Hari',
    cta_secondary: 'Lihat Harga',
  }},
  { id: 's_stats', type: 'stats', visible: true, data: {
    items: [
      { value: '10.000+', label: 'Komentar Terkirim Hari Ini' },
      { value: '500+', label: 'Pengguna Aktif' },
      { value: '50+', label: 'Fitur Lengkap' },
      { value: '99.9%', label: 'Uptime Terjamin' },
    ]
  }},
  { id: 's_features', type: 'features', visible: true, data: {
    title: 'Senjata Lengkap yang Tidak Dimiliki Tools Lain',
    subtitle: 'Dari Auto Comment, Auto Join Grup dengan AI Answer, hingga Auto Jual via Sell Something. Semua siap pakai dalam satu platform.',
  }},
  { id: 's_how', type: 'how_it_works', visible: true, data: {
    title: 'Mulai 24 Jam Otomasi dalam 3 Langkah',
    subtitle: 'Tidak perlu skill teknis — setup awal cuma 5 menit',
    steps: [
      { step: '01', title: 'Tambah Akun & AI Key', desc: 'Import cookies Facebook lewat Cookie-Editor + tambah AI key (Groq/0penAI/Gemini/CL4ude/Custom). Sistem auto-validasi dan kasih persona unik per akun.' },
      { step: '02', title: 'Discover & Join Grup Niche', desc: 'Cari grup sesuai keyword bisnis, atau biarkan Auto Join Grup gabung bertahap. AI baca pertanyaan keanggotaan dan jawab natural.' },
      { step: '03', title: 'Otomasi Jalan 24/7', desc: 'Auto Comment, Auto Share, Auto Jual, Smart Monitor — semua jalan paralel. Anti-Detection Dashboard pantau risiko, AI Anti-Burnout jaga akun tetap aman.' },
    ]
  }},
  { id: 's_target', type: 'target_users', visible: true, data: {
    title: 'Cocok untuk Semua Jenis Pebisnis Online',
    items: ['Toko Online', 'Dropshipper', 'Jualan di Grup', 'Agen Properti', 'Reseller Fashion', 'Marketplace Seller', 'Jasa & Freelance', 'MLM & Afiliasi'],
  }},
  { id: 's_testi', type: 'testimonials', visible: true, data: {
    title: 'Kata Mereka yang Sudah Pakai',
    items: [
      { name: 'Budi Santoso', role: 'Pemilik Toko Online Surabaya', text: 'Sejak pakai ArzaBot, penjualan saya naik 3x lipat dalam 2 bulan! Komentar otomatis bikin produk saya tampil terus di postingan orang.' },
      { name: 'Siti Rahayu', role: 'Dropshipper Jakarta', text: 'Awalnya skeptis, tapi setelah coba 3 hari trial langsung ketagihan. Sekarang saya punya 20 akun jalan otomatis 24 jam!' },
      { name: 'Ahmad Fauzi', role: 'Reseller Fashion Bandung', text: 'Fitur AI Generate komentarnya luar biasa! Komentar terlihat natural dan tidak kena checkpoint. ROI-nya 10x dari budget iklan FB Ads.' },
    ]
  }},
  { id: 's_pricing', type: 'pricing', visible: true, data: {
    title: 'Investasi Kecil, ROI Berlipat',
    subtitle: 'Trial 3 hari tanpa kartu kredit. Akses semua fitur unggulan: AI Anti-Burnout, Auto Join + AI Answer, Auto Jual di Grup, Niche Discovery, dan Anti-Detection Dashboard.',
  }},
  { id: 's_cta', type: 'cta_banner', visible: true, data: {
    title: 'Saatnya Akun Facebook Kerja untuk Anda — 24 Jam Tanpa Lelah',
    subtitle: 'Bergabung dengan 500+ pebisnis yang sudah pakai ArzaBot. Coba GRATIS 3 hari, langsung rasakan hasilnya. Tidak puas? Cancel kapan saja.',
    cta_text: 'Mulai Trial Gratis Sekarang',
  }},
];

function getSections() {
  const row = db.prepare("SELECT value FROM landing_settings WHERE key = 'sections'").get();
  if (!row) return DEFAULT_SECTIONS;
  try { return JSON.parse(row.value); } catch { return DEFAULT_SECTIONS; }
}

router.get('/public', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM landing_settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  settings.sections = getSections();
  res.json(settings);
});

router.get('/sections', (req, res) => {
  res.json(getSections());
});

router.put('/sections', authMiddleware, (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const { sections } = req.body;
  if (!Array.isArray(sections)) return res.status(400).json({ error: 'Data tidak valid' });
  db.prepare("INSERT OR REPLACE INTO landing_settings (key, value, updated_at) VALUES ('sections', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(sections));
  res.json({ message: 'Landing page berhasil disimpan' });
});

router.get('/', authMiddleware, (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const rows = db.prepare('SELECT key, value FROM landing_settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  settings.sections = getSections();
  res.json(settings);
});

router.put('/', authMiddleware, (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Akses ditolak' });
  const updates = req.body;
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Data tidak valid' });
  const stmt = db.prepare('INSERT OR REPLACE INTO landing_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === 'string') stmt.run(k, v);
  }
  res.json({ message: 'Landing page berhasil disimpan' });
});

module.exports = router;
