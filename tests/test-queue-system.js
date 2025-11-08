#!/usr/bin/env node

/**
 * Queue Sistemi Test Script
 * 
 * Bu script:
 * 1. Basit test dökümanı oluşturur
 * 2. /api/upload endpoint'ine gönderir
 * 3. Console'da debug loglarını izler
 * 4. NaN problemi olup olmadığını kontrol eder
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Queue Sistemi Test Başlatılıyor...\n');

// Test için basit bir metin dosyası oluştur
const testContent = `
İHALE İLANI

KARADENIZ TEKNIK ÜNİVERSİTESİ

YİYECEK HİZMET ALIMI İHALESİ

1. KURUM BİLGİLERİ
İhaleyi Yapan İdare: Karadeniz Teknik Üniversitesi
İl/İlçe: Trabzon / Merkez
Telefon: 0462 377 8000

2. İHALE KONUSU
Yemek Hizmeti Alımı
500 kişi için günlük 3 öğün yemek hizmeti
365 gün süre ile

3. BÜTÇE BİLGİLERİ
Tahmini Bütçe: 15.000.000 TL (KDV Dahil)

4. İHALE TARİHİ
Son Başvuru Tarihi: 15.12.2025 14:00

5. ÖZEL ŞARTLAR
- ISO 22000 belgesi zorunlu
- 5 yıl deneyim şartı
- Hijyen sertifikası
- 24 saat hizmet verebilme

6. RİSKLER
- Mevsimsel fiyat değişimleri
- Gıda fiyatlarındaki dalgalanma
- Personel temini zorluğu

İLAN SONU
`;

const testFilePath = path.join(__dirname, 'test-ihale-doc.txt');
fs.writeFileSync(testFilePath, testContent, 'utf-8');

console.log('✅ Test dosyası oluşturuldu:', testFilePath);
console.log('📄 İçerik:', testContent.length, 'karakter\n');

console.log('🌐 Server\'a bağlanıyor: http://localhost:3000');
console.log('📡 Endpoint: /api/upload\n');

const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  try {
    const form = new FormData();
    const fileBuffer = fs.readFileSync(testFilePath);
    form.append('file0', fileBuffer, {
      filename: 'test-ihale-doc.txt',
      contentType: 'text/plain',
    });
    form.append('fileCount', '1');
    form.append('useOCR', 'false');

    console.log('🚀 Dosya gönderiliyor...\n');

    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    console.log('📊 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Hata:', errorText);
      return;
    }

    // Streaming response'u oku
    const reader = response.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // SSE frame'lerini parse et
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      frames.forEach(frame => {
        const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) return;

        try {
          const data = JSON.parse(dataLine.slice(6));
          
          if (data.type === 'progress') {
            console.log(`📊 Progress: ${data.progress}% - ${data.stage} ${data.details || ''}`);
          } else if (data.type === 'complete') {
            console.log('\n✅ İŞLEM TAMAMLANDI!\n');
            console.log('🔍 RESULT INSPECTION:');
            console.log('===================\n');
            
            const result = data.result;
            
            if (result.extracted_text) {
              console.log('📄 Extracted Text:', result.extracted_text.substring(0, 100) + '...');
            }
            
            if (result.extracted_data) {
              console.log('\n📋 Extracted Data:');
              console.log('  Kurum:', result.extracted_data.kurum);
              console.log('  İhale Türü:', result.extracted_data.ihale_turu);
              console.log('  Kişi Sayısı:', result.extracted_data.kisi_sayisi);
              console.log('  Öğün Sayısı:', result.extracted_data.ogun_sayisi);
              console.log('  Gün Sayısı:', result.extracted_data.gun_sayisi);
              console.log('  Tahmini Bütçe:', result.extracted_data.tahmini_butce);
              console.log('  Güven Skoru:', result.extracted_data.guven_skoru);
              console.log('  Type of guven_skoru:', typeof result.extracted_data.guven_skoru);
              console.log('  isNaN check:', isNaN(result.extracted_data.guven_skoru));
            }
            
            if (result.processing_metadata) {
              console.log('\n⚙️ Processing Metadata:');
              console.log('  Confidence Score:', result.processing_metadata.confidence_score);
              console.log('  Type:', typeof result.processing_metadata.confidence_score);
              console.log('  isNaN check:', isNaN(result.processing_metadata.confidence_score));
              console.log('  AI Provider:', result.processing_metadata.ai_provider);
              console.log('  Processing Time:', result.processing_metadata.processing_time, 'ms');
            }

            // NaN Kontrolü
            console.log('\n🔍 NaN KONTROLÜ:');
            const hasNaN = 
              isNaN(result.extracted_data?.guven_skoru) ||
              isNaN(result.processing_metadata?.confidence_score);
            
            if (hasNaN) {
              console.log('❌ NaN BULUNDU!');
              if (isNaN(result.extracted_data?.guven_skoru)) {
                console.log('  - extracted_data.guven_skoru = NaN');
              }
              if (isNaN(result.processing_metadata?.confidence_score)) {
                console.log('  - processing_metadata.confidence_score = NaN');
              }
            } else {
              console.log('✅ NaN YOK - Tüm değerler geçerli!');
            }

            console.log('\n✅ TEST BAŞARILI!\n');
            cleanup();
          } else if (data.type === 'error') {
            console.error('❌ Hata:', data.error);
            cleanup();
          }
        } catch (e) {
          // JSON parse hatası - atla
        }
      });
    });

    reader.on('end', () => {
      console.log('\n📡 Stream sonlandı\n');
    });

  } catch (error) {
    console.error('❌ Test hatası:', error);
    cleanup();
  }
}

function cleanup() {
  // Test dosyasını sil
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
    console.log('🧹 Test dosyası silindi');
  }
  process.exit(0);
}

// CTRL+C ile temizlik
process.on('SIGINT', cleanup);

// Test başlat
testUpload();
