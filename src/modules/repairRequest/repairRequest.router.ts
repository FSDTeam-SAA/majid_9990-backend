import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import repairRequestController from './repairRequest.controller';

const router = Router();

router.post('/add', protect, upload.array('images', 6), repairRequestController.addNewRepairRequest);

const repairRequestRouter = router;
export default repairRequestRouter;
