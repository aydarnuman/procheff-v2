# İhale Dökümanları Ön Kontrol - İyileştirmeler

## Sorun
1. ❌ **"AI Analiz Başlat" butonu yok** - Sadece "Toplu İndir" butonu var
2. ❌ **ZIP dosyalarının içeriği görünmüyor** - Kullanıcı ZIP seçtiğinde içindeki dosyaları görmek istiyor

## Çözüm

### 1. AI Analiz Butonu Ekleme
`src/app/ihale-robotu/page.tsx` dosyasında, "Toplu İndir" butonunun **sağına** ekle:

**Konum**: Satır ~3126 (Action Bar kısmı)

```tsx
{/* Action Bar - İndirme & Analiz */}
<div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
  <div className="flex items-center gap-4">
    {/* Sol: Toplu İndirme Butonu */}
    <button
      onClick={async () => {
        if (selectedDocuments.length === 0) {
          toast.error('⚠️ Lütfen en az 1 döküman seçin');
          return;
        }
        await prepareDocuments();
        toast.success(`✅ ${selectedDocuments.length} döküman indirildi!`);
      }}
      disabled={selectedDocuments.length === 0}
      className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-105 disabled:scale-100"
    >
      <Download className="w-5 h-5" />
      <span>Toplu İndir</span>
      {selectedDocuments.length > 0 && (
        <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-bold">
          {selectedDocuments.length}
        </span>
      )}
    </button>

    {/* Sağ: AI Analiz Butonu - YENİ! */}
    <button
      onClick={async () => {
        // Önce dökümanları hazırla
        if (selectedDocuments.length > 0) {
          await prepareDocuments();
        }
        // Sonra analize gönder
        await sendToAnalysis();
      }}
      disabled={!fullContent?.fullText || isAnalyzing}
      className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-600/50 disabled:shadow-none transform hover:scale-105 disabled:scale-100"
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Hazırlanıyor...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>AI Analiz Başlat</span>
          {selectedDocuments.length > 0 && (
            <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-bold">
              {selectedDocuments.length}
            </span>
          )}
        </>
      )}
    </button>
  </div>

  {/* ZIP Bilgilendirme - Butonların altında */}
  {selectedDocuments.some(url => url.toLowerCase().includes('.zip') || url.toLowerCase().includes('.rar')) && (
    <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-purple-900 mb-1 flex items-center gap-2">
            ⚡ Otomatik ZIP Çıkarma
            <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-full">
              AKILLI
            </span>
          </h4>
          <p className="text-xs text-purple-700 leading-relaxed">
            "AI Analiz Başlat" butonuna bastığınızda, ZIP/RAR dosyaları <span className="font-semibold">sunucuda otomatik çıkarılacak</span> ve içindeki TÜM dosyalar AI analizine dahil edilecek.
          </p>
        </div>
      </div>
    </div>
  )}
</div>
```

### 2. ZIP İçerik Önizleme (İsteğe Bağlı)

Eğer ZIP içeriklerini **seçmeden önce** görmek istiyorsan:

**Opsiy on A**: Döküman kartlarında ZIP'leri accordion yapıp expand edince içindekileri göster
**Opsiyon B**: ZIP dosyasının üzerine gelince tooltip'te içindekileri göster
**Opsiyon C**: Mevcut "Arşiv İçeriğini Görüntüle" butonunu kullan (zaten var)

## Test

1. İhale seç ve detay aç
2. Döküman seç (ZIP dahil)
3. **"AI Analiz Başlat"** butonuna bas
4. ZIP otomatik çıkarılsın ve analiz başlasın

✅ **`sendToAnalysis()` fonksiyonu zaten var, sadece butonu ekledik!**
