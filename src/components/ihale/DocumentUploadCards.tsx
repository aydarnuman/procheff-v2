'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';
import { FileProcessingStatus, CSVFileStatus } from '@/lib/stores/ihale-store';

interface DocumentType {
  type: BelgeTuru | 'csv';
  icon: string;
  label: string;
  description: string;
  acceptedFormats: string;
  isCSV?: boolean;
}

interface DocumentUploadCardsProps {
  fileStatuses: FileProcessingStatus[];
  csvFiles: CSVFileStatus[];
  onFileSelect: (file: File, documentType: BelgeTuru | 'csv') => void;
  onFileRemove: (fileName: string, isCSV?: boolean) => void;
}

const DOCUMENT_TYPES: DocumentType[] = [
  {
    type: 'ihale_ilani',
    icon: '📢',
    label: 'İhale İlanı',
    description: 'İhale tarihi, başvuru şartları, teminat',
    acceptedFormats: '.pdf, .doc, .docx, .png, .jpg, .jpeg'
  },
  {
    type: 'teknik_sartname',
    icon: '📋',
    label: 'Teknik Şartname',
    description: 'Menü, gramaj ve kalite standartları',
    acceptedFormats: '.pdf, .doc, .docx, .png, .jpg, .jpeg'
  },
  {
    type: 'idari_sartname',
    icon: '⚖️',
    label: 'İdari Şartname',
    description: 'İdari kurallar ve değerlendirme kriterleri',
    acceptedFormats: '.pdf, .doc, .docx, .png, .jpg, .jpeg'
  },
  {
    type: 'sozlesme_tasarisi',
    icon: '📝',
    label: 'Sözleşme Taslağı',
    description: 'Sözleşme maddeleri ve ceza koşulları',
    acceptedFormats: '.pdf, .doc, .docx, .png, .jpg, .jpeg'
  },
  {
    type: 'fiyat_teklif_mektubu',
    icon: '💰',
    label: 'Fiyat Teklif Mektubu',
    description: 'Fiyat cetveli ve teklif tutarı',
    acceptedFormats: '.pdf, .doc, .docx, .png, .jpg, .jpeg'
  },
  {
    type: 'csv',
    icon: '📊',
    label: 'Maliyet Analizi (CSV)',
    description: 'Ürün fiyat listesi ve maliyet hesaplaması',
    acceptedFormats: '.csv',
    isCSV: true
  },
  {
    type: 'diger',
    icon: '📎',
    label: 'Diğer Belgeler',
    description: 'Ek belgeler, resmi yazılar, ekler',
    acceptedFormats: '.pdf, .doc, .docx, .png, .jpg, .jpeg'
  }
];

/**
 * 📁 Belge Yükleme Kartları
 *
 * Her belge türü için ayrı kart gösterir
 * Durum: Boş / Yükleniyor / Yüklendi / Hata
 */
