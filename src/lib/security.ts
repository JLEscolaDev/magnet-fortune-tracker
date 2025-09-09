/**
 * Security utilities for input validation and sanitization
 */

// HTML entities to escape for XSS prevention
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

/**
 * Escapes HTML entities to prevent XSS attacks
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitizes text input by trimming whitespace and escaping HTML
 */
export function sanitizeText(text: string, maxLength: number = 500): string {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }
  
  const trimmed = text.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or less`);
  }
  
  return escapeHtml(trimmed);
}

/**
 * Validates and sanitizes numeric input
 */
export function validateNumericValue(value: string | number, min: number = 0, max: number = 1000000): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    throw new Error('Value must be a valid number');
  }
  
  if (numValue < min) {
    throw new Error(`Value must be at least ${min}`);
  }
  
  if (numValue > max) {
    throw new Error(`Value must be no more than ${max}`);
  }
  
  // Round to 2 decimal places for currency
  return Math.round(numValue * 100) / 100;
}

/**
 * Validates category name
 */
export function validateCategory(category: string): string {
  if (!category || typeof category !== 'string') {
    throw new Error('Category is required');
  }
  
  const trimmed = category.trim();
  if (trimmed.length === 0) {
    throw new Error('Category cannot be empty');
  }
  
  if (trimmed.length > 50) {
    throw new Error('Category name must be 50 characters or less');
  }
  
  // Allow most printable characters, just block HTML tags and scripts
  if (/<[^>]*>/g.test(trimmed) || /javascript:/i.test(trimmed)) {
    throw new Error('Category contains invalid characters');
  }
  
  return escapeHtml(trimmed);
}

/**
 * Rate limiting helper for client-side
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  canProceed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    return true;
  }
  
  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Global rate limiter for form submissions
export const formRateLimiter = new RateLimiter(3, 60000); // 3 attempts per minute