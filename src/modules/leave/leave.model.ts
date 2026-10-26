import { Schema, model } from 'mongoose';
import { ILeaveRequest } from './leave.interface';

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
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
    leaveType: {
      type: String,
      enum: ['annual', 'sick', 'unpaid'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    durationHours: {
      type: Number,
      required: true,
      min: 1,
      default: 8,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    managerComment: {
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

leaveRequestSchema.index({ shopId: 1, status: 1 });
leaveRequestSchema.index({ staffId: 1, date: -1 });

export const LeaveRequest = model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);
export default LeaveRequest;
