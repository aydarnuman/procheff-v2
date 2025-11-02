/**
 * Teklif Verileri için Güçlü TypeScript Tipleri
 * YENİ MİMARİ: Dağılım tablosu bazlı sistem
 */

// Öğün Tipleri
export type MealType =
  | "sabah_kahvaltisi"      // Sabah Kahvaltısı
  | "ogle_yemegi"           // Öğle Yemeği
  | "aksam_yemegi"          // Akşam Yemeği
  | "kusluk"                // Kuşluk (Ara Öğün)
  | "diyet";                // Diyet Menüsü

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  sabah_kahvaltisi: "🥐 Sabah Kahvaltısı",
  ogle_yemegi: "🍽️ Öğle Yemeği",
  aksam_yemegi: "🍛 Akşam Yemeği",
  kusluk: "☕ Kuşluk (Ara Öğün)",
  diyet: "🥗 Diyet Menüsü"
};

// Diyet Tipleri
export type DietType =
  | "standart"
  | "diyet"
  | "vejetaryen"
  | "glutensiz"
  | "diyabetik";

export const DIET_TYPE_LABELS: Record<DietType, string> = {
  standart: "Standart",
  diyet: "Diyet",
  vejetaryen: "Vejetaryen",
  glutensiz: "Glutensiz",
  diyabetik: "Diyabetik"
};

// Öğün Dağılım Satırı
export interface MealDistributionRow {
  mealType: MealType;           // Öğün tipi
  dietType: DietType;           // Diyet tipi
  adet: number;                 // Öğün adedi
  birimFiyat: number;           // Birim fiyat (TL/öğün)
  toplam?: number;              // Türetilen: adet × birimFiyat
}

// Girdi Modu
export type InputMode = "adet" | "yuzde" | "kural";

export const INPUT_MODE_LABELS: Record<InputMode, string> = {
  adet: "📊 Doğrudan Adet Gir",
  yuzde: "📈 Yüzde Dağılımı",
  kural: "🤖 Kural Bazlı (AI Üretir)"
};

// Yeni Maliyet Verisi
export interface CostData {
  // Temel bilgiler
  peopleCount: number;          // Kişi sayısı
  daysPerYear: number;          // Yıllık gün sayısı

  // Girdi modu
  inputMode: InputMode;         // Hangi modda çalışıyoruz?

  // Dağılım tablosu (ASIL VERİ)
  distribution: MealDistributionRow[];

  // Türetilen değerler (salt okunur)
  totalMeals?: number;          // Toplam = Σ(distribution[].adet)
  subtotal?: number;            // Ara Toplam = Σ(distribution[].toplam)

  // Yüzde modu için
  percentages?: {
    [key in MealType]?: number; // Örn: kahvalti: 30
  };

  // Kural modu için
  rules?: {
    weekdayRatio: number;       // Hafta içi katılım %
    weekendRatio: number;       // Hafta sonu katılım %
    holidayDays: number;        // Resmi tatil günleri
    ramadan: boolean;           // Ramazan iftar var mı?
  };

  // Finansal
  profitMargin: number;         // Kâr marjı (%)
  discount: number;             // İndirim (%)
  vatRate: number;              // KDV oranı (%)

  // ESKİ ALANLAR - Geriye dönük uyumluluk
  mealsPerDay?: number;
  totalMeals_old?: number;
  breakfastPrice?: number;
  lunchPrice?: number;
  dinnerPrice?: number;
  unitPrice?: number;
  breakfastCount?: number;
  lunchCount?: number;
  dinnerCount?: number;
}

export interface ProposalData {
  cost: CostData;
  personnel: any[]; // TODO: Tip eklenecek
  documents: any[];
  timeline: Record<string, any>;
  risk: any[];
  payment: Record<string, any>;
  materials: any[];
  menu: any[];
}

/**
 * YENİ Validation Fonksiyonları - Dağılım Tablosu Bazlı
 */
