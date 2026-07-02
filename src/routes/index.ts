import { Router } from 'express';
import authRouter from '../modules/auth/auth.router';
import deviceCheckRoutes from '../modules/deviceCheck/dhru.routes';
import subscriptionRouter from '../modules/subscription/subscription.router';
import userRoutes from '../modules/user/user.router';
import inventoryRouter from '../modules/inventory/inventory.router';
import paymentRouter from '../modules/payment/payment.router';
import notificationRouter from '../modules/notification/notification.router';
import dashboardRouter from '../modules/dashboard/dashboard.router';
import repairRequestRouter from '../modules/repairRequest/repairRequest.router';
import announcementRouter from '../modules/announcement/announcement.router';
import reviewRoutes from '../modules/review/review.router';
import barcodeRouter from '../modules/barcode/barcode.router';
import bankDetailsRouter from '../modules/bankDetails/bankDetails.router';
import customerRouter from '../modules/customer/customer.router';
import locationRouter from '../modules/location/location.router';
import lowStockAlertRouter from '../modules/lowStockAlert/lowStockAlert.router';
import invoiceRouter from '../modules/invoice/invoice.router';
import addToCartRouter from '../modules/addToCart/addToCart.router';
import ocrRouter from '../modules/ocr/ocr.router';
import categoryRouter from '../modules/inventory/category/category.route';
import cashManagementRouter from '../modules/cashManagement/cashManagement.route';
import supplierRouter from '../modules/supplier/supplier.router';

const router = Router();

const moduleRoutes = [
      {
            path: '/user',
            route: userRoutes,
      },
      {
            path: '/imei',
            route: deviceCheckRoutes,
      },
      {
            path: '/device',
            route: deviceCheckRoutes,
      },
      {
            path: '/auth',
            route: authRouter,
      },
      {
            path: '/subscription',
            route: subscriptionRouter,
      },
      {
            path: '/inventory',
            route: inventoryRouter,
      },
      {
            path: '/payment',
            route: paymentRouter,
      },
      {
            path: '/notification',
            route: notificationRouter,
      },
      {
            path: '/dashboard',
            route: dashboardRouter,
      },
      {
            path: '/repair-requests',
            route: repairRequestRouter,
      },
      {
            path: '/announcements',
            route: announcementRouter,
      },
      {
            path: '/review',
            route: reviewRoutes,
      },
      {
            path: '/barcode',
            route: barcodeRouter,
      },
      {
            path: '/bank-details',
            route: bankDetailsRouter,
      },
      {
            path: '/customers',
            route: customerRouter,
      },
      {
            path: '/location',
            route: locationRouter,
      },
      {
            path: '/low-stock-alert',
            route: lowStockAlertRouter,
      },
      {
            path: '/invoices',
            route: invoiceRouter,
      },
      {
            path: '/add-to-cart',
            route: addToCartRouter,
      },
      {
            path: '/customer',
            route: customerRouter,
      },
      {
            path: '/ocr',
            route: ocrRouter,
      },
      {
            path: '/category',
            route: categoryRouter,
      },
      {
            path: '/cash-management',
            route: cashManagementRouter,
      },
      {
            path: '/suppliers',
            route: supplierRouter,
      },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
