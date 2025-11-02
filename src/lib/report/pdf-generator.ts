// PDF report generator - HTML to PDF basit şablon

interface AnalysisCategory {
  title: string;
  content: string[];
  confidence: number;
  evidencePassages: string[];
  keyMetrics?: { [key: string]: string | number };
}

interface DetailedAnalysis {
  generalInfo: AnalysisCategory;
  cost: AnalysisCategory;
  risks: AnalysisCategory;
  menu: AnalysisCategory;
  summary: string;
  overallConfidence: number;
  processingTime: number;
  wordCount: number;
  keyTermsFound: string[];
  documentMetrics: {
    documentHash: string;
    totalPages: number;
    averageQuality: number;
    ocrPagesProcessed: number;
    processingDuration: number;
  };
}

export class ReportGenerator {
  /**
   * Analiz sonucunu HTML rapor şablonuna dönüştürür
   */
  static generateHtmlReport(
    analysis: DetailedAnalysis,
    fileName: string
  ): string {
    const currentDate = new Date().toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>İhale Analiz Raporu - ${fileName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }
        
        .header h1 {
            color: #1e40af;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            color: #64748b;
            font-size: 16px;
        }
        
        .meta-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #2563eb;
        }
        
        .meta-info h2 {
            color: #1e40af;
            margin-bottom: 15px;
            font-size: 18px;
        }
        
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .meta-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .meta-item:last-child {
            border-bottom: none;
        }
        
        .meta-label {
            font-weight: 600;
            color: #475569;
        }
        
        .meta-value {
            color: #1e293b;
        }
        
        .section {
            margin-bottom: 35px;
            break-inside: avoid;
        }
        
