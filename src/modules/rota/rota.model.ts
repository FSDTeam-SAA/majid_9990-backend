import { Schema, model } from 'mongoose';
import { IRota, IShift } from './rota.interface';

const shiftSchema = new Schema<IShift>(
  {
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      default: '09:00',
    },
    endTime: {
      type: String,
      default: '17:00',
    },
    hours: {
      type: Number,
      default: 8,
      min: 0,
    },
    isOff: {
      type: Boolean,
      default: false,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const rotaSchema = new Schema<IRota>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    weekStartDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    shifts: {
      type: [shiftSchema],
      default: [],
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

rotaSchema.index({ shopId: 1, weekStartDate: 1 }, { unique: true });
rotaSchema.index({ shopId: 1, status: 1 });

export const Rota = model<IRota>('Rota', rotaSchema);
export default Rota;
