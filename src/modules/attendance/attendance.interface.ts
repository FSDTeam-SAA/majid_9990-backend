import { Types } from 'mongoose';

export type TVerificationMethod = 'passkey' | 'selfie' | 'face_id';
export type TAttendanceStatus =
  | 'present'
  | 'late'
  | 'on_break'
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

export interface IAttendanceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  distanceFromStoreMeters?: number;
  isWithinGeofence?: boolean;
}

export interface IAttendanceClock {
  serverTime: Date;
  verifiedBy: TVerificationMethod;
  selfieUrl?: string;
  selfieExpiresAt?: Date; // 24-hour TTL deletion
  faceMatchScore?: number;
  livenessVerified?: boolean;
  location?: IAttendanceLocation;
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
