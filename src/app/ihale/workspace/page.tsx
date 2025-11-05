'use client';

// ============================================================================
// TENDER WORKSPACE - Yeni Mimari
// Session-based analysis workspace with real-time progress tracking
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, FileText, Download, ArrowLeft } from 'lucide-react';

interface TenderFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isExtractedFromZip?: boolean;
}

interface TenderSession {
  id: string;
  status: 'created' | 'uploading' | 'uploaded' | 'analyzing' | 'completed' | 'error';
  files: TenderFile[];
  result?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface AnalysisProgress {
  sessionId: string;
  stage: string;
  filesProcessed: number;
  totalFiles: number;
  percentage: number;
  message: string;
  error?: string;
}

export default function TenderWorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Yükleniyor...</p>
        </div>
      </div>
    }>
      <TenderWorkspacePageInner />
    </Suspense>
  );
}

function TenderWorkspacePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const [session, setSession] = useState<TenderSession | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch session details
  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError('Session ID bulunamadı');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/tender/session/${sessionId}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Session yüklenemedi');
      }

      setSession(data.session);
      setLoading(false);
    } catch (err: any) {
      console.error('Session fetch error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [sessionId]);

  // SSE progress tracking
  useEffect(() => {
    if (!sessionId || !session) return;

    // Only start SSE if session is analyzing
    if (session.status !== 'analyzing' && session.status !== 'uploaded') {
      return;
    }

    console.log('📡 Starting SSE progress tracking for session:', sessionId);

    const eventSource = new EventSource(`/api/tender/session/${sessionId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const progressData: AnalysisProgress = JSON.parse(event.data);
        console.log('📊 Progress update:', progressData);
        setProgress(progressData);

        // Update session status if completed or error
        if (progressData.stage === 'completed' || progressData.stage === 'error') {
          fetchSession(); // Refresh session to get final result
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, session, fetchSession]);

  // Initial fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Workspace yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Hata</p>
          <p className="text-gray-600 mb-4">{error || 'Session bulunamadı'}</p>
          <button
            onClick={() => router.push('/ihale-robotu')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            İhale Takip'e Dön
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = session.status === 'completed';
  const isError = session.status === 'error';
  const isAnalyzing = session.status === 'analyzing' || session.status === 'uploaded';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/ihale-robotu')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            İhale Takip'e Dön
          </button>
          <h1 className="text-3xl font-bold text-gray-900">İhale Analiz Workspace</h1>
          <p className="text-gray-600 mt-1">Session ID: {session.id}</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {isCompleted && <CheckCircle className="w-8 h-8 text-green-600" />}
            {isError && <XCircle className="w-8 h-8 text-red-600" />}
            {isAnalyzing && <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isCompleted && 'Analiz Tamamlandı'}
                {isError && 'Hata Oluştu'}
                {isAnalyzing && 'Analiz Yapılıyor'}
                {session.status === 'created' && 'Session Oluşturuldu'}
                {session.status === 'uploading' && 'Dosyalar Yükleniyor'}
              </h2>
              <p className="text-gray-600 text-sm">
                {progress?.message || 'İşlem devam ediyor...'}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          {isAnalyzing && progress && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>İlerleme</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {isError && session.errorMessage && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{session.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Files Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Yüklenen Dosyalar ({session.files.length})
          </h3>
          <div className="space-y-2">
            {session.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.filename}
                    {file.isExtractedFromZip && (
                      <span className="ml-2 text-xs text-blue-600">(ZIP'den çıkarıldı)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.mimeType} • {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results Card (if completed) */}
        {isCompleted && session.result && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Analiz Sonuçları</h3>

            {/* Documents Metadata */}
            {session.result.documents && session.result.documents.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Dökümanlar</h4>
                <div className="space-y-3">
                  {session.result.documents.map((doc: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-xs text-gray-500 mt-1">{doc.type}</p>
                        </div>
                        {doc.processedSuccessfully ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        {doc.pageCount && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Sayfa</p>
                            <p className="text-sm font-semibold text-gray-900">{doc.pageCount}</p>
                          </div>
                        )}
                        {doc.wordCount && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Kelime</p>
                            <p className="text-sm font-semibold text-gray-900">{doc.wordCount.toLocaleString('tr-TR')}</p>
                          </div>
                        )}
                        {doc.charCount && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Karakter</p>
                            <p className="text-sm font-semibold text-gray-900">{doc.charCount.toLocaleString('tr-TR')}</p>
                          </div>
                        )}
                        {doc.size && (
                          <div className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-500">Boyut</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {(doc.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        )}
                      </div>

                      {doc.error && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                          {doc.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON - Collapsed by default */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 font-medium">
                Ham Veriyi Görüntüle (JSON)
              </summary>
              <div className="bg-gray-50 rounded-lg p-4 mt-2">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(session.result, null, 2)}
                </pre>
              </div>
            </details>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(session.result, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${session.id}_results.json`;
                  a.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Sonuçları İndir (JSON)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
