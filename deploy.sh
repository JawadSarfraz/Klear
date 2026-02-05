#!/bin/bash

# Klear Deployment Script
# Automates the process of pulling, building, and restarting the server.

echo "🚀 Starting deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest changes from git..."
git pull

# 2. Install dependencies (root)
echo "📦 Installing dependencies..."
npm install

# 3. Build the web/API project
echo "🛠️ Building apps/web..."
npm run build -w apps/web

# 4. Restart PM2 process
echo "🔄 Restarting PM2 process..."
pm2 restart ecosystem.config.js --update-env

# 5. Verify health (Optional)
echo "✅ Deployment complete!"
pm2 status
