import { TenderDatabase } from '@/lib/ihale-scraper/database';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, context: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await context.params;
  if (!tenderId) return Response.json({ success: false, error: 'tenderId gerekli' }, { status: 400 });

  const result = await TenderDatabase.getTenderAnalysis(tenderId);
  if (!result) return Response.json({ success: false, error: 'Analiz bulunamadı' }, { status: 404 });

  // Transform data to match EnhancedAnalysisResults component expectations
  // DB'de kayıtlı: { title, organization, details, documents, fullText, itemsList }
  // Component bekler: { extracted_data: { kurum, ihale_turu, ... }, contextual_analysis: {...} }

  const savedData = result.analysisResult || {};

  console.log(`✅ [DB API] Returning scraper format for tender ${tenderId}`);
  console.log(`✅ [DB API] Keys:`, Object.keys(savedData));
  console.log(`✅ [DB API] Has details?`, !!savedData.details, `(${Object.keys(savedData.details || {}).length} fields)`);
  console.log(`✅ [DB API] Has fullText?`, !!savedData.fullText, `(${(savedData.fullText || '').length} chars)`);
  console.log(`✅ [DB API] Has documents?`, !!savedData.documents, `(${(savedData.documents || []).length} docs)`);

  // ✅ MODAL için scraper formatını direkt döndür
  // { title, organization, details, documents, fullText, itemsList }
  return Response.json({ success: true, data: JSON.parse(JSON.stringify(savedData)) });
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await context.params;
  if (!tenderId) return Response.json({ success: false, error: 'tenderId gerekli' }, { status: 400 });

  const body = await req.json();
  const { analysisResult, fullContent } = body;
  if (!analysisResult || !fullContent) {
    return Response.json({ success: false, error: 'analysisResult ve fullContent gerekli' }, { status: 400 });
  }

  const saveResult = await TenderDatabase.saveTenderAnalysis(tenderId, analysisResult, fullContent);
  if (!saveResult.success) return Response.json({ success: false, error: saveResult.error }, { status: 500 });

  return Response.json({ success: true });
}
