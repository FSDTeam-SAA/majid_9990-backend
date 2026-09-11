import { model, Schema, Types } from 'mongoose';

export interface IAuditLog {
  action: 'customer_merge' | 'invoice_reassignment' | 'payment_adjustment';
  shopkeeperId: Types.ObjectId;
  shopId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  details: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true },
    shopkeeperId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

auditLogSchema.index({ shopkeeperId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