export class ProposalValidator {
  /**
   * Dağılım tablosunu doğrula
   */
  static validateDistribution(distribution: MealDistributionRow[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Null/undefined kontrolü
    if (!distribution || !Array.isArray(distribution)) {
      errors.push("Dağılım tablosu tanımlı değil!");
      return { isValid: false, errors, warnings };
    }

    if (distribution.length === 0) {
      errors.push("Dağılım tablosu boş! En az bir öğün satırı olmalı.");
      return { isValid: false, errors, warnings };
    }

    distribution.forEach((row, index) => {
      // BOŞ satırları skip et (hem adet=0 hem birimFiyat=0)
      const isEmpty = row.adet === 0 && row.birimFiyat === 0;
      if (isEmpty) {
        return; // Boş satırlar için validation yapma
      }

      // Adet kontrolü
      if (row.adet < 0) {
        errors.push(`Satır ${index + 1}: Adet negatif olamaz (${row.adet})`);
      }
      if (row.adet === 0) {
        warnings.push(`Satır ${index + 1}: Adet sıfır (${MEAL_TYPE_LABELS[row.mealType]})`);
      }

      // Birim fiyat kontrolü
      if (row.birimFiyat < 0) {
        errors.push(`Satır ${index + 1}: Birim fiyat negatif olamaz`);
      }
      if (row.birimFiyat > 1000) {
        warnings.push(`Satır ${index + 1}: Birim fiyat çok yüksek (${row.birimFiyat.toLocaleString()}₺)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Toplam öğünü hesapla
   */
  static calculateTotalMeals(distribution: MealDistributionRow[]): number {
    if (!distribution || !Array.isArray(distribution)) return 0;
    return distribution.reduce((sum, row) => sum + (row.adet || 0), 0);
  }

  /**
   * Ara toplamı hesapla
   */
  static calculateSubtotal(distribution: MealDistributionRow[]): number {
    if (!distribution || !Array.isArray(distribution)) return 0;
    return distribution.reduce((sum, row) => sum + ((row.adet || 0) * (row.birimFiyat || 0)), 0);
  }

  /**
   * Yüzde dağılımını doğrula
   */
  static validatePercentages(percentages: Record<string, number>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const total = Object.values(percentages).reduce((sum, val) => sum + val, 0);

    if (Math.abs(total - 100) > 0.01) {
      errors.push(`Yüzde toplamı %100 olmalı! Şu an: %${total.toFixed(2)}`);
    }

    Object.entries(percentages).forEach(([key, value]) => {
      if (value < 0 || value > 100) {
        errors.push(`${key}: Yüzde değeri 0-100 arası olmalı (${value}%)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Yüzdeyi adete çevir
   */
  static convertPercentagesToDistribution(
    totalMeals: number,
    percentages: Record<MealType, number>,
    defaultPrice: number = 0
  ): MealDistributionRow[] {
    const distribution: MealDistributionRow[] = [];
    let assignedTotal = 0;
    let largestKey: MealType | null = null;
    let largestValue = 0;

    // Her öğün tipi için hesapla
    Object.entries(percentages).forEach(([mealType, percentage]) => {
      const adet = Math.round((totalMeals * percentage) / 100);
      assignedTotal += adet;

      // En büyük grubu bul (yuvarlama farkını buna ekleyeceğiz)
      if (percentage > largestValue) {
        largestValue = percentage;
        largestKey = mealType as MealType;
      }

      distribution.push({
        mealType: mealType as MealType,
        dietType: "standart",
        adet,
        birimFiyat: defaultPrice,
        toplam: adet * defaultPrice
      });
    });

    // Yuvarlama farkını en büyük gruba ekle
    const difference = totalMeals - assignedTotal;
    if (difference !== 0 && largestKey) {
      const largestRow = distribution.find(r => r.mealType === largestKey);
      if (largestRow) {
        largestRow.adet += difference;
        largestRow.toplam = largestRow.adet * largestRow.birimFiyat;
      }
    }

    return distribution;
  }

  /**
   * Maliyet verilerini doğrula (yeni mimari)
   */
  static validateCostData(data: CostData): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Kişi sayısı kontrolü
    if (data.peopleCount < 1) {
      errors.push("Kişi sayısı en az 1 olmalıdır");
    } else if (data.peopleCount < 10) {
      warnings.push(`Kişi sayısı çok düşük (${data.peopleCount})`);
    }

    // Gün sayısı kontrolü
    if (data.daysPerYear < 1 || data.daysPerYear > 366) {
      errors.push(`Yıllık gün sayısı mantıksız: ${data.daysPerYear}`);
    }

    // Dağılım tablosu kontrolü
    const distValidation = this.validateDistribution(data.distribution);
    errors.push(...distValidation.errors);
    warnings.push(...distValidation.warnings);

    // Toplam kontrolü
    const calculatedTotal = this.calculateTotalMeals(data.distribution);
    if (data.totalMeals && Math.abs(data.totalMeals - calculatedTotal) > 1) {
      errors.push(
        `Toplam öğün uyuşmuyor! ` +
        `Hesaplanan: ${calculatedTotal.toLocaleString()}, ` +
        `Belirtilen: ${data.totalMeals.toLocaleString()}`
      );
    }

    // Finansal kontroller
    if (data.profitMargin < 0 || data.profitMargin > 100) {
      errors.push(`Kâr marjı ${data.profitMargin}% mantıksız`);
    }

    if (![0, 1, 8, 10, 18, 20].includes(data.vatRate)) {
      warnings.push(`KDV oranı ${data.vatRate}% standart değil`);
    }

    // Toplam tutar kontrolü
    const subtotal = this.calculateSubtotal(data.distribution);
    const total = subtotal * (1 + data.profitMargin / 100) * (1 + data.vatRate / 100);

    if (total > 1_000_000_000) {
      errors.push(
        `🚨 TOPLAM TEKLİF ÇOK YÜKSEK: ${total.toLocaleString()}₺ (1 milyar TL üstü!)`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
