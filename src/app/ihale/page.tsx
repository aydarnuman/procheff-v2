"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Plus,
  List,
  BarChart3,
  Clock,
  DollarSign,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useIhaleStore } from "@/lib/stores/ihale-store";
import { useMemo } from "react";
import { CacheStatsPanel } from "@/components/ai/CacheStatsPanel";

const riskColors = {
  dusuk: "text-green-400 bg-green-500/10 border-green-500/30",
  orta: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  yuksek: "text-red-400 bg-red-500/10 border-red-500/30",
};

const riskLabels = {
  dusuk: "Düşük Risk",
  orta: "Orta Risk",
  yuksek: "Yüksek Risk",
};

export default function IhaleDashboard() {
  // Zustand store'dan gerçek veriyi çek
  const { analysisHistory } = useIhaleStore();

  // Stats hesapla
  const stats = useMemo(() => {
    const totalAnalyses = analysisHistory.length;

    // Toplam bütçe - sadece bütçesi olan analizler
    const totalBudget = analysisHistory.reduce((sum, analysis) => {
      const budget = analysis.extracted_data.tahmini_butce;
      return sum + (budget || 0);
    }, 0);

    // Yüksek riskli analiz sayısı
    const highRiskCount = analysisHistory.filter(
      (a) => a.contextual_analysis?.operasyonel_riskler?.seviye === "yuksek"
    ).length;

    // Son analizler (timestamp olmadığı için tümünü sayıyoruz)
    const lastWeekCount = analysisHistory.length;

    return { totalAnalyses, totalBudget, highRiskCount, lastWeekCount };
  }, [analysisHistory]);

  // Son 3 analizi al
  const recentAnalyses = useMemo(() => {
    return analysisHistory
      .slice(-3) // Son 3'ü al
      .reverse() // Tersine çevir (en yeni önce)
      .map((analysis, index) => ({
        id: `analysis-${index}`,
        kurum: analysis.extracted_data.kurum || "Bilinmeyen Kurum",
        tarih: new Date().toISOString().split('T')[0],
        butce: analysis.extracted_data.tahmini_butce || 0,
        riskSeviye: (analysis.contextual_analysis?.operasyonel_riskler?.seviye || "orta") as "dusuk" | "orta" | "yuksek",
        durum: "completed" as const,
      }));
  }, [analysisHistory]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              İhale Merkezi
            </h1>
            <p className="text-gray-400">
              Yapay zeka destekli ihale analiz sistemi
            </p>
          </div>

          <Link
            href="/ihale/workspace"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Analiz</span>
          </Link>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Toplam Analiz"
            value={stats.totalAnalyses}
            icon={FileText}
            color="blue"
            delay={0.1}
          />
          <StatCard
            title="Toplam Bütçe"
            value={
              stats.totalBudget > 0
                ? `₺${(stats.totalBudget / 1_000_000).toFixed(1)}M`
                : "Veri Yok"
            }
            icon={DollarSign}
            color="green"
            delay={0.2}
          />
          <StatCard
            title="Yüksek Riskli"
            value={stats.highRiskCount}
            icon={AlertTriangle}
            color="red"
            delay={0.3}
          />
          <StatCard
            title="Son 7 Gün"
            value={stats.lastWeekCount}
            icon={TrendingUp}
            color="purple"
            delay={0.4}
          />
        </div>

        {/* Cache Stats Panel - GEÇİCİ OLARAK KAPALI (test için) */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <CacheStatsPanel />
        </motion.div> */}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <QuickActionCard
            title="Yeni Analiz"
            description="İhale şartnamesi yükle ve AI ile analiz et"
            icon={Plus}
            href="/ihale/workspace"
            color="blue"
          />
          <QuickActionCard
            title="İhale Listesi"
            description="Tüm analizlenen ihaleleri görüntüle"
            icon={List}
            href="/ihale/liste"
            color="purple"
          />
          <QuickActionCard
            title="Karşılaştırma"
            description="İhaleleri karşılaştır ve raporla"
            icon={BarChart3}
            href="/ihale/karsilastirma"
            color="green"
          />
        </motion.div>

        {/* Recent Analyses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-400" />
              Son Analizler
            </h2>
            <Link
              href="/ihale/liste"
              className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <span>Tümünü Gör</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {recentAnalyses.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Henüz Analiz Yok
                </h3>
                <p className="text-gray-400 mb-6">
                  İlk ihale analizinizi oluşturmak için başlayın
                </p>
                <Link
                  href="/ihale/workspace"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Yeni Analiz Başlat</span>
                </Link>
              </div>
            ) : (
              recentAnalyses.map((analiz, index) => (
                <motion.div
                  key={analiz.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <Link
                    href="/ihale/liste"
                    className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all hover:border-blue-500/50 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold mb-2 truncate group-hover:text-blue-300 transition-colors">
                          {analiz.kurum}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(analiz.tarih).toLocaleDateString("tr-TR")}
                          </span>
                          {analiz.butce > 0 && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              ₺{(analiz.butce / 1_000_000).toFixed(1)}M
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            riskColors[
                              analiz.riskSeviye as keyof typeof riskColors
                            ]
                          }`}
                        >
                          {
                            riskLabels[
                              analiz.riskSeviye as keyof typeof riskLabels
                            ]
                          }
                        </span>
                        <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: "blue" | "green" | "red" | "purple";
  delay: number;
}

function StatCard({ title, value, icon: Icon, color, delay }: StatCardProps) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400",
    green:
      "from-green-500/20 to-green-600/20 border-green-500/30 text-green-400",
    red: "from-red-500/20 to-red-600/20 border-red-500/30 text-red-400",
    purple:
      "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-xl border rounded-2xl p-6`}
    >
      <div className="flex items-center justify-between mb-4">
        <Icon className="w-8 h-8" />
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-gray-400 text-sm mb-1">{title}</h3>
      <p className="text-white text-3xl font-bold">{value}</p>
    </motion.div>
  );
}

// Quick Action Card Component
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: "blue" | "purple" | "green";
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: QuickActionCardProps) {
  const colorClasses = {
    blue: "from-blue-500/10 to-blue-600/10 border-blue-500/30 hover:border-blue-500/50 text-blue-400",
    purple:
      "from-purple-500/10 to-purple-600/10 border-purple-500/30 hover:border-purple-500/50 text-purple-400",
    green:
      "from-green-500/10 to-green-600/10 border-green-500/30 hover:border-green-500/50 text-green-400",
  };

  return (
    <Link
      href={href}
      className={`block bg-gradient-to-br ${colorClasses[color]} backdrop-blur-xl border rounded-2xl p-6 transition-all hover:scale-105 group`}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold mb-1">{title}</h3>
          <p className="text-gray-400 text-sm">{description}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
      </div>
    </Link>
  );
}
