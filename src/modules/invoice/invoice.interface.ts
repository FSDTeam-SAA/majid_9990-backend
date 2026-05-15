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
      createdAt?: Date;
      updatedAt?: Date;
}

export interface IInvoicePayload {
      shopkeeperId?: string;
      type?: string;
}
