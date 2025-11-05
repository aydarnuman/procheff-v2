import { ExtractedData } from "@/types/ai";

export interface ValidationWarning {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
  original_value: any;
  suggested_value?: any;
  auto_fixed: boolean;
}

export interface ValidationResult {
  data: ExtractedData;
  warnings: ValidationWarning[];
  auto_fixes_applied: number;
}

/**
 * Validation Süzgeci - AI'dan gelen verileri kontrol edip düzelt
 */
export class DataValidator {
  /**
   * Ana validation fonksiyonu
   */
  static validate(data: ExtractedData): ValidationResult {
    const warnings: ValidationWarning[] = [];
    let fixed_data = { ...data };
    let auto_fixes = 0;

    // 1. Kişi Sayısı Kontrolü (En Kritik!)
    const kisiResult = this.validateKisiSayisi(fixed_data);
    if (kisiResult.warning) warnings.push(kisiResult.warning);
    if (kisiResult.fixed_data) {
      fixed_data = kisiResult.fixed_data;
      if (kisiResult.warning?.auto_fixed) auto_fixes++;
    }

    // 2. Öğün Sayısı Kontrolü
    const ogunResult = this.validateOgunSayisi(fixed_data);
    if (ogunResult.warning) warnings.push(ogunResult.warning);
    if (ogunResult.fixed_data) {
      fixed_data = ogunResult.fixed_data;
      if (ogunResult.warning?.auto_fixed) auto_fixes++;
    }

    // 3. Gün Sayısı Kontrolü
    const gunResult = this.validateGunSayisi(fixed_data);
    if (gunResult.warning) warnings.push(gunResult.warning);
    if (gunResult.fixed_data) {
      fixed_data = gunResult.fixed_data;
      if (gunResult.warning?.auto_fixed) auto_fixes++;
    }

    // 4. Çapraz Doğrulama (Kişi × Öğün × Gün mantıklı mı?)
    const crossResult = this.validateCrossCheck(fixed_data);
    if (crossResult.warning) warnings.push(crossResult.warning);

    // 5. Bütçe Kontrolü
    const butceResult = this.validateButce(fixed_data);
    if (butceResult.warning) warnings.push(butceResult.warning);

    // 6. Anomaly Detection (İstatistiksel Aykırı Değer Tespiti)
    const anomalyResult = this.detectAnomalies(fixed_data);
    if (anomalyResult.warnings) warnings.push(...anomalyResult.warnings);

    return {
      data: fixed_data,
      warnings,
      auto_fixes_applied: auto_fixes,
    };
  }

