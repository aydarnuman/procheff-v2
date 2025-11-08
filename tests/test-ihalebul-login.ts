require('dotenv').config();
import { IhalebulScraper } from './src/lib/ihale-scraper/scrapers/ihalebul-scraper';
import { SCRAPER_CONFIG } from './src/lib/ihale-scraper/config';

async function testIhalebulAutoLogin() {
  console.log('🧪 Testing İhalebul Auto-Login System...\n');

  const scraper = new IhalebulScraper(SCRAPER_CONFIG.ihalebul);

  try {
    // Test with environment variables
    const username = process.env.IHALEBUL_USERNAME;
    const password = process.env.IHALEBUL_PASSWORD;

    if (!username || !password || username === 'your_username_here' || password === 'your_password_here') {
      console.error('❌ Environment variables not set properly!');
      console.error('   IHALEBUL_USERNAME:', username);
      console.error('   IHALEBUL_PASSWORD:', password ? '***' + password.slice(-3) : 'not set');
      return;
    }

    console.log('🔐 Testing login with credentials...');
    console.log('   Username:', username);
    console.log('   Password: ***' + password.slice(-3));

    const tenders = await scraper.scrape();

    console.log('\n📊 Scrape Results:');
    console.log('   Tenders found:', tenders.length);

    if (tenders.length > 0) {
      console.log('   Sample tender:', tenders[0].title?.substring(0, 50) + '...');
      console.log('✅ Auto-login system appears to be working!');
    } else {
      console.log('⚠️ No tenders found - this could be normal if no new tenders are available');
      console.log('✅ Auto-login system appears to be working (no scrape errors)');
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Run the test
testIhalebulAutoLogin().catch(console.error);