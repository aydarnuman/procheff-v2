export type AnalysisRecord = {
  analysisId: string;
  userId?: string;
  filename: string;
  size: number;
  mimeType?: string;
  fileHash?: string | null;
  status: "created" | "queued" | "processing" | "completed" | "failed";
  progress?: number; // 0..100
  result?: any;
  error?: string | null;
  createdAt: string;
  updatedAt?: string;
  storagePath?: string | null;
};

export const AnalysisStore = new Map<string, AnalysisRecord>();

export function createAnalysisRecord(rec: AnalysisRecord) {
  AnalysisStore.set(rec.analysisId, rec);
}

export function getAnalysisByHash(userId: string | undefined, fileHash: string) {
  for (const v of AnalysisStore.values()) {
    if (v.userId === userId && v.fileHash && v.fileHash === fileHash) return v;
  }
  return null;
}

export function updateAnalysis(analysisId: string, patch: Partial<AnalysisRecord>) {
  const cur = AnalysisStore.get(analysisId);
  if (!cur) return null;
  const next: AnalysisRecord = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  AnalysisStore.set(analysisId, next);
  return next;
}

export function getAnalysis(analysisId: string) {
  return AnalysisStore.get(analysisId) ?? null;
}
