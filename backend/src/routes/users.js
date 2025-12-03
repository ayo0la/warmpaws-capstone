import express from 'express';
import { getUser, updateUser, getUserPets } from '../controllers/usersController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/:id', optionalAuth, getUser);
router.put('/:id', authenticate, updateUser);
router.get('/:id/pets', optionalAuth, getUserPets);

export default router;