        .section h2 {
            color: #1e40af;
            font-size: 20px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .confidence-badge {
            background: #10b981;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .confidence-badge.medium {
            background: #f59e0b;
        }
        
        .confidence-badge.low {
            background: #ef4444;
        }
        
        .content-list {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        
        .content-list li {
            padding: 10px 15px;
            border-bottom: 1px solid #f1f5f9;
            list-style: none;
            position: relative;
        }
        
        .content-list li:last-child {
            border-bottom: none;
        }
        
        .content-list li:before {
            content: '▶';
            color: #2563eb;
            font-size: 12px;
            position: absolute;
            left: 5px;
            top: 12px;
        }
        
        .evidence-box {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 6px;
            padding: 15px;
            margin-top: 10px;
        }
        
        .evidence-title {
            font-weight: 600;
            color: #0369a1;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .evidence-list {
            list-style: none;
            padding: 0;
        }
        
        .evidence-list li {
            background: #e0f2fe;
            margin: 5px 0;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            color: #0c4a6e;
        }
        
        .key-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
        
        .metric-item {
            background: #fef3c7;
            padding: 8px 12px;
            border-radius: 6px;
            border-left: 3px solid #f59e0b;
        }
        
        .metric-label {
            font-size: 12px;
            color: #92400e;
            font-weight: 600;
        }
        
        .metric-value {
            font-size: 14px;
            color: #451a03;
            font-weight: 700;
        }
        
        .summary-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin: 30px 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .summary-box h2 {
            color: white;
            margin-bottom: 15px;
        }
        
        .summary-text {
            font-size: 16px;
            line-height: 1.7;
        }
        
        .key-terms {
            margin-top: 20px;
        }
        
        .terms-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
        }
        
        .term-tag {
            background: #e0e7ff;
            color: #3730a3;
            padding: 4px 10px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 12px;
        }
        
        @media print {
            body { padding: 0; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>İhale Analiz Raporu</h1>
        <div class="subtitle">Dosya: ${fileName} | Tarih: ${currentDate}</div>
    </div>

    <div class="meta-info">
        <h2>📊 Dokuman Metrikleri</h2>
        <div class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">Hash:</span>
                <span class="meta-value">${
                  analysis.documentMetrics.documentHash
                }</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Toplam Sayfa:</span>
                <span class="meta-value">${
                  analysis.documentMetrics.totalPages
                }</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Ortalama Kalite:</span>
                <span class="meta-value">${Math.round(
                  analysis.documentMetrics.averageQuality * 100
                )}%</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">OCR İşlem Sayfa:</span>
                <span class="meta-value">${
                  analysis.documentMetrics.ocrPagesProcessed
                }</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">İşlem Süresi:</span>
                <span class="meta-value">${analysis.processingTime}ms</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Kelime Sayısı:</span>
                <span class="meta-value">${analysis.wordCount.toLocaleString(
                  "tr-TR"
                )}</span>
            </div>
        </div>
    </div>

    ${this.generateSectionHtml(analysis.generalInfo)}
    ${this.generateSectionHtml(analysis.cost)}  
    ${this.generateSectionHtml(analysis.risks)}
    ${this.generateSectionHtml(analysis.menu)}

    <div class="summary-box">
        <h2>📝 Genel Özet</h2>
        <div class="summary-text">${analysis.summary}</div>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
            <span>Genel Güven Skoru:</span>
            <span style="font-size: 20px; font-weight: bold;">${Math.round(
              analysis.overallConfidence * 100
            )}%</span>
        </div>
    </div>

    <div class="key-terms">
        <h2>🏷️ Tespit Edilen Anahtar Terimler</h2>
        <div class="terms-container">
            ${analysis.keyTermsFound
              .map((term) => `<span class="term-tag">${term}</span>`)
              .join("")}
        </div>
    </div>

    <div class="footer">
        <p>Bu rapor ProCheff AI Analiz Sistemi tarafından otomatik olarak oluşturulmuştur.</p>
        <p>Rapor oluşturma zamanı: ${currentDate}</p>
    </div>
</body>
</html>`;
  }

  /**
   * Analiz kategorisi için HTML section oluşturur
   */
  private static generateSectionHtml(category: AnalysisCategory): string {
    const confidenceClass =
      category.confidence >= 0.7
        ? "high"
        : category.confidence >= 0.4
        ? "medium"
        : "low";

    const confidenceText =
      category.confidence >= 0.7
        ? "Yüksek"
        : category.confidence >= 0.4
        ? "Orta"
        : "Düşük";

    const keyMetricsHtml =
      category.keyMetrics && Object.keys(category.keyMetrics).length > 0
        ? `
      <div class="key-metrics">
        ${Object.entries(category.keyMetrics)
          .map(
            ([key, value]) => `
          <div class="metric-item">
            <div class="metric-label">${key}</div>
            <div class="metric-value">${value}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `
        : "";

    return `
    <div class="section">
        <h2>
            ${this.getSectionIcon(category.title)} ${category.title}
            <span class="confidence-badge ${confidenceClass}">
                ${confidenceText} (${Math.round(category.confidence * 100)}%)
            </span>
        </h2>
        
        ${
          category.content.length > 0
            ? `
          <ul class="content-list">
            ${category.content.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        `
            : '<p style="color: #64748b; font-style: italic;">Bu kategori için veri bulunamadı.</p>'
        }
        
        ${keyMetricsHtml}
        
        ${
          category.evidencePassages.length > 0
            ? `
          <div class="evidence-box">
            <div class="evidence-title">📋 Kanıt Metinleri:</div>
            <ul class="evidence-list">
              ${category.evidencePassages
                .map((evidence) => `<li>${evidence}</li>`)
                .join("")}
            </ul>
          </div>
        `
            : ""
        }
    </div>`;
  }

  /**
   * Kategori iconları
   */
  private static getSectionIcon(title: string): string {
    const icons: { [key: string]: string } = {
      "Genel Bilgiler": "📄",
      "Maliyet Analizi": "💰",
      "Risk Analizi": "⚠️",
      "Menü Analizi": "🍽️",
    };

    return icons[title] || "📋";
  }

  /**
   * HTML'i PDF olarak download için hazırlar (browser-side)
   */
  static downloadHtmlAsPdf(htmlContent: string): void {
    // Yeni pencerede HTML'i aç
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up engelleyici aktif olabilir. Lütfen izin verin.");
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Print dialog'u aç
    printWindow.onload = () => {
      printWindow.print();
      // PDF kaydedildikten sonra pencereyi kapat
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    };
  }

  /**
   * HTML raporu blob olarak oluşturur
   */
  static createHtmlBlob(analysis: DetailedAnalysis, fileName: string): Blob {
    const htmlContent = this.generateHtmlReport(analysis, fileName);
    return new Blob([htmlContent], { type: "text/html" });
  }
}
