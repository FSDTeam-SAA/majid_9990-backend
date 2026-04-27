import { Types } from "mongoose";
export interface IRepairEstimate {
      cost: number;
      currency: string;
      estimatedDays: number;
      approved: boolean;
}

export type RepairStatus =
      | 'submitted'
      | 'in_review'
      | 'quote_sent'
      | 'approved'
      | 'rejected'
      | 'in_progress'
      | 'completed';
      export interface IRepairTimeline {
        status: RepairStatus;
        message?: string;
        createdAt: Date;
      }
      export interface INote{
            message: string;
            date: Date
      }
export interface IRepairRequest {
      shopkeeperId: Types.ObjectId;
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
      estimate?: IRepairEstimate;
      timeline: IRepairTimeline[];
      shopkeeperNotes?: INote;
      createdAt: Date;
      updatedAt: Date;
}
