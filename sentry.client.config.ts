import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

  // Session Replay
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Debug mode (only in development)
  debug: false,

  // Filter out common noise
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "chrome-extension",
    "moz-extension",
    // Network errors
    "NetworkError",
    "Failed to fetch",
    "AbortError",
  ],

  // Enhanced context
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DEV_MODE) {
      return null;
    }

    // Add custom context
    if (event.exception) {
      console.error("Sentry captured error:", hint.originalException || hint.syntheticException);
    }

    return event;
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
