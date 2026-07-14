import app from './app';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { ensureSwaggerSpec } from './config/swagger';
import paymentService from './modules/payment/payment.service';
dotenv.config();

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
      const [swaggerResult, dbResult] = await Promise.allSettled([ensureSwaggerSpec(), connectDB()]);

      if (swaggerResult.status === 'rejected') {
            console.error('Swagger spec generation failed:', swaggerResult.reason);
      }

      if (dbResult.status === 'rejected') {
            throw dbResult.reason;
      }

      paymentService.startPaymentStatusSyncScheduler();

      app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
      });
};

bootstrap();
