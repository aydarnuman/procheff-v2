/**
 * AI Debug Utility
 *
 * Global fetch interceptor for debugging AI API calls
 * Logs request/response details when AI_DEBUG=true
 */

const isDebugMode = () => {
  if (typeof window === 'undefined') {
    return process.env.AI_DEBUG === 'true';
  }
  return process.env.NEXT_PUBLIC_AI_DEBUG === 'true';
};

interface FetchLog {
  url: string;
  method: string;
  status?: number;
  duration?: number;
  requestBody?: any;
  responseBody?: any;
  error?: string;
}

/**
 * Initialize AI debug mode - Override global fetch
 */
export function initAIDebug() {
  if (!isDebugMode()) return;

  if (typeof window === 'undefined') {
    console.log('🔍 [AI-DEBUG] Server-side debugging enabled');
    return;
  }

  console.log('🔍 [AI-DEBUG] Client-side debugging enabled');

  const originalFetch = window.fetch;

  window.fetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
    const [resource, config] = args;
    const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : resource.toString());

    // Only log AI-related endpoints
    if (!url.includes('/api/ai/') && !url.includes('anthropic.com') && !url.includes('googleapis.com')) {
      return originalFetch.apply(this, args);
    }

    const startTime = Date.now();
    const log: FetchLog = {
      url,
      method: config?.method || 'GET',
    };

    // Log request
    if (config?.body) {
      try {
        log.requestBody = typeof config.body === 'string'
          ? JSON.parse(config.body)
          : config.body;
        console.log(`📤 [AI-REQ] ${log.method} ${url}`, {
          headers: config.headers,
          body: log.requestBody,
        });
      } catch (e) {
        console.log(`📤 [AI-REQ] ${log.method} ${url}`, {
          body: config.body,
        });
      }
    } else {
      console.log(`📤 [AI-REQ] ${log.method} ${url}`);
    }

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - startTime;

      log.status = response.status;
      log.duration = duration;

      // Clone response to read body without consuming it
      const clonedResponse = response.clone();

      try {
        const responseData = await clonedResponse.json();
        log.responseBody = responseData;

        console.log(`📥 [AI-RES] ${log.status} ${url} (${duration}ms)`, {
          status: log.status,
          data: responseData,
          duration: `${duration}ms`,
        });
      } catch (e) {
        // Response is not JSON
        console.log(`📥 [AI-RES] ${log.status} ${url} (${duration}ms)`, {
          status: log.status,
          duration: `${duration}ms`,
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error = error instanceof Error ? error.message : String(error);
      log.duration = duration;

      console.error(`❌ [AI-ERR] ${url} (${duration}ms)`, {
        error: log.error,
        duration: `${duration}ms`,
      });

      throw error;
    }
  };
}

/**
 * Server-side logging helper for API routes
 */
export function logAIRequest(endpoint: string, data: any) {
  if (!isDebugMode()) return;
  console.log(`📤 [AI-REQ] ${endpoint}`, JSON.stringify(data, null, 2));
}

export function logAIResponse(endpoint: string, data: any, duration?: number) {
  if (!isDebugMode()) return;
  const durationStr = duration ? ` (${duration}ms)` : '';
  console.log(`📥 [AI-RES] ${endpoint}${durationStr}`, JSON.stringify(data, null, 2));
}

export function logAIError(endpoint: string, error: any, duration?: number) {
  if (!isDebugMode()) return;
  const durationStr = duration ? ` (${duration}ms)` : '';
  console.error(`❌ [AI-ERR] ${endpoint}${durationStr}`, error);
}

// Auto-initialize on import (client-side only)
if (typeof window !== 'undefined') {
  initAIDebug();
}
