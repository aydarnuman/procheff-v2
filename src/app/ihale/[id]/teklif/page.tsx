"use client";

import { useParams, useRouter } from "next/navigation";
import { useIhaleStore } from "@/lib/stores/ihale-store";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ProposalCards } from "@/components/proposal/ProposalCards";

export default function TeklifHazirlamaPage() {
  const params = useParams();
  const router = useRouter();
  const { analysisHistory } = useIhaleStore();

  // ID'ye göre ihale bul (ID formatı: "analysis-0", "analysis-1", vb.)
  const { ihale, ihaleIndex } = useMemo(() => {
    // ID'den index'i çıkar
    const idStr = params.id as string;
    const indexMatch = idStr.match(/analysis-(\d+)/);
    if (!indexMatch) return { ihale: null, ihaleIndex: -1 };

    const index = parseInt(indexMatch[1], 10);
    return {
      ihale: analysisHistory[index] || null,
      ihaleIndex: index
    };
  }, [analysisHistory, params.id]);

  // İhale bulunamazsa
  if (!ihale) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <DollarSign className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">İhale Bulunamadı</h1>
            <p className="text-gray-400 mb-6">
              Aradığınız ihale analizi bulunamadı veya silinmiş olabilir.
            </p>
            <Link
              href="/ihale/liste"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              İhale Listesine Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-platinum-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href={`/ihale/${params.id}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            İhale Detayına Dön
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-surface-primary mb-2">
                Teklif Hazırlama
              </h1>
              <div className="flex items-center gap-3 text-surface-secondary">
                <Building2 className="w-5 h-5" />
                <span>{ihale.extracted_data.kurum}</span>
                <span>•</span>
                <span>{ihale.extracted_data.ihale_turu}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-accent-500/10 border border-accent-500/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-accent-400" />
              <div>
                <p className="text-xs text-surface-secondary">Tahmini Bütçe</p>
                <p className="text-lg font-bold text-surface-primary">
                  {ihale.extracted_data.tahmini_butce
                    ? `₺${(ihale.extracted_data.tahmini_butce / 1_000_000).toFixed(2)}M`
                    : "Belirtilmemiş"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ProposalCards - Aynı component + ihaleIndex prop */}
        <ProposalCards analysis={ihale} ihaleIndex={ihaleIndex} />
      </div>
    </div>
  );
}
