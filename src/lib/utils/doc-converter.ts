import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export class DOCConverter {
  /**
   * DOC dosyasını LibreOffice ile DOCX'e çevirir
   */
  static async convertDOCtoDocx(
    file: File
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Geçici DOC dosyası oluştur
      const tempDir = "/tmp";
      const docPath = path.join(tempDir, `input_${Date.now()}.doc`);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(docPath, buffer);

      // LibreOffice ile DOCX'e çevir
      const outputDir = tempDir;
      await execAsync(
        `libreoffice --headless --convert-to docx --outdir "${outputDir}" "${docPath}"`
      );

      // Çıktı dosyasının yolunu oluştur
      const docxPath = docPath.replace(".doc", ".docx");

      // DOC dosyasını temizle
      fs.unlinkSync(docPath);

      if (fs.existsSync(docxPath)) {
        return { success: true, filePath: docxPath };
      } else {
        return { success: false, error: "DOCX dönüşümü başarısız" };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Bilinmeyen dönüşüm hatası",
      };
    }
  }

  /**
   * DOC dosyasını doğrudan metne çevirir
   */
  static async convertDOCtoText(
    file: File
  ): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      // Geçici DOC dosyası oluştur
      const tempDir = "/tmp";
      const docPath = path.join(tempDir, `input_${Date.now()}.doc`);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(docPath, buffer);

      // LibreOffice ile TXT'ye çevir
      const outputDir = tempDir;
      await execAsync(
        `libreoffice --headless --convert-to txt --outdir "${outputDir}" "${docPath}"`
      );

      // Çıktı dosyasının yolunu oluştur
      const txtPath = docPath.replace(".doc", ".txt");

      // DOC dosyasını temizle
      fs.unlinkSync(docPath);

      if (fs.existsSync(txtPath)) {
        const text = fs.readFileSync(txtPath, "utf-8");
        fs.unlinkSync(txtPath); // TXT dosyasını da temizle
        return { success: true, text };
      } else {
        return { success: false, error: "TXT dönüşümü başarısız" };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Bilinmeyen dönüşüm hatası",
      };
    }
  }
}
