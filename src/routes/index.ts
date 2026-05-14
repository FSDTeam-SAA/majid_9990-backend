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
import locationRouter from '../modules/location/location.router';
import lowStockAlertRouter from '../modules/lowStockAlert/lowStockAlert.router';

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
            path: '/location',
            route: locationRouter,
      },
      {
            path: '/low-stock-alert',
            route: lowStockAlertRouter,
      },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
