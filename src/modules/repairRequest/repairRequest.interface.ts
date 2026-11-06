import { Types } from 'mongoose';

export type RepairStatus =
      | 'inProgress'
      | 'approved'
      | 'rejected'
      | 'completed'
      | 'collected'
      | 'inReview'
      | 'start-work'
      | 'quote-sent'
      | 'waiting-for-parts'
      | 'unable-to-repair';

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
      firstName: string;
      email: string;
      phoneNumber: string;
      price?: number;
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
      IMEINumber: string;
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
}
