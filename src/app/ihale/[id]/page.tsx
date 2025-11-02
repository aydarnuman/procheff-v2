"use client";

import { useParams, useRouter } from "next/navigation";
import { useIhaleStore } from "@/lib/stores/ihale-store";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  TrendingDown,
  Award,
  Shield,
  Target,
  Utensils,
  Eye,
  CheckCircle,
  XCircle,
  CircleDashed,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProposalModal } from "@/components/ihale/ProposalModal";
import { IhaleStatus } from "@/types/ai";

export default function IhaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { analysisHistory, updateStatus } = useIhaleStore();
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

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

  // Durum güncelleme fonksiyonu
  const handleStatusUpdate = (status: IhaleStatus) => {
    if (ihaleIndex !== -1) {
      updateStatus(ihaleIndex, status);
    }
  };

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

  const { extracted_data, contextual_analysis, processing_metadata } = ihale;

  // Risk seviyesi hesaplama
  const riskLevel = contextual_analysis.operasyonel_riskler.seviye;
  const riskColor =
    riskLevel === "yuksek"
      ? "text-red-400 bg-red-500/10 border-red-500/30"
      : riskLevel === "orta"
      ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
      : "text-green-400 bg-green-500/10 border-green-500/30";

  // Finansal karar rengi
  const finansalKarar = extracted_data.finansal_kontrol?.girilir_mi;
  const kararColor =
    finansalKarar === "EVET"
      ? "text-green-400 bg-green-500/10 border-green-500/30"
      : finansalKarar === "HAYIR"
      ? "text-red-400 bg-red-500/10 border-red-500/30"
      : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href="/ihale/liste"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            İhale Listesine Dön
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{extracted_data.kurum}</h1>
              <p className="text-gray-400">{extracted_data.ihale_turu}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Teklif Hazırla/Görüntüle Butonu */}
              <Link
                href={`/ihale/${params.id}/teklif`}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 border border-green-500 rounded-lg transition-colors shadow-lg"
              >
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">
                  {ihale.proposal_data ? "Teklifi Düzenle" : "Teklif Hazırla"}
                </span>
              </Link>

              {/* Teklif Görüntüle (Modal) */}
              {ihale.proposal_data && (
                <button
                  onClick={() => setIsProposalModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-500 rounded-lg transition-colors"
                >
                  <Eye className="w-5 h-5" />
                  <span className="font-medium">Özet Görüntüle</span>
                </button>
              )}

              {/* Güven Skoru */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                <Award className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-xs text-gray-400">Güven Skoru</p>
                  <p className="text-lg font-bold">
                    {(processing_metadata.confidence_score * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Durum Belirleme Butonları */}
          <div className="mt-6 flex items-center gap-4">
            <span className="text-sm text-gray-400">İhale Durumu:</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusUpdate("completed")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  ihale.status === "completed"
                    ? "bg-green-600 text-white border-2 border-green-400"
                    : "bg-green-600/20 text-green-400 border border-green-600/50 hover:bg-green-600/30"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Olumlu</span>
              </button>

              <button
                onClick={() => handleStatusUpdate("under_evaluation")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  ihale.status === "under_evaluation" || !ihale.status
                    ? "bg-yellow-600 text-white border-2 border-yellow-400"
                    : "bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 hover:bg-yellow-600/30"
                }`}
              >
                <CircleDashed className="w-4 h-4" />
                <span>Karamsar</span>
              </button>

              <button
                onClick={() => handleStatusUpdate("rejected")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  ihale.status === "rejected"
                    ? "bg-red-600 text-white border-2 border-red-400"
                    : "bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600/30"
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Olumsuz</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Ana Bilgiler Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <InfoCard
            icon={<UserCog className="w-5 h-5" />}
            label="Personel Sayısı"
            value={extracted_data.personel_sayisi?.toLocaleString() || "Belirtilmemiş"}
            color="yellow"
          />
          <InfoCard
            icon={<Users className="w-5 h-5" />}
            label="Yemek Yiyen Kişi Sayısı"
            value={extracted_data.kisi_sayisi?.toLocaleString() || "Belirtilmemiş"}
            color="blue"
          />
          <InfoCard
            icon={<Utensils className="w-5 h-5" />}
            label="Öğün Sayısı"
            value={extracted_data.ogun_sayisi?.toLocaleString() || "Belirtilmemiş"}
            color="purple"
          />
          <InfoCard
            icon={<Calendar className="w-5 h-5" />}
            label="Gün Sayısı"
            value={extracted_data.gun_sayisi?.toLocaleString() || "Belirtilmemiş"}
            color="green"
          />
          <InfoCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Tahmini Bütçe"
            value={
              extracted_data.tahmini_butce
                ? `₺${(extracted_data.tahmini_butce / 1_000_000).toFixed(2)}M`
                : "Belirtilmemiş"
            }
            color="yellow"
          />
        </div>

        {/* İki Kolonlu Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol Kolon - Ana İçerik */}
          <div className="lg:col-span-2 space-y-6">
            {/* Finansal Kontrol */}
            {extracted_data.finansal_kontrol && (
              <Section title="Finansal Analiz" icon={<TrendingUp className="w-5 h-5" />}>
                <div className="space-y-4">
                  {/* Karar Badge */}
                  <div className={`p-4 rounded-lg border ${kararColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Karar:</span>
                      <span className="text-xl font-bold">
                        {finansalKarar || "Belirsiz"}
                      </span>
                    </div>
                    <p className="text-sm opacity-80">
                      {extracted_data.finansal_kontrol.gerekce}
                    </p>
                  </div>

                  {/* Finansal Metrikler */}
                  <div className="grid grid-cols-2 gap-4">
                    {extracted_data.finansal_kontrol.birim_fiyat && (
                      <MetricItem
                        label="Birim Fiyat"
                        value={`₺${extracted_data.finansal_kontrol.birim_fiyat.toFixed(2)}`}
                      />
                    )}
                    {extracted_data.finansal_kontrol.kar_marji_tahmin && (
                      <MetricItem
                        label="Kar Marjı Tahmin"
                        value={`%${extracted_data.finansal_kontrol.kar_marji_tahmin.toFixed(1)}`}
                      />
                    )}
                    {extracted_data.finansal_kontrol.et_bagimliligi_riski && (
                      <MetricItem
                        label="Et Bağımlılığı Riski"
                        value={extracted_data.finansal_kontrol.et_bagimliligi_riski}
                      />
                    )}
                    {extracted_data.finansal_kontrol.nakit_akisi_ihtiyaci && (
                      <MetricItem
                        label="Nakit Akışı İhtiyacı"
                        value={`₺${(
                          extracted_data.finansal_kontrol.nakit_akisi_ihtiyaci / 1_000_000
                        ).toFixed(2)}M`}
                      />
                    )}
                  </div>

                  {extracted_data.finansal_kontrol.sinir_deger_uyarisi && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-sm text-yellow-400">
                        <span className="font-semibold">Uyarı:</span>{" "}
                        {extracted_data.finansal_kontrol.sinir_deger_uyarisi}
                      </p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Operasyonel Riskler */}
            <Section title="Operasyonel Risk Analizi" icon={<Shield className="w-5 h-5" />}>
              <div className="space-y-4">
                {/* Risk Seviyesi */}
                <div className={`p-4 rounded-lg border ${riskColor}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Risk Seviyesi:</span>
                    <span className="text-lg font-bold uppercase">
                      {riskLevel === "yuksek"
                        ? "Yüksek"
                        : riskLevel === "orta"
                        ? "Orta"
                        : "Düşük"}
                    </span>
                  </div>
                </div>

                {/* Risk Faktörleri */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    Risk Faktörleri:
                  </h4>
                  <ul className="space-y-2">
                    {contextual_analysis.operasyonel_riskler.faktorler.map(
                      (faktor, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{faktor}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>

                {/* Öneriler */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    Öneriler:
                  </h4>
                  <ul className="space-y-2">
                    {contextual_analysis.operasyonel_riskler.oneriler.map(
                      (oneri, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{oneri}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </Section>

            {/* Maliyet Sapma Olasılığı */}
            <Section
              title="Maliyet Sapma Analizi"
              icon={<TrendingDown className="w-5 h-5" />}
            >
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">Sapma Olasılığı:</span>
                    <span className="text-2xl font-bold text-red-400">
                      %{contextual_analysis.maliyet_sapma_olasiligi.oran}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    Sebepler:
                  </h4>
                  <ul className="space-y-2">
                    {contextual_analysis.maliyet_sapma_olasiligi.sebepler.map(
                      (sebep, idx) => (
                        <li key={idx} className="text-sm text-gray-300">
                          • {sebep}
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    Önlem Önerileri:
                  </h4>
                  <ul className="space-y-2">
                    {contextual_analysis.maliyet_sapma_olasiligi.onlem_oneriler.map(
                      (oneri, idx) => (
                        <li key={idx} className="text-sm text-gray-300">
                          • {oneri}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </Section>
          </div>

          {/* Sağ Kolon - Yan Bilgiler */}
          <div className="space-y-6">
            {/* Tarihler */}
            <Section title="Önemli Tarihler" icon={<Calendar className="w-5 h-5" />}>
              <div className="space-y-3">
                {extracted_data.ihale_tarihi && (
                  <DateItem label="İhale Tarihi" date={extracted_data.ihale_tarihi} />
                )}
                {extracted_data.teklif_son_tarih && (
                  <DateItem
                    label="Teklif Son Tarih"
                    date={extracted_data.teklif_son_tarih}
                  />
                )}
                {extracted_data.ise_baslama_tarih && (
                  <DateItem
                    label="İşe Başlama"
                    date={extracted_data.ise_baslama_tarih}
                  />
                )}
                {extracted_data.teslim_suresi && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400">Teslim Süresi</p>
                      <p className="text-sm">{extracted_data.teslim_suresi}</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* Zaman Uygunluğu */}
            <Section title="Zaman Uygunluğu" icon={<Clock className="w-5 h-5" />}>
              <div className="space-y-2">
                <div
                  className={`p-3 rounded-lg border ${
                    contextual_analysis.zaman_uygunlugu.durum === "yeterli"
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : contextual_analysis.zaman_uygunlugu.durum === "sinirda"
                      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  <p className="text-sm font-semibold uppercase">
                    {contextual_analysis.zaman_uygunlugu.durum === "yeterli"
                      ? "Yeterli"
                      : contextual_analysis.zaman_uygunlugu.durum === "sinirda"
                      ? "Sınırda"
                      : "Yetersiz"}
                  </p>
                </div>
                <p className="text-sm text-gray-300">
                  {contextual_analysis.zaman_uygunlugu.aciklama}
                </p>
              </div>
            </Section>

            {/* Özel Şartlar */}
            {extracted_data.ozel_sartlar && extracted_data.ozel_sartlar.length > 0 && (
              <Section title="Özel Şartlar" icon={<FileText className="w-5 h-5" />}>
                <ul className="space-y-2">
                  {extracted_data.ozel_sartlar.map((sart, idx) => (
                    <li key={idx} className="text-sm text-gray-300">
                      • {sart}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Riskler */}
            {extracted_data.riskler && extracted_data.riskler.length > 0 && (
              <Section title="Tespit Edilen Riskler" icon={<AlertTriangle className="w-5 h-5" />}>
                <ul className="space-y-2">
                  {extracted_data.riskler.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-400 text-xs mt-1">▪</span>
                      <span className="text-sm text-gray-300">{risk}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Genel Öneri */}
            <Section title="Genel Öneri" icon={<Target className="w-5 h-5" />}>
              <p className="text-sm text-gray-300">
                {contextual_analysis.genel_oneri}
              </p>
            </Section>

            {/* Processing Metadata */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">AI Provider:</span>
                <span className="text-white">{processing_metadata.ai_provider}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">İşlem Süresi:</span>
                <span className="text-white">
                  {(processing_metadata.processing_time / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Teklif Modal */}
      <ProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        proposalData={ihale.proposal_data}
      />
    </div>
  );
}

// Yardımcı Bileşenler
function InfoCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "purple" | "green" | "yellow";
}) {
  const colorClasses = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-4 rounded-lg border ${colorClasses[color]}`}
    >
      <div className="flex items-center gap-3">
        <div>{icon}</div>
        <div>
          <p className="text-xs opacity-80">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="text-blue-400">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function DateItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-start gap-2">
      <Calendar className="w-4 h-4 text-blue-400 mt-0.5" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm">{date}</p>
      </div>
    </div>
  );
}
