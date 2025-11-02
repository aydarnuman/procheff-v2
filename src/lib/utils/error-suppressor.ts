/**
 * 🔇 Global Error Suppressor - Tüm console hataları tamamen susturulur
 *
 * Production ve Development için KOMPLİT hata gizleme sistemi
 */

export function initializeErrorSuppression() {
  if (typeof window === 'undefined') return;

  // Sadece client-side'da çalışır
  const originalError = console.error;
  const originalWarn = console.warn;

  // TÜMÜNÜ YAKALA VE SUSTUR
  console.error = (...args: any[]) => {
    const message = args.join(' ');

    // Next-themes hydration errors
    if (
      message.includes('2087877299') ||
      message.includes('Classes or null prototypes') ||
      message.includes('Hydration') ||
      message.includes('hydration') ||
      message.includes('server') ||
      message.includes('client')
    ) {
      return; // Tamamen sustur
    }

    // LocalStorage warnings
    if (
      message.includes('localstorage') ||
      message.includes('localStorage') ||
      message.includes('--localstorage-file')
    ) {
      return; // Tamamen sustur
    }

    // Cross-origin warnings
    if (
      message.includes('192.168') ||
      message.includes('cross-origin') ||
      message.includes('CORS')
    ) {
      return; // Tamamen sustur
    }

    // React strict mode warnings
    if (
      message.includes('StrictMode') ||
      message.includes('strict mode') ||
      message.includes('double-invoke')
    ) {
      return; // Tamamen sustur
    }

    // Next.js warnings
    if (
      message.includes('next-dev') ||
      message.includes('turbopack') ||
      message.includes('webpack')
    ) {
      return; // Tamamen sustur
    }

    // Diğer gerçek hataları logla (ama kullanıcıya gösterme)
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const message = args.join(' ');

    // WARN'ları da sustur
    if (
      message.includes('localstorage') ||
      message.includes('localStorage') ||
      message.includes('cross-origin') ||
      message.includes('CORS') ||
      message.includes('192.168')
    ) {
      return; // Tamamen sustur
    }

    // Diğer warning'leri logla
    originalWarn.apply(console, args);
  };

  // Global error handler
  window.addEventListener('error', (event) => {
    // Next-themes, LocalStorage, Cross-origin hatalarını yakala
    if (
      event.message.includes('2087877299') ||
      event.message.includes('localstorage') ||
      event.message.includes('192.168') ||
      event.message.includes('Classes or null prototypes')
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // Unhandled rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason);

    if (
      message.includes('localstorage') ||
      message.includes('192.168') ||
      message.includes('cross-origin')
    ) {
      event.preventDefault();
      return false;
    }
  });

  console.log('✅ Error suppression initialized - Console temiz olacak!');
}
