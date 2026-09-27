import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Public auth endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Authenticated session endpoint
router.get('/me', authenticateJWT, getMe);

export default router;
