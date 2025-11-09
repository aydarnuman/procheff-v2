// AI Configuration Types
export interface AIConfig {
  provider: "claude" | "openai";
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface MenuDay {
  gun: number;
  gun_adi?: string;
  corba?: {
    adi: string;
    gramaj?: string;
  };
  ana_yemek: {
    adi: string;
    gramaj: string;
  };
  yan_yemek?: {
    adi: string;
    gramaj?: string;
  };
  salata?: {
    adi: string;
    gramaj?: string;
  };
  tatli?: {
    adi: string;
    gramaj?: string;
  };
}

export interface KritikMalzeme {
  yemek_adi: string;
  malzeme: string;
  gramaj: string;
  aciklama?: string; // "Kırmızı et, dana"
}

// Modüler API Response Types
export interface BasicExtraction {
  reasoning?: {
    kisi_sayisi_dusunce?: string;
    ogun_sayisi_dusunce?: string;
    toplam_dogrulama?: string;
  };
  kurum: string;
  ihale_turu: string;
  kisi_sayisi: number | null;
  ogun_sayisi: number | null;
  gun_sayisi: number | null;
  tahmini_butce: number | null;
  teslim_suresi: string | null;
  kanitlar: {
    kisi_sayisi?: string;
    butce?: string;
    sure?: string;
  };
  guven_skoru: number;
}

export interface MenuExtraction {
  menu_programi: MenuDay[];
  kritik_malzemeler: KritikMalzeme[];
  kanitlar: {
    menu?: string;
  };
  guven_skoru: number;
}

// Kaynak bilgisi için yardımcı interface
export interface FieldSource {
  dosya: string; // "Teknik Şartname", "İhale İlanı", "Zeylname"
  sayfa?: string; // "Sayfa 3", "Tablo 1"
  kanit?: string; // Orijinal metin pasajı
}

// Tablo Kategorileri
export type TableCategory =
  | "organization"   // Kuruluş & Dağılım
  | "meals"         // Öğün & Menu
  | "quantities"    // Gramaj & Porsiyon
  | "materials"     // Malzeme & Ürün
  | "personnel"     // Personel & Kadro
  | "financial"     // Maliyet & Bütçe
  | "schedule"      // Süre & Takvim
  | "equipment"     // Ekipman & Araç-Gereç
  | "summary"       // Özet & Toplam
  | "technical"     // Teknik Şartlar
  | "other";        // Diğer

// Belge Türleri
export type BelgeTuru =
  | "teknik_sartname"
  | "ihale_ilani"
  | "sozlesme_tasarisi"
  | "idari_sartname"
  | "fiyat_teklif_mektubu"
  | "diger"
  | "belirsiz";

export const BELGE_TURU_LABELS: Record<BelgeTuru, string> = {
  teknik_sartname: "📄 Teknik Şartname",
  ihale_ilani: "📢 İhale İlanı",
  sozlesme_tasarisi: "📝 Sözleşme Tasarısı",
  idari_sartname: "📋 İdari Şartname",
  fiyat_teklif_mektubu: "💰 Fiyat Teklif Mektubu",
  diger: "📎 Diğer Belge",
  belirsiz: "" // Boş göster
};

// YENİ: Veri Havuzu - Metinsel extraction
export interface DataPoolExtraction {
  ham_metin: string; // AI'ın bulduğu her şey, uzun paragraf formatında
  kaynaklar: {
    [key: string]: {
      deger: string; // Örn: "17 kişiye hizmet verilecek"
      kaynak: string; // Proof text (ilk 200-300 char)
      dosya: string; // Kaynak dosya adı
    };
  };
}

// YENİ: Çıkarılan tablo - yapılandırılmış format
export interface ExtractedTable {
  baslik: string; // "Kuruluş Dağılımı", "Öğün Tablosu"
  headers: string[]; // Sütun başlıkları ["Kuruluş", "Kahvaltı", "Öğle", ...]
  rows: string[][]; // Satırlar [["Huzurevi", "6", "6", ...], ...]
  satir_sayisi: number; // Kaç veri satırı (header hariç)
  sutun_sayisi: number; // Kaç sütun var
  guven: number; // 0-1 arası güven skoru
  category?: TableCategory; // Tablonun kategorisi (AI tarafından atanır)
}

export interface ExtractedData {
  // YENİ: Belge türü tespiti
  belge_turu?: BelgeTuru;
  belge_turu_guven?: number; // 0-1 arası, belge türü tespitindeki güven

