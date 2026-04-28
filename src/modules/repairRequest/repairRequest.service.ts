import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { uploadToCloudinary } from '../../utils/cloudinary';
import { User } from '../user/user.model';
import { IRepairRequest } from './repairRequest.interface';
import RepairRequest from './repairRequest.model';

const addNewRepairRequest = async (payload: IRepairRequest, files: Express.Multer.File[] = [], userId: string) => {
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', StatusCodes.UNAUTHORIZED);

      // basic validation
      if (!payload.firstName) throw new AppError('First name is required', StatusCodes.BAD_REQUEST);
      if (!payload.email) throw new AppError('Email is required', StatusCodes.BAD_REQUEST);
      if (!payload.deviceModel) throw new AppError('Device model is required', StatusCodes.BAD_REQUEST);
      if (!payload.description) throw new AppError('Description is required', StatusCodes.BAD_REQUEST);

      // upload files to cloudinary (if any)
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
            status: payload.status || 'submitted',
      });

      return newRequest;
};

const getMyRepairRequestsHistory = async (
  userId: string,
  query: any
) => {
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

const getShopKeepersShopsHistory = async (
  shopkeeperId: string,
  query: any
) => {
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
  }







const repairRequestService = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getShopKeepersShopsHistory,
      getSingleRepairRequest,
};

export default repairRequestService;
