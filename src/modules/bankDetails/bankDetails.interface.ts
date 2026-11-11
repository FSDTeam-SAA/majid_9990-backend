import { Types } from 'mongoose';

export interface IBankDetail {
      accountHolderName: string;
      bankName: string;
      accountNumber: string;
      sortCode?: string;
      branchName: string;
      routingNumber: string;
      currency: string;
      country: string;
      currentBalance: number;
      addedBy: Types.ObjectId;
      invoiceId: string;
      createdAt?: Date;
      updatedAt?: Date;
}
