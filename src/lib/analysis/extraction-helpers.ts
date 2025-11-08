/**
 * Analysis helpers for OCR and AI extraction
 * Integrates existing implementations with worker pipeline
 */

import fs from "fs";
import path from "path";
import { SmartDocumentProcessor } from "@/lib/utils/smart-document-processor";

/**
 * Extract text from file using appropriate method
 * @param filePath Absolute path to file
 * @param filename Original filename for type detection
 * @returns Extracted text
 */
export async function extractText(
  filePath: string,
  filename: string
): Promise<{ text: string; method: string; wordCount: number }> {
  
  // Read file as buffer
  const fileBuffer = fs.readFileSync(filePath);
  
  // Create File-like object for SmartDocumentProcessor
  const file = new File([fileBuffer], filename, {
    type: getMimeType(filename),
  });

  // Use existing processor
  const result = await SmartDocumentProcessor.extractText(
    file,
    (message: string, progress?: number) => {
      console.log(`    📄 ${message} ${progress ? `(${progress}%)` : ""}`);
    }
  );

  if (!result.success) {
    throw new Error(result.error || "Text extraction failed");
  }

  const wordCount = result.text.split(/\s+/).filter((w: string) => w.length > 0).length;

  return {
    text: result.text,
    method: result.method,
    wordCount,
  };
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".rtf": "text/rtf",
    ".html": "text/html",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Parse document structure (placeholder for future enhancement)
 */
export async function parseDocumentStructure(text: string): Promise<{
  sections: string[];
  tables: any[];
  metadata: Record<string, any>;
}> {
  // TODO: Implement real parser
  // For now, basic section detection
  const sections = text.split(/\n\n+/).filter(s => s.trim().length > 0);
  
  return {
    sections,
    tables: [],
    metadata: {
      length: text.length,
      sectionCount: sections.length,
    },
  };
}
