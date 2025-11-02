#!/bin/bash
# PDF OCR Script using pdftoppm + tesseract
# Usage: ./pdf_ocr_tesseract.sh <input_pdf> <output_txt> [max_pages]

INPUT_PDF="$1"
OUTPUT_TXT="$2"
MAX_PAGES="${3:-999}"  # Default: TÜM SAYFALAR (999 = sınırsız)

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

echo "[INFO] Starting FULL OCR for: $INPUT_PDF"
echo "[INFO] Temp directory: $TEMP_DIR"
echo "[INFO] Max pages: $MAX_PAGES (TÜM SAYFALAR)"

# Convert PDF to PNG images (200 DPI - balance between speed and quality)
echo "[INFO] Converting PDF to images (200 DPI)..."
pdftoppm -png -r 200 -l "$MAX_PAGES" "$INPUT_PDF" "$TEMP_DIR/page" 2>/dev/null

# Count how many pages were created
PAGE_COUNT=$(find "$TEMP_DIR" -name "page-*.png" 2>/dev/null | wc -l | tr -d ' ')
echo "[INFO] Created $PAGE_COUNT page images"

if [ "$PAGE_COUNT" -eq 0 ]; then
    echo "[ERROR] No pages extracted from PDF"
    exit 1
fi

# OCR each page with Tesseract (Turkish + English)
echo "[INFO] Starting PARALLEL OCR..."
> "$OUTPUT_TXT"  # Clear output file

# Paralel işleme için geçici dosyalar
PARALLEL_TEMP="$TEMP_DIR/ocr_results"
mkdir -p "$PARALLEL_TEMP"

# Process pages in parallel (max 4 at a time)
PARALLEL_COUNT=0
MAX_PARALLEL=4

for png_file in "$TEMP_DIR"/page-*.png; do
    [ -f "$png_file" ] || continue

    base_name=$(basename "$png_file" .png)
    # Extract page number without leading zeros to avoid octal interpretation
    page_num=$(echo "$base_name" | sed 's/page-0*//')
    [ -z "$page_num" ] && page_num="1"

    output_file="$PARALLEL_TEMP/page_${page_num}.txt"

    # Run OCR in background with both Turkish and English
    (
        # Try with Turkish first, then English if Turkish fails
        tesseract "$png_file" stdout -l tur+eng --psm 1 2>/dev/null > "$output_file" || \
        tesseract "$png_file" stdout -l eng --psm 1 2>/dev/null > "$output_file"

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

# Merge results in order
echo "[INFO] Merging results..."
for png_file in "$TEMP_DIR"/page-*.png; do
    [ -f "$png_file" ] || continue

    base_name=$(basename "$png_file" .png)
    page_num=$(echo "$base_name" | sed 's/page-0*//')
    [ -z "$page_num" ] && page_num="1"

    result_file="$PARALLEL_TEMP/page_${page_num}.txt"
    if [ -f "$result_file" ]; then
        cat "$result_file" >> "$OUTPUT_TXT"
    fi
done

# Get final character count
CHAR_COUNT=$(wc -c < "$OUTPUT_TXT" | tr -d ' ')
echo "[SUCCESS] OCR completed: $CHAR_COUNT characters from $PAGE_COUNT pages"
echo "[SUCCESS] Output saved to: $OUTPUT_TXT"

# Show first 500 characters for debugging
if [ "$CHAR_COUNT" -gt 0 ]; then
    echo "[DEBUG] First 500 characters:"
    head -c 500 "$OUTPUT_TXT"
    echo ""
fi

exit 0
