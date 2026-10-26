import { Types } from 'mongoose';

export type TVerificationMethod = 'passkey' | 'selfie';
export type TAttendanceStatus =
  | 'present'
  | 'late'
  | 'early_departure'
  | 'overtime'
  | 'missed_tap'
  | 'completed';

export type TExceptionType =
  | 'early_departure'
  | 'late_arrival'
  | 'missed_clock_out'
  | 'overtime';

export type TExceptionDecision =
  | 'pay_actual'
  | 'pay_scheduled'
  | 'use_leave'
  | 'unpaid_leave';

export interface IAttendanceClock {
  serverTime: Date;
  verifiedBy: TVerificationMethod;
  selfieUrl?: string;
  selfieExpiresAt?: Date; // 24-hour TTL deletion
}

export interface IAttendance {
  _id?: Types.ObjectId | string;
  shopId: Types.ObjectId;
  staffId: Types.ObjectId;
  shiftId?: Types.ObjectId;
  date: Date;
  clockIn: IAttendanceClock;
  clockOut?: IAttendanceClock;
  scheduledStart?: string; // "09:00"
  scheduledEnd?: string;   // "17:00"
  scheduledHours?: number; // 8
  actualHours?: number;    // 6
  approvedPaidHours?: number; // 8 (from manager exception decision)
  status: TAttendanceStatus;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAttendanceException {
  _id?: Types.ObjectId | string;
  attendanceId: Types.ObjectId;
  staffId: Types.ObjectId;
  shopId: Types.ObjectId;
  date: Date;
  type: TExceptionType;
  scheduledHours: number;
  actualHours: number;
  differenceMinutes: number;
  decision?: TExceptionDecision;
  approvedPaidHours?: number;
  leaveHoursDeducted?: number;
  managerReason?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  status: 'pending' | 'resolved';
  createdAt?: Date;
  updatedAt?: Date;
}