export function DocumentUploadCards({
  fileStatuses,
  csvFiles,
  onFileSelect,
  onFileRemove
}: DocumentUploadCardsProps) {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Belge türüne göre TÜÜM dosyaları bul (çoklu dosya desteği)
  const getFilesForType = (docType: DocumentType) => {
    if (docType.isCSV) {
      return csvFiles;
    } else {
      return fileStatuses.filter(fs => fs.detectedType === docType.type);
    }
  };

  // Belge türünün durumunu hesapla (özet bilgi)
  const getTypeStatus = (docType: DocumentType) => {
    const files = getFilesForType(docType);
    if (files.length === 0) return { count: 0, hasProcessing: false, hasCompleted: false, hasError: false };

    return {
      count: files.length,
      hasProcessing: files.some(f => f.status === 'processing' || f.status === 'pending'),
      hasCompleted: files.some(f => f.status === 'completed'),
      hasError: files.some(f => f.status === 'error'),
      completedCount: files.filter(f => f.status === 'completed').length,
      processingCount: files.filter(f => f.status === 'processing' || f.status === 'pending').length,
    };
  };

  // Dosya boyutunu formatla
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Kelime sayısını formatla
  const formatWordCount = (count: number) => {
    if (count < 1000) return count + ' kelime';
    return (count / 1000).toFixed(1) + 'K kelime';
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    docType: DocumentType
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    console.log(`📁 ${files.length} dosya seçildi (${docType.label})`);

    // Dosyaları sırayla ekle (işleme başlatma!)
    for (const file of files) {
      console.log(`  ↳ Ekleniyor: ${file.name}`);
      onFileSelect(file, docType.type);
    }

    console.log(`✅ ${files.length} dosya eklendi (işlem bekliyor)`);

    // Input'u temizle
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {DOCUMENT_TYPES.map((docType, index) => {
        const status = getTypeStatus(docType);
        const files = getFilesForType(docType);

        return (
          <motion.div
            key={docType.type}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 border rounded-xl p-4 backdrop-blur-sm transition-all hover:scale-[1.02] flex flex-col ${
              status.hasCompleted
                ? 'border-green-500/50 shadow-lg shadow-green-500/10'
                : status.hasProcessing
                ? 'border-blue-500/50 shadow-lg shadow-blue-500/10'
                : status.hasError
                ? 'border-red-500/50 shadow-lg shadow-red-500/10'
                : 'border-gray-700/50 hover:border-gray-600/50'
            }`}
          >
            {/* İçerik */}
            <div className="flex-1 flex flex-col text-center">
              {/* Icon - Sabit yükseklik */}
              <div className="text-6xl mb-3 h-20 flex items-center justify-center">{docType.icon}</div>

              {/* Label - Sabit yükseklik */}
              <h3 className="text-lg font-semibold text-white mb-3 h-14 flex items-center justify-center">
                {docType.label}
              </h3>

              {/* Durum Göstergesi - Sabit yükseklik */}
              <div className="h-16 flex flex-col items-center justify-center">
                {status.count > 0 ? (
                  <div className="w-full space-y-1">
                    {/* Durum */}
                    <div className="text-sm font-medium">
                      {status.processingCount > 0 && status.processingCount === status.count ? (
                        // Tüm dosyalar işleniyor
                        <div className="text-blue-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {status.count} dosya işleniyor...
                        </div>
                      ) : status.processingCount > 0 ? (
                        // Karışık durum
                        <div className="text-blue-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {status.processingCount} işleniyor, {status.completedCount} hazır
                        </div>
                      ) : status.hasCompleted ? (
                        // Hepsi tamamlandı
                        <div className="text-green-400 flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          {status.count} dosya hazır
                        </div>
                      ) : status.hasError ? (
                        <div className="text-red-400 flex items-center justify-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Hata
                        </div>
                      ) : (
                        // Pending
                        <div className="text-yellow-400 flex items-center justify-center gap-2">
                          ⏳ {status.count} dosya bekliyor
                        </div>
                      )}
                    </div>

                    {/* Toplam Kelime Sayısı ve Güven Skoru */}
                    {(() => {
                      const totalWords = files.reduce((sum, f) => {
                        const wc = 'wordCount' in f ? f.wordCount : 0;
                        return sum + (wc || 0);
                      }, 0);

                      // Ortalama güven skoru hesapla
                      const completedFiles = files.filter(f => f.status === 'completed' && 'detectedTypeConfidence' in f);
                      const avgConfidence = completedFiles.length > 0
                        ? completedFiles.reduce((sum, f) => sum + (('detectedTypeConfidence' in f ? f.detectedTypeConfidence : 0) || 0), 0) / completedFiles.length
                        : 0;

                      return (
                        <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                          {totalWords > 0 && (
                            <div>
                              📝 <span className="text-green-400 font-medium">{totalWords.toLocaleString('tr-TR')}</span> kelime
                            </div>
                          )}
                          {avgConfidence > 0 && (
                            <div className="flex items-center justify-center gap-1">
                              <span className={`font-medium ${
                                avgConfidence >= 0.8 ? 'text-green-400' :
                                avgConfidence >= 0.6 ? 'text-yellow-400' :
                                'text-orange-400'
                              }`}>
                                {(avgConfidence * 100).toFixed(0)}%
                              </span>
                              <span className="text-gray-500">güven</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    {docType.description}
                  </p>
                )}
              </div>
            </div>

            {/* Dosya Seçme */}
            <div className="mt-4">
              <input
                ref={el => { fileInputRefs.current[docType.type] = el; }}
                type="file"
                multiple
                accept={docType.acceptedFormats}
                onChange={(e) => handleFileChange(e, docType)}
                className="hidden"
              />

              <button
                onClick={() => fileInputRefs.current[docType.type]?.click()}
                className="w-full px-4 py-2.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/25"
              >
                <Upload className="w-4 h-4" />
                Yükle
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
