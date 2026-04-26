import mongoose, { Model, Schema } from 'mongoose';
import { INotification } from './notification.interface';

const notificationSchema: Schema<INotification> = new Schema(
      {
            to: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            message: {
                  type: String,
                  required: true,
            },
            isViewed: {
                  type: Boolean,
                  default: false,
            },
            type: {
                  type: String,
                  required: true,
            },
            id: {
                  type: mongoose.Schema.Types.ObjectId,
                  required: true,
            },
            title: {
                  type: String,
                  required: true,
            },
      },
      { timestamps: true, versionKey: false }
);

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
