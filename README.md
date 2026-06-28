# Arzastore Bot

**Deskripsi:** SaaS Auto Comment Facebook Multi-Akun  
**URL:** https://bot.arzastore.com  
**Port:** 3001  
**Tech Stack:** Node.js + Facebook Automation (Playwright) + SQLite

## Fitur
- Auto comment Facebook multi-akun
- Scheduler & queue management
- Account rotation & health monitoring
- Browser automation (Playwright)
- Admin dashboard untuk manage campaigns
- Proxy support

## Database
- Type: SQLite
- Main DB: `data/app.db`
- Backups: `data/backups/app-*.db` + `backups/app_*.db`

## URL & Access
- Dashboard: https://bot.arzastore.com
- Admin: Check credentials di .env atau DB

## Backup
Otomatis **00:00 WIB** setiap hari:
- Source code → GitHub
- SQLite → `backups/app_YYYY-MM-DD_HHMM.db` (5 terakhir)

## Restore di VPS Baru

### 1. Clone
```bash
cd /opt
git clone git@github.com:arkhindi12/arzastore-bot.git
cd arzastore-bot
```

### 2. Install
```bash
npm install
# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps
```

### 3. Restore database
```bash
mkdir -p data
cp backups/app_*.db data/app.db
```

### 4. Environment
```bash
cp .env.example .env
nano .env
# Set PORT=3001, FB_ACCOUNTS, PROXY settings
```

### 5. Build client (if separate frontend)
```bash
cd client && npm install && npm run build && cd ..
```

### 6. Start
```bash
pm2 start ecosystem.config.js --name arzastore-bot
pm2 save
```

### 7. Nginx
```bash
sudo nano /etc/nginx/sites-available/bot.arzastore.com
```

Config:
```nginx
server {
    listen 80;
    server_name bot.arzastore.com;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bot.arzastore.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bot.arzastore.com
```

### 8. Verify
```bash
pm2 logs arzastore-bot
curl http://localhost:3001
curl https://bot.arzastore.com
```

## Notes
- Chromium binary: di `/home/ubuntu/.cache/ms-playwright/` (dari user ubuntu)
- PM2 run as `ubuntu` user (bukan root)
- Check PM2: `su - ubuntu -c "pm2 list"`

---
*Auto-backup enabled. Last update: 2026-06-06*
