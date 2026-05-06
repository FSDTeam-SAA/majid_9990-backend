import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { uploadToCloudinary } from '../../utils/cloudinary';
import { User } from '../user/user.model';
import { IRepairRequest } from './repairRequest.interface';
import RepairRequest from './repairRequest.model';
import { createNotification } from '../socket/notification.service';
import mongoose from 'mongoose';

const addNewRepairRequest = async (payload: IRepairRequest, files: Express.Multer.File[] = [], userId: string) => {
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', StatusCodes.UNAUTHORIZED);

      if (!payload.firstName) throw new AppError('First name is required', StatusCodes.BAD_REQUEST);
      if (!payload.email) throw new AppError('Email is required', StatusCodes.BAD_REQUEST);
      if (!payload.deviceModel) throw new AppError('Device model is required', StatusCodes.BAD_REQUEST);
      if (!payload.description) throw new AppError('Description is required', StatusCodes.BAD_REQUEST);

      const images: { public_id: string; url: string }[] = [];
      for (const file of files) {
            const uploaded = await uploadToCloudinary(file.path);
            if (uploaded && uploaded.public_id && uploaded.secure_url) {
                  images.push({ public_id: uploaded.public_id, url: uploaded.secure_url });
            }
      }

      const newRequest = await RepairRequest.create({
            shopkeeperId: payload.shopkeeperId,
            userId: payload.userId || user._id,
            firstName: payload.firstName,
            email: payload.email,
            deviceModel: payload.deviceModel,
            IMEINumber: payload.IMEINumber,
            description: payload.description,
            images,
            status: payload.status || 'request_submitted',
      });

      return newRequest;
};

const getMyRepairRequestsHistory = async (userId: string, query: any) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = { userId };

      const data = await RepairRequest.find(filter)
            .populate({
                  path: 'shopkeeperId',
                  select: 'shopName',
            })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

      const total = await RepairRequest.countDocuments(filter);

      return {
            data,
            meta: {
                  page,
                  limit,
                  total,
                  totalPage: Math.ceil(total / limit),
            },
      };
};

const getShopKeepersShopsHistory = async (shopkeeperId: string, query: any) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;

      const skip = (page - 1) * limit;

      const filter = { shopkeeperId };

      const data = await RepairRequest.find(filter)
            .populate({
                  path: 'userId',
                  select: 'firstName',
            })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

      const total = await RepairRequest.countDocuments(filter);

      return {
            data,
            meta: {
                  page,
                  limit,
                  total,
                  totalPage: Math.ceil(total / limit),
            },
      };
};

const getSingleRepairRequest = async (id: string) => {
      const result = await RepairRequest.findById(id).populate({
            path: 'shopkeeperId',
            select: 'shopName',
      });

      return result;
};

const updateStatusByShopKeeper = async (id: string, payload: any) => {
      const result = await RepairRequest.findByIdAndUpdate(id, payload, { new: true });

      await createNotification({
            to: result!.userId,
            message:
                  result?.status === 'in_review'
                        ? 'Your repair request has been under review'
                        : 'Your repair request has been rejected',
            type: 'REPAIR_REQUEST',
            title: 'Your repair request status updated',
            id: new mongoose.Types.ObjectId(),
      });

      return result;
};

const addNoteByShopKeeper = async (id: string, payload: any, files: Express.Multer.File[] = []) => {
      const { message, cost, estimatedDays } = payload;

      // Upload images to Cloudinary if provided
      const images: { public_id: string; url: string }[] = [];
      for (const file of files) {
            const uploaded = await uploadToCloudinary(file.path);
            if (uploaded && uploaded.public_id && uploaded.secure_url) {
                  images.push({ public_id: uploaded.public_id, url: uploaded.secure_url });
            }
      }

      const newNote = {
            message,
            cost,
            estimatedDays,
            status: 'inProgress',
            date: new Date(),
            images,
      };

      const result = await RepairRequest.findByIdAndUpdate(
            id,
            {
                  $push: {
                        shopkeeperNotes: newNote,
                  },
                  $set: {
                        status: 'quote_sent',
                  },
            },
            { new: true }
      );

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      await createNotification({
            to: result.userId,
            type: 'REPAIR_REQUEST',
            id: new mongoose.Types.ObjectId(),

            title: 'Repair Quote Received',
            message: 'Your repair request has received a quotation from the shopkeeper. Please review the estimated cost and timeline.',
      });

      return result;
};

