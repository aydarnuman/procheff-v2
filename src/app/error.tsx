'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

interface ErrorSuggestion {
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

function getErrorSuggestions(error: Error): ErrorSuggestion[] {
  const message = error.message.toLowerCase();
  const suggestions: ErrorSuggestion[] = [];

  // 🆕 File object missing errors
  if (message.includes('file') && (message.includes('bulunamad') || message.includes('undefined') || message.includes('null'))) {
    suggestions.push({
      title: '📁 Dosya Yükleme Sorunu',
      description: 'Dosya objesi kaybedildi veya yükleme tamamlanmadan işleme başlatıldı',
      action: {
        label: 'Dosyayı Yeniden Yükle',
        href: '/ihale/yeni-analiz',
      },
    });
  }

  // API Key errors
  if (message.includes('api key') || message.includes('authentication') || message.includes('401')) {
    suggestions.push({
      title: '🔑 API Anahtarı Sorunu',
      description: 'Claude veya Gemini API anahtarınız geçersiz veya eksik',
      action: {
        label: 'API Ayarlarını Kontrol Et',
        href: '/ai-settings',
      },
    });
  }

  // Rate limit errors
  if (message.includes('rate limit') || message.includes('429')) {
    suggestions.push({
      title: '⏱️ İstek Limiti Aşıldı',
      description: 'AI provider\'ın dakikalık istek limitine ulaştınız',
      action: {
        label: '1 dakika bekleyip tekrar deneyin',
      },
    });
  }

  // Quota errors
  if (message.includes('quota') || message.includes('exceeded')) {
    suggestions.push({
      title: '💰 Kota Tükendi',
      description: 'Aylık AI kullanım kotanız doldu',
      action: {
        label: 'Fiyatlandırma Bilgisi',
        href: 'https://www.anthropic.com/pricing',
      },
    });
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    suggestions.push({
      title: '🌐 Bağlantı Hatası',
      description: 'İnternet bağlantınızı kontrol edin',
      action: {
        label: 'Sayfayı Yenile',
        onClick: () => window.location.reload(),
      },
    });
  }

  // Invalid model errors
  if (message.includes('model') || message.includes('invalid')) {
    suggestions.push({
      title: '🤖 Geçersiz Model',
      description: 'Seçilen AI modeli mevcut değil veya desteklenmiyor',
      action: {
        label: 'Desteklenen modelleri gör',
        href: '/ai-settings',
      },
    });
  }

  // Server errors
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    suggestions.push({
      title: '🔧 Sunucu Hatası',
      description: 'AI provider\'da geçici bir sorun var',
      action: {
        label: 'Birkaç dakika sonra tekrar deneyin',
      },
    });
  }

  // Default suggestion if no specific match
  if (suggestions.length === 0) {
    suggestions.push({
      title: '⚠️ Bilinmeyen Hata',
      description: 'Lütfen sayfayı yenileyin veya destek ekibiyle iletişime geçin',
    });
  }

  return suggestions;
}

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

  const suggestions = getErrorSuggestions(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
      <div className="max-w-2xl w-full space-y-6">
        {/* Error Header */}
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-red-400 mb-2">Bir Hata Oluştu</h2>
              <p className="text-gray-300 text-sm leading-relaxed">{error.message}</p>
              {error.digest && (
                <p className="text-xs text-gray-500 mt-2">Error ID: {error.digest}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tekrar Dene
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>

        {/* Suggestions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Önerilen Çözümler
          </h3>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 hover:border-gray-600 transition-colors"
            >
              <h4 className="font-medium text-white mb-1">{suggestion.title}</h4>
              <p className="text-sm text-gray-400 mb-3">{suggestion.description}</p>
              {suggestion.action && (
                suggestion.action.href ? (
                  <a
                    href={suggestion.action.href}
                    target={suggestion.action.href.startsWith('http') ? '_blank' : undefined}
                    rel={suggestion.action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {suggestion.action.label}
                    {suggestion.action.href.startsWith('http') && (
                      <ExternalLink className="w-3 h-3" />
                    )}
                  </a>
                ) : (
                  <button
                    onClick={suggestion.action.onClick}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {suggestion.action.label}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
