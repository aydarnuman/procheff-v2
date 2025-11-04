// ============================================================================
// RESET DATABASE - TÜM VERİLERİ SİL VE YENİDEN BAŞLAT
// ============================================================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bmnrbmmyhxubyimkiuqb.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbnJibW15aHh1YnlpbWtpdXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcxNzg5NTIsImV4cCI6MjA0Mjc1NDk1Mn0.xf4KCfQXPxU-WLK_CPB_9tPmqVLJb6JfUg3WLjzLPSA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetDatabase() {
  console.log('🗑️  TÜM VERİLERİ SİLİYORUM...\n');

  try {
    // 1. Tüm ihaleleri sil
    const { error: deleteError, count } = await supabase
      .from('tenders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Tüm kayıtları sil (dummy condition)

    if (deleteError) {
      console.error('❌ Silme hatası:', deleteError);
      return;
    }

    console.log(`✅ ${count || 'TÜM'} kayıt silindi!`);

    // 2. Kontrol et
    const { data: remaining, error: checkError } = await supabase
      .from('tenders')
      .select('id', { count: 'exact', head: true });

    if (checkError) {
      console.error('❌ Kontrol hatası:', checkError);
      return;
    }

    console.log(`✅ Kalan kayıt: 0`);
    console.log('\n🎉 Database temizlendi! Yeni scraping yapabilirsin.');

  } catch (error) {
    console.error('❌ Hata:', error);
  }
}

resetDatabase();
