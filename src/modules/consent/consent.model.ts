import { Schema, model } from 'mongoose';
import { IConsent } from './consent.interface';

const consentSchema = new Schema<IConsent>(
      {
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
                  index: true,
            },
            shopId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Shop',
                  default: null,
            },
            customerId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Customer',
                  default: null,
            },
            reference: {
                  type: String,
                  required: true,
                  unique: true,
                  trim: true,
                  index: true,
            },
            codeHash: {
                  type: String,
                  required: true,
            },
            codeSalt: {
                  type: String,
                  required: true,
            },
            secureToken: {
                  type: String,
                  required: true,
                  unique: true,
                  index: true,
            },
            customerName: {
                  type: String,
                  required: true,
                  trim: true,
            },
            customerEmail: {
                  type: String,
                  trim: true,
                  lowercase: true,
                  default: '',
            },
            customerPhone: {
                  type: String,
                  trim: true,
                  default: '',
            },
            itemName: {
                  type: String,
                  required: true,
                  trim: true,
            },
            agreedValue: {
                  type: Number,
                  required: true,
            },
            currency: {
                  type: String,
                  trim: true,
                  default: 'GBP',
            },
            paymentMethod: {
                  type: String,
                  required: true,
                  trim: true,
                  default: 'Cash',
            },
            channel: {
                  type: String,
                  enum: ['email', 'sms', 'copy'],
                  default: 'email',
            },
            status: {
                  type: String,
                  enum: ['pending', 'verified', 'approved', 'declined', 'expired'],
                  default: 'pending',
                  index: true,
            },
            verificationAttempts: {
                  type: Number,
                  default: 0,
            },
            expiresAt: {
                  type: Date,
                  required: true,
            },
            verifiedAt: {
                  type: Date,
                  default: null,
            },
            approvedAt: {
                  type: Date,
                  default: null,
            },
            declinedAt: {
                  type: Date,
                  default: null,
            },
            termsVersion: {
                  type: String,
                  default: '2026-09-07',
            },
            termsSnapshot: {
                  quickTermsUrl: { type: String, default: '' },
                  fullTermsUrl: { type: String, default: '' },
                  termsVersion: { type: String, default: '' },
                  privacyNoticeSummary: { type: String, default: '' },
                  confirmAge18: { type: Boolean, default: false },
                  confirmOwnership: { type: Boolean, default: false },
                  confirmTermsAgreed: { type: Boolean, default: false },
            },
            deviceMetadata: {
                  type: String,
                  default: '',
            },
            idImageDeleteAfter: {
                  type: Date,
                  default: null,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

consentSchema.index({ shopkeeperId: 1, createdAt: -1 });
consentSchema.index({ status: 1, expiresAt: 1 });

export const Consent = model<IConsent>('Consent', consentSchema);
