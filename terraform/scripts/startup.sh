#!/bin/bash
set -euo pipefail

# Install Node.js 24, Nginx, and Certbot
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs nginx certbot python3-certbot-nginx

# Install OpenClaw — use local install to ensure dependencies resolve
mkdir -p /opt/openclaw-bin
cd /opt/openclaw-bin
npm init -y > /dev/null
npm install openclaw@latest @slack/bolt @slack/web-api @slack/socket-mode
ln -sf /opt/openclaw-bin/node_modules/.bin/openclaw /usr/local/bin/openclaw
cd /

# Create openclaw user
useradd -m -s /bin/bash openclaw || true

# Create env directory and file
mkdir -p /opt/openclaw
cat > /opt/openclaw/.env << 'ENVEOF'
AI_PROVIDER=${ai_provider}
AI_API_KEY=${ai_api_key}
SLACK_BOT_TOKEN=${slack_bot_token}
OPENCLAW_GATEWAY_TOKEN=${gateway_token}
NODE_ENV=production
ENVEOF

chmod 600 /opt/openclaw/.env
chown openclaw:openclaw /opt/openclaw/.env

# Create OpenClaw config — HTTP events mode, bind to localhost, Nginx handles external
mkdir -p /home/openclaw/.openclaw
cat > /home/openclaw/.openclaw/openclaw.json << 'CONFEOF'
{
  "gateway": {
    "port": 18789,
    "bind": "loopback",
    "mode": "local",
    "auth": {
      "token": "${gateway_token}"
    },
    "trustedProxies": ["127.0.0.1"],
    "controlUi": {
      "allowedOrigins": ["https://${tenant_fqdn}"],
      "dangerouslyDisableDeviceAuth": true
    }
  },
  "channels": {
    "slack": {
      "enabled": true,
      "mode": "http",
      "botToken": "${slack_bot_token}",
      "signingSecret": "${slack_signing_secret}",
      "webhookPath": "/slack/events",
      "dmPolicy": "allowlist",
      "allowFrom": ["${slack_authed_user_id}"]
    }
  }
}
CONFEOF

# Create auth profiles for the AI provider
mkdir -p /home/openclaw/.openclaw/agents/main/agent
cat > /home/openclaw/.openclaw/agents/main/agent/auth-profiles.json << 'AUTHEOF'
{
  "profiles": {
    "${ai_provider}:default": {
      "type": "api_key",
      "provider": "${ai_provider}",
      "key": "${ai_api_key}"
    }
  }
}
AUTHEOF

chown -R openclaw:openclaw /home/openclaw/.openclaw

# Configure Nginx — start with HTTP for certbot validation
cat > /etc/nginx/sites-available/openclaw << 'NGINXEOF'
server {
    listen 80;
    server_name ${tenant_fqdn};

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/openclaw
systemctl enable --now nginx
systemctl reload nginx

# Get Let's Encrypt SSL certificate
# Wait for DNS to propagate (record was just created by Terraform)
for i in $(seq 1 30); do
  if host ${tenant_fqdn} > /dev/null 2>&1; then
    break
  fi
  sleep 10
done

certbot --nginx -d ${tenant_fqdn} \
  --non-interactive --agree-tos \
  --email ${letsencrypt_email} \
  --redirect

# Set up auto-renewal
systemctl enable --now certbot.timer

# Create systemd service
cat > /etc/systemd/system/openclaw-gateway.service << 'SVCEOF'
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw-bin
EnvironmentFile=/opt/openclaw/.env
Environment=NODE_PATH=/opt/openclaw-bin/node_modules
Environment=HOME=/home/openclaw
ExecStart=/opt/openclaw-bin/node_modules/.bin/openclaw gateway --force
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now openclaw-gateway.service
