import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { ensureSwaggerSpec } from './config/swagger';
import { initNotificationSocket } from './modules/socket/notification.service';
import 'dotenv/config';

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

      const server = http.createServer(app);

      const io = new Server(server, {
            cors: {
                  origin: '*',
                  methods: ['GET', 'POST'],
            },
      });

      io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            socket.on('joinRoom', (userId: string) => socket.join(userId));
      });

      initNotificationSocket(io);

      server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
      });
};

bootstrap();
