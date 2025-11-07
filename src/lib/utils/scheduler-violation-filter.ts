/**
 * 🔇 Scheduler Violation Suppressor
 * 
 * React scheduler violation mesajlarını filtreler
 * Sadece GERÇEKTEN uzun süren task'ları gösterir (>1000ms)
 * 
 * Development mode için - Production'da otomatik devre dışı
 * 
 * @module scheduler-violation-filter
 */

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Orijinal console.warn'ı sakla
  const originalWarn = console.warn;
  
  // Threshold: Sadece 1 saniyeden uzun süren violation'ları göster
  const VIOLATION_THRESHOLD = 1000; // ms

  console.warn = function(...args: any[]) {
    const message = args[0]?.toString() || '';
    
    // Violation mesajı mı?
    if (message.includes('[Violation]')) {
      // Süreyi extract et
      const match = message.match(/(\d+)ms/);
      if (match) {
        const duration = parseInt(match[1]);
        
        // Eğer threshold'un altındaysa ignore et
        if (duration < VIOLATION_THRESHOLD) {
          return; // Mesajı gösterme
        }
        
        // Threshold'un üzerindeyse UYARI olarak göster
        console.error(`🚨 CRITICAL PERFORMANCE ISSUE: ${message}`);
        return;
      }
    }
    
    // Diğer tüm console.warn mesajları normal göster
    originalWarn.apply(console, args);
  };

  console.log(`
🔇 Scheduler Violation Filter Active
- Threshold: ${VIOLATION_THRESHOLD}ms
- Only showing violations > ${VIOLATION_THRESHOLD}ms
- Violations < ${VIOLATION_THRESHOLD}ms are suppressed
  `);
}

export {};
