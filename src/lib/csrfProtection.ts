/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * This module provides CSRF token generation and validation.
 * Works in conjunction with Supabase JWT tokens for defense-in-depth.
 *
 * @module csrfProtection
 */

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generates a CSRF token using Web Crypto API
 * Token is stored in sessionStorage and validated on state-changing requests
 *
 * @returns CSRF token string
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  // Store in sessionStorage (cleared when tab closes)
  sessionStorage.setItem('csrf_token', token);
  sessionStorage.setItem('csrf_token_created', Date.now().toString());

  return token;
}

/**
 * Gets the current CSRF token from sessionStorage
 * Generates a new one if none exists or if expired
 *
 * @returns Current CSRF token
 */
export function getCSRFToken(): string {
  const token = sessionStorage.getItem('csrf_token');
  const created = sessionStorage.getItem('csrf_token_created');

  // Token expires after 1 hour
  const TOKEN_LIFETIME = 60 * 60 * 1000; // 1 hour in milliseconds

  if (!token || !created) {
    return generateCSRFToken();
  }

  const age = Date.now() - parseInt(created, 10);
  if (age > TOKEN_LIFETIME) {
    return generateCSRFToken();
  }

  return token;
}

/**
 * Rotates the CSRF token (generates a new one)
 * Should be called after important state changes (login, logout, etc.)
 */
export function rotateCSRFToken(): string {
  return generateCSRFToken();
}

/**
 * Clears the CSRF token from storage
 * Should be called on logout
 */
export function clearCSRFToken(): void {
  sessionStorage.removeItem('csrf_token');
  sessionStorage.removeItem('csrf_token_created');
}

// ============================================================================
// REQUEST HELPERS
// ============================================================================

/**
 * Adds CSRF token to request headers
 * Use this when making state-changing requests (POST, PUT, DELETE)
 *
 * @param headers - Existing headers object
 * @returns Headers with CSRF token added
 *
 * @example
 * const headers = addCSRFHeader({
 *   'Content-Type': 'application/json',
 *   'Authorization': 'Bearer token'
 * });
 *
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers,
 *   body: JSON.stringify(data)
 * });
 */
export function addCSRFHeader(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    'X-CSRF-Token': getCSRFToken(),
  };
}

/**
 * Validates CSRF token from request
 * This is a CLIENT-SIDE validation for UI consistency
 * SERVER-SIDE validation should happen in Edge Functions
 *
 * @param tokenFromRequest - Token received from request
 * @returns true if token is valid
 */
export function validateCSRFToken(tokenFromRequest: string): boolean {
  const storedToken = sessionStorage.getItem('csrf_token');

  if (!storedToken || !tokenFromRequest) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(storedToken, tokenFromRequest);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Timing-safe string comparison
 * Prevents timing attacks by comparing strings in constant time
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes CSRF protection
 * Should be called when the app starts
 *
 * @example
 * // In main.tsx or App.tsx
 * import { initializeCSRFProtection } from './lib/csrfProtection';
 * initializeCSRFProtection();
 */
export function initializeCSRFProtection(): void {
  // Generate initial token if none exists
  if (!sessionStorage.getItem('csrf_token')) {
    generateCSRFToken();
  }

  // CSRF protection initialized - using session storage
}

// ============================================================================
// SUPABASE INTEGRATION
// ============================================================================

/**
 * Creates a fetch wrapper that automatically includes CSRF tokens
 * Use this instead of native fetch for state-changing requests
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Promise with response
 *
 * @example
 * import { fetchWithCSRF } from './lib/csrfProtection';
 *
 * const response = await fetchWithCSRF('/api/endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify(data)
 * });
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';

  // Only add CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const headers = new Headers(options.headers);
    headers.set('X-CSRF-Token', getCSRFToken());

    options.headers = headers;
  }

  return fetch(url, options);
}

// ============================================================================
// REACT HOOK (Optional)
// ============================================================================

/**
 * Custom React hook for CSRF token management
 * Provides token and rotation function
 *
 * @returns Object with token and rotate function
 *
 * @example
 * function MyComponent() {
 *   const { token, rotateToken } = useCSRFToken();
 *
 *   const handleSubmit = async () => {
 *     await fetch('/api/endpoint', {
 *       method: 'POST',
 *       headers: { 'X-CSRF-Token': token }
 *     });
 *     rotateToken(); // Rotate after important action
 *   };
 * }
 */
export function useCSRFToken() {
  const token = getCSRFToken();

  return {
    token,
    rotateToken: rotateCSRFToken,
    clearToken: clearCSRFToken,
    addToHeaders: addCSRFHeader,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateCSRFToken,
  getCSRFToken,
  rotateCSRFToken,
  clearCSRFToken,
  addCSRFHeader,
  validateCSRFToken,
  initializeCSRFProtection,
  fetchWithCSRF,
  useCSRFToken,
};
