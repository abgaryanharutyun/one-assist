#!/bin/bash
set -euo pipefail

# Install Node.js 24 and Nginx
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs nginx python3-pip

# Install certbot via pip (Debian 12 apt version has AttributeError bug)
pip3 install certbot certbot-nginx --break-system-packages

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

# Set up auto-renewal via cron (pip-installed certbot has no systemd timer)
echo "0 0,12 * * * root certbot renew --quiet" > /etc/cron.d/certbot-renew

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

# Write initial skills from provisioning data
SKILLS_DIR="/home/openclaw/.openclaw/workspace/skills"
mkdir -p "$SKILLS_DIR"

cat > /tmp/initial_skills.json << 'SKILLSJSONEOF'
${initial_skills_json}
SKILLSJSONEOF

python3 -c "
import json, os

skills_dir = '$SKILLS_DIR'
with open('/tmp/initial_skills.json') as f:
    skills = json.load(f)

for skill in skills:
    slug = skill['slug']
    skill_dir = os.path.join(skills_dir, slug)
    os.makedirs(skill_dir, exist_ok=True)
    with open(os.path.join(skill_dir, 'SKILL.md'), 'w') as f:
        f.write('---\n')
        f.write('name: ' + skill['name'] + '\n')
        f.write('description: ' + skill['description'] + '\n')
        f.write('---\n\n')
        f.write(skill['instructions'])
    if skill.get('script'):
        ext = '.py' if skill.get('script_language') == 'python' else '.sh'
        with open(os.path.join(skill_dir, 'skill' + ext), 'w') as f:
            f.write(skill['script'])
        os.chmod(os.path.join(skill_dir, 'skill' + ext), 0o755)

print(f'Wrote {len(skills)} initial skills to {skills_dir}')
" || true

rm -f /tmp/initial_skills.json
chown -R openclaw:openclaw "$SKILLS_DIR"

# Create sync script for pulling skills from platform
cat > /opt/openclaw-bin/sync.sh << 'SYNCEOF'
#!/bin/bash
set -euo pipefail

PLATFORM_URL="${platform_url}"
AGENT_ID="${agent_id}"
GATEWAY_TOKEN="${gateway_token}"
SKILLS_DIR="/home/openclaw/.openclaw/workspace/skills"

# Skip sync if no platform URL configured
if [ -z "$PLATFORM_URL" ]; then
  echo "No PLATFORM_URL configured, skipping sync"
  exit 0
fi

mkdir -p "$SKILLS_DIR"

# Fetch sync data from platform
RESPONSE=$(curl -sf -H "Authorization: Bearer $GATEWAY_TOKEN" \
  "$PLATFORM_URL/api/agents/$AGENT_ID/sync" 2>/dev/null) || exit 0

# Parse skills from JSON response
SKILL_SLUGS=$(echo "$RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
slugs = []
for skill in data.get('skills', []):
    slug = skill['slug']
    slugs.append(slug)
    skill_dir = '$SKILLS_DIR/' + slug
    import os
    os.makedirs(skill_dir, exist_ok=True)
    with open(skill_dir + '/SKILL.md', 'w') as f:
        f.write('---\n')
        f.write('name: ' + skill['name'] + '\n')
        f.write('description: ' + skill['description'] + '\n')
        f.write('---\n\n')
        f.write(skill['instructions'])
    if skill.get('script'):
        ext = '.py' if skill.get('script_language') == 'python' else '.sh'
        with open(skill_dir + '/skill' + ext, 'w') as f:
            f.write(skill['script'])
        os.chmod(skill_dir + '/skill' + ext, 0o755)

# Write built-in knowledge-search skill
ks_url = data.get('knowledgeSearchUrl', '')
if ks_url:
    ks_dir = '$SKILLS_DIR/knowledge-search'
    os.makedirs(ks_dir, exist_ok=True)
    with open(ks_dir + '/SKILL.md', 'w') as f:
        f.write('---\n')
        f.write('name: knowledge-search\n')
        f.write('description: Search the organization knowledge base\n')
        f.write('---\n\n')
        f.write('Search the organization knowledge base for relevant information.\n\n')
        f.write('Use the script to query: ./skill.sh \"your search query\"\n')
    with open(ks_dir + '/skill.sh', 'w') as f:
        f.write('#!/bin/bash\n')
        f.write('curl -sf -H \"Authorization: Bearer $GATEWAY_TOKEN\" ')
        f.write('\"' + ks_url + '&q=\$1\"\n')
    os.chmod(ks_dir + '/skill.sh', 0o755)
    slugs.append('knowledge-search')

# Print slugs for cleanup
for s in slugs:
    print(s)
")

# Remove skills no longer assigned
if [ -d "$SKILLS_DIR" ]; then
  for dir in "$SKILLS_DIR"/*/; do
    [ -d "$dir" ] || continue
    dirname=$(basename "$dir")
    if ! echo "$SKILL_SLUGS" | grep -qx "$dirname"; then
      rm -rf "$dir"
    fi
  done
fi

chown -R openclaw:openclaw "$SKILLS_DIR"
SYNCEOF
chmod +x /opt/openclaw-bin/sync.sh

# Create systemd timer for periodic sync
cat > /etc/systemd/system/openclaw-sync.service << 'SYNCSVCEOF'
[Unit]
Description=OpenClaw Skills Sync
After=network-online.target openclaw-gateway.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/openclaw-bin/sync.sh
Environment=GATEWAY_TOKEN=${gateway_token}
User=root
SYNCSVCEOF

cat > /etc/systemd/system/openclaw-sync.timer << 'TIMEREOF'
[Unit]
Description=OpenClaw Skills Sync Timer

[Timer]
OnBootSec=30
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
TIMEREOF

systemctl daemon-reload
systemctl enable --now openclaw-sync.timer

# Run initial sync
/opt/openclaw-bin/sync.sh || true
