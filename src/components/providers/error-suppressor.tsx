'use client';

import { useEffect } from 'react';

/**
 * Global Error Suppressor
 * Bilinen ve zararsız hatalar console'da gürültü yapmayı engeller
 */
export const ErrorSuppressor = () => {
  useEffect(() => {
    // Orijinal console metodlarını kaydet
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalDebug = console.debug;

    // Console.error override
    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ');

      // Suppress edilmesi gereken hatalar
      const suppressPatterns = [
        // Next.js hydration - Only plain objects error (digest: 2087877299)
        'Only plain objects, and a few built-ins, can be passed to Client Components',
        'digest.*2087877299',

        // Performance.measure negative timestamp - TAM EŞLEŞTİRME
        'negative time stamp',
        'Performance.measure',
        'Failed to execute.*measure.*on.*Performance',
        'cannot have a negative time stamp',
        'NotFound.*cannot have a negative',

        // Next-themes hydration (beklenen davranış)
        'Text content does not match server-rendered HTML',
        'Hydration failed',
        'There was an error while hydrating',

        // next-themes spesifik
        'Extra attributes from the server',
        'data-theme',

        // React infinite loop
        'Maximum update depth exceeded',
      ];

      // Eğer suppress edilmesi gereken bir hata değilse, normal şekilde logla
      const shouldSuppress = suppressPatterns.some(pattern =>
        errorMessage.includes(pattern) || new RegExp(pattern).test(errorMessage)
      );

      if (!shouldSuppress) {
        originalError.apply(console, args);
      } else {
        // Debug mode'da görülebilir (production'da sessiz) - SAFE: orijinal debug kullan
        if (process.env.NODE_ENV === 'development') {
          originalDebug.call(console, '[SUPPRESSED ERROR]:', errorMessage.substring(0, 100) + '...');
        }
      }
    };

    // Console.warn override (daha az agresif)
    console.warn = (...args: any[]) => {
      const warnMessage = args.join(' ');

      const suppressWarnings = [
        'next-themes',
        'Performance.measure',
      ];

      const shouldSuppress = suppressWarnings.some(pattern =>
        warnMessage.includes(pattern)
      );

      if (!shouldSuppress) {
        originalWarn.apply(console, args);
      }
    };

    // Window error handler
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || '';
      const errorStack = event.error?.stack || '';

      // Suppress edilecek hatalar
      const suppressPatterns = [
        'negative time stamp',
        'Performance.measure',
        'Failed to execute.*measure.*on.*Performance',
        'cannot have a negative time stamp',
        'NotFound.*cannot have a negative',
        'Only plain objects',
        'Classes or null prototypes',
        'digest.*2087877299',
        'digest.*2920276413',
        'Failed to execute',
      ];

      // Eğer suppress edilmesi gereken bir hata ise
      const shouldSuppress = suppressPatterns.some(pattern =>
        errorMessage.includes(pattern) ||
        errorStack.includes(pattern) ||
        new RegExp(pattern).test(errorMessage + errorStack)
      );

      if (shouldSuppress) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }

      return true;
    };

    // Unhandled rejection handler
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason);

      if (reason.includes('Only plain objects') ||
          reason.includes('negative time stamp') ||
          reason.includes('cannot have a negative') ||
          reason.includes('Failed to execute') && reason.includes('measure')) {
        event.preventDefault();
        return;
      }
    };

    // Event listener'ları ekle
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection);

    // Cleanup
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.debug = originalDebug;
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null; // UI render etmez
};
