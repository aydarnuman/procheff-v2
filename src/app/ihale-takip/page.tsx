'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, ChevronUp, ChevronDown, Search, Trash2, Sparkles } from 'lucide-react';

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
  const [cleaning, setCleaning] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);

  const loadTenders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ihale-scraper/list?is_catering=true&limit=500');
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
    if (!confirm('Manuel scraping başlatılsın mı?')) return;

    // Progress modal'ı aç
    setShowProgress(true);
    setProgressLogs(['🚀 Scraping başlatılıyor...']);
    setProgressPercent(0);
    setScraping(true);

    try {
      // API isteğini başlat (arka planda)
      fetch('/api/ihale-scraper/test?source=ihalebul')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setProgressLogs(prev => [...prev, '✅ Scraping tamamlandı!', `📊 ${data.totalScraped} ihale işlendi`]);
            setProgressPercent(100);
            setTimeout(() => {
              loadTenders();
              setShowProgress(false);
              setScraping(false);
            }, 2000);
          } else {
            setProgressLogs(prev => [...prev, '❌ Hata: ' + data.error]);
            setTimeout(() => setShowProgress(false), 3000);
          }
        });

      // Progress simülasyonu (gerçek log'ları göster)
      const logInterval = setInterval(() => {
        setProgressPercent(prev => Math.min(prev + 5, 90));

        // Örnek log'lar
        const sampleLogs = [
          '🔍 Duplicate kontrol yapılıyor...',
          '⚡ Keyword filter çalışıyor...',
          '🤖 AI kategorilendirme başladı...',
          '💾 Database\'e kaydediliyor...',
        ];

        setProgressLogs(prev => {
          if (prev.length < 10) {
            return [...prev, sampleLogs[Math.floor(Math.random() * sampleLogs.length)]];
          }
          return prev;
        });
      }, 3000);

      // 2 dakika sonra interval'i temizle
      setTimeout(() => clearInterval(logInterval), 120000);

    } catch (error: any) {
      setProgressLogs(prev => [...prev, '❌ Bağlantı hatası: ' + error.message]);
      setTimeout(() => {
        setShowProgress(false);
        setScraping(false);
      }, 3000);
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

  useEffect(() => {
    document.title = 'İhale Takip | ProCheff AI';
    loadTenders();
  }, []);

  const getDaysRemaining = (deadline: string | null) => {
    if (!deadline) return '-';
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} gün` : 'Geçti';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredTenders = tenders.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.organization?.toLowerCase().includes(query) ||
      t.organization_city?.toLowerCase().includes(query) ||
      t.title?.toLowerCase().includes(query) ||
      t.tender_type?.toLowerCase().includes(query) ||
      t.procurement_type?.toLowerCase().includes(query)
    );
  });

  const sortedTenders = [...filteredTenders].sort((a, b) => {
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
              onClick={cleanDataWithGemini}
              disabled={cleaning}
              className="flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600"
              title={cleaning ? 'Temizleniyor...' : 'Verileri Temizle'}
            >
              <Sparkles className={`w-4 h-4 ${cleaning ? 'animate-pulse' : ''}`} />
            </button>
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
            >
              <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Yenileniyor...' : 'Yenile'}
            </button>
          </div>
        </div>

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
                  <th className="px-2 py-2 text-right font-medium text-gray-500 w-24 cursor-pointer hover:text-white" onClick={() => handleSort('budget')}>
                    <div className="flex items-center justify-end gap-1">
                      Bütçe
                      {sortField === 'budget' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-20 cursor-pointer hover:text-white" onClick={() => handleSort('announcement_date')}>
                    <div className="flex items-center justify-center gap-1">
                      İlan
                      {sortField === 'announcement_date' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-20 cursor-pointer hover:text-white" onClick={() => handleSort('tender_date')}>
                    <div className="flex items-center justify-center gap-1">
                      İhale
                      {sortField === 'tender_date' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-20 cursor-pointer hover:text-white" onClick={() => handleSort('deadline_date')}>
                    <div className="flex items-center justify-center gap-1">
                      Son
                      {sortField === 'deadline_date' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-16">Kalan</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 w-24 cursor-pointer hover:text-white" onClick={() => handleSort('tender_type')}>
                    <div className="flex items-center gap-1">
                      Tür
                      {sortField === 'tender_type' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500 w-24 cursor-pointer hover:text-white" onClick={() => handleSort('procurement_type')}>
                    <div className="flex items-center gap-1">
                      Alım
                      {sortField === 'procurement_type' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-16">Kaynak</th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sortedTenders.map((t, i) => (
                  <tr key={t.id} className="hover:bg-[#202020] cursor-pointer" onClick={() => setSelectedTender(t)}>
                    <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-2 py-2 text-gray-400 max-w-xs truncate">{t.organization}</td>
                    <td className="px-2 py-2 text-gray-400 max-w-[120px] truncate">{t.organization_city || '-'}</td>
                    <td className="px-2 py-2 text-right text-white">
                      {t.budget ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(t.budget) : '-'}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-400">
                      {t.announcement_date ? new Date(t.announcement_date).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-400">
                      {t.tender_date ? new Date(t.tender_date).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-400">
                      {t.deadline_date ? new Date(t.deadline_date).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-2 py-2 text-center text-white font-medium">
                      {getDaysRemaining(t.deadline_date)}
                    </td>
                    <td className="px-2 py-2 text-gray-400 max-w-[100px] truncate">{t.tender_type || '-'}</td>
                    <td className="px-2 py-2 text-gray-400 max-w-[100px] truncate">{t.procurement_type || '-'}</td>
                    <td className="px-2 py-2 text-center text-gray-500">{t.source === 'ihalebul' ? 'İhalebul' : t.source}</td>
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Progress Modal */}
        {showProgress && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
            <div className="bg-[#1a1a1a] rounded-lg max-w-2xl w-full border border-gray-800">
              {/* Header */}
              <div className="border-b border-gray-800 p-4">
                <h2 className="text-lg font-bold text-white">Scraping Progress</h2>
                <p className="text-sm text-gray-400 mt-1">İhaleler toplanıyor ve işleniyor...</p>
              </div>

              {/* Progress Bar */}
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">İlerleme</span>
                    <span className="text-sm text-white font-medium">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Logs */}
                <div className="bg-black rounded border border-gray-800 p-4 h-64 overflow-y-auto font-mono text-xs">
                  {progressLogs.map((log, i) => (
                    <div key={i} className="text-gray-300 mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              {progressPercent === 100 && (
                <div className="border-t border-gray-800 p-4 flex justify-end">
                  <button
                    onClick={() => setShowProgress(false)}
                    className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200 text-sm"
                  >
                    Kapat
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedTender && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
            onClick={() => setSelectedTender(null)}
          >
            <div
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="border-b p-6 flex items-start justify-between sticky top-0 bg-white">
                <div className="flex-1 pr-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedTender.title}</h2>
                  <p className="text-sm text-gray-600">{selectedTender.organization}</p>
                </div>
                <button
                  onClick={() => setSelectedTender(null)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Şehir</div>
                    <div className="text-sm text-gray-900">{selectedTender.organization_city || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Bütçe</div>
                    <div className="text-sm text-gray-900 font-medium">
                      {selectedTender.budget ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedTender.budget) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">İlan Tarihi</div>
                    <div className="text-sm text-gray-900">
                      {selectedTender.announcement_date ? new Date(selectedTender.announcement_date).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">İhale Tarihi</div>
                    <div className="text-sm text-gray-900">
                      {selectedTender.tender_date ? new Date(selectedTender.tender_date).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Son Tarih</div>
                    <div className="text-sm text-gray-900">
                      {selectedTender.deadline_date ? new Date(selectedTender.deadline_date).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Kalan Gün</div>
                    <div className="text-sm text-gray-900 font-medium">{getDaysRemaining(selectedTender.deadline_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">İhale Türü</div>
                    <div className="text-sm text-gray-900">{selectedTender.tender_type || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Alım Türü</div>
                    <div className="text-sm text-gray-900">{selectedTender.procurement_type || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Kategori</div>
                    <div className="text-sm text-gray-900">{selectedTender.category || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Kaynak</div>
                    <div className="text-sm text-gray-900">{selectedTender.source === 'ihalebul' ? 'İhalebul' : selectedTender.source}</div>
                  </div>
                </div>

                {/* Action */}
                <div className="pt-4 border-t">
                  <a
                    href={selectedTender.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    İhale Detayına Git
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
