"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  FileText,
  Calendar,
  AlertTriangle,
  CreditCard,
  Package,
  UtensilsCrossed,
  Save,
  Download,
  Settings,
} from "lucide-react";
import { AIAnalysisResult } from "@/types/ai";
import { useProposalStore } from "@/lib/stores/proposal-store";
import { useIhaleStore } from "@/lib/stores/ihale-store";
import { CostCard } from "./cards/CostCard";
import { MealCostCard } from "./cards/MealCostCard";
import { PersonnelCard } from "./cards/PersonnelCard";
import { DocumentsCard } from "./cards/DocumentsCard";
import { MenuCard } from "./cards/MenuCard";
import { EquipmentCard } from "./cards/EquipmentCard";
import { OperationalCard } from "./cards/OperationalCard";
import { PaymentCard } from "./cards/PaymentCard";
import { TimelineCard } from "./cards/TimelineCard";

interface ProposalCardsProps {
  analysis: AIAnalysisResult;
  ihaleIndex?: number; // Otomatik kaydetme için ihale index'i
}

type CardType =
  | "cost"
  | "meal"
  | "personnel"
  | "documents"
  | "timeline"
  | "risk"
  | "payment"
  | "materials"
  | "menu"
  | "operational";

export function ProposalCards({ analysis, ihaleIndex }: ProposalCardsProps) {
  const [activeCard, setActiveCard] = useState<CardType>("cost");

  // Zustand store'dan proposal data'yı al
  const { proposalData, setProposalData, updateProposalData } = useProposalStore();

  // İhale store - teklifi kaydetmek için
  const { analysisHistory, updateProposalData: updateIhaleProposal } = useIhaleStore();

  // Teklifi kaydetme fonksiyonu
  const handleSaveProposal = () => {
    // Eğer ihaleIndex prop olarak verilmişse, direkt onu kullan
    let index = ihaleIndex !== undefined ? ihaleIndex : -1;

    // Eğer prop verilmemişse, eski yöntemle bul
    if (index === -1) {
      // Strategi 1: Kurum ve processing_time ile eşleştir
      index = analysisHistory.findIndex(
        (a) =>
          a.extracted_data.kurum === analysis.extracted_data.kurum &&
          a.processing_metadata.processing_time === analysis.processing_metadata.processing_time
      );

      // Strategi 2: Eğer bulunamazsa, kurum adı ve en yakın tarihle eşleştir
      if (index === -1) {
        // Son eklenen aynı isimli kurum
        const sameKurumIndices = analysisHistory
          .map((a, i) => ({ a, i }))
          .filter(({ a }) => a.extracted_data.kurum === analysis.extracted_data.kurum)
          .sort(
            (x, y) =>
              y.a.processing_metadata.processing_time - x.a.processing_metadata.processing_time
          );

        if (sameKurumIndices.length > 0) {
          index = sameKurumIndices[0].i;
        }
      }

      // Strategi 3: Eğer hala bulunamazsa, en son eklenen analiz olmalı
      if (index === -1 && analysisHistory.length > 0) {
        index = analysisHistory.length - 1;
      }
    }

    if (index !== -1) {
      // Teklif verisini ihale analizine kaydet
      updateIhaleProposal(index, proposalData);
      console.log(`✅ Teklif kaydedildi: ${analysis.extracted_data.kurum} (index: ${index})`);
    } else {
      console.error("❌ Hata: İhale analizi bulunamadı!");
      alert("Hata: İhale analizi bulunamadı. Lütfen önce ihale analizini yapın.");
    }
  };

  // 🔥 OTOMATIK KAYDETME: proposalData değiştiğinde 2 saniye bekle, sonra kaydet
  useEffect(() => {
    // İlk render'da kaydetme
    if (!proposalData.cost) return;

    const timeoutId = setTimeout(() => {
      handleSaveProposal();
    }, 2000); // 2 saniye debounce

    return () => clearTimeout(timeoutId);
  }, [proposalData]); // proposalData değiştiğinde tetiklenir

  // YENİ MİMARİ: Dağılım tablosu bazlı sistem
  const kisi_sayisi = analysis?.extracted_data?.kisi_sayisi || 0;
  const gun_sayisi = analysis?.extracted_data?.gun_sayisi || 365;

  // Varsayılan dağılım: Her öğün türü eşit
  const defaultDistribution = [
    {
      mealType: "sabah_kahvaltisi" as const,
      dietType: "standart" as const,
      adet: kisi_sayisi * gun_sayisi,
      birimFiyat: 0,
      toplam: 0
    },
    {
      mealType: "ogle_yemegi" as const,
      dietType: "standart" as const,
      adet: kisi_sayisi * gun_sayisi,
      birimFiyat: 0,
      toplam: 0
    },
    {
      mealType: "aksam_yemegi" as const,
      dietType: "standart" as const,
      adet: kisi_sayisi * gun_sayisi,
      birimFiyat: 0,
      toplam: 0
    }
  ];

  // İlk render'da proposal data'yı başlat (eğer boşsa)
  useEffect(() => {
    if (!proposalData.cost || !proposalData.cost.peopleCount) {
      setProposalData({
    cost: {
      // Temel bilgiler
      peopleCount: kisi_sayisi,
      daysPerYear: gun_sayisi,

      // Girdi modu
      inputMode: "adet" as const,

      // Dağılım tablosu (ASIL VERİ)
      distribution: defaultDistribution,

      // Türetilen değerler
      totalMeals: defaultDistribution.reduce((sum, row) => sum + row.adet, 0),
      subtotal: 0,

      // Finansal
      profitMargin: 15,
      discount: 0,
      vatRate: 20,

      // ESKİ ALANLAR - Geriye dönük uyumluluk
      mealsPerDay: analysis?.extracted_data?.ogun_sayisi || 3,
      breakfastCount: kisi_sayisi * gun_sayisi,
      lunchCount: kisi_sayisi * gun_sayisi,
      dinnerCount: kisi_sayisi * gun_sayisi,
      breakfastPrice: 0,
      lunchPrice: 0,
      dinnerPrice: 0,
      unitPrice: 0,
    },
    personnel: [],
    documents: [],
    timeline: {},
    risk: [],
    payment: {},
    materials: [],
    menu: [],
    operational: {
      items: [],
      contractDays: gun_sayisi
    },
  });
    }
  }, [analysis]); // analysis değiştiğinde data'yı sıfırla

  // Finansal durum kontrolü için collapse state
  const [financialExpanded, setFinancialExpanded] = useState(false);

  const cards = [
    {
      id: "cost" as CardType,
      label: "Maliyet Hesaplama",
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      category: "main",
    },
    {
      id: "meal" as CardType,
      label: "Yemek Maliyeti",
      icon: UtensilsCrossed,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      category: "main",
    },
    {
      id: "personnel" as CardType,
      label: "Personel",
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      category: "main",
    },
    {
      id: "operational" as CardType,
      label: "Operasyonel",
      icon: Settings,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      category: "main",
    },
    {
      id: "payment" as CardType,
      label: "Ödeme",
      icon: CreditCard,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      category: "main",
    },
    {
      id: "documents" as CardType,
      label: "Belgeler",
      icon: FileText,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      category: "secondary",
    },
    {
      id: "timeline" as CardType,
      label: "Zaman",
      icon: Calendar,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      category: "secondary",
    },
    {
      id: "risk" as CardType,
      label: "Risk",
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      category: "secondary",
    },
    {
      id: "materials" as CardType,
      label: "Demirbaş",
      icon: Package,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      category: "special",
    },
    {
      id: "menu" as CardType,
      label: "Menü",
      icon: UtensilsCrossed,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      category: "special",
    },
  ];

  // Meal data state
  const [mealData, setMealData] = useState<any>({
    distribution: proposalData.cost?.distribution || [],
  });

  const mainCards = cards.filter((c) => c.category === "main");
  const secondaryCards = cards.filter((c) => c.category === "secondary");
  const specialCards = cards.filter((c) => c.category === "special");

  // Maliyet hesaplamaları
  const mealCostSubtotal = Array.isArray(proposalData.cost?.distribution)
    ? proposalData.cost.distribution.reduce((sum: number, row: any) => sum + (row.toplam || 0), 0)
    : 0;

  const personnelCost = Array.isArray(proposalData.personnel)
    ? proposalData.personnel.reduce((sum: number, p: any) => sum + (p.monthlySalary || 0) * (p.quantity || 0) * 12, 0)
    : 0;

  const operationalCost = proposalData.operational?.items
    ? proposalData.operational.items.reduce(
        (sum: number, item: any) =>
          sum + ((item.monthlyAmount || 0) / 30) * (proposalData.operational.contractDays || 365),
        0
      )
    : 0;

  const equipmentCost = Array.isArray(proposalData.materials)
    ? proposalData.materials.reduce(
        (sum: number, item: any) =>
          item.isPurchased ? sum + (item.quantity || 0) * (item.unitPrice || 0) : sum,
        0
      )
    : 0;

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Teklif Hazırlama
          </h2>
          <p className="text-gray-400 text-sm">
            AI analizinden teklif kartlarınızı hazırlayın
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSaveProposal}
            className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-2"
          >
            <Save size={18} />
            Kaydet
          </button>
          <button className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors flex items-center gap-2">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Finansal Durum Kartı - KÜÇÜLTÜLMÜŞ & TIKLANIR */}
      {analysis?.extracted_data?.finansal_kontrol && (
        <motion.div className="mb-6">
          <div
            onClick={() => setFinancialExpanded(!financialExpanded)}
            className={`cursor-pointer rounded-xl border-2 transition-all ${
              analysis.extracted_data.finansal_kontrol.girilir_mi === "EVET"
                ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                : analysis.extracted_data.finansal_kontrol.girilir_mi === "DİKKATLİ"
                ? "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10"
                : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
            } ${financialExpanded ? "p-6" : "p-4"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <h3 className={`font-bold text-white ${financialExpanded ? "text-xl" : "text-base"}`}>
                    Finansal Durum Kontrolü
                  </h3>
                  {!financialExpanded && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Detaylar için tıklayın
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`px-4 py-2 rounded-lg font-bold ${
                  financialExpanded ? "text-lg" : "text-sm"
                } ${
                  analysis.extracted_data.finansal_kontrol.girilir_mi === "EVET"
                    ? "bg-green-500/20 text-green-400"
                    : analysis.extracted_data.finansal_kontrol.girilir_mi === "DİKKATLİ"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {analysis.extracted_data.finansal_kontrol.girilir_mi === "EVET"
                  ? "✅ GİREBİLİRSİNİZ"
                  : analysis.extracted_data.finansal_kontrol.girilir_mi === "DİKKATLİ"
                  ? "⚠️ DİKKATLİ GİRİN"
                  : "❌ GİRMEYİN"}
              </div>
            </div>

            {financialExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.3 }}
                className="mt-4"
              >
                <p className="text-sm text-gray-400 mb-4">
                  {analysis.extracted_data.finansal_kontrol.gerekce}
                </p>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-black/20 p-4 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Birim Fiyat</div>
                    <div className="text-2xl font-bold text-white">
                      {analysis.extracted_data.finansal_kontrol.birim_fiyat?.toFixed(2)}₺
                    </div>
                  </div>
                  <div className="bg-black/20 p-4 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Kâr Marjı</div>
                    <div className={`text-2xl font-bold ${
                      (analysis.extracted_data.finansal_kontrol.kar_marji_tahmin || 0) >= 10
                        ? "text-green-400"
                        : (analysis.extracted_data.finansal_kontrol.kar_marji_tahmin || 0) >= 5
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}>
                      %{analysis.extracted_data.finansal_kontrol.kar_marji_tahmin}
                    </div>
                  </div>
                  <div className="bg-black/20 p-4 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Et Riski</div>
                    <div className={`text-lg font-bold ${
                      analysis.extracted_data.finansal_kontrol.et_bagimliligi_riski === "düşük"
                        ? "text-green-400"
                        : analysis.extracted_data.finansal_kontrol.et_bagimliligi_riski === "orta"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}>
                      {analysis.extracted_data.finansal_kontrol.et_bagimliligi_riski?.toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-black/20 p-4 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Nakit İhtiyacı</div>
                    <div className="text-xl font-bold text-white">
                      {(analysis.extracted_data.finansal_kontrol.nakit_akisi_ihtiyaci || 0).toLocaleString()}₺
                    </div>
                  </div>
                </div>
                {analysis.extracted_data.finansal_kontrol.sinir_deger_uyarisi && (
                  <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-orange-400 mt-0.5" />
                      <div className="text-sm text-orange-300">
                        <span className="font-semibold">Sınır Değer Uyarısı:</span>{" "}
                        {analysis.extracted_data.finansal_kontrol.sinir_deger_uyarisi}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* MALİYET ÖZETİ - ANA KARTLARIN ÜZERİNDE */}
      <div className="mb-4">
        <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4">
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-2.5">
              <span className="text-xs text-gray-400">🍽️ Yemek</span>
              <div className="text-lg font-bold text-green-400 mt-0.5">
                {formatCurrency(mealCostSubtotal)}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-2.5">
              <span className="text-xs text-gray-400">👥 Personel</span>
              <div className="text-lg font-bold text-blue-400 mt-0.5">
                {formatCurrency(personnelCost)}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-2.5">
              <span className="text-xs text-gray-400">⚙️ Operasyonel</span>
              <div className="text-lg font-bold text-orange-400 mt-0.5">
                {formatCurrency(operationalCost)}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-2.5">
              <span className="text-xs text-gray-400">📦 Demirbaş</span>
              <div className="text-lg font-bold text-yellow-400 mt-0.5">
                {formatCurrency(equipmentCost)}
              </div>
            </div>

            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2.5">
              <span className="text-xs text-gray-400">💰 TOPLAM</span>
              <div className="text-lg font-bold text-green-400 mt-0.5">
                {formatCurrency(mealCostSubtotal + personnelCost + operationalCost + equipmentCost)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resmi Teklif Cetveli - ŞİMDİLİK KALDIRILDI */}
      {/*
      <div className="mb-6">
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">
            📋 Resmi Teklif Cetveli
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium py-2 px-3">SIRA NO</th>
                  <th className="text-left text-gray-400 font-medium py-2 px-3">HİZMET TANIMI</th>
                  <th className="text-right text-gray-400 font-medium py-2 px-3">MİKTAR</th>
                  <th className="text-right text-gray-400 font-medium py-2 px-3">BİRİM FİYAT</th>
                  <th className="text-right text-gray-400 font-medium py-2 px-3">TUTAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                <tr className="hover:bg-gray-800/50">
                  <td className="py-3 px-3 text-gray-300">1</td>
                  <td className="py-3 px-3 text-white">Kahvaltı</td>
                  <td className="py-3 px-3 text-right text-gray-300">
                    {(proposalData.cost.breakfastCount || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-300">
                    {proposalData.cost.breakfastPrice ? proposalData.cost.breakfastPrice.toFixed(2) : "0.00"}₺
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-white">
                    {proposalData.cost.breakfastPrice
                      ? ((proposalData.cost.breakfastCount || 0) * proposalData.cost.breakfastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "0.00"}₺
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="py-3 px-3 text-gray-300">2</td>
                  <td className="py-3 px-3 text-white">Öğle Yemeği</td>
                  <td className="py-3 px-3 text-right text-gray-300">
                    {(proposalData.cost.lunchCount || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-300">
                    {proposalData.cost.lunchPrice ? proposalData.cost.lunchPrice.toFixed(2) : "0.00"}₺
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-white">
                    {proposalData.cost.lunchPrice
                      ? ((proposalData.cost.lunchCount || 0) * proposalData.cost.lunchPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "0.00"}₺
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="py-3 px-3 text-gray-300">3</td>
                  <td className="py-3 px-3 text-white">Akşam Yemeği</td>
                  <td className="py-3 px-3 text-right text-gray-300">
                    {(proposalData.cost.dinnerCount || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-300">
                    {proposalData.cost.dinnerPrice ? proposalData.cost.dinnerPrice.toFixed(2) : "0.00"}₺
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-white">
                    {proposalData.cost.dinnerPrice
                      ? ((proposalData.cost.dinnerCount || 0) * proposalData.cost.dinnerPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "0.00"}₺
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-600">
                  <td colSpan={4} className="py-3 px-3 text-right font-bold text-gray-300">
                    ARA TOPLAM:
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-white text-lg">
                    {(() => {
                      const subtotal =
                        ((proposalData.cost.breakfastCount || 0) * (proposalData.cost.breakfastPrice || 0)) +
                        ((proposalData.cost.lunchCount || 0) * (proposalData.cost.lunchPrice || 0)) +
                        ((proposalData.cost.dinnerCount || 0) * (proposalData.cost.dinnerPrice || 0));
                      return subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}₺
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2 px-3 text-right font-medium text-gray-300">
                    KDV (%{proposalData.cost.vatRate}):
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-white">
                    {(() => {
                      const subtotal =
                        ((proposalData.cost.breakfastCount || 0) * (proposalData.cost.breakfastPrice || 0)) +
                        ((proposalData.cost.lunchCount || 0) * (proposalData.cost.lunchPrice || 0)) +
                        ((proposalData.cost.dinnerCount || 0) * (proposalData.cost.dinnerPrice || 0));
                      const kdv = (subtotal * proposalData.cost.vatRate) / 100;
                      return kdv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}₺
                  </td>
                </tr>
                <tr className="border-t-2 border-green-500/30 bg-green-500/5">
                  <td colSpan={4} className="py-3 px-3 text-right font-bold text-green-400 text-lg">
                    GENEL TOPLAM:
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-green-400 text-xl">
                    {(() => {
                      const subtotal =
                        ((proposalData.cost.breakfastCount || 0) * (proposalData.cost.breakfastPrice || 0)) +
                        ((proposalData.cost.lunchCount || 0) * (proposalData.cost.lunchPrice || 0)) +
                        ((proposalData.cost.dinnerCount || 0) * (proposalData.cost.dinnerPrice || 0));
                      const total = subtotal * (1 + proposalData.cost.vatRate / 100);
                      return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}₺
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      */}

      {/* Main Layout: Tab Menu + Card Area */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Tab Menu */}
        <div className="col-span-3 space-y-1">
          {/* Main Cards */}
          <div className="mb-4">
            {mainCards.map((card, index) => {
              const Icon = card.icon;
              const isActive = activeCard === card.id;
              const isCostCard = card.id === "cost";
              return (
                <div key={card.id}>
                  {isCostCard && (
                    <button
                      onClick={() => setActiveCard(card.id)}
                      className={`relative w-full flex items-center gap-3 px-5 py-4 mb-3 rounded-xl transition-all overflow-hidden group ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-teal-500/20 border-2 border-emerald-400/50 shadow-lg shadow-emerald-500/20"
                          : "bg-gradient-to-r from-emerald-600/10 via-green-600/10 to-teal-600/10 border-2 border-emerald-500/30 hover:border-emerald-400/50 hover:shadow-md hover:shadow-emerald-500/10"
                      }`}
                    >
                      {/* Animated background gradient */}
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                      {/* Glow effect on hover */}
                      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10"></div>

                      <div className={`relative p-1.5 rounded-lg ${isActive ? "bg-emerald-500/30" : "bg-emerald-500/20"} group-hover:bg-emerald-500/30 transition-colors`}>
                        <Icon size={22} className={isActive ? "text-emerald-300" : "text-emerald-400"} />
                      </div>
                      <span className={`relative font-bold text-base ${isActive ? "text-emerald-300" : "text-emerald-400"} group-hover:text-emerald-300 transition-colors`}>
                        {card.label}
                      </span>
                    </button>
                  )}
                  {index === 1 && (
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 mt-2">
                      Ana Kartlar
                    </div>
                  )}
                  {!isCostCard && (
                    <button
                      onClick={() => setActiveCard(card.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        isActive
                          ? `${card.bgColor} ${card.color} border-l-4 border-current`
                          : "text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{card.label}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Secondary Cards */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              Yardımcı Kartlar
            </div>
            {secondaryCards.map((card) => {
              const Icon = card.icon;
              const isActive = activeCard === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveCard(card.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? `${card.bgColor} ${card.color} border-l-4 border-current`
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{card.label}</span>
                </button>
              );
            })}
          </div>

          {/* Special Cards */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              Özel Kartlar
            </div>
            {specialCards.map((card) => {
              const Icon = card.icon;
              const isActive = activeCard === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveCard(card.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? `${card.bgColor} ${card.color} border-l-4 border-current`
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{card.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Card Content */}
        <div className="col-span-9">
          <motion.div
            key={activeCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeCard === "cost" && (
              <CostCard
                data={proposalData.cost}
                analysis={analysis}
                onChange={(data) => updateProposalData("cost", data)}
                personnelCost={
                  Array.isArray(proposalData.personnel)
                    ? proposalData.personnel.reduce((sum: number, p: any) => sum + (p.monthlySalary || 0) * (p.quantity || 0) * 12, 0)
                    : 0
                }
                operationalCost={
                  proposalData.operational?.items
                    ? proposalData.operational.items.reduce(
                        (sum: number, item: any) =>
                          sum + ((item.monthlyAmount || 0) / 30) * (proposalData.operational.contractDays || 365),
                        0
                      )
                    : 0
                }
                equipmentCost={
                  Array.isArray(proposalData.materials)
                    ? proposalData.materials.reduce(
                        (sum: number, item: any) =>
                          item.isPurchased ? sum + (item.quantity || 0) * (item.unitPrice || 0) : sum,
                        0
                      )
                    : 0
                }
              />
            )}
            {activeCard === "meal" && (
              <MealCostCard
                data={proposalData.cost}
                analysis={analysis}
                onChange={(data) => updateProposalData("cost", data)}
              />
            )}
            {activeCard === "personnel" && (
              <PersonnelCard
                data={proposalData.personnel}
                analysis={analysis}
                onChange={(data) => updateProposalData("personnel", data)}
              />
            )}
            {activeCard === "documents" && (
              <DocumentsCard
                data={proposalData.documents}
                analysis={analysis}
                onChange={(data) => updateProposalData("documents", data)}
              />
            )}

            {activeCard === "timeline" && (
              <TimelineCard
                data={proposalData.timeline}
                onChange={(data) => updateProposalData("timeline", data)}
                contractDays={gun_sayisi}
              />
            )}

            {activeCard === "risk" && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white">Risk Yönetimi</h3>
                <p className="text-gray-400">Tespit edilen riskler ve önlemler</p>
                {analysis?.contextual_analysis?.operasyonel_riskler?.faktorler?.map((risk: string, i: number) => (
                  <div key={i} className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-white">{risk}</p>
                  </div>
                ))}
              </div>
            )}

            {activeCard === "payment" && (
              <PaymentCard
                data={proposalData.payment}
                onChange={(data) => updateProposalData("payment", data)}
              />
            )}

            {activeCard === "materials" && (
              <EquipmentCard
                data={proposalData.materials}
                onChange={(data) => updateProposalData("materials", data)}
              />
            )}

            {activeCard === "menu" && (
              <MenuCard
                data={proposalData.menu}
                onChange={(data) => updateProposalData("menu", data)}
              />
            )}

            {activeCard === "operational" && (
              <OperationalCard
                data={proposalData.operational}
                onChange={(data) => updateProposalData("operational", data)}
                contractDays={gun_sayisi}
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
