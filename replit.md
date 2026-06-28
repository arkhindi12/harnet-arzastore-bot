# FBAutoComment - SaaS Auto Comment & Post Facebook Multi-Akun

## Deskripsi
Aplikasi SaaS untuk automasi aktivitas Facebook: auto-comment, auto-UP postingan, auto-post ke grup, auto-post ke Marketplace, keyword monitoring, warming akun, notifikasi Telegram, auto-reply, A/B testing, AI spin komentar, proxy manager, webhook/Zapier integrasi, manajemen tim, library kampanye, leaderboard akun, laporan mingguan Telegram, dan alert akun mati real-time. Menggunakan cookies multi-akun, UI dark theme, Bahasa Indonesia.

Fitur pertumbuhan terbaru: template variable substitution ({{custom_var}}), Auto-Cari URL via keyword Facebook search, ROI Estimator di Dashboard, program Referral (bonus 7 hari), program Reseller (komisi %), rotasi template pintar per akun (separator `---`), API Key access (CRUD, sha256 hash, prefix shown), dan mode Trial 3 hari untuk user baru.

## Arsitektur
- **Frontend**: React + Vite (port 5000, webview)
- **Backend**: Node.js + Express (port 3001, API)
- **Database**: SQLite via better-sqlite3 (data/app.db)

## Struktur Folder
```
├── server/
│   ├── index.js              # Entry point Express
│   ├── db/database.js        # SQLite setup & schema (17 tabel)
│   ├── middleware/auth.js    # JWT authentication
│   ├── routes/
│   │   ├── auth.js           # Register/Login
│   │   ├── accounts.js       # Manajemen akun FB + leaderboard + proxy
│   │   ├── campaigns.js      # Manajemen kampanye + pause/resume + duplicate + CSV export
│   │   ├── runner.js         # Eksekutor kampanye (rate-limit, session)
│   │   ├── postTasks.js      # Auto-UP, Group Post, Marketplace
│   │   ├── keywordMonitors.js # Keyword monitor CRUD + start/stop
│   │   ├── warming.js        # Account warming CRUD + start/stop
│   │   ├── abTests.js        # A/B test CRUD + run
│   │   ├── autoReplies.js    # Auto-reply CRUD + start/stop
│   │   ├── analytics.js      # Heatmap + stats + daily chart + campaigns overview
│   │   ├── settings.js       # Pengaturan Telegram
│   │   ├── templates.js      # Template komentar CRUD
│   │   ├── blacklists.js     # Blacklist URL CRUD
│   │   ├── webhooks.js       # Webhook & Zapier integrasi
│   │   ├── teams.js          # Manajemen tim & undangan
│   │   ├── campaignLibrary.js # Library template kampanye
│   │   └── featureRequests.js # Request fitur
│   └── services/
│       ├── facebookService.js     # Core FB API (login, komentar, UP)
│       ├── groupFetcher.js        # Ambil daftar grup dari akun
│       ├── telegramService.js     # Notifikasi Telegram Bot
│       ├── keywordMonitorService.js # Monitor keyword di grup
│       ├── warmingService.js      # Auto warming (like, browse, komentar)
│       ├── autoReplyService.js    # Balas komentar otomatis
│       └── analyticsService.js   # Heatmap & stats query
├── client/src/
│   ├── App.jsx               # Router utama (9 halaman)
│   ├── components/Layout.jsx # Sidebar navigasi (3 grup menu)
│   └── pages/
│       ├── Dashboard.jsx          # Statistik ringkasan
│       ├── AccountsPage.jsx       # Manajemen akun + cookie pool
│       ├── CampaignsPage.jsx      # Manajemen kampanye
│       ├── CampaignDetailPage.jsx # Detail + log kampanye
│       ├── PostToolsPage.jsx      # Auto-UP, Group Post, Marketplace
│       ├── SmartMonitorPage.jsx   # Keyword Monitor + Auto-Reply
│       ├── WarmingPage.jsx        # Account warming bertahap
│       ├── AnalyticsPage.jsx      # Heatmap + A/B test
│       └── SettingsPage.jsx       # Konfigurasi Telegram
└── data/app.db               # SQLite database
```

## Tabel Database (17 tabel)
- `users` - akun pengguna aplikasi
- `fb_accounts` - akun Facebook + cookie pool (cookie_pool JSON)
- `campaigns` - kampanye auto-komentar
- `comment_logs` - log komentar
- `post_tasks` - task auto-UP, group post, marketplace
- `post_task_logs` - log eksekusi task
- `keyword_monitors` - monitor keyword di grup FB
- `keyword_monitor_logs` - log keyword match + komentar
- `warming_plans` - rencana warming akun bertahap
- `warming_logs` - log aktivitas warming per hari
- `user_settings` - konfigurasi per user (Telegram bot)
- `ab_tests` - A/B test template komentar
- `ab_test_logs` - log eksekusi A/B test
- `auto_replies` - konfigurasi auto-reply komentar
- `auto_reply_logs` - log balasan yang terkirim

## API Endpoints
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registrasi
- `GET/POST/PUT/DELETE /api/accounts` - CRUD akun FB
- `GET/POST/PUT/DELETE /api/campaigns` - CRUD kampanye
- `POST /api/runner/:id/start|stop` - Mulai/hentikan kampanye
- `GET/POST/DELETE /api/post-tasks` - CRUD task
- `POST /api/post-tasks/:id/start|stop` - Kontrol task
- `GET/POST/PUT/DELETE /api/keyword-monitors` - CRUD monitor keyword
- `POST /api/keyword-monitors/:id/start|stop` - Kontrol monitor
- `GET/POST/DELETE /api/warming` - CRUD warming plan
- `POST /api/warming/:id/start|stop|run-now` - Kontrol warming
- `GET/POST/DELETE /api/ab-tests` - CRUD A/B test
- `POST /api/ab-tests/:id/start|reset` - Jalankan/reset test
- `GET/POST/PUT/DELETE /api/auto-replies` - CRUD auto-reply
- `POST /api/auto-replies/:id/start|stop` - Kontrol auto-reply
- `GET /api/analytics/heatmap|stats|hourly|activity` - Data analitik
- `GET/PUT /api/settings` - Baca/simpan pengaturan Telegram
- `POST /api/settings/test-telegram` - Test kirim pesan Telegram

## Fitur Lengkap
1. **Multi-Akun FB** - Kelola banyak akun via cookies dengan pool cadangan
2. **Auto Komentar** - Kampanye komentar massal dengan spintax, rate-limit, jadwal
3. **Auto UP Postingan** - Bump postingan di grup secara terjadwal
4. **Auto Post Grup** - Post ke banyak grup sekaligus
5. **Auto Post Marketplace** - Multi-produk, variasi harga, lokasi acak, jam puncak
6. **🎯 Keyword Monitor** - Pantau grup real-time, komentar otomatis saat keyword ditemukan
7. **💬 Auto-Reply** - Monitor komentar di postingan, balas otomatis berdasarkan keyword
8. **🔥 Warming Akun** - Jadwal pemanasan akun bertahap (14 hari)
9. **📱 Notifikasi Telegram** - Alert real-time ke Telegram saat kampanye selesai/error/checkpoint
10. **📊 Heatmap Analitik** - Visualisasi jam × hari terbaik berdasarkan data historis
11. **🧪 A/B Test** - Bandingkan dua template komentar dan lihat mana lebih efektif

## Konfigurasi Penting
- Vite proxy: `/api` → `http://localhost:3001`
- `server.allowedHosts: true` di vite.config.js
- JWT secret disimpan di environment variable `JWT_SECRET`
- Database auto-migrasi saat startup
