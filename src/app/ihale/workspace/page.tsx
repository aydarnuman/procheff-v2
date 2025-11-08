'use client';

// ============================================================================
// TENDER WORKSPACE - Proper File Processing Integration
// Uses SimpleDocumentList component for file processing workflow
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, FileText, Download, ArrowLeft } from 'lucide-react';
import { SimpleDocumentList } from '@/components/ihale/SimpleDocumentList';
import { useIhaleStore, FileMetadata } from '@/lib/stores/ihale-store';
import { toast } from 'sonner';

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
  const sessionId = searchParams.get('sessionId');

  // DUAL MODE: sessionId varsa tracking, yoksa processing
  if (!sessionId) {
    return <ProcessingMode />;
  }

  return <TrackingMode sessionId={sessionId} />;
}

// ============================================================================
// MODE 1: PROCESSING MODE (dosya işleme)
// ============================================================================
function ProcessingMode() {
  const router = useRouter();
  const { fileStatuses, addFileStatus, updateFileStatus, removeFileStatus } = useIhaleStore();
  const [processing, setProcessing] = useState(false);
  const [fileObjects, setFileObjects] = useState<Map<string, File>>(new Map()); // File objelerini ayrı sakla

  // Dosya seçme
  const handleFileSelect = async (files: File[]) => {
    for (const file of files) {
      // File metadata oluştur
      const metadata: FileMetadata = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };

      // Store'a ekle
      addFileStatus({
        fileMetadata: metadata,
        status: 'pending',
        progress: 'Bekliyor...'
      });

      // File objesini ayrı sakla
      setFileObjects(prev => new Map(prev).set(file.name, file));
    }
    toast.success(`${files.length} dosya eklendi`);
  };

  // Dosya silme
  const handleFileRemove = (fileName: string) => {
    removeFileStatus(fileName);
    setFileObjects(prev => {
      const next = new Map(prev);
      next.delete(fileName);
      return next;
    });
    toast.success(`${fileName} silindi`);
  };

  // Tek dosyayı işle
  const handleFileProcess = async (fileName: string) => {
    const fileStatus = fileStatuses.find(f => f.fileMetadata.name === fileName);
    const fileObject = fileObjects.get(fileName);

    if (!fileStatus || !fileObject) {
      toast.error('Dosya bulunamadı');
      return;
    }

    // Status'u processing'e çek
    updateFileStatus(fileName, { status: 'processing', progress: 'Başlatılıyor...' });

    try {
      // FormData oluştur
      const formData = new FormData();
      formData.append('file0', fileObject);
      formData.append('fileCount', '1');
      // PDF ise OCR kullan
      const useOCR = fileObject.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
      formData.append('useOCR', useOCR ? 'true' : 'false');

      // SSE ile stream al
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  updateFileStatus(fileName, {
                    status: 'processing',
                    progress: data.message
                  });
                } else if (data.type === 'success') {
                  const extractedText = data.result?.extracted_text || data.result?.text || '';
                  const wordCount = extractedText.split(/\s+/).filter((w: string) => w.length > 0).length;

                  updateFileStatus(fileName, {
                    status: 'completed',
                    progress: 'Tamamlandı',
                    extractedText,
                    wordCount
                  });
                  toast.success(`${fileName} işlendi (${wordCount.toLocaleString('tr-TR')} kelime)`);
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'İşleme hatası');
                }
              } catch (parseError) {
                console.error('Parse error:', parseError);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Process error:', error);
      updateFileStatus(fileName, {
        status: 'error',
        progress: 'Hata',
        error: error.message || 'Bilinmeyen hata'
      });
      toast.error(`${fileName} işlenemedi`);
    }
  };

  // Analiz başlat
  const handleStartAnalysis = async () => {
    // Tüm dosyalar işlendi mi kontrol et
    const allCompleted = fileStatuses.every(f => f.status === 'completed');
    if (!allCompleted) {
      toast.error('Önce tüm dosyaları işleyin!');
      return;
    }

    setProcessing(true);

    try {
      // 1. Create session
      const createRes = await fetch('/api/tender/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          userId: 'workspace-user'
        })
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Session oluşturulamadı');
      }

      const sessionId = createData.sessionId;
      toast.success('Session oluşturuldu');

      // 2. Upload processed files
      const formData = new FormData();
      fileStatuses.forEach((fileStatus, index) => {
        const fileObject = fileObjects.get(fileStatus.fileMetadata.name);
        if (fileObject) {
          formData.append(`file${index}`, fileObject);
        }
      });
      formData.append('fileCount', fileStatuses.length.toString());
      formData.append('sessionId', sessionId);

      const uploadRes = await fetch('/api/tender/session/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Dosyalar yüklenemedi');
      }

      toast.success('Dosyalar yüklendi, analiz başlatılıyor...');

      // 3. Start analysis
      const analyzeRes = await fetch('/api/tender/session/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeData.success) {
        throw new Error(analyzeData.error || 'Analiz başlatılamadı');
      }

      // 4. Redirect to tracking mode
      router.push(`/ihale/workspace?sessionId=${sessionId}`);
    } catch (error: any) {
      console.error('Analysis start error:', error);
      toast.error(error.message || 'Analiz başlatılamadı');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/ihale')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            İhale Dashboard'a Dön
          </button>
          <h1 className="text-3xl font-bold text-white">Yeni İhale Analizi</h1>
          <p className="text-gray-400 mt-1">Dosyalarınızı işleyin ve AI ile analiz edin</p>
        </div>

        {/* SimpleDocumentList Component */}
        <SimpleDocumentList
          fileStatuses={fileStatuses}
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
          onFileProcess={handleFileProcess}
          onStartAnalysis={fileStatuses.every(f => f.status === 'completed') ? handleStartAnalysis : undefined}
        />

        {/* Start Analysis Button - Sadece tüm dosyalar işlendiyse */}
        {fileStatuses.length > 0 && fileStatuses.every(f => f.status === 'completed') && (
          <div className="sticky bottom-6 z-10">
            <button
              onClick={handleStartAnalysis}
              disabled={processing}
              className={`
                w-full py-4 rounded-xl font-bold text-lg transition-all duration-300
                ${processing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                }
              `}
            >
              {processing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Analiz Başlatılıyor...</span>
                </div>
              ) : (
                '🚀 AI ile Analiz Et'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODE 2: TRACKING MODE (sessionId var)
// ============================================================================
function TrackingMode({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<TenderSession | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch session details
  const fetchSession = useCallback(async () => {
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
            onClick={() => router.push('/ihale')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            İhale Dashboard'a Dön
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
            onClick={() => router.push('/ihale')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            İhale Dashboard'a Dön
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