const updateQuoteStatusByUser = async (id: string, payload: any) => {
      const { shopkeeperNotesId, status } = payload;
      const allowedStatus = ['approved', 'rejected'];

      if (!allowedStatus.includes(status)) {
            throw new AppError('Invalid status. Use approved or rejected', StatusCodes.BAD_REQUEST);
      }

      let mainStatus = 'quote_sent';
      let notificationTitle = '';
      let notificationMessage = '';

      if (status === 'approved') {
            mainStatus = 'quote_accepted';

            notificationTitle = 'Repair Quote Accepted';
            notificationMessage =
                  'Good news! Your repair quotation has been accepted by the customer. You may now proceed with the repair process.';
      }

      if (status === 'rejected') {
            mainStatus = 'quote_rejected';

            notificationTitle = 'Repair Quote Rejected';
            notificationMessage =
                  'The customer has declined your repair quotation. You may review the request and submit a revised quote if needed.';
      }

      const result = await RepairRequest.findOneAndUpdate(
            {
                  _id: id,
                  'shopkeeperNotes._id': shopkeeperNotesId,
            },
            {
                  $set: {
                        'shopkeeperNotes.$.status': status,
                        status: mainStatus,
                  },
            },
            { new: true }
      );

      if (!result) {
            throw new AppError('Repair request or quote not found', StatusCodes.NOT_FOUND);
      }

      await createNotification({
            to: result.shopkeeperId,
            type: 'REPAIR_REQUEST',
            id: new mongoose.Types.ObjectId(),

            title: notificationTitle,
            message: notificationMessage,
      });

      return result;
};

const quoteResentByUser = async (id: string, payload: any) => {
      const { message, cost, estimatedDays } = payload;

      const repairRequest = await RepairRequest.findById(id);
      if (!repairRequest) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      if (repairRequest.status === 'completed') {
            throw new AppError('Repair request is already completed', StatusCodes.BAD_REQUEST);
      }

      const newNote = {
            message,
            cost,
            estimatedDays,
            status: 'inProgress',
            date: new Date(),
      };

      const result = await RepairRequest.findByIdAndUpdate(
            id,
            {
                  $push: {
                        userNotes: newNote,
                  },
                  $set: {
                        status: 'quote-resent',
                  },
            },
            { new: true }
      );

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      await createNotification({
            to: result.shopkeeperId,
            type: 'RESENT_QUOTE',
            id: new mongoose.Types.ObjectId(),
            title: 'Resent Repair Quote',
            message: 'Your customer has resent a new quote for your repair request. Please review the details.',
      });

      return result;
};

const updateQuoteStatusByShopKeeper = async (id: string, payload: any) => {
      const { userNotesId, status } = payload;
      const allowedStatus = ['approved', 'rejected'];

      if (!allowedStatus.includes(status)) {
            throw new AppError('Invalid status. Use approved or rejected', StatusCodes.BAD_REQUEST);
      }

      let mainStatus = 'quote_sent';
      let notificationTitle = '';
      let notificationMessage = '';

      if (status === 'approved') {
            mainStatus = 'quote_accepted';

            notificationTitle = 'Quote Approved by Shopkeeper';
            notificationMessage =
                  'The shopkeeper has approved your repair request and is ready to proceed. Your item will be repaired as discussed.';
      }

      if (status === 'rejected') {
            mainStatus = 'quote_rejected';

            notificationTitle = 'Quote Rejected by Shopkeeper';
            notificationMessage =
                  'The shopkeeper has rejected your repair request. You may contact them for more details or try another service provider.';
      }

      const result = await RepairRequest.findOneAndUpdate(
            {
                  _id: id,
                  'userNotes._id': userNotesId,
            },
            {
                  $set: {
                        'userNotes.$.status': status,
                        status: mainStatus,
                  },
            },
            { new: true }
      );

      if (!result) {
            throw new AppError('Repair request or quote not found', StatusCodes.NOT_FOUND);
      }

      await createNotification({
            to: result.shopkeeperId,
            type: 'REPAIR_REQUEST',
            id: new mongoose.Types.ObjectId(),
            title: notificationTitle,
            message: notificationMessage,
      });

      return result;
};

const repairRequestService = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getShopKeepersShopsHistory,
      getSingleRepairRequest,
      updateStatusByShopKeeper,
      addNoteByShopKeeper,
      updateQuoteStatusByUser,
      quoteResentByUser,
      updateQuoteStatusByShopKeeper,
};

export default repairRequestService;
