import { NextRequest, NextResponse } from 'next/server';
import { ScraperOrchestrator } from '@/lib/ihale-scraper/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 dakika timeout

export async function POST(request: NextRequest) {
  try {
    const { url, maxPages = 10 } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL gerekli' },
        { status: 400 }
      );
    }

    console.log('🚀 Starting scraping for URL:', url);

    // Initialize orchestrator
    const orchestrator = new ScraperOrchestrator();

    // Run scraping with page limit
    const result = await orchestrator.runAll(false);

    return NextResponse.json({
      success: true,
      message: 'Scraping started',
      data: result
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 }
    );
  }
}