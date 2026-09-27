import crypto from 'crypto';

interface OtpAttemptRecord {
  attempts: number;
  lockedUntil: number | null;
}

// In-memory rate limiting store for OTP verification per order
const otpAttemptsMap = new Map<string, OtpAttemptRecord>();

// Blacklist store for revoked / single-use verification tokens (jti)
const revokedTokens = new Set<string>();

const MAX_OTP_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout

/**
 * Validates whether the order's OTP verification is currently locked out.
 */
export function checkOtpRateLimit(orderId: string): { isLocked: boolean; remainingMs?: number; remainingAttempts?: number } {
  const record = otpAttemptsMap.get(orderId);
  const now = Date.now();

  if (!record) {
    return { isLocked: false, remainingAttempts: MAX_OTP_ATTEMPTS };
  }

  // Check if order is under active lockout
  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      return {
        isLocked: true,
        remainingMs: record.lockedUntil - now,
        remainingAttempts: 0,
      };
    }
    // Lockout expired: reset tracker
    otpAttemptsMap.delete(orderId);
    return { isLocked: false, remainingAttempts: MAX_OTP_ATTEMPTS };
  }

  return {
    isLocked: false,
    remainingAttempts: Math.max(0, MAX_OTP_ATTEMPTS - record.attempts),
  };
}

/**
 * Increments failed attempts for an order. Locks order if threshold is breached.
 */
export function recordFailedOtpAttempt(orderId: string): { locked: boolean; remainingAttempts: number; lockoutSeconds?: number } {
  const now = Date.now();
  const record = otpAttemptsMap.get(orderId) || { attempts: 0, lockedUntil: null };

  record.attempts += 1;

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_WINDOW_MS;
    otpAttemptsMap.set(orderId, record);
    return {
      locked: true,
      remainingAttempts: 0,
      lockoutSeconds: Math.ceil(LOCKOUT_WINDOW_MS / 1000),
    };
  }

  otpAttemptsMap.set(orderId, record);
  return {
    locked: false,
    remainingAttempts: MAX_OTP_ATTEMPTS - record.attempts,
  };
}

/**
 * Resets the failed OTP attempt tracker upon successful doorstep verification.
 */
export function clearOtpRateLimit(orderId: string): void {
  otpAttemptsMap.delete(orderId);
}

/**
 * Blacklists a JWT JTI to prevent token reuse / replay attacks.
 */
export function revokeTokenJti(jti: string): void {
  revokedTokens.add(jti);
}

/**
 * Checks if a JTI has been revoked.
 */
export function isTokenJtiRevoked(jti: string): boolean {
  return revokedTokens.has(jti);
}

/**
 * Timing-safe string comparison to mitigate side-channel timing attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
