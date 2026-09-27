import { Router } from 'express';
import authRoutes from './auth.routes';
import boutiqueRoutes from './boutique.routes';
import orderRoutes from './order.routes';
import associateRoutes from './associate.routes';
import productionRoutes from './production.routes';
import logisticsRoutes from './logistics.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/boutiques', boutiqueRoutes);
router.use('/orders', orderRoutes);
router.use('/associate', associateRoutes);
router.use('/production', productionRoutes);
router.use('/logistics', logisticsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Suit & Stitch Bespoke API',
  });
});

export default router;
