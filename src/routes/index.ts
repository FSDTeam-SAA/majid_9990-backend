import { Router } from 'express';
import authRouter from '../modules/auth/auth.router';
import deviceCheckRoutes from '../modules/deviceCheck/dhru.routes';
import userRoutes from '../modules/user/user.router';

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
            path: '/auth',
            route: authRouter,
      },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
