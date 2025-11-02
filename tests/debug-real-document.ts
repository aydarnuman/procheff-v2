/**
 * Gerçek belge ile pattern testi
 */
import { TurkishContextAnalyzer } from '../src/lib/utils/turkish-context-analyzer';

// Gerçek belgeden alınmış örnek paragraflar
const testCases = [
  {
    name: "Öğün Sayıları Tablosu (3 kuruluş)",
    text: `
    ÖĞÜN SAYILARI

    Tablo 1: Huzurevi
    Yaş Grubu | Kahvaltı | Öğle | Akşam | Toplam
    -----------|----------|------|-------|-------
    Yararlanıcı| 6        | 6    | 6     | 6

    Tablo 2: Çocuk Evleri
    Yaş Grubu | Kahvaltı | Öğle | Akşam | Toplam
    -----------|----------|------|-------|-------
    Yararlanıcı| 6        | 6    | 6     | 6

    Tablo 3: Engelli Bakım Merkezi
    Yaş Grubu | Kahvaltı | Öğle | Akşam | Toplam
    -----------|----------|------|-------|-------
    Yararlanıcı| 5        | 5    | 5     | 5
    `
  },
  {
    name: "Personel Kadrosu",
    text: `
    PERSONEL KADROSU
    İşçi Sayısı ve İşçilerde Aranan Özellikler:

    İhale konusu işin yapılabilmesi için toplam 8 personel çalıştırılacaktır.

    1. Aşçıbaşı: 1 kişi
    2. Aşçı: 3 kişi
    3. Kebap Ustası: 2 kişi
    4. Aşçı Yardımcısı: 2 kişi
    `
  },
  {
    name: "Karma: 17 kişi + 8 personel",
    text: `
    HİZMET KAPASITESI:
    Toplam 17 kişiye günde 3 öğün yemek verilecektir.

    PERSONEL:
    8 personel tarafından yemek yapılacaktır.
    `
  },
  {
    name: "Sadece sayı (belirsiz)",
    text: `
    6
    6
    5
    17
    `
  }
];

console.log('=== GERÇEK BELGE PATTERN TESTİ ===\n');

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log('='.repeat(60));
  console.log('Metin:\n', testCase.text.substring(0, 200) + '...');

  const result = TurkishContextAnalyzer.analyzeParagraph(testCase.text);

  console.log('\n📊 Sonuç:');
  console.log('  Personel:', result.personnelNumbers);
  console.log('  Hizmet Alan:', result.recipientNumbers);
  console.log('  Belirsiz:', result.ambiguousNumbers);

  if (result.personnelNumbers.length === 0 && result.recipientNumbers.length === 0 && result.ambiguousNumbers.length === 0) {
    console.log('  ❌ HİÇBİR ŞEYI YAKALAMADI!');
  }
});

console.log('\n\n=== PATTERN DETAYLI TEST ===\n');

// Direkt pattern testleri
const patternTests = [
  { pattern: /(\d+)\s*kişiye/gi, text: '17 kişiye günde 3 öğün', expected: '17' },
  { pattern: /(\d+)\s*personel.*tarafından/gi, text: '8 personel tarafından yemek', expected: '8' },
  { pattern: /Toplam.*?(\d+)/gi, text: 'Toplam 17 kişi', expected: '17' },
  { pattern: /(\d+)\s+kişi/gi, text: '17 kişi', expected: '17' },
];

patternTests.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.pattern}`);
  console.log(`  Metin: "${test.text}"`);
  const match = test.pattern.exec(test.text);
  console.log(`  Beklenen: ${test.expected}`);
  console.log(`  Bulunan: ${match ? match[1] : 'YOK'}`);
  console.log(`  Sonuç: ${match && match[1] === test.expected ? '✅' : '❌'}`);
});
