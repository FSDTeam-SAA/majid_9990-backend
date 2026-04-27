import express from 'express';
import { globalErrorHandler } from './middlewares/globalErrorHandler';
import { notFound } from './middlewares/notFound';
import router from './routes';
import cors from 'cors';

const app = express();
app.use(express.json());

const corsOptions = {
      origin: 'https://majid-website-two.vercel.app, https://majid-dashboard.vercel.app',

      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      credentials: true,
};

app.use(cors(corsOptions));

app.use('/api/v1', router);

app.use(notFound as never);
app.use(globalErrorHandler);

export default app;
