import { Router } from 'express';
import subscriptionController from './subscription.controller';

const router = Router();

router.post('/create', subscriptionController.createSubscription);
router.get('/all', subscriptionController.getAllSubscriptions);

router.put('/update/:id', subscriptionController.updateSubscription);

const subscriptionRouter = router;
export default subscriptionRouter;
