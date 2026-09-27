import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyToken } from '../utils/jwt.util';

/**
 * Middleware: Authenticates user session from HTTP-only Cookie or Authorization Header.
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check HTTP-only cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Bearer token in Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 3. Fallback to query param (e.g. for direct PDF pattern card downloads)
  else if (req.query && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. No session token provided.',
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please log in again.',
    });
    return;
  }
}

/**
 * Role-Based Access Control (RBAC) Guard.
 * Restricts route access to one or more authorized roles.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required prior to role authorization.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
        requiredRoles: allowedRoles,
      });
      return;
    }

    next();
  };
}
