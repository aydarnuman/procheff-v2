'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, ChevronUp, ChevronDown, Search, Trash2, Sparkles, Bot, FileText, Download, Loader2, Calendar, Building2, MapPin, Clock, AlertCircle, AlertTriangle } from 'lucide-react';

interface Tender {
  id: string;
  source: string;
  source_id: string;
  source_url: string;
  title: string;
  organization: string;
  organization_city: string | null;
  budget: number | null;
  currency: string;
  announcement_date: string | null;
  deadline_date: string | null;
  tender_date: string | null;
  tender_type: string | null;
  procurement_type: string | null;
  category: string | null;
  is_catering: boolean;
  catering_confidence: number;
  specification_url?: string | null; // 🆕 Şartname URL
  announcement_text?: string | null; // 🆕 İlan metni
  ai_analyzed: boolean; // 🆕 AI analizi yapıldı mı?
  ai_analyzed_at: string | null; // 🆕 AI analiz zamanı
  registration_number?: string | null; // 🆕 İhale kayıt numarası
  // 🆕 Tüm dökümanlar
  raw_json?: {
    'Kayıt no'?: string; // 🆕 İhale kayıt numarası
    documents?: Array<{
      title: string;
      url: string;
      type: 'idari_sartname' | 'teknik_sartname' | 'ek_dosya' | 'diger';
    }>;
  };
  // 🆕 Mal/Hizmet listesi özet
  total_items?: number;
  total_meal_quantity?: number;
  estimated_budget_from_items?: number;
  first_seen_at: string;
  last_updated_at: string;
}

type SortField = 'title' | 'organization' | 'organization_city' | 'budget' | 'announcement_date' | 'tender_date' | 'deadline_date' | 'tender_type' | 'procurement_type';
type SortOrder = 'asc' | 'desc';

