#!/usr/bin/env tsx
/**
 * Test script for improved ihalebul scraper navigation
 * Tests the new 3-stage element waiting system
 */

import { IhalebulScraper } from './src/lib/ihale-scraper/scrapers/ihalebul-scraper';
import { SCRAPER_CONFIG } from './src/lib/ihale-scraper/config';

async function testScraperNavigation() {
  console.log('🧪 Testing İhalebul Scraper Navigation Improvements\n');
  console.log('📋 Test Configuration:');
  console.log(`   - Category: ${SCRAPER_CONFIG.ihalebul.categoryUrl}`);
  console.log(`   - Max pages: 2 (test mode)\n`);

  const scraper = new IhalebulScraper();

  try {
    console.log('🚀 Starting scraper with login...\n');

    // Run scraper with max 2 pages for testing
    const results = await scraper.scrape();

    console.log('\n✅ Scraper Test Completed!');
    console.log(`📊 Results: ${results.length} tenders found`);

    if (results.length > 0) {
      console.log('\n📝 First tender sample:');
      const first = results[0];
      console.log(`   - Title: ${first.title}`);
      console.log(`   - ID: ${first.externalId}`);
      console.log(`   - Category: ${first.category}`);
      console.log(`   - Location: ${first.location}`);
    }

  } catch (error) {
    console.error('\n❌ Test Failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run test
testScraperNavigation().then(() => {
  console.log('\n✨ Test completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
