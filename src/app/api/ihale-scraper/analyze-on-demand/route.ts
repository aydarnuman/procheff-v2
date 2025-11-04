// ============================================================================
// ON-DEMAND AI ANALYSIS API
// Kullanıcı AI butonuna tıkladığında tek ihaleyi analiz eder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { OnDemandAnalyzer } from '@/lib/ihale-scraper/ai/on-demand-analyzer';
import { TenderDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

export const maxDuration = 60; // 60 saniye timeout (AI analizi için)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenderId, url } = body;

    if (!tenderId && !url) {
      return NextResponse.json(
        { success: false, error: 'tenderId veya url gerekli' },
        { status: 400 }
      );
    }

    console.log(`\n🤖 ON-DEMAND AI ANALYSIS: ${tenderId || url}`);
    console.log('='.repeat(70));

    // ============================================================
    // 1. İhale URL'ini belirle
    // ============================================================
    let tenderUrl = url;
    let existingTender = null;

    if (tenderId && !url) {
      // Database'den ihale bilgilerini çek
      existingTender = await TenderDatabase.getTenderById(tenderId);
      if (!existingTender) {
        return NextResponse.json(
          { success: false, error: 'İhale bulunamadı' },
          { status: 404 }
        );
      }
      tenderUrl = existingTender.source_url;
    }

    if (!tenderUrl) {
      return NextResponse.json(
        { success: false, error: 'İhale URL\'si bulunamadı' },
        { status: 400 }
      );
    }

    // ============================================================
    // 2. AI ile tam sayfa analizi yap
    // ============================================================
    const analyzer = new OnDemandAnalyzer();
    const analysis = await analyzer.analyzeFullPage(tenderUrl);

    if (!analysis.success) {
      return NextResponse.json(
        {
          success: false,
          error: analysis.error || 'Analiz başarısız',
          details: analysis.details
        },
        { status: 500 }
      );
    }

    // ============================================================
    // 3. Sonuçları database'e kaydet (güncelle)
    // ============================================================
    if (tenderId) {
      await TenderDatabase.updateTenderWithAIAnalysis(tenderId, {
        // Temel bilgiler
        budget: analysis.data?.budget,
        announcement_date: analysis.data?.announcement_date,
        tender_date: analysis.data?.tender_date,
        deadline_date: analysis.data?.deadline_date,
        tender_type: analysis.data?.tender_type,
        procurement_type: analysis.data?.procurement_type,
        category: analysis.data?.category,
        specification_url: analysis.data?.specification_url,
        announcement_text: analysis.data?.announcement_text,

        // Kategorilendirme
        is_catering: analysis.data?.is_catering || false,
        catering_confidence: analysis.data?.catering_confidence || 0,
        ai_categorization_reasoning: analysis.data?.ai_reasoning,

        // Mal/Hizmet listesi
        total_items: analysis.data?.total_items,
        total_meal_quantity: analysis.data?.total_meal_quantity,
        estimated_budget_from_items: analysis.data?.estimated_budget_from_items,

        // AI analiz metadata
        ai_analyzed: true,
        ai_analyzed_at: new Date().toISOString(),

        // Raw data
        raw_json: analysis.data?.documents
          ? { documents: analysis.data.documents, ...analysis.data?.raw_json }
          : analysis.data?.raw_json,
      });

      console.log(`✅ İhale ${tenderId} güncellendi (AI analizi tamamlandı)`);
    }

    // ============================================================
    // 4. Sonuçları döndür
    // ============================================================
    return NextResponse.json({
      success: true,
      data: analysis.data,
      metadata: {
        analyzed_at: new Date().toISOString(),
        analysis_duration_ms: analysis.duration_ms,
        ai_model: analysis.ai_model,
      },
    });

  } catch (error: any) {
    console.error('❌ On-demand analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Bilinmeyen hata',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
