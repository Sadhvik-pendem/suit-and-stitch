import crypto from 'crypto';

/**
 * Generates a cryptographically secure 4-digit numeric string (1000 - 9999).
 */
export function generateFourDigitOtp(): string {
  const min = 1000;
  const max = 9999;
  return String(crypto.randomInt(min, max + 1));
}

/**
 * Generates a human-readable order tracking ID in format ORD-XXXX-YYYY
 */
export function generateOrderId(): string {
  const randomSuffix = crypto.randomInt(1000, 10000);
  const year = new Date().getFullYear();
  return `ORD-${randomSuffix}-${year}`;
}
