import { Schema, model } from 'mongoose';
import { IRepairRequest } from './repairRequest.interface';

const RepairEstimateSchema = new Schema(
      {
            cost: { type: Number },
            currency: { type: String, default: 'USD' },
            estimatedDays: { type: Number },
            approved: { type: Boolean, default: false },
      },
      { _id: false }
);

const RepairTimelineSchema = new Schema(
      {
            status: {
                  type: String,
                  enum: ['submitted', 'in_review', 'quote_sent', 'approved', 'rejected', 'in_progress', 'completed'],
                  default: 'submitted',

            },
            message: { type: String },
            createdAt: { type: Date, default: Date.now },
      },
      { _id: false }
);

const NoteSchema = new Schema(
      {
            message: { type: String, required: true },
            date: { type: Date, default: Date.now },
      },
      { _id: false }
);

const ImageSchema = new Schema(
      {
            public_id: { type: String, required: true },
            url: { type: String, required: true },
      },
      { _id: false }
);

const RepairRequestSchema = new Schema<IRepairRequest>(
      {
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            firstName: { type: String, required: true },
            email: { type: String, required: true },
            deviceModel: { type: String, required: true },
            IMEINumber: { type: String },
            description: { type: String, required: true },
            images: [ImageSchema],
            status: {
                  type: String,
                  enum: ['submitted', 'in_review', 'quote_sent', 'approved', 'rejected', 'in_progress', 'completed'],
                  default: 'submitted',
            },
            estimate: RepairEstimateSchema,
            timeline: [RepairTimelineSchema],
            shopkeeperNotes: [NoteSchema],
      },
      {
            timestamps: true, versionKey: false
      }
);

 const RepairRequest = model<IRepairRequest>('RepairRequest', RepairRequestSchema);
export default RepairRequest;