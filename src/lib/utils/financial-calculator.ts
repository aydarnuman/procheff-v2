import { ExtractedData } from "@/types/ai";

/**
 * Finansal mantık kontrolü - AI yerine JavaScript ile hesaplama
 * (Hızlı ve deterministik)
 *
 * İyileştirme: Dinamik formül - servis_gun_sayisi, ogun_turleri gibi alanları dikkate alır
 */
export function calculateFinancialControl(data: ExtractedData) {
  const kisi_sayisi = data.kisi_sayisi || 0;
  const ogun_sayisi = data.ogun_sayisi || 3;
  const tahmini_butce = data.tahmini_butce || 0;

  // 🔥 DİNAMİK GÜN SAYISI: Önce servis_gun_sayisi'na bak, yoksa gun_sayisi'nı kullan
  let gun_sayisi = data.gun_sayisi || 365;

  // Eğer metinde "servis gün sayısı" veya benzer ifadeler varsa, bunu tespit et
  // ExtractedData'da servis_gun_sayisi alanı varsa kullan
  if ((data as any).servis_gun_sayisi) {
    gun_sayisi = (data as any).servis_gun_sayisi;
    console.log(`💡 Dinamik formül: servis_gun_sayisi kullanıldı (${gun_sayisi} gün)`);
  }
  // İhale süresi ile teslim süresi arasında fark varsa, gerçek servis günü hesapla
  else if (data.ihale_suresi && typeof data.ihale_suresi === 'string') {
    const ayMatch = data.ihale_suresi.match(/(\d+)\s*ay/i);
    const gunMatch = data.ihale_suresi.match(/(\d+)\s*g[üu]n/i);

    if (ayMatch) {
      gun_sayisi = parseInt(ayMatch[1]) * 30;
      console.log(`💡 Dinamik formül: ihale_suresi'nden hesaplandı (${gun_sayisi} gün)`);
    } else if (gunMatch) {
      gun_sayisi = parseInt(gunMatch[1]);
      console.log(`💡 Dinamik formül: ihale_suresi'nden hesaplandı (${gun_sayisi} gün)`);
    }
  }

  // 🔥 DİNAMİK ÖĞÜN TÜRLERİ: Ara öğünler de hesaba katılsın
  let toplam_ogun_carpan = ogun_sayisi;

  // Eğer "ara öğün", "kurabiye", "ikindi çayı" gibi ifadeler varsa ekstra öğün say
  if ((data as any).ara_ogun_var === true || (data as any).ikindi_cayi === true) {
    console.log(`💡 Dinamik formül: Ara öğün tespit edildi, öğün sayısı artırıldı`);
    toplam_ogun_carpan += 1; // Ana öğünlere +1 ara öğün ekle
  }

  // Özel durumlar: Menüde belirtilen toplam öğün sayısı varsa (örn: kahvaltı + ara öğün + öğle + ikindi + akşam = 5)
  if (data.menu_programi && data.menu_programi.length > 0) {
    // Her menü objesindeki öğün türlerini say (basit yaklaşım: öğün sayısı = yemek sayısı)
    const menuOgunSayisi = data.menu_programi.reduce((total, menu) => {
      let count = 0;
      if (menu.corba) count++;
      if (menu.ana_yemek) count++;
      if (menu.yan_yemek) count++;
      if (menu.salata) count++;
      if (menu.tatli) count++;
      return total + count;
    }, 0) / data.menu_programi.length; // Ortalama öğün sayısı

    if (menuOgunSayisi > toplam_ogun_carpan) {
      console.log(`💡 Dinamik formül: Menüden ${menuOgunSayisi} öğün tespit edildi`);
      toplam_ogun_carpan = menuOgunSayisi;
    }
  }

  // Toplam öğün hesapla
  const toplam_ogun = kisi_sayisi * toplam_ogun_carpan * gun_sayisi;

  // Birim fiyat
  const birim_fiyat = toplam_ogun > 0 ? tahmini_butce / toplam_ogun : null;

  // Tahmini maliyet (2025 Türkiye ortalaması)
  const tahmini_maliyet = 17; // ₺/öğün (ortalama)

  // Kâr marjı hesapla
  let kar_marji_tahmin: number | null = null;
  if (birim_fiyat && birim_fiyat > 0) {
    kar_marji_tahmin = Math.round(
      ((birim_fiyat - tahmini_maliyet) / birim_fiyat) * 100
    );
  }

  // Et bağımlılığı riski (menüden çıkar)
  let et_bagimliligi_riski: "düşük" | "orta" | "yüksek" | null = null;
  if (data.menu_programi && data.menu_programi.length > 0) {
    // Menüde et/tavuk ağırlığını kontrol et
    const etAgirlikli = data.menu_programi.some(
      (menu) =>
        menu.ana_yemek?.adi?.toLowerCase().includes("et") ||
        menu.ana_yemek?.adi?.toLowerCase().includes("dana") ||
        menu.ana_yemek?.adi?.toLowerCase().includes("kuzu")
    );
    const tavukAgirlikli = data.menu_programi.some(
      (menu) =>
        menu.ana_yemek?.adi?.toLowerCase().includes("tavuk") ||
        menu.ana_yemek?.adi?.toLowerCase().includes("piliç")
    );

    if (etAgirlikli) {
      et_bagimliligi_riski = "yüksek";
    } else if (tavukAgirlikli) {
      et_bagimliligi_riski = "orta";
    } else {
      et_bagimliligi_riski = "düşük";
    }
  } else {
    // Menü yoksa, kişi sayısına göre tahmin (büyük ihaleler genelde et ağırlıklı)
    if (kisi_sayisi > 300) {
      et_bagimliligi_riski = "orta";
    } else {
      et_bagimliligi_riski = "düşük";
    }
  }

  // Sınır değer uyarısı (özel şartlardan çıkar)
  let sinir_deger_uyarisi: string | null = null;
  if (data.ozel_sartlar) {
    const sinirDegerBul = data.ozel_sartlar.find(
      (sart) =>
        sart.includes("%") &&
        (sart.toLowerCase().includes("düşük") ||
          sart.toLowerCase().includes("altına") ||
          sart.toLowerCase().includes("teklif"))
    );
    if (sinirDegerBul) {
      sinir_deger_uyarisi = sinirDegerBul;
    }
  }

  // Nakit akışı ihtiyacı (60 gün ödeme vadesi varsayımı)
  // 🔥 DİNAMİK: Güncellenmiş öğün sayısını kullan
  const gunluk_maliyet = kisi_sayisi * toplam_ogun_carpan * tahmini_maliyet;
  const nakit_akisi_ihtiyaci = Math.round(gunluk_maliyet * 60); // 60 günlük

  // GİRİLİR Mİ kararı
  let girilir_mi: "EVET" | "DİKKATLİ" | "HAYIR" | null = null;
  let gerekce: string | null = null;

  if (kar_marji_tahmin !== null && birim_fiyat !== null) {
    if (kar_marji_tahmin >= 10 && birim_fiyat > tahmini_maliyet) {
      girilir_mi = "EVET";
      gerekce = `Kâr marjı sağlıklı (%${kar_marji_tahmin}), birim fiyat piyasa üstünde (${birim_fiyat.toFixed(
        2
      )}₺), riskler yönetilebilir seviyede.`;
    } else if (kar_marji_tahmin >= 5 && kar_marji_tahmin < 10) {
      girilir_mi = "DİKKATLİ";
      gerekce = `Kâr marjı düşük (%${kar_marji_tahmin}), ${
        et_bagimliligi_riski === "yüksek" ? "et riski yüksek, " : ""
      }nakit akışı planlaması kritik (${(
        nakit_akisi_ihtiyaci / 1000
      ).toFixed(0)}K₺).`;
    } else if (kar_marji_tahmin < 5) {
      girilir_mi = "HAYIR";
      gerekce = `Kâr marjı çok düşük (%${kar_marji_tahmin}), zarar riski yüksek. Birim fiyat: ${birim_fiyat.toFixed(
        2
      )}₺, tahmini maliyet: ${tahmini_maliyet}₺.`;
    } else if (birim_fiyat < tahmini_maliyet) {
      girilir_mi = "HAYIR";
      gerekce = `Birim fiyat (${birim_fiyat.toFixed(
        2
      )}₺) piyasa maliyetinin (${tahmini_maliyet}₺) altında, zarar garantili.`;
    }
  } else {
    girilir_mi = null;
    gerekce = "Bütçe bilgisi eksik, finansal analiz yapılamıyor.";
  }

  return {
    birim_fiyat: birim_fiyat ? Math.round(birim_fiyat * 100) / 100 : null,
    kar_marji_tahmin,
    et_bagimliligi_riski,
    sinir_deger_uyarisi,
    nakit_akisi_ihtiyaci,
    girilir_mi,
    gerekce,
  };
}