export default function IhaleTakipPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [sortField, setSortField] = useState<SortField>('deadline_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'closed'>('all');
  const [cleaning, setCleaning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null); // 🆕 Hangi ihale analiz ediliyor
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null); // 🆕 AI analiz sonucu
  const [fullContent, setFullContent] = useState<any | null>(null); // 🆕 Tam sayfa içeriği
  const [loadingContent, setLoadingContent] = useState(false); // 🆕 İçerik yüklenirken
  const [iframeUrl, setIframeUrl] = useState<string | null>(null); // 🆕 iframe URL'i
  const [batchFixing, setBatchFixing] = useState(false); // 🆕 Toplu AI fix
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 }); // 🆕 İlerleme
  const [scrapingProgress, setScrapingProgress] = useState<any>(null); // 🆕 Scraping progress
  const [isScrapingActive, setIsScrapingActive] = useState(false); // 🆕 Scraping aktif mi

  const loadTenders = async () => {
    try {
      setLoading(true);
      // Tüm ihaleleri göster
      const response = await fetch('/api/ihale-scraper/list?limit=1000');
      const data = await response.json();
      if (data.success) {
        setTenders(data.data);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerScrape = async () => {
    try {
      setScraping(true);
      setIsScrapingActive(true);
      console.log('🚀 Scraping arka planda başlatılıyor...');

      // Test endpoint kullan (async mode - hemen döner)
      const response = await fetch('/api/ihale-scraper/test');
      const data = await response.json();

      if (data.success) {
        console.log('✅ Scraping arka planda başlatıldı:', data.message);

        // Progress tracking başlat
        startProgressTracking();
      } else {
        console.error('❌ Scraping başlatma hatası:', data.error);
        alert(`❌ Hata: ${data.error}`);
        setScraping(false);
        setIsScrapingActive(false);
      }
    } catch (error: any) {
      console.error('❌ Scraping hatası:', error);
      alert(`❌ Hata: ${error.message}`);
      setScraping(false);
      setIsScrapingActive(false);
    }
  };

  // Progress tracking fonksiyonu
  const startProgressTracking = () => {
    const intervalId = setInterval(async () => {
      try {
        // Progress API'den durumu çek
        const response = await fetch('/api/ihale-scraper/progress?source=ihalebul');
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          const { value } = await reader.read();
          const text = decoder.decode(value);

          // SSE formatından JSON çıkar
          const lines = text.split('\n').filter(l => l.startsWith('data: '));
          if (lines.length > 0) {
            const jsonStr = lines[0].replace('data: ', '');
            const progress = JSON.parse(jsonStr);
            setScrapingProgress(progress);

            // Tamamlandıysa durdur
            if (progress.status === 'completed' || progress.status === 'error') {
              clearInterval(intervalId);
              setScraping(false);
              setIsScrapingActive(false);

              // Liste yenile
              await loadTenders();

              if (progress.status === 'completed') {
                alert(`✅ Scraping tamamlandı! ${progress.tendersFound || 0} ihale bulundu.`);
              } else {
                alert(`❌ Scraping hatası: ${progress.message || 'Bilinmeyen hata'}`);
              }
            }
          }

          reader.cancel();
        }
      } catch (error) {
        console.error('Progress tracking error:', error);
      }
    }, 2000); // Her 2 saniyede progress kontrol et

    // 5 dakika sonra timeout
    setTimeout(() => {
      clearInterval(intervalId);
      setScraping(false);
      setIsScrapingActive(false);
    }, 300000);
  };

  const stopPolling = () => {
    const pollInterval = (window as any).__scrapingPollInterval;
    if (pollInterval) {
      clearInterval(pollInterval);
      (window as any).__scrapingPollInterval = null;
      setScraping(false);
    }
  };

  const deleteAllTenders = async () => {
    if (!confirm('TÜM İHALELER SİLİNECEK! Emin misiniz?')) return;
    try {
      setDeleting(true);
      const response = await fetch('/api/cron/delete-tenders', {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'procheff-ihale-scraper-secret-2025-secure-key-32chars'}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ ${data.deletedCount} ihale silindi`);
        loadTenders();
      } else {
        alert('Hata: ' + data.error);
      }
    } catch (error: any) {
      alert('Bağlantı hatası: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const cleanDataWithGemini = async () => {
    if (!confirm('Eksik şehir/tarih bilgileri Gemini AI ile temizlenecek. Devam edilsin mi?')) return;
    try {
      setCleaning(true);
      const response = await fetch('/api/ihale-scraper/clean-data', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ ${data.cleaned} kayıt temizlendi (${data.failed} hata)`);
        loadTenders();
      } else {
        alert('Hata: ' + data.error);
      }
    } catch (error: any) {
      alert('Bağlantı hatası: ' + error.message);
    } finally {
      setCleaning(false);
    }
  };

  // 🆕 AI ile tam içerik getir (otomatik login ile)
  const fetchFullContent = async (tender: Tender, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();

    try {
      setLoadingContent(true);
      setAnalyzingId(tender.id);
      console.log('🤖 AI ile içerik getiriliyor (otomatik giriş):', tender.source_url);

      const response = await fetch('/api/ihale-scraper/fetch-full-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: tender.source_url,
          tenderId: tender.id // 🆕 Veritabanına kaydetmek için tender ID'si
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ İçerik alındı:', result.data);
        setFullContent(result.data);
        setSelectedTender(tender); // Modal'ı aç
      } else {
        alert('❌ İçerik alınamadı: ' + result.error);
      }
    } catch (error: any) {
      console.error('İçerik getirme hatası:', error);
      alert('❌ Bağlantı hatası: ' + error.message);
    } finally {
      setLoadingContent(false);
      setAnalyzingId(null);
    }
  };

  // 🆕 Döküman indir
  const downloadDocument = async (url: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();

    try {
      const downloadUrl = `/api/ihale-scraper/download-document?url=${encodeURIComponent(url)}`;
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      console.error('Döküman indirme hatası:', error);
      alert('❌ İndirme hatası: ' + error.message);
    }
  };

  // 🆕 Eksik ihaleleri toplu AI ile düzelt (yeni dedicated API)
  const batchFixMissingData = async () => {
    try {
      // Sadece eksik olanları filtrele (önizleme için)
      const missingTenders = tenders.filter(t =>
        t.title === 'Belirtilmemiş' ||
        t.organization === 'Belirtilmemiş' ||
        !t.registration_number
      );

      if (missingTenders.length === 0) {
        alert('✅ Tüm ihaleler eksiksiz!');
        return;
      }

      const confirmed = window.confirm(
        `⚠️ ${missingTenders.length} eksik ihale bulundu.\n\n` +
        `AI ile tüm eksik bilgiler otomatik getirilecek.\n` +
        `Tahmini süre: ~${Math.ceil(missingTenders.length * 0.1)} dakika (Haiku AI)\n` +
        `Maliyet: ~$${(missingTenders.length * 0.0005).toFixed(2)}\n\n` +
        `Devam edilsin mi?`
      );

      if (!confirmed) return;

      setBatchFixing(true);

      console.log('🚀 Batch AI Fix API çağrılıyor...');

      // Yeni dedicated API'yi çağır (server-side batch processing)
      const response = await fetch('/api/ihale-scraper/batch-ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        alert(
          `✅ Toplu düzeltme tamamlandı!\n\n` +
          `✅ Başarılı: ${result.fixed}\n` +
          `❌ Başarısız: ${result.failed}\n` +
          `📊 Toplam: ${result.total}\n` +
          `⏱️ Süre: ${result.durationSeconds}s`
        );
      } else {
        alert('❌ Toplu düzeltme hatası: ' + result.error);
      }

      // Listeyi yenile
      loadTenders();

    } catch (error: any) {
      alert('❌ Toplu düzeltme hatası: ' + error.message);
    } finally {
      setBatchFixing(false);
    }
  };

  useEffect(() => {
    document.title = 'İhale Takip | ProCheff AI';
    loadTenders();

    // Cleanup: Sayfa kapatıldığında polling'i durdur
    return () => {
      const pollInterval = (window as any).__scrapingPollInterval;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  // İhale durumu hesaplama
  const getTenderStatus = (t: Tender) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const deadlineDate = t.deadline_date ? new Date(t.deadline_date) : null;
    const tenderDate = t.tender_date ? new Date(t.tender_date) : null;

    if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0);
    if (tenderDate) tenderDate.setHours(0, 0, 0, 0);

    // Deadline öncelikli
    if (deadlineDate && deadlineDate >= now) {
      const days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (days === 0) return { label: 'Son Gün', color: 'red', days: 0 };
      if (days <= 3) return { label: `Son ${days} Gün`, color: 'orange', days };
      if (days <= 7) return { label: `${days} Gün`, color: 'yellow', days };
      return { label: 'Açık', color: 'green', days };
    }

    // Deadline geçmiş, tender date kontrol et
    if (tenderDate && tenderDate >= now) {
      return { label: 'İhale Günü Yakın', color: 'blue', days: Math.ceil((tenderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) };
    }

    // Her ikisi de geçmiş
    return { label: 'Kapandı', color: 'gray', days: -1 };
  };

  // Durum rozeti render
  const renderStatusBadge = (status: ReturnType<typeof getTenderStatus>) => {
    const colorClasses = {
      red: 'bg-red-500/10 text-red-400 border-red-500/30',
      orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      green: 'bg-green-500/10 text-green-400 border-green-500/30',
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      gray: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
    };

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses[status.color]}`}>
        <div className={`w-1.5 h-1.5 rounded-full bg-current`}></div>
        {status.label}
      </div>
    );
  };

  // Akıllı tarih gösterimi - deadline_date öncelikli
  const renderTenderDate = (t: Tender) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Deadline öncelikli (teklif son tarihi)
    const deadlineDate = t.deadline_date ? new Date(t.deadline_date) : null;
    const tenderDate = t.tender_date ? new Date(t.tender_date) : null;

    if (deadlineDate) {
      deadlineDate.setHours(0, 0, 0, 0);
    }
    if (tenderDate) {
      tenderDate.setHours(0, 0, 0, 0);
    }

    // Countdown hesaplama fonksiyonu
    const calculateCountdown = (date: Date) => {
      const daysRemaining = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysRemaining;
    };

    // Countdown render fonksiyonu
    const renderCountdown = (date: Date, days: number) => {
      const countdownText = days === 0 ? 'son gün' : `son ${days} gün`;
      const isUrgent = days <= 3;

      return (
        <div className="flex items-center gap-1.5">
          {isUrgent ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
          )}
          <span className={isUrgent ? 'text-red-500 font-semibold' : 'text-yellow-500 font-semibold'}>
            {countdownText}
          </span>
        </div>
      );
    };

    // Tarih formatla ve renklendir
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const getDateColor = (date: Date | null) => {
      if (!date) return 'text-gray-600';
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      const nowOnly = new Date(now);
      nowOnly.setHours(0, 0, 0, 0);

      if (dateOnly.getTime() === nowOnly.getTime()) return 'text-amber-400'; // Bugün
      if (dateOnly > nowOnly) return 'text-green-300'; // Gelecek
      return 'text-zinc-500'; // Geçmiş
    };

    // 1️⃣ Deadline varsa ve gelecekteyse → countdown göster (0-7 gün arası)
    if (deadlineDate && deadlineDate >= now) {
      const days = calculateCountdown(deadlineDate);
      if (days <= 7) {
        return renderCountdown(deadlineDate, days);
      } else {
        // 7+ gün sonra → renkli normal tarih
        return <span className={getDateColor(deadlineDate)}>{formatDate(deadlineDate)}</span>;
      }
    }

    // 2️⃣ Deadline yoksa veya geçmişse → tender_date göster (renkli)
    if (tenderDate) {
      return <span className={getDateColor(tenderDate)}>{formatDate(tenderDate)}</span>;
    }

    // 3️⃣ İkisi de yoksa
    return <span className="text-gray-600">-</span>;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Kayıt numarasını kopyala
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Kopyalama hatası:', err);
    }
  };

  const filteredTenders = tenders.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const registrationNumber = (t.registration_number || t.raw_json?.['Kayıt no'] || '').toLowerCase(); // 🆕 Kayıt no
    return (
      t.organization?.toLowerCase().includes(query) ||
      t.organization_city?.toLowerCase().includes(query) ||
      t.title?.toLowerCase().includes(query) ||
      t.tender_type?.toLowerCase().includes(query) ||
      t.procurement_type?.toLowerCase().includes(query) ||
      registrationNumber.includes(query) // 🆕 Kayıt no arama
    );
  });

  // Status filtresi uygula
  const statusFilteredTenders = filteredTenders.filter(t => {
    if (filterStatus === 'all') return true;

    const status = getTenderStatus(t);

    if (filterStatus === 'active') {
      return status.color === 'green';
    }
    if (filterStatus === 'upcoming') {
      return status.color === 'red' || status.color === 'orange' || status.color === 'yellow';
    }
    if (filterStatus === 'closed') {
      return status.color === 'gray';
    }

    return true;
  });

  const sortedTenders = [...statusFilteredTenders].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    // Null/undefined handling
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Date comparison
    if (sortField.includes('date')) {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    // Number comparison
    if (sortField === 'budget') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }

    // String comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-[1800px] mx-auto p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white">İhale Listesi</h1>
            <p className="text-sm text-gray-500">
              {sortedTenders.length} kayıt {searchQuery && `(${tenders.length} toplam)`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 w-64"
              />
            </div>
            <button
              onClick={deleteAllTenders}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-sm"
            >
              <Trash2 className={`w-4 h-4`} />
              {deleting ? 'Siliniyor...' : 'Tümünü Sil'}
            </button>
            <button
              onClick={triggerScrape}
              disabled={scraping}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded hover:bg-gray-200 disabled:bg-gray-800 disabled:text-gray-600 text-sm"
              title={scraping ? 'Scraping devam ediyor...' : 'Yeni ihaleleri siteden çek'}
            >
              <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'İhaleler Çekiliyor...' : 'Yeni İhaleler Çek'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {!loading && (
          <div className="grid grid-cols-1 gap-4 mb-4">
            {/* Scraping Durumu */}
            {scraping && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-400">
                        {scrapingProgress?.message || 'Scraping Devam Ediyor'}
                      </div>
                      <div className="text-xs text-blue-300/70 mt-1">
                        {scrapingProgress?.currentPage && scrapingProgress?.totalPages ? (
                          `Sayfa ${scrapingProgress.currentPage}/${scrapingProgress.totalPages} - ${scrapingProgress.tendersFound || 0} ihale bulundu`
                        ) : (
                          'Arka planda çalışıyor, sayfa kullanılabilir.'
                        )}
                      </div>
                      {scrapingProgress?.currentPage && scrapingProgress?.totalPages && (
                        <div className="w-full bg-blue-900/30 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${(scrapingProgress.currentPage / scrapingProgress.totalPages) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filtre Sekmeleri */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-white text-black'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525]'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filterStatus === 'active'
                    ? 'bg-green-500 text-white'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525]'
                }`}
              >
                Açık
              </button>
              <button
                onClick={() => setFilterStatus('upcoming')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filterStatus === 'upcoming'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525]'
                }`}
              >
                Yaklaşanlar
              </button>
              <button
                onClick={() => setFilterStatus('closed')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filterStatus === 'closed'
                    ? 'bg-gray-600 text-white'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525]'
                }`}
              >
                Kapanmış
              </button>
            </div>

            {/* İstatistikler - Interaktif */}
            <div className="grid grid-cols-5 gap-4">
              {/* Toplam */}
              <button
                onClick={() => setFilterStatus('all')}
                className={`bg-[#1a1a1a] border rounded px-4 py-3 text-left transition-all hover:scale-105 hover:shadow-lg ${
                  filterStatus === 'all' ? 'border-white ring-2 ring-white/20' : 'border-gray-800'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">Toplam</div>
                <div className="text-2xl font-bold text-white">{tenders.length}</div>
              </button>

              {/* Açık İhaleler */}
              <button
                onClick={() => setFilterStatus('active')}
                className={`bg-gradient-to-br from-green-900/30 to-emerald-900/20 border rounded px-4 py-3 text-left transition-all hover:scale-105 hover:shadow-lg hover:shadow-green-500/20 ${
                  filterStatus === 'active' ? 'border-green-400/50 ring-2 ring-green-400/30' : 'border-green-500/20'
                }`}
              >
                <div className="text-xs text-green-400 mb-1">Açık</div>
                <div className="text-2xl font-bold text-green-400">
                  {tenders.filter(t => {
                    const status = getTenderStatus(t);
                    return status.color === 'green';
                  }).length}
                </div>
              </button>

              {/* Yaklaşan (7 gün içinde) */}
              <button
                onClick={() => setFilterStatus('upcoming')}
                className={`bg-gradient-to-br from-orange-900/30 to-amber-900/20 border rounded px-4 py-3 text-left transition-all hover:scale-105 hover:shadow-lg hover:shadow-orange-500/20 ${
                  filterStatus === 'upcoming' ? 'border-orange-400/50 ring-2 ring-orange-400/30' : 'border-yellow-500/20'
                }`}
              >
                <div className="text-xs text-yellow-400 mb-1">Yaklaşan (7 gün)</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {tenders.filter(t => {
                    const status = getTenderStatus(t);
                    return status.color === 'yellow' || status.color === 'orange';
                  }).length}
                </div>
              </button>

              {/* Son 3 Gün */}
              <button
                onClick={() => setFilterStatus('upcoming')}
                className={`bg-gradient-to-br from-red-900/30 to-rose-900/20 border rounded px-4 py-3 text-left transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-500/20 ${
                  filterStatus === 'upcoming' ? 'border-red-400/50 ring-2 ring-red-400/30' : 'border-red-500/20'
                }`}
                title="Yaklaşanlar filtresine dahil"
              >
                <div className="text-xs text-red-400 mb-1">Son 3 Gün</div>
                <div className="text-2xl font-bold text-red-400">
                  {tenders.filter(t => {
                    const status = getTenderStatus(t);
                    return status.color === 'red' || (status.color === 'orange' && status.days <= 3);
                  }).length}
                </div>
              </button>

              {/* Kapanmış */}
              <button
                onClick={() => setFilterStatus('closed')}
                className={`bg-zinc-800/70 border rounded px-4 py-3 text-left transition-all hover:scale-105 hover:shadow-lg ${
                  filterStatus === 'closed' ? 'border-gray-500 ring-2 ring-gray-500/30' : 'border-gray-700'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">Kapanmış</div>
                <div className="text-2xl font-bold text-gray-500">
                  {tenders.filter(t => {
                    const status = getTenderStatus(t);
                    return status.color === 'gray';
                  }).length}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Zaman Çizgisi */}
        {!loading && sortedTenders.length > 0 && (
          <div className="bg-blue-900/10 border border-blue-500/20 rounded px-4 py-2.5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">
              Bugün {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {(() => {
              const upcomingTenders = tenders
                .map(t => ({
                  ...t,
                  status: getTenderStatus(t)
                }))
                .filter(t => t.status.days >= 0 && t.status.days <= 7)
                .sort((a, b) => a.status.days - b.status.days);

              if (upcomingTenders.length > 0) {
                const nearest = upcomingTenders[0];
                return (
                  <span className="text-sm text-blue-400 ml-2">
                    • En yakın ihale: <span className="font-semibold">{nearest.title.slice(0, 40)}...</span> ({nearest.status.days === 0 ? 'bugün' : `${nearest.status.days} gün kaldı`})
                  </span>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-gray-700 border-t-white rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-gray-800 rounded">
            <table className="w-full text-xs">
              <thead className="bg-[#0d0d0d] border-b border-gray-800">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 w-8">#</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 w-24">Durum</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 cursor-pointer hover:text-white" onClick={() => handleSort('organization')}>
                    <div className="flex items-center gap-1">
                      Kurum
                      {sortField === 'organization' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 w-24 cursor-pointer hover:text-white" onClick={() => handleSort('organization_city')}>
                    <div className="flex items-center gap-1">
                      Şehir
                      {sortField === 'organization_city' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 w-28 cursor-pointer hover:text-white" onClick={() => handleSort('deadline_date')}>
                    <div className="flex items-center gap-1">
                      Son Teklif Tarihi
                      {sortField === 'deadline_date' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 w-32">Kayıt No</th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-16">Kaynak</th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-20">AI</th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sortedTenders.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`hover:bg-zinc-700/50 transition-colors ${i % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-950/60'}`}
                  >
                    <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-2 py-2">
                      {renderStatusBadge(getTenderStatus(t))}
                    </td>
                    <td className="px-2 py-2 text-gray-400">{t.organization}</td>
                    <td className="px-2 py-2 text-gray-400 max-w-[120px] truncate">{t.organization_city || '-'}</td>
                    <td className="px-2 py-2 text-xs">
                      {renderTenderDate(t)}
                    </td>
                    <td className="px-2 py-2">
                      {(() => {
                        const regNo = t.registration_number || t.raw_json?.['Kayıt no'];
                        if (!regNo) return <span className="text-gray-600">-</span>;

                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(regNo, t.id);
                            }}
                            className="text-gray-400 hover:text-white transition-colors truncate max-w-[120px] text-left group relative"
                            title="Kopyalamak için tıkla"
                          >
                            <span className="truncate block">{regNo}</span>
                            {copiedId === t.id && (
                              <span className="absolute -top-6 left-0 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                                Kopyalandı!
                              </span>
                            )}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500">{t.source === 'ihalebul' ? 'İhalebul' : t.source}</td>
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      {/* AI ile Detay Getir */}
                      <button
                        onClick={(e) => fetchFullContent(t, e)}
                        disabled={analyzingId === t.id}
                        className="mx-auto"
                        title="AI ile tam içeriği getir"
                      >
                        {analyzingId === t.id ? (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        ) : (
                          <Bot className="w-4 h-4 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`/api/ihale-scraper/proxy?url=${encodeURIComponent(t.source_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                        title="İhale sayfasını aç (oturum korunur)"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Modal */}
        {selectedTender && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
            onClick={() => {
              setSelectedTender(null);
              setFullContent(null);
              setIframeUrl(null);
            }}
          >
            <div
              className="bg-white rounded-lg max-w-[95vw] w-full max-h-[95vh] overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="border-b p-6 flex items-start justify-between sticky top-0 bg-white">
                <div className="flex-1 pr-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedTender.title}</h2>
                  <p className="text-sm text-gray-600">{selectedTender.organization}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedTender(null);
                    setFullContent(null);
                    setIframeUrl(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Content - AI'dan Parse Edilmiş İçerik */}
              <div className="w-full max-h-[calc(95vh-140px)] overflow-y-auto p-6 space-y-6">
                {fullContent ? (
                  <>
                    {/* İhale İlanı - Tam Metin */}
                    {fullContent.fullText && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-orange-600" />
                          İhale İlanı
                        </h3>
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                            {fullContent.fullText}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Highlight Bölümü - Önemli Bilgiler */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <Calendar className="w-3 h-3" />
                            Kayıt No
                          </div>
                          <div className="text-sm font-bold text-gray-900">{fullContent.details['Kayıt no'] || '-'}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <Clock className="w-3 h-3" />
                            Teklif Tarihi
                          </div>
                          <div className="text-sm font-bold text-red-600">{fullContent.details['Teklif tarihi'] || '-'}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <Building2 className="w-3 h-3" />
                            Yaklaşık Maliyet
                          </div>
                          <div className="text-sm font-bold text-green-600">{fullContent.details['Yaklaşık maliyet limiti'] || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {/* İdare Bilgileri */}
                    {fullContent.details['İdare adı'] && (
                      <div className="bg-white border rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          İdare Bilgileri
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="text-gray-600">Adı:</span> <span className="font-medium">{fullContent.details['İdare adı']}</span></div>
                          {fullContent.details['Toplantı adresi'] && (
                            <div><span className="text-gray-600">Adres:</span> <span className="font-medium">{fullContent.details['Toplantı adresi']}</span></div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* İhale Detayları - Responsive Grid */}
                    {fullContent.details && Object.keys(fullContent.details).length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700">Tüm Detaylar</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {Object.entries(fullContent.details)
                            .filter(([key]) => !['Kayıt no', 'Teklif tarihi', 'Yaklaşık maliyet limiti', 'İdare adı', 'Toplantı adresi'].includes(key))
                            .map(([key, value]: [string, any]) => (
                              <div key={key} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
                                <div className="text-gray-500 mb-1 font-medium">{key}</div>
                                <div className="text-gray-900 font-semibold break-words whitespace-normal">{value}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Dokümanlar - Compact */}
                    {fullContent.documents && fullContent.documents.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Dokümanlar ({fullContent.documents.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {fullContent.documents.map((doc: any, idx: number) => (
                            <a
                              key={idx}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg border border-blue-200 transition-colors text-xs"
                            >
                              <div className="flex-shrink-0">
                                {doc.type === 'idari_sartname' ? (
                                  <FileText className="w-4 h-4 text-blue-600" />
                                ) : doc.type === 'teknik_sartname' ? (
                                  <FileText className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Download className="w-4 h-4 text-purple-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{doc.title}</div>
                              </div>
                              <Download className="w-3 h-3 text-gray-400" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Kaynak Link */}
                    <div className="pt-4 border-t">
                      <a
                        href={selectedTender.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Orijinal Sayfayı Aç
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-spin" />
                      <p>AI ile içerik getiriliyor...</p>
                      <p className="text-xs mt-2">Otomatik giriş yapılıyor ve sayfa parse ediliyor</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
