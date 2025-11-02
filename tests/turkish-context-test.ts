/**
 * Türkçe Bağlam Analizi Test Senaryoları
 */

import { TurkishContextAnalyzer } from '../src/lib/utils/turkish-context-analyzer';

console.log('=== TÜRKÇE BAĞLAM ANALİZİ TEST ===\n');

// Test Case 1: ADANA POLİSEVİ (YANLIŞ YORUMLANAN)
console.log('📋 Test 1: Adana Polisevi Senaryosu');
const adanaText = '8 personel (1 aşçıbaşı, 3 aşçı, 2 kebap ustası, 2 aşçı yardımcısı) çalıştırılacaktır.';
const result1 = TurkishContextAnalyzer.analyzeContext(adanaText);
console.log('Metin:', adanaText);
console.log('Sonuç:', result1);
console.log('✅ Beklenen: personnel');
console.log(result1.type === 'personnel' ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// Test Case 2: HİZMET ALICI (DOĞRU)
console.log('📋 Test 2: Yemek Yiyen Kişi');
const recipientText = '500 kişiye günde 3 öğün yemek verilecektir.';
const result2 = TurkishContextAnalyzer.analyzeContext(recipientText);
console.log('Metin:', recipientText);
console.log('Sonuç:', result2);
console.log('✅ Beklenen: meal_recipient');
console.log(result2.type === 'meal_recipient' ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// Test Case 3: KARMA PARAGRAF
console.log('📋 Test 3: Karma Paragraf Analizi');
const mixedParagraph = `
İşçi Sayısı ve İşçilerde Aranan Özellikler:
8 personel çalıştırılacaktır.
Yemekhane 300 öğrenciye hizmet verecektir.
`;
const result3 = TurkishContextAnalyzer.analyzeParagraph(mixedParagraph);
console.log('Paragraf:', mixedParagraph);
console.log('Personel Sayıları:', result3.personnelNumbers);
console.log('Yemek Yiyen Sayıları:', result3.recipientNumbers);
console.log('✅ Beklenen: personnelNumbers=[8], recipientNumbers=[300]');
console.log(
  result3.personnelNumbers.includes(8) && result3.recipientNumbers.includes(300)
    ? '✅ BAŞARILI'
    : '❌ BAŞARISIZ'
);
console.log('---\n');

// Test Case 4: KAPASİTE İFADESİ
console.log('📋 Test 4: Kapasite İfadesi');
const capacityText = '1200 kişilik yemekhane kurulacaktır.';
const result4 = TurkishContextAnalyzer.analyzeContext(capacityText);
console.log('Metin:', capacityText);
console.log('Sonuç:', result4);
console.log('✅ Beklenen: meal_recipient');
console.log(result4.type === 'meal_recipient' ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// Test Case 5: İSTİHDAM İFADESİ
console.log('📋 Test 5: İstihdam İfadesi');
const employmentText = 'Toplam 15 işçi istihdam edilecektir.';
const result5 = TurkishContextAnalyzer.analyzeContext(employmentText);
console.log('Metin:', employmentText);
console.log('Sonuç:', result5);
console.log('✅ Beklenen: personnel');
console.log(result5.type === 'personnel' ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// Test Case 6: BÜYÜK SAYI (Açıkça hizmet alıcı)
console.log('📋 Test 6: Büyük Sayı - Hasta Yemekleri');
const hospitalText = '1500 hastaya ve 600 refakatçiye yemek hizmeti sunulacaktır.';
const result6 = TurkishContextAnalyzer.analyzeContext(hospitalText);
console.log('Metin:', hospitalText);
console.log('Sonuç:', result6);
console.log('✅ Beklenen: meal_recipient');
console.log(result6.type === 'meal_recipient' ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
console.log('---\n');

// SONUÇ ÖZETİ
const tests = [result1, result2, result4, result5, result6];
const expectedTypes: Array<'personnel' | 'meal_recipient'> = [
  'personnel',
  'meal_recipient',
  'meal_recipient',
  'personnel',
  'meal_recipient',
];

const passed = tests.filter((r, i) => r.type === expectedTypes[i]).length;
const total = tests.length;

console.log('\n🎯 GENEL SONUÇ:');
console.log(`${passed}/${total} test başarılı`);
console.log(passed === total ? '✅ TÜM TESTLER BAŞARILI!' : '⚠️ Bazı testler başarısız');
