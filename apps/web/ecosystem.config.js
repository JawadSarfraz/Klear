// PM2 Ecosystem Configuration for Klear Web Backend
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'klear-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/klear/apps/web',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '.env.local',
    },
  ],
};
