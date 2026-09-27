import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { signToken } from '../utils/jwt.util';
import { ENV } from '../config/env';

/**
 * Standard utility to verify legacy/seed hash as well as standard bcrypt hashes
 */
async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // 1. Try standard bcrypt comparison
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compare(plain, hash);
  }
  // 2. Compatibility check for PBKDF2 seeded passwords
  const salt = 'suit_and_stitch_bespoke_salt_2026';
  const pbkdf2Hash = crypto.pbkdf2Sync(plain, salt, 10000, 64, 'sha512').toString('hex');
  if (pbkdf2Hash === hash) {
    return true;
  }
  return false;
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role, name, phone, boutiqueName, boutiqueLocation, boutiqueDescription, bannerUrl } = req.body;

    if (!email || !password || !role || !name || !phone) {
      res.status(400).json({ success: false, message: 'Missing required registration fields.' });
      return;
    }

    if (!Object.values(Role).includes(role)) {
      res.status(400).json({ success: false, message: `Invalid role specified. Valid roles: ${Object.values(Role).join(', ')}` });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          role,
          name,
          phone,
        },
      });

      // If registered as a BOUTIQUE_PARTNER, initialize their boutique atelier record
      if (role === Role.BOUTIQUE_PARTNER) {
        await tx.boutique.create({
          data: {
            name: boutiqueName || `${name}'s Atelier`,
            location: boutiqueLocation || 'Flagship Studio',
            description: boutiqueDescription || 'Master bespoke tailoring studio.',
            bannerUrl: bannerUrl || 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=800',
            userId: createdUser.id,
          },
        });
      }

      return createdUser;
    });

    const token = signToken({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        boutique: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
      return;
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Password incorrect.' });
      return;
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    // Set HTTP-only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        boutiqueId: user.boutique?.id || null,
        boutiqueName: user.boutique?.name || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        boutique: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User profile not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        boutiqueId: user.boutique?.id || null,
        boutiqueName: user.boutique?.name || null,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function logout(req: Request, res: Response): void {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
}
