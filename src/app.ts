import express from 'express';
import { globalErrorHandler } from './middlewares/globalErrorHandler';
import { notFound } from './middlewares/notFound';
import router from './routes';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { loadSwaggerSpec } from './config/swagger';

const app = express();
app.use(express.json());
app.disable('x-powered-by');

const allowedOrigins = [
      'https://imoscan.com',
      'https://www.imoscan.com',
      'https://admin.imoscan.com',
      'https://api.imoscan.com',
      'https://majid-website-two.vercel.app',
      'https://majid-dashboard.vercel.app',
      'https://majiddashboard.vercel.app',
      'http://localhost:3000',
];

const corsOptions = {
      origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
            // Allow same-server requests, curl/postman, and the configured browser origins.
            if (!origin || allowedOrigins.includes(origin)) {
                  callback(null, true);
                  return;
            }

            callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      credentials: true,
};

app.use(cors(corsOptions));
app.options('/{*corsPreflight}', cors(corsOptions));

app.get('/api-docs.json', async (_req, res, next) => {
      try {
            const swaggerSpec = await loadSwaggerSpec();

            res.json(swaggerSpec);
      } catch (error) {
            next(error);
      }
});

app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(undefined, {
            swaggerOptions: {
                  url: '/api-docs.json',
                  docExpansion: 'list',
                  deepLinking: true,
                  displayRequestDuration: true,
                  tagsSorter: 'alpha',
                  operationsSorter: 'alpha',
            },
      })
);

app.use('/api/v1', router);

app.use(notFound as never);
app.use(globalErrorHandler);

export default app;
