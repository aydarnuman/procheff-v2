'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, FileText, Upload, X, ChevronRight, Plus } from 'lucide-react';
import { BelgeTuru, BELGE_TURU_LABELS } from '@/types/ai';

interface LinkedDocumentsProps {
  uploadedDocuments: BelgeTuru[];
  onAddDocument?: () => void;
  onFileUpload?: (files: File[]) => Promise<void>;
  onCSVUpload?: (files: File[]) => Promise<void>; // Çoklu dosya desteği
}

/**
 * 📎 Bağlantılı Belgeler Komponenti
 *
 * Yüklenen belgelere göre eksik belgeleri tespit eder ve önerir.
 */
export function LinkedDocuments({ uploadedDocuments, onAddDocument, onFileUpload, onCSVUpload }: LinkedDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Accordion state

  // Standart ihale belgeleri
  const standardDocuments: { type: BelgeTuru; description: string }[] = [
    { type: 'ihale_ilani', description: 'İhale tarihleri ve başvuru şartları' },
    { type: 'teknik_sartname', description: 'Menü, gramaj ve kalite standartları' },
    { type: 'idari_sartname', description: 'İdari kurallar ve değerlendirme' },
    { type: 'sozlesme_tasarisi', description: 'Sözleşme maddeleri ve ceza koşulları' },
  ];

  // Dosya yükleme handler
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !onFileUpload) return;

    setIsUploading(true);
    try {
      await onFileUpload(files);
    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
    } finally {
      setIsUploading(false);
      // Input'u temizle
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // CSV yükleme handler - Çoklu dosya desteği
  const handleCSVChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !onCSVUpload) return;

    setIsUploading(true);
    try {
      await onCSVUpload(files);
    } catch (error) {
      console.error('CSV yükleme hatası:', error);
    } finally {
      setIsUploading(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  };

  // Eksik belgeleri bul
  const missingDocuments = standardDocuments.filter(
    doc => !uploadedDocuments.includes(doc.type)
  );

  // Yüklenen belgeleri bul
  const uploadedDocs = standardDocuments.filter(
    doc => uploadedDocuments.includes(doc.type)
  );

  // Hiç eksik belge yoksa veya dismissed ise gösterme
  if (missingDocuments.length === 0 || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6 relative overflow-hidden"
      >
        {/* Arka plan pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`
          }} />
        </div>

        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors z-10 focus:outline-none focus-visible:outline-none"
          title="Kapat"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative">
          {/* Header - Clickable for accordion */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-start gap-4 mb-4 text-left hover:opacity-80 transition-opacity focus:outline-none focus-visible:outline-none outline-none"
            style={{ outline: 'none', border: 'none' }}
          >
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white mb-1">
                  📎 Bağlantılı Belgeler
                </h3>
                <ChevronRight
                  className={`w-5 h-5 text-blue-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
                />
              </div>
              <p className="text-sm text-gray-300">
                Yüklediğiniz belgelere bağlı olarak eksik belgeler tespit edildi.
                Daha doğru analiz için bu belgeleri de eklemenizi öneririz.
              </p>
            </div>
          </button>

          {/* Accordion Content */}
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                style={{ overflow: 'hidden' }}
              >
                {/* Yüklenen Belgeler Özeti */}
                {uploadedDocs.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400 mb-2">Yüklenen Belgeler:</p>
              <div className="flex flex-wrap gap-2">
                {uploadedDocs.map(doc => (
                  <div
                    key={doc.type}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-xs"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-green-300">{BELGE_TURU_LABELS[doc.type]}</span>
                  </div>
                ))}
                </div>
              </div>
            )}

                {/* Eksik Belgeler */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Önerilen Belgeler ({missingDocuments.length} Eksik)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {missingDocuments.map(doc => (
                <motion.div
                  key={doc.type}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between p-4 bg-gray-800/70 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-all group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-lg transition-colors">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">
                        {BELGE_TURU_LABELS[doc.type]}
                      </p>
                      <p className="text-xs text-gray-400">
                        {doc.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 rounded group-hover:bg-blue-500/30 transition-colors">
                      <Plus className="w-4 h-4 text-blue-400" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Dosya yükleme input (hidden) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.csv"
            onChange={handleFileChange}
            className="hidden"
            id="linked-docs-upload"
          />

          <input
            ref={csvInputRef}
            type="file"
            multiple
            accept=".csv"
            onChange={handleCSVChange}
            className="hidden"
            id="csv-upload"
          />

          {/* Upload Buttons */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !onFileUpload}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Belge Yükle (PDF/PNG/CSV)
                </>
              )}
            </button>

            {onCSVUpload && (
              <button
                onClick={() => csvInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                📊 CSV Maliyet Ekle (Çoklu)
              </button>
            )}
          </div>

                {/* Info Footer */}
                <div className="mt-4 flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300">
                    <strong>Not:</strong> Bu öneriler opsiyoneldir. Eğer bu belgelere sahip değilseniz
                    veya analiz için gerekli görmüyorsanız bu adımı atlayabilirsiniz.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
