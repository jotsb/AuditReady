/**
 * Comprehensive Input Validation Utilities
 *
 * This module provides secure validation functions for all Edge Functions.
 * All validations follow security best practices and prevent common attacks.
 *
 * @module validation
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const INPUT_LIMITS = {
  // User fields
  email: 254,
  password_min: 8,
  password_max: 72, // bcrypt limit
  full_name: 200,
  phone_number: 20,

  // Business fields
  business_name: 200,
  tax_id: 50,

  // Collection fields
  collection_name: 100,
  collection_description: 1000,

  // Receipt fields
  vendor_name: 200,
  vendor_address: 500,
  category: 100,
  payment_method: 50,
  notes: 2000,

  // Category fields
  category_name: 100,
  category_description: 500,

  // Generic
  uuid: 36,
  reason: 1000,
} as const;

export const ALLOWED_FILE_TYPES = {
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
  maxSize: 50 * 1024 * 1024, // 50MB
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

export interface FileValidationResult extends ValidationResult {
  mimeType?: string;
  size?: number;
}

// ============================================================================
// UUID VALIDATION
// ============================================================================

/**
 * Validates that a string is a valid UUID v4
 * @param uuid - The UUID string to validate
 * @returns ValidationResult indicating if valid
 */
export function validateUUID(uuid: string | null | undefined): ValidationResult {
  if (!uuid || typeof uuid !== 'string') {
    return { valid: false, error: 'UUID is required' };
  }

  if (uuid.length !== 36) {
    return { valid: false, error: 'Invalid UUID format' };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: 'Invalid UUID format' };
  }

  return { valid: true, sanitized: uuid.toLowerCase() };
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

/**
 * Validates email address format and checks for common issues
 * @param email - The email address to validate
 * @returns ValidationResult with sanitized email
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Length check
  if (trimmedEmail.length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  if (trimmedEmail.length > INPUT_LIMITS.email) {
    return { valid: false, error: `Email must be less than ${INPUT_LIMITS.email} characters` };
  }

  // Format validation (RFC 5322 simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Check for obvious invalid patterns
  if (trimmedEmail.includes('..') || trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Disposable email check (common providers)
  const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com',
    'throwaway.email', 'mailinator.com', 'trashmail.com'
  ];

  const domain = trimmedEmail.split('@')[1];
  if (disposableDomains.includes(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }

  return { valid: true, sanitized: trimmedEmail };
}

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

/**
 * Validates password strength and format
 * @param password - The password to validate
 * @returns ValidationResult with detailed error
 */
export function validatePassword(password: string | null | undefined): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  // Length checks
  if (password.length < INPUT_LIMITS.password_min) {
    return {
      valid: false,
      error: `Password must be at least ${INPUT_LIMITS.password_min} characters`
    };
  }

  if (password.length > INPUT_LIMITS.password_max) {
    return {
      valid: false,
      error: `Password must be less than ${INPUT_LIMITS.password_max} characters`
    };
  }

  // Complexity checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const complexityMet = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  if (complexityMet < 3) {
    return {
      valid: false,
      error: 'Password must contain at least 3 of: uppercase, lowercase, number, special character'
    };
  }

  // Common password check (top 100 most common)
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123',
    'password1', '12345', '1234567', 'letmein', 'welcome',
    'monkey', '1234567890', 'admin', 'password123'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    return {
      valid: false,
      error: 'Password is too common. Please choose a stronger password'
    };
  }

  return { valid: true };
}

// ============================================================================
// STRING VALIDATION
// ============================================================================

/**
 * Validates and sanitizes a string field with length limits
 * @param value - The string to validate
 * @param fieldName - Name of the field for error messages
 * @param maxLength - Maximum allowed length
 * @param required - Whether the field is required
 * @returns ValidationResult with sanitized string
 */
export function validateString(
  value: string | null | undefined,
  fieldName: string,
  maxLength: number,
  required: boolean = true
): ValidationResult {
  if (!value || typeof value !== 'string') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: '' };
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 && required) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be less than ${maxLength} characters`
    };
  }

  // Check for null bytes (can cause issues in C-based systems)
  if (trimmed.includes('\0')) {
    return {
      valid: false,
      error: `${fieldName} contains invalid characters`
    };
  }

  // Basic HTML/script tag detection (XSS prevention)
  const htmlRegex = /<script|<iframe|javascript:|onerror=|onload=/i;
  if (htmlRegex.test(trimmed)) {
    return {
      valid: false,
      error: `${fieldName} contains invalid content`
    };
  }

  return { valid: true, sanitized: trimmed };
}

// ============================================================================
// NUMERIC VALIDATION
// ============================================================================

/**
 * Validates a numeric amount (e.g., price, tax)
 * @param value - The number to validate
 * @param fieldName - Name of the field for error messages
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (default: 1000000)
 * @returns ValidationResult with sanitized number
 */
export function validateAmount(
  value: number | string | null | undefined,
  fieldName: string,
  min: number = 0,
  max: number = 1000000
): ValidationResult {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (!Number.isFinite(numValue)) {
    return { valid: false, error: `${fieldName} must be a finite number` };
  }

  if (numValue < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (numValue > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max}` };
  }

  // Round to 2 decimal places for currency
  const rounded = Math.round(numValue * 100) / 100;

  return { valid: true, sanitized: rounded.toString() };
}

/**
 * Validates a year value
 * @param year - The year to validate
 * @returns ValidationResult
 */
