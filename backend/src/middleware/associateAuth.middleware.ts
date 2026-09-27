import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { isTokenJtiRevoked } from '../utils/security.util';

export interface MeasurementTokenPayload {
  orderId: string;
  associateId: string;
  purpose: string;
  jti: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      measurementSession?: MeasurementTokenPayload;
    }
  }
}

/**
 * Middleware: Enforces that the incoming request contains a valid, unrevoked
 * short-lived measurement recording verification token issued during OTP handshake.
 */
export function requireMeasurementToken(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // Extract from Authorization header or custom X-Verification-Token header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers['x-verification-token']) {
    token = req.headers['x-verification-token'] as string;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing measurement verification token in authorization header.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as MeasurementTokenPayload;

    // 1. Verify token intent/scope
    if (decoded.purpose !== 'MEASUREMENT_RECORDING') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid token purpose. Expected MEASUREMENT_RECORDING session.',
      });
      return;
    }

    // 2. Enforce single-use: check revocation blacklist
    if (isTokenJtiRevoked(decoded.jti)) {
      res.status(401).json({
        success: false,
        message: 'Invalidated Token: This measurement recording session has already been consumed and closed.',
      });
      return;
    }

    // 3. Prevent cross-order parameter tampering
    const targetOrderId = req.body?.orderId || req.params?.orderId;
    if (targetOrderId && targetOrderId !== decoded.orderId) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Token was authorized for order '${decoded.orderId}', but request targeted order '${targetOrderId}'.`,
      });
      return;
    }

    req.measurementSession = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Doorstep session expired: Measurement recording window has lapsed. Please re-verify the customer OTP.',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid verification token signature.',
    });
    return;
  }
}
