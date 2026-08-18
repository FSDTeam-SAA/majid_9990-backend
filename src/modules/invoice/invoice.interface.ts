import { Types } from 'mongoose';

export interface IInvoiceFile {
      public_id: string;
      url: string;
      resource_type: 'raw';
}

export type InvoicePaymentStatus = 'paid' | 'partial' | 'due';

export interface IInvoicePaymentDetails {
      amountReceived?: number;
      changeGiven?: number;
      cardholderName?: string;
      cardLastFour?: string;
      bankName?: string;
      accountLastFour?: string;
      transactionReference?: string;
      amountPaid?: number;
      dueAmount?: number;
      tax?: number;
      taxName?: string;
      taxIncludedInPrice?: boolean;
      totalAmount?: number;
      dueDate?: Date;
      notes?: string;
}

export interface IInvoiceOrderDetails {
      checkoutMode?: string;
      marketplace?: string;
      orderNumber?: string;
      deliveryFrom?: string;
      deliveryTo?: string;
}

export interface IInvoiceLineItem {
      itemId: string;
      quantity: number;
      variantId?: string;
}

export interface IInvoice {
      shopkeeperId: Types.ObjectId;
      shopId?: Types.ObjectId | null;
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
      taxName?: string;
      taxIncludedInPrice?: boolean;
      paymentMethod?: string;
      paymentStatus?: InvoicePaymentStatus;
      paymentDetails?: IInvoicePaymentDetails;
      amountPaid?: number;
      invoiceNumber?: string;
      currency?: string;
      orderDetails?: IInvoiceOrderDetails;
      discountName?: string;
      discountPercentage?: number;
      discountAmount?: number;
      lineItems?: IInvoiceLineItem[];
}

export interface IInvoicePayload {
      shopkeeperId?: string;
      shopId?: string;
      type?: string;
      customerInfo?: string;
      itemsIds?: string[];

      totalAmount?: number;
      dueAmount?: number;
      repairRequestId?: string;
      tax?: number;
      taxName?: string;
      taxIncludedInPrice?: boolean;
      paymentMethod?: string;
      paymentStatus?: InvoicePaymentStatus;
      paymentDetails?: IInvoicePaymentDetails | string;
      amountPaid?: number;
      invoiceNumber?: string;
      currency?: string;
      orderDetails?: IInvoiceOrderDetails | string;
      discountName?: string;
      discountPercentage?: number;
      discountAmount?: number;
      lineItems?: IInvoiceLineItem[] | string;
}