  /**
   * Kişi sayısı validation - EN ÖNEMLİ!
   */
  private static validateKisiSayisi(data: ExtractedData): {
    fixed_data?: ExtractedData;
    warning?: ValidationWarning;
  } {
    const kisi = data.kisi_sayisi;

    if (kisi === null || kisi === undefined) {
      return {
        warning: {
          field: "kisi_sayisi",
          severity: "warning",
          message: "Kişi sayısı bulunamadı",
          original_value: null,
          auto_fixed: false,
        },
      };
    }

    // 🚫 ÇOK KRİTİK: 1-30 arası MADDE NUMARASI olabilir!
    // Örnek: "17-Yüklenici" maddesindeki 17'yi kişi sayısı olarak almış olabilir
    if (kisi > 0 && kisi <= 30) {
      // Kaynak göster
      const kaynak = (data._sources as any)?.kisi_sayisi;
      let kaynakMesaj = "";

      if (kaynak?.proof) {
        kaynakMesaj = `\n     📚 AI'ın gördüğü kaynak: "${kaynak.proof.substring(0, 200)}..."`;
        console.log(`\n🔍 KAYNAK ANALİZİ (kisi_sayisi = ${kisi}):`);
        console.log(`   ${kaynak.proof.substring(0, 300)}...`);
      } else {
        console.log(`\n⚠️  kisi_sayisi = ${kisi} ama KAYNAK YOK!`);
      }

      return {
        fixed_data: {
          ...data,
          kisi_sayisi: null, // Şüpheli sayıyı sil
        },
        warning: {
          field: "kisi_sayisi",
          severity: "error",
          message: `🚫 AI ${kisi} kişi dedi ama bu ÇOK KÜÇÜK! Muhtemelen MADDE NUMARASI ("${kisi}-Yüklenici" gibi). Kişi sayısı NULL olarak işaretlendi. Manuel kontrol gerekli!${kaynakMesaj}`,
          original_value: kisi,
          suggested_value: null,
          auto_fixed: true,
        },
      };
    }

    // KRİTİK: 10.000'den büyükse muhtemelen ÖĞÜN sayısı
    // İYİLEŞTİRME: 1000'den itibaren şüphe başlıyor, 10000'de kesin hata
    if (kisi > 1000) {
      const ogun = data.ogun_sayisi || 3;
      const gun = data.gun_sayisi || 365;

      // Eğer öğün ve gün varsa, kişi sayısını hesapla
      if (ogun && gun && gun > 0 && ogun > 0) {
        const calculated_kisi = Math.round(kisi / gun / ogun);

        // 1000-10000 arası: Uyar ama düzeltme
        if (kisi < 10000 && calculated_kisi >= 10) {
          // Eğer hesaplanan değer mantıklıysa düzelt
          return {
            fixed_data: {
              ...data,
              kisi_sayisi: calculated_kisi,
            },
            warning: {
              field: "kisi_sayisi",
              severity: "warning",
              message: `⚠️  AI ${kisi.toLocaleString()} kişi dedi ama bu şüpheli. Formül ile düzeltildi: ${kisi.toLocaleString()} ÷ ${gun} gün ÷ ${ogun} öğün = ${calculated_kisi} kişi. Eğer yanlışsa manuel düzeltin.`,
              original_value: kisi,
              suggested_value: calculated_kisi,
              auto_fixed: true,
            },
          };
        }

        // 10000+ kesin hata
        return {
          fixed_data: {
            ...data,
            kisi_sayisi: calculated_kisi,
          },
          warning: {
            field: "kisi_sayisi",
            severity: "error",
            message: `🚨 AI ${kisi.toLocaleString()} kişi dedi ama bu muhtemelen TOPLAM ÖĞÜN sayısı! Otomatik düzeltildi: ${kisi.toLocaleString()} ÷ ${gun} gün ÷ ${ogun} öğün = ${calculated_kisi} kişi`,
            original_value: kisi,
            suggested_value: calculated_kisi,
            auto_fixed: true,
          },
        };
      } else {
        // Öğün/gün yoksa sadece uyar
        const severity = kisi > 10000 ? "error" : "warning";
        return {
          warning: {
            field: "kisi_sayisi",
            severity,
            message: `${severity === "error" ? "🚨" : "⚠️"} Kişi sayısı ${kisi.toLocaleString()} ${kisi > 10000 ? "çok" : "oldukça"} yüksek! Bu muhtemelen ÖĞÜN sayısı veya AI tüm kuruluşları topladı. Öğün ve gün sayısı olmadığı için otomatik düzeltilemedi. Manuel kontrol edin!`,
            original_value: kisi,
            auto_fixed: false,
          },
        };
      }
    }

    // Çok küçükse (< 10) - muhtemelen tek kuruluş/birim sayısı, tüm kuruluşları toplamadı
    if (kisi < 10) {
      // Eğer metinde "kuruluş", "huzurevi", "tesis" gibi kelimeler varsa çoklu birim olabilir
      // Bu durumda AI'ya dönüp tekrar sorabilirdik ama şimdilik sadece uyar
      return {
        warning: {
          field: "kisi_sayisi",
          severity: "warning",
          message: `Kişi sayısı çok düşük (${kisi}). AI muhtemelen sadece 1 kuruluşu/tabloyu okudu, diğerlerini kaçırdı. Belgede birden fazla tablo/kuruluş varsa toplamını kontrol edin.`,
          original_value: kisi,
          auto_fixed: false,
        },
      };
    }

    // 10-10.000 arası normal
    return {};
  }

