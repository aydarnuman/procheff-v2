'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Upload,
  X,
  AlertCircle,
  FileText,
  Loader2
} from 'lucide-react';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';
import { FileProcessingStatus } from '@/lib/stores/ihale-store';

interface DocumentRequirement {
  type: BelgeTuru;
  label: string;
  icon: string;
  required: boolean;
  description: string;
  acceptedFormats: string[];
  aiProvider?: string; // Hangi AI kullanılıyor
  aiDescription?: string; // AI ne yapıyor
}

interface DocumentUploadWizardProps {
  fileStatuses: FileProcessingStatus[];
  onFileSelect: (file: File, documentType: BelgeTuru) => void;
  onFileRemove: (fileName: string) => void;
  onSkip: (documentType: BelgeTuru) => void;
  onFileProcess?: (fileName: string) => Promise<void>; // YENİ: Dosya işleme callback
  onCategoryChange?: (fileName: string, newCategory: BelgeTuru) => void; // YENİ: Manuel kategori değiştirme
}

const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    type: 'ihale_ilani',
    label: 'İhale İlanı',
    icon: '📢',
    required: true,
    description: 'İhale tarihi, bütçe ve başvuru şartları',
    acceptedFormats: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.csv'],
    aiProvider: 'Claude Sonnet 4',
    aiDescription: 'Tarih, bütçe, teminat ve başvuru şartlarına odaklanır'
  },
  {
    type: 'teknik_sartname',
    label: 'Teknik Şartname',
    icon: '📋',
    required: true,
    description: 'Menü, gramaj, personel ve malzeme detayları',
    acceptedFormats: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.csv'],
    aiProvider: 'Dual API (Claude + Gemini)',
    aiDescription: 'Metin için Claude, tablolar için Gemini kullanır'
  },
  {
    type: 'idari_sartname',
    label: 'İdari Şartname',
    icon: '⚖️',
    required: false,
    description: 'İdari kurallar ve değerlendirme kriterleri',
    acceptedFormats: ['.pdf', '.doc', '.docx', '.png', '.jpg'],
    aiProvider: 'Claude Sonnet 4',
    aiDescription: 'İdari kurallar ve değerlendirme kriterlerini çıkarır'
  },
  {
    type: 'sozlesme_tasarisi',
    label: 'Sözleşme Taslağı',
    icon: '📝',
    required: false,
    description: 'Sözleşme maddeleri ve ceza koşulları',
    acceptedFormats: ['.pdf', '.doc', '.docx', '.png', '.jpg'],
    aiProvider: 'Claude Sonnet 4',
    aiDescription: 'Ceza şartları, yükümlülükler ve fesih koşullarını analiz eder'
  },
  {
    type: 'fiyat_teklif_mektubu',
    label: 'Fiyat Teklif Mektubu',
    icon: '💰',
    required: false,
    description: 'Fiyat cetveli ve teklif tutarı',
    acceptedFormats: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.csv'],
    aiProvider: 'Claude Sonnet 4 (CSV Expert)',
    aiDescription: 'Maliyet kalemleri, kar marjı ve rekabet analizi yapar'
  },
  {
    type: 'belirsiz',
    label: 'İşlenmeyi Bekleyen Belgeler',
    icon: '⏳',
    required: false,
    description: 'AI henüz belge türünü tespit etmedi - İşle butonuna basın',
    acceptedFormats: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.csv'],
    aiProvider: 'Otomatik tespit',
    aiDescription: 'Belge türünü otomatik tespit edip doğru kategoriye taşır'
  },
  {
    type: 'diger',
    label: 'Diğer Belgeler',
    icon: '📎',
    required: false,
    description: 'Ek belgeler, resmi yazılar ve CSV maliyet dosyaları',
    acceptedFormats: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.csv'],
    aiProvider: 'Otomatik tespit',
    aiDescription: 'Belge türüne göre uygun AI yönlendirilir'
  }
];

