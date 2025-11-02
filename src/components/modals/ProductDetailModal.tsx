"use client";

import { useState } from "react";
import { X, Plus, RefreshCw, Edit2, Trash2, History } from "lucide-react";
import { usePriceStore } from "@/lib/store/price-store";
import type { ProductCard, PriceEntry } from "@/types/price";
import {
  formatPrice,
  getPriceLevel,
  getPriceLevelIcon,
  getPriceLevelColor,
  getConfidenceBadgeColor,
  formatRelativeDate,
} from "@/lib/utils/price-utils";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCard: ProductCard;
}

export function ProductDetailModal({
  isOpen,
  onClose,
  productCard,
}: ProductDetailModalProps) {
  const {
    getPriceEntriesByProductCard,
    deletePriceEntry,
    updatePriceEntry,
  } = usePriceStore();

  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const priceEntries = getPriceEntriesByProductCard(productCard.id);

  const handleRefreshPrice = async (entryId: string) => {
    const entry = priceEntries.find((e) => e.id === entryId);
    if (!entry) return;

    setRefreshingId(entryId);

    try {
      const response = await fetch("/api/ai/fetch-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: productCard.name,
          category: productCard.category,
          source: entry.source,
          brand: entry.brand,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const newUnitPrice =
          result.data.price /
          (entry.packageSize || 1);

        updatePriceEntry(entryId, {
          packagePrice: result.data.price,
          unitPrice: newUnitPrice,
          confidenceScore: result.data.confidence || 80,
          dataSource: "AI",
        });
      } else {
        alert(`Fiyat güncellenemedi: ${result.error || "Bilinmeyen hata"}`);
      }
    } catch (error) {
      console.error("Price refresh error:", error);
      alert("Fiyat güncellenirken bir hata oluştu");
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm("Bu fiyat kaydını silmek istediğinize emin misiniz?")) {
      deletePriceEntry(entryId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-4xl">
              {productCard.icon || "📦"}
            </span>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {productCard.name}
              </h2>
              <p className="text-sm text-gray-400">
                {priceEntries.length} market • Fiyat karşılaştırması
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Fiyat Ekle
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {priceEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg mb-4">
                Henüz fiyat kaydı eklenmemiş
              </p>
              <button
                type="button"
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                İlk Fiyatı Ekle
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Market/Kaynak
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Paket Bilgisi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Birim Fiyat
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Güven
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {priceEntries.map((entry) => {
                    const priceLevel = getPriceLevel(entry.unitPrice, priceEntries);
                    const levelIcon = getPriceLevelIcon(priceLevel);
                    const levelColor = getPriceLevelColor(priceLevel);
                    const confidenceColor = getConfidenceBadgeColor(entry.confidenceScore);

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        {/* Market/Kaynak */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="relative group/market">
                            <div className="flex items-center gap-2 cursor-help">
                              <div className="text-sm font-medium text-white">
                                🏪 {entry.source}
                              </div>
                              <div className="text-xs text-gray-400">
                                ⓘ
                              </div>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute left-0 top-full mt-2 px-4 py-3 bg-gray-800 text-white text-sm rounded-lg shadow-2xl border border-gray-600 hidden group-hover/market:block z-[9999] w-[280px]">
                              <div className="space-y-2.5">
                                <div className="pb-2 border-b border-gray-600">
                                  <span className="text-xs text-gray-400 uppercase font-semibold">Kaynak Bilgisi</span>
                                </div>

                                <div className="flex gap-2">
                                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">Market:</span>
                                  <span className="text-sm font-medium">{entry.source}</span>
                                </div>

                                <div className="flex gap-2">
                                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">Marka:</span>
                                  {entry.brand && entry.brand !== "Markasız" ? (
                                    <span className="text-sm font-semibold text-green-400">{entry.brand}</span>
                                  ) : entry.brand === "Markasız" ? (
                                    <span className="text-sm text-gray-400 italic">Markasız</span>
                                  ) : (
                                    <span className="text-sm text-orange-400">Yok</span>
                                  )}
                                </div>

                                {entry.sourceUrl && (
                                  <div className="flex gap-2">
                                    <span className="text-xs text-gray-400 w-16 flex-shrink-0">Website:</span>
                                    <span className="text-xs text-blue-400 font-mono">{entry.sourceUrl}</span>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">Kaynak:</span>
                                  <span className="text-xs">
                                    {entry.dataSource === "VERIFIED" ? "✓ Doğrulandı" :
                                     entry.dataSource === "MANUAL" ? "✎ Manuel" :
                                     "🌐 Web Sitesi"}
                                  </span>
                                </div>

                                <div className="flex gap-2">
                                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">Güven:</span>
                                  <span className="text-xs font-medium text-blue-400">%{entry.confidenceScore}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 mt-1">
                              {formatRelativeDate(entry.lastUpdated)}
                            </div>
                          </div>
                        </td>

                        {/* Paket Bilgisi */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">
                            {entry.packageSize} {entry.packageUnit} →{" "}
                            {formatPrice(entry.packagePrice)} TL
                          </div>
                        </td>

                        {/* Birim Fiyat */}
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`text-lg font-bold ${levelColor.split(" ")[0]}`}>
                              {formatPrice(entry.unitPrice)} TL
                            </span>
                            <span className="text-sm text-gray-400">
                              / {entry.packageUnit}
                            </span>
                            <span className="text-xl">{levelIcon}</span>
                            {/* Low confidence indicator */}
                            {entry.confidenceScore < 70 && (
                              <span className="text-xs text-orange-400 ml-1">
                                ⚠️ Yakın cins
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Güven Skoru */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${confidenceColor}`}
                          >
                            {entry.confidenceScore}%
                          </span>
                        </td>

                        {/* İşlemler */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRefreshPrice(entry.id)}
                              disabled={refreshingId === entry.id}
                              className="p-2 hover:bg-blue-600/20 text-blue-400 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Fiyatı Güncelle"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${
                                  refreshingId === entry.id ? "animate-spin" : ""
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              className="p-2 hover:bg-purple-600/20 text-purple-400 rounded-lg transition-all"
                              title="Tarihçe"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-2 hover:bg-yellow-600/20 text-yellow-400 rounded-lg transition-all"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-all"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
