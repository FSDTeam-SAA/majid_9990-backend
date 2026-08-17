import { Router } from 'express';
import { popUpRuleController } from './popUpRule.controller';
import { protect, isShopkeeperOrStaff } from '../../middlewares/auth.middleware';

const router = Router();

router.post(
      '/',
      protect,
      isShopkeeperOrStaff,
      popUpRuleController.createRule
);

router.get(
      '/',
      protect,
      isShopkeeperOrStaff,
      popUpRuleController.getRules
);

router.post(
      '/recommendations',
      protect,
      isShopkeeperOrStaff,
      popUpRuleController.getRecommendations
);

router.get(
      '/:id',
      protect,
      isShopkeeperOrStaff,
      popUpRuleController.getRuleById
);

router.put(
      '/:id',
      protect,
      isShopkeeperOrStaff,
      popUpRuleController.updateRule
);

router.delete(
      '/:id',
      protect,
      isShopkeeperOrStaff,
      popUpRuleController.deleteRule
);

export default router;
