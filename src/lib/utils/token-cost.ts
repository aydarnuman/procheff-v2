// ============================================================================
// TOKEN COST CALCULATOR
// Claude ve Gemini token maliyetlerini TL olarak hesaplar
// ============================================================================

/**
 * Token fiyatları (USD per 1M token)
 * Kaynak: Anthropic & Google AI pricing (Kasım 2025)
 */
export const TOKEN_COSTS = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    input: 3.00 / 1_000_000,  // $3.00 per 1M input tokens
    output: 15.00 / 1_000_000, // $15.00 per 1M output tokens
    cached: 0.30 / 1_000_000,  // $0.30 per 1M cached tokens (prompt caching)
  },
  gemini: {
    model: 'gemini-2.0-flash-exp',
    input: 0.075 / 1_000_000,  // $0.075 per 1M input tokens (200x ucuz!)
    output: 0.30 / 1_000_000,  // $0.30 per 1M output tokens
  },
} as const;

/**
 * USD/TRY kuru (güncel)
 * TODO: API'den çekilebilir (tcmb.gov.tr)
 */
export const USD_TO_TRY = 34.50;

/**
 * Token maliyetini TL olarak hesapla
 */
export function calculateTokenCost(
  tokens: number,
  model: 'claude' | 'gemini',
  type: 'input' | 'output' | 'cached' = 'input'
): number {
  let costPerToken = 0;
  
  if (model === 'claude') {
    const claudeCosts = TOKEN_COSTS.claude;
    costPerToken = type === 'input' ? claudeCosts.input 
                 : type === 'output' ? claudeCosts.output 
                 : claudeCosts.cached;
  } else {
    const geminiCosts = TOKEN_COSTS.gemini;
    costPerToken = type === 'input' ? geminiCosts.input 
                 : type === 'output' ? geminiCosts.output 
                 : 0; // Gemini has no cached pricing
  }
  
  if (!costPerToken) return 0;

  const usdCost = tokens * costPerToken;
  const tryCost = usdCost * USD_TO_TRY;
  
  return tryCost;
}

/**
 * Token kullanımını formatlı string olarak döndür
 */
export function formatTokenCost(costTRY: number): string {
  if (costTRY < 0.01) return '< ₺0.01';
  if (costTRY < 1) return `₺${costTRY.toFixed(2)}`;
  return `₺${costTRY.toFixed(2)}`;
}

/**
 * Token sayısını formatla (1,000 → 1K, 1,000,000 → 1M)
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) return tokens.toString();
  if (tokens < 1_000_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/**
 * Tam maliyet raporu oluştur
 */
export function generateCostReport(usage: {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  model: 'claude' | 'gemini';
}) {
  const inputCost = calculateTokenCost(usage.inputTokens, usage.model, 'input');
  const outputCost = calculateTokenCost(usage.outputTokens, usage.model, 'output');
  const cachedCost = usage.cachedTokens 
    ? calculateTokenCost(usage.cachedTokens, usage.model, 'cached')
    : 0;

  const totalCost = inputCost + outputCost + cachedCost;

  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedTokens: usage.cachedTokens || 0,
    totalTokens: usage.inputTokens + usage.outputTokens + (usage.cachedTokens || 0),
    inputCost,
    outputCost,
    cachedCost,
    totalCost,
    formatted: {
      inputTokens: formatTokenCount(usage.inputTokens),
      outputTokens: formatTokenCount(usage.outputTokens),
      cachedTokens: formatTokenCount(usage.cachedTokens || 0),
      totalTokens: formatTokenCount(usage.inputTokens + usage.outputTokens + (usage.cachedTokens || 0)),
      inputCost: formatTokenCost(inputCost),
      outputCost: formatTokenCost(outputCost),
      cachedCost: formatTokenCost(cachedCost),
      totalCost: formatTokenCost(totalCost),
    },
  };
}
