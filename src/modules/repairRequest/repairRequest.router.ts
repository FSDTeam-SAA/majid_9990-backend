import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import repairRequestController from './repairRequest.controller';

const router = Router();

router.post('/add', protect, upload.array('images', 6), repairRequestController.addNewRepairRequest);
router.get('/completed', protect, repairRequestController.getCompletedRepairRequests); 
router.get('/my-history', protect, repairRequestController.getMyRepairRequestsHistory);
router.get('/technicians', protect, repairRequestController.getTechnicians);
router.get('/customer-history', protect, repairRequestController.getCustomerRepairHistory);
router.get('/:id', repairRequestController.getSingleRepairRequest);
router.put('/reassign/:id', protect, repairRequestController.updateRepairRequestDetails);
router.put('/update-status/:id', protect, upload.array('images', 8), repairRequestController.updateStatusByShopKeeper);
router.post('/photos/:id', protect, upload.array('images', 8), repairRequestController.uploadRepairPhotos);
router.post('/reveal-passcode/:id', protect, repairRequestController.revealDevicePasscode);
router.put('/add-note/:id', protect, upload.array('images', 6), repairRequestController.addNoteByShopKeeper);
router.put('/:id', protect, repairRequestController.updateRepairRequestDetails);

router.put('/tech-note/:id', protect, repairRequestController.addTeachNoteByTechnician);
router.post('/technician-feedback/:id', protect, repairRequestController.generateTechnicianFeedback);

router.get(
  '/user/:userId/descriptions',
  protect,
  repairRequestController.getUserDescriptions
);

const repairRequestRouter = router;
export default repairRequestRouter;
