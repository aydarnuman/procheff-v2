import { NextResponse } from "next/server";

const MODELS_TO_TEST = [
  // Latest models
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-1-20250805",

  // Legacy models
  "claude-sonnet-4-20250514",
  "claude-sonnet-3-7-20250219",
  "claude-opus-4-20250514",
  "claude-haiku-3-5-20241022",

  // Alias versions
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-1",
];

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not found" },
      { status: 500 }
    );
  }

  const results = [];

  for (const model of MODELS_TO_TEST) {
    try {
      console.log(`Testing model: ${model}...`);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: "Merhaba, bu bir test mesajıdır. Sadece 'OK' cevabı ver.",
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          model,
          status: "✅ ÇALIŞIYOR",
          response: data.content[0].text,
          statusCode: response.status,
        });
        console.log(`✅ ${model} - SUCCESS`);
      } else {
        const errorData = await response.json();
        results.push({
          model,
          status: "❌ HATA",
          error: errorData.error?.message || errorData.error || "Unknown error",
          statusCode: response.status,
        });
        console.log(`❌ ${model} - FAILED: ${response.status}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        model,
        status: "❌ HATA",
        error: errorMessage,
        statusCode: 0,
      });
      console.log(`❌ ${model} - ERROR: ${errorMessage}`);
    }

    // Rate limiting - wait 500ms between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return NextResponse.json({
    success: true,
    tested: results.length,
    results,
    workingModels: results.filter((r) => r.status === "✅ ÇALIŞIYOR"),
    failedModels: results.filter((r) => r.status === "❌ HATA"),
  });
}