  kurum: string;
  ihale_turu: string;
  registration_number: string | null; // İhale Kayıt Numarası
  kisi_sayisi: number | null; // Yemek yiyen kişi sayısı
  personel_sayisi: number | null; // Çalışan personel sayısı
  ogun_sayisi: number | null;
  gun_sayisi: number | null;
  tahmini_butce: number | null;
  teslim_suresi: string | null;

  // Kaynak bilgileri (opsiyonel - AI dolduracak)
  _sources?: {
    kisi_sayisi?: FieldSource;
    tahmini_butce?: FieldSource;
    ihale_turu?: FieldSource;
    ihale_tarihi?: FieldSource;
    [key: string]: FieldSource | undefined;
  };

  // AI'ın düşünce süreci (debugging için)
  _reasoning?: {
    kisi_sayisi_analiz?: string; // 3 adımlı akıl yürütme süreci
    [key: string]: string | undefined;
  };

  // Tarihler
  ihale_tarihi?: string | null; // İhale ilanı tarihi (örn: "15.01.2025")
  teklif_son_tarih?: string | null; // Teklif verme son tarihi (örn: "30.01.2025 14:00")
  ise_baslama_tarih?: string | null; // İşe başlama tarihi (örn: "01.02.2025")
  ihale_suresi?: string | null; // İhalenin süresi (örn: "12 ay", "365 gün")

  // KATMAN A - Basit Alanlar (Hızlı Genel Bakış)
  dagitim_yontemi?: string | null; // "Yerinde üretim" | "Taşeron" | "Kap taşıma"
  sertifikasyon_etiketleri?: string[]; // ["ISO 22000", "HACCP"] - Basit etiketler, max 5
  ornek_menu_basliklari?: string[]; // ["Tavuk sote", "Mercimek"] - Sadece isimler, gramaj yok, max 5
  riskler: string[];
  ozel_sartlar: string[];
  kanitlar: {
    kisi_sayisi?: string;
    butce?: string;
    sure?: string;
    riskler?: string[];
    menu?: string; // YENİ: Menü nereden çıkarıldı
  };
  guven_skoru: number; // 0-1 arası

  // Finansal Mantık Kontrolü
  finansal_kontrol?: {
    birim_fiyat: number | null; // Tahmini bütçe / Toplam öğün
    kar_marji_tahmin: number | null; // % (birim fiyat - tahmini maliyet) / birim fiyat
    et_bagimliligi_riski: "düşük" | "orta" | "yüksek" | null; // Et ağırlıklı menü riski
    sinir_deger_uyarisi: string | null; // "%20 altı girilmez" gibi uyarılar
    nakit_akisi_ihtiyaci: number | null; // İlk X günde gerekli sermaye
    girilir_mi: "EVET" | "DİKKATLİ" | "HAYIR" | null; // Final karar
    gerekce: string | null; // Karar gerekçesi
  };

  // Validation Metadata (Nov 9, 2025 - Content Validator v2.0)
  _validation_metadata?: {
    confidence: ValidationConfidence;
    warnings_count: number;
    auto_fixed: number;
    status: 'valid' | 'warning' | 'error';
  };

  // YENİ: Veri Havuzu - Metinsel extraction (Data Pool - Claude)
  veri_havuzu?: DataPoolExtraction;

  // YENİ: Kritik malzemeler listesi
  kritik_malzemeler?: Array<{
    malzeme: string;
    miktar?: string;
    birim?: string;
    onem_derecesi?: 'kritik' | 'orta' | 'düşük';
  }>;

  // Menü programı (opsiyonel)
  menu_programi?: MenuDay[];

  // Detaylı öğün dağılımı (opsiyonel)
  detayli_veri?: {
    ogun_dagilimi?: {
      kahvalti?: number;
      ogle?: number;
      aksam?: number;
      ara_ogun?: number;
      ikindi?: number;
    };
  };

  // YENİ: Tablo İş Zekası (Table Intelligence)
  tablo_intelligence?: {
    personel_detaylari?: {
      toplam_personel?: number;
      pozisyonlar?: Array<{
        pozisyon: string;
        sayi: number;
        nitelik?: string;
        maas?: string;
      }>;
    };
    ekipman_listesi?: Array<{
      kategori: string;
      urunler: Array<{
        ad: string;
        miktar?: string;
        ozellik?: string;
      }>;
    }>;
    menu_analizi?: {
      toplam_yemek_cesidi?: number;
      ortalama_gramaj?: string;
      kritik_malzemeler?: string[];
      ozel_diyetler?: string[];
    };
    kuruluslar?: Array<{
      ad: string;
      kisi_sayisi?: number;
      ogun_dagilimi?: {
        kahvalti?: number;
        ogle?: number;
        aksam?: number;
        toplam?: number;
      };
    }>;
    maliyet_verileri?: {
      tahmini_butce?: number;
      birim_fiyatlar?: Array<{
        kalem: string;
        fiyat: string;
      }>;
    };
    guven_skoru?: number;
    kaynak_tablolar?: string[];
  };