export function DocumentUploadWizard({
  fileStatuses,
  onFileSelect,
  onFileRemove,
  onSkip,
  onFileProcess,
  onCategoryChange
}: DocumentUploadWizardProps) {
  const [skippedTypes, setSkippedTypes] = useState<Set<BelgeTuru>>(new Set());
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Belge türüne göre dosyaları bul
  const getFileForType = (docType: BelgeTuru) => {
    return fileStatuses.find(fs => fs.detectedType === docType);
  };

  // Belge türü için dosya sayısını hesapla
  const getFileCountForType = (docType: BelgeTuru): number => {
    return fileStatuses.filter(fs => fs.detectedType === docType).length;
  };

  // Belge türü için TÜM dosyaları getir
  const getFilesForType = (docType: BelgeTuru): FileProcessingStatus[] => {
    return fileStatuses.filter(fs => fs.detectedType === docType);
  };

  // Belge türünün durumunu hesapla - TÜM dosyaları kontrol et
  const getTypeStatus = (docType: BelgeTuru): 'empty' | 'uploading' | 'completed' | 'error' | 'skipped' => {
    if (skippedTypes.has(docType)) return 'skipped';

    const files = getFilesForType(docType);
    if (files.length === 0) return 'empty';

    // Öncelik sırası: processing/pending > error > completed
    const hasProcessing = files.some(f => f.status === 'processing' || f.status === 'pending');
    const hasError = files.some(f => f.status === 'error');
    const allCompleted = files.every(f => f.status === 'completed');

    if (hasProcessing) return 'uploading';
    if (hasError) return 'error';
    if (allCompleted) return 'completed';

    return 'empty';
  };

  // Progress hesapla
  const calculateProgress = () => {
    const total = DOCUMENT_REQUIREMENTS.length;
    const completed = DOCUMENT_REQUIREMENTS.filter(req => {
      const status = getTypeStatus(req.type);
      return status === 'completed' || status === 'skipped';
    }).length;

    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  // Dosya seçimi
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, docType: BelgeTuru) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Çoklu dosya desteği - her dosyayı aynı türde yükle
    Array.from(files).forEach(file => {
      console.log(`📁 Dosya seçildi: ${file.name} (Tip: ${docType})`);
      onFileSelect(file, docType);
    });

    // Input'u temizle
    if (event.target) {
      event.target.value = '';
    }
  };

  // Skip
  const handleSkip = (docType: BelgeTuru) => {
    setSkippedTypes(prev => new Set(prev).add(docType));
    onSkip(docType);
    console.log(`⏭️ ${docType} atlandı`);
  };

  // Undo skip
  const handleUndoSkip = (docType: BelgeTuru) => {
    setSkippedTypes(prev => {
      const newSet = new Set(prev);
      newSet.delete(docType);
      return newSet;
    });
    console.log(`↩️ ${docType} skip geri alındı`);
  };

  const progress = calculateProgress();
  const canProceed = DOCUMENT_REQUIREMENTS
    .filter(req => req.required)
    .every(req => getTypeStatus(req.type) === 'completed');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl shadow-2xl"
        style={{
          boxShadow: '0 0 60px rgba(139, 92, 246, 0.15), inset 0 0 40px rgba(139, 92, 246, 0.05)'
        }}
      >
        {/* Animated glow effect */}
        <div className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full filter blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full filter blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <motion.div
              className="text-6xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              📁
            </motion.div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                Belge Yükleme Asistanı
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Sırayla belgelerinizi yükleyin veya <span className="text-purple-400 font-medium">"Yok"</span> deyin
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400">İlerleme Durumu</span>
              <span className="text-white font-semibold">
                {progress.completed}/{progress.total} Belge
              </span>
            </div>
            <div className="h-3 bg-slate-900/50 rounded-full overflow-hidden border border-slate-700/50">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 relative"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </motion.div>
            </div>
            {progress.percentage === 100 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-center text-emerald-400 text-sm font-medium"
              >
                ✨ Tüm belgeler hazır!
              </motion.div>
            )}
          </div>
        </div>

        {/* Document List */}
        <div className="space-y-3">
          {DOCUMENT_REQUIREMENTS.map((req, index) => {
            const status = getTypeStatus(req.type);
            const file = getFileForType(req.type);

            return (
              <motion.div
                key={req.type}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01, x: 4 }}
                className={`relative border rounded-2xl p-5 transition-all backdrop-blur-sm ${
                  status === 'completed'
                    ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 shadow-lg shadow-emerald-500/10'
                    : status === 'uploading'
                    ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-blue-500/5 shadow-lg shadow-blue-500/10'
                    : status === 'error'
                    ? 'border-red-500/50 bg-gradient-to-br from-red-500/10 to-red-500/5 shadow-lg shadow-red-500/10'
                    : status === 'skipped'
                    ? 'border-gray-600/30 bg-slate-800/20 opacity-60'
                    : 'border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5'
                }`}
              >
                {/* Status glow effect */}
                {status === 'completed' && (
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-2xl blur opacity-40" />
                )}
                {status === 'uploading' && (
                  <motion.div
                    className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-40"
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}

                <div className="relative">
                <div className="flex items-center gap-4">
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {status === 'completed' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : status === 'uploading' ? (
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    ) : status === 'error' ? (
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    ) : status === 'skipped' ? (
                      <Circle className="w-6 h-6 text-gray-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-600" />
                    )}
                  </div>

                  {/* Emoji & Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{req.icon}</span>
                      <h3 className="text-lg font-semibold text-white">
                        {index + 1}. {req.label}
                      </h3>
                      {req.required && (
                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                          Zorunlu
                        </span>
                      )}
                      {/* File Count Badge */}
                      {getFileCountForType(req.type) > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-semibold">
                          {getFileCountForType(req.type)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{req.description}</p>

                    {/* AI Info */}
                    {req.aiProvider && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-medium">
                          🤖 {req.aiProvider}
                        </span>
                        <span className="text-gray-500">• {req.aiDescription}</span>
                      </div>
                    )}

                    {/* File List - Pending Files (Waiting to be processed) */}
                    {getFilesForType(req.type).filter(f => f.status === 'pending').length > 0 && (
                      <div className="mt-3 space-y-2">
                        {getFilesForType(req.type).filter(f => f.status === 'pending').map((fileItem, idx) => (
                          <motion.div
                            key={fileItem.fileMetadata.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
                          >
                            {/* Pending icon */}
                            <Circle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />

                            <div className="flex-1 min-w-0 space-y-1">
                              {/* File Name */}
                              <div className="flex items-center gap-2 text-xs text-yellow-400">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate font-medium">{fileItem.fileMetadata.name}</span>
                              </div>

                              {/* Word count or pending status */}
                              <div className="text-xs text-gray-500">
                                {fileItem.wordCount && fileItem.wordCount > 0 ? (
                                  <>📝 {fileItem.wordCount.toLocaleString()} kelime • Hazır</>
                                ) : (
                                  <>⏳ İşlenmeyi bekliyor</>
                                )}
                              </div>
                            </div>

                            {/* Process Button */}
                            {onFileProcess && (
                              <button
                                onClick={async () => {
                                  await onFileProcess(fileItem.fileMetadata.name);
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-medium flex-shrink-0"
                              >
                                ⚡ İşle
                              </button>
                            )}

                            {/* Remove Button */}
                            <button
                              onClick={() => onFileRemove(fileItem.fileMetadata.name)}
                              className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* File List - Completed Files */}
                    {status === 'completed' && (
                      <div className="mt-3 space-y-2">
                        {getFilesForType(req.type).map((fileItem, idx) => (
                          <motion.div
                            key={fileItem.fileMetadata.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30"
                          >
                            {/* Green Check */}
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />

                            <div className="flex-1 min-w-0 space-y-1">
                              {/* File Name */}
                              <div className="flex items-center gap-2 text-xs text-green-400">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate font-medium">{fileItem.fileMetadata.name}</span>
                              </div>

                              {/* Stats */}
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                {fileItem.wordCount && fileItem.wordCount > 0 && (
                                  <span>
                                    📝 {fileItem.wordCount.toLocaleString()} kelime
                                  </span>
                                )}
                                <span>
                                  📦 {(fileItem.fileMetadata.size / 1024).toFixed(1)} KB
                                </span>
                                {fileItem.detectedTypeConfidence && (
                                  <span>
                                    ✓ {Math.round(fileItem.detectedTypeConfidence * 100)}%
                                  </span>
                                )}
                              </div>

                              {/* Category Dropdown */}
                              {onCategoryChange && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-gray-500">Kategori:</span>
                                  <select
                                    value={fileItem.detectedType || 'belirsiz'}
                                    onChange={(e) => onCategoryChange(fileItem.fileMetadata.name, e.target.value as BelgeTuru)}
                                    className="bg-slate-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                                  >
                                    {DOCUMENT_REQUIREMENTS.map((doc) => (
                                      <option key={doc.type} value={doc.type}>
                                        {doc.icon} {doc.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Remove Button */}
                            <button
                              onClick={() => onFileRemove(fileItem.fileMetadata.name)}
                              className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Processing Progress - TÜM DOSYALARI GÖSTER */}
                    {status === 'uploading' && getFilesForType(req.type).filter(f => f.status === 'processing').length > 0 && (
                      <div className="mt-3 space-y-2">
                        {getFilesForType(req.type).filter(f => f.status === 'processing').map((fileItem, idx) => (
                          <div key={fileItem.fileMetadata.name} className="space-y-2">
                            {/* Dosya bilgisi */}
                            <div className="flex items-center gap-2 text-xs text-blue-400">
                              <FileText className="w-3.5 h-3.5" />
                              <span className="truncate font-medium">{fileItem.fileMetadata.name}</span>
                            </div>

                            {/* Progress Text */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-blue-400 font-medium">
                                {fileItem.progress || ''}
                              </span>
                              {fileItem.fileMetadata.size && (
                                <span className="text-gray-500">
                                  {(fileItem.fileMetadata.size / 1024).toFixed(1)} KB
                                </span>
                              )}
                            </div>

                            {/* Animated Progress Bar */}
                            <div className="relative h-2 bg-slate-900/50 rounded-full overflow-hidden">
                              {/* Gradient animasyonlu progress */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_100%]"
                                animate={{
                                  backgroundPosition: ['0% 0%', '100% 0%'],
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "linear"
                                }}
                              />

                              {/* Shimmer effect */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "linear",
                                  delay: 0.2
                                }}
                              />
                            </div>

                            {/* Alt bilgi - Word count tahminı */}
                            {fileItem.progress && fileItem.progress.includes('kelime') && (
                              <div className="text-xs text-gray-500 italic">
                                ⏳ Metin analizi devam ediyor...
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {status === 'skipped' && (
                      <div className="mt-2 text-xs text-gray-500 italic">
                        Atlandı - Bu belge analiz edilmeyecek
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-2">
                    {status === 'empty' && (
                      <>
                        <input
                          ref={el => { fileInputRefs.current[req.type] = el; }}
                          type="file"
                          accept={req.acceptedFormats.join(',')}
                          onChange={(e) => handleFileChange(e, req.type)}
                          multiple
                          className="hidden"
                        />
                        <motion.button
                          onClick={() => fileInputRefs.current[req.type]?.click()}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30"
                        >
                          <Upload className="w-4 h-4" />
                          Dosya Seç
                        </motion.button>
                        {!req.required && (
                          <motion.button
                            onClick={() => handleSkip(req.type)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-5 py-2.5 bg-slate-700/50 text-gray-300 rounded-xl hover:bg-slate-600/50 transition-all text-sm border border-slate-600/50"
                          >
                            Yok
                          </motion.button>
                        )}
                      </>
                    )}

                    {status === 'skipped' && (
                      <button
                        onClick={() => handleUndoSkip(req.type)}
                        className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
                      >
                        Geri Al
                      </button>
                    )}

                    {status === 'completed' && (
                      <button
                        onClick={() => onFileRemove(file!.fileMetadata.name)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Dosyayı kaldır"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}

                    {status === 'uploading' && (
                      <div className="text-sm text-blue-400">
                        İşleniyor...
                      </div>
                    )}

                    {status === 'error' && (
                      <button
                        onClick={() => fileInputRefs.current[req.type]?.click()}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        Tekrar Dene
                      </button>
                    )}
                  </div>
                </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Warning */}
        {!canProceed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <strong>⚠️ Zorunlu belgeler eksik!</strong>
              <br />
              <span className="text-gray-300">İhale İlanı ve Teknik Şartname yüklemeden analiz başlatılamaz.</span>
            </div>
          </motion.div>
        )}
        </div>
      </motion.div>
    </div>
  );
}
