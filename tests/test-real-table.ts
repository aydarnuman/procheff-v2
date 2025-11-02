import { TurkishContextAnalyzer } from '../src/lib/utils/turkish-context-analyzer';

// Gerçek belgeden alınmış tablo formatı
const realTableText = `
ÖĞÜN SAYILARI TABLOSU

Kuruluş 1: Huzurevi
Yaş Grubu | Kahvaltı | Öğle | Akşam | Toplam
----------|----------|------|-------|-------
Yararlanıcı| 6       | 6    | 6     | 6

Kuruluş 2: Çocuk Evleri
Yaş Grubu | Kahvaltı | Öğle | Akşam | Toplam
----------|----------|------|-------|-------
Yararlanıcı| 6       | 6    | 6     | 6

Kuruluş 3: Engelli Bakım Merkezi
Yaş Grubu | Kahvaltı | Öğle | Akşam | Toplam
----------|----------|------|-------|-------
Yararlanıcı| 5       | 5    | 5     | 5

TOPLAM: 17 kişi
`;

console.log('=== GERÇEK TABLO FORMATI TESTİ ===\n');
console.log('Metin:\n', realTableText);

const result = TurkishContextAnalyzer.analyzeParagraph(realTableText);

console.log('\n📊 Analiz Sonucu:');
console.log('  Personel sayıları:', result.personnelNumbers);
console.log('  Hizmet alan sayıları:', result.recipientNumbers);
console.log('  Belirsiz sayılar:', result.ambiguousNumbers);

console.log('\n✅ Beklenen: recipientNumbers içinde 6, 6, 5 veya 17 sayılarından en az biri');

const has17 = result.recipientNumbers.includes(17);
const has6 = result.recipientNumbers.includes(6);
const has5 = result.recipientNumbers.includes(5);

if (has17) {
  console.log('✅ BAŞARILI: 17 sayısı yakalandı (TOPLAM)');
} else if (has6 || has5) {
  console.log('⚠️ KISMI BAŞARILI: Tablo içindeki sayılar yakalandı ama toplam hesaplanmadı');
  console.log('   AI toplamayı yapabilir: 6 + 6 + 5 = 17');
} else {
  console.log('❌ BAŞARISIZ: Hiçbir sayı yakalanmadı');
}
