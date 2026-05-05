import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import repairRequestController from './repairRequest.controller';

const router = Router();

router.post('/add', protect, upload.array('images', 6), repairRequestController.addNewRepairRequest);

router.get('/my-history', protect, repairRequestController.getMyRepairRequestsHistory);

router.get('/shopkeepers-history', protect, repairRequestController.getShopKeepersShopsHistory);

router.get('/:id', repairRequestController.getSingleRepairRequest);

router.put('/update-status/:id', protect, repairRequestController.updateStatusByShopKeeper);

router.put('/add-note/:id', protect, upload.array('images', 6), repairRequestController.addNoteByShopKeeper);

router.put('/quote-status/:id', repairRequestController.updateQuoteStatusByUser);
router.put('/resent-quote/:id', repairRequestController.quoteResentByUser);
router.put('/quote-status-shopkeeper/:id', repairRequestController.updateQuoteStatusByShopKeeper);

const repairRequestRouter = router;
export default repairRequestRouter;
