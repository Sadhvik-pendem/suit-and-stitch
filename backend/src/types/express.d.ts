import { Role } from '@prisma/client';

export interface AuthUserPayload {
  userId: string;
  role: Role;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
