/**
 * Kurum Bazlı Standart Gramajlar
 * Kaynak: Sağlık Bakanlığı, MEB, TSE standartları
 */

import type { InstitutionType } from "@/types/menu";

export interface PortionStandard {
  institutionType: InstitutionType;
  dishCategory: string;
  dishName: string;
  ingredients: {
    name: string;
    amount: number;
    unit: string;
  }[];
  servingSize: number; // Kişi başı porsiyon (g)
  source: string; // Referans
}

/**
 * Hastane Menü Standartları
 * Kaynak: Sağlık Bakanlığı Hasta Beslenmesi Yönergesi 2024-2025
 */
export const hospitalStandards: PortionStandard[] = [
  {
    institutionType: "hastane",
    dishCategory: "ana_yemek",
    dishName: "Orman Kebabı",
    ingredients: [
      { name: "Kuşbaşı et (dana)", amount: 100, unit: "g" },
      { name: "Patates", amount: 150, unit: "g" },
      { name: "Domates", amount: 50, unit: "g" },
      { name: "Biber", amount: 30, unit: "g" },
      { name: "Soğan", amount: 30, unit: "g" },
      { name: "Sıvı yağ", amount: 15, unit: "ml" },
      { name: "Tuz", amount: 3, unit: "g" },
      { name: "Karabiber", amount: 1, unit: "g" },
    ],
    servingSize: 380,
    source: "Sağlık Bakanlığı - Hasta Beslenmesi Yönergesi 2024-2025",
  },
  {
    institutionType: "hastane",
    dishCategory: "ana_yemek",
    dishName: "Kuru Fasulye",
    ingredients: [
      { name: "Kuru fasulye (haşlanmış)", amount: 120, unit: "g" },
      { name: "Kuşbaşı et", amount: 50, unit: "g" },
      { name: "Soğan", amount: 30, unit: "g" },
      { name: "Salça", amount: 20, unit: "g" },
      { name: "Sıvı yağ", amount: 15, unit: "ml" },
      { name: "Tuz", amount: 3, unit: "g" },
      { name: "Karabiber", amount: 1, unit: "g" },
      { name: "Su", amount: 200, unit: "ml" },
    ],
    servingSize: 440,
    source: "Sağlık Bakanlığı - Hasta Beslenmesi Yönergesi 2024-2025",
  },
  {
    institutionType: "hastane",
    dishCategory: "corba",
    dishName: "Mercimek Çorbası",
    ingredients: [
      { name: "Kırmızı mercimek", amount: 30, unit: "g" },
      { name: "Un", amount: 5, unit: "g" },
      { name: "Tereyağı", amount: 10, unit: "g" },
      { name: "Su", amount: 200, unit: "ml" },
      { name: "Tuz", amount: 2, unit: "g" },
    ],
    servingSize: 250,
    source: "Sağlık Bakanlığı - Hasta Beslenmesi Yönergesi 2024-2025",
  },
];

/**
 * Okul Menü Standartları
 * Kaynak: MEB Okul Yemek Hizmetleri Yönergesi 2024-2025
 */
export const schoolStandards: PortionStandard[] = [
  {
    institutionType: "okul",
    dishCategory: "ana_yemek",
    dishName: "Kuru Fasulye",
    ingredients: [
      { name: "Kuru fasulye (haşlanmış)", amount: 150, unit: "g" },
      { name: "Kuşbaşı et", amount: 60, unit: "g" },
      { name: "Soğan", amount: 40, unit: "g" },
      { name: "Salça", amount: 25, unit: "g" },
      { name: "Sıvı yağ", amount: 20, unit: "ml" },
      { name: "Tuz", amount: 3, unit: "g" },
      { name: "Pul biber", amount: 2, unit: "g" },
    ],
    servingSize: 500, // Çocuklar için daha büyük porsiyon
    source: "MEB - Okul Yemek Hizmetleri Yönergesi 2024-2025",
  },
  {
    institutionType: "okul",
    dishCategory: "corba",
    dishName: "Mercimek Çorbası",
    ingredients: [
      { name: "Kırmızı mercimek", amount: 40, unit: "g" },
      { name: "Un", amount: 8, unit: "g" },
      { name: "Tereyağı", amount: 12, unit: "g" },
      { name: "Su", amount: 250, unit: "ml" },
      { name: "Tuz", amount: 2, unit: "g" },
      { name: "Limon", amount: 10, unit: "ml" },
    ],
    servingSize: 300,
    source: "MEB - Okul Yemek Hizmetleri Yönergesi 2024-2025",
  },
];

