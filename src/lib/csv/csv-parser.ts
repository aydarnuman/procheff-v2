/**
 * CSV Parser for Cost Analysis
 *
 * Parses CSV files containing tender cost data and extracts structured information.
 * Supports multiple formats and provides intelligent column detection.
 */

export interface CSVRow {
  [key: string]: string;
}

export interface ParsedCSVData {
  headers: string[];
  rows: CSVRow[];
  totalRows: number;
  detectedColumns: DetectedColumns;
}

export interface DetectedColumns {
  productName?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  totalPrice?: string;
  category?: string;
  description?: string;
}

export interface CostItem {
  urun_adi: string;
  miktar?: number;
  birim?: string;
  birim_fiyat?: number;
  toplam_fiyat?: number;
  kategori?: string;
  aciklama?: string;
}

export interface CSVCostAnalysis {
  items: CostItem[];
  summary: {
    total_items: number;
    total_cost: number;
    average_unit_price: number;
    categories: {
      name: string;
      count: number;
      total_cost: number;
    }[];
  };
  confidence: number;
  source: 'csv';
}

/**
 * CSV Parser Class
 */
export class CSVParser {
  /**
   * Parse CSV content from string
   */
  static parseCSVContent(content: string): ParsedCSVData {
    // Remove BOM if present
    content = content.replace(/^\uFEFF/, '');

    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV dosyası boş');
    }

    console.log(`📊 CSV Parsing: ${lines.length} satır bulundu`);
    console.log(`İlk satır (header): ${lines[0]}`);

    // Parse header
    const headers = this.parseCSVLine(lines[0]);
    console.log(`Headers (${headers.length}):`, headers);

    // Parse rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    console.log(`✅ ${rows.length} veri satırı parse edildi`);

    // Detect column types
    const detectedColumns = this.detectColumns(headers);
    console.log('Tespit edilen kolonlar:', detectedColumns);

