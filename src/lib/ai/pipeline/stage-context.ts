// AI Pipeline: Context Stage
export async function runContextualAnalysis(strategic: any, extractedData: any) {
  if (!strategic?.provider) {
    throw new Error("No strategic provider available");
  }
  return await strategic.provider.analyzeContext(extractedData);
}
