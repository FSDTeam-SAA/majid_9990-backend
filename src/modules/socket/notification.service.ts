import { Server } from 'socket.io';
import mongoose from 'mongoose';
import Notification from '../notification/notification.model';

let io: Server | null = null;

export const initNotificationSocket = (socketIO: Server) => {
      io = socketIO;
};

export const createNotification = async ({
      to,
      message,
      type,
      id,
      title,
}: {
      to: mongoose.Types.ObjectId;
      message: string;
      type: string;
      id: mongoose.Types.ObjectId;
      title: string;
}) => {
      const notification = await Notification.create({
            to,
            message,
            type,
            id,
            title,
      });

      // Emit live notification
      if (io) {
            io.to(to.toString()).emit('newNotification', notification);
      }

      return notification;
};
