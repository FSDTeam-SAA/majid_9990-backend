import { Types } from 'mongoose';

export type ConsentStatus = 'pending' | 'verified' | 'approved' | 'declined' | 'expired';
export type ConsentChannel = 'email' | 'sms' | 'copy';

export interface IConsentTermsSnapshot {
      quickTermsUrl?: string;
      fullTermsUrl?: string;
      termsVersion?: string;
      privacyNoticeSummary?: string;
      confirmAge18?: boolean;
      confirmOwnership?: boolean;
      confirmTermsAgreed?: boolean;
}

export interface IConsent {
      _id?: Types.ObjectId;
      shopkeeperId: Types.ObjectId;
      shopId?: Types.ObjectId | null;
      customerId?: Types.ObjectId | null;
      reference: string;
      codeHash: string;
      codeSalt: string;
      secureToken: string;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      itemName: string;
      agreedValue: number;
      currency?: string;
      paymentMethod: string;
      channel: ConsentChannel;
      status: ConsentStatus;
      verificationAttempts: number;
      expiresAt: Date;
      verifiedAt?: Date | null;
      approvedAt?: Date | null;
      declinedAt?: Date | null;
      termsVersion: string;
      termsSnapshot?: IConsentTermsSnapshot;
      deviceMetadata?: string;
      idImageDeleteAfter?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
}

export interface ICreateConsentPayload {
      shopkeeperId?: string;
      shopId?: string;
      customerId?: string;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      itemName: string;
      agreedValue: number;
      currency?: string;
      paymentMethod: string;
      channel?: ConsentChannel;
      sendEmailNow?: boolean;
}

export interface IVerifyConsentPayload {
      code: string;
      secureToken?: string;
}

export interface IApproveConsentPayload {
      secureToken?: string;
      confirmAge18: boolean;
      confirmOwnership: boolean;
      confirmTermsAgreed: boolean;
      deviceMetadata?: string;
}
