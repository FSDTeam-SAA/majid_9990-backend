import { Router } from 'express';
import { protect, optionalProtect, isShopkeeperOrStaff } from '../../middlewares/auth.middleware';
import rotaController from './rota.controller';

const router = Router();

router.get('/', optionalProtect, rotaController.getRota);
router.post('/', protect, isShopkeeperOrStaff, rotaController.saveRota);
router.post('/publish', protect, isShopkeeperOrStaff, rotaController.publishRota);
router.post('/copy-last-week', protect, isShopkeeperOrStaff, rotaController.copyLastWeek);

export default router;
