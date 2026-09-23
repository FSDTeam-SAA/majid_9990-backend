import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import invoiceController from './invoice.controller';

const router = Router();

router.post(
      '/create',
      protect,
      upload.fields([
            { name: 'invoice', maxCount: 1 },
            { name: 'nid_front', maxCount: 1 },
            { name: 'nid_back', maxCount: 1 },
            { name: 'nidFrontImage', maxCount: 1 },
            { name: 'nidBackImage', maxCount: 1 },
            { name: 'idImage', maxCount: 1 },
      ]),
      invoiceController.createInvoice
);
router.post('/send-email', protect, invoiceController.sendInvoiceEmail);
router.get('/all', protect, invoiceController.getAllInvoices);
router.get('/shopkeeper/:shopkeeperId', protect, invoiceController.getInvoiceByShopkeeperId);
router.get('/customer/:customerId', protect, invoiceController.getInvoicesByCustomerId);
router.get('/:id', protect, invoiceController.getInvoiceById);
router.put('/:id', protect, upload.single('invoice'), invoiceController.updateInvoice);
router.delete('/:id', protect, invoiceController.deleteInvoice);

export default router;
