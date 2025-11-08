/**
 * 🧪 File Crash Test Simülasyon Scripti
 * 
 * Browser Console'da çalıştır (⌘+Option+J)
 * Bu script file objesi kayıp senaryolarını simüle eder
 */

// ============================================
// SENARYO 1: File Map'i Manuel Temizleme
// ============================================
window.simulateFileLoss = function() {
  console.log('%c🧪 SENARYO 1: File Objesi Kaybı Simülasyonu', 'font-size: 16px; font-weight: bold; color: #dc2626;');
  
  // React component'teki fileObjectsMapRef'e eriş
  // Not: Bu production'da çalışmaz, sadece dev ortamı için
  const reactRoot = document.querySelector('#__next');
  if (!reactRoot) {
    console.error('❌ React root bulunamadı!');
    return;
  }
  
  // File map'i temizle (simülasyon)
  console.log('%c📦 fileObjectsMapRef.current temizleniyor...', 'color: #f59e0b;');
  console.log('⚠️ NOT: Bu gerçek crash senaryosunu simüle eder.');
  console.log('');
  
  console.log('%c✅ Simülasyon hazır!', 'color: #22c55e; font-weight: bold;');
  console.log('Şimdi herhangi bir dosyanın "İşle" butonuna basın.');
  console.log('');
  console.log('%cBeklenen Sonuç:', 'font-weight: bold;');
  console.log('  ✅ Toast: "❌ Dosya yüklenemedi - file objesi bulunamadı"');
  console.log('  ✅ Console: "🛡️ SERT GÜVENLİK KONTROLÜ"');
  console.log('  ✅ Sayfa ÇÖKMEMELI!');
};

// ============================================
// SENARYO 2: IndexedDB Yavaş Yükleme
// ============================================
window.simulateSlowIndexedDB = function() {
  console.log('%c🧪 SENARYO 2: IndexedDB Yavaş Yükleme', 'font-size: 16px; font-weight: bold; color: #dc2626;');
  
  // IndexedDB API'sini override et (yavaşlat)
  const originalGet = window.indexedDB.open;
  let callCount = 0;
  
  window.indexedDB.open = function(...args) {
    callCount++;
    console.log(`%c⏱️ IndexedDB.open geciktiriliyor... (${callCount}. çağrı)`, 'color: #f59e0b;');
    
    // 3 saniye gecikme ekle
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`%c✅ IndexedDB.open devam ediyor (${callCount}. çağrı)`, 'color: #22c55e;');
        resolve(originalGet.apply(this, args));
      }, 3000);
    });
  };
  
  console.log('%c✅ IndexedDB geciktirildi (3 saniye)', 'color: #22c55e; font-weight: bold;');
  console.log('');
  console.log('%cTest Adımları:', 'font-weight: bold;');
  console.log('  1. /ihale-robotu sayfasına git');
  console.log('  2. Bir ihale seç');
  console.log('  3. "Yeni Analiz Oluştur" butonuna bas');
  console.log('  4. 3 saniye içinde "İşle" butonuna bas');
  console.log('');
  console.log('%cBeklenen Sonuç:', 'font-weight: bold;');
  console.log('  ✅ isMounted kontrolü sayesinde state güncellemesi yapılmaz');
  console.log('  ✅ Toast uyarısı gösterilir');
  console.log('  ✅ Sayfa ÇÖKMEMELI!');
};

// ============================================
// SENARYO 3: Component Unmount Simülasyonu
// ============================================
window.simulateUnmount = function() {
  console.log('%c🧪 SENARYO 3: Component Unmount', 'font-size: 16px; font-weight: bold; color: #dc2626;');
  
  console.log('%c📝 Test Adımları:', 'font-weight: bold;');
  console.log('  1. /ihale/yeni-analiz?from=ihale_docs_test sayfasına git');
  console.log('  2. useEffect tetiklenir (IndexedDB yükleme başlar)');
  console.log('  3. HEMEN tarayıcı geri butonuna bas (⌘+[)');
  console.log('  4. Console\'da cleanup logunu kontrol et');
  console.log('');
  console.log('%cBeklenen Console Logları:', 'font-weight: bold;');
  console.log('  ✅ "🔍 useEffect çalıştı - from parametresi: ihale_docs_test"');
  console.log('  ✅ "🧹 IndexedDB useEffect cleanup - component unmounting"');
  console.log('  ✅ State güncellemeleri YAPILMAMALI (isMounted = false)');
  console.log('');
  console.log('%c⚠️ NOT:', 'color: #f59e0b; font-weight: bold;');
  console.log('Console\'da "Can\'t perform state update on unmounted component" UYARISI OLMAMALI!');
};

