import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createOrder,
  getMyOrders,
  verifyOrderOtp,
  recordMeasurements,
  updateOrderStatus,
} from '../controllers/order.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All order endpoints require an authenticated user
router.use(authenticateJWT);

// Customer places a bespoke tailoring order
router.post('/', requireRole(Role.CUSTOMER), createOrder);

// Role-scoped order pipeline retrieval
router.get('/my-orders', getMyOrders);

// Associate doorstep OTP authentication
router.post('/:id/verify-otp', requireRole(Role.ASSOCIATE), verifyOrderOtp);

// Associate telemetry / measurements recording
router.post('/:id/measurements', requireRole(Role.ASSOCIATE), recordMeasurements);

// Order status progression (Boutiques, Associates, Delivery Agents)
router.patch(
  '/:id/status',
  requireRole(Role.ASSOCIATE, Role.BOUTIQUE_PARTNER, Role.DELIVERY_AGENT),
  updateOrderStatus
);

export default router;
