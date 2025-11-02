import { NextRequest, NextResponse } from "next/server";
import { GeminiExtractionProvider } from "@/lib/ai/gemini-extraction-provider";

/**
 * Budget Validation with Real-Time Market Data
 *
 * Uses Gemini's web search to:
 * - Fetch current market prices from Turkish suppliers
 * - Validate budget realism
 * - Calculate profit margins
 * - Identify cost risks
 */
export async function POST(request: NextRequest) {
  try {
    console.log("=== BUDGET VALIDATION STARTED ===");

    const body = await request.json();
    const { budget, persons, meals, days } = body;

    // Validate input
    if (!budget || !persons || !meals || !days) {
      return NextResponse.json(
        {
          success: false,
          error: "Eksik parametreler: budget, persons, meals, days gerekli",
        },
        { status: 400 }
      );
    }

    console.log(`💰 Budget: ${budget.toLocaleString()} TL`);
    console.log(`👥 Persons: ${persons}`);
    console.log(`🍽️  Meals/day: ${meals}`);
    console.log(`📅 Days: ${days}`);

    const budgetPerMeal = budget / (persons * meals * days);
    console.log(`💵 Budget per meal: ${budgetPerMeal.toFixed(2)} TL`);

    // Use Gemini with web search
    const gemini = new GeminiExtractionProvider();

    console.log("🔍 Fetching real-time market data...");
    const startTime = Date.now();

    const validation = await gemini.validateBudgetWithMarketData(
      budget,
      persons,
      meals,
      days
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ Validation completed in ${processingTime}ms`);

    // Add extra insights
    const totalMeals = persons * meals * days;
    const profitPerMeal = budgetPerMeal - validation.estimatedCostPerMeal;
    const totalProfit = profitPerMeal * totalMeals;

    const enhancedValidation = {
      ...validation,
      budgetBreakdown: {
        totalBudget: budget,
        totalMeals,
        budgetPerMeal,
        estimatedCostPerMeal: validation.estimatedCostPerMeal,
        profitPerMeal,
        totalProfit,
        profitMarginPercent: validation.profitMargin,
      },
      timeline: {
        totalDays: days,
        personsPerDay: persons,
        mealsPerDay: meals,
        dailyCost: validation.estimatedCostPerMeal * persons * meals,
        dailyRevenue: budgetPerMeal * persons * meals,
        dailyProfit: profitPerMeal * persons * meals,
      },
      processingMetadata: {
        processingTime,
        dataSource: "gemini-web-search",
        timestamp: new Date().toISOString(),
      },
    };

    console.log("\n=== VALIDATION RESULTS ===");
    console.log(`✅ Realistic: ${validation.isRealistic ? "YES" : "NO"}`);
    console.log(`💰 Profit Margin: ${validation.profitMargin}%`);
    console.log(`💵 Total Profit: ${totalProfit.toLocaleString()} TL`);
    console.log(`📋 Recommendation: ${validation.recommendation}`);

    if (validation.risks && validation.risks.length > 0) {
      console.log(`⚠️  Risks:`);
      validation.risks.forEach((risk: string) => {
        console.log(`   - ${risk}`);
      });
    }

    return NextResponse.json({
      success: true,
      data: enhancedValidation,
      metadata: {
        processing_time: processingTime,
        data_freshness: "real-time",
        provider: "gemini-web-search",
      },
    });
  } catch (error) {
    console.error("=== BUDGET VALIDATION ERROR ===");
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Doğrulama hatası",
      },
      { status: 500 }
    );
  }
}
