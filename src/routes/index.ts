import { Router } from 'express';
import authRouter from '../modules/auth/auth.router';
import deviceCheckRoutes from '../modules/deviceCheck/dhru.routes';
import subscriptionRouter from '../modules/subscription/subscription.router';
import userRoutes from '../modules/user/user.router';
import inventoryRouter from '../modules/inventory/inventory.router';
import paymentRouter from '../modules/payment/payment.router'
import notificationRouter from '../modules/notification/notification.router';

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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
