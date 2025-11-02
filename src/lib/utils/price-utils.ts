import type { PriceEntry, PriceLevel } from "@/types/price";

/**
 * Birim fiyat hesaplar (packagePrice / packageSize)
 */
export function calculateUnitPrice(
  packagePrice: number,
  packageSize: number
): number {
  if (packageSize === 0) return 0;
  return Math.round((packagePrice / packageSize) * 100) / 100; // 2 ondalık basamak
}

/**
 * Birimleri kg'a çevirir (karşılaştırma için)
 */
export function normalizeToKg(size: number, unit: string): number {
  const lowerUnit = unit.toLowerCase();

  switch (lowerUnit) {
    case "kg":
    case "kilogram":
      return size;
    case "gram":
    case "gr":
    case "g":
      return size / 1000;
    case "litre":
    case "lt":
    case "l":
      return size; // Yaklaşık olarak 1 litre = 1 kg
    case "adet":
    case "ad":
      return size * 0.5; // Ortalama 1 adet = 0.5 kg (varsayım)
    default:
      return size;
  }
}

/**
 * Fiyat seviyesini belirler (en ucuz, ucuz, orta, pahalı, çok pahalı)
 */
export function getPriceLevel(
  currentPrice: number,
  allPrices: PriceEntry[]
): PriceLevel {
  if (allPrices.length === 0) return "normal";

  const prices = allPrices.map((p) => p.unitPrice).sort((a, b) => a - b);
  const min = prices[0];
  const max = prices[prices.length - 1];
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  // En ucuz
  if (currentPrice === min) return "cheapest";

  // Çok pahalı (ortalamadan %30+ fazla)
  if (currentPrice >= avg * 1.3) return "very-expensive";

  // Pahalı (ortalamadan %10+ fazla)
  if (currentPrice >= avg * 1.1) return "expensive";

  // Ucuz (ortalamadan %10- az)
  if (currentPrice <= avg * 0.9) return "cheap";

  // Normal
  return "normal";
}

/**
 * Fiyat seviyesine göre emoji icon döndürür
 */
export function getPriceLevelIcon(level: PriceLevel): string {
  switch (level) {
    case "cheapest":
      return "🏆";
    case "cheap":
      return "✅";
    case "normal":
      return "💰";
    case "expensive":
      return "⭐";
    case "very-expensive":
      return "🔴";
  }
}

/**
 * Fiyat seviyesine göre renk class'ı döndürür (Tailwind)
 */
export function getPriceLevelColor(level: PriceLevel): string {
  switch (level) {
    case "cheapest":
      return "text-green-600 bg-green-50";
    case "cheap":
      return "text-green-500 bg-green-50";
    case "normal":
      return "text-yellow-600 bg-yellow-50";
    case "expensive":
      return "text-orange-600 bg-orange-50";
    case "very-expensive":
      return "text-red-600 bg-red-50";
  }
}

/**
 * Güven skoruna göre badge rengi döndürür
 */
export function getConfidenceBadgeColor(score: number): string {
  if (score >= 90) return "bg-green-100 text-green-700";
  if (score >= 70) return "bg-yellow-100 text-yellow-700";
  if (score >= 50) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

/**
 * Fiyat değişim yüzdesini hesaplar
 */
export function calculatePriceChange(
  oldPrice: number,
  newPrice: number
): { percentage: number; direction: "up" | "down" | "same" } {
  if (oldPrice === 0) return { percentage: 0, direction: "same" };

  const change = ((newPrice - oldPrice) / oldPrice) * 100;
  const percentage = Math.round(change * 10) / 10; // 1 ondalık basamak

  if (percentage > 0) return { percentage, direction: "up" };
  if (percentage < 0)
    return { percentage: Math.abs(percentage), direction: "down" };
  return { percentage: 0, direction: "same" };
}

/**
 * Tarih formatı (Türkçe, göreceli)
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Bugün";
  if (diffDays === 1) return "Dün";
  if (diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
  return `${Math.floor(diffDays / 365)} yıl önce`;
}

/**
 * Para formatı (Türk Lirası)
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Kategori emoji'si döndürür
 */
export function getCategoryIcon(category: string): string {
  switch (category) {
    case "sebze":
      return "🥬";
    case "et-tavuk":
      return "🥩";
    case "bakliyat":
      return "🌾";
    case "sut-peynir":
      return "🥛";
    case "temel-gida":
      return "🍞";
    case "baharat":
      return "🧂";
    default:
      return "📦";
  }
}

/**
 * Kategori adını Türkçe döndürür
 */
export function getCategoryName(category: string): string {
  switch (category) {
    case "sebze":
      return "Sebzeler";
    case "et-tavuk":
      return "Et & Tavuk";
    case "bakliyat":
      return "Bakliyat";
    case "sut-peynir":
      return "Süt & Peynir";
    case "temel-gida":
      return "Temel Gıda";
    case "baharat":
      return "Baharat";
    default:
      return "Diğer";
  }
}
