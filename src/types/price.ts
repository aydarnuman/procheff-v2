export type PriceCategory =
  | "sebze"
  | "et-tavuk"
  | "bakliyat"
  | "sut-peynir"
  | "temel-gida"
  | "baharat";

export type DataSource = "AI" | "MANUAL" | "VERIFIED";

// Ürün Kartı - Ana ürün bilgisi
export interface ProductCard {
  id: string;
  name: string; // "Domates Salçası"
  category: PriceCategory;
  icon?: string; // "🥫"
  createdAt: string;
}

// Fiyat Kaydı - Her kart altında birden fazla market/marka
export interface PriceEntry {
  id: string;
  productCardId: string; // Hangi ürün kartına ait

  // Market & Marka Bilgisi
  source: string; // "Metro", "A101", "Hal"
  brand?: string; // "Tamek", "Tat" (opsiyonel)
  sourceUrl?: string; // "metro.com.tr", "migros.com.tr" (opsiyonel)

  // Paket Bilgisi
  packageSize: number; // 3, 5, 0.5, 10
  packageUnit: string; // "kg", "gram", "litre", "adet"
  packagePrice: number; // 200, 250, 450 TL

  // Birim Fiyat (otomatik hesaplanan)
  unitPrice: number; // packagePrice / packageSize

  // Güven & Doğrulama
  confidenceScore: number; // 0-100
  dataSource: DataSource;
  verifiedAt?: string;

  // Tarihler
  lastUpdated: string;
  createdAt: string;
}

// Fiyat Geçmişi
export interface PriceHistory {
  id: string;
  priceEntryId: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  changedBy: string; // "AI", "MANUAL", "USER"
}

// Yardımcı tipler - Birim fiyat renk durumu
export type PriceLevel = "cheapest" | "cheap" | "normal" | "expensive" | "very-expensive";

// Store interface
export interface PriceStore {
  // Data
  productCards: ProductCard[];
  priceEntries: PriceEntry[];
  priceHistory: PriceHistory[];

  // UI State
  selectedCategory: PriceCategory | null;
  searchQuery: string;

  // Product Card Actions
  addProductCard: (card: ProductCard) => void;
  updateProductCard: (id: string, updates: Partial<ProductCard>) => void;
  deleteProductCard: (id: string) => void;

  // Price Entry Actions
  addPriceEntry: (entry: PriceEntry) => void;
  updatePriceEntry: (id: string, updates: Partial<PriceEntry>) => void;
  deletePriceEntry: (id: string) => void;

  // Price History Actions
  addPriceHistory: (history: PriceHistory) => void;
  getPriceHistory: (priceEntryId: string) => PriceHistory[];

  // Query Actions
  getProductCardsByCategory: (category: PriceCategory | null) => ProductCard[];
  getPriceEntriesByProductCard: (productCardId: string) => PriceEntry[];
  getCheapestPriceForProduct: (productCardId: string) => PriceEntry | null;

  // UI Actions
  setSelectedCategory: (category: PriceCategory | null) => void;
  setSearchQuery: (query: string) => void;
}

// Legacy type (backward compatibility - silinebilir)
export interface PriceItem {
  id: string;
  name: string;
  category: PriceCategory;
  price: number;
  unit: string;
  lastUpdated: string;
  source?: string;
  createdAt: string;
}
