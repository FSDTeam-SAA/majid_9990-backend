import { Router } from 'express';
import userRoutes from '../modules/user/user.routes';
import deviceCheckRoutes from '../modules/deviceCheck/dhru.routes'
const router = Router();

const moduleRoutes = [
      {
            path: '/users',
            route: userRoutes,
      },
      {
            path: '/imei',
            route: deviceCheckRoutes,
      }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
