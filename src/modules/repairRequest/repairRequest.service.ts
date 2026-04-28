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

const repairRequestService = {
      addNewRepairRequest,
};

export default repairRequestService;
