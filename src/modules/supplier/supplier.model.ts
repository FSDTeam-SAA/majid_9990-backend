import { model, Schema } from 'mongoose';
import { ISupplier } from './supplier.interface';

const supplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Supplier = model<ISupplier>('Supplier', supplierSchema);
