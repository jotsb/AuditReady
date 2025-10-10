/**
 * XSS Protection and HTML Sanitization
 *
 * This module provides utilities for sanitizing user input to prevent
 * Cross-Site Scripting (XSS) attacks. Uses DOMPurify for production-grade
 * HTML sanitization.
 *
 * @module sanitizer
 */

import DOMPurify from 'isomorphic-dompurify';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Strict sanitization config - Removes ALL HTML tags
 * Use for: vendor names, addresses, categories, any plain text field
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true, // Keep text content, remove tags
};

/**
 * Rich text sanitization config - Allows basic formatting
 * Use for: notes, descriptions where users might want basic formatting
 */
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

/**
 * Link sanitization config - Allows links with strict validation
 * Use for: fields that might contain URLs
 */
const LINK_CONFIG = {
  ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i, // Only allow https, http, and mailto
};

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitizes text by removing ALL HTML tags
 * This is the most restrictive sanitization - use for most fields
 *
 * @param input - The string to sanitize
 * @returns Sanitized string with no HTML
 *
 * @example
 * sanitizeText('<script>alert("xss")</script>Hello')
 * // Returns: 'Hello'
 *
 * sanitizeText('<img src=x onerror=alert(1)>')
 * // Returns: ''
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const sanitized = DOMPurify.sanitize(input, STRICT_CONFIG);
  return sanitized.trim();
}

/**
 * Sanitizes rich text, allowing basic HTML formatting
 * Use this when users need to format text (e.g., notes field)
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML with only allowed tags
 *
 * @example
 * sanitizeRichText('<p>Hello <b>World</b></p>')
 * // Returns: '<p>Hello <b>World</b></p>'
 *
 * sanitizeRichText('<p>Hello <script>alert(1)</script></p>')
 * // Returns: '<p>Hello </p>'
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const sanitized = DOMPurify.sanitize(html, RICH_TEXT_CONFIG);
  return sanitized.trim();
}

/**
 * Sanitizes text that may contain links
 * Allows <a> tags but validates URLs to prevent javascript: protocols
 *
 * @param html - The HTML string that may contain links
 * @returns Sanitized HTML with only safe links
 *
 * @example
 * sanitizeLinks('Visit <a href="https://example.com">our site</a>')
 * // Returns: 'Visit <a href="https://example.com">our site</a>'
 *
 * sanitizeLinks('Click <a href="javascript:alert(1)">here</a>')
 * // Returns: 'Click <a>here</a>' (href removed)
 */
export function sanitizeLinks(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Add target="_blank" and rel="noopener noreferrer" to all links for security
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  const sanitized = DOMPurify.sanitize(html, LINK_CONFIG);

  // Remove the hook to prevent it from affecting other sanitizations
  DOMPurify.removeAllHooks();

  return sanitized.trim();
}

/**
 * Sanitizes a filename to prevent directory traversal attacks
 * Removes path separators and dangerous characters
 *
 * @param filename - The filename to sanitize
 * @returns Safe filename
 *
 * @example
 * sanitizeFilename('../../../etc/passwd')
 * // Returns: 'etcpasswd'
 *
 * sanitizeFilename('my<>file:name.pdf')
 * // Returns: 'myfilename.pdf'
 */
export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed-file';
  }

  // Remove path separators and dangerous characters
  let sanitized = filename
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove dangerous characters
    .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
    .trim();

  // Ensure filename isn't empty after sanitization
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    sanitized = 'unnamed-file';
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 255 - ext.length);
    sanitized = name + ext;
  }

  return sanitized;
}

/**
 * Sanitizes a URL to ensure it's safe
 * Only allows http(s) and mailto protocols
 *
 * @param url - The URL to sanitize
 * @returns Safe URL or empty string if invalid
 *
 * @example
 * sanitizeUrl('https://example.com')
 * // Returns: 'https://example.com'
 *
 * sanitizeUrl('javascript:alert(1)')
 * // Returns: ''
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();

  // Check for javascript:, data:, vbscript: protocols
  const dangerousProtocols = /^(javascript|data|vbscript):/i;
  if (dangerousProtocols.test(trimmed)) {
    return '';
  }

  // Only allow http(s) and mailto
  const allowedProtocols = /^(https?|mailto):/i;
  if (!allowedProtocols.test(trimmed)) {
    // If no protocol, assume https
    return `https://${trimmed}`;
  }

  return trimmed;
}

// ============================================================================
// SPECIALIZED SANITIZERS FOR COMMON FIELDS
// ============================================================================

/**
 * Sanitizes vendor name (no HTML allowed)
 */
export function sanitizeVendorName(name: string | null | undefined): string {
  return sanitizeText(name);
}

/**
 * Sanitizes vendor address (no HTML allowed)
 */
export function sanitizeVendorAddress(address: string | null | undefined): string {
  return sanitizeText(address);
}

/**
 * Sanitizes category name (no HTML allowed)
 */
export function sanitizeCategoryName(category: string | null | undefined): string {
  return sanitizeText(category);
}

/**
 * Sanitizes receipt notes (allows basic formatting)
 */
export function sanitizeNotes(notes: string | null | undefined): string {
  return sanitizeRichText(notes);
}

/**
 * Sanitizes business name (no HTML allowed)
 */
export function sanitizeBusinessName(name: string | null | undefined): string {
  return sanitizeText(name);
}

/**
 * Sanitizes collection name (no HTML allowed)
 */
export function sanitizeCollectionName(name: string | null | undefined): string {
  return sanitizeText(name);
}

/**
 * Sanitizes collection description (allows basic formatting)
 */
export function sanitizeCollectionDescription(description: string | null | undefined): string {
  return sanitizeRichText(description);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if a string contains potential XSS patterns
 * Useful for logging/monitoring suspicious input
 *
 * @param input - The string to check
 * @returns true if suspicious patterns detected
 */
export function containsXSSPatterns(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /onclick=/i,
    /onmouseover=/i,
    /<iframe/i,
    /eval\(/i,
    /expression\(/i,
    /<object/i,
    /<embed/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitizes an object by applying sanitizeText to all string properties
 * Useful for batch sanitization of form data
 *
 * @param obj - Object to sanitize
 * @returns New object with sanitized strings
 *
 * @example
 * sanitizeObject({ name: '<script>xss</script>', count: 5 })
 * // Returns: { name: '', count: 5 }
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeText(value) as any;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value);
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  sanitizeText,
  sanitizeRichText,
  sanitizeLinks,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeVendorName,
  sanitizeVendorAddress,
  sanitizeCategoryName,
  sanitizeNotes,
  sanitizeBusinessName,
  sanitizeCollectionName,
  sanitizeCollectionDescription,
  containsXSSPatterns,
  sanitizeObject,
};
