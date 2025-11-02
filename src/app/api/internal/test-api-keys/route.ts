import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Sadece development ortamında çalışsın
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Not available in production" },
        { status: 403 }
      );
    }

    const results = {
      anthropic: {
        valid: false,
        error: null as string | null,
        model: null as string | null,
      },
      openai: {
        valid: false,
        error: null as string | null,
        model: null as string | null,
      },
      google: {
        valid: false,
        error: null as string | null,
        model: null as string | null,
      },
      ocrSpace: {
        valid: false,
        error: null as string | null,
        model: null as string | null,
      },
    };

    // Test Anthropic Claude API
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && anthropicKey.trim() !== "") {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 10,
            messages: [{ role: "user", content: "Test" }],
          }),
        });

        if (response.ok) {
          results.anthropic.valid = true;
          results.anthropic.model = "claude-sonnet-4-20250514";
        } else {
          const errorData = await response.text();
          results.anthropic.error = `API Error: ${response.status} - ${errorData}`;
        }
      } catch (error) {
        results.anthropic.error = `Network Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
      }
    } else {
      results.anthropic.error = "API key not found in environment";
    }

    // Test OpenAI API
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey.trim() !== "") {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
        });

        if (response.ok) {
          results.openai.valid = true;
          results.openai.model = "gpt-3.5-turbo";
        } else {
          const errorData = await response.text();
          results.openai.error = `API Error: ${response.status} - ${errorData}`;
        }
      } catch (error) {
        results.openai.error = `Network Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
      }
    } else {
      results.openai.error = "API key not found in environment";
    }

    // Test Google AI API
    const googleKey = process.env.GOOGLE_API_KEY;
    if (googleKey && googleKey.trim() !== "") {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`
        );

        if (response.ok) {
          results.google.valid = true;
          results.google.model = "gemini-pro";
        } else {
          const errorData = await response.text();
          results.google.error = `API Error: ${response.status} - ${errorData}`;
        }
      } catch (error) {
        results.google.error = `Network Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
      }
    } else {
      results.google.error = "API key not found in environment";
    }

    // Test OCR Space API
    const ocrKey = process.env.OCR_SPACE_API_KEY;
    if (ocrKey && ocrKey.trim() !== "") {
      try {
        // OCR Space API'nin basit bir test çağrısı
        const testResponse = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: {
            apikey: ocrKey,
          },
          body: new FormData(), // Boş form - sadece API key test için
        });

        // OCR Space 400 döner ama bu API key'in geçerli olduğunu gösterir
        if (testResponse.status === 400) {
          results.ocrSpace.valid = true;
          results.ocrSpace.model = "ocr-space-api";
        } else if (testResponse.status === 401) {
          results.ocrSpace.error = "Invalid API key";
        } else {
          results.ocrSpace.valid = true;
          results.ocrSpace.model = "ocr-space-api";
        }
      } catch (error) {
        results.ocrSpace.error = `Network Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
      }
    } else {
      results.ocrSpace.error = "API key not found in environment";
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("API test error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
