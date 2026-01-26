# Klear Web Backend - Server Deployment

## Prerequisites
- Ubuntu 22.04+ server
- Node.js 20.x
- PM2 (`npm install -g pm2`)
- Nginx (for reverse proxy)

## Quick Setup

### 1. Clone and Install
```bash
cd /var/www
git clone <your-repo-url> klear
cd klear
npm install
cd apps/web
npm run build
```

### 2. Configure Environment
```bash
cd /var/www/klear/apps/web

# Create .env.local with your Replicate API key
cat > .env.local << 'ENVEOF'
REPLICATE_API_TOKEN=r8_YOUR_ACTUAL_TOKEN_HERE
ENVEOF
```

**Important**: Replace `r8_YOUR_ACTUAL_TOKEN_HERE` with your actual token from https://replicate.com/account/api-tokens

### 3. Start with PM2
```bash
cd /var/www/klear/apps/web
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable auto-start on reboot
```

### 4. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or use IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for AI processing
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

### 5. SSL with Certbot (Optional but Recommended)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

### Check if API key is loaded
```bash
pm2 logs klear-web --lines 30
```

### Restart after config changes
```bash
pm2 restart klear-web
```

### Test API endpoint
```bash
curl -X POST http://127.0.0.1:3000/api/inpaint \
  -H "Content-Type: application/json" \
  -d '{"image":"test","mask":"test"}'
```

Should return `{"error":"Image and mask are required"}` or similar (not a 500 error).

## Mobile App Configuration

Set the API URL in your mobile app:
```bash
# apps/mobile/.env
EXPO_PUBLIC_API_URL=https://your-domain.com
```

Or for IP-only (no SSL):
```bash
EXPO_PUBLIC_API_URL=http://157.90.165.149
```
