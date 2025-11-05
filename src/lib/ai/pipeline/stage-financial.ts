// AI Pipeline: Financial Stage
export function processFinancialData(csvAnalyses: any[]) {
  return validateCSVAnalysis(csvAnalyses).map(csv => csv.analysis);
}
import { validateCSVAnalysis } from "./stage-csv";
