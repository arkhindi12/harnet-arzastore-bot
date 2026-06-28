module.exports = {
  apps: [{
    name: 'arzastore-bot',
    script: '/opt/arzastore-bot/server/index.js',
    cwd: '/opt/arzastore-bot',
    interpreter: '/usr/bin/node',  // Force Node v20
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      TZ: 'Asia/Jakarta'
    },
    error_file: '/opt/arzastore-bot/logs/pm2-error.log',
    out_file: '/opt/arzastore-bot/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
