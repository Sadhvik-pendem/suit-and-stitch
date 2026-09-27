import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { AuthUserPayload } from '../types/express';

export function signToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as any,
  });
}

export function verifyToken(token: string): AuthUserPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as AuthUserPayload;
}
