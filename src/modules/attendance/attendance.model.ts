import { Schema, model } from 'mongoose';
import {
  IAttendance,
  IAttendanceException,
} from './attendance.interface';

const attendanceClockSchema = new Schema(
  {
    serverTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    verifiedBy: {
      type: String,
      enum: ['passkey', 'selfie'],
      required: true,
    },
    selfieUrl: {
      type: String,
      trim: true,
      default: '',
    },
    selfieExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const attendanceSchema = new Schema<IAttendance>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    clockIn: {
      type: attendanceClockSchema,
      required: true,
    },
    clockOut: {
      type: attendanceClockSchema,
      default: null,
    },
    scheduledStart: {
      type: String,
      trim: true,
      default: '09:00',
    },
    scheduledEnd: {
      type: String,
      trim: true,
      default: '18:00',
    },
    scheduledHours: {
      type: Number,
      default: 8,
      min: 0,
    },
    actualHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    approvedPaidHours: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ['present', 'late', 'early_departure', 'overtime', 'missed_tap', 'completed'],
      default: 'present',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

attendanceSchema.index({ shopId: 1, date: -1 });
attendanceSchema.index({ staffId: 1, date: -1 });
attendanceSchema.index({ shopId: 1, staffId: 1, date: -1 });

export const Attendance = model<IAttendance>('Attendance', attendanceSchema);

// Dedicated Selfie Store with MongoDB TTL index for automatic 24-hour purge
const attendanceSelfieSchema = new Schema(
  {
    attendanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['clock_in', 'clock_out'],
      required: true,
    },
    selfieUrl: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

// MongoDB automatically deletes selfies exactly when expiresAt is reached (24 hours TTL)
attendanceSelfieSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AttendanceSelfie = model('AttendanceSelfie', attendanceSelfieSchema);

// Attendance Exception Schema
const attendanceExceptionSchema = new Schema<IAttendanceException>(
  {
    attendanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ['early_departure', 'late_arrival', 'missed_clock_out', 'overtime'],
      required: true,
    },
    scheduledHours: {
      type: Number,
      required: true,
      default: 8,
    },
    actualHours: {
      type: Number,
      required: true,
      default: 0,
    },
    differenceMinutes: {
      type: Number,
      required: true,
      default: 0,
    },
    decision: {
      type: String,
      enum: ['pay_actual', 'pay_scheduled', 'use_leave', 'unpaid_leave'],
      default: null,
    },
    approvedPaidHours: {
      type: Number,
      default: null,
    },
    leaveHoursDeducted: {
      type: Number,
      default: 0,
    },
    managerReason: {
      type: String,
      trim: true,
      default: '',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

attendanceExceptionSchema.index({ shopId: 1, status: 1 });
attendanceExceptionSchema.index({ staffId: 1, date: -1 });
attendanceExceptionSchema.index({ attendanceId: 1 });

export const AttendanceException = model<IAttendanceException>(
  'AttendanceException',
  attendanceExceptionSchema
);
