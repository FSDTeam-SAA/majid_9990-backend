import { Types } from 'mongoose';

export type RepairStatus =
      | 'inProgress'
      | 'approved'
      | 'rejected'
      | 'completed'
      | 'collected'
      | 'ready-for-collection'
      | 'inReview'
      | 'start-work'
      | 'quote-sent'
      | 'quote_sent'
      | 'waiting-for-parts'
      | 'order-assigned'
      | 'diagnosing'
      | 'repairing'
      | 'reassigned'
      | 'unable-to-repair';

export interface IDevicePasscode {
      type: 'none' | 'pin' | 'password' | 'pattern';
      encryptedValue?: string;
      isSet: boolean;
      maskedValue?: string;
      lengthHint?: number;
      updatedAt?: Date;
}

export interface INote {
      message: string;
      cost: number;
      estimatedDays: number;
      date: Date;
      images: {
            public_id: string;
            url: string;
      }[];
      assignedPerson: string;
}

export interface ITechNote {
      partName: string;
      cost: number;
      time: number;
}

export interface IRepairIssue {
      id?: string;
      category: string;
      problems: string[];
      additionalInfo?: string;
      estimatedTime?: string;
      estimatedPrice?: number;
      selectedPart?: {
            variantId?: Types.ObjectId | string;
            partName: string;
            quality?: string;
            price: number;
            sku?: string;
            quantity?: number;
      };
}

export interface IEvidencePhoto {
      url: string;
      public_id?: string;
      uploadedAt: Date;
      autoDeleteAt: Date;
      usedFor?: string;
      photoType?: 'booking' | 'completion' | 'note';
}

export interface IRepairHistoryItem {
      title: string;
      description?: string;
      actor?: string;
      createdAt: Date;
      icon?: string;
}

export interface IRepairRequest {
      orderNumber?: string;
      userId: Types.ObjectId;
      shopId?: Types.ObjectId | null;
      customerId?: Types.ObjectId | null;
      firstName: string;
      email: string;
      phoneNumber: string;
      price?: number;
      currency?: string;
      deviceModel: string;
      category?: string;
      brand?: string;
      modelName?: string;
      modelCode?: string;
      releaseYear?: string;
      colour?: string;
      condition?: 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor';
      serialType?: 'imei' | 'serial' | 'both';
      serialNumber?: string;
      IMEINumber?: string;
      devicePasscode?: IDevicePasscode;
      description: string;
      issues?: IRepairIssue[];
      evidencePhotos?: IEvidencePhoto[];
      history?: IRepairHistoryItem[];
      technician?: string;
      technicianFeedback?: string;
      status: RepairStatus;
      waitingForPartsDays?: number;
      waitingForPartsDescription?: string;
      unableToRepairReason?: string;
      unableToRepairNote?: string;
      unableToRepairCustomerMessage?: string;
      rejectionReason?: string;
      expectedCollectionDate?: Date | string;
      rejectedAt?: Date;
      completedAt?: Date;
      shopkeeperNotes?: INote[];
      technicianNotes?: ITechNote[];
      createdAt: Date;
      updatedAt: Date;
}

export interface IRepairRequestStatusUpdatePayload {
      status: RepairStatus;
      waitingForPartsDays?: number | string;
      waitingForPartsDescription?: string;
      unableToRepairReason?: string;
      unableToRepairNote?: string;
      unableToRepairCustomerMessage?: string;
      rejectionReason?: string;
      expectedCollectionDate?: Date | string;
      issues?: IRepairIssue[];
      price?: number;
      description?: string;
      photoType?: 'booking' | 'completion' | 'note';
}
