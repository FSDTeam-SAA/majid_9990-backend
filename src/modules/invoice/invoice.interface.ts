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
      accountHolderName?: string;
      bankName?: string;
      accountNumber?: string;
      bankAccountNumber?: string;
      sortCode?: string;
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

export interface IInvoiceUnitIdentifier {
      imeiNumber?: string;
      serialNumber?: string;
}

export interface IInvoiceLineItem {
      itemId: string;
      quantity: number;
      variantId?: string;
      name?: string;
      imeiNumber?: string;
      serialNumber?: string;
      upcEan?: string;
      units?: IInvoiceUnitIdentifier[];
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
      bankDetails?: {
            accountHolderName?: string;
            bankName?: string;
            accountNumber?: string;
            sortCode?: string;
      };
      amountPaid?: number;
      invoiceNumber?: string;
      currency?: string;
      orderDetails?: IInvoiceOrderDetails;
      discountName?: string;
      discountPercentage?: number;
      discountAmount?: number;
      lineItems?: IInvoiceLineItem[];
      idImages?: IInvoiceIdImages;
      idImageDeleteAfter?: Date;
      tradeInConsentId?: Types.ObjectId | null;
      tradeInDetails?: IInvoiceTradeInDetails;
      invoiceTemplate?: string;
      scoreReview?: IScoreReview;
}

export interface IInvoiceTradeInDetails {
      deviceName?: string;
      modelNumber?: string;
      storage?: string;
      color?: string;
      condition?: string;
      batteryHealth?: string;
      blacklistStatus?: string;
      networkLock?: string;
      imei?: string;
      serialNumber?: string;
      buyingPrice?: number;
      tradeInCredit?: number;
}

export interface IScoreReview {
      status: 'none' | 'recorded';
      source?: string;
      linkedBy?: string;
      reviewUrl?: string;
      recordedAt?: Date | null;
      requestSentAt?: Date | null;
      requestCount?: number;
      lastRecipientEmail?: string;
}

export interface ISendReviewRequestPayload {
      email?: string;
      customerName?: string;
      googleReviewUrl?: string;
}

export interface IUpdateReviewStatusPayload {
      status: 'none' | 'recorded';
      reviewUrl?: string;
      source?: string;
      linkedBy?: string;
}

export interface IInvoiceIdImage {
      url: string;
      public_id?: string;
}

export interface IInvoiceIdImages {
      front?: IInvoiceIdImage;
      back?: IInvoiceIdImage;
      deleteAfter?: Date;
      isDeleted?: boolean;
      deletedAt?: Date;
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
      sortCode?: string;
      accountNumber?: string;
      bankAccountNumber?: string;
      accountHolderName?: string;
      bankName?: string;
      amountPaid?: number;
      invoiceNumber?: string;
      currency?: string;
      orderDetails?: IInvoiceOrderDetails | string;
      discountName?: string;
      discountPercentage?: number;
      discountAmount?: number;
      lineItems?: IInvoiceLineItem[] | string;
      allocations?: Array<{ invoiceId: string; amountApplied: number }> | string;
      idImages?: IInvoiceIdImages | string;
      idImageDeleteAfter?: Date | string;
      tradeInConsentId?: string;
      tradeInDetails?: IInvoiceTradeInDetails | string;
      invoiceTemplate?: string;
      scoreReview?: IScoreReview | string;
      createdAt?: Date | string;
      invoiceDate?: Date | string;
      paymentDate?: Date | string;
      date?: Date | string;
      invoice?: IInvoiceFile | string;
}

export interface ISendInvoiceEmailPayload {
      email: string;
      invoiceRef?: string;
      pdfUrl?: string;
      amountLabel?: string;
      customerName?: string;
      customerId?: string;
      invoiceId?: string;
}
