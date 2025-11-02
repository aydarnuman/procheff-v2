"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  Shield,
  FileText,
  UtensilsCrossed,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { AIAnalysisResult } from "@/types/ai";

interface DashboardAnalysisProps {
  analysis: AIAnalysisResult;
}

export function DashboardAnalysis({ analysis }: DashboardAnalysisProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    risks: false,
    technical: false,
    menu: false,
    strategic: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const finansalKontrol = analysis.extracted_data.finansal_kontrol;

  return (
    <div className="space-y-6">
      {/* Top Row: Finansal Durum + Özet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Finansal Durum Kartı (2/3 genişlik) */}
        {finansalKontrol && (
          <div className="lg:col-span-2">
            <div
              className={`p-6 rounded-xl border-2 ${
                finansalKontrol.girilir_mi === "EVET"
                  ? "border-green-500/30 bg-green-500/5"
                  : finansalKontrol.girilir_mi === "DİKKATLİ"
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    💰 Finansal Durum
                    {finansalKontrol.girilir_mi === "EVET" ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : finansalKontrol.girilir_mi === "DİKKATLİ" ? (
                      <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400" />
                    )}
                  </h3>
                  <p className="text-sm text-gray-400">{finansalKontrol.gerekce}</p>
                </div>
                <div
                  className={`px-4 py-2 rounded-lg font-bold text-lg ${
                    finansalKontrol.girilir_mi === "EVET"
                      ? "bg-green-500/20 text-green-400"
                      : finansalKontrol.girilir_mi === "DİKKATLİ"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {finansalKontrol.girilir_mi}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-black/20 p-4 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Birim Fiyat</div>
                  <div className="text-2xl font-bold text-white">
                    {finansalKontrol.birim_fiyat?.toFixed(2)}₺
                  </div>
                </div>
                <div className="bg-black/20 p-4 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Kâr Marjı</div>
                  <div
                    className={`text-2xl font-bold ${
                      (finansalKontrol.kar_marji_tahmin || 0) >= 10
                        ? "text-green-400"
                        : (finansalKontrol.kar_marji_tahmin || 0) >= 5
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    %{finansalKontrol.kar_marji_tahmin}
                  </div>
                </div>
                <div className="bg-black/20 p-4 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Et Riski</div>
                  <div
                    className={`text-lg font-bold ${
                      finansalKontrol.et_bagimliligi_riski === "düşük"
                        ? "text-green-400"
                        : finansalKontrol.et_bagimliligi_riski === "orta"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {finansalKontrol.et_bagimliligi_riski?.toUpperCase()}
                  </div>
                </div>
                <div className="bg-black/20 p-4 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Nakit İhtiyacı</div>
                  <div className="text-xl font-bold text-white">
                    {(finansalKontrol.nakit_akisi_ihtiyaci || 0).toLocaleString()}₺
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Özet Kartı (1/3 genişlik) */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            İhale Özeti
          </h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400">Kurum</div>
              <div className="text-sm text-white font-medium">
                {analysis.extracted_data.kurum}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400">Kişi Sayısı</div>
                <div className="text-2xl font-bold text-white">
                  {analysis.extracted_data.kisi_sayisi?.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Öğün/Gün</div>
                <div className="text-2xl font-bold text-white">
                  {analysis.extracted_data.ogun_sayisi}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Tahmini Bütçe</div>
              <div className="text-xl font-bold text-green-400">
                {analysis.extracted_data.tahmini_butce?.toLocaleString() || "Belirtilmemiş"} TL
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Süre</div>
              <div className="text-sm text-white">
                {analysis.extracted_data.gun_sayisi} gün
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stratejik Öneriler */}
      {analysis.contextual_analysis && (
        <div className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-xl">
          <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            Stratejik Öneriler
          </h3>
          <p className="text-gray-300 leading-relaxed">
            {analysis.contextual_analysis.genel_oneri}
          </p>
        </div>
      )}

      {/* Katlanabilir Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Riskler */}
        <AccordionCard
          title="⚠️ Riskler"
          icon={<Shield className="w-5 h-5" />}
          isOpen={openSections.risks}
          onToggle={() => toggleSection("risks")}
          count={analysis.extracted_data.riskler.length}
        >
          <ul className="space-y-2">
            {analysis.extracted_data.riskler.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">{risk}</span>
              </li>
            ))}
          </ul>
        </AccordionCard>

        {/* Teknik Şartlar */}
        <AccordionCard
          title="📋 Teknik Şartlar"
          icon={<FileText className="w-5 h-5" />}
          isOpen={openSections.technical}
          onToggle={() => toggleSection("technical")}
          count={analysis.extracted_data.ozel_sartlar.length}
        >
          <ul className="space-y-2">
            {analysis.extracted_data.ozel_sartlar.map((sart, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mt-1.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">{sart}</span>
              </li>
            ))}
          </ul>

          {/* Sertifikasyonlar */}
          {analysis.extracted_data.sertifikasyon_etiketleri &&
           analysis.extracted_data.sertifikasyon_etiketleri.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-400" />
                Sertifikasyonlar
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.extracted_data.sertifikasyon_etiketleri.map((cert, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}
        </AccordionCard>

        {/* Menü Programı */}
        {analysis.extracted_data.ornek_menu_basliklari &&
         analysis.extracted_data.ornek_menu_basliklari.length > 0 && (
          <AccordionCard
            title="🍽️ Örnek Menü Başlıkları"
            icon={<UtensilsCrossed className="w-5 h-5" />}
            isOpen={openSections.menu}
            onToggle={() => toggleSection("menu")}
            count={analysis.extracted_data.ornek_menu_basliklari.length}
          >
            <div className="flex flex-wrap gap-2">
              {analysis.extracted_data.ornek_menu_basliklari.slice(0, 10).map((menuItem, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20"
                >
                  {menuItem}
                </span>
              ))}
            </div>
          </AccordionCard>
        )}

        {/* Operasyonel Riskler (Bağlamsal Analiz) */}
        {analysis.contextual_analysis && (
          <AccordionCard
            title="🎯 Operasyonel Değerlendirme"
            icon={<DollarSign className="w-5 h-5" />}
            isOpen={openSections.strategic}
            onToggle={() => toggleSection("strategic")}
            badge={analysis.contextual_analysis.operasyonel_riskler.seviye}
          >
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Risk Faktörleri:</h4>
                <ul className="space-y-1">
                  {analysis.contextual_analysis.operasyonel_riskler.faktorler.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5" />
                      <span className="text-xs text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Öneriler:</h4>
                <ul className="space-y-1">
                  {analysis.contextual_analysis.operasyonel_riskler.oneriler.map((o, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5" />
                      <span className="text-xs text-gray-300">{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AccordionCard>
        )}
      </div>
    </div>
  );
}

// Accordion Card Component
interface AccordionCardProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  count?: number;
  badge?: string;
}

function AccordionCard({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  count,
  badge,
}: AccordionCardProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-400">{icon}</div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {count !== undefined && (
            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
              {count}
            </span>
          )}
          {badge && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                badge === "dusuk"
                  ? "bg-green-500/20 text-green-400"
                  : badge === "orta"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {badge.toUpperCase()}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-gray-700"
        >
          <div className="p-4">{children}</div>
        </motion.div>
      )}
    </div>
  );
}
