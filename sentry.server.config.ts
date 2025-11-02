import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Debug mode
  debug: false,

  // Filter out common noise
  ignoreErrors: [
    // Network timeouts
    "AbortError",
    "timeout",
    // Expected API errors
    "Claude API timeout",
    "Gemini API timeout",
  ],

  // Enhanced context
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DEV_MODE) {
      return null;
    }

    // Add server context
    if (event.exception) {
      console.error("Sentry captured server error:", hint.originalException || hint.syntheticException);
    }

    // Add custom tags for better filtering
    event.tags = {
      ...event.tags,
      runtime: "nodejs",
    };

    return event;
  },

  // Capture unhandled rejections
  integrations: [
    Sentry.httpIntegration(),
  ],
});