  // YENİ: Çıkarılan tablolar listesi
  tablolar?: ExtractedTable[];
}

export interface ContextualAnalysis {
  belge_tutarliligi?: {
    durum: "tutarli" | "kismi_tutarsizlik" | "ciddi_tutarsizlik" | "tek_belge";
    aciklama: string;
    tespit_edilen_sorunlar: string[];
    oneriler: string[];
  };
  operasyonel_riskler: {
    seviye: "dusuk" | "orta" | "yuksek";
    faktorler: string[];
    oneriler: string[];
  };
  maliyet_sapma_olasiligi: {
    oran: number; // %
    sebepler: string[];
    onlem_oneriler: string[];
  };
  zaman_uygunlugu: {
    durum: "yeterli" | "sinirda" | "yetersiz";
    aciklama: string;
  };
  genel_oneri: string;
}

export interface ValidationWarning {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
  original_value: any;
  suggested_value?: any;
  auto_fixed: boolean;
}

// İhale Durumu Türleri
export type IhaleStatus =
  | "completed" // Tamamlandı - Yeşil mühür
  | "under_evaluation" // Değerlendirmede - Sarı mühür
  | "rejected"; // İstenmiyor - Kırmızı mühür

// Belge Tipi Bazlı Analiz için Giriş Formatı
export interface DocumentInput {
  type: BelgeTuru;
  text: string;
  fileName: string;
  confidence: number;
}

export interface AIAnalysisResult {
  extracted_data: ExtractedData;
  contextual_analysis: ContextualAnalysis;
  processing_metadata: {
    processing_time: number;
    ai_provider: string;
    confidence_score: number;
  };
  validation_warnings?: ValidationWarning[];
  // Teklif verileri (opsiyonel - kullanıcı teklif hazırlamışsa)
  proposal_data?: any;
  // İhale durumu (opsiyonel - varsayılan: under_evaluation)
  status?: IhaleStatus;
  // Derin analiz sonuçları (opsiyonel - kullanıcı derin analiz yaptıysa)
  deep_analysis?: DeepAnalysisResult;
  // CSV maliyet analizleri (opsiyonel - kullanıcı CSV yüklemişse)
  csv_analyses?: Array<{
    fileName: string;
    analysis: any;
  }>;
}

// Deep Analysis Types
export interface DeepAnalysisRisk {
  risk: string;
  olasilik: "düşük" | "orta" | "yüksek";
  etki: "düşük" | "orta" | "yüksek" | "kritik";
  onlem: string;
}

/**
 * Derin Analiz Sonucu
 * Ham veri, tablolar ve bağlamsal analiz sentezinden oluşan stratejik değerlendirme
 * 
 * @updated Nov 9, 2025 - Veri kaynağı doğrulama alanları eklendi
 */
export interface DeepAnalysisResult {
  firsat_analizi: {
    avantajlar: string[];
    rekabet_guclu_yonler: string[];
    kazanma_faktörleri: string[];
    uzun_vade_potansiyel: string;
  };
  detayli_risk_analizi: {
    kritik_riskler: DeepAnalysisRisk[];
    kirmizi_bayraklar: string[];
    /** Bağlamsal analiz doğrulama (Nov 9, 2025) */
    baglamsal_analiz_dogrulama?: {
      operasyonel_riskler_dogru_mu: boolean;
      ek_tespit_edilen_riskler: string[];
      celiskiler: string[];
    };
  };
  maliyet_stratejisi: {
    fiyatlandirma_onerisi: string;
    optimizasyon_noktalari: string[];
    kar_marji_hedef: string;
    gizli_maliyetler: string[];
    /** Bağlamsal maliyet sapma doğrulama (Nov 9, 2025) */
    baglamsal_maliyet_sapma_dogrulama?: {
      beklenen_sapma_orani: number | null;
      tablolarla_uyumlu_mu: boolean;
      yeni_maliyet_tahminleri: string[];
    };
  };
  operasyonel_plan: {
    kaynak_ihtiyaclari: {
      insan_gucu: string;
      ekipman: string;
      lojistik: string;
    };
    kritik_tarihler: string[];
    tedarik_zinciri: string;
    kalite_kontrol: string;
    /** Zaman uygunluğu doğrulama (Nov 9, 2025) */
    zaman_uygunlugu_dogrulama?: {
      sure: string;
      baglamsal_analiz_uyumlu_mu: boolean;
      ek_hazirlik_onerileri: string[];
    };
  };
  teklif_stratejisi: {
    guclu_yonler: string[];
    dikkat_noktalari: string[];
    referans_stratejisi: string;
    one_cikan_noktalar: string[];
  };
  karar_onerisi: {
    tavsiye: "KATIL" | "DİKKATLİ_KATIL" | "KATILMA";
    gerekce: string;
    /** Veri kaynağı sentezi (Nov 9, 2025) */
    veri_kaynagi_sentezi?: {
      ham_veri_bulgulari: string[];
      tablo_bulgulari: string[];
      baglamsal_analiz_dogrulamasi: "UYUMLU" | "KISMI_UYUMLU" | "UYUMSUZ";
      celiskiler: string[];
    };
    alternatif_senaryolar: string[];
    basari_kriterleri: string[];
  };
  guven_skoru: number;
  /** Analiz kaynağı özeti (Nov 9, 2025) */
  analiz_kaynagi_ozeti?: {
    ham_veri_kullanimi: string;
    tablo_sayisi: number;
    baglamsal_analiz_mevcut: boolean;
    tablo_intelligence_mevcut: boolean;
    veri_butunlugu: "YÜKSEK" | "ORTA" | "DÜŞÜK";
  };
}

/**
 * Content Validator için genişletilmiş kaynak bilgisi
 * FieldSource'a ek olarak confidence ve raw_value içerir
 * 
 * @since Nov 9, 2025 - Content Validator refactoring
 */
export interface ContentValidatorSource extends FieldSource {
  /** AI güvenilirlik skoru (0-1 arası) */
  confidence?: number;
  /** Parse edilmeden önceki ham değer */
  raw_value?: string;
}

/**
 * ContentValidator için ExtractedData type alias
 * _sources alanını ContentValidatorSource ile extend eder
 * 
 * NOT: ExtractedData zaten _sources içeriyor (FieldSource ile)
 * Bu type sadece ContentValidator içinde kullanılır
 */
export type ExtractedDataWithSources = ExtractedData & {
  _sources?: {
    kisi_sayisi?: ContentValidatorSource;
    ogun_sayisi?: ContentValidatorSource;
    gun_sayisi?: ContentValidatorSource;
    tahmini_butce?: ContentValidatorSource;
    [key: string]: ContentValidatorSource | undefined;
  };
}

/**
 * Validasyon güvenilirlik skoru
 * @since Nov 9, 2025
 */
export interface ValidationConfidence {
  /** Genel skor (0-1) */
  overall: number;
  /** Alan bazlı skorlar */
  fields: {
    kisi_sayisi: number;
    ogun_sayisi: number;
    gun_sayisi: number;
    tahmini_butce: number;
  };
  /** Güvenilirlik seviyesi */
  level: 'high' | 'medium' | 'low';
}

/**
 * Validasyon sonuç özeti
 * @since Nov 9, 2025
 */
export interface ValidationSummary {
  /** Toplam uyarı sayısı */
  total_warnings: number;
  /** Seviye bazlı sayılar */
  by_severity: {
    error: number;
    warning: number;
    info: number;
  };
  /** Otomatik düzeltilen alan sayısı */
  auto_fixed_count: number;
  /** Genel validasyon durumu */
  status: 'valid' | 'warning' | 'error';
  /** Güvenilirlik skoru */
  confidence: ValidationConfidence;
}

/**
 * Content Validator validasyon sonucu
 * @since Nov 9, 2025
 */
export interface ContentValidationResult {
  /** Validasyon başarılı mı? */
  is_valid: boolean;
  /** Uyarılar listesi */
  warnings: ValidationWarning[];
  /** Düzeltilmiş veri (auto-fix uygulandıysa) */
  fixed_data: ExtractedData | ExtractedDataWithSources;
  /** Validasyon özeti */
  summary: ValidationSummary;
}

/**
 * Backward compatible type alias
 * Mevcut kod ValidationResult bekliyor, bunu da destekleyelim
 */
export interface EnhancedValidationResult extends ContentValidationResult {}
