"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, AlertCircle, X } from "lucide-react";
import {
  MealDistributionRow,
  MealType,
  DietType,
  MEAL_TYPE_LABELS,
  DIET_TYPE_LABELS,
  ProposalValidator
} from "@/types/proposal";

interface MealDistributionTableProps {
  distribution: MealDistributionRow[];
  onChange: (distribution: MealDistributionRow[]) => void;
  readOnly?: boolean;
}

export function MealDistributionTable({
  distribution,
  onChange,
  readOnly = false
}: MealDistributionTableProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [dismissedErrors, setDismissedErrors] = useState(false);
  const [dismissedWarnings, setDismissedWarnings] = useState(false);

  // Satır ekle
  const handleAddRow = () => {
    const newRow: MealDistributionRow = {
      mealType: "sabah_kahvaltisi",
      dietType: "standart",
      adet: 0,
      birimFiyat: 0,
      toplam: 0
    };
    onChange([...distribution, newRow]);
  };

  // Satır sil
  const handleDeleteRow = (index: number) => {
    const newDist = distribution.filter((_, i) => i !== index);
    onChange(newDist);
  };

  // Satır güncelle
  const handleUpdateRow = (index: number, field: keyof MealDistributionRow, value: any) => {
    const newDist = [...distribution];
    newDist[index] = {
      ...newDist[index],
      [field]: value
    };

    // Toplam otomatik hesapla
    if (field === "adet" || field === "birimFiyat") {
      newDist[index].toplam = newDist[index].adet * newDist[index].birimFiyat;
    }

    onChange(newDist);
  };

  // Validation
  const validation = ProposalValidator.validateDistribution(distribution);
  const totalMeals = ProposalValidator.calculateTotalMeals(distribution);
  const subtotal = ProposalValidator.calculateSubtotal(distribution);

  // Sadece kullanıcının doldurduğu (toplam > 0) satırlar varsa uyarı göster
  const hasFilledRows = distribution.some(row => (row.toplam ?? 0) > 0);
  const shouldShowWarnings = hasFilledRows && (!validation.isValid || validation.warnings.length > 0);

  return (
    <div className="space-y-4">
      {/* Başlık ve Özet */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Öğün Dağılım Tablosu</h3>
          <p className="text-sm text-gray-400">
            Toplam: <span className="text-green-400 font-medium">{totalMeals.toLocaleString()}</span> öğün
            {" • "}
            Ara Toplam: <span className="text-green-400 font-medium">{subtotal.toLocaleString()}₺</span>
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={handleAddRow}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Satır Ekle
          </button>
        )}
      </div>

      {/* Uyarılar - Sadece dolu satırlar varsa göster */}
      <AnimatePresence>
        {shouldShowWarnings && !validation.isValid && !dismissedErrors && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  {validation.errors.map((error, i) => (
                    <p key={i} className="text-sm text-red-400">{error}</p>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setDismissedErrors(true)}
                className="text-red-400 hover:text-red-300 transition-colors p-1 -mr-1 -mt-1"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {shouldShowWarnings && validation.warnings.length > 0 && !dismissedWarnings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  {validation.warnings.map((warning, i) => (
                    <p key={i} className="text-sm text-yellow-400">{warning}</p>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setDismissedWarnings(true)}
                className="text-yellow-400 hover:text-yellow-300 transition-colors p-1 -mr-1 -mt-1"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tablo */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 font-medium py-3 px-3">Öğün Tipi</th>
              <th className="text-left text-gray-400 font-medium py-3 px-3">Diyet Tipi</th>
              <th className="text-right text-gray-400 font-medium py-3 px-3">Adet</th>
              <th className="text-right text-gray-400 font-medium py-3 px-3">Birim Fiyat (₺)</th>
              <th className="text-right text-gray-400 font-medium py-3 px-3">Toplam (₺)</th>
              {!readOnly && <th className="text-center text-gray-400 font-medium py-3 px-3">İşlem</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {distribution.map((row, index) => (
              <motion.tr
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hover:bg-gray-800/50 transition-colors"
              >
                {/* Öğün Tipi */}
                <td className="py-3 px-3">
                  {readOnly ? (
                    <span className="text-white">{MEAL_TYPE_LABELS[row.mealType]}</span>
                  ) : (
                    <select
                      value={row.mealType}
                      onChange={(e) => handleUpdateRow(index, "mealType", e.target.value as MealType)}
                      className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      {Object.entries(MEAL_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  )}
                </td>

                {/* Diyet Tipi */}
                <td className="py-3 px-3">
                  {readOnly ? (
                    <span className="text-gray-300">{DIET_TYPE_LABELS[row.dietType]}</span>
                  ) : (
                    <select
                      value={row.dietType}
                      onChange={(e) => handleUpdateRow(index, "dietType", e.target.value as DietType)}
                      className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      {Object.entries(DIET_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  )}
                </td>

                {/* Adet */}
                <td className="py-3 px-3 text-right">
                  {readOnly ? (
                    <span className="text-gray-300">{row.adet.toLocaleString()}</span>
                  ) : (
                    <input
                      type="number"
                      value={row.adet}
                      onChange={(e) => handleUpdateRow(index, "adet", parseInt(e.target.value) || 0)}
                      className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1.5 text-sm text-right focus:border-blue-500 focus:outline-none"
                      min="0"
                    />
                  )}
                </td>

                {/* Birim Fiyat */}
                <td className="py-3 px-3 text-right">
                  {readOnly ? (
                    <span className="text-gray-300">{row.birimFiyat.toFixed(2)}₺</span>
                  ) : (
                    <input
                      type="number"
                      value={row.birimFiyat}
                      onChange={(e) => handleUpdateRow(index, "birimFiyat", parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1.5 text-sm text-right focus:border-blue-500 focus:outline-none"
                      min="0"
                      step="0.01"
                    />
                  )}
                </td>

                {/* Toplam (Otomatik Hesaplanan) */}
                <td className="py-3 px-3 text-right">
                  <span className="text-white font-medium">
                    {((row.toplam || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }))}₺
                  </span>
                </td>

                {/* İşlem */}
                {!readOnly && (
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleDeleteRow(index)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Satırı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-600 font-bold">
              <td colSpan={2} className="py-3 px-3 text-gray-300">TOPLAM</td>
              <td className="py-3 px-3 text-right text-green-400">{totalMeals.toLocaleString()}</td>
              <td className="py-3 px-3 text-right text-gray-400">-</td>
              <td className="py-3 px-3 text-right text-green-400">
                {subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}₺
              </td>
              {!readOnly && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
