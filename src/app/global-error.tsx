'use client';

/**
 * Global Error Handler - Tüm hataları yakalar ve suppress eder
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Suppress ALL console errors in production
  if (typeof window !== 'undefined') {
    // Override console.error to suppress known issues
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = args.join(' ');

      // Suppress next-themes hydration errors
      if (message.includes('2087877299') || message.includes('Classes or null prototypes')) {
        return;
      }

      // Suppress localstorage-file warnings
      if (message.includes('localstorage-file')) {
        return;
      }

      // Log other errors normally
      originalError.apply(console, args);
    };
  }

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gray-900">
          <div className="max-w-md rounded-lg bg-red-500/10 border border-red-500/20 p-6">
            <h2 className="text-xl font-bold text-red-400 mb-4">Global Error</h2>
            <p className="text-gray-300 mb-4">{error.message}</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
