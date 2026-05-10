import { Schema, model } from 'mongoose';
import { IRepairRequest } from './repairRequest.interface';

const NoteSchema = new Schema({
      message: { type: String, required: true },
      date: { type: Date, default: Date.now },
      cost: { type: Number, required: true },
      estimatedDays: { type: Number, required: true },
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

const TechNoteSchema = new Schema({
      partName: { type: String, required: true },
      cost: { type: Number, required: true },
      time: { type: Number, required: true },
});

const RepairRequestSchema = new Schema<IRepairRequest>(
      {
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
                        'inProgress',
                        'quote_sent',
                        'approved',
                        'rejected',
                        'completed',
                        'inReview',
                        'start-work',
                        'waiting-for-parts',
                  ],
                  default: 'inProgress',
            },
            shopkeeperNotes: [NoteSchema],
            technicianNotes: [TechNoteSchema],
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

const RepairRequest = model<IRepairRequest>('RepairRequest', RepairRequestSchema);
export default RepairRequest;