/**
 * Fabrika/İşletme Standartları
 * Kaynak: İSG Mevzuatı - İşçi Yemekleri Standartları 2024-2025
 */
export const factoryStandards: PortionStandard[] = [
  {
    institutionType: "fabrika",
    dishCategory: "ana_yemek",
    dishName: "Kuru Fasulye",
    ingredients: [
      { name: "Kuru fasulye (haşlanmış)", amount: 180, unit: "g" },
      { name: "Kuşbaşı et", amount: 80, unit: "g" },
      { name: "Soğan", amount: 50, unit: "g" },
      { name: "Salça", amount: 30, unit: "g" },
      { name: "Sıvı yağ", amount: 25, unit: "ml" },
      { name: "Tuz", amount: 4, unit: "g" },
      { name: "Karabiber", amount: 2, unit: "g" },
    ],
    servingSize: 600, // Ağır işçi için yüksek kalori
    source: "İSG Mevzuatı - İşçi Yemekleri Standartları 2024-2025",
  },
];

/**
 * Belediye/Kamu Kurumu Standartları
 */
export const municipalityStandards: PortionStandard[] = [
  {
    institutionType: "belediye",
    dishCategory: "ana_yemek",
    dishName: "Kuru Fasulye",
    ingredients: [
      { name: "Kuru fasulye (haşlanmış)", amount: 140, unit: "g" },
      { name: "Kuşbaşı et", amount: 70, unit: "g" },
      { name: "Soğan", amount: 35, unit: "g" },
      { name: "Salça", amount: 22, unit: "g" },
      { name: "Sıvı yağ", amount: 18, unit: "ml" },
      { name: "Tuz", amount: 3, unit: "g" },
    ],
    servingSize: 480,
    source: "Belediye Hizmet Standartları 2024-2025",
  },
];

/**
 * Askeri Birlik Standartları
 * Kaynak: MSB Asker Beslenmesi Yönergesi 2024-2025
 */
export const militaryStandards: PortionStandard[] = [
  {
    institutionType: "askeri",
    dishCategory: "ana_yemek",
    dishName: "Kuru Fasulye",
    ingredients: [
      { name: "Kuru fasulye (haşlanmış)", amount: 200, unit: "g" },
      { name: "Kuşbaşı et", amount: 100, unit: "g" },
      { name: "Soğan", amount: 60, unit: "g" },
      { name: "Salça", amount: 35, unit: "g" },
      { name: "Sıvı yağ", amount: 30, unit: "ml" },
      { name: "Tuz", amount: 5, unit: "g" },
      { name: "Karabiber", amount: 3, unit: "g" },
    ],
    servingSize: 650, // Yüksek kalori gereksinimi
    source: "MSB - Asker Beslenmesi Yönergesi 2024-2025",
  },
];

/**
 * Tüm standartları birleştir
 */
export const allStandards = [
  ...hospitalStandards,
  ...schoolStandards,
  ...factoryStandards,
  ...municipalityStandards,
  ...militaryStandards,
];

/**
 * Kurum ve yemek adına göre standart gramaj bul
 */
export function findPortionStandard(
  institutionType: InstitutionType,
  dishName: string
): PortionStandard | null {
  // Tam eşleşme ara
  const exactMatch = allStandards.find(
    (std) =>
      std.institutionType === institutionType &&
      std.dishName.toLowerCase() === dishName.toLowerCase()
  );

  if (exactMatch) return exactMatch;

  // Kısmi eşleşme ara (örn: "Etli Kuru Fasulye" → "Kuru Fasulye")
  const partialMatch = allStandards.find(
    (std) =>
      std.institutionType === institutionType &&
      (dishName.toLowerCase().includes(std.dishName.toLowerCase()) ||
        std.dishName.toLowerCase().includes(dishName.toLowerCase()))
  );

  return partialMatch || null;
}

/**
 * Yemek adına göre tüm kurumların standartlarını getir
 */
export function getAllInstitutionStandards(dishName: string): PortionStandard[] {
  return allStandards.filter(
    (std) =>
      std.dishName.toLowerCase() === dishName.toLowerCase() ||
      dishName.toLowerCase().includes(std.dishName.toLowerCase()) ||
      std.dishName.toLowerCase().includes(dishName.toLowerCase())
  );
}
