import { Router } from 'express';
import subscriptionController from './subscription.controller';

const router = Router();

router.post('/create-subscription', subscriptionController.creteSubscription);

const subscriptionRouter = router;
export default subscriptionRouter;
