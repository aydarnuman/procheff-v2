#!/bin/bash

###############################################################################
# PDF Optimizer Script - Ghostscript ile PDF boyutunu küçültür
###############################################################################

INPUT_PDF="$1"
OUTPUT_PDF="$2"

if [ -z "$INPUT_PDF" ] || [ -z "$OUTPUT_PDF" ]; then
  echo "❌ Kullanım: $0 <input.pdf> <output.pdf>"
  exit 1
fi

if [ ! -f "$INPUT_PDF" ]; then
  echo "❌ Dosya bulunamadı: $INPUT_PDF"
  exit 1
fi

echo "[INFO] PDF optimize ediliyor..."
echo "[INFO] Girdi: $INPUT_PDF"
echo "[INFO] Çıktı: $OUTPUT_PDF"

# Ghostscript ile PDF'i optimize et
# -dPDFSETTINGS=/screen - En düşük kalite (OCR için yeterli)
# -dCompatibilityLevel=1.4 - PDF 1.4 uyumluluğu
# -dNOPAUSE -dBATCH -dSAFER - Güvenli mod
# -sDEVICE=pdfwrite - PDF çıktısı
# -dColorImageResolution=150 - Görüntü çözünürlüğü 150 DPI (OCR için yeterli)
# -dGrayImageResolution=150 - Gri görüntü çözünürlüğü 150 DPI

gs -sDEVICE=pdfwrite \
   -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/screen \
   -dNOPAUSE \
   -dBATCH \
   -dSAFER \
   -dColorImageResolution=150 \
   -dGrayImageResolution=150 \
   -dMonoImageResolution=300 \
   -sOutputFile="$OUTPUT_PDF" \
   "$INPUT_PDF" 2>&1

if [ $? -eq 0 ]; then
  ORIGINAL_SIZE=$(stat -f%z "$INPUT_PDF" 2>/dev/null || stat -c%s "$INPUT_PDF")
  OPTIMIZED_SIZE=$(stat -f%z "$OUTPUT_PDF" 2>/dev/null || stat -c%s "$OUTPUT_PDF")

  ORIGINAL_MB=$(echo "scale=2; $ORIGINAL_SIZE / 1048576" | bc)
  OPTIMIZED_MB=$(echo "scale=2; $OPTIMIZED_SIZE / 1048576" | bc)
  SAVINGS=$(echo "scale=1; 100 - ($OPTIMIZED_SIZE * 100 / $ORIGINAL_SIZE)" | bc)

  echo "[SUCCESS] ✅ PDF optimize edildi!"
  echo "[INFO] Orijinal boyut: ${ORIGINAL_MB} MB"
  echo "[INFO] Optimize boyut: ${OPTIMIZED_MB} MB"
  echo "[INFO] Tasarruf: ${SAVINGS}%"
  exit 0
else
  echo "[ERROR] ❌ PDF optimize işlemi başarısız"
  exit 1
fi
