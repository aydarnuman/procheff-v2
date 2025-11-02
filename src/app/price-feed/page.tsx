"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Search, X, Trash2 } from "lucide-react";
import { usePriceStore } from "@/lib/store/price-store";
import type { PriceCategory, ProductCard } from "@/types/price";
import { AddPriceModal } from "@/components/modals/AddPriceModal";
import { ProductDetailModal } from "@/components/modals/ProductDetailModal";
import {
  getCategoryIcon,
  getCategoryName,
  formatPrice,
  getPriceLevelIcon,
} from "@/lib/utils/price-utils";

export default function PriceFeedPage() {
  const {
    productCards,
    selectedCategory,
    searchQuery,
    setSelectedCategory,
    setSearchQuery,
    getCheapestPriceForProduct,
    getPriceEntriesByProductCard,
    deleteProductCard,
  } = usePriceStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProductCard, setSelectedProductCard] =
    useState<ProductCard | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Yeni eklenen ürüne detay modal aç
  const handleProductAdded = (productCard: ProductCard) => {
    // AddPriceModal'ı kapat
    setIsAddModalOpen(false);

    // Kısa bir gecikme ile ProductDetailModal'ı aç
    setTimeout(() => {
      setSelectedProductCard(productCard);
    }, 200);
  };

  const categories: { id: PriceCategory; label: string; icon: string }[] = [
    { id: "sebze", label: "Sebzeler", icon: "🥬" },
    { id: "et-tavuk", label: "Et & Tavuk", icon: "🥩" },
    { id: "bakliyat", label: "Bakliyat", icon: "🌾" },
    { id: "sut-peynir", label: "Süt & Peynir", icon: "🥛" },
    { id: "temel-gida", label: "Temel Gıda", icon: "🍞" },
    { id: "baharat", label: "Baharat", icon: "🧂" },
  ];

  const displayedCards = useMemo(() => {
    let cards = productCards;

    // Kategori filtresi
    if (selectedCategory) {
      cards = cards.filter((card) => card.category === selectedCategory);
    }

    // Arama filtresi
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      cards = cards.filter((card) =>
        card.name.toLowerCase().includes(query)
      );
    }

    return cards;
  }, [productCards, selectedCategory, searchQuery]);

  const handleCardClick = (card: ProductCard) => {
    setSelectedProductCard(card);
  };

  const handleCloseDetailModal = () => {
    setSelectedProductCard(null);
  };

  const handleDeleteCard = (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation(); // Prevent card click
    e.preventDefault(); // Prevent any default behavior
    deleteProductCard(cardId);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Fiyat Takip</h1>
        <p className="text-gray-400">
          Market ve hal fiyatlarını karşılaştırın
        </p>
      </div>

      {/* Search & Actions */}
      <div className="mb-6 flex gap-3 flex-wrap">
        {/* Search Bar */}
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Ürün ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Add Product Button */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              selectedCategory === null
                ? "bg-primary-600 text-white shadow-lg"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            Tümü ({productCards.length})
          </button>
          {categories.map((cat) => {
            const count = productCards.filter((p) => p.category === cat.id)
              .length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? "bg-primary-600 text-white shadow-lg"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Cards Grid */}
      {!isMounted ? (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
          <p className="text-gray-400">Yükleniyor...</p>
        </div>
      ) : displayedCards.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-lg mb-4">
            {searchQuery
              ? "Aradığınız ürün bulunamadı"
              : "Henüz ürün eklenmemiş"}
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            İlk Ürünü Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedCards.map((card) => {
            const priceEntries = getPriceEntriesByProductCard(card.id);
            const cheapestPrice = getCheapestPriceForProduct(card.id);
            const marketCount = priceEntries.length;

            return (
              <div
                key={card.id}
                id={`card-${card.id}`}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 hover:border-primary-500/50 transition-all text-left group relative"
              >
                {/* Delete Button - Sağ üst köşede */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteCard(e, card.id)}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-all opacity-0 group-hover:opacity-100 z-20 shadow-lg"
                  aria-label="Ürünü sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Kartın geri kalanına tıklayınca detay açılsın */}
                <div onClick={() => handleCardClick(card)} className="cursor-pointer">
                  {/* Icon & Category */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">
                      {card.icon || getCategoryIcon(card.category)}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium bg-white/10 text-gray-300 rounded">
                      {getCategoryName(card.category)}
                    </span>
                  </div>

                  {/* Product Name */}
                  <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-primary-400 transition-colors line-clamp-2">
                    {card.name}
                  </h3>

                  {/* Market Count */}
                  <div className="text-sm text-gray-400 mb-2">
                    {marketCount === 0 ? (
                      <span>Henüz fiyat eklenmemiş</span>
                    ) : (
                      <span>
                        {marketCount} market{marketCount > 1 ? "" : ""}
                      </span>
                    )}
                  </div>

                  {/* Cheapest Price */}
                  {cheapestPrice ? (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs text-gray-400 mb-1">En ucuz:</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-green-400">
                          {formatPrice(cheapestPrice.unitPrice)} TL
                        </span>
                        <span className="text-sm text-gray-400">
                          / {cheapestPrice.packageUnit}
                        </span>
                        <span className="text-lg">
                          {getPriceLevelIcon("cheapest")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {cheapestPrice.source}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProductCard(card);
                        }}
                        className="text-sm text-primary-400 hover:text-primary-300"
                      >
                        + Fiyat Ekle
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Price Modal */}
      <AddPriceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onProductAdded={handleProductAdded}
      />

      {/* Product Detail Modal */}
      {selectedProductCard && (
        <ProductDetailModal
          isOpen={!!selectedProductCard}
          onClose={handleCloseDetailModal}
          productCard={selectedProductCard}
        />
      )}
    </div>
  );
}
