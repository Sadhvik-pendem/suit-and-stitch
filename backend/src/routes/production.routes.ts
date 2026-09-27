import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  startStitching,
  markReady,
  downloadPatternCard,
} from '../controllers/production.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);

/**
 * @route   PUT /api/production/orders/:id/start-stitching
 * @desc    Accept sizing telemetry and advance status to IN_PRODUCTION
 */
router.put('/orders/:id/start-stitching', requireRole(Role.BOUTIQUE_PARTNER), startStitching);

/**
 * @route   PUT /api/production/orders/:id/mark-ready
 * @desc    Mark garment completed, transition to DISPATCHED, alert delivery fleet
 */
router.put('/orders/:id/mark-ready', requireRole(Role.BOUTIQUE_PARTNER), markReady);

/**
 * @route   GET /api/production/orders/:id/pattern-card
 * @desc    Generate and stream printable PDF pattern card
 */
router.get(
  '/orders/:id/pattern-card',
  requireRole(Role.BOUTIQUE_PARTNER, Role.CUSTOMER, Role.ASSOCIATE),
  downloadPatternCard
);

export default router;
