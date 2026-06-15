import { Types } from 'mongoose';

export interface IInvoiceFile {
      public_id: string;
      url: string;
      resource_type: 'raw';
}

export interface IInvoice {
      shopkeeperId: Types.ObjectId;
      invoice: IInvoiceFile;
      type: string;
      customerInfo?: Types.ObjectId | null;
      itemsIds?: Types.ObjectId[];
      createdAt?: Date;
      updatedAt?: Date;
      totalAmount?: number;
      dueAmount?: number;
      repairRequestId?: Types.ObjectId;
      tax?: number;
      paymentMethod?: string;
}

export interface IInvoicePayload {
      shopkeeperId?: string;
      type?: string;
      customerInfo?: string;
      itemsIds?: string[];

      totalAmount?: number;
      dueAmount?: number;
      repairRequestId?: string;
      tax?: number;
      paymentMethod?: string;
}
