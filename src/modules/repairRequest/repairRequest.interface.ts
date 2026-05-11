import { Types } from 'mongoose';

export type RepairStatus =
      | 'inProgress'
      | 'approved'
      | 'rejected'
      | 'completed'
      | 'inReview'
      | 'start-work'
      | 'quote-sent'
      | 'waiting-for-parts';

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

export interface IRepairRequest {
      userId: Types.ObjectId;
      firstName: string;
      email: string;
      deviceModel: string;
      IMEINumber: string;
      description: string;
      status: RepairStatus;
      waitingForPartsDays?: number;
      waitingForPartsDescription?: string;
      shopkeeperNotes?: INote;
      technicianNotes?: ITechNote[];
      createdAt: Date;
      updatedAt: Date;
}

export interface IRepairRequestStatusUpdatePayload {
      status: RepairStatus;
      waitingForPartsDays?: number | string;
      waitingForPartsDescription?: string;
}
