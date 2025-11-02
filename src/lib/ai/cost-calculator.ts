/**
 * AI Model Maliyet Hesaplayıcı
 * Claude ve Gemini model maliyetlerini Türk Lirası cinsinden hesaplar
 */

// USD -> TRY kuru (güncellenebilir)
const USD_TO_TRY = 34.50; // 2025 Ocak tahmini

// Claude Pricing (per 1M tokens) - USD
const CLAUDE_PRICING = {
  'claude-3-5-sonnet-20241022': {
    input: 3.00,   // $3 per 1M input tokens
    output: 15.00, // $15 per 1M output tokens
  },
  'claude-3-5-sonnet-20250929': {
    input: 3.00,
    output: 15.00,
  },
  'claude-3-opus-20240229': {
    input: 15.00,
    output: 75.00,
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
  },
} as const;

// Gemini Pricing (per 1M tokens) - USD
const GEMINI_PRICING = {
  'gemini-1.5-pro': {
    input: 1.25,
    output: 5.00,
  },
  'gemini-1.5-flash': {
    input: 0.075,
    output: 0.30,
  },
  'gemini-pro': {
    input: 0.50,
    output: 1.50,
  },
} as const;

export interface MaliyetDetay {
  inputTokens: number;
  outputTokens: number;
  toplamTokens: number;
  inputMaliyetUSD: number;
  outputMaliyetUSD: number;
  toplamMaliyetUSD: number;
  inputMaliyetTRY: number;
  outputMaliyetTRY: number;
  toplamMaliyetTRY: number;
  model: string;
}

/**
 * Claude model maliyeti hesapla
 */
export const hesaplaClaudeMaliyeti = (
  model: string,
  inputTokens: number,
  outputTokens: number
): MaliyetDetay => {
  const pricing = CLAUDE_PRICING[model as keyof typeof CLAUDE_PRICING] || CLAUDE_PRICING['claude-3-5-sonnet-20241022'];

  // USD cinsinden maliyet (per 1M tokens)
  const inputMaliyetUSD = (inputTokens / 1_000_000) * pricing.input;
  const outputMaliyetUSD = (outputTokens / 1_000_000) * pricing.output;
  const toplamMaliyetUSD = inputMaliyetUSD + outputMaliyetUSD;

  // TRY cinsinden maliyet
  const inputMaliyetTRY = inputMaliyetUSD * USD_TO_TRY;
  const outputMaliyetTRY = outputMaliyetUSD * USD_TO_TRY;
  const toplamMaliyetTRY = toplamMaliyetUSD * USD_TO_TRY;

  return {
    inputTokens,
    outputTokens,
    toplamTokens: inputTokens + outputTokens,
    inputMaliyetUSD,
    outputMaliyetUSD,
    toplamMaliyetUSD,
    inputMaliyetTRY,
    outputMaliyetTRY,
    toplamMaliyetTRY,
    model,
  };
};

/**
 * Gemini model maliyeti hesapla
 */
export const hesaplaGeminiMaliyeti = (
  model: string,
  inputTokens: number,
  outputTokens: number
): MaliyetDetay => {
  const pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING] || GEMINI_PRICING['gemini-1.5-flash'];

  const inputMaliyetUSD = (inputTokens / 1_000_000) * pricing.input;
  const outputMaliyetUSD = (outputTokens / 1_000_000) * pricing.output;
  const toplamMaliyetUSD = inputMaliyetUSD + outputMaliyetUSD;

  const inputMaliyetTRY = inputMaliyetUSD * USD_TO_TRY;
  const outputMaliyetTRY = outputMaliyetUSD * USD_TO_TRY;
  const toplamMaliyetTRY = toplamMaliyetUSD * USD_TO_TRY;

  return {
    inputTokens,
    outputTokens,
    toplamTokens: inputTokens + outputTokens,
    inputMaliyetUSD,
    outputMaliyetUSD,
    toplamMaliyetUSD,
    inputMaliyetTRY,
    outputMaliyetTRY,
    toplamMaliyetTRY,
    model,
  };
};

/**
 * Maliyet formatla (human-readable)
 */
export const formatMaliyet = (maliyet: MaliyetDetay): string => {
  return `
╔════════════════════════════════════════════╗
║         AI MALIYET RAPORU                  ║
╠════════════════════════════════════════════╣
║ Model           : ${maliyet.model.padEnd(23)}║
║ Input Tokens    : ${maliyet.inputTokens.toLocaleString().padEnd(23)}║
║ Output Tokens   : ${maliyet.outputTokens.toLocaleString().padEnd(23)}║
║ Toplam Tokens   : ${maliyet.toplamTokens.toLocaleString().padEnd(23)}║
╠════════════════════════════════════════════╣
║ Input Maliyet   : ₺${maliyet.inputMaliyetTRY.toFixed(6).padEnd(21)}║
║ Output Maliyet  : ₺${maliyet.outputMaliyetTRY.toFixed(6).padEnd(21)}║
║ TOPLAM MALIYET  : ₺${maliyet.toplamMaliyetTRY.toFixed(6).padEnd(21)}║
╠════════════════════════════════════════════╣
║ USD Maliyet     : $${maliyet.toplamMaliyetUSD.toFixed(6).padEnd(21)}║
╚════════════════════════════════════════════╝
  `.trim();
};

/**
 * Kısa maliyet formatı (tek satır)
 */
export const formatKisaMaliyet = (maliyet: MaliyetDetay): string => {
  return `₺${maliyet.toplamMaliyetTRY.toFixed(4)} (${maliyet.toplamTokens.toLocaleString()} tokens)`;
};
