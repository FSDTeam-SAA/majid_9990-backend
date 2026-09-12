import { Schema, model } from 'mongoose';
import { IDeviceSession, DeviceSessionModel } from './security.interface';

const deviceSessionSchema = new Schema<IDeviceSession, DeviceSessionModel>(
      {
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
                  index: true,
            },
            deviceId: {
                  type: String,
                  required: true,
                  index: true,
            },
            name: {
                  type: String,
                  default: 'Unknown device',
            },
            platform: {
                  type: String,
                  default: '',
            },
            location: {
                  type: String,
                  default: 'Unknown location',
            },
            ipAddress: {
                  type: String,
                  default: '',
            },
            lastActive: {
                  type: Date,
                  default: Date.now,
            },
            status: {
                  type: String,
                  enum: ['active', 'revoked'],
                  default: 'active',
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

deviceSessionSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export const DeviceSession = model<IDeviceSession, DeviceSessionModel>('DeviceSession', deviceSessionSchema);