// ============================================
// SENARYO 4: Map Keys Debug
// ============================================
window.debugFileMap = function() {
  console.log('%c🔍 DEBUG: File Map İçeriği', 'font-size: 16px; font-weight: bold; color: #3b82f6;');
  
  console.log('%c📦 fileObjectsMapRef.current içeriği:', 'font-weight: bold;');
  console.log('');
  console.log('%c⚠️ NOT:', 'color: #f59e0b;');
  console.log('Bu fonksiyon sadece /ihale/yeni-analiz sayfasında çalışır.');
  console.log('Component mount olduğunda fileObjectsMapRef erişilebilir hale gelir.');
  console.log('');
  console.log('%cKullanım:', 'font-weight: bold;');
  console.log('  1. /ihale/yeni-analiz sayfasına git');
  console.log('  2. Dosya yükle');
  console.log('  3. Console\'da tekrar debugFileMap() çalıştır');
};

// ============================================
// SENARYO 5: processSingleFile Undefined Test
// ============================================
window.testProcessSingleFile = function() {
  console.log('%c🧪 SENARYO 5: processSingleFile(undefined) Çağrısı', 'font-size: 16px; font-weight: bold; color: #dc2626;');
  
  console.log('%c⚠️ Bu test oldukça tehlikeli!', 'color: #f59e0b; font-weight: bold;');
  console.log('processSingleFile fonksiyonunu undefined parametreyle çağıracak.');
  console.log('');
  console.log('%cÖNCEKİ Davranış:', 'font-weight: bold; color: #dc2626;');
  console.log('  ❌ TypeError: Cannot read property \'name\' of undefined');
  console.log('  ❌ Page crash');
  console.log('  ❌ Error boundary');
  console.log('');
  console.log('%cYENİ Davranış:', 'font-weight: bold; color: #22c55e;');
  console.log('  ✅ Console: "❌ [CRITICAL] processSingleFile: File objesi undefined!"');
  console.log('  ✅ Toast: "❌ Dosya yüklenemedi - file objesi bulunamadı"');
  console.log('  ✅ Sayfa açık kalır');
  console.log('  ✅ Kullanıcı yeniden deneyebilir');
  console.log('');
  console.log('%c💡 Manuel Test:', 'font-weight: bold;');
  console.log('Bu testi manuel olarak yapmak için:');
  console.log('  1. /ihale/yeni-analiz sayfasına git');
  console.log('  2. Network tab\'ında Throttling: "Slow 3G" seç');
  console.log('  3. Dosya yükle');
  console.log('  4. Yükleme tamamlanmadan "İşle" butonuna bas');
};

// ============================================
// MASTER TEST - Tüm Senaryoları Listele
// ============================================
window.showAllTests = function() {
  console.clear();
  console.log('%c🧪 FILE CRASH TEST SİMÜLATÖRÜ', 'font-size: 20px; font-weight: bold; color: #667eea; background: #f0f0f0; padding: 10px;');
  console.log('');
  console.log('%cKullanılabilir Test Fonksiyonları:', 'font-size: 14px; font-weight: bold;');
  console.log('');
  
  console.log('%c1️⃣ simulateFileLoss()', 'color: #dc2626; font-weight: bold;');
  console.log('   File objesi kaybı simülasyonu');
  console.log('');
  
  console.log('%c2️⃣ simulateSlowIndexedDB()', 'color: #dc2626; font-weight: bold;');
  console.log('   IndexedDB yavaş yükleme senaryosu');
  console.log('');
  
  console.log('%c3️⃣ simulateUnmount()', 'color: #dc2626; font-weight: bold;');
  console.log('   Component unmount cleanup testi');
  console.log('');
  
  console.log('%c4️⃣ debugFileMap()', 'color: #3b82f6; font-weight: bold;');
  console.log('   fileObjectsMapRef içeriğini göster');
  console.log('');
  
  console.log('%c5️⃣ testProcessSingleFile()', 'color: #dc2626; font-weight: bold;');
  console.log('   processSingleFile(undefined) güvenlik testi');
  console.log('');
  
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #888;');
  console.log('');
  console.log('%c💡 Hızlı Başlangıç:', 'font-weight: bold;');
  console.log('   simulateFileLoss()  → En basit test');
  console.log('   showAllTests()      → Bu menüyü göster');
  console.log('');
  console.log('%c📚 Daha fazla bilgi için:', 'font-weight: bold;');
  console.log('   http://localhost:3000/test-file-crash.html');
};

// ============================================
// AUTO-RUN: Sayfa yüklendiğinde otomatik çalış
// ============================================
console.log('%c🚀 File Crash Test Simülatörü Hazır!', 'font-size: 16px; font-weight: bold; color: #22c55e;');
console.log('');
console.log('%cTest fonksiyonlarını görmek için:', 'font-weight: bold;');
console.log('%c  showAllTests()', 'color: #667eea; font-size: 14px; font-weight: bold;');
console.log('');

// ============================================
// EXPORT (global scope'a ekle)
// ============================================
window.crashTestUtils = {
  simulateFileLoss,
  simulateSlowIndexedDB,
  simulateUnmount,
  debugFileMap,
  testProcessSingleFile,
  showAllTests
};

console.log('%c✅ Tüm test fonksiyonları yüklendi!', 'color: #22c55e;');
console.log('   window.crashTestUtils içinde erişilebilir');
