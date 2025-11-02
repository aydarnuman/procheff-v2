"use client";

import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { usePriceStore } from "@/lib/store/price-store";
import type { PriceCategory, ProductCard } from "@/types/price";
import { calculateUnitPrice } from "@/lib/utils/price-utils";

interface AddPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProductCard?: ProductCard | null;
  onProductAdded?: (productCard: ProductCard) => void;
}

export function AddPriceModal({
  isOpen,
  onClose,
  existingProductCard,
  onProductAdded,
}: AddPriceModalProps) {
  const { addProductCard, addPriceEntry } = usePriceStore();
  const [searchInput, setSearchInput] = useState("");
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // AI ile ürün ekleme
  const handleAIAdd = async () => {
    if (!searchInput.trim()) {
      return;
    }

    setIsFetchingPrice(true);
    setSuggestions([]);

    try {
      // Önce ürün tespiti yap
      const detectResponse = await fetch("/api/ai/detect-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: searchInput,
        }),
      });

      const detectResult = await detectResponse.json();

      let category = "sebze" as PriceCategory;
      let icon = "";
      let finalProductName = searchInput;

      if (detectResult.success && detectResult.data) {
        category = detectResult.data.category as PriceCategory;
        icon = detectResult.data.icon;

        // Eğer varyant varsa ve default varyant seçilmişse
        if (detectResult.data.hasVariants && detectResult.data.defaultVariant) {
          finalProductName = detectResult.data.defaultVariant;
        }
      }

      // Şimdi fiyatları çek
      const response = await fetch("/api/ai/fetch-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: finalProductName,
          category: category,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Yeni ürün kartı oluştur
        const newCard: ProductCard = {
          id: crypto.randomUUID(),
          name: finalProductName,
          category: category,
          icon: icon || undefined,
          createdAt: new Date().toISOString(),
        };

        addProductCard(newCard);

        // Çoklu market dönmüşse array, tek market dönmüşse object
        const pricesData = Array.isArray(result.data) ? result.data : [result.data];

        // Her fiyat için ayrı kayıt ekle
        pricesData.forEach((priceData: any) => {
          const packageSize = priceData.packageSize || 1;
          const packagePrice = priceData.price;
          const unitPrice = calculateUnitPrice(packagePrice, packageSize);

          const newPriceEntry = {
            id: crypto.randomUUID(),
            productCardId: newCard.id,
            source: priceData.source,
            brand: priceData.brand || undefined,
            packageSize,
            packageUnit: priceData.unit || "kg",
            packagePrice,
            unitPrice,
            confidenceScore: Math.round((priceData.confidence || 0.8) * 100),
            dataSource: "AI" as "AI",
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };

          addPriceEntry(newPriceEntry);
        });

        // Başarılı ekleme sonrası
        setSearchInput("");
        setSuggestions([]);

        // Yeni ürüne detay modal aç
        if (onProductAdded) {
          onProductAdded(newCard);
        } else {
          onClose();
        }
      } else if (result.suggestion) {
        // AI öneri sunuyor - string veya array olabilir
        const suggestionList = Array.isArray(result.suggestion)
          ? result.suggestion
          : [result.suggestion];
        setSuggestions(suggestionList);
      } else {
        alert(`Ürün bulunamadı: ${result.error || "Lütfen farklı bir isim deneyin"}`);
      }
    } catch (error) {
      console.error("AI add error:", error);
      alert("Ürün eklenirken bir hata oluştu");
    } finally {
      setIsFetchingPrice(false);
    }
  };

  // Öneri kabul edildiğinde
  const handleAcceptSuggestion = (selectedSuggestion: string) => {
    setSearchInput(selectedSuggestion);
    setSuggestions([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-white">Ürün Ekle</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Search Bar */}
          <div className="relative mb-4">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isFetchingPrice) {
                  handleAIAdd();
                }
              }}
              placeholder="Ürün adı yazın... (Örn: Domates, Pirinç, Zeytinyağı)"
              disabled={isFetchingPrice}
              className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50"
            />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mb-4 space-y-2">
              {suggestions.map((sug, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAcceptSuggestion(sug)}
                  className="w-full p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg hover:bg-primary-500/20 transition-all text-left flex items-center gap-2"
                >
                  <span className="text-lg">💡</span>
                  <span className="text-white font-medium">{sug}</span>
                </button>
              ))}
            </div>
          )}

          {/* AI Button */}
          <button
            type="button"
            onClick={handleAIAdd}
            disabled={isFetchingPrice || !searchInput.trim()}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <Sparkles className="w-5 h-5" />
            {isFetchingPrice ? "AI Çalışıyor..." : "AI ile Ekle"}
          </button>

          {/* Info Text */}
          <p className="text-xs text-gray-500 text-center mt-4">
            AI otomatik olarak kategori belirleyecek ve tüm marketlerden fiyatları çekecek
          </p>
        </div>
      </div>
    </div>
  );
}
