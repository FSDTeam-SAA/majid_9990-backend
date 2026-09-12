import { Model, Types } from 'mongoose';

export type TwoFactorMethodType = 'authenticator' | 'email' | 'sms';

export interface IDeviceSession {
      _id?: string;
      userId: Types.ObjectId | string;
      deviceId: string;
      name: string;
      platform: string;
      location: string;
      ipAddress?: string;
      lastActive: Date;
      status: 'active' | 'revoked';
      createdAt?: Date;
      updatedAt?: Date;
}

export type DeviceSessionModel = Model<IDeviceSession>;

export interface ITwoFactorSettingsResponse {
      enabled: boolean;
      method: TwoFactorMethodType;
      emailVerified: boolean;
      phoneVerified: boolean;
      hasAuthenticator: boolean;
}
