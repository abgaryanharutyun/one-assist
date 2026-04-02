#!/bin/bash
set -euo pipefail

# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs nginx certbot python3-certbot-nginx

# Install OpenClaw
npm install -g openclaw@latest

# Create openclaw user
useradd -m -s /bin/bash openclaw || true

# Create env directory and file
mkdir -p /opt/openclaw
cat > /opt/openclaw/.env << 'ENVEOF'
ANTHROPIC_API_KEY=${anthropic_api_key}
SLACK_BOT_TOKEN=${slack_bot_token}
SLACK_APP_TOKEN=${slack_app_token}
OPENCLAW_GATEWAY_TOKEN=${gateway_token}
NODE_ENV=production
ENVEOF

chmod 600 /opt/openclaw/.env
chown openclaw:openclaw /opt/openclaw/.env

# Create OpenClaw config
mkdir -p /home/openclaw/.openclaw
cat > /home/openclaw/.openclaw/openclaw.json << 'CONFEOF'
{
  "gateway": {
    "port": 18789,
    "bind": "127.0.0.1",
    "auth": {
      "token": "${gateway_token}"
    }
  },
  "channels": {
    "slack": {
      "enabled": true,
      "mode": "socket",
      "appToken": "${slack_app_token}",
      "botToken": "${slack_bot_token}",
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
  }
}
CONFEOF

chown -R openclaw:openclaw /home/openclaw/.openclaw

# Create systemd service
cat > /etc/systemd/system/openclaw-gateway.service << 'SVCEOF'
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/.openclaw
EnvironmentFile=/opt/openclaw/.env
ExecStart=/usr/local/bin/openclaw gateway --force
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now openclaw-gateway.service

# Configure Nginx reverse proxy
TENANT_DOMAIN="${tenant_id}.${domain}"
cat > /etc/nginx/sites-available/openclaw << NGINXEOF
server {
    listen 80;
    server_name $TENANT_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# SSL with Let's Encrypt
certbot --nginx -d "$TENANT_DOMAIN" --non-interactive --agree-tos -m admin@${domain} || true
