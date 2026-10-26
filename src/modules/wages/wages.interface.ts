import { Types } from 'mongoose';

export type TPayPeriodStage =
  | 'draft'
  | 'exceptions_resolved'
  | 'owner_approved'
  | 'locked';

export interface IStaffWagesRow {
  staffId: string;
  name: string;
  avatar?: string;
  workedHours: number;
  paidLeaveHours: number;
  approvedExtraHours: number;
  totalPaidHours: number;
  hourlyRate: number;
  grossPay: number;
  pendingExceptionsCount: number;
  status: 'ready' | 'review_needed';
}

export interface IPendingExceptionSummary {
  id: string;
  staffName: string;
  type: string;
  date: string;
  title: string;
  differenceMinutes: number;
  scheduledHours: number;
  actualHours: number;
}

export interface IPayPeriodSummary {
  shopId: string;
  month: number;
  year: number;
  monthLabel: string;
  stage: TPayPeriodStage;
  kpis: {
    workedHours: number;
    paidLeaveHours: number;
    estimatedGrossPay: number;
    needsReviewCount: number;
  };
  staffSummaries: IStaffWagesRow[];
  pendingExceptions: IPendingExceptionSummary[];
  lockedAt?: Date;
  lockedBy?: string;
}

export interface IPayPeriod {
  _id?: Types.ObjectId | string;
  shopId: Types.ObjectId;
  month: number; // 1-12
  year: number;  // 2026
  status: TPayPeriodStage;
  totalWorkedHours: number;
  totalPaidLeaveHours: number;
  totalGrossPay: number;
  lockedAt?: Date;
  lockedBy?: Types.ObjectId;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
