# ⚠️ KRİTİK SORUN VE ÇÖZÜMÜ

## 🔴 SORUN

Sayfa yenilendiğinde:
1. **"Only plain objects" hatası** sürekli geliyor (server console'da)
2. **Sayfa birden fazla kere yenileniyor** (double/triple render)

## 🎯 ROOT CAUSE

**Zustand Persist Middleware** localStorage'dan eski File objelerini yüklemeye çalışıyor:
- Store version 5'e güncelledik
- Migration eklendi
- AMA eski localStorage data hala browser'da!
- Her sayfa yüklenişinde Zustand eski data'yı parse etmeye çalışıyor
- File objeler serialize edilemiyor → Hata
- Hata suppress ediliyor ama sayfa render loop'a giriyor

## ✅ ÇÖZÜM (1 DAKİKA)

### Option 1: Browser Console (Hızlı)
```javascript
localStorage.clear();
location.reload();
```

### Option 2: Özel Temizlik Sayfası
1. Aç: http://localhost:3000/clear-storage.html
2. Sayfa otomatik temizleyecek
3. Ana sayfaya dön

### Option 3: Manual (Chrome DevTools)
1. F12 → Application Tab
2. Storage → Local Storage → localhost:3000
3. Sağ tık → Clear
4. Sayfa yenile

## 🧪 DOĞRULAMA

Temizledikten sonra:
- ✅ Server console'da "Only plain objects" hatası KALDIRILMALI
- ✅ Sayfa sadece 1 KERE yüklenmeli
- ✅ GET request'ler normal olmalı

## 📝 NEDEN OLUYOR?

```
Eski Store (v4 veya daha eski):
{
  fileStatuses: [
    {
      file: File { ... } ← CLASS INSTANCE! Serialize edilemez!
    }
  ]
}

Yeni Store (v5):
{
  fileStatuses: [
    {
      fileMetadata: { name, size, type } ← PLAIN OBJECT! Serialize edilir!
    }
  ]
}
```

Migration kodu çalışıyor ama Zustand **hydration sırasında** eski data'yı parse etmeye çalışıyor.

## ⚡ BU SORUNU BİR DAHA YAŞAMAMAK İÇİN

Store version'ı her değiştirdiğinde localStorage key'ini değiştir:

```typescript
{
  name: 'ihale-store-v5', // ← Version'ı key'e ekle
  version: 5,
  // ...
}
```

Bu sayede eski data ignore edilir, yeni key kullanılır.
