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
  belirsiz: "❓ Belirsiz"
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
  };
  maliyet_stratejisi: {
    fiyatlandirma_onerisi: string;
    optimizasyon_noktalari: string[];
    kar_marji_hedef: string;
    gizli_maliyetler: string[];
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
    alternatif_senaryolar: string[];
    basari_kriterleri: string[];
  };
  guven_skoru: number;
}
