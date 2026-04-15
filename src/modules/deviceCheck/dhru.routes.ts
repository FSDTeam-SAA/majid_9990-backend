import { Router } from 'express';
import { checkImeiFromDhru } from './dhru.controller';

const router = Router();

router.post('/check', checkImeiFromDhru);

export default router;
