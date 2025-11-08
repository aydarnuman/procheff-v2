# ProCheff v2 - Production Docker Image
# Tüm özellikler çalışır: OCR, Puppeteer, AI, Database

FROM node:20-bookworm

# 1. Sistem bağımlılıkları (OCR + Puppeteer)
RUN apt-get update && apt-get install -y \
    # Tesseract OCR
    tesseract-ocr \
    tesseract-ocr-tur \
    tesseract-ocr-eng \
    # Puppeteer için Chrome
    chromium \
    chromium-sandbox \
    # Fonts (PDF rendering için)
    fonts-liberation \
    fonts-noto-color-emoji \
    # Utilities
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 2. Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 3. Çalışma dizini
WORKDIR /app

# 4. Package files kopyala (cache için)
COPY package*.json ./

# 5. Dependencies kur
RUN npm ci --production=false

# 6. Uygulama kodunu kopyala
COPY . .

# 7. Next.js build
RUN npm run build

# 8. Data dizini oluştur (veritabanı için)
RUN mkdir -p /app/data && chmod 777 /app/data

# 9. Logs dizini
RUN mkdir -p /app/logs && chmod 777 /app/logs

# 10. Port
EXPOSE 3000

# 11. Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 12. Başlat
CMD ["npm", "run", "start"]