  /**
   * Öğün sayısı validation
   */
  private static validateOgunSayisi(data: ExtractedData): {
    fixed_data?: ExtractedData;
    warning?: ValidationWarning;
  } {
    const ogun = data.ogun_sayisi;

    if (ogun === null || ogun === undefined) {
      return {
        warning: {
          field: "ogun_sayisi",
          severity: "info",
          message: "Öğün sayısı bulunamadı. Varsayılan: 3 öğün kullanılabilir.",
          original_value: null,
          auto_fixed: false,
        },
      };
    }

    // Öğün 5'ten fazlaysa şüpheli
    if (ogun > 5) {
      return {
        warning: {
          field: "ogun_sayisi",
          severity: "warning",
          message: `Öğün sayısı ${ogun} çok yüksek. Günde genellikle 2-3 öğün olur. AI yanlış yorumlamış olabilir.`,
          original_value: ogun,
          auto_fixed: false,
        },
      };
    }

    // Öğün 1'den az olamaz
    if (ogun < 1) {
      return {
        fixed_data: {
          ...data,
          ogun_sayisi: 3,
        },
        warning: {
          field: "ogun_sayisi",
          severity: "error",
          message: `Öğün sayısı ${ogun} mantıksız. Varsayılan 3 öğün olarak düzeltildi.`,
          original_value: ogun,
          suggested_value: 3,
          auto_fixed: true,
        },
      };
    }

    return {};
  }

  /**
   * Gün sayısı validation
   */
  private static validateGunSayisi(data: ExtractedData): {
    fixed_data?: ExtractedData;
    warning?: ValidationWarning;
  } {
    const gun = data.gun_sayisi;

    if (gun === null || gun === undefined) {
      return {
        warning: {
          field: "gun_sayisi",
          severity: "info",
          message: "Gün sayısı bulunamadı. İhale süresi net değil.",
          original_value: null,
          auto_fixed: false,
        },
      };
    }

    // Gün 500'den fazlaysa şüpheli (1.5 yıldan fazla)
    if (gun > 500) {
      return {
        warning: {
          field: "gun_sayisi",
          severity: "warning",
          message: `Gün sayısı ${gun} çok yüksek (${Math.round(gun / 365)} yıl). Doğru mu kontrol edin.`,
          original_value: gun,
          auto_fixed: false,
        },
      };
    }

    // Gün 30'dan az çok kısa
    if (gun < 30 && gun > 0) {
      return {
        warning: {
          field: "gun_sayisi",
          severity: "warning",
          message: `Gün sayısı ${gun} çok kısa (1 aydan az). İhale süresi doğru mu?`,
          original_value: gun,
          auto_fixed: false,
        },
      };
    }

    return {};
  }

  /**
   * Çapraz doğrulama - Kişi × Öğün × Gün mantıklı mı?
   */
  private static validateCrossCheck(data: ExtractedData): {
    warning?: ValidationWarning;
  } {
    const { kisi_sayisi, ogun_sayisi, gun_sayisi } = data;

    // Hepsi varsa çapraz kontrol yap
    if (
      kisi_sayisi &&
      ogun_sayisi &&
      gun_sayisi &&
      kisi_sayisi > 0 &&
      ogun_sayisi > 0 &&
      gun_sayisi > 0
    ) {
      const toplam_ogun = kisi_sayisi * ogun_sayisi * gun_sayisi;

      // Toplam öğün çok büyükse uyar
      if (toplam_ogun > 50_000_000) {
        return {
          warning: {
            field: "cross_check",
            severity: "warning",
            message: `Toplam öğün ${toplam_ogun.toLocaleString()} çok yüksek! (${kisi_sayisi} kişi × ${ogun_sayisi} öğün × ${gun_sayisi} gün). Sayılar doğru mu kontrol edin.`,
            original_value: toplam_ogun,
            auto_fixed: false,
          },
        };
      }

      // Toplam öğün çok küçükse uyar
      if (toplam_ogun < 1000) {
        return {
          warning: {
            field: "cross_check",
            severity: "info",
            message: `Toplam öğün ${toplam_ogun.toLocaleString()} (${kisi_sayisi} kişi × ${ogun_sayisi} öğün × ${gun_sayisi} gün). Küçük ölçekli bir ihale.`,
            original_value: toplam_ogun,
            auto_fixed: false,
          },
        };
      }
    }

    return {};
  }

