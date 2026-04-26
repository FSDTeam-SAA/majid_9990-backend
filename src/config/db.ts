import mongoose from 'mongoose';
import app from '../app';
import http from 'http';
import { Server } from 'socket.io';
import { initNotificationSocket } from '../modules/socket/notification.service';

export const connectDB = async () => {
      try {
            await mongoose.connect(process.env.MONGO_URI!);
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
