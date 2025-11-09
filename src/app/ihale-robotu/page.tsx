'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { RefreshCw, ExternalLink, ChevronUp, ChevronDown, Search, Trash2, Sparkles, Bot, FileText, Download, Loader2, Calendar, Building2, MapPin, Clock, AlertCircle, AlertTriangle, Wand2, Eye, CheckCircle, Database, Star, TrendingUp, Bell, BellOff } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useIhaleStore } from '@/lib/stores/ihale-store';
import { TokenCostCard } from '@/components/analytics/TokenCostCard';
import { downloadDocuments } from '@/lib/utils/document-downloader';
import { saveToIndexedDB, getFromIndexedDB, deleteFromIndexedDB, listIndexedDBKeys } from '@/lib/utils/indexed-db-storage';

// 🚦 SAFE MIGRATION: Feature flag ile kontrollü geçiş
// Mevcut kod bozulmaz, yeni store test edilebilir
import { MIGRATION_CONFIG } from '@/lib/migration/safe-migration';
import { useIhaleRobotuState } from '@/lib/migration/use-safe-migration';

// ============================================================================
// 🔧 HELPER FUNCTIONS - Döküman İşleme
// ============================================================================

/**
 * Döküman tipini title ve API type'a göre akıllıca tespit eder
 * @param title - Döküman başlığı
 * @param apiType - API'den gelen tip
 * @returns Tespit edilen döküman tipi
 */
const detectDocumentType = (title: string, apiType: string): string => {
  const lowerTitle = (title || '').toLowerCase();

  // Öncelik 1: Title'dan tespit
  if (lowerTitle.includes('idari') || lowerTitle.includes('idare') || lowerTitle.includes('administrative')) {
    return 'idari_sartname';
  }
  if (lowerTitle.includes('teknik') || lowerTitle.includes('technical') || lowerTitle.includes('spec')) {
    return 'teknik_sartname';
  }
  if (lowerTitle.includes('zeyilname') || lowerTitle.includes('ek') || lowerTitle.includes('addendum')) {
    return 'zeyilname';
  }
  if (lowerTitle.includes('teklif') || lowerTitle.includes('proposal') || lowerTitle.includes('bid')) {
    return 'teklif_mektubu';
  }
  if (lowerTitle.includes('sözleşme') || lowerTitle.includes('contract')) {
    return 'sozlesme_taslagi';
  }
  if (lowerTitle.includes('fiyat') || lowerTitle.includes('price')) {
    return 'fiyat_listesi';
  }

  // Öncelik 2: API'den gelen tip
  return apiType || 'diger';
};

/**
 * Döküman tipi için görsel bilgiler (icon, renkler, label)
 */
const getDocInfo = (type: string) => {
  switch (type) {
    case 'idari_sartname':
      return {
        label: 'İdari Şartname',
        gradient: 'from-blue-500 to-indigo-600',
        bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50',
        borderColor: 'border-blue-300',
        icon: '📋',
        iconBg: 'bg-blue-100'
      };
    case 'teknik_sartname':
      return {
        label: 'Teknik Şartname',
        gradient: 'from-emerald-500 to-green-600',
        bgColor: 'bg-gradient-to-br from-emerald-50 to-green-50',
        borderColor: 'border-emerald-300',
        icon: '⚙️',
        iconBg: 'bg-emerald-100'
      };
    case 'zeyilname':
      return {
        label: 'Zeyilname',
        gradient: 'from-orange-500 to-amber-600',
        bgColor: 'bg-gradient-to-br from-orange-50 to-amber-50',
        borderColor: 'border-orange-300',
        icon: '📎',
        iconBg: 'bg-orange-100'
      };
    case 'teklif_mektubu':
      return {
        label: 'Teklif Mektubu',
        gradient: 'from-cyan-500 to-blue-600',
        bgColor: 'bg-gradient-to-br from-cyan-50 to-blue-50',
        borderColor: 'border-cyan-300',
        icon: '✉️',
        iconBg: 'bg-cyan-100'
      };
    case 'sozlesme_taslagi':
      return {
        label: 'Sözleşme Taslağı',
        gradient: 'from-violet-500 to-purple-600',
        bgColor: 'bg-gradient-to-br from-violet-50 to-purple-50',
        borderColor: 'border-violet-300',
        icon: '📜',
        iconBg: 'bg-violet-100'
      };
    case 'fiyat_listesi':
      return {
        label: 'Fiyat Listesi',
        gradient: 'from-green-500 to-teal-600',
        bgColor: 'bg-gradient-to-br from-green-50 to-teal-50',
        borderColor: 'border-green-300',
        icon: '💰',
        iconBg: 'bg-green-100'
      };
    default:
      return {
        label: 'Döküman',
        gradient: 'from-purple-500 to-pink-600',
        bgColor: 'bg-gradient-to-br from-purple-50 to-pink-50',
        borderColor: 'border-purple-300',
        icon: '📄',
        iconBg: 'bg-purple-100'
      };
  }
};

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