  /**
   * Bütçe validation
   */
  private static validateButce(data: ExtractedData): {
    warning?: ValidationWarning;
  } {
    const butce = data.tahmini_butce;
    const { kisi_sayisi, ogun_sayisi, gun_sayisi } = data;

    // AUTO-FIX: Bütçe yoksa ama diğer veriler varsa tahmini hesapla
    if (!butce && kisi_sayisi && ogun_sayisi && gun_sayisi) {
      const ORTALAMA_MALIYET_PER_OGUN = 12; // TL (konservatif tahmin)
      const toplam_ogun = kisi_sayisi * ogun_sayisi * gun_sayisi;
      const tahmini_butce = toplam_ogun * ORTALAMA_MALIYET_PER_OGUN;

      // Auto-fix uygula
      (data as any).tahmini_butce = tahmini_butce;

      return {
        warning: {
          field: "tahmini_butce",
          severity: "info",
          message: `Bütçe bulunamadı. Otomatik tahmin: ${tahmini_butce.toLocaleString()} TL (${kisi_sayisi} kişi × ${ogun_sayisi} öğün × ${gun_sayisi} gün × ${ORTALAMA_MALIYET_PER_OGUN} TL)`,
          original_value: null,
          suggested_value: tahmini_butce,
          auto_fixed: true,
        },
      };
    }

    if (!butce) {
      return {
        warning: {
          field: "tahmini_butce",
          severity: "info",
          message: "Tahmini bütçe bulunamadı ve otomatik hesaplanamadı (kişi/öğün/gün bilgisi eksik).",
          original_value: null,
          auto_fixed: false,
        },
      };
    }

    // Bütçe çok düşükse uyar
    if (butce < 50000) {
      return {
        warning: {
          field: "tahmini_butce",
          severity: "warning",
          message: `Bütçe ${butce.toLocaleString()} TL çok düşük. Doğru mu?`,
          original_value: butce,
          auto_fixed: false,
        },
      };
    }

    // Kişi başı maliyet kontrolü
    if (kisi_sayisi && ogun_sayisi && gun_sayisi) {
      const toplam_ogun = kisi_sayisi * ogun_sayisi * gun_sayisi;
      if (toplam_ogun > 0) {
        const ogun_basina = butce / toplam_ogun;

        // Öğün başına 10 TL'den az şüpheli
        if (ogun_basina < 10) {
          return {
            warning: {
              field: "tahmini_butce",
              severity: "warning",
              message: `Öğün başı maliyet ${ogun_basina.toFixed(2)} TL çok düşük. Gerçekçi değil.`,
              original_value: butce,
              auto_fixed: false,
            },
          };
        }

        // Öğün başına 200 TL'den fazla lüks
        if (ogun_basina > 200) {
          return {
            warning: {
              field: "tahmini_butce",
              severity: "info",
              message: `Öğün başı maliyet ${ogun_basina.toFixed(2)} TL oldukça yüksek. Premium/özel hizmet olabilir.`,
              original_value: butce,
              auto_fixed: false,
            },
          };
        }
      }
    }

    return {};
  }

