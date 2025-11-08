"use client";

import { useParams, useRouter } from "next/navigation";
import { useIhaleStore } from "@/lib/stores/ihale-store";
import { EnhancedAnalysisResults } from "@/components/ai/EnhancedAnalysisResults";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export default function IhaleDetailPage() {
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
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">İhale Bulunamadı</h1>
            <p className="text-gray-400 mb-6">
              Aradığınız ihale analizi bulunamadı veya silinmiş olabilir.
            </p>
            <Link
              href="/ihale/workspace"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Workspace'e Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
      <EnhancedAnalysisResults
        analysis={ihale}
        onReturnToView={() => router.push('/ihale/workspace')}
        onNewAnalysis={() => router.push('/ihale/workspace')}
        autoStartDeepAnalysis={false}
      />
    </div>
  );
}
