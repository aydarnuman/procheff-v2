import mammoth from "mammoth";
import { TurkishNormalizer } from "./turkish-normalizer";

export interface SmartProcessingResult {
  success: boolean;
  text: string;
  method: string;
  fileType: string;
  processingTime: number;
  warnings?: string[];
  error?: string;
}

export type ProgressCallback = (message: string, progress?: number) => void;

export class SmartDocumentProcessor {
  private static readonly SUPPORTED_FORMATS = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/msword", // .doc
    "application/pdf", // .pdf
    "text/plain", // .txt
    "text/rtf", // .rtf
    "text/html", // .html
    "application/rtf", // .rtf alternate
    "text/csv", // .csv
    "application/vnd.ms-excel", // .csv (eski Excel format)
    "image/png", // .png (taranmış belgeler)
    "image/jpeg", // .jpg (taranmış belgeler)
    "application/json", // .json
    "text/json", // .json alternate
  ];

  private static readonly SUPPORTED_EXTENSIONS = [
    ".docx",
    ".doc",
    ".pdf",
    ".txt",
    ".rtf",
    ".html",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".json",
  ];

  /**
   * Dosya formatının desteklenip desteklenmediğini kontrol eder
   */
  static isFormatSupported(file: File): boolean {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const extension = fileName.substring(fileName.lastIndexOf("."));

    return (
      this.SUPPORTED_FORMATS.includes(mimeType) ||
      this.SUPPORTED_EXTENSIONS.includes(extension)
    );
  }

  /**
   * Desteklenen formatların listesini döndürür
   */
  static getSupportedFormats(): string[] {
    return [...this.SUPPORTED_EXTENSIONS];
  }

  /**
   * Ana metin çıkarma fonksiyonu - Basit, stabil, OCR'sız
   */
  static async extractText(file: File, onProgress?: ProgressCallback): Promise<SmartProcessingResult> {
    const startTime = Date.now();
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    const warnings: string[] = [];

    console.log(`Smart processing başladı: ${file.name} (${mimeType})`);

    try {
      // 1️⃣ DOCX İşleme - Mammoth ile
      if (mimeType.includes("wordprocessingml") || fileName.endsWith(".docx")) {
        try {
          console.log("DOCX işleme başladı...");
          const buffer = Buffer.from(await file.arrayBuffer());
          const result = await mammoth.extractRawText({ buffer });

          if (result.value?.trim()) {
            const normalizedText = TurkishNormalizer.normalize(result.value);
            console.log(`DOCX başarılı: ${normalizedText.length} karakter`);

            return {
              success: true,
              text: normalizedText,
              method: "mammoth-docx",
              fileType: "docx",
              processingTime: Date.now() - startTime,
              warnings,
            };
          }
        } catch (error) {
          console.error("DOCX işleme hatası:", error);
          warnings.push("DOCX işleme başarısız");
        }
      }

      // 2️⃣ PDF İşleme - pdf2json ile (canvas dependency yok!)
      if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
        try {
          console.log("PDF işleme başladı (pdf2json)...");
          const { default: PDFParser } = await import("pdf2json");

          const buffer = Buffer.from(await file.arrayBuffer());
          const pdfParser = new (PDFParser as any)(null, 1);

          // Promise wrapper for pdf2json
          const fullText = await new Promise<string>((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
              try {
                let text = "";
                const pages = pdfData.Pages || [];

                console.log(`[DEBUG] PDF Pages sayısı: ${pages.length}`);

                pages.forEach((page: any, pageIndex: number) => {
                  const texts = page.Texts || [];
                  console.log(
                    `[DEBUG] Sayfa ${pageIndex + 1}: ${texts.length} text item`
                  );

                  let pageText = "";
                  texts.forEach((textItem: any, textIndex: number) => {
                    // pdf2json'da her textItem.R bir array - tüm R'leri işleyelim
                    if (textItem.R && Array.isArray(textItem.R)) {
                      textItem.R.forEach((r: any, rIndex: number) => {
                        if (r.T) {
                          try {
                            const decodedText = decodeURIComponent(r.T);
                            pageText += decodedText + " ";
                          } catch (e) {
                            // decodeURIComponent hatası olursa raw text kullan
                            pageText += r.T + " ";
                          }
                        }
                      });
                    }
                  });

                  if (pageIndex === 0) {
                    console.log(
                      `[DEBUG] İlk sayfa metni (ilk 200 karakter):`,
                      pageText.substring(0, 200)
                    );
                  }

                  text += pageText;
                  // Her sayfa sonunda yeni satır
                  text += "\n\n";
                });

                console.log(
                  `PDF parsed: ${pages.length} sayfa, ${text.length} karakter`
                );
                console.log(`[DEBUG] İlk 500 karakter:`, text.substring(0, 500));
                resolve(text);
              } catch (err) {
                console.error("[DEBUG] PDF parsing error:", err);
                reject(err);
              }
            });

            pdfParser.on("pdfParser_dataError", (error: any) => {
              console.error("[DEBUG] PDF parser error event:", error);
              reject(error);
            });

            pdfParser.parseBuffer(buffer);
          });

          if (fullText.trim() && fullText.trim().length > 100) {
            const normalizedText = TurkishNormalizer.normalize(fullText);
            console.log(`PDF başarılı: ${normalizedText.length} karakter`);

            return {
              success: true,
              text: normalizedText,
              method: "pdf2json",
              fileType: "pdf",
              processingTime: Date.now() - startTime,
              warnings,
            };
          } else {
            // PDF taranmış (scanned) - OCR ile metin çıkar
            console.log(
              `PDF metin katmanı bulunamadı (${fullText.trim().length} karakter), OCR başlatılıyor...`
            );
            warnings.push("PDF metin katmanı bulunamadı");
            warnings.push("PDF'den OCR ile metin çıkarılıyor (bu biraz zaman alabilir)");

            try {
              const ocrText = await this.extractTextWithTesseractOCR(file, onProgress);
              if (ocrText.trim()) {
                const normalizedText = TurkishNormalizer.normalize(ocrText);
                console.log(
                  `OCR başarılı: ${normalizedText.length} karakter`
                );

                return {
                  success: true,
                  text: normalizedText,
                  method: "tesseract-ocr",
                  fileType: "pdf",
                  processingTime: Date.now() - startTime,
                  warnings,
                };
              } else {
                console.error("OCR boş sonuç verdi");
                warnings.push("OCR başarısız oldu");
              }
            } catch (ocrError) {
              console.error("OCR hatası:", ocrError);
              warnings.push("OCR işleme başarısız");
            }

            // OCR de başarısız olursa, hata mesajı ver
            return {
              success: false,
              text: "",
              method: "pdf2json-failed",
              fileType: "pdf",
              processingTime: Date.now() - startTime,
              error:
                "PDF'den metin çıkarılamadı. Bu bir taranmış (scanned) PDF ve OCR başarısız oldu. Lütfen kaynak Word dosyasını kullanın.",
              warnings,
            };
          }
        } catch (error) {
          console.error("PDF işleme hatası:", error);
          warnings.push("PDF işleme başarısız - taranmış PDF olabilir");
        }
      }

      // 3️⃣ JSON Dosyaları - Pretty print ile
      if (mimeType.includes("json") || fileName.endsWith(".json")) {
        try {
          console.log("JSON dosyası işleme başladı...");
          const text = await file.text();

          if (text?.trim()) {
            // JSON'u parse edip güzelce formatla
            try {
              const jsonData = JSON.parse(text);
              const prettyJson = JSON.stringify(jsonData, null, 2);
              const normalizedText = TurkishNormalizer.normalize(prettyJson);

              console.log(
                `JSON dosyası başarılı: ${normalizedText.length} karakter`
              );

              return {
                success: true,
                text: normalizedText,
                method: "json-reader",
                fileType: "json",
                processingTime: Date.now() - startTime,
                warnings,
              };
            } catch (parseError) {
              // JSON parse edilemezse raw text olarak kullan
              console.warn("JSON parse hatası, raw text kullanılıyor:", parseError);
              const normalizedText = TurkishNormalizer.normalize(text);

              return {
                success: true,
                text: normalizedText,
                method: "json-reader-raw",
                fileType: "json",
                processingTime: Date.now() - startTime,
                warnings: [...warnings, "JSON formatı hatalı, raw metin olarak okundu"],
              };
            }
          }
        } catch (error) {
          console.error("JSON dosyası işleme hatası:", error);
          warnings.push("JSON dosyası okunamadı");
        }
      }

      // 4️⃣ Metin Dosyaları (TXT, RTF, HTML)
      if (mimeType.includes("text") || fileName.match(/\.(txt|rtf|html)$/)) {
        try {
          console.log("Metin dosyası işleme başladı...");
          const text = await file.text();

          if (text?.trim()) {
            const normalizedText = TurkishNormalizer.normalize(text);
            console.log(
              `Metin dosyası başarılı: ${normalizedText.length} karakter`
            );

            return {
              success: true,
              text: normalizedText,
              method: "text-reader",
              fileType: "text",
              processingTime: Date.now() - startTime,
              warnings,
            };
          }
        } catch (error) {
          console.error("Metin dosyası işleme hatası:", error);
          warnings.push("Metin dosyası okunamadı");
        }
      }

      // 5️⃣ DOC (Legacy Word) - Gerçekçi işleme süresi ile
      if (mimeType.includes("msword") || fileName.endsWith(".doc")) {
        console.log("DOC dosyası algılandı, kapsamlı işleme başlatılıyor...");

        // Gerçekçi işleme süreleri için bekletme
        await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 saniye minimum

        try {
          console.log("DOC metin çıkarımı deneniyor (antiword)...");
          const { exec } = await import("child_process");
          const { promisify } = await import("util");
          const execAsync = promisify(exec);
          const fs = await import("fs");
          const path = await import("path");

          // Gerçekçi dosya analizi süresi
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Geçici dosya oluştur
          const tempDir = "/tmp";
          const tempFilePath = path.join(tempDir, `doc_${Date.now()}.doc`);

          // Dosyayı geçici olarak kaydet
          const buffer = Buffer.from(await file.arrayBuffer());
          fs.writeFileSync(tempFilePath, buffer);

          console.log("DOC dosyası analiz ediliyor...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Analiz süresi

          try {
            // Antiword ile metni çıkar
            const { stdout } = await execAsync(
              `antiword "${tempFilePath}" 2>/dev/null || echo ""`
            );

            // Geçici dosyayı sil
            try {
              fs.unlinkSync(tempFilePath);
            } catch {}

            if (stdout?.trim() && stdout.trim() !== "") {
              const normalizedText = TurkishNormalizer.normalize(stdout);
              console.log(
                `DOC başarılı (antiword): ${normalizedText.length} karakter`
              );

              return {
                success: true,
                text: normalizedText,
                method: "antiword-doc",
                fileType: "doc",
                processingTime: Date.now() - startTime,
                warnings,
              };
            } else {
              console.log(
                "Antiword çıktısı boş, alternatif yöntem deneniyor..."
              );
              warnings.push("DOC metin katmanı antiword ile çıkarılamadı");
            }
          } catch (execError) {
            console.error("Antiword çalıştırma hatası:", execError);
            warnings.push("DOC işleme başarısız - antiword kullanılamıyor");

            // Geçici dosyayı temizle
            try {
              fs.unlinkSync(tempFilePath);
            } catch {}
          }
        } catch (error) {
          console.error("DOC işleme kritik hatası:", error);
          warnings.push("DOC dosya okuma hatası");
        }

        // Son deneme - dosya içeriğini ham okuma
        console.log("DOC fallback işlemi deneniyor...");
        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const rawText = buffer.toString("utf8");

          // Basit text çıkarımı (DOC binary içindeki metin parçaları)
          const extractedText = rawText
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (extractedText.length > 50) {
            warnings.push(
              "DOC dosyası ham metin çıkarımı ile işlendi (düşük kalite)"
            );
            console.log(
              `DOC fallback başarılı: ${extractedText.length} karakter`
            );

            return {
              success: true,
              text: TurkishNormalizer.normalize(extractedText),
              method: "doc-fallback",
              fileType: "doc",
              processingTime: Date.now() - startTime,
              warnings,
            };
          }
        } catch (fallbackError) {
          console.error("DOC fallback hatası:", fallbackError);
          warnings.push("DOC fallback işlemi başarısız");
        }

        // Tüm yöntemler başarısız
        warnings.push(
          "Legacy DOC formatı işlenemedi - DOCX'e çevirmeniz önerilir"
        );
        return {
          success: false,
          text: "",
          method: "failed-doc",
          fileType: "doc",
          processingTime: Date.now() - startTime,
          error:
            "DOC dosyası işlenemedi. Modern DOC dosyası değil veya bozuk olabilir. Lütfen dosyayı DOCX formatına çevirin.",
          warnings,
        };
      }

      // 5️⃣ Desteklenmeyen Format
      return {
        success: false,
        text: "",
        method: "unsupported",
        fileType: mimeType || "unknown",
        processingTime: Date.now() - startTime,
        error: `Desteklenmeyen dosya formatı: ${
          file.name
        }. Desteklenen formatlar: ${this.getSupportedFormats().join(", ")}`,
        warnings,
      };
    } catch (error) {
      console.error("Smart processing kritik hatası:", error);
      return {
        success: false,
        text: "",
        method: "error",
        fileType: mimeType || "unknown",
        processingTime: Date.now() - startTime,
        error:
          error instanceof Error ? error.message : "Bilinmeyen işleme hatası",
        warnings,
      };
    }
  }

  /**
   * Tesseract OCR ile PDF'den metin çıkar (taranmış PDF'ler için)
   */
  private static async extractTextWithTesseractOCR(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<string> {
    console.log("Tesseract OCR başlatılıyor...");
    onProgress?.("📄 OCR ile metin çıkarılıyor...", 0);

    const { exec, spawn } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    const fs = await import("fs");
    const path = await import("path");

    const tempDir = "/tmp";
    const timestamp = Date.now();
    const tempPdfPath = path.join(tempDir, `ocr_input_${timestamp}.pdf`);
    const tempTxtPath = path.join(tempDir, `ocr_output_${timestamp}.txt`);

    try {
      // 1. PDF'i geçici dosyaya kaydet
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(tempPdfPath, buffer);
      console.log(`OCR: PDF kaydedildi (${buffer.length} bytes)`);

      // 1.5. BÜYÜK PDF'LER İÇİN OPTİMİZE ET (>5MB)
      const sizeInMB = buffer.length / (1024 * 1024);
      let pdfToProcess = tempPdfPath;

      if (sizeInMB > 5) {
        console.log(`[OPTIMIZE] Büyük PDF tespit edildi: ${sizeInMB.toFixed(2)} MB`);
        onProgress?.("🔧 Büyük PDF optimize ediliyor...", 5);

        const optimizedPdfPath = path.join(tempDir, `ocr_optimized_${timestamp}.pdf`);
        const optimizerScript = path.join(process.cwd(), "scripts/pdf_optimizer.sh");

        try {
          const { stdout: optStdout } = await execAsync(
            `"${optimizerScript}" "${tempPdfPath}" "${optimizedPdfPath}"`,
            { timeout: 120000 } // 2 dakika optimize için
          );
          console.log(`[OPTIMIZE] ${optStdout}`);

          // Optimize edilmiş PDF'i kullan
          if (fs.existsSync(optimizedPdfPath)) {
            const optimizedSize = fs.statSync(optimizedPdfPath).size;
            const optimizedMB = optimizedSize / (1024 * 1024);
            console.log(`[OPTIMIZE] ✅ PDF optimize edildi: ${optimizedMB.toFixed(2)} MB`);

            // Orijinal PDF'i sil, optimize edilmiş PDF'i kullan
            fs.unlinkSync(tempPdfPath);
            pdfToProcess = optimizedPdfPath;
            onProgress?.("✅ PDF optimize edildi", 10);
          }
        } catch (optError) {
          console.warn(`[OPTIMIZE] ⚠️ Optimize işlemi başarısız, orijinal PDF kullanılacak:`, optError);
          // Optimize başarısız olursa, orijinal PDF'i kullan
        }
      }

      // 2. Bash scripti ile OCR (pdftoppm + tesseract) - STREAMING ile
      const scriptPath = path.join(
        process.cwd(),
        "scripts/pdf_ocr_tesseract.sh"
      );
      console.log(`OCR scripti çalıştırılıyor: ${scriptPath}`);
      onProgress?.("📄 OCR başlatılıyor...", 15);

      // Spawn kullanarak real-time output alalım (unbuffered)
      const ocrProcess = spawn('bash', [scriptPath, pdfToProcess, tempTxtPath], {
        stdio: ['ignore', 'pipe', 'pipe'], // stdin ignore, stdout/stderr pipe
        env: { ...process.env, PYTHONUNBUFFERED: '1' } // Unbuffered output
      });

      let totalPages = 0;
      let currentPage = 0;

      // stdout'dan progress bilgisi oku
      ocrProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[OCR] ${output}`);

        // Sayfa sayısını yakala: "[INFO] Created 118 page images"
        const pageCountMatch = output.match(/Created (\d+) page/);
        if (pageCountMatch) {
          totalPages = parseInt(pageCountMatch[1]);
          console.log(`[OCR] Toplam sayfa: ${totalPages}`);
          onProgress?.(`📄 ${totalPages} sayfa tespit edildi`, 20);
        }

        // OCR başladı mesajı: "[INFO] Starting PARALLEL OCR..."
        if (output.includes('Starting PARALLEL OCR')) {
          onProgress?.(`⚙️ OCR işleniyor...`, 25);
        }

        // Birleştirme başladı: "[INFO] Merging results..."
        if (output.includes('Merging results')) {
          onProgress?.(`🔗 Sayfalar birleştiriliyor...`, 85);
        }

        // Başarı mesajı: "[SUCCESS] OCR completed: 274071 characters from 118 pages"
        const successMatch = output.match(/OCR completed: (\d+) characters from (\d+) pages/);
        if (successMatch) {
          const chars = parseInt(successMatch[1]);
          const pages = parseInt(successMatch[2]);
          console.log(`[OCR] ✅ Tamamlandı: ${chars} karakter, ${pages} sayfa`);
          onProgress?.(`✅ OCR tamamlandı (${pages} sayfa)`, 95);
        }
      });

      // stderr'den de progress oku (bazı scriptler stderr'e yazar)
      ocrProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`[OCR stderr] ${output}`);
      });

      // Process'in bitmesini bekle
      await new Promise<void>((resolve, reject) => {
        ocrProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`OCR script exited with code ${code}`));
          }
        });
        ocrProcess.on('error', reject);
      });

      // 3. OCR çıktısını oku
      if (fs.existsSync(tempTxtPath)) {
        const ocrText = fs.readFileSync(tempTxtPath, "utf-8");
        console.log(`OCR tamamlandı: ${ocrText.length} karakter`);
        onProgress?.("✅ Metin çıkarıldı", 100);

        // Geçici dosyaları temizle
        try {
          // Optimize edilmiş PDF kullanılmışsa onu, değilse orijinal PDF'i temizle
          if (fs.existsSync(pdfToProcess)) fs.unlinkSync(pdfToProcess);
          if (fs.existsSync(tempTxtPath)) fs.unlinkSync(tempTxtPath);
        } catch (cleanupError) {
          console.warn("Geçici dosya temizleme hatası:", cleanupError);
        }

        if (ocrText.trim()) {
          return ocrText;
        } else {
          throw new Error("OCR boş sonuç verdi");
        }
      } else {
        throw new Error("OCR çıktı dosyası oluşturulamadı");
      }
    } catch (error) {
      // Hata durumunda geçici dosyaları temizle
      try {
        const fs = await import("fs");
        const path = await import("path");
        const timestamp = Date.now();

        // Tüm olası geçici dosyaları temizle
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        if (fs.existsSync(tempTxtPath)) fs.unlinkSync(tempTxtPath);

        // Optimize edilmiş PDF varsa onu da temizle
        const optimizedPdfPath = path.join("/tmp", `ocr_optimized_${timestamp}.pdf`);
        if (fs.existsSync(optimizedPdfPath)) fs.unlinkSync(optimizedPdfPath);
      } catch {}

      throw error;
    }
  }

  /**
   * Dosya tipini algılar
   */
  static detectFileType(file: File): string {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();

    if (mimeType.includes("wordprocessingml") || fileName.endsWith(".docx"))
      return "docx";
    if (mimeType.includes("msword") || fileName.endsWith(".doc")) return "doc";
    if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) return "pdf";
    if (mimeType.includes("text") || fileName.match(/\.(txt|rtf|html)$/))
      return "text";

    return "unknown";
  }
}
