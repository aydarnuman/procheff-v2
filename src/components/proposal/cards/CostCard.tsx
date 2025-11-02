"use client";

import { useState, useEffect } from "react";
import { DollarSign, Calculator, TrendingUp, Info, AlertTriangle } from "lucide-react";
import { AIAnalysisResult } from "@/types/ai";
import { CostData, ProposalValidator } from "@/types/proposal";
import { MealDistributionTable } from "./MealDistributionTable";

interface CostCardProps {
  data: CostData;
  analysis: AIAnalysisResult;
  onChange: (data: CostData) => void;
  personnelCost?: number;
  operationalCost?: number;
  equipmentCost?: number;
}

export function CostCard({ data, analysis, onChange, personnelCost = 0, operationalCost = 0, equipmentCost = 0 }: CostCardProps) {
  const [localData, setLocalData] = useState(data);
  const [validationResult, setValidationResult] = useState(
    ProposalValidator.validateCostData(data)
  );

  // MALİYET ÖZETİ: Checkbox state'leri
  const [costSummary, setCostSummary] = useState({
    mealCostEnabled: true,
    personnelCostEnabled: false,
    operationalCostEnabled: false,
    equipmentCostEnabled: false,
  });

  // Format number with thousand separators
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("tr-TR").format(num);
  };

  // Format currency
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(num);
  };

  // YENİ SİSTEM: Dağılım tablosundan hesapla
  const totalMeals = ProposalValidator.calculateTotalMeals(localData.distribution || []);
  const mealCostSubtotal = ProposalValidator.calculateSubtotal(localData.distribution || []);

  // MALİYET ÖZETİ: Aktif maliyetleri topla
  const activeCosts = {
    meal: costSummary.mealCostEnabled ? mealCostSubtotal : 0,
    personnel: costSummary.personnelCostEnabled ? personnelCost : 0,
    operational: costSummary.operationalCostEnabled ? operationalCost : 0,
    equipment: costSummary.equipmentCostEnabled ? equipmentCost : 0,
  };

  const totalActiveCost = activeCosts.meal + activeCosts.personnel + activeCosts.operational + activeCosts.equipment;

  const calculations = {
    subtotal: totalActiveCost, // Artık sadece yemek değil, tüm aktif maliyetler
    profit: 0,
    vat: 0,
    total: 0,
  };

  calculations.profit = calculations.subtotal * (localData.profitMargin / 100);
  calculations.vat =
    (calculations.subtotal + calculations.profit) * (localData.vatRate / 100);
  calculations.total = calculations.subtotal + calculations.profit + calculations.vat;

  // Update parent when local data changes
  useEffect(() => {
    onChange(localData);
    // Her değişiklikte validation yap
    const validation = ProposalValidator.validateCostData(localData);
    setValidationResult(validation);
  }, [localData]);

  const handleChange = (field: string, value: any) => {
    setLocalData((prev: CostData) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="text-green-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Maliyet Hesaplama</h3>
              <p className="text-sm text-gray-400">
                Teklif tutarınızı hesaplayın
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium">
            Tekrar Hesapla
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* MALİYET ÖZETİ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-1 rounded-full bg-cyan-400"></div>
            <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">
              📊 Maliyet Özeti
            </h4>
          </div>

          <div className="space-y-3 bg-gray-900/30 border border-cyan-500/20 rounded-lg p-4">
            {/* Yemek Maliyeti */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={costSummary.mealCostEnabled}
                  onChange={(e) =>
                    setCostSummary((prev) => ({
                      ...prev,
                      mealCostEnabled: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded border-gray-600 text-green-500 focus:ring-green-500"
                />
                <span className="text-white font-medium">🍽️ Yemek Maliyeti</span>
              </div>
              <span className={`font-semibold text-lg ${costSummary.mealCostEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                {formatCurrency(mealCostSubtotal)}
              </span>
            </div>

            {/* Personel Maliyeti */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={costSummary.personnelCostEnabled}
                  onChange={(e) =>
                    setCostSummary((prev) => ({
                      ...prev,
                      personnelCostEnabled: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-white font-medium">👥 Personel Maliyeti</span>
              </div>
              <span className={`font-semibold text-lg ${costSummary.personnelCostEnabled ? 'text-blue-400' : 'text-gray-500'}`}>
                {formatCurrency(personnelCost)}
              </span>
            </div>

            {/* Operasyonel Giderler */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={costSummary.operationalCostEnabled}
                  onChange={(e) =>
                    setCostSummary((prev) => ({
                      ...prev,
                      operationalCostEnabled: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-white font-medium">⚙️ Operasyonel Giderler</span>
              </div>
              <span className={`font-semibold text-lg ${costSummary.operationalCostEnabled ? 'text-orange-400' : 'text-gray-500'}`}>
                {formatCurrency(operationalCost)}
              </span>
            </div>

            {/* Demirbaş Giderleri */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={costSummary.equipmentCostEnabled}
                  onChange={(e) =>
                    setCostSummary((prev) => ({
                      ...prev,
                      equipmentCostEnabled: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded border-gray-600 text-yellow-500 focus:ring-yellow-500"
                />
                <span className="text-white font-medium">📦 Demirbaş Giderleri</span>
              </div>
              <span className={`font-semibold text-lg ${costSummary.equipmentCostEnabled ? 'text-yellow-400' : 'text-gray-500'}`}>
                {formatCurrency(equipmentCost)}
              </span>
            </div>

            {/* Toplam Maliyet */}
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
            <div className="flex items-center justify-between p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <span className="text-cyan-300 font-bold text-lg">TOPLAM MALİYET</span>
              <span className="text-cyan-400 font-bold text-2xl">
                {formatCurrency(totalActiveCost)}
              </span>
            </div>

            <p className="text-xs text-gray-400 text-center mt-2">
              💡 Sadece işaretli maliyetler toplam hesaplamaya dahil edilir
            </p>
          </div>
        </div>

        {/* Finansal Parametreler */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-1 rounded-full bg-green-400"></div>
            <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wider">
              💰 Finansal Parametreler
            </h4>
          </div>

          {/* Diğer Parametreler */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Kar Marjı
                <span className="ml-1 text-xs text-gray-500">(%)</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={localData.profitMargin}
                onChange={(e) =>
                  handleChange("profitMargin", parseFloat(e.target.value) || 0)
                }
                className="w-full px-4 py-3 bg-gray-900/50 border border-green-600/50 rounded-lg text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                placeholder="15"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                KDV Oranı
                <span className="ml-1 text-xs text-gray-500">(%)</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={localData.vatRate}
                onChange={(e) =>
                  handleChange("vatRate", parseFloat(e.target.value) || 0)
                }
                className="w-full px-4 py-3 bg-gray-900/50 border border-green-600/50 rounded-lg text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                placeholder="20"
              />
            </div>
          </div>
        </div>

        {/* Otomatik Hesaplanan Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-1 rounded-full bg-purple-400"></div>
            <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Calculator size={16} />
              Otomatik Hesaplanan
            </h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <span className="text-gray-400">Ara Toplam</span>
              <span className="text-white font-semibold text-lg">
                {formatCurrency(calculations.subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <span className="text-gray-400 flex items-center gap-2">
                Kar Marjı
                <span className="text-xs text-green-400">
                  (+{localData.profitMargin}%)
                </span>
              </span>
              <span className="text-green-400 font-semibold text-lg">
                {formatCurrency(calculations.profit)}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <span className="text-gray-400 flex items-center gap-2">
                KDV
                <span className="text-xs text-blue-400">
                  ({localData.vatRate}%)
                </span>
              </span>
              <span className="text-blue-400 font-semibold text-lg">
                {formatCurrency(calculations.vat)}
              </span>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>

            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border-2 border-green-500/50">
              <div className="flex items-center gap-3">
                <TrendingUp className="text-green-400" size={24} />
                <span className="text-white font-bold text-xl">
                  TEKLİF TUTARI
                </span>
              </div>
              <span className="text-green-400 font-bold text-3xl">
                {formatCurrency(calculations.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Notlar */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            📝 Notlar
          </label>
          <textarea
            rows={3}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
            placeholder="Teklif için özel notlarınızı buraya ekleyebilirsiniz..."
          />
        </div>

        {/* Info Box */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
          <Info className="text-blue-400 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">Otomatik Kayıt Aktif</p>
            <p className="text-blue-300/80">
              Değişiklikleriniz 2 saniye sonra otomatik olarak kaydedilecektir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
