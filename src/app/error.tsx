'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Suppress bilinen hatalar
    const suppressedDigests = ['2087877299', '2920276413'];

    if (error.digest && suppressedDigests.includes(error.digest)) {
      // Sessizce suppress et
      return;
    }

    // Diğer hataları logla (development'ta)
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', error);
    }
  }, [error]);

  // Suppress edilmiş hataları gösterme
  const suppressedDigests = ['2087877299', '2920276413'];
  if (error.digest && suppressedDigests.includes(error.digest)) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="max-w-md rounded-lg bg-red-500/10 border border-red-500/20 p-6">
        <h2 className="text-xl font-bold text-red-400 mb-4">Bir hata oluştu</h2>
        <p className="text-gray-300 mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
