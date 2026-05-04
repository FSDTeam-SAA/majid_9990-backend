import { Types } from 'mongoose';

export type TBalanceTransactionType = 'credit' | 'debit';
export type TBalanceTransactionSource = 'payment' | 'imei_service' | 'refund';

export interface IBalanceTransaction {
      userId: Types.ObjectId;
      transactionType: TBalanceTransactionType;
      source: TBalanceTransactionSource;
      amount: number;
      currency: string;
      balanceBefore: number;
      balanceAfter: number;
      description: string;
      referenceId?: string;
      paymentId?: Types.ObjectId;
      serviceId?: number;
      serviceName?: string;
      imei?: string;
      metadata?: Record<string, unknown>;
      createdAt?: Date;
      updatedAt?: Date;
}
