import mongoose from 'mongoose';
import app from '../app';
import http from 'http';
import { Server } from 'socket.io';
import { initNotificationSocket } from '../modules/socket/notification.service';
import ScanInfo from '../modules/deviceCheck/scanInfo.model';

const ensureUserScopedScanHistoryIndex = async () => {
      try {
            const indexes = await ScanInfo.collection.indexes();
            const legacyGlobalUniqueIndex = indexes.find(
                  (index) =>
                        index.unique &&
                        index.key?.imei === 1 &&
                        index.key?.serviceId === 1 &&
                        !Object.prototype.hasOwnProperty.call(index.key, 'userId')
            );

            if (legacyGlobalUniqueIndex?.name) {
                  await ScanInfo.collection.dropIndex(legacyGlobalUniqueIndex.name);
                  console.log('Replaced legacy global IMEI scan index with a user-scoped index');
            }
      } catch (error) {
            // MongoDB has no collection/indexes yet on a brand-new install.
            if ((error as { code?: number }).code !== 26) {
                  throw error;
            }
      }

      await ScanInfo.collection.createIndex(
            { userId: 1, imei: 1, serviceId: 1 },
            { unique: true, name: 'userId_1_imei_1_serviceId_1' }
      );
};

export const connectDB = async () => {
      try {
            await mongoose.connect(process.env.MONGO_URI!);
            await ensureUserScopedScanHistoryIndex();
            console.log('MongoDB connected');
            const httpServer = http.createServer(app);

            const io = new Server(httpServer, {
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
      } catch (error) {
            console.error('MongoDB connection failed:', error);
            process.exit(1);
      }
};
