"use client";

import { useState, useEffect } from "react";
import { UtensilsCrossed, Info, AlertTriangle } from "lucide-react";
import { AIAnalysisResult } from "@/types/ai";
import { CostData, ProposalValidator } from "@/types/proposal";
import { MealDistributionTable } from "./MealDistributionTable";

interface MealCostCardProps {
  data: CostData;
  analysis: AIAnalysisResult;
  onChange: (data: CostData) => void;
}

const DEFAULT_MEAL_ROWS = [
  { mealType: "sabah_kahvaltisi", dietType: "standart", adet: 0, birimFiyat: 0, toplam: 0 },
  { mealType: "oglen_yemegi", dietType: "standart", adet: 0, birimFiyat: 0, toplam: 0 },
  { mealType: "aksam_yemegi", dietType: "standart", adet: 0, birimFiyat: 0, toplam: 0 },
  { mealType: "kusluk", dietType: "standart", adet: 0, birimFiyat: 0, toplam: 0 },
];

export function MealCostCard({ data, analysis, onChange }: MealCostCardProps) {
  // Eğer distribution boşsa, varsayılan satırlarla başla
  const initialData = {
    ...data,
    distribution: data.distribution && data.distribution.length > 0
      ? data.distribution
      : DEFAULT_MEAL_ROWS
  };

  const [localData, setLocalData] = useState(initialData);
  const [validationResult, setValidationResult] = useState(
    ProposalValidator.validateCostData(initialData)
  );

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

  // Dağılım tablosundan hesapla
  const totalMeals = ProposalValidator.calculateTotalMeals(localData.distribution || []);
  const mealCostSubtotal = ProposalValidator.calculateSubtotal(localData.distribution || []);

  // Update parent when local data changes
  useEffect(() => {
    onChange(localData);
    // Her değişiklikte validation yap
    const validation = ProposalValidator.validateCostData(localData);
    setValidationResult(validation);
  }, [localData]);

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <UtensilsCrossed className="text-green-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Yemek Maliyeti</h3>
              <p className="text-sm text-gray-400">
                Öğün dağılımı ve birim fiyatları
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Toplam</p>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(mealCostSubtotal)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Validation Alerts */}
        {(!validationResult.isValid || validationResult.warnings.length > 0) && (
          <div className="space-y-2">
            {/* Errors */}
            {validationResult.errors.map((error, idx) => (
              <div
                key={`error-${idx}`}
                className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="font-semibold text-red-400 mb-1">Hata!</h5>
                  <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
                </div>
              </div>
            ))}

            {/* Warnings */}
            {validationResult.warnings.map((warning, idx) => (
              <div
                key={`warning-${idx}`}
                className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
              >
                <Info className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="font-semibold text-yellow-400 mb-1">Uyarı</h5>
                  <p className="text-sm text-yellow-300">{warning}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Özet Bilgiler */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-1 rounded-full bg-blue-400"></div>
            <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">
              📊 Özet Bilgiler
            </h4>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400 mb-1">Kişi Sayısı</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(localData.peopleCount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">AI'dan çıkarılan</p>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400 mb-1">Gün Sayısı</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(localData.daysPerYear)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Yıllık</p>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400 mb-1">Toplam Öğün</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(totalMeals)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Tablodan hesaplanan</p>
            </div>
          </div>
        </div>

        {/* Öğün Dağılım Tablosu */}
        <div>
          <MealDistributionTable
            distribution={localData.distribution || []}
            onChange={(newDistribution) => {
              setLocalData((prev: CostData) => ({
                ...prev,
                distribution: newDistribution,
                totalMeals: ProposalValidator.calculateTotalMeals(newDistribution),
                subtotal: ProposalValidator.calculateSubtotal(newDistribution)
              }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
