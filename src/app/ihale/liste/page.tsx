"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Filter,
  Grid,
  List,
  Calendar,
  DollarSign,
  Building2,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  FileX,
  Sparkles,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { useIhaleStore } from "@/lib/stores/ihale-store";
import { AIAnalysisResult, IhaleStatus } from "@/types/ai";

// İYİLEŞTİRME: Mock data kaldırıldı, Zustand store kullanılıyor!

const riskLabels = {
  dusuk: "Düşük Risk",
  orta: "Orta Risk",
  yuksek: "Yüksek Risk",
};

// Status Badge Component - Mühür görünümü
function StatusBadge({ status }: { status?: IhaleStatus }) {
  const effectiveStatus = status || "under_evaluation";

  const statusConfig = {
    completed: {
      icon: CheckCircle,
      label: "Tamamlandı",
      className: "bg-emerald-700/70 text-white border-emerald-500/30",
      iconColor: "text-emerald-100",
    },
    under_evaluation: {
      icon: Clock,
      label: "Değerlendirmede",
      className: "bg-amber-700/70 text-white border-amber-500/30",
      iconColor: "text-amber-100",
    },
    rejected: {
      icon: XCircle,
      label: "İstenmiyor",
      className: "bg-rose-700/70 text-white border-rose-500/30",
      iconColor: "text-rose-100",
    },
  };

  const config = statusConfig[effectiveStatus];
  const Icon = config.icon;

  return (
    <div
      className={`absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-md backdrop-blur-sm flex items-center gap-1 ${config.className}`}
      style={{
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
      }}
    >
      <Icon className={`w-2.5 h-2.5 ${config.iconColor}`} />
      <span className="uppercase tracking-wide">{config.label}</span>
    </div>
  );
}

// AIAnalysisResult'ı liste formatına dönüştür
interface IhaleListItem {
  id: string;
  kurum: string;
  ihaleTuru: string;
  tarih: string;
  butce: number | null;
  kisiSayisi: number | null;
  ogunSayisi: number | null;
  gunSayisi: number | null;
  riskSeviye: "dusuk" | "orta" | "yuksek";
  status?: IhaleStatus;
  rawData: AIAnalysisResult;
}

function transformAnalysisToListItem(
  analysis: AIAnalysisResult,
  index: number
): IhaleListItem {
  // Risk seviyesini operasyonel_riskler'den al
  const riskSeviye = analysis.contextual_analysis.operasyonel_riskler.seviye as
    | "dusuk"
    | "orta"
    | "yuksek";

  return {
    id: `analysis-${index}`,
    kurum: analysis.extracted_data.kurum,
    ihaleTuru: analysis.extracted_data.ihale_turu || "Belirtilmemiş",
    tarih: new Date().toISOString().split("T")[0], // Analiz tarihi
    butce: analysis.extracted_data.tahmini_butce,
    kisiSayisi: analysis.extracted_data.kisi_sayisi,
    ogunSayisi: analysis.extracted_data.ogun_sayisi,
    gunSayisi: analysis.extracted_data.gun_sayisi,
    riskSeviye,
    status: analysis.status || "under_evaluation",
    rawData: analysis,
  };
}

type ViewMode = "grid" | "list";

