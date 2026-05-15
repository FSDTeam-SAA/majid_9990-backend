import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import invoiceController from './invoice.controller';

const router = Router();

router.post('/create', protect, upload.single('invoice'), invoiceController.createInvoice);
router.get('/all', protect, invoiceController.getAllInvoices);
router.get('/shopkeeper/:shopkeeperId', protect, invoiceController.getInvoiceByShopkeeperId);
router.put('/:id', protect, upload.single('invoice'), invoiceController.updateInvoice);
router.delete('/:id', protect, invoiceController.deleteInvoice);

export default router;
