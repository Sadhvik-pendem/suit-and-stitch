import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyOtp, submitMeasurements } from '../controllers/associate.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { requireMeasurementToken } from '../middleware/associateAuth.middleware';

const router = Router();

// Field Associate Endpoints
// Both routes require an authenticated user with the ASSOCIATE role
router.use(authenticateJWT);
router.use(requireRole(Role.ASSOCIATE));

/**
 * @route   POST /api/associate/verify-otp
 * @desc    Rate-limited Doorstep OTP Verification (5 tries max) & issue verificationToken
 */
router.post('/verify-otp', verifyOtp);

/**
 * @route   POST /api/associate/submit-measurements
 * @desc    Submit 6-point biometric telemetry, advance status to MEASUREMENTS_TAKEN, clear OTP hash, & revoke token
 */
router.post('/submit-measurements', requireMeasurementToken, submitMeasurements);

export default router;
