import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProductCard,
  PriceEntry,
  PriceHistory,
  PriceStore,
  PriceCategory,
} from "@/types/price";

export const usePriceStore = create<PriceStore>()(
  persist(
    (set, get) => ({
      // Data
      productCards: [],
      priceEntries: [],
      priceHistory: [],

      // UI State
      selectedCategory: null,
      searchQuery: "",

      // Product Card Actions
      addProductCard: (card) =>
        set((state) => ({
          productCards: [...state.productCards, card],
        })),

      updateProductCard: (id, updates) =>
        set((state) => ({
          productCards: state.productCards.map((card) =>
            card.id === id ? { ...card, ...updates } : card
          ),
        })),

      deleteProductCard: (id) =>
        set((state) => ({
          productCards: state.productCards.filter((card) => card.id !== id),
          // Cascade delete: İlgili fiyat kayıtlarını da sil
          priceEntries: state.priceEntries.filter(
            (entry) => entry.productCardId !== id
          ),
        })),

      // Price Entry Actions
      addPriceEntry: (entry) =>
        set((state) => ({
          priceEntries: [...state.priceEntries, entry],
        })),

      updatePriceEntry: (id, updates) =>
        set((state) => {
          const oldEntry = state.priceEntries.find((e) => e.id === id);
          const newEntry = oldEntry
            ? { ...oldEntry, ...updates, lastUpdated: new Date().toISOString() }
            : null;

          // Fiyat değiştiyse geçmişe kaydet
          if (
            newEntry &&
            oldEntry &&
            (newEntry.packagePrice !== oldEntry.packagePrice ||
              newEntry.unitPrice !== oldEntry.unitPrice)
          ) {
            const history: PriceHistory = {
              id: crypto.randomUUID(),
              priceEntryId: id,
              oldPrice: oldEntry.unitPrice,
              newPrice: newEntry.unitPrice,
              changedAt: new Date().toISOString(),
              changedBy: updates.dataSource || "MANUAL",
            };
            return {
              priceEntries: state.priceEntries.map((entry) =>
                entry.id === id ? newEntry : entry
              ),
              priceHistory: [...state.priceHistory, history],
            };
          }

          return {
            priceEntries: state.priceEntries.map((entry) =>
              entry.id === id && newEntry ? newEntry : entry
            ),
          };
        }),

      deletePriceEntry: (id) =>
        set((state) => ({
          priceEntries: state.priceEntries.filter((entry) => entry.id !== id),
          // İlgili geçmişi de sil
          priceHistory: state.priceHistory.filter(
            (history) => history.priceEntryId !== id
          ),
        })),

      // Price History Actions
      addPriceHistory: (history) =>
        set((state) => ({
          priceHistory: [...state.priceHistory, history],
        })),

      getPriceHistory: (priceEntryId) => {
        return get()
          .priceHistory.filter((h) => h.priceEntryId === priceEntryId)
          .sort(
            (a, b) =>
              new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
          );
      },

      // Query Actions
      getProductCardsByCategory: (category) => {
        const state = get();
        let cards = state.productCards;

        // Kategori filtresi
        if (category) {
          cards = cards.filter((card) => card.category === category);
        }

        // Arama filtresi
        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase();
          cards = cards.filter((card) =>
            card.name.toLowerCase().includes(query)
          );
        }

        return cards;
      },

      getPriceEntriesByProductCard: (productCardId) => {
        return get()
          .priceEntries.filter((entry) => entry.productCardId === productCardId)
          .sort((a, b) => a.unitPrice - b.unitPrice); // En ucuzdan pahalıya
      },

      getCheapestPriceForProduct: (productCardId) => {
        const entries = get().priceEntries.filter(
          (entry) => entry.productCardId === productCardId
        );
        if (entries.length === 0) return null;
        return entries.reduce((cheapest, current) =>
          current.unitPrice < cheapest.unitPrice ? current : cheapest
        );
      },

      // UI Actions
      setSelectedCategory: (category) =>
        set({ selectedCategory: category }),

      setSearchQuery: (query) =>
        set({ searchQuery: query }),
    }),
    {
      name: "procheff-prices-v2",
    }
  )
);
