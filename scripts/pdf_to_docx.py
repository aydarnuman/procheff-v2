#!/usr/bin/env python3
"""
PDF to DOCX converter script
Usage: python3 pdf_to_docx.py <input_pdf> <output_docx>
"""

import sys
from pdf2docx import Converter

def convert_pdf_to_docx(pdf_path, docx_path):
    """Convert PDF to DOCX format"""
    try:
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        print(f"✅ Conversion successful: {docx_path}")
        return True
    except Exception as e:
        print(f"❌ Conversion failed: {str(e)}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 pdf_to_docx.py <input_pdf> <output_docx>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    docx_path = sys.argv[2]

    success = convert_pdf_to_docx(pdf_path, docx_path)
    sys.exit(0 if success else 1)