  /**
   * Anomaly Detection - İstatistiksel aykırı değer tespiti
   */
  private static detectAnomalies(data: ExtractedData): {
    warnings?: ValidationWarning[];
  } {
    const warnings: ValidationWarning[] = [];
    const { kisi_sayisi, tahmini_butce, ogun_sayisi, gun_sayisi } = data;

    // 1. Kişi sayısı anomalisi (Z-score benzeri yaklaşım)
    if (kisi_sayisi && kisi_sayisi > 0) {
      // Tipik ihale kişi sayısı aralıkları
      const TYPICAL_RANGES = {
        small: { min: 10, max: 100 },      // Küçük ölçek: 10-100 kişi
        medium: { min: 100, max: 500 },    // Orta ölçek: 100-500 kişi
        large: { min: 500, max: 2000 },    // Büyük ölçek: 500-2000 kişi
        xlarge: { min: 2000, max: 10000 }  // Çok büyük: 2000-10000 kişi
      };

      // 10,000'den büyük = anomaly
      if (kisi_sayisi > 10000) {
        warnings.push({
          field: "kisi_sayisi",
          severity: "error",
          message: `🔴 ANOMALY: Kişi sayısı ${kisi_sayisi.toLocaleString()} normalin çok üstünde! Bu muhtemelen öğün sayısı veya hatalı toplama. Acil manuel kontrol gerekli.`,
          original_value: kisi_sayisi,
          auto_fixed: false
        });
      }
      // 5000-10000 arası = şüpheli
      else if (kisi_sayisi > 5000) {
        warnings.push({
          field: "kisi_sayisi",
          severity: "warning",
          message: `🟡 ANOMALY: Kişi sayısı ${kisi_sayisi.toLocaleString()} olağandışı yüksek. Türkiye'de en büyük toplu yemek ihaleleri genelde 5000 kişinin altındadır. Kontrol edin.`,
          original_value: kisi_sayisi,
          auto_fixed: false
        });
      }
    }

    // 2. Bütçe anomalisi (Kişi başına bütçe kontrolü)
    if (tahmini_butce && kisi_sayisi && ogun_sayisi && gun_sayisi && gun_sayisi > 0) {
      const toplam_ogun = kisi_sayisi * ogun_sayisi * gun_sayisi;
      if (toplam_ogun > 0) {
        const ogun_basina = tahmini_butce / toplam_ogun;

        // Öğün başına 5 TL'den az = kritik anomaly
        if (ogun_basina < 5) {
          warnings.push({
            field: "tahmini_butce",
            severity: "error",
            message: `🔴 ANOMALY: Öğün başı maliyet ${ogun_basina.toFixed(2)} TL imkansız derecede düşük! (Bütçe: ${tahmini_butce.toLocaleString()} TL, Toplam öğün: ${toplam_ogun.toLocaleString()}). Bütçe muhtemelen hatalı.`,
            original_value: tahmini_butce,
            auto_fixed: false
          });
        }
        // Öğün başına 300 TL'den fazla = lüks/anomaly
        else if (ogun_basina > 300) {
          warnings.push({
            field: "tahmini_butce",
            severity: "warning",
            message: `🟡 ANOMALY: Öğün başı maliyet ${ogun_basina.toFixed(2)} TL olağanüstü yüksek! Bu bir otel/resort ihalesi olmadıkça muhtemelen hata var.`,
            original_value: tahmini_butce,
            auto_fixed: false
          });
        }
      }
    }

    // 3. Gün sayısı anomalisi
    if (gun_sayisi && gun_sayisi > 0) {
      // 2 yıldan uzun ihaleler nadir
      if (gun_sayisi > 730) {
        warnings.push({
          field: "gun_sayisi",
          severity: "warning",
          message: `🟡 ANOMALY: İhale süresi ${gun_sayisi} gün (${(gun_sayisi / 365).toFixed(1)} yıl) çok uzun. Türkiye'de yemek ihaleleri genelde 1 yıllık olur.`,
          original_value: gun_sayisi,
          auto_fixed: false
        });
      }
      // 7 günden kısa = test/etkinlik ihalesi olmalı
      else if (gun_sayisi < 7) {
        warnings.push({
          field: "gun_sayisi",
          severity: "info",
          message: `ℹ️ ANOMALY: İhale süresi ${gun_sayisi} gün çok kısa. Bu bir etkinlik/kısa dönemli hizmet olabilir.`,
          original_value: gun_sayisi,
          auto_fixed: false
        });
      }
    }

    // 4. Öğün sayısı anomalisi
    if (ogun_sayisi && ogun_sayisi > 0) {
      // 4'ten fazla öğün nadir
      if (ogun_sayisi > 4) {
        warnings.push({
          field: "ogun_sayisi",
          severity: "warning",
          message: `🟡 ANOMALY: Öğün sayısı ${ogun_sayisi} alışılmadık yüksek. Günde genelde 2-3 öğün olur (ara öğünler ayrı sayılıyorsa mantıklı olabilir).`,
          original_value: ogun_sayisi,
          auto_fixed: false
        });
      }
    }

    // 5. Çapraz anomaly (Toplam öğün sayısı)
    if (kisi_sayisi && ogun_sayisi && gun_sayisi && kisi_sayisi > 0 && ogun_sayisi > 0 && gun_sayisi > 0) {
      const toplam_ogun = kisi_sayisi * ogun_sayisi * gun_sayisi;

      // 100 milyondan fazla öğün = kesin anomaly
      if (toplam_ogun > 100_000_000) {
        warnings.push({
          field: "cross_check",
          severity: "error",
          message: `🔴 ANOMALY: Toplam öğün sayısı ${toplam_ogun.toLocaleString()} fiziksel olarak imkansız! (${kisi_sayisi} kişi × ${ogun_sayisi} öğün × ${gun_sayisi} gün). Sayıların tamamı yanlış olabilir.`,
          original_value: toplam_ogun,
          auto_fixed: false
        });
      }
      // 100'den az öğün = çok küçük/test
      else if (toplam_ogun < 100) {
        warnings.push({
          field: "cross_check",
          severity: "info",
          message: `ℹ️ ANOMALY: Toplam öğün sayısı ${toplam_ogun} çok küçük. Bu bir pilot/demo ihale olabilir.`,
          original_value: toplam_ogun,
          auto_fixed: false
        });
      }
    }

    return warnings.length > 0 ? { warnings } : {};
  }
}