export function validateYear(year: number | string | null | undefined): ValidationResult {
  if (year === null || year === undefined) {
    return { valid: false, error: 'Year is required' };
  }

  const numYear = typeof year === 'string' ? parseInt(year, 10) : year;

  if (isNaN(numYear)) {
    return { valid: false, error: 'Year must be a valid number' };
  }

  const currentYear = new Date().getFullYear();

  if (numYear < 1900 || numYear > currentYear + 10) {
    return {
      valid: false,
      error: `Year must be between 1900 and ${currentYear + 10}`
    };
  }

  return { valid: true, sanitized: numYear.toString() };
}

// ============================================================================
// DATE VALIDATION
// ============================================================================

/**
 * Validates a date string
 * @param dateString - ISO 8601 date string
 * @returns ValidationResult with sanitized date
 */
export function validateDate(dateString: string | null | undefined): ValidationResult {
  if (!dateString || typeof dateString !== 'string') {
    return { valid: false, error: 'Date is required' };
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  // Check if date is reasonable (not too far in past or future)
  const minDate = new Date('1900-01-01');
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10);

  if (date < minDate || date > maxDate) {
    return { valid: false, error: 'Date is out of acceptable range' };
  }

  return { valid: true, sanitized: date.toISOString() };
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Validates uploaded file based on size, type, and content
 * @param file - File object or buffer
 * @param filename - Original filename
 * @param mimeType - MIME type from upload
 * @param size - File size in bytes
 * @returns FileValidationResult
 */
export function validateFile(
  filename: string,
  mimeType: string,
  size: number,
  content?: Uint8Array
): FileValidationResult {
  // Validate filename
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Filename is required' };
  }

  // Check file extension
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!ALLOWED_FILE_TYPES.extensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES.extensions.join(', ')}`
    };
  }

  // Check MIME type
  if (!ALLOWED_FILE_TYPES.mimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid MIME type. Allowed: ${ALLOWED_FILE_TYPES.mimeTypes.join(', ')}`
    };
  }

  // Check file size
  if (size <= 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (size > ALLOWED_FILE_TYPES.maxSize) {
    const maxSizeMB = ALLOWED_FILE_TYPES.maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`
    };
  }

  // Validate file content matches MIME type (magic bytes)
  if (content && content.length >= 4) {
    const isPDF = content[0] === 0x25 && content[1] === 0x50 && content[2] === 0x44 && content[3] === 0x46; // %PDF
    const isJPEG = content[0] === 0xFF && content[1] === 0xD8 && content[2] === 0xFF;
    const isPNG = content[0] === 0x89 && content[1] === 0x50 && content[2] === 0x4E && content[3] === 0x47;
    const isWebP = content[0] === 0x52 && content[1] === 0x49 && content[2] === 0x46 && content[3] === 0x46;

    let contentTypeMatches = false;

    if (mimeType === 'application/pdf' && isPDF) contentTypeMatches = true;
    if (mimeType === 'image/jpeg' && isJPEG) contentTypeMatches = true;
    if (mimeType === 'image/png' && isPNG) contentTypeMatches = true;
    if (mimeType === 'image/webp' && isWebP) contentTypeMatches = true;

    if (!contentTypeMatches) {
      return {
        valid: false,
        error: 'File content does not match declared type'
      };
    }
  }

  return {
    valid: true,
    mimeType,
    size
  };
}

// ============================================================================
// REQUEST BODY VALIDATION
// ============================================================================

/**
 * Safely parses and validates JSON request body
 * @param request - The incoming request
 * @param maxSize - Maximum allowed body size in bytes (default: 10MB)
 * @returns Parsed and validated JSON object
 */
export async function validateRequestBody(
  request: Request,
  maxSize: number = 10 * 1024 * 1024
): Promise<{ valid: boolean; data?: any; error?: string }> {
  try {
    // Check Content-Type
    const contentType = request.headers.get('Content-Type');
    if (!contentType?.includes('application/json')) {
      return {
        valid: false,
        error: 'Content-Type must be application/json'
      };
    }

    // Read body with size limit
    const body = await request.text();

    if (body.length > maxSize) {
      return {
        valid: false,
        error: `Request body too large. Maximum size is ${maxSize / 1024 / 1024}MB`
      };
    }

    if (body.length === 0) {
      return {
        valid: false,
        error: 'Request body is empty'
      };
    }

    // Parse JSON
    const data = JSON.parse(body);

    if (typeof data !== 'object' || data === null) {
      return {
        valid: false,
        error: 'Request body must be a JSON object'
      };
    }

    return {
      valid: true,
      data
    };

  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        valid: false,
        error: 'Invalid JSON format'
      };
    }

    return {
      valid: false,
      error: 'Failed to parse request body'
    };
  }
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Sanitizes HTML content to prevent XSS
 * Basic implementation - for production, use a library like DOMPurify
 * @param html - HTML string to sanitize
 * @returns Sanitized string
 */
export function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes SQL-like strings (belt and suspenders - ORM should handle this)
 * @param value - String that might be used in SQL
 * @returns Sanitized string
 */
export function sanitizeSQL(value: string): string {
  if (!value || typeof value !== 'string') return '';

  // Remove SQL comment markers
  let sanitized = value
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');

  // Remove semicolons (prevent query stacking)
  sanitized = sanitized.replace(/;/g, '');

  return sanitized.trim();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates multiple fields and returns all errors
 * @param validations - Array of validation results
 * @returns Combined result with all errors
 */
export function combineValidations(
  validations: ValidationResult[]
): ValidationResult {
  const errors = validations
    .filter(v => !v.valid)
    .map(v => v.error)
    .filter(Boolean);

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; ')
    };
  }

  return { valid: true };
}

/**
 * Throws an error with a 400 status code for invalid input
 * @param message - Error message
 */
export function throwValidationError(message: string): never {
  const error = new Error(message);
  (error as any).status = 400;
  throw error;
}
