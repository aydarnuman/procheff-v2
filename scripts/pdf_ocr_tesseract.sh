#!/bin/bash
# PDF OCR Script using pdftoppm + tesseract
# Usage: ./pdf_ocr_tesseract.sh <input_pdf> <output_txt> [max_pages]
#
# Tunable via environment variables (quality-first defaults):
#   OCR_DPI           - Rasterization DPI for pdftoppm (default: 300)
#   OCR_LANG          - Tesseract languages (default: tur+eng)
#   TESS_PSM          - Tesseract page segmentation mode (default: 6)
#   TESS_OEM          - Tesseract OCR Engine Mode (default: 3 = default/best)
#   OCR_MAX_PARALLEL  - Max parallel OCR workers (default: 8)

# UNBUFFERED OUTPUT - Her echo hemen stdout'a yazılsın
exec 1>&1 2>&2
set -o pipefail

INPUT_PDF="$1"
OUTPUT_TXT="$2"
MAX_PAGES="${3:-999}"  # Default: TÜM SAYFALAR (999 = sınırsız)

# Env-config (quality-first sensible defaults)
OCR_DPI="${OCR_DPI:-300}"
OCR_LANG="${OCR_LANG:-tur+eng}"
TESS_PSM="${TESS_PSM:-6}"
TESS_OEM="${TESS_OEM:-3}"
OCR_MAX_PARALLEL="${OCR_MAX_PARALLEL:-8}"

if [ -z "$INPUT_PDF" ] || [ -z "$OUTPUT_TXT" ]; then
    echo "Usage: $0 <input_pdf> <output_txt> [max_pages]"
    exit 1
fi

if [ ! -f "$INPUT_PDF" ]; then
    echo "Error: Input PDF not found: $INPUT_PDF"
    exit 1
fi

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "[INFO] Starting FULL OCR for: $INPUT_PDF" >&2
echo "[INFO] Temp directory: $TEMP_DIR" >&2
if [ "$MAX_PAGES" = "999" ]; then
  echo "[INFO] Pages: ALL (unlimited)" >&2
else
  echo "[INFO] Max pages: $MAX_PAGES" >&2
fi
echo "[INFO] Settings: DPI=$OCR_DPI, LANG=$OCR_LANG, PSM=$TESS_PSM, OEM=$TESS_OEM, PARALLEL=$OCR_MAX_PARALLEL" >&2

# Convert PDF to PNG images
echo "[INFO] Converting PDF to images (${OCR_DPI} DPI)..." >&2
pdftoppm -png -r "$OCR_DPI" -l "$MAX_PAGES" "$INPUT_PDF" "$TEMP_DIR/page" 2>/dev/null

# Count how many pages were created
PAGE_COUNT=$(find "$TEMP_DIR" -name "page-*.png" 2>/dev/null | wc -l | tr -d ' ')
echo "[INFO] Created $PAGE_COUNT page images" >&2

if [ "$PAGE_COUNT" -eq 0 ]; then
    echo "[ERROR] No pages extracted from PDF"
    exit 1
fi

# OCR each page with Tesseract (Turkish + English)
echo "[INFO] Starting PARALLEL OCR..." >&2
> "$OUTPUT_TXT"  # Clear output file

# Paralel işleme için geçici dosyalar
PARALLEL_TEMP="$TEMP_DIR/ocr_results"
mkdir -p "$PARALLEL_TEMP"

# Process pages in parallel
PARALLEL_COUNT=0
MAX_PARALLEL="$OCR_MAX_PARALLEL"

for png_file in "$TEMP_DIR"/page-*.png; do
    [ -f "$png_file" ] || continue

    base_name=$(basename "$png_file" .png)
    # Extract page number without leading zeros to avoid octal interpretation
    page_num=$(echo "$base_name" | sed 's/page-0*//')
    [ -z "$page_num" ] && page_num="1"

    output_file="$PARALLEL_TEMP/page_${page_num}.txt"

    # Run OCR in background with both Turkish and English
    (
        # Try with configured languages, then fallback to English only
        tesseract "$png_file" stdout -l "$OCR_LANG" --oem "$TESS_OEM" --psm "$TESS_PSM" 2>/dev/null > "$output_file" || \
        tesseract "$png_file" stdout -l eng --oem "$TESS_OEM" --psm "$TESS_PSM" 2>/dev/null > "$output_file"

        echo -e "\n--- Sayfa $page_num ---\n" >> "$output_file"
    ) &

    PARALLEL_COUNT=$((PARALLEL_COUNT + 1))

    # Wait after every MAX_PARALLEL processes
    if [ $((PARALLEL_COUNT % MAX_PARALLEL)) -eq 0 ]; then
        wait
    fi
done

# Wait for all remaining processes
wait

# Merge results in strict numeric order to avoid lexicographic misordering
echo "[INFO] Merging results..." >&2
for page_num in $(seq 1 "$PAGE_COUNT"); do
    result_file="$PARALLEL_TEMP/page_${page_num}.txt"
    if [ -f "$result_file" ]; then
        cat "$result_file" >> "$OUTPUT_TXT"
    fi
done

# Get final character count
CHAR_COUNT=$(wc -c < "$OUTPUT_TXT" | tr -d ' ')
echo "[SUCCESS] OCR completed: $CHAR_COUNT characters from $PAGE_COUNT pages" >&2
echo "[SUCCESS] Output saved to: $OUTPUT_TXT" >&2

# Show first 500 characters for debugging
if [ "$CHAR_COUNT" -gt 0 ]; then
    echo "[DEBUG] First 500 characters:"
    head -c 500 "$OUTPUT_TXT"
    echo ""
fi

exit 0
