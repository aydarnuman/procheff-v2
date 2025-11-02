import { TurkishContextAnalyzer } from '../src/lib/utils/turkish-context-analyzer';

const testText = `çalıştırılacak 8 personel (1 aşçıbaşı, 3 aşçı, 2 kebap ustası, 2 aşçı yardımcısı) tarafından`;

console.log('Test metni:', testText);
console.log('\n=== REGEX TESTLERİ ===\n');

// Test 1: "çalıştırılacak 8 personel" regex'i
const pattern1 = /çalıştırılacak\s+(\d+)\s*personel/gi;
const match1 = pattern1.exec(testText);
console.log('Pattern 1: /çalıştırılacak\\s+(\\d+)\\s*personel/gi');
console.log('Match:', match1);
console.log('---\n');

// Test 2: "8 personel tarafından"
const pattern2 = /(\d+)\s*personel.*tarafından/gi;
const match2 = pattern2.exec(testText);
console.log('Pattern 2: /(\\d+)\\s*personel.*tarafından/gi');
console.log('Match:', match2);
console.log('---\n');

// Full analysis
const result = TurkishContextAnalyzer.analyzeContext(testText);
console.log('Full Analysis:');
console.log(JSON.stringify(result, null, 2));
