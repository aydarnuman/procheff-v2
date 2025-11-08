/**
 * AI Status Health Check Endpoint
 * Fixes: 404 errors in console (/ai-status)
 */

export async function GET() {
  return Response.json({
    status: "ok",
    providers: {
      claude: process.env.ANTHROPIC_API_KEY ? "configured" : "missing",
      gemini: process.env.GOOGLE_API_KEY ? "configured" : "missing",
      ocr: "enabled",
    },
    time: new Date().toISOString(),
  });
}
