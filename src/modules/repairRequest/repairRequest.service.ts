import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { uploadToCloudinary } from '../../utils/cloudinary';
import { User } from '../user/user.model';
import { IRepairRequest } from './repairRequest.interface';
import RepairRequest from './repairRequest.model';

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
            userId: payload.userId || user._id,
            firstName: payload.firstName,
            email: payload.email,
            deviceModel: payload.deviceModel,
            IMEINumber: payload.IMEINumber,
            description: payload.description,
            images,
            status: payload.status || 'inProgress',
      });

      return newRequest;
};

const getMyRepairRequestsHistory = async (userId: string, query: any) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = { userId };
      const data = await RepairRequest.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });
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
      const result = await RepairRequest.findById(id);
      return result;
};

const updateStatusByShopKeeper = async (id: string, payload: any) => {
      const result = await RepairRequest.findByIdAndUpdate(id, payload, { new: true });
      return result;
};

const addNoteByShopKeeper = async (id: string, payload: any, files: Express.Multer.File[] = []) => {
      const { message, cost, estimatedDays, assignedPerson } = payload;

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
            date: new Date(),
            images,
            assignedPerson,
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

      return result;
};

const repairRequestService = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getSingleRepairRequest,
      updateStatusByShopKeeper,
      addNoteByShopKeeper,
};

export default repairRequestService;
