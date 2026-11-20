import { Schema, model } from 'mongoose';
import { IMasterCatalogueDocument } from './masterCatalogue.interface';

const masterCatalogueSchema = new Schema<IMasterCatalogueDocument>(
      {
            rowId: {
                  type: String,
                  trim: true,
                  sparse: true,
                  index: true,
            },
            deviceName: {
                  type: String,
                  required: true,
                  trim: true,
                  index: true,
            },
            model: {
                  type: String,
                  required: true,
                  trim: true,
                  index: true,
            },
            brand: {
                  type: String,
                  required: true,
                  trim: true,
                  default: 'Apple',
                  index: true,
            },
            category: {
                  type: String,
                  trim: true,
                  default: 'General',
                  index: true,
            },
            year: {
                  type: Number,
                  index: true,
            },
            storage: {
                  type: String,
                  trim: true,
                  index: true,
            },
            colour: {
                  type: String,
                  trim: true,
                  index: true,
            },
            connectivity: {
                  type: String,
                  trim: true,
            },
            glass: {
                  type: String,
                  trim: true,
            },
            modelNumber: {
                  type: String,
                  trim: true,
                  sparse: true,
                  index: true,
            },
            partNumber: {
                  type: String,
                  trim: true,
                  sparse: true,
                  index: true,
            },
            partBase: {
                  type: String,
                  trim: true,
            },
            upc: {
                  type: String,
                  trim: true,
                  sparse: true,
                  index: true,
            },
            ean: {
                  type: String,
                  trim: true,
                  sparse: true,
                  index: true,
            },
            gtin14: {
                  type: String,
                  trim: true,
                  sparse: true,
                  index: true,
            },
            barcode: {
                  type: String,
                  required: true,
                  trim: true,
                  index: true,
            },
            sku: {
                  type: String,
                  trim: true,
                  sparse: true,
                  index: true,
            },
            imageUrl: {
                  type: String,
                  trim: true,
            },
            imageKey: {
                  type: String,
                  trim: true,
            },
            sourceStatus: {
                  type: String,
                  trim: true,
                  default: 'preloaded',
            },
            sourceUrl: {
                  type: String,
                  trim: true,
            },
            autoFillApproved: {
                  type: Boolean,
                  default: true,
                  index: true,
            },
            sources: [
                  {
                        type: String,
                        trim: true,
                  },
            ],
            market: {
                  type: String,
                  trim: true,
            },
            specs: {
                  type: Schema.Types.Mixed,
                  default: {},
            },
            isActive: {
                  type: Boolean,
                  default: true,
                  index: true,
            },
      },
      {
            timestamps: true,
            toJSON: {
                  virtuals: true,
                  transform: function (_doc, ret: Record<string, any>) {
                        delete ret.__v;
                        return ret;
                  },
            },
      }
);

// Compound indexes for fast multi-field variant lookups
masterCatalogueSchema.index({ model: 1, storage: 1, colour: 1 });
masterCatalogueSchema.index({ brand: 1, model: 1 });
masterCatalogueSchema.index({ barcode: 1, isActive: 1 });

// Text index for fast multi-word keyword search (e.g. "iPhone 17 Pro 512GB")
masterCatalogueSchema.index(
      {
            deviceName: 'text',
            model: 'text',
            partNumber: 'text',
            modelNumber: 'text',
      },
      {
            weights: {
                  deviceName: 10,
                  model: 8,
                  partNumber: 6,
                  modelNumber: 5,
            },
            name: 'MasterCatalogueTextIndex',
      }
);

export const MasterCatalogue = model<IMasterCatalogueDocument>('MasterCatalogue', masterCatalogueSchema);
