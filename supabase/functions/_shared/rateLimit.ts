/**
 * Rate Limiting for Edge Functions
 *
 * This module provides simple in-memory rate limiting for Edge Functions.
 * For production with multiple instances, use a distributed solution like Upstash Redis.
 *
 * @module rateLimit
 */

// ============================================================================
// TYPES
// ============================================================================

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

const requestCounts = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (entry.resetTime < now) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// RATE LIMIT PRESETS
// ============================================================================

export const RATE_LIMITS = {
  // Very strict: 5 requests per minute
  STRICT: {
    windowMs: 60 * 1000,
    maxRequests: 5,
  },

  // Standard: 20 requests per minute
  STANDARD: {
    windowMs: 60 * 1000,
    maxRequests: 20,
  },

  // Relaxed: 60 requests per minute
  RELAXED: {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },

  // Authentication: 5 failed attempts per 15 minutes
  AUTH: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  },

  // File uploads: 10 per hour
  UPLOAD: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
  },

  // Email sending: 3 per hour
  EMAIL: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
  },
} as const;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Checks if a request should be rate limited
 *
 * @param identifier - Unique identifier (usually IP address or user ID)
 * @param config - Rate limit configuration
 * @returns Object with success status and limit info
 *
 * @example
 * const result = checkRateLimit(ipAddress, RATE_LIMITS.STANDARD);
 * if (!result.success) {
 *   return new Response(
 *     JSON.stringify({ error: 'Rate limit exceeded' }),
 *     {
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': result.limit.toString(),
 *         'X-RateLimit-Remaining': result.remaining.toString(),
 *         'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
 *         'Retry-After': Math.ceil(result.retryAfter / 1000).toString()
 *       }
 *     }
 *   );
 * }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.STANDARD
): {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
} {
  const now = Date.now();
  const key = identifier;

  let entry = requestCounts.get(key);

  // Create new entry if doesn't exist or if window has expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    requestCounts.set(key, entry);
  }

  // Increment counter
  entry.count++;

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const retryAfter = entry.resetTime - now;

  return {
    success: entry.count <= config.maxRequests,
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
    retryAfter,
  };
}

/**
 * Resets rate limit for a specific identifier
 * Useful for manual overrides or testing
 *
 * @param identifier - Unique identifier to reset
 */
export function resetRateLimit(identifier: string): void {
  requestCounts.delete(identifier);
}

/**
 * Gets current rate limit status without incrementing counter
 *
 * @param identifier - Unique identifier
 * @param config - Rate limit configuration
 * @returns Current status
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.STANDARD
): {
  count: number;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const entry = requestCounts.get(identifier);

  if (!entry || entry.resetTime < now) {
    return {
      count: 0,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  return {
    count: entry.count,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

// ============================================================================
// IDENTIFIER EXTRACTION
// ============================================================================

/**
 * Extracts IP address from request headers
 * Handles various proxy headers
 *
 * @param request - The incoming request
 * @returns IP address or 'unknown'
 */
export function getIPAddress(request: Request): string {
  // Check various headers for IP address (in order of preference)
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
    'x-cluster-client-ip',
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  return 'unknown';
}

/**
 * Creates a composite identifier from IP and user ID
 * Useful for per-user rate limiting
 *
 * @param ipAddress - IP address
 * @param userId - User ID (optional)
 * @returns Composite identifier
 */
export function createIdentifier(ipAddress: string, userId?: string): string {
  if (userId) {
    return `${ipAddress}:${userId}`;
  }
  return ipAddress;
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Creates a standardized rate limit exceeded response
 *
 * @param result - Rate limit check result
 * @param message - Optional custom error message
 * @returns Response object with appropriate headers
 */
export function createRateLimitResponse(
  result: ReturnType<typeof checkRateLimit>,
  message: string = 'Too many requests. Please try again later.'
): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };

  return new Response(
    JSON.stringify({
      error: message,
      retryAfter: Math.ceil(result.retryAfter / 1000),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        'Retry-After': Math.ceil(result.retryAfter / 1000).toString(),
      },
    }
  );
}

/**
 * Adds rate limit headers to a successful response
 *
 * @param response - Original response
 * @param result - Rate limit check result
 * @returns Response with rate limit headers added
 */
export function addRateLimitHeaders(
  response: Response,
  result: ReturnType<typeof checkRateLimit>
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ============================================================================
// MIDDLEWARE HELPER
// ============================================================================

/**
 * Creates a rate limiting middleware for Edge Functions
 *
 * @param config - Rate limit configuration
 * @param getIdentifier - Function to extract identifier from request
 * @returns Middleware function
 *
 * @example
 * const rateLimitMiddleware = createRateLimitMiddleware(
 *   RATE_LIMITS.STANDARD,
 *   (req) => getIPAddress(req)
 * );
 *
 * Deno.serve(async (req) => {
 *   const rateLimitResult = rateLimitMiddleware(req);
 *   if (!rateLimitResult.success) {
 *     return createRateLimitResponse(rateLimitResult);
 *   }
 *
 *   // Process request...
 * });
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = RATE_LIMITS.STANDARD,
  getIdentifier: (request: Request) => string = getIPAddress
): (request: Request) => ReturnType<typeof checkRateLimit> {
  return (request: Request) => {
    const identifier = getIdentifier(request);
    return checkRateLimit(identifier, config);
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  getIPAddress,
  createIdentifier,
  createRateLimitResponse,
  addRateLimitHeaders,
  createRateLimitMiddleware,
  RATE_LIMITS,
};
