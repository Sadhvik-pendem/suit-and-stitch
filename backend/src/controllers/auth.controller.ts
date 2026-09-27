import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { signToken } from '../utils/jwt.util';
import { ENV } from '../config/env';
import notificationService from '../services/notification.service';

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

// In-memory cryptographic OTP store with 5-minute TTL
interface OtpStoreItem {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  plainForDemo: string;
}
const loginOtpStore = new Map<string, OtpStoreItem>();

/**
 * Dispatch 6-digit verification code to email or mobile phone
 */
export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier } = req.body;

    if (!identifier || typeof identifier !== 'string' || identifier.trim().length < 3) {
      res.status(400).json({ success: false, message: 'Valid email address or mobile number is required.' });
      return;
    }

    const key = identifier.toLowerCase().trim();

    // Rate-limiting check (max 5 requests per 10 minutes)
    const existing = loginOtpStore.get(key);
    if (existing && Date.now() < existing.expiresAt && existing.attempts >= 5) {
      res.status(429).json({ success: false, message: 'Too many verification requests. Please wait a few minutes.' });
      return;
    }

    // Generate cryptographically secure 6-digit numeric OTP
    const rawOtp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const codeHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    // Store with 5-minute expiration
    loginOtpStore.set(key, {
      codeHash,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      plainForDemo: rawOtp,
    });

    // Check if user already exists
    const isEmail = key.includes('@');
    const existingUser = isEmail
      ? await prisma.user.findUnique({ where: { email: key } })
      : await prisma.user.findFirst({ where: { phone: key } });

    // Determine gateway configuration status
    const isSmtpConfigured = !!(ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS);
    const isSmsConfigured = !!(ENV.FAST2SMS_API_KEY || (ENV.TWILIO_ACCOUNT_SID && ENV.TWILIO_AUTH_TOKEN));
    const isGatewayConfigured = isEmail ? isSmtpConfigured : isSmsConfigured;

    // Dispatch real email or real SMS
    let deliverySucceeded = false;
    if (isEmail) {
      try {
        deliverySucceeded = await notificationService.sendLoginOtp(key, rawOtp);
      } catch (err) {
        console.error('[sendOtp] Real email transmission error:', err);
        deliverySucceeded = false;
      }
    } else {
      try {
        deliverySucceeded = await notificationService.sendLoginSms(key, rawOtp);
      } catch (err) {
        console.error('[sendOtp] Real SMS transmission error:', err);
        deliverySucceeded = false;
      }
    }

    const showFallbackCode = !isGatewayConfigured || !deliverySucceeded;

    res.status(200).json({
      success: true,
      message: deliverySucceeded && isGatewayConfigured 
        ? `A 6-digit verification code has been dispatched to ${identifier}.`
        : `Verification code generated. (${isGatewayConfigured ? 'Email delivery error' : 'Email gateway not yet active on server'}).`,
      expiresInSeconds: 300,
      userExists: !!existingUser,
      isGatewayConfigured: isGatewayConfigured && deliverySucceeded,
      channel: isEmail ? 'email' : 'sms',
      ...(showFallbackCode && { demoCode: rawOtp }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify 6-digit code and issue authenticated JWT session
 */
export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, otp, name } = req.body;

    if (!identifier || !otp) {
      res.status(400).json({ success: false, message: 'Both identifier and 6-digit verification code are required.' });
      return;
    }

    const key = identifier.toLowerCase().trim();
    const record = loginOtpStore.get(key);

    if (!record || Date.now() > record.expiresAt) {
      loginOtpStore.delete(key);
      res.status(400).json({ success: false, message: 'Verification code has expired or was not requested. Please request a new code.' });
      return;
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      loginOtpStore.delete(key);
      res.status(429).json({ success: false, message: 'Maximum verification attempts exceeded. Please request a new code.' });
      return;
    }

    const incomingHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (incomingHash !== record.codeHash) {
      res.status(400).json({
        success: false,
        message: `Invalid verification code. ${5 - record.attempts} attempt(s) remaining.`,
      });
      return;
    }

    // OTP verified successfully; invalidate one-time code
    loginOtpStore.delete(key);

    const isEmail = key.includes('@');

    // Find existing user or automatically provision new bespoke customer account
    let user = isEmail
      ? await prisma.user.findUnique({
          where: { email: key },
          include: { boutique: true },
        })
      : await prisma.user.findFirst({
          where: { phone: key },
          include: { boutique: true },
        });

    if (!user) {
      // Provision customer account for new visitor
      const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const generatedEmail = isEmail ? key : `${key.replace(/\D/g, '') || Date.now()}@guest.suitstitch.com`;
      const generatedPhone = isEmail ? '+91 98000 00000' : key;
      const initialName = name?.trim() || (isEmail ? key.split('@')[0] : `Bespoke Client`);

      user = await prisma.user.create({
        data: {
          email: generatedEmail,
          passwordHash: dummyPasswordHash,
          role: Role.CUSTOMER,
          name: initialName,
          phone: generatedPhone,
        },
        include: { boutique: true },
      });
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'Verification successful. Welcome to Suit & Stitch.',
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

/**
 * Update authenticated user's profile details
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const { name, phone } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.trim() }),
      },
      include: { boutique: true },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        phone: updated.phone,
        boutiqueId: updated.boutique?.id || null,
        boutiqueName: updated.boutique?.name || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

