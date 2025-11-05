import { TenderDatabase } from '@/lib/ihale-scraper/database/sqlite-client';
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

  console.log(`🔄 [TRANSFORM] Transforming data for tender ${tenderId}`);
  console.log(`🔄 [TRANSFORM] savedData keys:`, Object.keys(savedData));
  console.log(`🔄 [TRANSFORM] Has extracted_data?`, !!savedData.extracted_data);

  // Eğer savedData zaten doğru formattaysa (extracted_data var), direkt döndür
  if (savedData.extracted_data) {
    console.log(`✅ [TRANSFORM] Already in correct format, returning as-is`);
    return Response.json({ success: true, data: JSON.parse(JSON.stringify(savedData)) });
  }

  // Değilse, ihale scraper formatından AI analysis formatına dönüştür
  console.log(`🔄 [TRANSFORM] Converting scraper format to AI analysis format`);
  const transformedData = {
    extracted_data: {
      kurum: savedData.organization || '',
      ihale_turu: 'Hizmet Alımı', // Default, details'den parse edilebilir
      kisi_sayisi: null,
      ogun_sayisi: null,
      gun_sayisi: null,
      tahmini_butce: null,
      ozel_sartlar: [],
      riskler: [],
      guven_skoru: 0.7, // Scraper data için default güven skoru
      kanitlar: {},
      veri_havuzu: {
        ham_metin: savedData.fullText || '',
        kaynaklar: savedData.documents || []
      },
      detayli_veri: savedData.details || {},
      tablolar: []
    },
    contextual_analysis: {
      firsat_analizi: { puan: 0, gerekce: 'Henüz analiz edilmedi' },
      operasyonel_riskler: { seviye: 'orta', detaylar: [] },
      rekabet_analizi: { tahmini_katilimci: 0, zorluk: 'orta' },
      oneriler: ['Detaylı analiz için "Tam Analiz Yap" butonunu kullanın']
    },
    fullContent: result.fullContent || {},
    processing_metadata: {
      processing_time: 0,
      ai_provider: 'cached_scraper_data',
      confidence_score: 0.7
    }
  };

  // Saf JSON olarak döndür
  return Response.json({ success: true, data: JSON.parse(JSON.stringify(transformedData)) });
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
