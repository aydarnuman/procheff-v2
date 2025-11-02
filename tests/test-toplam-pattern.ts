import { TurkishContextAnalyzer } from '../src/lib/utils/turkish-context-analyzer';

console.log('=== TOPLAM PATTERN TESTİ ===\n');

const tests = [
  "TOPLAM: 17 kişi",
  "Toplam: 17",
  "TOPLAM 17",
  "Toplam | 17",
  "toplam 17 kişi",
  "Genel Toplam: 17 kişiye hizmet verilecektir",
];

tests.forEach(text => {
  const result = TurkishContextAnalyzer.analyzeParagraph(text);
  console.log(`\n"${text}"`);
  console.log(`  → Hizmet Alan: ${JSON.stringify(result.recipientNumbers)}`);
  console.log(`  → Belirsiz: ${JSON.stringify(result.ambiguousNumbers)}`);
  console.log(`  → ${result.recipientNumbers.includes(17) ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}`);
});
