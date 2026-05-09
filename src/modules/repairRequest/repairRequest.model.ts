import { Schema, model } from 'mongoose';
import { IRepairRequest } from './repairRequest.interface';

const NoteSchema = new Schema({
      message: { type: String, required: true },
      date: { type: Date, default: Date.now },
      cost: { type: Number, required: true },
      estimatedDays: { type: Number, required: true },
      status: {
            type: String,
            enum: ['inProgress', 'approved', 'rejected'],
            default: 'inProgress',
      },
      images: [
            {
                  public_id: { type: String, required: true },
                  url: { type: String, required: true },
            },
      ],
});

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
                  enum: [
                        'request_submitted',
                        'in_review',
                        'quote_sent',
                        'quote_accepted',
                        'quote_rejected',
                        'rejected',
                        'repair_in_progress',
                        'completed',
                        'quote-resent',
                  ],
                  default: 'request_submitted',
            },
            shopkeeperNotes: [NoteSchema],
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

const RepairRequest = model<IRepairRequest>('RepairRequest', RepairRequestSchema);
export default RepairRequest;
