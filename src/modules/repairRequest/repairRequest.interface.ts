import { Types } from 'mongoose';

export type RepairStatus =
      | 'request_submitted'
      | 'in_review'
      | 'quote_sent'
      | 'approved'
      | 'rejected'
      | 'repair_in_progress'
      | 'completed'
      | 'quote_accepted'
      | 'quote_rejected'
      | 'quote-resent';

export interface INote {
      message: string;
      cost: number;
      estimatedDays: number;
      date: Date;
      status: 'inProgress' | 'approved' | 'rejected';
      images: {
            public_id: string;
            url: string;
      }[];
}

export interface IRepairRequest {
      userId: Types.ObjectId;
      firstName: string;
      email: string;
      deviceModel: string;
      IMEINumber: string;
      description: string;
      images: {
            public_id: string;
            url: string;
      }[];
      status: RepairStatus;
      shopkeeperNotes?: INote;
      createdAt: Date;
      updatedAt: Date;
}
