/**
 * Environment Variable Guard
 *
 * Server başlarken kritik environment variable'ları kontrol eder
 * ve maskelenmiş şekilde log'a yazdırır.
 *
 * Bu sayede environment karışıklıklarını hızlıca tespit ederiz.
 */

interface EnvCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * API key'i maskele (ilk 7 ve son 4 karakter hariç)
 */
function maskApiKey(key: string | undefined): string {
  if (!key) return '❌ MISSING';
  if (key.length < 20) return '❌ TOO_SHORT';

  const first = key.substring(0, 7);
  const last = key.substring(key.length - 4);
  const masked = '*'.repeat(Math.min(key.length - 11, 40));

  return `${first}${masked}${last}`;
}

/**
 * Tüm kritik environment variable'ları kontrol et
 */
export function checkEnvironment(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n='.repeat(70));
  console.log('🔒 ENVIRONMENT GUARD - Kritik Değişkenler');
  console.log('='.repeat(70));

  // 1. ANTHROPIC API KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  console.log(`\n📌 ANTHROPIC_API_KEY: ${maskApiKey(anthropicKey)}`);
  console.log(`   Length: ${anthropicKey?.length || 0} chars`);

  if (!anthropicKey) {
    errors.push('ANTHROPIC_API_KEY is missing!');
  } else if (anthropicKey.length < 50) {
    errors.push('ANTHROPIC_API_KEY too short (likely invalid)');
  }

  // 2. AI MODEL
  const aiModel = process.env.DEFAULT_AI_MODEL;
  console.log(`\n📌 DEFAULT_AI_MODEL: ${aiModel || '❌ NOT SET'}`);

  const validModels = [
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514',
    'claude-opus-4-1-20250805',
    'claude-opus-4-20250514',
    'claude-haiku-4-5-20251001',
  ];

  if (!aiModel) {
    warnings.push('DEFAULT_AI_MODEL not set, will use fallback');
  } else if (!validModels.includes(aiModel)) {
    warnings.push(`DEFAULT_AI_MODEL "${aiModel}" not in valid list: ${validModels.join(', ')}`);
  }

  // 3. DATABASE
  console.log(`\n📌 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

  // 4. İHALEBUL CREDENTIALS
  const ihaleUsername = process.env.IHALEBUL_USERNAME;
  const ihalePassword = process.env.IHALEBUL_PASSWORD;
  console.log(`\n📌 IHALEBUL_USERNAME: ${ihaleUsername ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   IHALEBUL_PASSWORD: ${ihalePassword ? '✅ SET' : '❌ MISSING'}`);

  if (!ihaleUsername || !ihalePassword) {
    warnings.push('İhalebul credentials missing - scraping will fail');
  }

  // 5. GEMINI (Optional)
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log(`\n📌 GEMINI_API_KEY: ${maskApiKey(geminiKey)}`);

  if (!geminiKey) {
    warnings.push('GEMINI_API_KEY missing (price search will fail)');
  }

  // SUMMARY
  console.log('\n' + '='.repeat(70));

  if (errors.length > 0) {
    console.error('❌ ERRORS:');
    errors.forEach(err => console.error(`   - ${err}`));
  }

  if (warnings.length > 0) {
    console.warn('⚠️  WARNINGS:');
    warnings.forEach(warn => console.warn(`   - ${warn}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All environment variables are valid!');
  }

  console.log('='.repeat(70) + '\n');

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Guard'ı başlat (server startup'ta otomatik çalışır)
 */
if (typeof window === 'undefined') {
  // Sadece server-side'da çalıştır
  checkEnvironment();
}
