import { NextResponse } from "next/server";
import { AILogger } from "@/lib/utils/ai-logger";

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { provider } = body as { provider?: 'claude' | 'gemini' | 'all' };

    // Sadece development ortamında çalışsın
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Not available in production" },
        { status: 403 }
      );
    }

    // Provider-specific test
    if (provider === 'claude') {
      return await testClaudeAPI();
    } else if (provider === 'gemini') {
      return await testGeminiAPI();
    }

    // Test all providers (legacy behavior)
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

/**
 * Test Claude API Key
 */
async function testClaudeAPI() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    AILogger.error("Claude API key not found in environment", { provider: 'claude' });
    return NextResponse.json({
      success: false,
      error: "API key not configured",
    });
  }

  try {
    AILogger.info("Testing Claude API key...", { provider: 'claude' });
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      AILogger.apiKeyStatus('claude', true, `Model: ${process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514"}`);
      
      return NextResponse.json({
        success: true,
        model: process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514",
        usage: data.usage,
      });
    } else {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        errorMessage = errorText;
      }

      AILogger.apiKeyStatus('claude', false, errorMessage);
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    AILogger.apiError('claude', 'NETWORK_ERROR', message);
    
    return NextResponse.json({
      success: false,
      error: `Network error: ${message}`,
    });
  }
}

/**
 * Test Gemini API Key
 */
async function testGeminiAPI() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    AILogger.error("Gemini API key not found in environment", { provider: 'gemini' });
    return NextResponse.json({
      success: false,
      error: "API key not configured",
    });
  }

  try {
    AILogger.info("Testing Gemini API key...", { provider: 'gemini' });
    
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Hi"
                }
              ]
            }
          ]
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      AILogger.apiKeyStatus('gemini', true, `Model: ${model}`);
      
      return NextResponse.json({
        success: true,
        model: model,
        usage: data.usageMetadata,
      });
    } else {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        errorMessage = errorText;
      }

      AILogger.apiKeyStatus('gemini', false, errorMessage);
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    AILogger.apiError('gemini', 'NETWORK_ERROR', message);
    
    return NextResponse.json({
      success: false,
      error: `Network error: ${message}`,
    });
  }
}
