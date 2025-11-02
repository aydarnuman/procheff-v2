import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1,

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Debug mode
  debug: false,

  // Enhanced context
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DEV_MODE) {
      return null;
    }

    // Add edge runtime tag
    event.tags = {
      ...event.tags,
      runtime: "edge",
    };

    return event;
  },
});
