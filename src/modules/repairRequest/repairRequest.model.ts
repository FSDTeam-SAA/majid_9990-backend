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
      assignedPerson: { type: String, required: true },
});

const TechNoteSchema = new Schema({
      partName: { type: String, required: true },
      cost: { type: Number, required: true },
      time: { type: Number, required: true },
});

const RepairIssueSchema = new Schema(
      {
            id: { type: String },
            category: { type: String, required: true },
            problems: [{ type: String }],
            additionalInfo: { type: String, default: '' },
            estimatedTime: { type: String, default: '1-2 Hours' },
            estimatedPrice: { type: Number, default: 0 },
            selectedPart: {
                  variantId: { type: Schema.Types.Mixed },
                  partName: { type: String },
                  quality: { type: String },
                  price: { type: Number, default: 0 },
                  sku: { type: String },
                  quantity: { type: Number, default: 1 },
            },
      },
      { _id: false }
);

const EvidencePhotoSchema = new Schema(
      {
            url: { type: String, required: true },
            public_id: { type: String },
            uploadedAt: { type: Date, default: Date.now },
            autoDeleteAt: {
                  type: Date,
                  default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                  index: true,
            },
            usedFor: { type: String, default: 'Repair diagnosis only' },
      },
      { _id: false }
);

const RepairHistorySchema = new Schema(
      {
            title: { type: String, required: true },
            description: { type: String, default: '' },
            actor: { type: String, default: 'Shopkeeper' },
            createdAt: { type: Date, default: Date.now },
            icon: { type: String },
      },
      { _id: false }
);

const RepairRequestSchema = new Schema<IRepairRequest>(
      {
            orderNumber: { type: String, index: true },
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            shopId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Shop',
                  default: null,
            },
            firstName: { type: String, required: true },
            email: { type: String, default: '' },
            phoneNumber: { type: String, required: true },
            price: { type: Number, default: 0 },
            currency: { type: String, default: 'GBP', uppercase: true },
            deviceModel: { type: String, required: true },
            category: { type: String, default: 'Mobile Phone' },
            brand: { type: String, default: '' },
            modelName: { type: String, default: '' },
            modelCode: { type: String, default: '' },
            releaseYear: { type: String, default: '' },
            colour: { type: String, default: '' },
            condition: {
                  type: String,
                  enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
                  default: 'Good',
            },
            serialType: {
                  type: String,
                  enum: ['imei', 'serial', 'both', 'IMEI', 'Serial', 'Both'],
                  default: 'imei',
                  set: (val: string) => (val ? val.toLowerCase() : 'imei'),
            },
            serialNumber: { type: String, default: '' },
            IMEINumber: { type: String },
            description: { type: String, required: true },
            issues: [RepairIssueSchema],
            evidencePhotos: [EvidencePhotoSchema],
            history: [RepairHistorySchema],
            technician: { type: String, trim: true, default: '' },
            technicianFeedback: { type: String, default: '' },
            status: {
                  type: String,
                  enum: [
                        'inProgress',
                        'quote_sent',
                        'approved',
                        'rejected',
                        'completed',
                        'collected',
                        'inReview',
                        'start-work',
                        'waiting-for-parts',
                        'order-assigned',
                        'diagnosing',
                        'repairing',
                        'unable-to-repair',
                  ],
                  default: 'inProgress',
            },
            waitingForPartsDays: { type: Number },
            waitingForPartsDescription: { type: String },
            unableToRepairReason: { type: String },
            unableToRepairNote: { type: String },
            unableToRepairCustomerMessage: { type: String },
            shopkeeperNotes: [NoteSchema],
            technicianNotes: [TechNoteSchema],
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

// Auto-generate orderNumber before saving if not present
RepairRequestSchema.pre('save', function (next) {
      if (!this.orderNumber) {
            const randomSuffix = Math.floor(10000 + Math.random() * 90000);
            this.orderNumber = `R-${randomSuffix}`;
      }
      if (!this.history || this.history.length === 0) {
            this.history = [
                  {
                        title: 'Request Booked',
                        description: `Booked by ${this.firstName || 'Customer'}`,
                        actor: 'Shopkeeper',
                        createdAt: new Date(),
                  },
                  {
                        title: 'In Progress',
                        description: `Assigned to: ${this.technician || 'Unassigned'} - Ready to start`,
                        actor: 'Shopkeeper',
                        createdAt: new Date(),
                  },
            ];
      }
      next();
});

const RepairRequest = model<IRepairRequest>('RepairRequest', RepairRequestSchema);
export default RepairRequest;
