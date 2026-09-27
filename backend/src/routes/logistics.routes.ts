import { Router } from 'express';
import { Role } from '@prisma/client';
import { confirmPickup, confirmDelivery } from '../controllers/logistics.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All logistics routes require an authenticated user with DELIVERY_AGENT role
router.use(authenticateJWT);
router.use(requireRole(Role.DELIVERY_AGENT));

/**
 * @route   PUT /api/logistics/orders/:id/pickup
 * @desc    Delivery agent scans atelier parcel and takes physical custody
 */
router.put('/orders/:id/pickup', confirmPickup);

/**
 * @route   PUT /api/logistics/orders/:id/deliver
 * @desc    Confirms final doorstep drop-off, setting status to DELIVERED
 */
router.put('/orders/:id/deliver', confirmDelivery);

export default router;
