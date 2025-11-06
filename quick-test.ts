// Quick test to check if fixes work
import 'dotenv/config';
import { IhalebulScraper } from './src/lib/ihale-scraper/scrapers/ihalebul-scraper';
import { getDatabase } from './src/lib/ihale-scraper/database/sqlite-client';

async function quickTest() {
  console.log('🧪 Quick test: Check recent ihalebul data\n');
  
  const db = getDatabase();
  
  // Check existing records
  const existing = db.prepare(`
    SELECT COUNT(*) as total, 
           COUNT(organization_city) as with_city,
           COUNT(registration_number) as with_reg,
           COUNT(deadline_date) as with_deadline
    FROM ihale_listings 
    WHERE source = 'ihalebul'
  `).get();
  
  console.log('📊 Current database state:');
  console.log('  Total ihalebul records:', existing.total);
  console.log('  With city:', existing.with_city);
  console.log('  With registration_number:', existing.with_reg);
  console.log('  With deadline_date:', existing.with_deadline);
  
  if (existing.total > 0) {
    console.log('\n📋 Sample records:');
    const samples = db.prepare(`
      SELECT id, title, organization_city, registration_number, deadline_date
      FROM ihale_listings 
      WHERE source = 'ihalebul'
      ORDER BY id DESC
      LIMIT 3
    `).all();
    
    samples.forEach((record: any) => {
      console.log(`\n  ID: ${record.id}`);
      console.log(`  Title: ${record.title}`);
      console.log(`  City: ${record.organization_city || '❌ NULL'}`);
      console.log(`  Reg No: ${record.registration_number || '❌ NULL'}`);
      console.log(`  Deadline: ${record.deadline_date || '❌ NULL'}`);
    });
  }
  
  console.log('\n✅ Test complete!');
}

quickTest().catch(console.error);
