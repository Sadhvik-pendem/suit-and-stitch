import { Router } from 'express';
import { register, login, getMe, logout, sendOtp, verifyOtp, updateProfile } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Public auth endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Authenticated session & profile endpoints
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);

export default router;
