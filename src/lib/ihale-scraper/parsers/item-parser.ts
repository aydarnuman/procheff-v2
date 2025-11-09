// ============================================================================
// GENERIC ITEM PARSER
// Tüm ihale sitelerinden mal/hizmet listesini parse eder
// Farklı tablo yapılarını otomatik tespit eder
// ============================================================================

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

/**
 * İhale kalemi (mal/hizmet)
 */
export interface TenderItem {
  item_number?: number;      // Sıra numarası
  item_name: string;          // Kalem adı
  quantity?: number;          // Miktar
  unit?: string;              // Birim (ADET, KG, LİTRE, vb)
  unit_price?: number;        // Birim fiyat
  total_price?: number;       // Toplam fiyat
}

export class ItemParser {
  /**
   * 🎯 Genelleştirilmiş tablo parse - TÜM ihale siteleri için çalışır
   * Farklı tablo yapılarını otomatik tespit eder
   */
  static parseItemTable($: cheerio.CheerioAPI): TenderItem[] {
    const items: TenderItem[] = [];

    // Farklı tablo selector'larını dene (en yaygından başla)
    const tableSelectorCandidates = [
      '.table tbody tr',                    // Bootstrap table
      'table.items tbody tr',               // Specific class: table.items
      'table.mal-hizmet-listesi tbody tr', // Custom class
      'table tbody tr',                     // Generic table
      'table tr:has(td)',                   // Any table with td cells
      '.item-list tr',                      // Item list
      '[class*="item"] tbody tr',           // Any class containing "item"
    ];

    for (const selector of tableSelectorCandidates) {
      const rows = $(selector);

      if (rows.length > 0) {
        console.log(`   📋 Tablo bulundu: "${selector}" (${rows.length} satır)`);

        rows.each((i: number, row: any) => {
          const item = this.parseItemRow($(row), $);
          if (item && item.item_name.trim().length > 0) {
            items.push(item);
          }
        });

        // İlk başarılı selector'ı kullan ve dur
        if (items.length > 0) {
          console.log(`   ✅ ${items.length} kalem parse edildi`);
          break;
        }
      }
    }

    if (items.length === 0) {
      console.log(`   ⚠️ Mal/Hizmet tablosu bulunamadı (farklı yapı olabilir)`);
    }

    return items;
  }

  /**
   * 📝 Tek bir satırı parse et - Farklı sütun düzenlerini handle eder
   */
  private static parseItemRow($row: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI): TenderItem | null {
    const cells = $row.find('td');
    if (cells.length < 1) return null; // En az 1 hücre olmalı

    const cellTexts = cells.map((_, cell) =>
      $(cell).text().trim()
    ).get();

    // Header satırlarını atla
    if (cellTexts.some(text =>
      text.toLowerCase().includes('kalem') ||
      text.toLowerCase().includes('miktar') ||
      text.toLowerCase().includes('birim')
    )) {
      return null;
    }

    // Farklı sütun düzenlerini dene

    // Düzen 1: # | Kalem | Miktar | Birim (en yaygın - 4 sütun)
    if (cells.length >= 4) {
      return {
        item_number: this.parseNumber(cellTexts[0]),
        item_name: cellTexts[1],
        quantity: this.parseQuantity(cellTexts[2]),
        unit: cellTexts[3],
      };
    }

    // Düzen 2: # | Kalem | Miktar | Birim | Birim Fiyat | Toplam (6 sütun)
    if (cells.length >= 6) {
      return {
        item_number: this.parseNumber(cellTexts[0]),
        item_name: cellTexts[1],
        quantity: this.parseQuantity(cellTexts[2]),
        unit: cellTexts[3],
        unit_price: this.parsePrice(cellTexts[4]),
        total_price: this.parsePrice(cellTexts[5]),
      };
    }

    // Düzen 3: Kalem | Miktar (2 sütun)
    if (cells.length >= 2) {
      return {
        item_name: cellTexts[0],
        quantity: this.parseQuantity(cellTexts[1]),
      };
    }

    // Düzen 4: Sadece Kalem adı (1 sütun)
    if (cells.length === 1) {
      return {
        item_name: cellTexts[0],
      };
    }

    return null;
  }

  /**
   * 🔢 Miktar parse - Farklı formatları handle eder
   * "164.250" → 164250 (Türkçe format)
   * "164,250.50" → 164250.5 (İngilizce format)
   * "1.500,75" → 1500.75 (Türkçe ondalıklı)
   */
  private static parseQuantity(text: string): number | undefined {
    if (!text) return undefined;

    // Sadece sayılar, virgül, nokta ve tire kalsın
    const cleaned = text.replace(/[^\d,.-]/g, '');
    if (!cleaned || cleaned === '-') return undefined;

    // Türkçe format: 1.500,75 → 1500.75
    if (cleaned.includes(',')) {
      const normalized = cleaned.replace(/\./g, '').replace(',', '.');
      const result = parseFloat(normalized);
      return isNaN(result) ? undefined : result;
    }

    // İngilizce format: 1,500.75 → 1500.75
    const normalized = cleaned.replace(/,/g, '');
    const result = parseFloat(normalized);
    return isNaN(result) ? undefined : result;
  }

  /**
   * 💰 Fiyat parse (quantity ile aynı mantık)
   */
  private static parsePrice(text: string): number | undefined {
    return this.parseQuantity(text);
  }

  /**
   * 🔢 Tam sayı parse (sıra numarası için)
   */
  private static parseNumber(text: string): number | undefined {
    const cleaned = text.replace(/[^\d]/g, '');
    const result = parseInt(cleaned);
    return isNaN(result) ? undefined : result;
  }

  /**
   * 🍽️ Catering öğün sayısını topla
   * Sadece yemek ile ilgili kalemleri filtreler ve toplar
   */
  static calculateTotalMeals(items: TenderItem[]): number {
    const mealKeywords = [
      'kahvaltı', 'öğle', 'akşam', 'yemek', 'öğün',
      'breakfast', 'lunch', 'dinner', 'meal',
      'sabah', 'ögle yemegi', 'aksam yemegi',
      'iaşe', 'catering'
    ];

    const mealItems = items.filter(item =>
      mealKeywords.some(keyword =>
        item.item_name.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    const total = mealItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (total > 0) {
      console.log(`   🍽️ Toplam öğün: ${total.toLocaleString('tr-TR')} (${mealItems.length} kalem)`);
      mealItems.forEach(item => {
        console.log(`      - ${item.item_name}: ${item.quantity?.toLocaleString('tr-TR')} ${item.unit || ''}`);
      });
    }

    return total;
  }

  /**
   * 📊 İstatistikler - Kalem özeti
   */
  static getItemStats(items: TenderItem[]): {
    totalItems: number;
    itemsWithQuantity: number;
    itemsWithPrice: number;
    totalMeals: number;
    estimatedBudget?: number;
  } {
    const itemsWithQuantity = items.filter(i => i.quantity !== undefined).length;
    const itemsWithPrice = items.filter(i => i.total_price !== undefined).length;
    const totalMeals = this.calculateTotalMeals(items);

    // Toplam bütçe hesapla (eğer fiyat varsa)
    const estimatedBudget = items.reduce((sum, item) => {
      return sum + (item.total_price || 0);
    }, 0);

    return {
      totalItems: items.length,
      itemsWithQuantity,
      itemsWithPrice,
      totalMeals,
      estimatedBudget: estimatedBudget > 0 ? estimatedBudget : undefined,
    };
  }
}