    return {
      headers,
      rows,
      totalRows: rows.length,
      detectedColumns
    };
  }

  /**
   * Parse a single CSV line (handles quotes and commas/semicolons)
   */
  private static parseCSVLine(line: string, delimiter?: string): string[] {
    // Auto-detect delimiter if not provided
    if (!delimiter) {
      const semicolonCount = (line.match(/;/g) || []).length;
      const commaCount = (line.match(/,/g) || []).length;
      delimiter = semicolonCount > commaCount ? ';' : ',';
    }

    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result.filter(val => val !== ''); // Remove empty values
  }

  /**
   * Detect column types from headers
   */
  private static detectColumns(headers: string[]): DetectedColumns {
    const detected: DetectedColumns = {};

    const patterns = {
      productName: /^(ürün|urun|malzeme|ad|isim|name|product|item|tanim|tanım|mal|hizmet|cinsi|cins|sıra|sira|kalem)/i,
      quantity: /^(miktar|adet|quantity|amount|qty|sayi|sayı|adet|kişi|kisi)/i,
      unit: /^(birim|unit|olcu|ölçü|measure|ölçü birimi|olcu birimi)/i,
      unitPrice: /^(birim.*fiyat|unit.*price|fiyat|price|tutar|birim fiyat)/i,
      totalPrice: /^(toplam|total|tutar|amount|toplam.*fiyat|toplam.*tutar)/i,
      category: /^(kategori|category|grup|group|sinif|sınıf)/i,
      description: /^(aciklama|açıklama|description|detay|not|note|açıklama)/i,
    };

    headers.forEach(header => {
      const normalized = header.toLowerCase().trim();

      if (!detected.productName && patterns.productName.test(normalized)) {
        detected.productName = header;
      }
      if (!detected.quantity && patterns.quantity.test(normalized)) {
        detected.quantity = header;
      }
      if (!detected.unit && patterns.unit.test(normalized)) {
        detected.unit = header;
      }
      if (!detected.unitPrice && patterns.unitPrice.test(normalized)) {
        detected.unitPrice = header;
      }
      if (!detected.totalPrice && patterns.totalPrice.test(normalized)) {
        detected.totalPrice = header;
      }
      if (!detected.category && patterns.category.test(normalized)) {
        detected.category = header;
      }
      if (!detected.description && patterns.description.test(normalized)) {
        detected.description = header;
      }
    });

    // Fallback: Eğer productName bulunamadıysa, ilk kolonu kullan
    if (!detected.productName && headers.length > 0) {
      console.warn('⚠️ Ürün adı kolonu bulunamadı, ilk kolon kullanılıyor:', headers[0]);
      detected.productName = headers[0];
    }

    console.log('🔍 Kolon tespiti:', detected);
    return detected;
  }

  /**
   * Convert parsed CSV to cost items
   */
  static convertToCostItems(parsed: ParsedCSVData): CostItem[] {
    const { rows, detectedColumns } = parsed;
    const items: CostItem[] = [];

    for (const row of rows) {
      // Product name is required
      const productName = detectedColumns.productName
        ? row[detectedColumns.productName]?.trim()
        : '';

      if (!productName) continue; // Skip empty rows

      const item: CostItem = {
        urun_adi: productName,
      };

      // Parse quantity
      if (detectedColumns.quantity) {
        const quantityStr = row[detectedColumns.quantity];
        const quantity = this.parseNumber(quantityStr);
        if (quantity !== null) item.miktar = quantity;
      }

      // Parse unit
      if (detectedColumns.unit) {
        item.birim = row[detectedColumns.unit]?.trim();
      }

      // Parse unit price
      if (detectedColumns.unitPrice) {
        const priceStr = row[detectedColumns.unitPrice];
        const price = this.parseNumber(priceStr);
        if (price !== null) item.birim_fiyat = price;
      }

      // Parse total price
      if (detectedColumns.totalPrice) {
        const totalStr = row[detectedColumns.totalPrice];
        const total = this.parseNumber(totalStr);
        if (total !== null) item.toplam_fiyat = total;
      }

      // Category
      if (detectedColumns.category) {
        item.kategori = row[detectedColumns.category]?.trim();
      }

      // Description
      if (detectedColumns.description) {
        item.aciklama = row[detectedColumns.description]?.trim();
      }

      // Calculate missing values
      if (item.miktar && item.birim_fiyat && !item.toplam_fiyat) {
        item.toplam_fiyat = item.miktar * item.birim_fiyat;
      } else if (item.miktar && item.toplam_fiyat && !item.birim_fiyat) {
        item.birim_fiyat = item.toplam_fiyat / item.miktar;
      }

      items.push(item);
    }

    return items;
  }

  /**
   * Parse number from string (handles Turkish format: 1.234,56)
   */
  private static parseNumber(str: string | undefined): number | null {
    if (!str) return null;

    // Remove whitespace
    str = str.trim();

    // Remove currency symbols
    str = str.replace(/[₺$€]/g, '');

    // Handle Turkish format (1.234,56 -> 1234.56)
    if (str.includes(',') && str.includes('.')) {
      // If both exist, assume Turkish format
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      // Only comma, could be decimal separator
      const parts = str.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Likely decimal: 12,50
        str = str.replace(',', '.');
      } else {
        // Likely thousands: 1,234
        str = str.replace(',', '');
      }
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Analyze cost data from CSV
   */
  static analyzeCosts(items: CostItem[]): CSVCostAnalysis {
    // Calculate summary
    const totalCost = items.reduce((sum, item) => {
      return sum + (item.toplam_fiyat || 0);
    }, 0);

    const itemsWithPrice = items.filter(item => item.birim_fiyat);
    const averageUnitPrice = itemsWithPrice.length > 0
      ? itemsWithPrice.reduce((sum, item) => sum + (item.birim_fiyat || 0), 0) / itemsWithPrice.length
      : 0;

    // Group by category
    const categoryMap = new Map<string, { count: number; total_cost: number }>();

    items.forEach(item => {
      const category = item.kategori || 'Diğer';
      const existing = categoryMap.get(category) || { count: 0, total_cost: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        total_cost: existing.total_cost + (item.toplam_fiyat || 0)
      });
    });

    const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      total_cost: data.total_cost
    })).sort((a, b) => b.total_cost - a.total_cost);

    // Calculate confidence
    const itemsWithAllData = items.filter(item =>
      item.urun_adi && item.miktar && item.birim_fiyat && item.toplam_fiyat
    );
    const confidence = items.length > 0
      ? itemsWithAllData.length / items.length
      : 0;

    return {
      items,
      summary: {
        total_items: items.length,
        total_cost: totalCost,
        average_unit_price: averageUnitPrice,
        categories
      },
      confidence,
      source: 'csv'
    };
  }

  /**
   * Main entry point: Parse CSV file and analyze
   */
  static async parseFile(file: File): Promise<CSVCostAnalysis> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;

          // Parse CSV
          const parsed = this.parseCSVContent(content);

          // Convert to cost items
          const items = this.convertToCostItems(parsed);

          // Analyze
          const analysis = this.analyzeCosts(items);

          resolve(analysis);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Dosya okuma hatası'));
      };

      reader.readAsText(file, 'UTF-8');
    });
  }
}