export default function IhaleListePage() {
  // Zustand Store'dan veri çek
  const { analysisHistory, removeFromHistory } = useIhaleStore();

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>("");

  // Analysis history'yi liste formatına dönüştür
  const ihaleler = useMemo(() => {
    return analysisHistory.map((analysis, index) =>
      transformAnalysisToListItem(analysis, index)
    );
  }, [analysisHistory]);

  // Filtreleme
  const filteredIhaleler = useMemo(() => {
    return ihaleler.filter((ihale) => {
      const matchesSearch = (ihale.kurum || '')
        .toLowerCase()
        .includes((searchTerm || '').toLowerCase());
      const matchesRisk = !riskFilter || ihale.riskSeviye === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [ihaleler, searchTerm, riskFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                İhale Listesi
              </h1>
              <p className="text-gray-400">
                {filteredIhaleler.length} analiz bulundu
              </p>
            </div>
            <Link
              href="/ihale/yeni-analiz"
              className="px-6 py-3 bg-blue-700/70 hover:bg-blue-600/80 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20"
            >
              Yeni Analiz
            </Link>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Kurum adı ile ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "grid"
                      ? "bg-slate-700/60 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                  title="Kart görünümü"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "list"
                      ? "bg-slate-700/60 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                  title="Liste görünümü"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
              >
                <Filter className="w-5 h-5" />
                <span>Filtre</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    filterOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Filter Panel */}
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 pt-4 border-t border-white/10"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Risk Seviyesi
                    </label>
                    <select
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value)}
                      title="Risk seviyesine göre filtrele"
                      aria-label="Risk Seviyesi Filtresi"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">Tümü</option>
                      <option value="dusuk">Düşük Risk</option>
                      <option value="orta">Orta Risk</option>
                      <option value="yuksek">Yüksek Risk</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      İhale Türü
                    </label>
                    <select
                      title="İhale türüne göre filtrele"
                      aria-label="İhale Türü Filtresi"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">Tümü</option>
                      <option value="acik">Açık İhale</option>
                      <option value="belli">Belli İstekliler Arası</option>
                      <option value="pazarlik">Pazarlık Usulü</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Tarih Aralığı
                    </label>
                    <select
                      title="Tarih aralığına göre filtrele"
                      aria-label="Tarih Aralığı Filtresi"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">Tümü</option>
                      <option value="today">Bugün</option>
                      <option value="week">Son 7 gün</option>
                      <option value="month">Son 30 gün</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Empty State */}
        {filteredIhaleler.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              {ihaleler.length === 0 ? (
                <FileX className="w-10 h-10 text-blue-400" />
              ) : (
                <Search className="w-10 h-10 text-blue-400" />
              )}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {ihaleler.length === 0
                ? "Henüz İhale Analizi Yok"
                : "Sonuç Bulunamadı"}
            </h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              {ihaleler.length === 0
                ? "İhale dokümanlarınızı yükleyip analiz etmeye başlayın. Tüm analizleriniz burada listelenecek."
                : "Arama kriterlerinize uygun ihale bulunamadı. Filtreleri değiştirmeyi deneyin."}
            </p>
            {ihaleler.length === 0 && (
              <Link
                href="/ihale/yeni-analiz"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                <span>İlk Analizi Başlat</span>
              </Link>
            )}
          </motion.div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && filteredIhaleler.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIhaleler.map((ihale, index) => {
              // Her ihale için orijinal index'i bul
              const originalIndex = analysisHistory.findIndex(
                a => a.extracted_data.kurum === ihale.kurum
              );
              return (
                <IhaleCard
                  key={ihale.id}
                  ihale={ihale}
                  index={index}
                  originalIndex={originalIndex}
                  onDelete={removeFromHistory}
                />
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && filteredIhaleler.length > 0 && (
          <div className="space-y-4">
            {filteredIhaleler.map((ihale, index) => {
              // Her ihale için orijinal index'i bul
              const originalIndex = analysisHistory.findIndex(
                a => a.extracted_data.kurum === ihale.kurum
              );
              return (
                <IhaleListItem
                  key={ihale.id}
                  ihale={ihale}
                  index={index}
                  originalIndex={originalIndex}
                  onDelete={removeFromHistory}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Grid Card Component
function IhaleCard({
  ihale,
  index,
  originalIndex,
  onDelete,
}: {
  ihale: any;
  index: number;
  originalIndex: number;
  onDelete: (index: number) => void;
}) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`"${ihale.kurum}" analizini silmek istediğinizden emin misiniz?`)) {
      onDelete(originalIndex);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative group/card"
    >
      {/* Delete Button - Hover'da görünür */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover/card:opacity-100 transition-opacity shadow-lg flex items-center justify-center"
        title="Analizi Sil"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <Link
        href={`/ihale/${ihale.id}`}
        className="block bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 rounded-xl p-6 transition-all group relative overflow-hidden"
      >
        {/* Status Badge - Mühür */}
        <StatusBadge status={ihale.status} />
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
          <div title={riskLabels[ihale.riskSeviye as keyof typeof riskLabels]}>
            <AlertTriangle className={`w-6 h-6 ${
              ihale.riskSeviye === 'dusuk' ? 'text-emerald-400' :
              ihale.riskSeviye === 'orta' ? 'text-amber-400' :
              'text-rose-400'
            }`} />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-white font-semibold mb-2 line-clamp-2 group-hover:text-blue-300 transition-colors">
          {ihale.kurum}
        </h3>
        <p className="text-gray-400 text-sm mb-4">{ihale.ihaleTuru}</p>

        {/* Stats */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Bütçe</span>
            <span className="text-white font-medium">
              {ihale.butce
                ? `₺${(ihale.butce / 1_000_000).toFixed(1)}M`
                : "Belirtilmemiş"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Yemek Yiyen</span>
            <span className="text-white font-medium">
              {ihale.kisiSayisi || "Belirtilmemiş"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Tarih</span>
            <span className="text-white font-medium">
              {new Date(ihale.tarih).toLocaleDateString("tr-TR")}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <span className="text-blue-400 text-sm font-medium group-hover:text-blue-300 transition-colors">
            Detayları Görüntüle
          </span>
          <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}

// List Item Component
function IhaleListItem({
  ihale,
  index,
  originalIndex,
  onDelete,
}: {
  ihale: any;
  index: number;
  originalIndex: number;
  onDelete: (index: number) => void;
}) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`"${ihale.kurum}" analizini silmek istediğinizden emin misiniz?`)) {
      onDelete(originalIndex);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative group/item"
    >
      {/* Delete Button - Hover'da görünür */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg flex items-center justify-center"
        title="Analizi Sil"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <Link
        href={`/ihale/${ihale.id}`}
        className="block bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 rounded-xl p-4 transition-all group relative overflow-hidden"
      >
        {/* Status Badge - Mühür */}
        <StatusBadge status={ihale.status} />
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold mb-1 truncate group-hover:text-blue-300 transition-colors">
              {ihale.kurum}
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{ihale.ihaleTuru}</span>
              <span>•</span>
              <span>{new Date(ihale.tarih).toLocaleDateString("tr-TR")}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Bütçe</p>
              <p className="text-white font-semibold">
                {ihale.butce
                  ? `₺${(ihale.butce / 1_000_000).toFixed(1)}M`
                  : "N/A"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Yemek Yiyen</p>
              <p className="text-white font-semibold">
                {ihale.kisiSayisi || "N/A"}
              </p>
            </div>
          </div>

          {/* Risk Icon */}
          <div className="flex items-center gap-2 flex-shrink-0" title={riskLabels[ihale.riskSeviye as keyof typeof riskLabels]}>
            <AlertTriangle className={`w-5 h-5 ${
              ihale.riskSeviye === 'dusuk' ? 'text-emerald-400' :
              ihale.riskSeviye === 'orta' ? 'text-amber-400' :
              'text-rose-400'
            }`} />
          </div>

          {/* Arrow */}
          <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}
