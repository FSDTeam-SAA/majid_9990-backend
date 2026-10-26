import { Types } from 'mongoose';

export type TLeaveType = 'annual' | 'sick' | 'unpaid';
export type TLeaveStatus = 'pending' | 'approved' | 'rejected';

export interface ILeaveRequest {
  _id?: Types.ObjectId | string;
  staffId: Types.ObjectId;
  shopId: Types.ObjectId;
  leaveType: TLeaveType;
  date: Date;
  endDate?: Date;
  durationHours: number;
  note?: string;
  status: TLeaveStatus;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  managerComment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILeaveBalance {
  totalAllowanceHours: number;
  usedHours: number;
  bookedHours: number;
  remainingHours: number;
}
