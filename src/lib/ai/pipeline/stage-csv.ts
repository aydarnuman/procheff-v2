// AI Pipeline: CSV Stage
export function validateCSVAnalysis(csvAnalyses: any[]) {
  return Array.isArray(csvAnalyses)
    ? csvAnalyses.filter(csv => csv.analysis && csv.analysis.items)
    : [];
}
