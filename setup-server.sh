# setup-server.sh
#!/bin/bash

# ============================================
# KONFIGURIMI I SERVERIT PËR PRODHIM
# ============================================

set -e

echo "🚀 Setting up production server..."

# 1. Përditëso sistemin
echo "📦 Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Instalo Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 3. Instalo Docker Compose
echo "📦 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Instalo Git
echo "📦 Installing Git..."
sudo apt install git -y

# 5. Krijo direktorinë e projektit
echo "📁 Creating project directory..."
sudo mkdir -p /app
sudo chown $USER:$USER /app

# 6. Klono repository-n
echo "📥 Cloning repository..."
cd /app
git clone https://github.com/$GITHUB_USERNAME/container-management-system.git

# 7. Konfiguro firewall
echo "🛡️ Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# 8. Instalo Certbot për SSL
echo "🔒 Installing Certbot..."
sudo apt install certbot python3-certbot-nginx -y

# 9. Setup SSL (nëse ke domain)
if [ ! -z "$DOMAIN_NAME" ]; then
    echo "🔒 Setting up SSL for $DOMAIN_NAME..."
    sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email $EMAIL
fi

# 10. Set up log rotation
echo "📝 Setting up log rotation..."
sudo cat > /etc/logrotate.d/container-app << EOF
/app/container-management-system/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        docker-compose -f /app/container-management-system/docker-compose.prod.yml restart
    endscript
}
EOF

echo "✅ Server setup complete!"