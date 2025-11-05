// AI Pipeline: Validation Stage
export function validateExtraction(rawExtractedData: any) {
  if (!rawExtractedData || !rawExtractedData.guven_skoru) {
    throw new Error("Extraction failed: no data returned");
  }
  return rawExtractedData;
}
