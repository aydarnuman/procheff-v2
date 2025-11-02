"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, FileText, Plus, X, ChevronRight } from "lucide-react";
import { BelgeTuru, BELGE_TURU_LABELS } from "@/types/ai";

interface MissingDocumentSuggestionProps {
  uploadedDocuments: {
    fileName: string;
    detectedType?: BelgeTuru;
    confidence?: number;
  }[];
  onUploadClick?: (docType: BelgeTuru) => void;
  onDismiss?: () => void;
}

// İlgili belge önerileri - hangi belge türü için hangi belgeler gerekli?
const DOCUMENT_RELATIONSHIPS: Record<BelgeTuru, BelgeTuru[]> = {
  teknik_sartname: ["ihale_ilani", "idari_sartname", "sozlesme_tasarisi"],
  ihale_ilani: ["teknik_sartname", "idari_sartname"],
  sozlesme_tasarisi: ["teknik_sartname", "ihale_ilani", "idari_sartname"],
  idari_sartname: ["teknik_sartname", "ihale_ilani"],
  fiyat_teklif_mektubu: ["teknik_sartname", "ihale_ilani"],
  diger: [],
  belirsiz: []
};

export function MissingDocumentSuggestion({
  uploadedDocuments,
  onUploadClick,
  onDismiss
}: MissingDocumentSuggestionProps) {
  const [dismissed, setDismissed] = useState(false);

  // Yüklenen belge türlerini tespit et
  const uploadedTypes = new Set(
    uploadedDocuments
      .map(doc => doc.detectedType)
      .filter((type): type is BelgeTuru => type !== undefined && type !== "belirsiz")
  );

  // Eksik belgeleri hesapla
  const suggestedDocuments = new Set<BelgeTuru>();

  uploadedTypes.forEach(docType => {
    const related = DOCUMENT_RELATIONSHIPS[docType];
    related.forEach(relatedType => {
      if (!uploadedTypes.has(relatedType)) {
        suggestedDocuments.add(relatedType);
      }
    });
  });

  // Hiç eksik belge yoksa veya dismissed ise gösterme
  if (suggestedDocuments.size === 0 || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleUploadClick = (docType: BelgeTuru) => {
    onUploadClick?.(docType);
  };

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
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors z-10"
          title="Kapat"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">
                📎 Bağlantılı Belgeler
              </h3>
              <p className="text-sm text-gray-300">
                Yüklediğiniz belgelere bağlı olarak eksik belgeler tespit edildi.
                Daha doğru analiz için bu belgeleri de eklemenizi öneririz.
              </p>
            </div>
          </div>

          {/* Yüklenen Belgeler Özeti */}
          <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">Yüklenen Belgeler:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(uploadedTypes).map(type => (
                <div
                  key={type}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-xs"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-green-300">{BELGE_TURU_LABELS[type]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Eksik Belgeler */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Önerilen Belgeler
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from(suggestedDocuments).map(docType => (
                <motion.button
                  key={docType}
                  onClick={() => handleUploadClick(docType)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between p-4 bg-gray-800/70 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-lg transition-colors">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">
                        {BELGE_TURU_LABELS[docType]}
                      </p>
                      <p className="text-xs text-gray-400">
                        {getDocumentDescription(docType)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 rounded group-hover:bg-blue-500/30 transition-colors">
                      <Plus className="w-4 h-4 text-blue-400" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-4 flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
            <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">
              <strong>Not:</strong> Bu öneriler opsiyoneldir. Eğer bu belgelere sahip değilseniz
              veya analiz için gerekli görmüyorsanız bu adımı atlayabilirsiniz.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Belge türü açıklamaları
function getDocumentDescription(type: BelgeTuru): string {
  const descriptions: Record<BelgeTuru, string> = {
    teknik_sartname: "Menü, gramaj ve kalite standartları",
    ihale_ilani: "İhale tarihleri ve başvuru şartları",
    sozlesme_tasarisi: "Sözleşme maddeleri ve ceza koşulları",
    idari_sartname: "İdari kurallar ve değerlendirme",
    fiyat_teklif_mektubu: "Fiyat cetveli ve teklif tutarı",
    diger: "Diğer ek belgeler",
    belirsiz: "Belge türü tespit edilemedi"
  };
  return descriptions[type];
}
