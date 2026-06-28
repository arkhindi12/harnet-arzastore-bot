const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/app.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS fb_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    cookies TEXT NOT NULL,
    cookie_pool TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    targets TEXT NOT NULL,
    comment_template TEXT NOT NULL,
    account_ids TEXT NOT NULL,
    delay_min INTEGER DEFAULT 5,
    delay_max INTEGER DEFAULT 30,
    status TEXT DEFAULT 'idle',
    schedule_time TEXT,
    repeat_interval INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 0,
    active_hours_start INTEGER DEFAULT 0,
    active_hours_end INTEGER DEFAULT 23,
    session_size INTEGER DEFAULT 10,
    session_break_min INTEGER DEFAULT 10,
    session_break_max INTEGER DEFAULT 30,
    max_errors INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS comment_logs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    target_url TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (account_id) REFERENCES fb_accounts(id)
  );
  CREATE TABLE IF NOT EXISTS post_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    account_ids TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    interval_minutes INTEGER DEFAULT 60,
    next_run DATETIME,
    last_run DATETIME,
    total_success INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS post_task_logs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target TEXT NOT NULL,
    content TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES post_tasks(id),
    FOREIGN KEY (account_id) REFERENCES fb_accounts(id)
  );
  CREATE TABLE IF NOT EXISTS keyword_monitors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    group_urls TEXT NOT NULL,
    keywords TEXT NOT NULL,
    comment_template TEXT NOT NULL,
    account_ids TEXT NOT NULL,
    delay_min INTEGER DEFAULT 5,
    delay_max INTEGER DEFAULT 30,
    check_interval INTEGER DEFAULT 15,
    max_comments_per_run INTEGER DEFAULT 5,
    status TEXT DEFAULT 'idle',
    seen_post_ids TEXT DEFAULT '[]',
    last_check DATETIME,
    next_check DATETIME,
    total_triggered INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS keyword_monitor_logs (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    account_id TEXT,
    post_url TEXT,
    post_excerpt TEXT,
    matched_keyword TEXT,
    comment_sent TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS warming_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    current_day INTEGER DEFAULT 0,
    total_days INTEGER DEFAULT 14,
    schedule TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    started_at DATETIME,
    last_run DATETIME,
    next_run DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_id) REFERENCES fb_accounts(id)
  );
  CREATE TABLE IF NOT EXISTS warming_logs (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    day_number INTEGER,
    action TEXT,
    target TEXT,
    status TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    notify_campaign_complete INTEGER DEFAULT 1,
    notify_checkpoint INTEGER DEFAULT 1,
    notify_task_error INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ab_tests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    targets TEXT NOT NULL,
    template_a TEXT NOT NULL,
    template_b TEXT NOT NULL,
    account_ids TEXT NOT NULL,
    delay_min INTEGER DEFAULT 5,
    delay_max INTEGER DEFAULT 30,
    status TEXT DEFAULT 'idle',
    success_a INTEGER DEFAULT 0,
    fail_a INTEGER DEFAULT 0,
    success_b INTEGER DEFAULT 0,
    fail_b INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS ab_test_logs (
    id TEXT PRIMARY KEY,
    test_id TEXT NOT NULL,
    account_id TEXT,
    target_url TEXT,
    variant TEXT,
    comment_text TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS auto_replies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    post_urls TEXT NOT NULL,
    keywords TEXT NOT NULL,
    reply_template TEXT NOT NULL,
    reply_account_id TEXT NOT NULL,
    reply_mode TEXT DEFAULT 'personal',
    page_id TEXT,
    page_name TEXT,
    check_interval INTEGER DEFAULT 30,
    max_replies_per_run INTEGER DEFAULT 10,
    replied_comment_ids TEXT DEFAULT '[]',
    status TEXT DEFAULT 'idle',
    last_check DATETIME,
    next_check DATETIME,
    total_replied INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS auto_reply_logs (
    id TEXT PRIMARY KEY,
    reply_id TEXT NOT NULL,
    post_url TEXT,
    commenter_name TEXT,
    comment_text TEXT,
    matched_keyword TEXT,
    reply_sent TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS groq_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    api_key TEXT NOT NULL,
    label TEXT,
    status TEXT DEFAULT 'active',
    requests_today INTEGER DEFAULT 0,
    last_used DATETIME,
    reset_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS site_seo (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const SEO_DEFAULTS = {
  site_title: 'ArzaBot - Auto Comment Facebook',
  site_name: 'ArzaBot',
  meta_description: 'Platform otomasi Facebook terpercaya. Kelola multi akun, auto comment, auto post, smart monitor, dan lebih banyak fitur dalam satu dashboard.',
  meta_keywords: 'auto comment facebook, facebook automation, multi akun facebook, auto post facebook',
  meta_author: 'ArzaBot',
  meta_robots: 'index, follow',
  og_title: 'ArzaBot - Auto Comment Facebook',
  og_description: 'Platform otomasi Facebook terpercaya. Kelola multi akun, auto comment, auto post, smart monitor.',

  og_image: '',
  og_url: '',
  og_type: 'website',
  og_site_name: 'ArzaBot',
  twitter_card: 'summary_large_image',
  twitter_title: 'ArzaBot - Auto Comment Facebook',
  twitter_description: 'Platform otomasi Facebook terpercaya.',
  twitter_image: '',
  twitter_site: '',
  canonical_url: '',
  theme_color: '#1d4ed8',
  favicon_url: '/favicon.svg',
  brand_name: 'ArzaBot',
  brand_tagline: 'Platform Otomasi Facebook Terpercaya',
  brand_logo_url: '',
  brand_icon_url: '',
  brand_primary_color: '#2563eb',
  brand_logo_size: '100',
};

const insertSeo = db.prepare('INSERT OR IGNORE INTO site_seo (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(SEO_DEFAULTS)) {
  insertSeo.run(key, value);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    max_accounts INTEGER DEFAULT 0,
    max_campaigns INTEGER DEFAULT 0,
    features TEXT DEFAULT '[]',
    badge TEXT,
    is_popular INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    order_id TEXT UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_type TEXT,
    midtrans_transaction_id TEXT,
    snap_token TEXT,
    snap_redirect_url TEXT,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
  );
  CREATE TABLE IF NOT EXISTS payment_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const PAY_DEFAULTS = {
  midtrans_server_key: '',
  midtrans_client_key: '',
  midtrans_is_production: '0',
  payment_enabled: '1',
  currency: 'IDR',
  manual_payment_enabled: '1',
  qris_image_url: '',
  qris_name: '',
  bank_name: '',
  bank_account_number: '',
  bank_account_name: '',
  bank_name_2: '',
  bank_account_number_2: '',
  bank_account_name_2: '',
};
const insertPay = db.prepare('INSERT OR IGNORE INTO payment_settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(PAY_DEFAULTS)) insertPay.run(k, v);

db.exec(`
  CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'umum',
    status TEXT DEFAULT 'pending',
    vote_count INTEGER DEFAULT 0,
    admin_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS feature_votes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feature_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feature_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (feature_id) REFERENCES feature_requests(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comment_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'umum',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS blacklists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'post',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT DEFAULT '[]',
    secret TEXT,
    is_active INTEGER DEFAULT 1,
    last_triggered DATETIME,
    total_sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS campaign_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    targets TEXT NOT NULL,
    comment_template TEXT NOT NULL,
    account_ids TEXT DEFAULT '[]',
    delay_min INTEGER DEFAULT 5,
    delay_max INTEGER DEFAULT 30,
    active_hours_start INTEGER DEFAULT 0,
    active_hours_end INTEGER DEFAULT 23,
    session_size INTEGER DEFAULT 10,
    session_break_min INTEGER DEFAULT 10,
    session_break_max INTEGER DEFAULT 30,
    max_errors INTEGER DEFAULT 3,
    daily_limit INTEGER DEFAULT 0,
    auto_rotate INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS landing_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const LANDING_DEFAULTS = {
  hero_title: 'Dominasi Facebook — Auto Comment, Auto Join, Auto Jual, Semua dari Satu Dashboard',
  hero_subtitle: 'Lebih dari sekadar auto-comment. Sekarang dengan AI Anti-Burnout, Smart AI Persona, Auto-Discover Niche, Auto Join Grup + AI Answer, Auto Jual via Sell Something, Group Quality Score, dan Anti-Detection Dashboard. Hemat waktu, raih pelanggan baru, akun tetap aman.',
  hero_cta_primary: 'Coba Gratis 3 Hari',
  hero_cta_secondary: 'Lihat Harga',
  hero_badge: '✨ Tools Facebook Automation Paling Lengkap di Indonesia',
  stat_1_value: '10.000+',
  stat_1_label: 'Komentar Terkirim Hari Ini',
  stat_2_value: '500+',
  stat_2_label: 'Pengguna Aktif',
  stat_3_value: '50+',
  stat_3_label: 'Fitur Lengkap',
  stat_4_value: '99.9%',
  stat_4_label: 'Uptime Terjamin',
  announcement: '',
  features_title: 'Senjata Lengkap yang Tidak Dimiliki Tools Lain',
  features_subtitle: 'Dari Auto Comment, Auto Join Grup dengan AI Answer, hingga Auto Jual via Sell Something. Semua siap pakai dalam satu platform.',
  testimonial_1_name: 'Budi Santoso',
  testimonial_1_role: 'Pemilik Toko Online Surabaya',
  testimonial_1_text: 'Sejak pakai ArzaBot, penjualan saya naik 3x lipat dalam 2 bulan! Komentar otomatis bikin produk saya tampil terus di postingan orang.',
  testimonial_2_name: 'Siti Rahayu',
  testimonial_2_role: 'Dropshipper Jakarta',
  testimonial_2_text: 'Awalnya skeptis, tapi setelah coba 3 hari trial langsung ketagihan. Sekarang saya punya 20 akun jalan otomatis 24 jam!',
  testimonial_3_name: 'Ahmad Fauzi',
  testimonial_3_role: 'Reseller Fashion Bandung',
  testimonial_3_text: 'Fitur AI Generate komentarnya luar biasa! Komentar terlihat natural dan tidak kena checkpoint. ROI-nya 10x dari budget iklan FB Ads.',
  footer_text: 'ArzaBot © 2025. Platform otomasi Facebook terpercaya untuk pebisnis Indonesia.',
  pricing_title: 'Investasi Kecil, ROI Berlipat',
  pricing_subtitle: 'Trial 3 hari tanpa kartu kredit. Akses semua fitur unggulan: AI Anti-Burnout, Auto Join + AI Answer, Auto Jual di Grup, Niche Discovery, dan Anti-Detection Dashboard.',
};

const existingKeys = db.prepare('SELECT key FROM landing_settings').all().map(r => r.key);
const insertLanding = db.prepare('INSERT OR IGNORE INTO landing_settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(LANDING_DEFAULTS)) {
  if (!existingKeys.includes(k)) insertLanding.run(k, v);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_id TEXT NOT NULL,
    bonus_days INTEGER DEFAULT 7,
    commission_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    payment_details TEXT,
    notes TEXT,
    admin_notes TEXT,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    last_used DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS roi_settings (
    user_id TEXT PRIMARY KEY,
    reach_per_comment INTEGER DEFAULT 85,
    cpm_idr INTEGER DEFAULT 20000,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const migrations = [
  "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
  "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1",
  "ALTER TABLE users ADD COLUMN expires_at DATETIME",
  "ALTER TABLE users ADD COLUMN full_name TEXT",
  "ALTER TABLE users ADD COLUMN notes TEXT",
  "ALTER TABLE fb_accounts ADD COLUMN proxy TEXT",
  "ALTER TABLE campaigns ADD COLUMN daily_limit INTEGER DEFAULT 0",
  "ALTER TABLE campaigns ADD COLUMN active_hours_start INTEGER DEFAULT 0",
  "ALTER TABLE campaigns ADD COLUMN active_hours_end INTEGER DEFAULT 23",
  "ALTER TABLE campaigns ADD COLUMN session_size INTEGER DEFAULT 10",
  "ALTER TABLE campaigns ADD COLUMN session_break_min INTEGER DEFAULT 10",
  "ALTER TABLE campaigns ADD COLUMN session_break_max INTEGER DEFAULT 30",
  "ALTER TABLE campaigns ADD COLUMN max_errors INTEGER DEFAULT 3",
  "ALTER TABLE fb_accounts ADD COLUMN cookie_pool TEXT DEFAULT '[]'",
  "ALTER TABLE auto_replies ADD COLUMN last_check DATETIME",
  "ALTER TABLE auto_replies ADD COLUMN next_check DATETIME",
  "ALTER TABLE auto_replies ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE auto_replies ADD COLUMN reply_mode TEXT DEFAULT 'personal'",
  "ALTER TABLE auto_replies ADD COLUMN page_id TEXT",
  "ALTER TABLE auto_replies ADD COLUMN page_name TEXT",
  "ALTER TABLE campaigns ADD COLUMN schedule_start TEXT",
  "ALTER TABLE campaigns ADD COLUMN schedule_end TEXT",
  "ALTER TABLE campaigns ADD COLUMN auto_rotate INTEGER DEFAULT 1",
  "ALTER TABLE campaigns ADD COLUMN paused_at DATETIME",
  "ALTER TABLE fb_accounts ADD COLUMN total_comments INTEGER DEFAULT 0",
  "ALTER TABLE fb_accounts ADD COLUMN total_success INTEGER DEFAULT 0",
  "ALTER TABLE fb_accounts ADD COLUMN total_failed INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN referral_code TEXT",
  "ALTER TABLE users ADD COLUMN is_trial INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN trial_end DATETIME",
  "ALTER TABLE users ADD COLUMN is_reseller INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN reseller_margin INTEGER DEFAULT 30",
  "ALTER TABLE users ADD COLUMN reseller_balance REAL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN reseller_commission_per_referral REAL DEFAULT 50000",
  "ALTER TABLE users ADD COLUMN email TEXT",
  "ALTER TABLE users ADD COLUMN phone TEXT",
  "ALTER TABLE page_bots ADD COLUMN type TEXT DEFAULT 'page'",
  "ALTER TABLE page_bots ADD COLUMN account_id TEXT",
  "ALTER TABLE page_bots ADD COLUMN poll_interval_sec INTEGER DEFAULT 180",
  "ALTER TABLE page_bots ADD COLUMN last_poll DATETIME",
  "ALTER TABLE fb_accounts ADD COLUMN proxy_pool TEXT DEFAULT '[]'",
  "ALTER TABLE fb_accounts ADD COLUMN dead_proxies TEXT DEFAULT '[]'",
  "ALTER TABLE fb_accounts ADD COLUMN proxy_source TEXT DEFAULT 'manual'",
  "ALTER TABLE fb_accounts ADD COLUMN proxy_country TEXT",
  "ALTER TABLE payments ADD COLUMN payment_proof_url TEXT",
  "ALTER TABLE niche_groups ADD COLUMN posts_per_day REAL",
  "ALTER TABLE niche_groups ADD COLUMN activity_level TEXT",
  "ALTER TABLE niche_groups ADD COLUMN avg_comments REAL",
  "ALTER TABLE niche_groups ADD COLUMN enriched_at DATETIME",
  "ALTER TABLE warming_plans ADD COLUMN niche TEXT",
  "ALTER TABLE warming_plans ADD COLUMN profile_data TEXT",
  "ALTER TABLE warming_plans ADD COLUMN auto_post_status INTEGER DEFAULT 0",
  "ALTER TABLE warming_plans ADD COLUMN auto_setup_profile INTEGER DEFAULT 0",
  "ALTER TABLE account_groups ADD COLUMN keyword TEXT",
  "ALTER TABLE account_groups ADD COLUMN join_status TEXT DEFAULT 'member'",
  "ALTER TABLE account_groups ADD COLUMN joined_at DATETIME",
  "ALTER TABLE campaigns ADD COLUMN variables TEXT DEFAULT '{}'",
  "ALTER TABLE referrals ADD COLUMN commission_amount REAL DEFAULT 0",
  "ALTER TABLE fb_accounts ADD COLUMN user_agent TEXT",
  "ALTER TABLE fb_accounts ADD COLUMN persona TEXT DEFAULT 'natural'",
  "ALTER TABLE fb_accounts ADD COLUMN fatigue_score REAL DEFAULT 0",
  "ALTER TABLE fb_accounts ADD COLUMN fatigue_level TEXT DEFAULT 'low'",
  "ALTER TABLE fb_accounts ADD COLUMN fatigue_updated_at DATETIME",
  "ALTER TABLE fb_accounts ADD COLUMN cooldown_until DATETIME",
  "ALTER TABLE auto_join_jobs ADD COLUMN use_ai_answer INTEGER DEFAULT 0",
  "ALTER TABLE auto_join_jobs ADD COLUMN ai_context TEXT",
  "ALTER TABLE auto_join_jobs ADD COLUMN ai_tone TEXT DEFAULT 'natural'",
  "ALTER TABLE auto_join_jobs ADD COLUMN quality_filter_enabled INTEGER DEFAULT 1",
  "ALTER TABLE auto_join_jobs ADD COLUMN min_posts_per_day REAL DEFAULT 125",
  "ALTER TABLE auto_join_jobs ADD COLUMN min_avg_comments REAL DEFAULT 3",
  "ALTER TABLE auto_join_logs ADD COLUMN questions TEXT",
  "ALTER TABLE auto_join_logs ADD COLUMN answers TEXT",
  "ALTER TABLE auto_join_logs ADD COLUMN answer_source TEXT",
];

// Tabel quality score grup + niche discovery candidate (Sprint 2)
db.exec(`
  CREATE TABLE IF NOT EXISTS group_quality (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_url TEXT NOT NULL,
    group_id TEXT,
    name TEXT,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    last_success DATETIME,
    last_failed DATETIME,
    score REAL DEFAULT 0,
    grade TEXT DEFAULT 'C',
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, group_url)
  );
  CREATE TABLE IF NOT EXISTS niche_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    keyword TEXT NOT NULL,
    group_id TEXT,
    name TEXT,
    url TEXT NOT NULL,
    members_text TEXT,
    members_estimate INTEGER,
    privacy TEXT,
    description TEXT,
    imported INTEGER DEFAULT 0,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, keyword, url)
  );
  CREATE TABLE IF NOT EXISTS niche_search_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT,
    keyword TEXT NOT NULL,
    status TEXT NOT NULL,
    found INTEGER DEFAULT 0,
    duration_ms INTEGER,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS page_bots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT DEFAULT 'page',
    account_id TEXT,
    page_id TEXT,
    page_name TEXT,
    page_access_token TEXT,
    is_active INTEGER DEFAULT 1,
    persona_name TEXT DEFAULT 'CS',
    persona_style TEXT DEFAULT 'ramah dan profesional',
    product_info TEXT,
    wa_number TEXT,
    max_rounds INTEGER DEFAULT 5,
    closing_message TEXT,
    greeting_message TEXT,
    business_hours_start INTEGER DEFAULT 8,
    business_hours_end INTEGER DEFAULT 22,
    auto_reply_delay_sec INTEGER DEFAULT 30,
    poll_interval_sec INTEGER DEFAULT 180,
    total_conversations INTEGER DEFAULT 0,
    total_messages_sent INTEGER DEFAULT 0,
    last_poll DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, page_id)
  );
  CREATE TABLE IF NOT EXISTS page_conversations (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    messages TEXT DEFAULT '[]',
    round_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    escalated INTEGER DEFAULT 0,
    last_message_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS auto_join_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    account_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'niche',
    keyword TEXT,
    group_urls TEXT DEFAULT '[]',
    daily_limit INTEGER DEFAULT 5,
    join_delay_min INTEGER DEFAULT 90,
    join_delay_max INTEGER DEFAULT 240,
    active_hours_start INTEGER DEFAULT 8,
    active_hours_end INTEGER DEFAULT 22,
    answer_template TEXT,
    use_ai_answer INTEGER DEFAULT 0,
    ai_context TEXT,
    ai_tone TEXT DEFAULT 'natural',
    quality_filter_enabled INTEGER DEFAULT 1,
    min_posts_per_day REAL DEFAULT 125,
    min_avg_comments REAL DEFAULT 3,
    status TEXT DEFAULT 'idle',
    joined_today INTEGER DEFAULT 0,
    last_run DATETIME,
    next_run DATETIME,
    last_reset_date TEXT,
    total_joined INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS auto_join_logs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    account_id TEXT,
    group_url TEXT,
    group_name TEXT,
    status TEXT NOT NULL,
    detail TEXT,
    questions TEXT,
    answers TEXT,
    answer_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
for (const sql of migrations) { try { db.exec(sql); } catch (e) { } }

// Performance indexes — ditambahkan setelah migrations supaya kolomnya pasti ada
const PERFORMANCE_INDEXES = [
  // fb_accounts: filter by user
  'CREATE INDEX IF NOT EXISTS idx_fb_accounts_user ON fb_accounts(user_id)',
  // comment_logs: filter by campaign / account, sort by created_at
  'CREATE INDEX IF NOT EXISTS idx_comment_logs_campaign ON comment_logs(campaign_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_comment_logs_account ON comment_logs(account_id, created_at DESC)',
  // post_task_logs: filter by task / account
  'CREATE INDEX IF NOT EXISTS idx_post_task_logs_task ON post_task_logs(task_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_post_task_logs_account ON post_task_logs(account_id, created_at DESC)',
  // campaigns: filter by user
  'CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
  // post_tasks
  'CREATE INDEX IF NOT EXISTS idx_post_tasks_user ON post_tasks(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_post_tasks_type ON post_tasks(user_id, type)',
  // warming
  'CREATE INDEX IF NOT EXISTS idx_warming_plans_user ON warming_plans(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_warming_plans_account ON warming_plans(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_warming_logs_plan ON warming_logs(plan_id, created_at DESC)',
  // keyword monitors
  'CREATE INDEX IF NOT EXISTS idx_keyword_monitors_user ON keyword_monitors(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_keyword_monitor_logs_monitor ON keyword_monitor_logs(monitor_id, created_at DESC)',
  // auto-replies
  'CREATE INDEX IF NOT EXISTS idx_auto_replies_user ON auto_replies(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_reply ON auto_reply_logs(reply_id, created_at DESC)',
  // ab_tests
  'CREATE INDEX IF NOT EXISTS idx_ab_tests_user ON ab_tests(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_ab_test_logs_test ON ab_test_logs(test_id, created_at DESC)',
  // niche
  'CREATE INDEX IF NOT EXISTS idx_niche_groups_user_kw ON niche_groups(user_id, keyword)',
  'CREATE INDEX IF NOT EXISTS idx_niche_search_runs_user ON niche_search_runs(user_id, created_at DESC)',
  // auto_join
  'CREATE INDEX IF NOT EXISTS idx_auto_join_jobs_user ON auto_join_jobs(user_id, status)',
  'CREATE INDEX IF NOT EXISTS idx_auto_join_logs_job ON auto_join_logs(job_id, created_at DESC)',
  // payments
  'CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
  // page_bots / conversations
  'CREATE INDEX IF NOT EXISTS idx_page_bots_user ON page_bots(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_page_bots_account ON page_bots(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_page_conversations_bot ON page_conversations(bot_id, last_message_at DESC)',
  // page_group_capability
  'CREATE INDEX IF NOT EXISTS idx_pgc_account ON page_group_capability(account_id, last_tested_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_pgc_user ON page_group_capability(user_id)',
  // teams
  'CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)',
];

for (const sql of PERFORMANCE_INDEXES) {
  try { db.exec(sql); } catch (e) { console.error('[index] gagal:', sql, e.message); }
}

// Profile setup queue (setup bertahap 1 per hari)
db.exec(`
  CREATE TABLE IF NOT EXISTS profile_setup_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    scheduled_date TEXT,
    executed_at DATETIME,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Capability map: apakah page tertentu bisa share/post ke group tertentu
db.exec(`
  CREATE TABLE IF NOT EXISTS page_group_capability (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    page_name TEXT NOT NULL,
    group_url TEXT NOT NULL,
    share_success_count INTEGER DEFAULT 0,
    share_fail_count INTEGER DEFAULT 0,
    post_success_count INTEGER DEFAULT 0,
    post_fail_count INTEGER DEFAULT 0,
    last_status TEXT,
    last_error TEXT,
    last_tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, page_name, group_url)
  );
`);

// System config (editable dari admin dashboard)
db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    label TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const SYSTEM_CONFIG_DEFAULTS = {
  browser_max_concurrent: { value: '2', label: 'Max Browser Concurrent', description: 'Jumlah maksimal browser yang jalan bersamaan. 1 browser ~150-300MB RAM.' },
  browser_engine: { value: 'chromium', label: 'Browser Engine', description: 'Pilih engine: chromium (paling kompatibel, ~300MB), firefox (lebih ringan ~200MB), webkit (paling ringan ~150MB tapi kompatibilitas terbatas).' },
  browser_headless: { value: '1', label: 'Headless Mode', description: '1 = tanpa tampilan (hemat RAM), 0 = tampilkan browser (untuk debug).' },
  discovery_auto_sync: { value: '1', label: 'Auto Sync Discovery', description: '1 = aktif, 0 = matikan auto-resync grup & feed.' },
  discovery_resync_hours: { value: '6', label: 'Discovery Resync Interval (jam)', description: 'Berapa jam sekali discovery auto-resync.' },
  autojoin_enabled: { value: '1', label: 'Auto Join Scheduler', description: '1 = aktif, 0 = matikan scheduler auto-join.' },
  autojoin_tick_seconds: { value: '60', label: 'Auto Join Tick (detik)', description: 'Interval cek auto-join job yang due.' },
  proxy_recommendation: { value: JSON.stringify({
    title: 'Proxy Residensial Indonesia — Rekomendasi',
    subtitle: 'Gunakan proxy residensial agar akun Facebook lebih aman dari deteksi. IP Indonesia membuat aktivitas terlihat natural.',
    cta: 'Akun tanpa proxy 3x lebih beresiko terkena checkpoint. Investasi proxy = investasi keamanan akun jangka panjang.',
    providers: [
      { name: 'Smartproxy', price: '~$8.5/GB', pros: 'Pool Indonesia besar, rotating otomatis, dashboard bagus', url: 'https://smartproxy.com', recommended: true },
      { name: 'Bright Data', price: '~$10/GB', pros: 'Pool terbesar dunia, Indonesia coverage bagus, API lengkap', url: 'https://brightdata.com' },
      { name: 'Oxylabs', price: '~$10/GB', pros: 'Stabil, enterprise-grade, Indonesia ada', url: 'https://oxylabs.io' },
      { name: 'IPRoyal', price: '~$5.5/GB', pros: 'Murah, Indonesia ada, cocok untuk budget kecil', url: 'https://iproyal.com' },
      { name: 'Proxy-Cheap', price: '~$4/GB', pros: 'Paling murah, Indonesia coverage cukup', url: 'https://proxy-cheap.com' },
      { name: '922proxy', price: '~$3/GB', pros: 'Khusus Asia, Indonesia banyak, sangat murah', url: 'https://922proxy.com' },
      { name: 'Luna Proxy', price: '~$3.5/GB', pros: 'Asia-focused, Indonesia pool lumayan', url: 'https://lunaproxy.com' },
    ]
  }), label: 'Proxy Recommendation (JSON)', description: 'Konten rekomendasi proxy yang tampil di dashboard user. Format JSON.' },
};

const insertConfig = db.prepare('INSERT OR IGNORE INTO system_config (key, value, label, description) VALUES (?, ?, ?, ?)');
for (const [k, v] of Object.entries(SYSTEM_CONFIG_DEFAULTS)) {
  insertConfig.run(k, v.value, v.label, v.description);
}

const crypto = require('crypto');
const allUsers = db.prepare('SELECT id FROM users WHERE referral_code IS NULL').all();
for (const u of allUsers) {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  try { db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, u.id); } catch (e) {}
}

module.exports = db;
