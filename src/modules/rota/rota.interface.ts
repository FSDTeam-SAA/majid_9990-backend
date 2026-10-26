import { Types } from 'mongoose';

export interface IShift {
  _id?: Types.ObjectId | string;
  staffId: Types.ObjectId;
  date: Date;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:00"
  hours: number;     // e.g. 8
  isOff: boolean;
  note?: string;
}

export interface IRota {
  _id?: Types.ObjectId | string;
  shopId: Types.ObjectId;
  weekStartDate: Date; // Monday date normalized (00:00:00.000)
  status: 'draft' | 'published';
  shifts: IShift[];
  publishedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRotaSummary {
  rota: IRota;
  totalScheduledHours: number;
  estimatedRotaCost: number;
  unfilledShifts: number;
  dailyCoverage: Record<string, number>; // e.g. { "2026-10-19": 3, "2026-10-20": 2 }
}
