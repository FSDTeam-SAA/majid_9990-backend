import { model, Schema } from 'mongoose';

const ScanInfoSchema = new Schema(
      {
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: false,
            },
            deviceName: {
                  type: String,
                  required: true,
                  trim: true,
            },
            imei: {
                  type: String,
                  required: true,
                  trim: true,
                  unique: true,
            },
            deviceStatus: {
                  type: String,
                  enum: ['clean', 'blacklisted', 'financed', 'locked', 'unknown'],
                  default: 'clean',
            },
            riskMeter: {
                  riskLevel: {
                        type: String,
                        enum: ['low', 'medium', 'high'],
                        default: 'low',
                  },
                  score: {
                        type: Number,
                        default: 12,
                        min: 0,
                        max: 100,
                  },
                  label: {
                        type: String,
                        default: 'Low Risk',
                  },
            },
            marketValue: {
                  amount: {
                        type: Number,
                        required: true,
                  },
                  currency: {
                        type: String,
                        default: 'USD',
                  },
            },
            aiInsight: {
                  title: {
                        type: String,
                        default: 'AI INSIGHT',
                  },
                  message: {
                        type: String,
                        required: true,
                  },
            },
            checks: {
                  globalBlacklist: {
                        title: {
                              type: String,
                              default: 'Global Blacklist',
                        },
                        description: {
                              type: String,
                              default: 'Not reported stolen',
                        },
                        status: {
                              type: String,
                              enum: ['passed', 'failed', 'warning'],
                              default: 'passed',
                        },
                        isReportedStolen: {
                              type: Boolean,
                              default: false,
                        },
                  },
                  carrierFinancing: {
                        title: {
                              type: String,
                              default: 'Carrier Financing',
                        },
                        description: {
                              type: String,
                              default: 'Payment plan active',
                        },
                        status: {
                              type: String,
                              enum: ['passed', 'failed', 'warning'],
                              default: 'warning',
                        },
                        isPaymentPlanActive: {
                              type: Boolean,
                              default: true,
                        },
                  },
                  hardwareLock: {
                        title: {
                              type: String,
                              default: 'Hardware Lock',
                        },
                        description: {
                              type: String,
                              default: 'FMI is OFF',
                        },
                        status: {
                              type: String,
                              enum: ['passed', 'failed', 'warning'],
                              default: 'passed',
                        },
                        fmiStatus: {
                              type: String,
                              enum: ['on', 'off', 'unknown'],
                              default: 'off',
                        },
                  },
                  partAuthenticity: {
                        title: {
                              type: String,
                              default: 'Part Authenticity',
                        },
                        description: {
                              type: String,
                              default: 'All original components',
                        },
                        status: {
                              type: String,
                              enum: ['passed', 'failed', 'warning'],
                              default: 'passed',
                        },
                        isOriginalComponents: {
                              type: Boolean,
                              default: true,
                        },
                  },
            },
            technicalBreakdown: {
                  processor: {
                        type: String,
                        required: true,
                  },
                  batteryHealth: {
                        percentage: {
                              type: Number,
                              min: 0,
                              max: 100,
                              required: true,
                        },
                        cycleCount: {
                              type: Number,
                              required: true,
                        },
                        label: {
                              type: String,
                        },
                  },
                  storage: {
                        total: {
                              type: String,
                              required: true,
                        },
                        free: {
                              type: String,
                              required: true,
                        },
                        label: {
                              type: String,
                        },
                  },
                  modem: {
                        type: String,
                        required: true,
                  },
                  display: {
                        type: String,
                        required: true,
                  },
                  warranty: {
                        status: {
                              type: String,
                              enum: ['active', 'expired', 'unknown'],
                              default: 'active',
                        },
                        expiresAt: {
                              type: Date,
                        },
                        label: {
                              type: String,
                        },
                  },
                  origin: {
                        country: {
                              type: String,
                              required: true,
                        },
                        modelNumber: {
                              type: String,
                              required: true,
                        },
                        label: {
                              type: String,
                        },
                  },
                  activation: {
                        lockStatus: {
                              type: String,
                              enum: ['locked', 'unlocked', 'unknown'],
                              default: 'unlocked',
                        },
                        simType: {
                              type: String,
                              enum: ['physical', 'e-sim', 'dual-sim', 'unknown'],
                              default: 'e-sim',
                        },
                        label: {
                              type: String,
                        },
                  },
            },
            reportActions: {
                  smartInvoiceCreated: {
                        type: Boolean,
                        default: false,
                  },
                  pdfCertificateUrl: {
                        type: String,
                        default: null,
                  },
                  isPdfGenerated: {
                        type: Boolean,
                        default: false,
                  },
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

ScanInfoSchema.index({ userId: 1, updatedAt: -1 });

const ScanInfo = model('ScanInfo', ScanInfoSchema);

export default ScanInfo;
