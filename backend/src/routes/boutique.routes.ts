import { Router } from 'express';
import { getAllBoutiques, getBoutiqueById } from '../controllers/boutique.controller';

const router = Router();

// Public catalog endpoints
router.get('/', getAllBoutiques);
router.get('/:id', getBoutiqueById);

export default router;
