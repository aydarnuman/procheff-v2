'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { RefreshCw, ExternalLink, ChevronUp, ChevronDown, Search, Trash2, Sparkles, Bot, FileText, Download, Loader2, Calendar, Building2, MapPin, Clock, AlertCircle, AlertTriangle, Wand2, Eye, CheckCircle, Database } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useIhaleStore } from '@/lib/stores/ihale-store';
import { TokenCostCard } from '@/components/analytics/TokenCostCard';

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
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]); // 🆕 Seçili dökümanlar
  const [documentsExpanded, setDocumentsExpanded] = useState(true); // 🆕 Dökümanlar kartı açık mı
  const [showPreviewModal, setShowPreviewModal] = useState(false); // 🆕 Önizleme modal'ı

  // 🆕 Seçili dökümanların detaylı bilgisini hesapla
  const getSelectedDocumentsInfo = useCallback(() => {
    if (!fullContent.documents || selectedDocuments.length === 0) {
      return "(0)";
    }

    const selectedDocs = fullContent.documents.filter((doc: any) => selectedDocuments.includes(doc.url));
    
    // Dosya türlerini say
    const typeCount: Record<string, number> = {};
    selectedDocs.forEach((doc: any) => {
      const fileExt = doc.url.split('.').pop()?.toUpperCase() || 'PDF';
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
          console.log('🔄 Cache version mismatch, clearing old cache...');
          localStorage.removeItem('ihale-content-cache');
          localStorage.setItem(versionKey, CACHE_VERSION);
          return {};
        }

        const cached = localStorage.getItem('ihale-content-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log('💚 Cache localStorage\'dan yüklendi:', Object.keys(parsed).length, 'ihale');

          // 🔄 MIGRATION: Integer ID'leri source_id'ye çevir
          const migratedCache: Record<string, any> = {};
          let migrationCount = 0;

          for (const [key, value] of Object.entries(parsed)) {
            // Eğer key numeric (eski integer ID) ve value içinde source_id varsa
            if (/^\d+$/.test(key) && value && typeof value === 'object') {
              const sourceId = (value as any).source_id || (value as any).sourceId;
              if (sourceId && sourceId !== key) {
                console.log(`🔄 Migrating cache: ${key} → ${sourceId}`);
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
            console.log(`✅ Cache migration tamamlandı: ${migrationCount} item güncellendi`);
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

  // 💾 Cache'i localStorage'a kaydet (her değiştiğinde)
  useEffect(() => {
    const cacheSize = Object.keys(contentCache).length;
    console.log('🔄 useEffect triggered - contentCache.size:', cacheSize);
    if (cacheSize > 0) {
      try {
        const cacheString = JSON.stringify(contentCache);
        const cacheSizeBytes = new Blob([cacheString]).size;
        console.log('💾 Cache boyutu:', (cacheSizeBytes / 1024 / 1024).toFixed(2), 'MB');

        // localStorage limitini aşarsa cache'i küçült (max 2MB)
        if (cacheSizeBytes > 2 * 1024 * 1024) {
          console.warn('⚠️ Cache çok büyük, küçültülüyor...');
          const entries = Object.entries(contentCache);
          // Son 5 item'ı tut
          const newCache = Object.fromEntries(entries.slice(-5));
          setContentCache(newCache);
          return; // Bu sefer kaydetme, useEffect tekrar çalışacak
        }

        console.log('�� Kaydedilecek cache:', contentCache);
        localStorage.setItem('ihale-content-cache', cacheString);
        console.log('💾 Cache localStorage\'a kaydedildi:', cacheSize, 'ihale');

        // Doğrulama - gerçekten kaydedildi mi?
        const saved = localStorage.getItem('ihale-content-cache');
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('✅ localStorage doğrulama - kayıtlı keys:', Object.keys(parsed));
        }
      } catch (e) {
        console.error('❌ Cache kaydetme hatası:', e);
        // Quota exceeded durumunda eski cache'i temizle
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.warn('⚠️ localStorage dolu, cache temizleniyor...');
          localStorage.removeItem('ihale-content-cache');
          // Cache'i küçült (en eski 3 item'ı sil)
          const entries = Object.entries(contentCache);
          const newCache = Object.fromEntries(entries.slice(-3));
          setContentCache(newCache);
        }
      }
    } else {
      console.log('⚠️ Cache boş, localStorage\'a kaydetme atlanıyor');
    }
  }, [contentCache]);

  const loadTenders = async () => {
    try {
      setLoading(true);
      // Tüm ihaleleri göster
      const response = await fetch('/api/ihale-scraper/list?limit=1000');
      const data = await response.json();
      console.log('📊 API Response:', data);
      if (data.success) {
        console.log('✅ Setting tenders:', data.data.length, 'items');
        setTenders(data.data);
      } else {
        console.error('❌ API Error:', data.error);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerScrape = async (mode: 'new' | 'full' = 'new') => {
    try {
      setScraping(true);
      setIsScrapingActive(true);
      console.log(`🚀 Scraping arka planda başlatılıyor... (mode: ${mode})`);

      // Test endpoint kullan (async mode - hemen döner) + mode parametresi
      const response = await fetch(`/api/ihale-scraper/test?mode=${mode}`);
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

              if (progress.status === 'error') {
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

  // 🆕 AI ile tam içerik getir (otomatik login ile) - Cache destekli
  const fetchFullContent = async (tender: Tender, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setLoadingContent(true);
    setAnalyzingId(tender.id);
    // Yeni modül ile tek akış - source_id kullan (gerçek tender ID)
    const { fetchFullContent } = await import('@/lib/ihale-scraper/fetchFullContent');
    const tenderId = tender.source_id || String(tender.id); // Fallback to id if source_id missing
    console.log(`🔍 fetchFullContent çağrılıyor:`, { tenderId, hasSourceId: !!tender.source_id, dbId: tender.id });

    const content = await fetchFullContent(tenderId);
    if (content) {
      setFullContent(JSON.parse(JSON.stringify(content)));
      setSelectedTender(tender);
      setContentCache(prev => ({...prev, [tenderId]: JSON.parse(JSON.stringify(content))}));
      const params = new URLSearchParams(searchParams.toString());
      params.set('detail', tenderId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      alert('Hata: İçerik getirilemedi.');
    }
    setLoadingContent(false);
    setAnalyzingId(null);
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

  // 🆕 İhale detaylarını CSV olarak indir
  const exportAsCSV = () => {
    if (!selectedTender || !fullContent) return;

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
    link.download = `ihale_${registrationNo}_${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    link.download = `ihale_${registrationNo}_${date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 🆕 İhale detaylarını JSON olarak indir
  const exportAsJSON = () => {
    if (!selectedTender || !fullContent) return;

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
    link.download = `ihale_${registrationNo}_${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 🆕 İhaleyi AI analiz sayfasına gönder (ASYNC - timing fix)
  const sendToAnalysis = async () => {
    // ✅ Validation
    if (!selectedTender || !fullContent) {
      console.error('❌ sendToAnalysis: selectedTender veya fullContent eksik!', {
        hasSelectedTender: !!selectedTender,
        hasFullContent: !!fullContent
      });
      alert('⚠️ İhale detayı yüklenmemiş. Lütfen önce detayı yükleyin.');
      return;
    }

    if (!fullContent.fullText || fullContent.fullText.length === 0) {
      console.error('❌ fullContent.fullText boş!', {
        fullContent,
        keys: Object.keys(fullContent)
      });
      alert('⚠️ İhale metni bulunamadı. Lütfen "Tam İçeriği Göster" butonuna basarak detayı yükleyin.');
      return;
    }

    console.log('📤 sendToAnalysis çağrıldı:', {
      tender: selectedTender.title,
      textLength: fullContent.fullText.length,
      textSizeKB: (fullContent.fullText.length / 1024).toFixed(2)
    });

    try {
      // 1️⃣ Benzersiz ID üret
      const tempId = `ihale_${Date.now()}`;
      const payload = {
        title: selectedTender.title,
        text: fullContent.fullText,
        size: fullContent.fullText.length,
        timestamp: Date.now(),
      };

      // 2️⃣ sessionStorage'a kaydet (quota limiti yok, sayfa açık olduğu sürece kalıcı)
      console.log(`💾 sessionStorage'a kaydediliyor: ${tempId} (${(payload.size / 1024).toFixed(2)} KB)`);
      sessionStorage.setItem(tempId, JSON.stringify(payload));

      // 3️⃣ Doğrulama - gerçekten kaydedildi mi?
      const verification = sessionStorage.getItem(tempId);
      if (!verification) {
        throw new Error('sessionStorage yazma başarısız');
      }
      console.log('✅ sessionStorage kaydı doğrulandı');

      // 4️⃣ Router prefetch (hedef sayfayı önceden yükle)
      console.log('🔄 Hedef sayfa prefetch ediliyor...');
      await router.prefetch('/ihale/yeni-analiz');

      // 5️⃣ Kısa bekleme (router fetch tamamlanması için)
      await new Promise(resolve => setTimeout(resolve, 100));

      // 6️⃣ Güvenli yönlendirme
      console.log(`🚀 Yönlendirme yapılıyor: /ihale/yeni-analiz?from=${tempId}`);
      router.push(`/ihale/yeni-analiz?from=${tempId}`);

    } catch (error) {
      console.error('❌ sendToAnalysis hatası:', error);

      // Fallback: Eski localStorage yöntemi
      console.warn('⚠️ Fallback: localStorage yöntemi deneniyor...');
      try {
        // Store'u temizle
        reset();
        await new Promise(resolve => setTimeout(resolve, 50));

        // localStorage'ı temizle
        localStorage.removeItem('ihale_document_text');
        localStorage.removeItem('ihale_document_pages');
        localStorage.removeItem('ihale_document_stats');
        localStorage.removeItem('ihale_current_step');

        // Dosya ekle
        addFileStatus({
          fileMetadata: {
            name: `${selectedTender.title}.txt`,
            size: fullContent.fullText.length,
            type: 'text/plain',
            lastModified: Date.now(),
          },
          status: 'completed',
          extractedText: fullContent.fullText,
          wordCount: fullContent.fullText.split(/\s+/).length,
          detectedType: 'ihale_ilani',
          detectedTypeConfidence: 1.0,
          progress: '✅ İhale detayı hazır'
        });

        setCurrentStep('upload');

        // localStorage'a kaydet (quota kontrolü ile)
        try {
          localStorage.setItem('ihale_document_text', fullContent.fullText);
        } catch (e) {
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('⚠️ localStorage dolu, eski veriler temizleniyor...');
            localStorage.removeItem('ihale-content-cache');
            localStorage.removeItem('ihale-analysis-storage');
            // Tekrar dene
            localStorage.setItem('ihale_document_text', fullContent.fullText);
          } else {
            throw e;
          }
        }

        // Persist bekle
        await new Promise(resolve => setTimeout(resolve, 150));

        // Yönlendir
        router.push('/ihale/yeni-analiz?step=upload');

      } catch (fallbackError) {
        console.error('❌ Fallback da başarısız:', fallbackError);
        alert('⚠️ Veri aktarımı başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.');
      }
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
      const docName = url.includes('virtual://export/csv') ? '📊 İhale Detayları (CSV)' :
                     url.includes('virtual://export/txt') ? '📄 İhale Detayları (TXT)' :
                     url.includes('virtual://export/json') ? '🔧 İhale Detayları (JSON)' :
                     '📋 Döküman';

      console.log(`${isRemoving ? '❌ Kaldırıldı' : '✅ Seçildi'}: ${docName}`);
      console.log(`📦 Toplam seçili: ${newSelection.length} döküman`);

      return newSelection;
    });
  };

  // 🆕 Tümünü seç/kaldır (CSV/TXT/JSON dahil)
  const toggleAllDocuments = () => {
    if (!fullContent?.documents) {
      console.log('❌ toggleAllDocuments: fullContent.documents yok');
      return;
    }

    // CSV/TXT/JSON için virtual URLs oluştur
    const virtualDocUrls = [
      'virtual://export/csv',
      'virtual://export/txt',
      'virtual://export/json'
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
      console.warn('⚠️ Lütfen en az bir döküman seçin');
      return;
    }

    try {
      console.log('\n🚀 Yeni TenderSession Pipeline başlatılıyor...');

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

      // 2. Dökümanları indir ve session'a yükle (sadece gerçek URL'leri)
      const realDocuments = selectedDocuments.filter(url => !url.startsWith('virtual://'));
      console.log(`\n📥 Step 2: ${realDocuments.length} gerçek döküman indiriliyor ve yükleniyor...`);
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

          console.log(`   📤 Yükleniyor: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

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

          // ZIP ise kaç dosya çıkarıldığını göster
          if (uploadData.extractedFiles && uploadData.extractedFiles.length > 0) {
            console.log(`   ✅ ${file.name} yüklendi + ${uploadData.extractedFiles.length} dosya çıkarıldı`);
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

        const analyzeRes = await fetch('/api/tender/session/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const analyzeData = await analyzeRes.json();
        if (!analyzeData.success) {
          console.warn('⚠️ Analiz başlatılamadı:', analyzeData.error);
        } else {
          console.log('✅ Analiz başlatıldı');
        }

        // 4. Workspace'e yönlendir
        console.log('\n🎯 Step 4: Workspace sayfasına yönlendiriliyor...');
        closeModal();
        router.push(`/ihale/workspace?sessionId=${sessionId}`);
      } else {
        throw new Error('Hiçbir dosya yüklenemedi');
      }

    } catch (error: any) {
      console.error('\n❌ Pipeline hatası:', error.message);
      alert('Hata: ' + error.message);
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
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full"></div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  İhale Robotu
                </h1>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-sm text-gray-400">
                    <span className="text-white font-semibold">{sortedTenders.length}</span> aktif ihale
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
              <button
                onClick={async () => {
                  // [DEBUG] fullContent ve payload zinciri
                  console.log('[DEBUG] Yeni Analiz Butonu - fullContent:', fullContent);
                  if (selectedTender && fullContent && fullContent.fullText) {
                    const tempId = `ihale_${Date.now()}`;
                    const payload = {
                      title: selectedTender.title,
                      text: fullContent.fullText,
                      size: fullContent.fullText.length,
                      timestamp: Date.now(),
                    };
                    console.log('[DEBUG] Yeni Analiz Butonu - payload:', payload);
                    sessionStorage.setItem(tempId, JSON.stringify(payload));
                    await new Promise(r => setTimeout(r, 150));
                    router.push(`/ihale/yeni-analiz?from=${tempId}`);
                  } else {
                    console.warn('[DEBUG] Yeni Analiz Butonu - Yönlendirme için yeterli veri yok, fullContent veya selectedTender eksik');
                    router.push('/ihale/yeni-analiz');
                  }
                }}
                className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/30 text-sm font-medium transition-all duration-300 hover:scale-[1.02] overflow-hidden"
                title="Yeni ihale analizi yap"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Wand2 className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Yeni Analiz</span>
              </button>
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
            {/* Info Card - İstatistikler */}
            {!scraping && sortedTenders.length > 0 && (
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl px-5 py-4">
                <div className="grid grid-cols-4 gap-6">
                  {/* Bugünün Tarihi */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs text-purple-300/70">Bugün</div>
                      <div className="text-sm font-semibold text-purple-300">
                        {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* En Yakın İhale - Son Teklif Tarihine Göre */}
                  {(() => {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    // Deadline'ı geçmemiş ihaleleri bul
                    const upcomingTenders = sortedTenders.filter(t => {
                      const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
                      return deadline && deadline >= now;
                    }).sort((a, b) => {
                      const aDate = new Date(a.deadline_date!);
                      const bDate = new Date(b.deadline_date!);
                      return aDate.getTime() - bDate.getTime();
                    });

                    const nearest = upcomingTenders[0];

                    if (nearest) {
                      const deadlineDate = new Date(nearest.deadline_date!);
                      const diffTime = deadlineDate.getTime() - now.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                      // Renk belirleme
                      let timeColor = 'text-blue-400/80';
                      if (diffDays === 0) {
                        timeColor = 'text-red-400/80 font-bold';
                      } else if (diffDays <= 3) {
                        timeColor = 'text-red-400/80';
                      } else if (diffDays <= 7) {
                        timeColor = 'text-orange-400/80';
                      } else if (diffDays <= 14) {
                        timeColor = 'text-yellow-400/80';
                      }

                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-blue-300/70">En yakın son teklif</div>
                            <div className="text-sm font-semibold text-blue-300 truncate">
                              {nearest.title.length > 35
                                ? nearest.title.substring(0, 35) + '...'
                                : nearest.title}
                            </div>
                            <div className={`text-xs mt-0.5 ${timeColor}`}>
                              {diffDays === 0 ? 'Bugün sona eriyor!' : `${diffDays} gün kaldı`}
                            </div>
                          </div>

                          {/* 🆕 Döküman Önizleme Modal'ı */}
                          {showPreviewModal && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                                <div className="p-6 border-b">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                      Seçili Dökümanlar ({selectedDocuments.length})
                                    </h3>
                                    <button
                                      onClick={() => setShowPreviewModal(false)}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="p-6 max-h-96 overflow-y-auto">
                                  {fullContent.documents
                                    ?.filter((doc: any) => selectedDocuments.includes(doc.url))
                                    .map((doc: any, idx: number) => {
                                      const fileExt = doc.url.split('.').pop()?.toUpperCase() || 'PDF';
                                      const docType = doc.type === 'idari_sartname' ? 'İdari Şartname'
                                        : doc.type === 'teknik_sartname' ? 'Teknik Şartname'
                                        : fileExt === 'TXT' ? 'Text Dosyası'
                                        : fileExt === 'JSON' ? 'JSON Dosyası'
                                        : fileExt === 'CSV' ? 'CSV Tablosu'
                                        : 'Ek Dosya';

                                      return (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                                          <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            <div>
                                              <div className="font-medium text-gray-900">{doc.title || 'İsimsiz Döküman'}</div>
                                              <div className="text-sm text-gray-500">{docType} • {fileExt}</div>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => toggleDocumentSelection(doc.url)}
                                            className="text-red-600 hover:text-red-800 p-1"
                                            title="Seçimden çıkar"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                </div>
                                
                                <div className="p-6 border-t bg-gray-50">
                                  <div className="flex justify-end gap-3">
                                    <button
                                      onClick={() => setShowPreviewModal(false)}
                                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                      Kapat
                                    </button>
                                    <button
                                      onClick={() => {
                                        setShowPreviewModal(false);
                                        // Analiz başlatma kodu buraya gelecek
                                      }}
                                      disabled={selectedDocuments.length === 0}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                      Analiz Et ({selectedDocuments.length})
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">En yakın son teklif</div>
                          <div className="text-sm font-semibold text-gray-300">Yaklaşan ihale yok</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Toplam Bütçe */}
                  {(() => {
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
                          <Building2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-xs text-emerald-300/70">Toplam Bütçe</div>
                          <div className="text-sm font-semibold text-emerald-300">
                            {totalBudget > 0 ? `₺${formatBudget(totalBudget)}` : 'Belirtilmemiş'}
                          </div>
                          <div className="text-xs text-emerald-400/80 mt-0.5">
                            {sortedTenders.filter(t => t.budget && t.budget > 0).length} ihale
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Aktif İhaleler - Son Teklif Tarihine Göre */}
                  {(() => {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    const activeCount = sortedTenders.filter(t => {
                      const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
                      return deadline && deadline >= now;
                    }).length;

                    // En yakın son teklif tarihini bul
                    const nearestTender = sortedTenders
                      .filter(t => {
                        const deadline = t.deadline_date ? new Date(t.deadline_date) : null;
                        return deadline && deadline >= now;
                      })
                      .sort((a, b) => {
                        const aDate = new Date(a.deadline_date!);
                        const bDate = new Date(b.deadline_date!);
                        return aDate.getTime() - bDate.getTime();
                      })[0];

                    let statusText = 'Acil yok';
                    let statusColor = 'text-emerald-400/80';

                    if (nearestTender) {
                      const deadline = new Date(nearestTender.deadline_date!);
                      const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                      if (diffDays === 0) {
                        statusText = 'Bugün sona eriyor!';
                        statusColor = 'text-red-400/80 font-bold';
                      } else if (diffDays <= 3) {
                        statusText = `${diffDays} gün kaldı`;
                        statusColor = 'text-red-400/80';
                      } else if (diffDays <= 7) {
                        statusText = `${diffDays} gün kaldı`;
                        statusColor = 'text-orange-400/80';
                      } else if (diffDays <= 14) {
                        statusText = `${diffDays} gün kaldı`;
                        statusColor = 'text-yellow-400/80';
                      } else {
                        statusText = `${diffDays} gün kaldı`;
                        statusColor = 'text-emerald-400/80';
                      }
                    }

                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <div className="text-xs text-orange-300/70">Son Teklif</div>
                          <div className="text-sm font-semibold text-orange-300">
                            {activeCount} aktif ihale
                          </div>
                          <div className={`text-xs mt-0.5 ${statusColor}`}>
                            {statusText}
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

            {/* Filtre Sekmeleri - Hidden but functional */}
            <div className="hidden">
              <button onClick={() => setFilterStatus('all')}>Tümü</button>
              <button onClick={() => setFilterStatus('active')}>Açık</button>
              <button onClick={() => setFilterStatus('upcoming')}>Yaklaşanlar</button>
              <button onClick={() => setFilterStatus('closed')}>Kapanmış</button>
            </div>
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
                {sortedTenders.map((t, i) => {
                  // Normal zebra striping - hiçbir renkli çizgi yok
                  const rowBgClass = i % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-950/60';

                  return (
                  <tr
                    key={t.id}
                    onClick={() => fetchFullContent(t)}
                    className={`hover:bg-zinc-700/50 transition-colors cursor-pointer ${rowBgClass}`}
                    title="Detay için tıklayın"
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

        {/* Detail Modal */}
        {selectedTender && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
            onClick={closeModal}
          >
            <div
              className="bg-white rounded-lg max-w-[95vw] w-full max-h-[95vh] overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="border-b p-6 flex items-start justify-between sticky top-0 bg-white z-10">
                <div className="flex-1 pr-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedTender.title}</h2>
                  <p className="text-sm text-gray-600">{selectedTender.organization}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Üst Satır: Export ve Şartname Butonları */}
                  {fullContent && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={closeModal}
                        className="text-gray-400 hover:text-gray-600 text-3xl leading-none ml-auto"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Alt Satır: Yeni Analiz Butonu */}
                </div>
              </div>

              {/* Content - AI'dan Parse Edilmiş İçerik */}
              <div className="w-full max-h-[calc(95vh-140px)] overflow-y-auto p-6 space-y-6">
                {fullContent ? (
                  <>
                    {/* 1. İhale Bilgileri */}
                    {fullContent.details && Object.keys(fullContent.details).length > 0 && (
                      <div className="border border-blue-200 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-200">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            İhale Bilgileri
                          </h3>
                        </div>
                        <div className="bg-white p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Önemli alanlar önce göster */}
                            {fullContent.details['Kayıt no'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Kayıt No</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Kayıt no']}</span>
                              </div>
                            )}
                            {fullContent.details['İhale başlığı'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İhale Başlığı</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İhale başlığı']}</span>
                              </div>
                            )}
                            {fullContent.details['İşin adı'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İşin Adı</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İşin adı']}</span>
                              </div>
                            )}
                            {fullContent.details['Yayın tarihi'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Yayın Tarihi</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Yayın tarihi']}</span>
                              </div>
                            )}
                            {fullContent.details['Teklif tarihi'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Teklif Tarihi</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Teklif tarihi']}</span>
                              </div>
                            )}
                            {fullContent.details['İşin süresi'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İşin Süresi</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İşin süresi']}</span>
                              </div>
                            )}
                            {fullContent.details['Yaklaşık maliyet limiti'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Yaklaşık Maliyet Limiti</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Yaklaşık maliyet limiti']}</span>
                              </div>
                            )}
                            {fullContent.details['İtirazen şikayet bedeli'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İtirazen Şikayet Bedeli</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İtirazen şikayet bedeli']}</span>
                              </div>
                            )}
                            {fullContent.details['İhale türü'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İhale Türü</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İhale türü']}</span>
                              </div>
                            )}
                            {fullContent.details['İhale usulü'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İhale Usulü</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İhale usulü']}</span>
                              </div>
                            )}
                            {fullContent.details['İhale kaynağı'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İhale Kaynağı</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İhale kaynağı']}</span>
                              </div>
                            )}
                            {fullContent.details['Teklif türü'] && (
                              <div className="flex flex-col md:col-span-2">
                                <span className="text-xs text-gray-500 mb-1">Teklif Türü</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Teklif türü']}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Sektör Bilgileri */}
                    {(selectedTender.category || fullContent.details?.['Kategori'] || fullContent.details?.['Sektör']) && (
                      <div className="border border-green-200 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-green-200">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-green-600" />
                            Sektör Bilgileri
                          </h3>
                        </div>
                        <div className="bg-white p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(fullContent.details?.['Kategori'] || selectedTender.category) && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Kategori</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details?.['Kategori'] || selectedTender.category}</span>
                              </div>
                            )}
                            {fullContent.details?.['Sektör'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Sektör</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Sektör']}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. İdare Bilgileri */}
                    {fullContent.details && (fullContent.details['İdare adı'] || fullContent.details['Toplantı adresi'] || fullContent.details['Teklifin verileceği yer'] || fullContent.details['İşin yapılacağı yer']) && (
                      <div className="border border-purple-200 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-50 to-violet-50 px-4 py-3 border-b border-purple-200">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-600" />
                            İdare Bilgileri
                          </h3>
                        </div>
                        <div className="bg-white p-4">
                          <div className="space-y-3">
                            {fullContent.details['İdare adı'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İdare Adı</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İdare adı']}</span>
                              </div>
                            )}
                            {fullContent.details['Toplantı adresi'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Toplantı Adresi</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Toplantı adresi']}</span>
                              </div>
                            )}
                            {fullContent.details['Teklifin verileceği yer'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">Teklifin Verileceği Yer</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['Teklifin verileceği yer']}</span>
                              </div>
                            )}
                            {fullContent.details['İşin yapılacağı yer'] && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">İşin Yapılacağı Yer</span>
                                <span className="text-sm font-semibold text-gray-900">{fullContent.details['İşin yapılacağı yer']}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. İhale İlanı - Tam Metin */}
                    {fullContent.fullText && (
                      <div className="border border-orange-200 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-b border-orange-200">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-orange-600" />
                            İhale İlanı
                          </h3>
                        </div>
                        <div className="bg-white p-4 max-h-[600px] overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                            {fullContent.fullText}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* 5. Mal/Hizmet Listesi */}
                    {fullContent.itemsList && (
                      <div className="border border-cyan-200 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-50 to-sky-50 px-4 py-3 border-b border-cyan-200">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-cyan-600" />
                            Mal/Hizmet Listesi
                          </h3>
                        </div>
                        <div className="bg-white p-4 overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b-2 border-gray-200">
                                {fullContent.itemsList.split('\n')[0]?.split(',').map((header: string, idx: number) => (
                                  <th key={idx} className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
                                    {header.trim()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fullContent.itemsList.split('\n').slice(1).filter((row: string) => row.trim()).map((row: string, rowIdx: number) => (
                                <tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50">
                                  {row.split(',').map((cell: string, cellIdx: number) => (
                                    <td key={cellIdx} className="px-3 py-2 text-gray-900 border-r border-gray-100 last:border-r-0">
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

                    {/* 6. İhale Dökümanları - Collapsible Card with Checkboxes */}
                    {fullContent.documents && fullContent.documents.length > 0 && (
                      <div className="border border-indigo-200 rounded-lg overflow-hidden">
                        {/* Header - Always Visible */}
                        <button
                          onClick={() => setDocumentsExpanded(!documentsExpanded)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-colors border-b border-indigo-200"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <h3 className="text-sm font-semibold text-gray-700">
                              İhale Dökümanları ({fullContent.documents.length})
                            </h3>
                            {selectedDocuments.length > 0 && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                                {selectedDocuments.length} seçili
                              </span>
                            )}
                          </div>
                          {documentsExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          )}
                        </button>

                        {/* Collapsible Content */}
                        {documentsExpanded && (
                          <div className="p-4 space-y-3 bg-white">
                            {/* Export Butonları */}
                            <div className="flex items-center gap-2 mb-4 flex-wrap">
                              <span className="text-xs text-gray-500 font-medium">Export:</span>

                              {/* CSV Export with Checkbox */}
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                                selectedDocuments.includes('virtual://export/csv')
                                  ? 'bg-green-50 border-green-300'
                                  : 'bg-white border-gray-200'
                              }`}>
                                <input
                                  type="checkbox"
                                  id="export-csv"
                                  name="export-csv"
                                  checked={selectedDocuments.includes('virtual://export/csv')}
                                  onChange={() => toggleDocumentSelection('virtual://export/csv')}
                                  className="w-3.5 h-3.5 text-green-600 rounded focus:ring-2 focus:ring-green-500 cursor-pointer"
                                />
                                <Download className="w-3.5 h-3.5 text-green-600" />
                                <label htmlFor="export-csv" className="text-green-700 cursor-pointer">CSV</label>
                              </div>

                              {/* TXT Export with Checkbox */}
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                                selectedDocuments.includes('virtual://export/txt')
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-white border-gray-200'
                              }`}>
                                <input
                                  type="checkbox"
                                  id="export-txt"
                                  name="export-txt"
                                  checked={selectedDocuments.includes('virtual://export/txt')}
                                  onChange={() => toggleDocumentSelection('virtual://export/txt')}
                                  className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                />
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <label htmlFor="export-txt" className="text-blue-700 cursor-pointer">TXT</label>
                              </div>

                              {/* JSON Export with Checkbox */}
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                                selectedDocuments.includes('virtual://export/json')
                                  ? 'bg-purple-50 border-purple-300'
                                  : 'bg-white border-gray-200'
                              }`}>
                                <input
                                  type="checkbox"
                                  id="export-json"
                                  name="export-json"
                                  checked={selectedDocuments.includes('virtual://export/json')}
                                  onChange={() => toggleDocumentSelection('virtual://export/json')}
                                  className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                />
                                <Bot className="w-3.5 h-3.5 text-purple-600" />
                                <label htmlFor="export-json" className="text-purple-700 cursor-pointer">JSON</label>
                              </div>
                            </div>
                            {/* Action Bar */}
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                              <button
                                onClick={async () => {
                                  // Gerçek dosya indirme ve analiz başlatma
                                  await sendDocumentsToAnalysis();
                                }}
                                disabled={selectedDocuments.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow-md mr-2"
                                title="Seçili dökümanları indir ve analiz et"
                              >
                                <Wand2 className="w-3.5 h-3.5" />
                                Hızlı Analiz Başlat
                              </button>
                              <button
                                onClick={(e) => {
                                  console.log('🔘 Tümünü Seç butonuna tıklandı!');
                                  toggleAllDocuments();
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                              >
                                {selectedDocuments.length === fullContent.documents.length
                                  ? 'Seçimi Kaldır'
                                  : 'Tümünü Seç'}
                              </button>

                              {/* 🆕 Önizleme Butonu */}
                              <button
                                onClick={() => setShowPreviewModal(true)}
                                disabled={selectedDocuments.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow-md"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Önizle ({selectedDocuments.length})
                              </button>
                            </div>

                            {/* Document List with Checkboxes */}
                            <div className="space-y-3">
                              {fullContent.documents.map((doc: any, idx: number) => {
                                const isSelected = selectedDocuments.includes(doc.url);

                                // Dosya uzantısını URL'den çıkar (daha akıllı şekilde)
                                const urlParts = doc.url.split('/');
                                const fileName = urlParts[urlParts.length - 1];
                                const fileExt = fileName.split('.').pop()?.toUpperCase() || 'PDF';

                                // Dosya tipine göre badge ve icon
                                const getDocInfo = (type: string, ext: string) => {
                                  switch (type) {
                                    case 'idari_sartname':
                                      return {
                                        label: 'İdari Şartname',
                                        color: 'bg-blue-100 text-blue-800 border-blue-200',
                                        icon: '📋'
                                      };
                                    case 'teknik_sartname':
                                      return {
                                        label: 'Teknik Şartname',
                                        color: 'bg-green-100 text-green-800 border-green-200',
                                        icon: '⚙️'
                                      };
                                    default:
                                      switch (ext) {
                                        case 'TXT': return { label: 'Metin', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '📄' };
                                        case 'JSON': return { label: 'Veri', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: '🔧' };
                                        case 'CSV': return { label: 'Tablo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '📊' };
                                        default: return { label: 'Döküman', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '📎' };
                                      }
                                  }
                                };

                                const docInfo = getDocInfo(doc.type, fileExt);

                                return (
                                  <div
                                    key={idx}
                                    className={`group relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                                      isSelected
                                        ? 'bg-blue-50 border-blue-300 shadow-md ring-2 ring-blue-200'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                    }`}
                                    onClick={() => toggleDocumentSelection(doc.url)}
                                  >
                                    {/* Checkbox */}
                                    <div className="flex-shrink-0">
                                      <input
                                        type="checkbox"
                                        id={`document-${idx}`}
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleDocumentSelection(doc.url);
                                        }}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                      />
                                    </div>

                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                                      {docInfo.icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-semibold text-gray-900 truncate">
                                          {doc.title || `Döküman ${idx + 1}`}
                                        </h4>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${docInfo.color}`}>
                                          {docInfo.label}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                          <span className="font-medium">Format:</span>
                                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{fileExt}</code>
                                        </span>
                                        <span className="text-gray-400">•</span>
                                        <span className="truncate max-w-xs" title={fileName}>
                                          {fileName.length > 30 ? `${fileName.substring(0, 30)}...` : fileName}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Download Button */}
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Dökümanı indir"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>

                                    {/* Selection Indicator */}
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
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
    </>
  );
}

function IhaleTakipPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Yükleniyor...</p>
        </div>
      </div>
    }>
      <IhaleTakipPageInner />
    </Suspense>
  );
}

export default IhaleTakipPage;