function IhaleTakipPageInner() {
  // Döküman indirme progress barı için state
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { addFileStatus, setCurrentStep, reset } = useIhaleStore();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [sortField, setSortField] = useState<SortField>('deadline_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'closed' | 'favorites'>('all');
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
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]); // 🆕 Seçili dökümanlar
  const [documentsExpanded, setDocumentsExpanded] = useState(true); // 🆕 Dökümanlar kartı açık mı
  const [showPreviewModal, setShowPreviewModal] = useState(false); // 🆕 Önizleme modal'ı
  const [showZipContents, setShowZipContents] = useState(false); // 🆕 ZIP içerik modal'ı
  const [docPage, setDocPage] = useState(1); // 🆕 Döküman pagination
  const DOCS_PER_PAGE = 10; // 🆕 Sayfa başına döküman sayısı
  const [zipFileInfo, setZipFileInfo] = useState<{fileName: string; size: number; extractedFiles?: string[]} | null>(null); // 🆕 ZIP bilgisi
  
  // ⏱️ Timer sistemi - Her loading için elapsed time
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  // 🎯 OPTIMIZED: Timer hook - Loading sırasında elapsed time güncelle
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (loadingStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000); // saniye
        setElapsedTime(elapsed);
      }, 2000); // 🎯 1sn → 2sn (scheduler violation önleme)
    } else {
      setElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loadingStartTime]);
  
  // ⏱️ Helper: Format elapsed time
  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };
  
  // ⭐ Favori sistemi - localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ihale-favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // � Bildirim sistemi - localStorage
  const [notifications, setNotifications] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ihale-notifications');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // �🕐 Canlı saat
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // 🎯 OPTIMIZED: 1sn → 10sn (scheduler violation önleme)
    return () => clearInterval(timer);
  }, []);

  // Favori toggle
  const toggleFavorite = useCallback((tenderId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      const isAdding = !newFavorites.has(tenderId);
      
      if (isAdding) {
        newFavorites.add(tenderId);
        // ID ile dismiss et, duplikaları engelle
        toast.dismiss(`fav-${tenderId}`);
        toast.success('⭐ Favorilere eklendi', { id: `fav-${tenderId}` });
      } else {
        newFavorites.delete(tenderId);
        toast.dismiss(`fav-${tenderId}`);
        toast.info('⭐ Favorilerden çıkarıldı', { id: `fav-${tenderId}` });
      }
      
      localStorage.setItem('ihale-favorites', JSON.stringify([...newFavorites]));
      return newFavorites;
    });
  }, []);

  // Bildirim toggle
  const toggleNotification = useCallback((tenderId: string, tenderTitle: string, deadlineDate: string | null) => {
    setNotifications(prev => {
      const newNotifications = new Set(prev);
      const isAdding = !newNotifications.has(tenderId);
      
      if (isAdding) {
        newNotifications.add(tenderId);
        
        // Tarih bilgisi varsa ne zaman bildirim alacağını göster
        let message = '🔔 Bildirimler açıldı';
        if (deadlineDate) {
          const deadline = new Date(deadlineDate);
          const now = new Date();
          const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 1) {
            message += ' • Yarın hatırlat';
          } else if (diffDays <= 3) {
            message += ` • ${diffDays - 1} gün önce hatırlat`;
          } else {
            message += ' • 3 gün önce hatırlat';
          }
        }
        
        toast.dismiss(`notif-${tenderId}`);
        toast.success(message, { id: `notif-${tenderId}` });
      } else {
        newNotifications.delete(tenderId);
        toast.dismiss(`notif-${tenderId}`);
        toast.info('🔕 Bildirimler kapatıldı', { id: `notif-${tenderId}` });
      }
      
      localStorage.setItem('ihale-notifications', JSON.stringify([...newNotifications]));
      return newNotifications;
    });
  }, []);

  // 🆕 Seçili dökümanların detaylı bilgisini hesapla
  const getSelectedDocumentsInfo = useCallback(() => {
    if (!fullContent?.documents || selectedDocuments.length === 0) {
      return "(0)";
    }

    const selectedDocs = fullContent.documents.filter((doc: any) => selectedDocuments.includes(doc.url));
    
    // Dosya türlerini say
    const typeCount: Record<string, number> = {};
    selectedDocs.forEach((doc: any) => {
      // Query parametrelerini temizle
      const cleanUrl = doc.url.split('?')[0];
      const fileExt = cleanUrl.split('.').pop()?.toUpperCase() || 'PDF';
      
      const type = doc.type === 'idari_sartname' ? 'İdari Şartname'
        : doc.type === 'teknik_sartname' ? 'Teknik Şartname'
        : fileExt === 'TXT' ? 'Text'
        : fileExt === 'JSON' ? 'JSON'
        : fileExt === 'CSV' ? 'CSV'
        : fileExt;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    // Tür özetini oluştur
    const typeSummary = Object.entries(typeCount)
      .map(([type, count]) => `${count}${type}`)
      .join(', ');

    return `(${selectedDocuments.length}) ${typeSummary}`;
  }, [selectedDocuments, fullContent?.documents]);

  // 🆕 İçerik cache - localStorage'dan yükle (plain object kullanıyoruz - Map Next.js'te sorun yaratır)
  const [contentCache, setContentCache] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const CACHE_VERSION = 'v2'; // Map → Object migration
        const versionKey = 'ihale-cache-version';
        const currentVersion = localStorage.getItem(versionKey);

        // Versiyon uyumsuzsa cache'i temizle
        if (currentVersion !== CACHE_VERSION) {
          localStorage.removeItem('ihale-content-cache');
          localStorage.setItem(versionKey, CACHE_VERSION);
          return {};
        }

        const cached = localStorage.getItem('ihale-content-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          // 🎯 OPTIMIZED: console.log kaldırıldı

          // 🔄 MIGRATION: Integer ID'leri source_id'ye çevir
          const migratedCache: Record<string, any> = {};
          let migrationCount = 0;

          for (const [key, value] of Object.entries(parsed)) {
            // Eğer key numeric (eski integer ID) ve value içinde source_id varsa
            if (/^\d+$/.test(key) && value && typeof value === 'object') {
              const sourceId = (value as any).source_id || (value as any).sourceId;
              if (sourceId && sourceId !== key) {
                // 🎯 OPTIMIZED: console.log kaldırıldı
                migratedCache[sourceId] = value;
                migrationCount++;
              } else {
                migratedCache[key] = value; // Keep original if no source_id
              }
            } else {
              migratedCache[key] = value; // Already using source_id
            }
          }

          if (migrationCount > 0) {
            // 🎯 OPTIMIZED: console.log kaldırıldı
            localStorage.setItem('ihale-content-cache', JSON.stringify(migratedCache));
            return migratedCache;
          }

          return parsed;
        }
      } catch (e) {
        console.error('Cache yükleme hatası:', e);
        localStorage.removeItem('ihale-content-cache');
      }
    }
    return {};
  });

  // 🎯 OPTIMIZED: Cache'i localStorage'a kaydet (debounced, Blob.size hesaplaması kaldırıldı)
  useEffect(() => {
    const cacheSize = Object.keys(contentCache).length;
    if (cacheSize === 0) return; // Boş cache'i kaydetme

    // 🎯 Debounce: 3 saniye bekle, sonra kaydet (scheduler violation önleme)
    const timeoutId = setTimeout(() => {
      try {
        const cacheString = JSON.stringify(contentCache);
        
        // 🎯 OPTIMIZATION: Blob.size yerine string length kullan (çok daha hızlı)
        const approxSize = cacheString.length * 2; // UTF-16 yaklaşık boyut
        const maxSize = 2 * 1024 * 1024; // 2MB

        // localStorage limitini aşarsa cache'i küçült
        if (approxSize > maxSize) {
          const entries = Object.entries(contentCache);
          // Son 5 item'ı tut
          const newCache = Object.fromEntries(entries.slice(-5));
          setContentCache(newCache);
          return; // Bu sefer kaydetme, useEffect tekrar çalışacak
        }

        localStorage.setItem('ihale-content-cache', cacheString);
      } catch (e) {
        console.error('❌ Cache kaydetme hatası:', e);
        // Quota exceeded durumunda eski cache'i temizle
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          localStorage.removeItem('ihale-content-cache');
          // Cache'i küçült (en eski 3 item'ı sil)
          const entries = Object.entries(contentCache);
          const newCache = Object.fromEntries(entries.slice(-3));
          setContentCache(newCache);
        }
      }
    }, 3000); // 🎯 3 saniye debounce

    return () => clearTimeout(timeoutId);
  }, [contentCache]);

  const loadTenders = async () => {
    try {
      setLoading(true);
      setLoadingStartTime(Date.now()); // ⏱️ Timer başlat
      // Tüm ihaleleri göster
      const response = await fetch('/api/ihale-scraper/list?limit=1000');
      const data = await response.json();
      // 🎯 OPTIMIZED: console.log kaldırıldı
      if (data.success) {
        setTenders(data.data);
      } else {
        console.error('❌ API Error:', data.error);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
      setLoadingStartTime(null); // ⏱️ Timer durdur
    }
  };

  const triggerScrape = async (mode: 'new' | 'full' = 'new') => {
    try {
      setScraping(true);
      setIsScrapingActive(true);
      console.log(`🚀 Scraping arka planda başlatılıyor... (mode: ${mode})`);

      // Show initial toast
      toast.loading(mode === 'new' ? '⚡ Yeni ihaleler aranıyor...' : '🔄 Tüm ihaleler taranıyor...', {
        id: 'scraper-progress',
      });

      // Test endpoint kullan (async mode - hemen döner) + mode parametresi
      const response = await fetch(`/api/ihale-scraper/test?mode=${mode}`);
      const data = await response.json();

      if (data.success) {
        console.log('✅ Scraping arka planda başlatıldı:', data.message);

        toast.success('🚀 Tarama başlatıldı!', {
          id: 'scraper-progress',
          description: mode === 'new' ? 'Yeni ihaleler aranıyor...' : 'Tüm sayfalar taranıyor...',
          duration: 3000,
        });

        // Progress tracking başlat
        startProgressTracking();
      } else {
        console.error('❌ Scraping başlatma hatası:', data.error);
        toast.error('❌ Tarama başlatılamadı', {
          id: 'scraper-progress',
          description: data.error,
        });
        setScraping(false);
        setIsScrapingActive(false);
      }
    } catch (error: any) {
      console.error('❌ Scraping hatası:', error);
      toast.error('❌ Bağlantı hatası', {
        id: 'scraper-progress',
        description: error.message,
      });
      setScraping(false);
      setIsScrapingActive(false);
    }
  };

  // 🎯 OPTIMIZED: Progress tracking fonksiyonu
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

            // Progress toast update
            if (progress.status === 'scraping') {
              toast.loading(`📊 Sayfa ${progress.current_page || 0}/${progress.total_pages || 10}`, {
                id: 'scraper-progress',
                description: `${progress.new_tenders || 0} yeni ihale bulundu`,
              });
            }

            // Tamamlandıysa durdur
            if (progress.status === 'completed' || progress.status === 'error') {
              clearInterval(intervalId);
              setScraping(false);
              setIsScrapingActive(false);

              // Liste yenile
              await loadTenders();

              if (progress.status === 'error') {
                toast.error('❌ Tarama hatası', {
                  id: 'scraper-progress',
                  description: progress.message || 'Bilinmeyen hata',
                });
              } else {
                // Success toast
                const newCount = progress.new_tenders || 0;
                const duplicateCount = progress.duplicate_count || 0;
                
                toast.success(`✅ Tarama tamamlandı!`, {
                  id: 'scraper-progress',
                  description: `${newCount} yeni ihale eklendi${duplicateCount > 0 ? `, ${duplicateCount} duplicate atlandı` : ''}`,
                  duration: 5000,
                });
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
      toast.loading('🗑️ Tüm ihaleler siliniyor...', { id: 'delete-progress' });
      
      const response = await fetch('/api/cron/delete-tenders', {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'procheff-ihale-scraper-secret-2025-secure-key-32chars'}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(`✅ ${data.deletedCount} ihale silindi`, { id: 'delete-progress' });
        loadTenders();
      } else {
        toast.error('❌ Silme hatası', { 
          id: 'delete-progress',
          description: data.error 
        });
      }
    } catch (error: any) {
      toast.error('❌ Bağlantı hatası', {
        id: 'delete-progress',
        description: error.message
      });
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

  // 🔧 Session'dan ZIP dosyalarını ekle (helper function)
  const enrichContentWithSessionFiles = async (content: any, tender: Tender, tenderId: string) => {
    if (!content || !content.documents || content.documents.length === 0) {
      return content;
    }

    try {
      console.log('📁 Session dosyaları kontrol ediliyor... Tender ID:', tender.id, 'Source ID:', tenderId);
      const sessionListRes = await fetch('/api/tender/session/list');
      if (!sessionListRes.ok) {
        console.warn('⚠️ Session list API başarısız');
        return content;
      }

      const sessionListData = await sessionListRes.json();
      const sessions = sessionListData.sessions || [];
      console.log('📋 Toplam session sayısı:', sessions.length);
      
      // Bu tender için session var mı? (tenderId = DB ID, source_id = ihale kayıt no)
      const relatedSession = sessions.find((s: any) => {
        // tenderId DB ID ile eşleşiyorsa
        if (s.tenderId && String(s.tenderId) === String(tender.id)) {
          return true;
        }
        // Son 7 gün içinde oluşturulmuş ve bu ihalenin source'u ile eşleşiyorsa
        if (s.source === 'ihalebul' && tender.source === 'ihalebul') {
          const sessionDate = new Date(s.createdAt);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return sessionDate > weekAgo;
        }
        return false;
      });
      
      if (relatedSession) {
        console.log('✅ İlişkili session bulundu:', relatedSession.id, 'Files in DB:', relatedSession.files?.length);
        
        // 🆕 PLAN B: Eğer DB'de dosya yoksa, dosya sisteminden direkt oku
        if (!relatedSession.files || relatedSession.files.length === 0) {
          console.log('📂 DB\'de dosya yok, dosya sisteminden kontrol ediliyor...');
          try {
            const fsFilesRes = await fetch(`/api/tender/session/files-from-fs?sessionId=${relatedSession.id}`);
            if (fsFilesRes.ok) {
              const fsFilesData = await fsFilesRes.json();
              if (fsFilesData.success && fsFilesData.files && fsFilesData.files.length > 0) {
                console.log(`📦 ${fsFilesData.files.length} dosya filesystem'den bulundu`);
                
                // 🔥 CRITICAL: HTML dosyaları varsa (login failed), ZIP extraction denenmiş ama başarısız olmuş demektir
                // YOKSA (gerçek PDF/DOCX/vb) direkt göster
                const hasHtmlFiles = fsFilesData.files.some((f: any) => f.type === 'text/html');
                
                if (hasHtmlFiles) {
                  console.warn('⚠️ HTML dosyaları bulundu - scraping sırasında ZIP indirilememiş, kullanıcıya URL göster');
                  // HTML dosyaları var = ZIP extraction başarısız
                  // Kullanıcı manuel indirsin, biz sadece URL'leri gösterelim
                  toast.warning('� Dosyalar indirilemedi, URL\'lerden manuel indirebilirsiniz', { 
                    duration: 5000,
                    id: 'zip-failed' 
                  });
                  // extractedFiles set etme, modal'da documents (URL'ler) görünsün
                } else {
                  // ✅ Gerçek dosyalar var - direkt göster
                  console.log(`✅ ${fsFilesData.files.length} gerçek dosya bulundu (PDF/DOCX/vb)`);
                  const realFiles = fsFilesData.files.filter((f: any) => 
                    // ZIP dosyasını çıkar, sadece extract edilmiş dosyaları göster
                    f.type !== 'application/zip'
                  );
                  content.extractedFiles = realFiles;
                  console.log(`📦 extractedFiles set edildi:`, realFiles);
                  return content;
                }
              }
            }
          } catch (fsError) {
            console.error('❌ Filesystem\'den dosya okuma hatası:', fsError);
          }
        }
        
        // Session'dan dosyaları al (sadece ZIP'ten çıkarılmış dosyalar)
        if (relatedSession.files && relatedSession.files.length > 0) {
          const extractedFiles = relatedSession.files.filter((f: any) => f.isExtractedFromZip);
          if (extractedFiles.length > 0) {
            console.log(`📦 ${extractedFiles.length} ZIP dosyası DB'den alındı`);
            // URL-based documents yerine gerçek dosyaları kullan
            content.extractedFiles = extractedFiles.map((f: any) => ({
              name: f.filename || f.originalFilename,
              path: f.storagePath,
              size: f.size,
              type: f.mimeType
            }));
          } else {
            console.log('⚠️ Session\'da ZIP\'ten çıkarılmış dosya yok');
          }
        }
      } else {
        console.log('⚠️ Bu tender için session bulunamadı. Checked:', sessions.length, 'sessions');
        console.log('Tender ID:', tender.id, 'Source:', tender.source);
      }
    } catch (error) {
      console.error('❌ Session dosyaları çekilemedi:', error);
      // Hata olursa devam et, URL-based documents kullan
    }

    return content;
  };

  // 🆕 AI ile tam içerik getir (otomatik login ile) - Cache destekli
  const fetchFullContent = async (tender: Tender, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    
    // Yeni modül ile tek akış - source_id kullan (gerçek tender ID)
    const tenderId = tender.source_id || String(tender.id); // Fallback to id if source_id missing
    console.log(`🔍 fetchFullContent çağrılıyor:`, { tenderId, hasSourceId: !!tender.source_id, dbId: tender.id });

    // Cache kontrolü - önce bakıyoruz
    const cached = contentCache[tenderId];
    if (cached) {
      console.log('💚 Cache hit! İçerik cache\'den yükleniyor:', tenderId);
      // 🆕 Cache'den gelen içeriği session dosyaları ile zenginleştir
      const enrichedContent = await enrichContentWithSessionFiles(
        JSON.parse(JSON.stringify(cached)), 
        tender, 
        tenderId
      );
      setFullContent(enrichedContent);
      setSelectedTender(tender);
      
      // 🔥 CRITICAL: Cache'i güncelle (extractedFiles eklenmiş olabilir)
      setContentCache(prev => ({...prev, [tenderId]: JSON.parse(JSON.stringify(enrichedContent))}));
      
      const params = new URLSearchParams(searchParams.toString());
      params.set('detail', tenderId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      toast.success('✅ Detay cache\'den yüklendi', { duration: 2000 });
      return;
    }

    // Cache yoksa API'den getir
    setLoadingContent(true);
    setLoadingStartTime(Date.now()); // ⏱️ Timer başlat
    setAnalyzingId(tender.id);
    toast.loading('AI ile içerik getiriliyor...', { id: 'fetch-content' });
    
    const { fetchFullContent: fetchFullContentAPI } = await import('@/lib/ihale-scraper/fetchFullContent');
    let content = await fetchFullContentAPI(tenderId);
    
    // 🆕 Session'dan ZIP dosyalarını ekle
    if (content) {
      content = await enrichContentWithSessionFiles(content, tender, tenderId);
    }
    
    if (content) {
      setFullContent(JSON.parse(JSON.stringify(content)));
      setSelectedTender(tender);
      setContentCache(prev => ({...prev, [tenderId]: JSON.parse(JSON.stringify(content))}));
      const params = new URLSearchParams(searchParams.toString());
      params.set('detail', tenderId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      toast.success('✅ İçerik yüklendi', { id: 'fetch-content' });

      // ✅ Otomatik seçim kaldırıldı - Kullanıcı istediği dökümanları seçecek
    } else {
      toast.error('❌ İçerik getirilemedi', { id: 'fetch-content' });
    }
    
    setLoadingContent(false);
    setLoadingStartTime(null); // ⏱️ Timer durdur
    setAnalyzingId(null);
  };

  // 🆕 Döküman direkt bilgisayara indir (ihalebul.com'a gitmeden)
  const downloadDocument = async (url: string, fileName: string) => {
    try {
      console.log('📥 İndirme başlatılıyor:', fileName);
      toast.loading(`İndiriliyor: ${fileName}`, { id: 'download-doc' });

      // API üzerinden dosyayı al (cookie ile - authentication için gerekli)
      const response = await fetch(`/api/ihale-scraper/download-document?url=${encodeURIComponent(url)}`, {
        credentials: 'include' // 🔑 Cookie'leri gönder (ihalebul auth)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error:', response.status, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 API Response:', data);

      if (!data.success) {
        throw new Error(data.error || 'İndirme başarısız');
      }

      // ============================================================
      // 📦 ZIP Dosyası - İçindekileri ayrı ayrı indir
      // ============================================================
      if (data.isZip && data.files && data.files.length > 0) {
        console.log(`📦 ZIP içinde ${data.files.length} dosya bulundu`);
        toast.success(`📦 ${data.files.length} dosya indiriliyor...`, { id: 'download-doc' });

        // Her dosyayı ayrı ayrı indir
        for (const file of data.files) {
          const byteCharacters = atob(file.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: file.type || 'application/octet-stream' });

          // Dosyayı bilgisayara indir
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);

          console.log(`✅ ${file.name} indirildi`);
          // Tarayıcının dosyaları işlemesi için kısa bir bekleme
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        toast.success(`✅ ${data.files.length} dosya indirildi`, { id: 'download-doc' });
        return;
      }

      // ============================================================
      // 📄 Tek Dosya - Normal indirme
      // ============================================================
      if (!data.data) {
        throw new Error('Dosya içeriği bulunamadı');
      }

      // Base64'ten Blob oluştur
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType || 'application/pdf' });

      // Dosyayı bilgisayara indir
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = data.filename || fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      console.log('✅ İndirme tamamlandı:', data.filename);
      toast.success(`✅ ${data.filename} indirildi`, { id: 'download-doc' });

    } catch (error: any) {
      console.error('❌ Döküman indirme hatası:', error);
      toast.error('❌ İndirme hatası', {
        id: 'download-doc',
        description: error.message
      });
    }
  };

  // 🆕 İhale detaylarını CSV olarak indir
  const exportAsCSV = () => {
    if (!selectedTender || !fullContent) {
      toast.error('İhale detayı yüklenmemiş');
      return;
    }

    try {
      const registrationNo = selectedTender.registration_number || selectedTender.raw_json?.['Kayıt no'] || 'bilinmeyen';
      const date = new Date().toISOString().split('T')[0];

      // CSV içeriği oluştur (UTF-8 BOM ile - Excel uyumluluğu için)
      const BOM = '\uFEFF';
      let csv = BOM;

      // Başlık
      csv += `İHALE DETAY RAPORU - ${selectedTender.title}\n`;
      csv += `Oluşturulma Tarihi;${new Date().toLocaleString('tr-TR')}\n\n`;

      // İhale Bilgileri
      csv += `İHALE BİLGİLERİ\n`;
      csv += `Alan;Değer\n`;
      Object.entries(fullContent.details || {}).forEach(([key, value]) => {
        csv += `${key};${value}\n`;
      });
      csv += `\n`;

      // İdare Bilgileri
      csv += `İDARE BİLGİLERİ\n`;
      csv += `Alan;Değer\n`;
      csv += `İdare Adı;${selectedTender.organization}\n`;
      csv += `Şehir;${selectedTender.organization_city || '-'}\n`;
      csv += `\n`;

      // Sektör Bilgileri
      csv += `SEKTÖR BİLGİLERİ\n`;
      csv += `Alan;Değer\n`;
      csv += `Kategori;${selectedTender.category || '-'}\n`;
      csv += `Catering İhalesi;${selectedTender.is_catering ? 'Evet' : 'Hayır'}\n`;
      csv += `Catering Güven Skoru;${selectedTender.catering_confidence || '-'}\n`;
      csv += `\n`;

      // Mal/Hizmet Listesi
      if (fullContent.itemsList) {
        csv += `MAL/HİZMET LİSTESİ\n`;
        csv += fullContent.itemsList.replace(/,/g, ';'); // Virgülleri noktalı virgüle çevir
        csv += `\n\n`;
      }

      // Dökümanlar
      if (fullContent.documents && fullContent.documents.length > 0) {
        csv += `DÖKÜMANLAR\n`;
        csv += `Başlık;URL;Tür\n`;
        fullContent.documents.forEach((doc: any) => {
          csv += `${doc.title};${doc.url};${doc.type}\n`;
        });
        csv += `\n`;
      }

      // Dosyayı indir
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `ihale_${registrationNo}_${date}.csv`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`✅ ${fileName} indirildi`);
    } catch (error: any) {
      toast.error('❌ CSV export hatası', { description: error.message });
    }
  };

  // 🆕 İhale detaylarını TXT olarak indir
  const exportAsTXT = () => {
    if (!selectedTender || !fullContent) return;

    const registrationNo = selectedTender.registration_number || selectedTender.raw_json?.['Kayıt no'] || 'bilinmeyen';
    const date = new Date().toISOString().split('T')[0];

    let txt = '';

    // Başlık
    txt += `═══════════════════════════════════════════════════════════════\n`;
    txt += `İHALE DETAY RAPORU\n`;
    txt += `═══════════════════════════════════════════════════════════════\n\n`;
    txt += `İhale Başlığı: ${selectedTender.title}\n`;
    txt += `Kayıt No: ${registrationNo}\n`;
    txt += `Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}\n\n`;

    // İhale Bilgileri
    txt += `───────────────────────────────────────────────────────────────\n`;
    txt += `İHALE BİLGİLERİ\n`;
    txt += `───────────────────────────────────────────────────────────────\n\n`;
    Object.entries(fullContent.details || {}).forEach(([key, value]) => {
      txt += `${key.padEnd(30)}: ${value}\n`;
    });
    txt += `\n`;

    // İdare Bilgileri
    txt += `───────────────────────────────────────────────────────────────\n`;
    txt += `İDARE BİLGİLERİ\n`;
    txt += `───────────────────────────────────────────────────────────────\n\n`;
    txt += `İdare Adı                     : ${selectedTender.organization}\n`;
    txt += `Şehir                         : ${selectedTender.organization_city || '-'}\n\n`;

    // Sektör Bilgileri
    txt += `───────────────────────────────────────────────────────────────\n`;
    txt += `SEKTÖR BİLGİLERİ\n`;
    txt += `───────────────────────────────────────────────────────────────\n\n`;
    txt += `Kategori                      : ${selectedTender.category || '-'}\n`;
    txt += `Catering İhalesi              : ${selectedTender.is_catering ? 'Evet' : 'Hayır'}\n`;
    txt += `Catering Güven Skoru          : ${selectedTender.catering_confidence || '-'}\n\n`;

    // İhale İlanı
    if (fullContent.fullText) {
      txt += `───────────────────────────────────────────────────────────────\n`;
      txt += `İHALE İLANI\n`;
      txt += `───────────────────────────────────────────────────────────────\n\n`;
      txt += fullContent.fullText;
      txt += `\n\n`;
    }

    // Mal/Hizmet Listesi
    if (fullContent.itemsList) {
      txt += `───────────────────────────────────────────────────────────────\n`;
      txt += `MAL/HİZMET LİSTESİ\n`;
      txt += `───────────────────────────────────────────────────────────────\n\n`;

      // CSV'yi tablo formatına çevir
      const lines = fullContent.itemsList.split('\n').filter((l: string) => l.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(',');
        txt += headers.join(' | ') + '\n';
        txt += '-'.repeat(80) + '\n';

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          txt += values.join(' | ') + '\n';
        }
      }
      txt += `\n`;
    }

    // Dökümanlar
    if (fullContent.documents && fullContent.documents.length > 0) {
      txt += `───────────────────────────────────────────────────────────────\n`;
      txt += `DÖKÜMANLAR\n`;
      txt += `───────────────────────────────────────────────────────────────\n\n`;
      fullContent.documents.forEach((doc: any, idx: number) => {
        txt += `${idx + 1}. ${doc.title}\n`;
        txt += `   Tür  : ${doc.type}\n`;
        txt += `   URL  : ${doc.url}\n\n`;
      });
    }

    txt += `═══════════════════════════════════════════════════════════════\n`;
    txt += `Rapor Sonu\n`;
    txt += `═══════════════════════════════════════════════════════════════\n`;

    // Dosyayı indir
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `ihale_${registrationNo}_${date}.txt`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`✅ ${fileName} indirildi`);
  };

  // 🆕 İhale detaylarını JSON olarak indir
  const exportAsJSON = () => {
    if (!selectedTender || !fullContent) {
      toast.error('İhale detayı yüklenmemiş');
      return;
    }

    try {
      const registrationNo = selectedTender.registration_number || selectedTender.raw_json?.['Kayıt no'] || 'bilinmeyen';
      const date = new Date().toISOString().split('T')[0];

      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          source: 'ProCheff İhale Robotu',
        },
        tender: {
          id: selectedTender.id,
          source: selectedTender.source,
          source_id: selectedTender.source_id,
          source_url: selectedTender.source_url,
          registration_number: registrationNo,
          title: selectedTender.title,
          organization: selectedTender.organization,
          organization_city: selectedTender.organization_city,
          category: selectedTender.category,
          is_catering: selectedTender.is_catering,
          catering_confidence: selectedTender.catering_confidence,
          budget: selectedTender.budget,
          currency: selectedTender.currency,
          announcement_date: selectedTender.announcement_date,
          deadline_date: selectedTender.deadline_date,
          tender_date: selectedTender.tender_date,
          tender_type: selectedTender.tender_type,
          procurement_type: selectedTender.procurement_type,
        },
        details: fullContent.details || {},
        announcement_text: fullContent.fullText || null,
        items_list: fullContent.itemsList ? fullContent.itemsList.split('\n').map((line: string) => {
          const values = line.split(',');
          if (values.length >= 6) {
            return {
              item_number: values[0],
              item_name: values[1],
              quantity: values[2],
              unit: values[3],
              unit_price: values[4],
              total_price: values[5],
            };
          }
          return null;
        }).filter(Boolean) : [],
        documents: fullContent.documents || [],
      };

      // UTF-8 BOM ekle ve Türkçe karakterleri koru
      const BOM = '\uFEFF';
      const json = BOM + JSON.stringify(exportData, null, 2);

      // Dosyayı indir
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `ihale_${registrationNo}_${date}.json`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`✅ ${fileName} indirildi`);
    } catch (error: any) {
      toast.error('❌ JSON export hatası', { description: error.message });
    }
  };

  // ✅ BAS İTLEŞTİRİLMİŞ: Seçili dökümanları bilgisayara ZIP olarak indir
  const downloadSelectedDocuments = async () => {
    if (!selectedTender || !fullContent || selectedDocuments.length === 0) {
      toast.error('⚠️ Lütfen en az 1 döküman seçin');
      return;
    }

    try {
      setLoadingStartTime(Date.now());
      toast.loading('Dökümanlar indiriliyor...', { id: 'doc-download' });
      
      if (selectedDocuments.length > 0) {
        console.log(`📥 ${selectedDocuments.length} döküman hazırlanıyor...`);
        toast.loading(`Dökümanlar hazırlanıyor (0/${selectedDocuments.length})... ⏱️ 0s`, { id: 'doc-prep' });
        
        // 1️⃣ Virtual dosyaları ayır (JSON/TXT/CSV exports)
        const virtualUrls = selectedDocuments.filter(url => url.startsWith('virtual://'));
        const realUrls = selectedDocuments.filter(url => !url.startsWith('virtual://'));
        
        const allPrepared: any[] = [];
        
        // 2️⃣ Virtual dosyaları hazırla
        for (const virtualUrl of virtualUrls) {
          const exportType = virtualUrl.replace('virtual://', '');
          let content = '';
          let mimeType = '';
          let filename = '';
          
          if (exportType === 'json') {
            content = JSON.stringify({
              title: selectedTender.title,
              organization: selectedTender.organization,
              details: fullContent.details,
              fullText: fullContent.fullText,
              documents: fullContent.documents
            }, null, 2);
            mimeType = 'application/json';
            filename = `${selectedTender.title.substring(0, 30)}.json`;
          } else if (exportType === 'txt') {
            content = `İHALE DETAYI\n\n`;
            content += `Başlık: ${selectedTender.title}\n`;
            content += `Kurum: ${selectedTender.organization}\n\n`;
            content += `DETAYLAR:\n`;
            Object.entries(fullContent.details || {}).forEach(([key, value]) => {
              content += `${key}: ${value}\n`;
            });
            content += `\n\nİÇERİK:\n${fullContent.fullText}`;
            mimeType = 'text/plain';
            filename = `${selectedTender.title.substring(0, 30)}.txt`;
          } else if (exportType === 'csv') {
            content = 'Alan,Değer\n';
            content += `Başlık,"${selectedTender.title}"\n`;
            content += `Kurum,"${selectedTender.organization}"\n`;
            Object.entries(fullContent.details || {}).forEach(([key, value]) => {
              content += `"${key}","${value}"\n`;
            });
            mimeType = 'text/csv';
            filename = `${selectedTender.title.substring(0, 30)}.csv`;
          }
          
          const blob = new Blob([content], { type: mimeType });
          allPrepared.push({
            title: filename,
            url: virtualUrl,
            mimeType: mimeType,
            blob: blob,
            size: blob.size,
            type: 'export' as const,
            isFromZip: false
          });
        }
        
        // 3️⃣ Gerçek dosyaları indir (paralel)
        if (realUrls.length > 0) {
          const downloadedFiles = await downloadDocuments(
            realUrls,
            {
              onProgress: (progress) => {
                const elapsed = Math.floor((Date.now() - loadingStartTime!) / 1000);
                toast.loading(
                  `Dökümanlar hazırlanıyor (${progress.current + virtualUrls.length}/${selectedDocuments.length})... ⏱️ ${elapsed}s`, 
                  { id: 'doc-prep' }
                );
              }
            }
          );

          // DownloadedFile[] → preparedDocuments formatına dönüştür
          const realPrepared = downloadedFiles.map(df => ({
            title: df.title,
            url: df.url,
            mimeType: df.mimeType,
            blob: df.blob,
            size: df.size,
            type: 'document' as const,
            isFromZip: df.isFromZip,
            extractedFrom: df.isFromZip ? df.originalFilename : undefined
          }));
          
          allPrepared.push(...realPrepared);
        }

        // ✅ İndirme tamamlandı
        const elapsed = Math.floor((Date.now() - loadingStartTime!) / 1000);
        toast.success(`✅ ${allPrepared.length} dosya indirildi (${elapsed}s)`, { id: 'doc-download', duration: 3000 });
      }

      setLoadingStartTime(null);

    } catch (error: any) {
      console.error('❌ İndirme hatası:', error);
      toast.error('❌ Dökümanlar indirilirken hata oluştu', { id: 'doc-download' });
      setLoadingStartTime(null);
    }
  };

  // ✅ BASİTLEŞTİRİLMİŞ: Seçili dökümanları analize gönder (direkt sendDocumentsToAnalysis kullan)
  const sendToAnalysis = () => {
    // Onay modalı göster
    if (confirm('📥 Tüm gerekli dosyaları indirdiniz mi?\n\n⚠️ Analize gitmeden önce lütfen tüm dökümanları bilgisayarınıza indirdiğinizden emin olun.\n\nDevam etmek istiyor musunuz?')) {
      console.log('🎯 Yeni analiz sayfasına yönlendiriliyor...');
      closeModal();
      router.push('/ihale/workspace');
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

  // 🆕 Döküman seçim toggle
  const toggleDocumentSelection = (url: string) => {
    setSelectedDocuments(prev => {
      const isRemoving = prev.includes(url);
      const newSelection = isRemoving
        ? prev.filter(u => u !== url)
        : [...prev, url];

      // Log hangi dosyanın seçildiğini/kaldırıldığını göster
      const docName = url.includes('virtual://csv') ? '📊 İhale Detayları (CSV)' :
                     url.includes('virtual://txt') ? '📄 İhale Detayları (TXT)' :
                     url.includes('virtual://json') ? '🔧 İhale Detayları (JSON)' :
                     '📋 Döküman';

      console.log(`${isRemoving ? '❌ Kaldırıldı' : '✅ Seçildi'}: ${docName}`);
      console.log(`📦 Toplam seçili: ${newSelection.length} döküman`);

      return newSelection;
    });
  };

  // 🆕 Tümünü seç/kaldır (CSV/TXT/JSON dahil)
  const toggleAllDocuments = () => {
    if (!fullContent?.documents) {
      console.log('❌ toggleAllDocuments: fullContent?.documents yok');
      toast.warning('Lütfen önce ihale detayını yükleyin');
      return;
    }

    // CSV/TXT/JSON için virtual URLs oluştur (YENİ format - export card'larla uyumlu)
    const virtualDocUrls = [
      'virtual://csv',
      'virtual://txt',
      'virtual://json'
    ];

    const allDocUrls = fullContent.documents.map((d: any) => d.url);
    const totalUrls = [...allDocUrls, ...virtualDocUrls];

    console.log(`🔄 toggleAllDocuments: ${selectedDocuments.length} / ${totalUrls.length} (${allDocUrls.length} döküman + 3 export)`);

    if (selectedDocuments.length === totalUrls.length) {
      console.log('✅ Tüm seçimleri kaldırıyorum');
      setSelectedDocuments(() => []);
    } else {
      console.log('✅ Tümünü seçiyorum:', totalUrls);
      setSelectedDocuments(() => [...totalUrls]); // Dökümanlar + Export dosyaları
    }
  };

  // 🆕 ZIP dosyasını aç ve içindeki dosyaları File array olarak döndür
  // 🆕 Seçili dökümanları analiz sayfasına gönder
  // Note: extractZipFile fonksiyonu kaldırıldı - artık UFS (Unified File Storage) otomatik ZIP extraction yapıyor
  // ============================================================================
  // 🆕 YENİ MİMARİ: TenderSession API kullanarak dökümanları yükle
  // ============================================================================
  const sendDocumentsToAnalysis = async () => {
    if (selectedDocuments.length === 0) {
      toast.warning('⚠️ Lütfen en az bir döküman seçin');
      return;
    }

    try {
      console.log('\n🚀 Yeni TenderSession Pipeline başlatılıyor...');
      toast.loading('Dökümanlar hazırlanıyor...', { id: 'doc-download' });

      // 1. Session oluştur
      console.log('📝 Step 1: Session oluşturuluyor...');
      const createSessionRes = await fetch('/api/tender/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'ihalebul',
          tenderId: selectedTender?.id ? parseInt(selectedTender.id) : undefined,
        }),
      });

      const createSessionData = await createSessionRes.json();
      if (!createSessionData.success || !createSessionData.sessionId) {
        throw new Error('Session oluşturulamadı: ' + (createSessionData.error || 'Bilinmeyen hata'));
      }

      const sessionId = createSessionData.sessionId;
      console.log(`✅ Session oluşturuldu: ${sessionId}`);

      // 2. Virtual export dosyalarını işle (CSV/TXT/JSON)
      const virtualDocs = selectedDocuments.filter(url => url.startsWith('virtual://'));
      if (virtualDocs.length > 0) {
        console.log(`\n📦 Step 2a: ${virtualDocs.length} virtual export dosyası oluşturuluyor...`);
        
        for (const virtualUrl of virtualDocs) {
          try {
            let file: File;
            
            if (virtualUrl === 'virtual://csv') {
              // CSV oluştur
              const registrationNo = selectedTender!.registration_number || selectedTender!.raw_json?.['Kayıt no'] || 'bilinmeyen';
              const date = new Date().toISOString().split('T')[0];
              const BOM = '\uFEFF';
              let csv = BOM;
              csv += `İHALE DETAY RAPORU - ${selectedTender!.title}\n`;
              csv += `Oluşturulma Tarihi;${new Date().toLocaleString('tr-TR')}\n\n`;
              csv += `İHALE BİLGİLERİ\nAlan;Değer\n`;
              Object.entries(fullContent!.details || {}).forEach(([key, value]) => {
                csv += `${key};${value}\n`;
              });
              
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              file = new File([blob], `ihale_${registrationNo}_${date}.csv`, {
                type: 'text/csv;charset=utf-8;',
                lastModified: Date.now(),
              });
            } else if (virtualUrl === 'virtual://txt') {
              // TXT oluştur
              const registrationNo = selectedTender!.registration_number || selectedTender!.raw_json?.['Kayıt no'] || 'bilinmeyen';
              const date = new Date().toISOString().split('T')[0];
              let txt = `═══════════════════════════════════════════════════════════════\n`;
              txt += `İHALE DETAY RAPORU\n`;
              txt += `═══════════════════════════════════════════════════════════════\n\n`;
              txt += `İhale Başlığı: ${selectedTender!.title}\n`;
              txt += `Kayıt No: ${registrationNo}\n\n`;
              
              if (fullContent!.fullText) {
                txt += `───────────────────────────────────────────────────────────────\n`;
                txt += `İHALE İLANI\n`;
                txt += `───────────────────────────────────────────────────────────────\n\n`;
                txt += fullContent!.fullText;
              }
              
              const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
              file = new File([blob], `ihale_${registrationNo}_${date}.txt`, {
                type: 'text/plain;charset=utf-8;',
                lastModified: Date.now(),
              });
            } else if (virtualUrl === 'virtual://json') {
              // JSON oluştur
              const registrationNo = selectedTender!.registration_number || selectedTender!.raw_json?.['Kayıt no'] || 'bilinmeyen';
              const date = new Date().toISOString().split('T')[0];
              const exportData = {
                metadata: {
                  exportDate: new Date().toISOString(),
                  source: 'ProCheff İhale Robotu',
                },
                tender: {
                  id: selectedTender!.id,
                  source: selectedTender!.source,
                  title: selectedTender!.title,
                  organization: selectedTender!.organization,
                },
                details: fullContent!.details || {},
                announcement_text: fullContent!.fullText || null,
              };
              
              const BOM = '\uFEFF';
              const json = BOM + JSON.stringify(exportData, null, 2);
              const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
              file = new File([blob], `ihale_${registrationNo}_${date}.json`, {
                type: 'application/json;charset=utf-8;',
                lastModified: Date.now(),
              });
            } else {
              continue;
            }
            
            // Session'a yükle
            const formData = new FormData();
            formData.append('file', file);
            
            const uploadRes = await fetch(`/api/tender/session/upload?sessionId=${sessionId}`, {
              method: 'POST',
              body: formData,
            });
            
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
              console.log(`   ✅ ${file.name} oluşturuldu ve yüklendi`);
            }
          } catch (error) {
            console.error(`❌ Virtual export hatası (${virtualUrl}):`, error);
          }
        }
      }

      // 3. Gerçek dökümanları indir ve session'a yükle
      const realDocuments = selectedDocuments.filter(url => !url.startsWith('virtual://'));
      console.log(`\n📥 Step 2b: ${realDocuments.length} gerçek döküman indiriliyor ve yükleniyor...`);
      let uploadedCount = 0;
      let errorCount = 0;

      for (const url of realDocuments) {
        try {
          console.log(`📥 İndiriliyor: ${url.substring(url.lastIndexOf('/') + 1)}`);

          // Dökümanı indir
          const downloadRes = await fetch(`/api/ihale-scraper/download-document?url=${encodeURIComponent(url)}`);
          if (!downloadRes.ok) {
            throw new Error(`İndirme başarısız: HTTP ${downloadRes.status}`);
          }

          const downloadData = await downloadRes.json();
          if (!downloadData.success || !downloadData.data) {
            throw new Error(downloadData.error || 'İndirme başarısız');
          }

          // Base64'ten Blob oluştur
          const byteCharacters = atob(downloadData.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: downloadData.mimeType });

          // Blob'u File'a çevir
          const file = new File([blob], downloadData.filename, {
            type: downloadData.mimeType,
            lastModified: Date.now(),
          });

          const isArchive = file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.rar');
          
          console.log(`   📤 Yükleniyor: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
          
          // ZIP/RAR için özel progress mesajı
          if (isArchive) {
            toast.loading(`📦 ${file.name} açılıyor...`, { 
              id: 'doc-download',
              description: 'İçindeki dosyalar çıkarılıyor...'
            });
          }

          // Session'a yükle (UFS otomatik ZIP extraction yapacak)
          const formData = new FormData();
          formData.append('file', file);

          const uploadRes = await fetch(`/api/tender/session/upload?sessionId=${sessionId}`, {
            method: 'POST',
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (!uploadData.success) {
            throw new Error(uploadData.error || 'Yükleme başarısız');
          }

          // ZIP/RAR ise özel mesaj göster
          if (uploadData.isArchive) {
            console.log(`   ✅ ${file.name} yüklendi (Arşiv dosyası)`);
            toast.success(
              `📦 ${file.name} yüklendi`,
              {
                id: 'doc-download',
                description: 'Arşiv dosyası analiz sırasında otomatik çıkarılacak',
                duration: 3000
              }
            );
            uploadedCount++;
          } else if (uploadData.extractedFiles && uploadData.extractedFiles.length > 0) {
            // Gerçek extraction varsa (gelecekte implement edilecek)
            console.log(`   ✅ ${file.name} yüklendi + ${uploadData.extractedFiles.length} dosya çıkarıldı`);
            toast.success(
              `✅ ${file.name} çıkarıldı!`,
              {
                id: 'doc-download',
                description: `${uploadData.extractedFiles.length} dosya bulundu: ${uploadData.extractedFiles.slice(0, 3).join(', ')}${uploadData.extractedFiles.length > 3 ? '...' : ''}`,
                duration: 4000
              }
            );
            uploadedCount += uploadData.extractedFiles.length + 1;
          } else {
            console.log(`   ✅ ${file.name} yüklendi`);
            uploadedCount++;
          }
        } catch (error: any) {
          console.error(`   ❌ Hata:`, url, error.message);
          errorCount++;
        }
      }

      // 3. Analizi başlat
      if (uploadedCount > 0) {
        console.log(`\n🤖 Step 3: AI analizi başlatılıyor (${uploadedCount} dosya)...`);
        toast.loading(`AI analizi başlatılıyor (${uploadedCount} dosya)...`, { id: 'doc-download' });

        const analyzeRes = await fetch('/api/tender/session/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const analyzeData = await analyzeRes.json();
        if (!analyzeData.success) {
          console.warn('⚠️ Analiz başlatılamadı:', analyzeData.error);
          toast.error('Analiz başlatılamadı', { 
            id: 'doc-download',
            description: analyzeData.error 
          });
        } else {
          console.log('✅ Analiz başlatıldı');
          toast.success(`✅ ${uploadedCount} dosya yüklendi!`, { 
            id: 'doc-download',
            description: 'Analiz sayfasına yönlendiriliyorsunuz...'
          });
        }

        // 4. Workspace'e yönlendir
        console.log('\n🎯 Step 4: Workspace sayfasına yönlendiriliyor...');
        closeModal();
        router.push(`/ihale/workspace?sessionId=${sessionId}`);
      } else {
        toast.error('❌ Hiçbir dosya yüklenemedi', { 
          id: 'doc-download',
          description: errorCount > 0 ? `${errorCount} dosya indirilemedi` : undefined
        });
        throw new Error('Hiçbir dosya yüklenemedi');
      }

    } catch (error: any) {
      console.error('\n❌ Pipeline hatası:', error.message);
      toast.error('❌ İşlem başarısız', {
        id: 'doc-download',
        description: error.message
      });
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

  // 🆕 URL parametresinden modal'ı aç (sayfa yenilendiğinde veya link paylaşıldığında)
  useEffect(() => {
    const detailId = searchParams.get('detail');

    if (detailId && tenders.length > 0 && !selectedTender) {
      // İlgili ihaleyi bul
      const tender = tenders.find(t => t.id === detailId);

      if (tender) {
        console.log('🔗 URL parametresinden modal açılıyor:', detailId);
        fetchFullContent(tender);
      }
    }
  }, [searchParams, tenders, selectedTender]);

  // 🆕 ESC tuşu ile modal'ı kapat
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedTender) {
        console.log('⌨️ ESC tuşuna basıldı, modal kapatılıyor');
        closeModal();
      }
    };

    // Event listener'ı ekle
    document.addEventListener('keydown', handleEscapeKey);

    // Cleanup: Component unmount veya selectedTender değişince listener'ı kaldır
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedTender]); // selectedTender değişince yeniden bağla

  // 🆕 Modal'ı kapat ve URL parametresini temizle
  const closeModal = () => {
    // ✅ fullContent'i cache'e kaydet (modal kapatılınca kaybetme)
    if (selectedTender && fullContent) {
      console.log('💾 Modal kapatılıyor, fullContent cache\'e kaydediliyor:', selectedTender.id);
      setContentCache(prev => ({
        ...prev,
        [selectedTender.id.toString()]: JSON.parse(JSON.stringify(fullContent))
      }));
    }

    setSelectedTender(null);
    setFullContent(null); // ✅ State'i temizle ama cache'de kalsın
    setIframeUrl(null);
    setSelectedDocuments([]);
    setDocumentsExpanded(true);

    // URL parametresini kaldır
    const params = new URLSearchParams(searchParams.toString());
    params.delete('detail');
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  };

  // İhale durumu hesaplama - Son Teklif Tarihine Göre
  const getTenderStatus = (t: Tender) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const deadlineDate = t.deadline_date ? new Date(t.deadline_date) : null;
    const tenderDate = t.tender_date ? new Date(t.tender_date) : null;

    if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0);
    if (tenderDate) tenderDate.setHours(0, 0, 0, 0);

    // Deadline öncelikli (son teklif tarihi)
    if (deadlineDate && deadlineDate >= now) {
      const days = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (days === 0) return { label: 'Son Gün', color: 'red', days: 0 };
      if (days <= 3) return { label: `${days} gün`, color: 'orange', days };
      if (days <= 7) return { label: `${days} gün`, color: 'yellow', days };
      return { label: 'Açık', color: 'green', days };
    }

    // Deadline geçmiş, tender date kontrol et (ihale tarihi)
    if (tenderDate && tenderDate >= now) {
      const days = Math.ceil((tenderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { label: `${days} gün`, color: 'blue', days };
    }

    // Her ikisi de geçmiş
    return { label: 'Kapandı', color: 'gray', days: -1 };
  };

  // Durum rozeti render - Sadece icon
  const renderStatusBadge = (status: ReturnType<typeof getTenderStatus>) => {
    const colorClasses: Record<string, string> = {
      red: 'text-red-400',
      orange: 'text-orange-400',
      yellow: 'text-yellow-400',
      green: 'text-green-400',
      blue: 'text-blue-400',
      gray: 'text-gray-500',
    };
    return (
      <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${colorClasses[status.color]}`}>
        <div className={`w-2 h-2 rounded-full bg-current`}></div>
        <span>{status.label}</span>
      </div>
    );
  };

  // Sadece tarih göster - deadline_date öncelikli
  const renderTenderDate = (t: Tender) => {
    // Deadline öncelikli (teklif son tarihi)
    const deadlineDate = t.deadline_date ? new Date(t.deadline_date) : null;
    const tenderDate = t.tender_date ? new Date(t.tender_date) : null;

    // Tarih formatla
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Deadline varsa onu göster
    if (deadlineDate) {
      return <span className="text-gray-400">{formatDate(deadlineDate)}</span>;
    }

    // Deadline yoksa tender_date göster
    if (tenderDate) {
      return <span className="text-gray-400">{formatDate(tenderDate)}</span>;
    }

    // İkisi de yoksa
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
    
    // Türkçe karakter desteği ile küçük harfe çevir
    const query = searchQuery.toLocaleLowerCase('tr-TR');
    
    // Güvenli string dönüşümü ve küçük harfe çevirme fonksiyonu
    const toLower = (str: any) => (str || '').toString().toLocaleLowerCase('tr-TR');
    
    const registrationNumber = toLower(t.registration_number || t.raw_json?.['Kayıt no'] || '');
    
    return (
      toLower(t.organization).includes(query) ||
      toLower(t.organization_city).includes(query) ||
      toLower(t.title).includes(query) ||
      toLower(t.tender_type).includes(query) ||
      toLower(t.procurement_type).includes(query) ||
      registrationNumber.includes(query)
    );
  });

  // Status filtresi uygula
  const statusFilteredTenders = filteredTenders.filter(t => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'favorites') return favorites.has(t.id);

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
    // Önce deadline'a göre aktif/pasif ayır
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const aDeadline = a.deadline_date ? new Date(a.deadline_date) : null;
    const bDeadline = b.deadline_date ? new Date(b.deadline_date) : null;
    
    const aIsActive = aDeadline && aDeadline >= now;
    const bIsActive = bDeadline && bDeadline >= now;
    
    // Aktif ihaleler her zaman üstte
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;
    
    // Her ikisi de aktif veya her ikisi de kapanmış ise normal sorting
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
    <>
      {/* Döküman indirme progress barı */}
      {downloadProgress > 0 && (
        <div className="fixed top-0 left-0 w-full z-[9999]">
          <div className="bg-blue-600 h-1.5" style={{ width: `${downloadProgress}%`, transition: 'width 0.3s' }} />
          <div className="text-xs text-center text-white bg-blue-600 py-1">Dökümanlar indiriliyor... %{downloadProgress}</div>
        </div>
      )}
      <div className="min-h-screen bg-[#0d0d0d]">
        <div className="max-w-[1800px] mx-auto p-6">
        {/* Modern Header with Stats */}
        <div className="mb-6">
          {/* Top Row: Title & Actions */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-1.5 h-10 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full shadow-lg"></div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                  İhale Robotu
                </h1>
              </div>
              <div className="flex items-center gap-4 ml-5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"></div>
                  <span className="text-base text-gray-400">
                    <span className="text-white font-bold text-lg">{sortedTenders.length}</span> aktif ihale
                  </span>
                </div>
                {searchQuery && (
                  <div className="text-sm text-gray-500">
                    ({tenders.length} toplam)
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Yeni İhaleler Çek (mode=new - stop on duplicates) */}
              <button
                onClick={() => triggerScrape('new')}
                disabled={scraping}
                className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed text-sm font-medium transition-all duration-300 hover:scale-[1.02] overflow-hidden"
                title={scraping ? 'Scraping devam ediyor...' : '⚡ Hızlı Mod: Sadece yeni eklenen ihaleleri çeker (zaten kayıtlı olanları atlar). Tavsiye edilen günlük kullanım modu.'}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-700 to-teal-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <RefreshCw className={`w-4 h-4 relative z-10 ${scraping ? 'animate-spin' : ''}`} />
                <span className="relative z-10 whitespace-nowrap">{scraping ? 'Çekiliyor...' : '⚡ Yeni İhaleler (Hızlı)'}</span>
              </button>

              {/* Tüm Aktif İhaleleri Yenile (mode=full - scrape all) */}
              <button
                onClick={() => triggerScrape('full')}
                disabled={scraping}
                className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:shadow-lg hover:shadow-orange-500/30 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed text-sm font-medium transition-all duration-300 hover:scale-[1.02] overflow-hidden"
                title={scraping ? 'Scraping devam ediyor...' : '🔄 Tam Tarama: Tüm sayfaları baştan sona tarar (yavaş ama kapsamlı). İlk kurulum veya kapsamlı güncelleme için kullanın.'}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-700 to-amber-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Database className={`w-4 h-4 relative z-10 ${scraping ? 'animate-spin' : ''}`} />
                <span className="relative z-10 whitespace-nowrap">{scraping ? 'Yenileniyor...' : '🔄 Tümünü Tara (Tam)'}</span>
              </button>
              <button
                onClick={deleteAllTenders}
                disabled={deleting}
                className="group relative flex items-center justify-center w-10 h-10 bg-[#1a1a1a] border border-gray-800 text-gray-400 hover:text-red-400 hover:border-red-500/50 rounded-xl disabled:text-gray-700 disabled:border-gray-800 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02]"
                title={deleting ? 'Siliniyor...' : 'Tüm ihaleleri sil'}
              >
                <Trash2 className={`w-4 h-4 ${deleting ? 'animate-pulse' : ''}`} />
              </button>
            </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              id="search-tenders"
              name="search"
              type="text"
              placeholder="İhale ara... (kurum, şehir, başlık)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>
        </div>

        {/* Stats Cards */}
        {!loading && (
          <div className="grid grid-cols-1 gap-4 mb-4">
            {/* Dashboard İstatistikleri - Yenilendi */}
            {!scraping && sortedTenders.length > 0 && (
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl px-5 py-4">
                <div className="grid grid-cols-4 gap-6">
                  
                  {/* 1. Bugün + Canlı Saat */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs text-purple-300/70">Bugün</div>
                      <div className="text-sm font-semibold text-purple-300">
                        {currentTime.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                      </div>
                      <div className="text-xs text-purple-400/80 font-mono tabular-nums">
                        {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* 2. Acil İhaleler - Bugün/Yarın Sona Erenler */}
                  {(() => {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    const urgentTenders = sortedTenders.filter(t => {
                      const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
                      if (!deadline) return false;
                      deadline.setHours(0, 0, 0, 0);
                      return deadline <= tomorrow && deadline >= now;
                    });

                    const todayCount = urgentTenders.filter(t => {
                      const deadline = new Date(t.deadline_date!);
                      deadline.setHours(0, 0, 0, 0);
                      return deadline.getTime() === now.getTime();
                    }).length;

                    const tomorrowCount = urgentTenders.length - todayCount;
                    
                    // Bildirim açık olan acil ihaleler
                    const urgentWithNotif = urgentTenders.filter(t => notifications.has(t.id)).length;

                    if (urgentTenders.length > 0) {
                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center animate-pulse">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <div className="text-xs text-red-300/70">🚨 Acil İhaleler</div>
                            <div className="text-sm font-bold text-red-300">
                              {urgentTenders.length} ihale - Hemen bak!
                            </div>
                            <div className="text-xs text-red-400/80 mt-0.5 flex items-center gap-2">
                              <span>
                                {todayCount > 0 && `${todayCount} bugün`}
                                {todayCount > 0 && tomorrowCount > 0 && ', '}
                                {tomorrowCount > 0 && `${tomorrowCount} yarın`}
                              </span>
                              {urgentWithNotif > 0 && (
                                <span className="flex items-center gap-0.5 text-blue-400">
                                  • {urgentWithNotif} <Bell className="w-3 h-3 fill-blue-400" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 3 gün içinde sona erenler
                    const soonTenders = sortedTenders.filter(t => {
                      const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
                      if (!deadline) return false;
                      deadline.setHours(0, 0, 0, 0);
                      const threeDays = new Date(now);
                      threeDays.setDate(threeDays.getDate() + 3);
                      return deadline > tomorrow && deadline <= threeDays;
                    });

                    if (soonTenders.length > 0) {
                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <div className="text-xs text-orange-300/70">⚠️ Yaklaşan</div>
                            <div className="text-sm font-semibold text-orange-300">
                              {soonTenders.length} ihale
                            </div>
                            <div className="text-xs text-orange-400/80 mt-0.5">
                              3 gün içinde
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-xs text-emerald-300/70">✅ Durum</div>
                          <div className="text-sm font-semibold text-emerald-300">
                            Acil yok
                          </div>
                          <div className="text-xs text-emerald-400/80 mt-0.5">
                            Rahat takip et
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. Bu Hafta Eklenenler */}
                  {(() => {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    sevenDaysAgo.setHours(0, 0, 0, 0);

                    const thisWeekTenders = sortedTenders.filter(t => {
                      const firstSeen = t.first_seen_at ? new Date(t.first_seen_at) : null;
                      return firstSeen && firstSeen >= sevenDaysAgo;
                    });

                    const todayTenders = sortedTenders.filter(t => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const firstSeen = t.first_seen_at ? new Date(t.first_seen_at) : null;
                      if (!firstSeen) return false;
                      firstSeen.setHours(0, 0, 0, 0);
                      return firstSeen.getTime() === today.getTime();
                    }).length;

                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <div className="text-xs text-blue-300/70">📅 Bu Hafta</div>
                          <div className="text-sm font-semibold text-blue-300">
                            {thisWeekTenders.length} yeni ihale
                          </div>
                          <div className="text-xs text-blue-400/80 mt-0.5">
                            {todayTenders > 0 ? `${todayTenders} bugün eklendi` : 'Son 7 gün'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4. Toplam İhale Özeti */}
                  {(() => {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    const activeCount = sortedTenders.filter(t => {
                      const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
                      return deadline && deadline >= now;
                    }).length;

                    const favCount = favorites.size;
                    const notifCount = notifications.size;

                    const totalBudget = sortedTenders
                      .filter(t => t.budget && t.budget > 0)
                      .reduce((sum, t) => sum + (t.budget || 0), 0);

                    const formatBudget = (amount: number) => {
                      if (amount >= 1_000_000) {
                        return `${(amount / 1_000_000).toFixed(1)}M`;
                      } else if (amount >= 1_000) {
                        return `${(amount / 1_000).toFixed(0)}K`;
                      }
                      return amount.toString();
                    };

                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Database className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-xs text-emerald-300/70">📊 Takip</div>
                          <div className="text-sm font-semibold text-emerald-300">
                            {activeCount} aktif
                          </div>
                          <div className="text-xs text-emerald-400/80 mt-0.5 flex items-center gap-2">
                            {favCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                ⭐ {favCount} favori
                              </span>
                            )}
                            {notifCount > 0 && (
                              <>
                                {favCount > 0 && <span>•</span>}
                                <span className="flex items-center gap-0.5">
                                  {notifCount} bildirim
                                </span>
                              </>
                            )}
                            {favCount === 0 && notifCount === 0 && (
                              <span>Takip yok</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}

            {/* Scraping Durumu */}
            {scraping && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl px-4 py-3">
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
            <div className="flex gap-2 mb-4 flex-wrap">
              <button 
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Tümü ({tenders.length})
              </button>
              <button 
                onClick={() => setFilterStatus('favorites')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  filterStatus === 'favorites' 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Star className={`w-4 h-4 ${filterStatus === 'favorites' ? 'fill-white' : ''}`} />
                Favoriler ({favorites.size})
              </button>
              <button 
                onClick={() => setFilterStatus('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'active' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Açık
              </button>
              <button 
                onClick={() => setFilterStatus('upcoming')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'upcoming' 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Yaklaşanlar
              </button>
              <button 
                onClick={() => setFilterStatus('closed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'closed' 
                    ? 'bg-gray-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Kapanmış
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="space-y-4">
              <div className="inline-block w-8 h-8 border-2 border-gray-700 border-t-white rounded-full animate-spin"></div>
              <p className="text-gray-400 text-sm">İhaleler yükleniyor...</p>
              {/* ⏱️ Elapsed Time */}
              {loadingStartTime && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-300">
                    {formatElapsedTime(elapsedTime)}
                  </span>
                  <span className="text-xs text-gray-500">geçti</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b-2 border-gray-700">
                <tr>
                  <th className="px-3 py-4 text-left font-bold text-gray-300 w-8">#</th>
                  <th className="px-3 py-4 text-center font-bold text-gray-300 w-20" title="Takip">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <Bell className="w-4 h-4 text-blue-400" />
                    </div>
                  </th>
                  <th className="px-3 py-4 text-left font-bold text-gray-300 w-24">Durum</th>
                  <th className="px-3 py-4 text-left font-bold text-gray-300 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('organization')}>
                    <div className="flex items-center gap-2">
                      Kurum
                      {sortField === 'organization' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </th>
                  <th className="px-3 py-4 text-left font-bold text-gray-300 w-24 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('organization_city')}>
                    <div className="flex items-center gap-2">
                      Şehir
                      {sortField === 'organization_city' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </th>
                  <th className="px-3 py-4 text-left font-bold text-gray-300 w-28 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('deadline_date')}>
                    <div className="flex items-center gap-2">
                      Son Teklif Tarihi
                      {sortField === 'deadline_date' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </th>
                  <th className="px-3 py-4 text-left font-bold text-gray-300 w-32">Kayıt No</th>
                  <th className="px-3 py-4 text-center font-bold text-gray-300 w-16">Kaynak</th>
                  <th className="px-3 py-4 text-center font-bold text-gray-300 w-20">AI</th>
                  <th className="px-3 py-4 text-center font-bold text-gray-300 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sortedTenders.map((t, i) => {
                  // Normal zebra striping - hiçbir renkli çizgi yok
                  const rowBgClass = i % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-950/60';
                  const isFavorite = favorites.has(t.id);
                  const hasNotification = notifications.has(t.id);

                  return (
                  <tr
                    key={t.id}
                    id={`tender-${t.id}`}
                    onClick={() => fetchFullContent(t)}
                    className={`hover:bg-zinc-700/50 transition-colors cursor-pointer ${rowBgClass} ${isFavorite ? 'ring-1 ring-yellow-500/30' : ''} ${hasNotification ? 'ring-1 ring-blue-500/30' : ''}`}
                    title="Detay için tıklayın"
                  >
                    <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                    
                    {/* ⭐ Favori & 🔔 Bildirim Butonları */}
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Favori */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(t.id);
                          }}
                          className={`transition-all duration-200 p-1 rounded hover:bg-gray-800 ${isFavorite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`}
                          title={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                        >
                          <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                        </button>
                        
                        {/* Bildirim */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNotification(t.id, t.title, t.deadline_date);
                          }}
                          className={`transition-all duration-200 p-1 rounded hover:bg-gray-800 relative ${hasNotification ? 'text-blue-400' : 'text-gray-600 hover:text-blue-400'}`}
                          title={hasNotification ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                        >
                          {hasNotification ? (
                            <>
                              <Bell className="w-4 h-4 fill-blue-400" />
                              {/* Aktif bildirim indicator */}
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            </>
                          ) : (
                            <BellOff className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    
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
                            className="text-gray-400 hover:text-blue-400 transition-colors truncate max-w-[120px] text-left group relative"
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
                        className="mx-auto relative"
                        title={contentCache[t.id] ? "İçerik cache'de (hızlı açılır)" : "AI ile tam içeriği getir"}
                      >
                        {analyzingId === t.id ? (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        ) : (
                          <>
                            <Bot className="w-4 h-4 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" />
                            {/* 💚 Cache indicator - yeşil nokta */}
                            {contentCache[t.id] && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></span>
                            )}
                          </>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Modal - Premium Dark */}
        {selectedTender && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50 animate-in fade-in duration-200"
            onClick={closeModal}
          >
            <div
              className="bg-slate-900 rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-700 animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - Dark Premium */}
              <div className="bg-slate-800 px-8 py-6 flex items-start justify-between sticky top-0 z-10 shadow-xl border-b border-slate-700">
                <div className="flex-1 pr-8">
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedTender.title}</h2>
                  <p className="text-sm text-slate-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {selectedTender.organization}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
                  title="Kapat (ESC)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - Premium Dark */}
              <div className="w-full max-h-[calc(95vh-140px)] overflow-y-auto p-6 space-y-4">
                {fullContent ? (
                  <>
                    {/* 1. İhale Bilgileri */}
                    {fullContent.details && Object.keys(fullContent.details).length > 0 && (
                      <div className="bg-slate-800/70 border-2 border-slate-600 rounded-xl overflow-hidden shadow-lg">
                          <div className="bg-gradient-to-r from-blue-900/30 to-slate-700/50 px-5 py-4 border-b-2 border-slate-600">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <FileText className="w-5 h-5 text-blue-400" />
                              İhale Bilgileri
                            </h3>
                          </div>
                          <div className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {Object.entries(fullContent.details).map(([key, value]) => (
                              <div key={key} className="flex flex-col bg-slate-900/40 p-3 rounded-lg">
                                <span className="text-xs text-slate-400 mb-1 font-medium">{key}</span>
                                <span className={`text-sm font-medium ${key === 'Kayıt no' ? 'text-red-500' : 'text-slate-100'}`}>{value as string}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Sektör Bilgileri */}
                    {(selectedTender.category || fullContent.details?.['Kategori'] || fullContent.details?.['Sektör']) && (
                      <div className="bg-slate-800/70 border-2 border-slate-600 rounded-xl overflow-hidden shadow-lg">
                        <div className="bg-gradient-to-r from-emerald-900/30 to-slate-700/50 px-5 py-4 border-b-2 border-slate-600">
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-emerald-400" />
                            Sektör Bilgileri
                          </h3>
                        </div>
                        <div className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {(fullContent.details?.['Kategori'] || selectedTender.category) && (
                              <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg">
                                <span className="text-xs text-slate-400 mb-1 font-medium">Kategori</span>
                                <span className="text-sm text-slate-100 font-medium">{fullContent.details?.['Kategori'] || selectedTender.category}</span>
                              </div>
                            )}
                            {fullContent.details?.['Sektör'] && (
                              <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg">
                                <span className="text-xs text-slate-400 mb-1 font-medium">Sektör</span>
                                <span className="text-sm text-slate-100 font-medium">{fullContent.details['Sektör']}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. İdare Bilgileri */}
                    {fullContent.details && (fullContent.details['İdare adı'] || fullContent.details['Toplantı adresi'] || fullContent.details['Teklifin verileceği yer'] || fullContent.details['İşin yapılacağı yer']) && (
                      <div className="bg-slate-800/70 border-2 border-slate-600 rounded-xl overflow-hidden shadow-lg">
                        <div className="bg-gradient-to-r from-purple-900/30 to-slate-700/50 px-5 py-4 border-b-2 border-slate-600">
                          <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-purple-400" />
                            İdare Bilgileri
                          </h3>
                        </div>
                        <div className="p-5 space-y-3 text-sm">
                          {fullContent.details['İdare adı'] && (
                            <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg">
                              <span className="text-xs text-slate-400 mb-1 font-medium">İdare Adı</span>
                              <span className="text-sm text-slate-100 font-medium">{fullContent.details['İdare adı']}</span>
                            </div>
                          )}
                          {fullContent.details['Toplantı adresi'] && (
                            <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg">
                              <span className="text-xs text-slate-400 mb-1 font-medium">Toplantı Adresi</span>
                              <span className="text-sm text-slate-100 font-medium">{fullContent.details['Toplantı adresi']}</span>
                            </div>
                          )}
                          {fullContent.details['Teklifin verileceği yer'] && (
                            <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg">
                              <span className="text-xs text-slate-400 mb-1 font-medium">Teklifin Verileceği Yer</span>
                              <span className="text-sm text-slate-100 font-medium">{fullContent.details['Teklifin verileceği yer']}</span>
                            </div>
                          )}
                          {fullContent.details['İşin yapılacağı yer'] && (
                            <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg">
                              <span className="text-xs text-slate-400 mb-1 font-medium">İşin Yapılacağı Yer</span>
                              <span className="text-sm text-slate-100 font-medium">{fullContent.details['İşin yapılacağı yer']}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. İhale İlanı - Tam Metin */}
                    {fullContent.fullText && (
                      <div className="bg-slate-800/60 border-2 border-slate-600 rounded-xl overflow-hidden shadow-lg">
                        <div className="bg-gradient-to-r from-orange-900/30 to-slate-700/50 px-6 py-4 border-b-2 border-slate-600">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-orange-400" />
                            İhale İlanı
                          </h3>
                        </div>
                        <div className="p-8 max-h-[500px] overflow-y-auto bg-white">
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono leading-relaxed font-light">
                            {fullContent.fullText}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* 5. Mal/Hizmet Listesi */}
                    {fullContent.itemsList && (
                      <div className="bg-slate-800/70 border-2 border-slate-600 rounded-xl overflow-hidden shadow-lg">
                        <div className="bg-gradient-to-r from-cyan-900/30 to-slate-700/50 px-6 py-4 border-b-2 border-slate-600">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-cyan-400" />
                            Mal/Hizmet Listesi
                          </h3>
                        </div>
                        <div className="p-6 max-h-[750px] overflow-y-auto overflow-x-auto bg-white">
                          <table className="w-full text-base border-collapse">
                            <thead className="sticky top-0 bg-gray-100 backdrop-blur-sm z-10">
                              <tr className="border-b-2 border-gray-300">
                                {fullContent.itemsList.split('\n')[0]?.split(',').map((header: string, idx: number) => (
                                  <th key={idx} className="px-4 py-2.5 text-left text-sm font-medium text-gray-600 border-r-2 border-gray-300 last:border-r-0">
                                    {header.trim()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fullContent.itemsList.split('\n').slice(1).filter((row: string) => row.trim()).map((row: string, rowIdx: number) => (
                                <tr key={rowIdx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                  {row.split(',').map((cell: string, cellIdx: number) => (
                                    <td key={cellIdx} className="px-5 py-4 text-sm text-gray-600 font-light border-r border-gray-200 last:border-r-0">
                                      {cell.trim()}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 6. İhale Dökümanları - Premium Dark */}
                    {fullContent.documents && fullContent.documents.length > 0 && (
                      <div className="bg-slate-800/60 border-2 border-slate-600 rounded-xl overflow-hidden shadow-xl">
                        {/* Header */}
                        <button
                          onClick={() => setDocumentsExpanded(!documentsExpanded)}
                          className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-900/30 to-slate-700/50 hover:from-indigo-900/40 hover:to-slate-700/60 transition-all border-b-2 border-slate-600"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-indigo-400" />
                            <div className="text-left">
                              <h3 className="text-base font-bold text-white">
                                İhale Dökümanları
                              </h3>
                              <p className="text-sm text-slate-300 font-medium">
                                {fullContent.documents.length} döküman {selectedDocuments.length > 0 && (
                                  <span className="text-emerald-400">• {selectedDocuments.length} seçili</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-slate-300">
                            {documentsExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </div>
                        </button>

                        {/* Content */}
                        {documentsExpanded && (
                          <div className="p-6 space-y-6 bg-slate-900/40">
                            {/* Export Butonları */}
                            <div className="bg-slate-800/80 rounded-xl p-5 border-2 border-slate-600 shadow-lg">
                              <div className="flex items-center gap-3 mb-4">
                                <FileText className="w-5 h-5 text-orange-400" />
                                <div>
                                  <h4 className="text-base font-bold text-white">İhale Detay Raporu</h4>
                                  <p className="text-sm text-slate-300">Export formatları</p>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                {/* 💎 CSV - Selectable + Quick Download */}
                                <div
                                  onClick={() => toggleDocumentSelection('virtual://csv')}
                                  className={`group cursor-pointer rounded-lg border-2 transition-all ${
                                    selectedDocuments.includes('virtual://csv')
                                      ? 'bg-slate-800 border-slate-500 shadow-lg'
                                      : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 p-3">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                                      selectedDocuments.includes('virtual://csv')
                                        ? 'bg-emerald-500/20'
                                        : 'bg-slate-800'
                                    }`}>
                                      {selectedDocuments.includes('virtual://csv') ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                      ) : (
                                        <span className="text-sm">📊</span>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <span className={`text-sm font-medium ${
                                        selectedDocuments.includes('virtual://csv') ? 'text-emerald-400' : 'text-slate-300'
                                      }`}>
                                        CSV Export
                                      </span>
                                      <p className="text-xs text-slate-500">İhale detay raporu</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        exportAsCSV();
                                      }}
                                      className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                      title="Direkt İndir"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* 💎 TXT - Selectable + Quick Download */}
                                <div
                                  onClick={() => toggleDocumentSelection('virtual://txt')}
                                  className={`group cursor-pointer rounded-lg border-2 transition-all ${
                                    selectedDocuments.includes('virtual://txt')
                                      ? 'bg-slate-800 border-slate-500 shadow-lg'
                                      : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 p-3">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                                      selectedDocuments.includes('virtual://txt')
                                        ? 'bg-blue-500/20'
                                        : 'bg-slate-800'
                                    }`}>
                                      {selectedDocuments.includes('virtual://txt') ? (
                                        <CheckCircle className="w-4 h-4 text-blue-400" />
                                      ) : (
                                        <span className="text-sm">📝</span>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <span className={`text-sm font-medium ${
                                        selectedDocuments.includes('virtual://txt') ? 'text-blue-400' : 'text-slate-300'
                                      }`}>
                                        TXT Export
                                      </span>
                                      <p className="text-xs text-slate-500">Metin formatında rapor</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        exportAsTXT();
                                      }}
                                      className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                      title="Direkt İndir"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* 💎 JSON - Selectable + Quick Download */}
                                <div
                                  onClick={() => toggleDocumentSelection('virtual://json')}
                                  className={`group cursor-pointer rounded-lg border-2 transition-all ${
                                    selectedDocuments.includes('virtual://json')
                                      ? 'bg-slate-800 border-slate-500 shadow-lg'
                                      : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 p-3">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                                      selectedDocuments.includes('virtual://json')
                                        ? 'bg-purple-500/20'
                                        : 'bg-slate-800'
                                    }`}>
                                      {selectedDocuments.includes('virtual://json') ? (
                                        <CheckCircle className="w-4 h-4 text-purple-400" />
                                      ) : (
                                        <span className="text-sm">🔧</span>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <span className={`text-sm font-medium ${
                                        selectedDocuments.includes('virtual://json') ? 'text-purple-400' : 'text-slate-300'
                                      }`}>
                                        JSON Export
                                      </span>
                                      <p className="text-xs text-slate-500">Programatik kullanım</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        exportAsJSON();
                                      }}
                                      className="p-2 bg-slate-800 hover:bg-purple-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                      title="Direkt İndir"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* ZIP Bilgilendirme - Eğer ZIP/RAR seçiliyse */}
                            {selectedDocuments.some(url => {
                              const fileName = url.split('/').pop() || '';
                              return fileName.toLowerCase().endsWith('.zip') || fileName.toLowerCase().endsWith('.rar');
                            }) && (
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
                                      📦 Arşiv Dosyası Tespit Edildi
                                      <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">
                                        OTOMATIK
                                      </span>
                                    </h4>
                                    <p className="text-xs text-blue-700 leading-relaxed mb-2">
                                      ZIP/RAR dosyaları <span className="font-semibold">sunucuda otomatik çıkarılacak</span> ve tüm içerikler AI analizine gönderilecek. 
                                      <br />
                                      <span className="text-blue-600">⚡ Tek tıkla tüm dökümanları analiz edebilirsiniz!</span>
                                    </p>
                                    
                                    {/* ZIP İçerik Önizleme Butonu */}
                                    <button
                                      onClick={async () => {
                                        // ZIP dosyasının bilgilerini al
                                        const zipUrl = selectedDocuments.find(url => {
                                          const fn = url.split('/').pop() || '';
                                          return fn.toLowerCase().endsWith('.zip') || fn.toLowerCase().endsWith('.rar');
                                        });

                                        if (!zipUrl) return;

                                        try {
                                          toast.loading('ZIP içeriği getiriliyor...', { id: 'zip-preview' });

                                          // API'den gerçek ZIP içeriğini al
                                          const response = await fetch(`/api/ihale-scraper/download-document?url=${encodeURIComponent(zipUrl)}`, {
                                            credentials: 'include'
                                          });

                                          if (!response.ok) {
                                            throw new Error('ZIP indirilemedi');
                                          }

                                          const data = await response.json();

                                          if (data.isZip && data.files) {
                                            // Gerçek ZIP içeriğini göster
                                            setZipFileInfo({
                                              fileName: data.filename,
                                              size: data.size,
                                              extractedFiles: data.files.map((f: any) => f.name)
                                            });
                                            setShowZipContents(true);
                                            toast.success(`${data.files.length} dosya bulundu`, { id: 'zip-preview' });
                                          } else {
                                            throw new Error('ZIP dosyası değil');
                                          }
                                        } catch (error: any) {
                                          console.error('ZIP önizleme hatası:', error);
                                          toast.error('ZIP önizlenemedi', { id: 'zip-preview' });
                                        }
                                      }}
                                      className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Arşiv İçeriğini Görüntüle</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 📦 Extracted Files - ZIP'ten çıkarılan gerçek dosyalar */}
                            {fullContent.extractedFiles && fullContent.extractedFiles.length > 0 && (() => {
                              // Test dosyalarını filtrele - sadece gerçek dökümanları göster
                              const realFiles = fullContent.extractedFiles.filter((f: any) =>
                                !f.name.toLowerCase().startsWith('test.')
                              );

                              if (realFiles.length === 0) return null;

                              return (
                              <div className="mb-4 p-5 bg-slate-800/70 rounded-xl border-2 border-emerald-600 shadow-lg">
                                <div className="flex items-center gap-2 mb-3 bg-gradient-to-r from-emerald-900/30 to-slate-700/50 -m-5 p-4 mb-4 rounded-t-xl border-b-2 border-emerald-700/50">
                                  <FileText className="w-5 h-5 text-emerald-400" />
                                  <h4 className="text-base font-bold text-white">
                                    📦 ZIP'ten Çıkarılan Dosyalar ({realFiles.length})
                                  </h4>
                                </div>
                                <div className="space-y-2">
                                  {realFiles.map((file: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border-2 border-slate-700 hover:border-emerald-500 hover:shadow-md transition-all group"
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-slate-100 truncate">{file.name}</p>
                                          <p className="text-xs text-slate-400">
                                            {(file.size / 1024).toFixed(1)} KB
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={async () => {
                                          try {
                                            toast.loading('İndiriliyor...', { id: 'file-download' });
                                            // Session'dan dosyayı indir (path: "sessions/tender_xxx/file.bin" or "data/sessions/...")
                                            const downloadPath = file.path.startsWith('data/')
                                              ? file.path
                                              : `data/${file.path}`;

                                            const response = await fetch(`/api/tender/session/download?path=${encodeURIComponent(downloadPath)}`);
                                            if (!response.ok) {
                                              console.error('❌ Download failed:', response.status, response.statusText);
                                              throw new Error(`İndirme başarısız: ${response.status}`);
                                            }

                                            const blob = await response.blob();
                                            const url = URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = file.name;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            URL.revokeObjectURL(url);

                                            toast.success('✅ İndirildi', { id: 'file-download' });
                                          } catch (error) {
                                            console.error('❌ İndirme hatası:', error);
                                            toast.error('❌ İndirme hatası', { id: 'file-download' });
                                          }
                                        }}
                                        className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                      >
                                        <Download className="w-5 h-5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              );
                            })()}

                            {/* Document List - Modern Cards with Pagination */}
                            <div className="space-y-3">
                              {(() => {
                                // 🚀 Pagination logic - sadece görünen kartları render et
                                const totalDocs = fullContent.documents.length;
                                const totalPages = Math.ceil(totalDocs / DOCS_PER_PAGE);
                                const startIdx = (docPage - 1) * DOCS_PER_PAGE;
                                const endIdx = Math.min(startIdx + DOCS_PER_PAGE, totalDocs);
                                const visibleDocs = fullContent.documents.slice(startIdx, endIdx);

                                return (
                                  <>
                                    {/* Pagination Info */}
                                    {totalDocs > DOCS_PER_PAGE && (
                                      <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-r from-slate-800/80 to-slate-700/80 rounded-xl border-2 border-slate-600 shadow-lg">
                                        <div className="flex items-center gap-2 text-sm text-slate-100">
                                          <span className="font-semibold">
                                            {startIdx + 1}-{endIdx} arası görüntüleniyor
                                          </span>
                                          <span className="text-slate-500">•</span>
                                          <span className="text-slate-300">Toplam {totalDocs} döküman</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => setDocPage(p => Math.max(1, p - 1))}
                                            disabled={docPage === 1}
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800/50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-slate-100 disabled:text-slate-500 border-2 border-slate-600 hover:border-slate-500 disabled:border-slate-700 transition-all"
                                          >
                                            ← Önceki
                                          </button>
                                          <span className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-bold shadow-md">
                                            {docPage} / {totalPages}
                                          </span>
                                          <button
                                            onClick={() => setDocPage(p => Math.min(totalPages, p + 1))}
                                            disabled={docPage === totalPages}
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800/50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-slate-100 disabled:text-slate-500 border-2 border-slate-600 hover:border-slate-500 disabled:border-slate-700 transition-all"
                                          >
                                            Sonraki →
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Render only visible documents */}
                                    {visibleDocs.map((doc: any, idx: number) => {
                                const isSelected = selectedDocuments.includes(doc.url);
                                const realIdx = startIdx + idx; // 🔢 Gerçek index (pagination için)

                                // Dosya uzantısını belirle (önce title'dan, sonra URL'den)
                                // Not: ihalebul URL'leri gerçek dosya adı içermiyor, sadece ID
                                let fileExt = 'PDF'; // Varsayılan
                                
                                // 1. Önce title'dan uzantı çıkarmayı dene
                                if (doc.title) {
                                  const titleMatch = doc.title.match(/\.(pdf|docx?|xlsx?|txt|zip|rar)$/i);
                                  if (titleMatch) {
                                    fileExt = titleMatch[1].toUpperCase();
                                  }
                                }
                                
                                // 2. Title'da yoksa URL'den dene (ama ihalebul'da çalışmaz)
                                if (fileExt === 'PDF' && !doc.url.includes('ihalebul.com')) {
                                  const urlParts = doc.url.split('/');
                                  const fileName = urlParts[urlParts.length - 1];
                                  const cleanFileName = fileName.split('?')[0];
                                  const urlExt = cleanFileName.split('.').pop()?.toUpperCase();
                                  if (urlExt && urlExt.length <= 4) {
                                    fileExt = urlExt;
                                  }
                                }

                                // 🆕 Akıllı Tip Tespiti - Helper fonksiyonları kullan
                                const detectedType = detectDocumentType(doc.title, doc.type);
                                const docInfo = getDocInfo(detectedType);

                                return (
                                  <div
                                    key={`doc-${realIdx}-${doc.url}`}
                                    className="relative group"
                                  >
                                    {/* Hafif gri glow efekt */}
                                    {isSelected && (
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-600/30 to-slate-500/30 rounded-xl blur-sm"></div>
                                    )}

                                    <div
                                      className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                                        isSelected
                                          ? 'bg-gradient-to-r from-slate-700/50 to-slate-800/90 border-slate-400 shadow-xl'
                                          : 'bg-slate-900/60 border-slate-600 hover:border-slate-500 hover:shadow-md'
                                      }`}
                                      onClick={() => toggleDocumentSelection(doc.url)}
                                    >

                                    <div className="relative flex items-center gap-3 p-4">
                                      {/* Icon - Premium Dark */}
                                      <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-lg transition-all ${
                                        isSelected ? 'bg-slate-600/60 text-white shadow-md' : 'bg-slate-800 text-slate-300'
                                      }`}>
                                        {isSelected ? <CheckCircle className="w-6 h-6" /> : docInfo.icon}
                                      </div>

                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <h4 className={`font-semibold truncate text-sm transition-colors ${
                                          isSelected ? 'text-slate-100' : 'text-slate-100'
                                        }`}>
                                          {doc.title || `Döküman ${realIdx + 1}`}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-xs text-slate-400">{docInfo.label}</span>
                                          <span className="text-slate-600">•</span>
                                          <code className="text-xs text-slate-400 font-mono">{fileExt}</code>
                                        </div>
                                      </div>

                                      {/* Download Button - Minimal */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          downloadDocument(doc.url, doc.title || `document_${realIdx}.${fileExt.toLowerCase()}`);
                                        }}
                                        className="flex-shrink-0 p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
                                        title="İndir"
                                      >
                                        <Download className="w-5 h-5" />
                                      </button>
                                    </div>
                                    </div>
                                  </div>
                                );
                              })}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 💎 PREMIUM ACTION BAR - Dark & Elegant - En Alta Taşındı */}
                    <div className="mt-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 shadow-2xl border-2 border-slate-700">
                      {/* Üst: Ana Aksiyon Butonları */}
                      <div className="flex flex-col gap-3 mb-4">
                        {/* Tümünü Seç ve Önizle - Üstte */}
                        <div className="flex items-center justify-between gap-3">
                          {/* Sol: Orijinal Sayfa */}
                          <a
                            href={selectedTender.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-100 hover:text-white rounded-lg transition-all border-2 border-slate-600 hover:border-slate-500 shadow-md text-sm font-semibold"
                          >
                            <ExternalLink className="w-5 h-5" />
                            Orijinal Sayfayı Aç
                          </a>

                          {/* Sağ: Tümünü Seç ve Önizle */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleAllDocuments()}
                              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-100 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-all border-2 border-slate-600 hover:border-slate-500 shadow-md"
                            >
                              <CheckCircle className="w-5 h-5" />
                              {(() => {
                                const virtualExports = 3;
                                const realDocs = fullContent?.documents?.length || 0;
                                const totalDocs = realDocs + virtualExports;
                                const isAllSelected = selectedDocuments.length === totalDocs;
                                return isAllSelected ? 'Seçimi Kaldır' : 'Tümünü Seç';
                              })()}
                            </button>

                            <button
                              onClick={() => setShowPreviewModal(true)}
                              disabled={selectedDocuments.length === 0}
                              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:cursor-not-allowed text-slate-100 disabled:text-slate-600 rounded-lg text-sm font-semibold transition-all border-2 border-slate-600 hover:border-slate-500 disabled:border-slate-700 shadow-md"
                            >
                              <Eye className="w-5 h-5" />
                              <span>Önizle</span>
                              {selectedDocuments.length > 0 && (
                                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-200 rounded-full text-xs font-bold border border-indigo-400/30">
                                  {selectedDocuments.length}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Analize Git ve Toplu İndir - Altında */}
                        <div className="flex items-center justify-end gap-3">
                          {/* 1️⃣ ANALİZE GİT - Premium Dark */}
                          <button
                            onClick={sendToAnalysis}
                            className="flex items-center gap-2 px-6 py-3 text-base font-semibold text-slate-100 bg-gradient-to-br from-purple-900/30 to-slate-800 hover:from-purple-900/50 hover:to-slate-700 rounded-lg transition-all border-2 border-purple-500/30 hover:border-purple-500/60 shadow-md"
                            title="Yeni AI analiz sayfasına git"
                          >
                            <Wand2 className="w-5 h-5 text-purple-400" />
                            <span className="tracking-wide">Analize Git</span>
                          </button>

                          {/* 2️⃣ TOPLU İNDİR - Premium Dark */}
                          <button
                            onClick={async () => {
                              if (selectedDocuments.length === 0) {
                                toast.error('⚠️ Lütfen en az 1 döküman seçin');
                                return;
                              }
                              await downloadSelectedDocuments();
                            }}
                            disabled={selectedDocuments.length === 0}
                            className="group relative flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-blue-900/30 to-slate-800 hover:from-blue-900/50 hover:to-slate-700 disabled:from-slate-800/50 disabled:to-slate-800/50 disabled:cursor-not-allowed text-white rounded-lg text-base font-semibold transition-all shadow-md hover:shadow-blue-500/30 border-2 border-blue-500/30 hover:border-blue-500/60 disabled:border-slate-700"
                            title="Seçili dökümanları ZIP olarak indir"
                          >
                            <Download className="w-5 h-5 text-blue-400" />
                            <span className="tracking-wide">Toplu İndir</span>
                            {selectedDocuments.length > 0 && (
                              <span className="ml-1 text-xs text-blue-200">({selectedDocuments.length})</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-spin" />
                      <p className="font-semibold">AI ile içerik getiriliyor...</p>
                      <p className="text-xs mt-2">Otomatik giriş yapılıyor ve sayfa parse ediliyor</p>
                      {/* ⏱️ Elapsed Time */}
                      {loadingStartTime && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-700">
                            {formatElapsedTime(elapsedTime)}
                          </span>
                          <span className="text-xs text-blue-500">geçti</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 🆕 Önizleme Modal - Modern Design */}
        {showPreviewModal && selectedDocuments.length > 0 && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              {/* Header - Gradient */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Seçili Dökümanlar
                    </h3>
                    <p className="text-sm text-blue-100">
                      {selectedDocuments.length} dosya analiz için hazır
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - Scrollable List */}
              <div className="p-6 max-h-[calc(85vh-200px)] overflow-y-auto space-y-3">
                {/* Virtual Export Files */}
                {selectedDocuments.filter(url => url.startsWith('virtual://')).map((virtualUrl, idx) => {
                  const exportType = virtualUrl.includes('csv') 
                    ? { name: 'CSV Export', icon: '📊', bgColor: 'bg-gradient-to-r from-emerald-50 to-emerald-50/50', borderColor: 'border-emerald-200' }
                    : virtualUrl.includes('txt') 
                    ? { name: 'TXT Export', icon: '📄', bgColor: 'bg-gradient-to-r from-blue-50 to-blue-50/50', borderColor: 'border-blue-200' }
                    : { name: 'JSON Export', icon: '🔧', bgColor: 'bg-gradient-to-r from-purple-50 to-purple-50/50', borderColor: 'border-purple-200' };

                  return (
                    <div key={idx} className={`group flex items-center justify-between p-4 ${exportType.bgColor} rounded-xl border-2 ${exportType.borderColor} transition-all hover:shadow-md`}>
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{exportType.icon}</div>
                        <div>
                          <div className="font-semibold text-gray-900">{exportType.name}</div>
                          <div className="text-sm text-gray-600">İhale detay raporu</div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleDocumentSelection(virtualUrl)}
                        className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all opacity-0 group-hover:opacity-100"
                        title="Seçimden çıkar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Real Documents */}
                {fullContent?.documents
                  ?.filter((doc: any) => selectedDocuments.includes(doc.url))
                  .map((doc: any, idx: number) => {
                    // Query parametrelerini temizle (?HASH=... gibi)
                    const cleanUrl = doc.url.split('?')[0];
                    const fileExt = cleanUrl.split('.').pop()?.toUpperCase() || 'PDF';
                    
                    const getDocColor = (type: string) => {
                      switch (type) {
                        case 'idari_sartname': return { gradient: 'from-blue-500 to-indigo-600', bg: 'from-blue-50 to-indigo-50', border: 'border-blue-300', icon: '📋' };
                        case 'teknik_sartname': return { gradient: 'from-emerald-500 to-green-600', bg: 'from-emerald-50 to-green-50', border: 'border-emerald-300', icon: '⚙️' };
                        default: return { gradient: 'from-purple-500 to-pink-600', bg: 'from-purple-50 to-pink-50', border: 'border-purple-300', icon: '📎' };
                      }
                    };

                    const docColor = getDocColor(doc.type);

                    return (
                      <div key={idx} className={`group flex items-center justify-between p-4 bg-gradient-to-r ${docColor.bg} rounded-xl border-2 ${docColor.border} transition-all hover:shadow-md`}>
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{docColor.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {doc.title || 'İsimsiz Döküman'}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${docColor.gradient} text-white`}>
                                {doc.type === 'idari_sartname' ? 'İdari' : doc.type === 'teknik_sartname' ? 'Teknik' : 'Döküman'}
                              </span>
                              <span>•</span>
                              <code className="bg-white/50 px-2 py-0.5 rounded text-xs">{fileExt}</code>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleDocumentSelection(doc.url)}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all opacity-0 group-hover:opacity-100"
                          title="Seçimden çıkar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
              </div>

              {/* Footer - Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">{selectedDocuments.length}</span> dosya seçildi
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ZIP İçerik Önizleme Modalı */}
        {showZipContents && zipFileInfo && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              {/* Header - Blue Gradient */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      📦 Arşiv İçeriği
                    </h3>
                    <p className="text-sm text-blue-100">
                      {zipFileInfo.fileName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowZipContents(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Arşiv Bilgisi */}
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-blue-100 rounded-lg">
                      <span className="text-xs font-bold text-blue-700">
                        {(zipFileInfo.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="px-3 py-1.5 bg-indigo-100 rounded-lg">
                      <span className="text-xs font-bold text-indigo-700">
                        {zipFileInfo.extractedFiles?.length || 0} dosya
                      </span>
                    </div>
                  </div>
                  {zipFileInfo.size > 10485760 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 rounded-lg">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-semibold text-orange-700">Büyük Dosya</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dosya Listesi */}
              <div className="p-6 max-h-[calc(85vh-280px)] overflow-y-auto space-y-2">
                {zipFileInfo.extractedFiles?.map((fileName, idx) => {
                  // Dosya türüne göre ikon ve renk seç
                  const getFileTypeInfo = (name: string) => {
                    const ext = name.split('.').pop()?.toLowerCase() || '';
                    if (ext === 'pdf') return { icon: '📄', color: 'from-red-50 to-red-50/50', border: 'border-red-200', text: 'text-red-700' };
                    if (['doc', 'docx'].includes(ext)) return { icon: '📘', color: 'from-blue-50 to-blue-50/50', border: 'border-blue-200', text: 'text-blue-700' };
                    if (['xls', 'xlsx'].includes(ext)) return { icon: '📊', color: 'from-green-50 to-green-50/50', border: 'border-green-200', text: 'text-green-700' };
                    if (ext === 'txt') return { icon: '📝', color: 'from-gray-50 to-gray-50/50', border: 'border-gray-200', text: 'text-gray-700' };
                    return { icon: '📎', color: 'from-purple-50 to-purple-50/50', border: 'border-purple-200', text: 'text-purple-700' };
                  };

                  const fileInfo = getFileTypeInfo(fileName);

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 bg-gradient-to-r ${fileInfo.color} rounded-lg border ${fileInfo.border} hover:shadow-md transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{fileInfo.icon}</span>
                        <div>
                          <p className={`text-sm font-semibold ${fileInfo.text}`}>
                            {fileName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {fileName.split('.').pop()?.toUpperCase()} dosyası
                          </p>
                        </div>
                      </div>
                      <div className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600">
                        #{idx + 1}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer - Açıklama */}
              <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 font-medium mb-1">
                      Otomatik Çıkarma Aktif
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Bu arşiv dosyasını analize gönderdiğinizde, <span className="font-semibold text-blue-600">sunucu tarafında otomatik olarak çıkarılacak</span> ve tüm içerikler AI analizine dahil edilecek. Ekstra bir işlem yapmanıza gerek yok.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function IhaleTakipPage() {
  const [suspenseElapsed, setSuspenseElapsed] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setSuspenseElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 5000); // 🎯 1sn → 5sn (scheduler violation önleme)
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-gray-300 font-semibold">Uygulama yükleniyor...</p>
          {/* ⏱️ Elapsed Time */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">
              {suspenseElapsed < 60 ? `${suspenseElapsed}s` : `${Math.floor(suspenseElapsed / 60)}m ${suspenseElapsed % 60}s`}
            </span>
            <span className="text-xs text-gray-500">geçti</span>
          </div>
        </div>
      </div>
    }>
      <IhaleTakipPageInner />
    </Suspense>
  );
}

export default IhaleTakipPage;
