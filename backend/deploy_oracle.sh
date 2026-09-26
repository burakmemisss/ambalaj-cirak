#!/bin/bash
# Oracle Cloud Always Free Sunucu Kurulum Betiği

echo "🚀 Oracle Cloud üzerinde Ambalaj Çırağı Kurulumu Başlıyor..."

# Docker yükleme
if ! command -v docker &> /dev/null; then
    echo "📦 Docker yükleniyor..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Docker Compose yükleme
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Docker Compose yükleniyor..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin docker-compose
fi

# Sunucu Port İzinleri (Oracle Cloud Firewall)
echo "🔒 Port 8000 ve 80 açılıyor..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

# Docker Konteynerini Çalıştır
echo "🐳 Docker Container başlatılıyor..."
docker-compose up -d --build

echo "✅ Kurulum Tamamlandı! Backend http://YOUR_ORACLE_IP:8000 adresinde 7/24 canlıda."
