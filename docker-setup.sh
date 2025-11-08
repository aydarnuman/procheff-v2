#!/bin/bash
# ProCheff v2 - Server Kurulum Scripti
# Ubuntu 22.04 için hazırlanmıştır

set -e  # Hata olursa dur

echo "🚀 ProCheff v2 - Server Kurulumu Başlıyor..."
echo "=============================================="

# Renkler
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Sistem güncellemesi
echo -e "\n${YELLOW}[1/7]${NC} Sistem güncelleniyor..."
apt update && apt upgrade -y

# 2. Docker kurulumu
echo -e "\n${YELLOW}[2/7]${NC} Docker kuruluyor..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓${NC} Docker kuruldu"
else
    echo -e "${GREEN}✓${NC} Docker zaten kurulu"
fi

# 3. Docker Compose kurulumu
echo -e "\n${YELLOW}[3/7]${NC} Docker Compose kuruluyor..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓${NC} Docker Compose kuruldu"
else
    echo -e "${GREEN}✓${NC} Docker Compose zaten kurulu"
fi

# 4. Tailscale kurulumu
echo -e "\n${YELLOW}[4/7]${NC} Tailscale kuruluyor..."
if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo -e "${GREEN}✓${NC} Tailscale kuruldu"
    echo -e "${YELLOW}➜${NC} Şimdi 'tailscale up' komutunu çalıştırın"
else
    echo -e "${GREEN}✓${NC} Tailscale zaten kurulu"
fi

# 5. Git kurulumu
echo -e "\n${YELLOW}[5/7]${NC} Git kuruluyor..."
if ! command -v git &> /dev/null; then
    apt install -y git
    echo -e "${GREEN}✓${NC} Git kuruldu"
else
    echo -e "${GREEN}✓${NC} Git zaten kurulu"
fi

# 6. Proje klasörü oluştur
echo -e "\n${YELLOW}[6/7]${NC} Proje klasörü hazırlanıyor..."
mkdir -p /opt/procheff
cd /opt/procheff

# 7. Güvenlik ayarları
echo -e "\n${YELLOW}[7/7]${NC} Güvenlik ayarları yapılıyor..."

# Firewall (sadece Tailscale ve Docker)
if command -v ufw &> /dev/null; then
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 41641/udp  # Tailscale
    echo -e "${GREEN}✓${NC} Firewall yapılandırıldı"
fi

# Otomatik güvenlik güncellemeleri
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

echo -e "\n${GREEN}=============================================="
echo -e "✅ Kurulum tamamlandı!"
echo -e "=============================================="
echo -e "\n${YELLOW}Sonraki adımlar:${NC}"
echo -e "1. Tailscale'i başlat:  ${GREEN}tailscale up${NC}"
echo -e "2. Projeyi klonla:      ${GREEN}git clone https://github.com/aydarnuman/procheff-v2.git .${NC}"
echo -e "3. .env dosyasını ekle: ${GREEN}nano .env${NC}"
echo -e "4. Docker'ı başlat:     ${GREEN}docker-compose up -d${NC}"
echo -e "5. Logları izle:        ${GREEN}docker-compose logs -f${NC}"
echo -e "\n"
