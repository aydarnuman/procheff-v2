#!/bin/bash

# Google Cloud Console Commands
# Bu komutları Google Cloud Console'un Cloud Shell'inde çalıştır
# https://console.cloud.google.com/?cloudshell=true

echo "=== GOOGLE CLOUD BILLING & QUOTA KONTROL ==="
echo ""

# 1. Aktif projeyi kontrol et
echo "1️⃣ Aktif proje:"
gcloud config get-value project
echo ""

# 2. Billing account'ları listele
echo "2️⃣ Billing account'lar:"
gcloud billing accounts list
echo ""

# 3. Projenin billing durumunu kontrol et
echo "3️⃣ Proje billing durumu:"
PROJECT_ID=$(gcloud config get-value project)
gcloud billing projects describe $PROJECT_ID
echo ""

# 4. Generative Language API'nin enable olduğunu kontrol et
echo "4️⃣ Generative Language API durumu:"
gcloud services list --enabled --filter="name:generativelanguage.googleapis.com"
echo ""

# 5. Eğer enable değilse, enable et
echo "5️⃣ Generative Language API'yi enable et (eğer değilse):"
gcloud services enable generativelanguage.googleapis.com
echo ""

# 6. API quota'yı kontrol et (bu komut quota bilgilerini gösterir)
echo "6️⃣ Generative Language API quota kontrol:"
echo "   Manuel kontrol için bu URL'yi aç:"
echo "   https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=$PROJECT_ID"
echo ""

# 7. Eğer billing bağlı değilse, bağla
echo "7️⃣ Projeye billing hesabı bağla:"
echo "   İlk olarak billing account ID'sini al:"
gcloud billing accounts list --format="value(name)"
echo ""
echo "   Sonra şu komutu çalıştır (BILLING_ACCOUNT_ID'yi yukarıdaki çıktıdan kopyala):"
echo "   gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID"
echo ""

echo "=== ÖRNEK: BİLLİNG BAĞLAMA KOMUTU ==="
echo "# Eğer billing account ID'n örneğin '012345-6789AB-CDEF01' ise:"
echo "gcloud billing projects link $PROJECT_ID --billing-account=012345-6789AB-CDEF01"
echo ""

echo "=== QUOTA ARTIRMA KONTROL ==="
echo "8️⃣ Quota artırma için:"
echo "   1. https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas adresine git"
echo "   2. 'GenerateRequestsPerMinutePerProjectPerModel' quota'sını bul"
echo "   3. Şu anda: 10/minute (free tier)"
echo "   4. Billing bağlandıktan sonra otomatik 1000/minute olmalı"
echo "   5. Eğer olmadıysa, 'EDIT QUOTAS' butonuna tıkla ve artırma talebi gönder"
echo ""

echo "=== TEST KOMUTU ==="
echo "9️⃣ API key test (proje billing'i kontrol et):"
echo "curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"contents\":[{\"parts\":[{\"text\":\"test\"}]}]}'"
echo ""

echo "✅ KOMUTLAR HAZIR!"
echo ""
echo "📋 ADIMLAR:"
echo "1. https://console.cloud.google.com/?cloudshell=true adresine git"
echo "2. Cloud Shell'i aç (sağ üstte terminal ikonu)"
echo "3. Bu dosyayı Cloud Shell'e yükle veya komutları tek tek kopyala-yapıştır"
echo "4. Komutları sırasıyla çalıştır"
echo "5. Billing account bağlama komutunu çalıştır (adım 7)"
echo "6. 5-10 dakika bekle (quota güncellemesi için)"
echo "7. https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas adresinde quota'yı kontrol et"
