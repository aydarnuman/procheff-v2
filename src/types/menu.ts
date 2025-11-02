// Menü ve Yemek Tipleri

export type InstitutionType = "hastane" | "okul" | "fabrika" | "belediye" | "askeri";

export interface Ingredient {
  name: string;
  amount: number;
  unit: string; // "g", "ml", "adet", "yemek kaşığı" vb.
}

export interface Recipe {
  id: string;
  name: string;
  category: "corba" | "ana_yemek" | "pilav" | "salata" | "tatli" | "icecek" | "aperatif";
  institutions: InstitutionType[]; // Hangi kurumlarda var (boş array = genel havuzda)
  ingredients: Ingredient[];
  instructions: string[]; // Adım adım tarif
  servings: number; // Kaç kişilik
  prepTime: number; // Hazırlık süresi (dakika)
  cookTime: number; // Pişirme süresi (dakika)
  difficulty: "kolay" | "orta" | "zor";
  calories?: number; // Kişi başı kalori
  cost?: number; // Tahmini maliyet (TL)
  notes?: string; // Ek notlar
  createdAt: string; // ISO string format
  updatedAt: string; // ISO string format
}

export interface DishSuggestion {
  original: string; // Kullanıcının yazdığı
  suggested: string; // AI'ın önerdiği
  confidence: number; // 0-100 arası güven skoru
  alternatives?: string[]; // Alternatif öneriler
}
