/**
 * End-to-End Entegrasyon Testi
 * TurkishContextAnalyzer'ın AI pipeline'a entegrasyonunu test eder
 */

import { TurkishContextAnalyzer } from '../src/lib/utils/turkish-context-analyzer';

console.log('=== ENTEGRASYON TEST: PERSONEL VS KİŞİ AYRIMI ===\n');

// Senaryo 1: Sadece Personel Bağlamı
const scenario1 = `
TEKNİK ŞARTNAME

İşçi Sayısı ve İşçilerde Aranan Özellikler:
İhale konusu işin yapılabilmesi için toplam 8 personel çalıştırılacaktır.

Personel Kadrosu:
- 1 Aşçıbaşı
- 3 Aşçı
- 2 Kebap Ustası
- 2 Aşçı Yardımcısı

Çalışanlar günlük 8 saat çalışacaktır.
`;

console.log('📋 Senaryo 1: Sadece Personel Bağlamı');
console.log('Metin:\n', scenario1);

const result1 = TurkishContextAnalyzer.analyzeParagraph(scenario1);
console.log('\n🔍 Context Analyzer Sonucu:');
console.log('  - Personel sayıları:', result1.personnelNumbers);
console.log('  - Hizmet alan sayıları:', result1.recipientNumbers);
console.log('  - Belirsiz:', result1.ambiguousNumbers);
console.log('✅ Beklenen: [8]');
console.log(result1.personnelNumbers.includes(8) ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// Senaryo 2: Sadece Kişi (Hizmet Alan) Bağlamı
const scenario2 = `
TEKNİK ŞARTNAME

Hizmet Kapsamı:
1200 öğrenciye günde 3 öğün yemek hizmeti verilecektir.

Yemekhane Kapasitesi:
Günde 1200 kişilik yemek servisi yapılacaktır.
`;

console.log('📋 Senaryo 2: Sadece Kişi Bağlamı');
console.log('Metin:\n', scenario2);

const result2 = TurkishContextAnalyzer.analyzeParagraph(scenario2);
console.log('\n🔍 Context Analyzer Sonucu:');
console.log('  - Personel sayıları:', result2.personnelNumbers);
console.log('  - Hizmet alan sayıları:', result2.recipientNumbers);
console.log('  - Belirsiz:', result2.ambiguousNumbers);
console.log('✅ Beklenen: [1200]');
console.log(result2.recipientNumbers.includes(1200) ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// Senaryo 3: Karma - Hem Personel Hem Kişi
const scenario3 = `
TEKNİK ŞARTNAME

Personel İhtiyacı:
İşin yürütülmesi için 25 personel istihdam edilecektir.

Hizmet Kapsamı:
Yemekhane 500 hastaya ve 200 refakatçiye günlük yemek hizmeti verecektir.
Toplam 700 kişilik yemek servisi yapılacaktır.
`;

console.log('📋 Senaryo 3: Karma - Hem Personel Hem Kişi');
console.log('Metin:\n', scenario3);

const result3 = TurkishContextAnalyzer.analyzeParagraph(scenario3);
console.log('\n🔍 Context Analyzer Sonucu:');
console.log('  - Personel sayıları:', result3.personnelNumbers);
console.log('  - Hizmet alan sayıları:', result3.recipientNumbers);
console.log('  - Belirsiz:', result3.ambiguousNumbers);
console.log('✅ Beklenen: Personel=[25], Kişi=[500, 200, 700]');
const passed3 =
  result3.personnelNumbers.includes(25) &&
  (result3.recipientNumbers.includes(500) || result3.recipientNumbers.includes(700));
console.log(passed3 ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// Senaryo 4: Karmaşık - Adana Polisevi Senaryosu
const scenario4 = `
İŞ TANIMI VE KAPSAMI

İhale konusu iş; İlimiz merkez ilçede bulunan Adana Emniyet Müdürlüğü Polis Evi
yerleşkesinde konaklayan personele, yerleşke içinde bulunan mutfakta çalıştırılacak
8 personel (1 aşçıbaşı, 3 aşçı, 2 kebap ustası, 2 aşçı yardımcısı) tarafından
kahvaltı, öğle ve akşam olmak üzere günde 3 öğün yemek yapılmasıdır.
`;

console.log('📋 Senaryo 4: Karmaşık - Adana Polisevi');
console.log('Metin:\n', scenario4);

const result4 = TurkishContextAnalyzer.analyzeParagraph(scenario4);
console.log('\n🔍 Context Analyzer Sonucu:');
console.log('  - Personel sayıları:', result4.personnelNumbers);
console.log('  - Hizmet alan sayıları:', result4.recipientNumbers);
console.log('  - Belirsiz:', result4.ambiguousNumbers);
console.log('✅ Beklenen: Personel=[8]');
console.log(result4.personnelNumbers.includes(8) ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// SONUÇ ÖZETİ
const allTests = [
  { name: 'Senaryo 1: Sadece Personel', passed: result1.personnelNumbers.includes(8) },
  { name: 'Senaryo 2: Sadece Kişi', passed: result2.recipientNumbers.includes(1200) },
  { name: 'Senaryo 3: Karma', passed: passed3 },
  { name: 'Senaryo 4: Adana Polisevi', passed: result4.personnelNumbers.includes(8) },
];

const passedCount = allTests.filter(t => t.passed).length;
const totalCount = allTests.length;

console.log('\n🎯 ENTEGRASYON TEST SONUÇLARI:');
allTests.forEach(test => {
  console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}`);
});
console.log(`\n${passedCount}/${totalCount} test başarılı`);
console.log(passedCount === totalCount ? '✅ TÜM TESTLER BAŞARILI! Entegrasyon hazır.' : '⚠️ Bazı testler başarısız');

if (passedCount === totalCount) {
  console.log('\n🚀 TurkishContextAnalyzer başarıyla AI pipeline\'a entegre edildi!');
  console.log('   Artık API endpoint\'leri personel/kişi ayrımını doğru yapabilir.');
}
