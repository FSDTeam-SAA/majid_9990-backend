import bcrypt from 'bcrypt';
import { StatusCodes } from 'http-status-codes';
import mongoose, { Types } from 'mongoose';
import config from '../../config/config';
import AppError from '../../errors/AppError';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import sendEmail from '../../utils/sendEmail';
import { createToken } from '../../utils/tokenGenerate';
import verificationCodeTemplate from '../../utils/verificationCodeTemplate';
import { createNotification } from '../socket/notification.service';
import { getUserBalanceHistory } from '../payment/balanceTransaction.service';
import { IUser } from './user.interface';
import { User } from './user.model';

const registerUser = async (payload: IUser) => {
      if (!payload.role) {
            throw new AppError('You have to select a role ', StatusCodes.BAD_REQUEST);
      }

      const errors = [];

      if (payload.role === 'shopkeeper') {
            if (!payload.shopName) errors.push('Shop name is required for shopkeeper account.');
            if (!payload.shopAddress) errors.push('Shop address is required for shopkeeper account.');
            if (!payload.whatsappNumber) errors.push('WhatsApp number is required for shopkeeper account.');
      }

      if (payload.role === 'staff' && !payload.shopkeeperId) {
            errors.push('Shopkeeper ID is required for staff account.');
      }

      if (errors.length) {
            throw new Error(errors.join(' '));
      }

      // Validate shopkeeperId for staff
      if (payload.role === 'staff' && payload.shopkeeperId) {
            const shopkeeper = await User.findById(payload.shopkeeperId);
            if (!shopkeeper) {
                  throw new AppError('Shopkeeper not found', StatusCodes.NOT_FOUND);
            }
            if (shopkeeper.role !== 'shopkeeper') {
                  throw new AppError('The provided ID is not a shopkeeper', StatusCodes.BAD_REQUEST);
            }
            if (!shopkeeper.isVerified) {
                  throw new AppError('Shopkeeper account is not verified', StatusCodes.BAD_REQUEST);
            }
      }

      const existingUser = await User.isUserExistByEmail(payload.email);
      if (existingUser && existingUser.isVerified) {
            throw new AppError('User already exists', StatusCodes.CONFLICT);
      }

      // Password check
      if (payload.password.length < 6) {
            throw new AppError('Password must be at least 6 characters long', StatusCodes.BAD_REQUEST);
      }

      let result: IUser;

      if (payload.role === 'staff') {
            // Staff is auto-verified, no OTP needed
            if (existingUser && !existingUser.isVerified) {
                  result = (await User.findOneAndUpdate(
                        { email: existingUser.email },
                        { isVerified: true, shopkeeperId: payload.shopkeeperId },
                        { new: true }
                  )) as IUser;
            } else {
                  result = await User.create({
                        ...payload,
                        isVerified: true,
                  });
            }

            // Notify the shopkeeper
            await createNotification({
                  to: new mongoose.Types.ObjectId(payload.shopkeeperId as string),
                  message: `${result.firstName} ${result.lastName} has been added as a staff member.`,
                  type: 'REGISTRATION',
                  title: 'New Staff Added',
                  id: new mongoose.Types.ObjectId(result._id),
            });
      } else {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedOtp = await bcrypt.hash(otp, 10);
            const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

            if (existingUser && !existingUser.isVerified) {
                  result = (await User.findOneAndUpdate(
                        { email: existingUser.email },
                        { otp: hashedOtp, otpExpires },
                        { new: true }
                  )) as IUser;
            } else {
                  result = await User.create({
                        ...payload,
                        otp: hashedOtp,
                        otpExpires,
                        isVerified: false,
                  });
            }

            // Send email
            await sendEmail({
                  to: result.email,
                  subject: 'Verify your email',
                  html: verificationCodeTemplate(otp),
            });

            const roleText =
                  payload.role === 'user' ? 'customer' : payload.role === 'shopkeeper' ? 'shopkeeper' : payload.role;

            const admin = await User.findOne({ role: 'admin' });
            await createNotification({
                  to: new mongoose.Types.ObjectId(admin!._id),
                  message: `${result.firstName} ${result.lastName} just joined your platform as a ${roleText}.`,
                  type: 'REGISTRATION',
                  title: 'New User Registered',
                  id: new mongoose.Types.ObjectId(result._id),
            });
      }

      // JWT payload
      const JwtToken: Record<string, unknown> = {
            userId: result._id,
            email: result.email,
            role: result.role,
      };

      if (result.role === 'staff' && result.shopkeeperId) {
            JwtToken.shopkeeperId = result.shopkeeperId;
      }

      const accessToken = createToken(JwtToken, config.JWT_SECRET as string, config.JWT_EXPIRES_IN as string);

      const refreshToken = createToken(
            JwtToken,
            config.refreshTokenSecret as string,
            config.jwtRefreshTokenExpiresIn as string
      );

      return {
            accessToken,
            refreshToken,
            user: {
                  _id: result._id,
                  firstName: result.firstName,
                  lastName: result.lastName,
                  email: result.email,
                  role: result.role,
                  shopkeeperId: result.role === 'staff' ? result.shopkeeperId : undefined,
            },
      };
};

const verifyEmail = async (email: string, payload: string) => {
      const { otp }: any = payload;
      if (!otp) throw new Error('OTP is required');

      const existingUser = await User.findOne({ email });
      if (!existingUser) throw new AppError('No account found with the provided credentials.', StatusCodes.NOT_FOUND);

      if (!existingUser.otp || !existingUser.otpExpires) {
            throw new AppError('OTP not requested or expired', StatusCodes.BAD_REQUEST);
      }

      if (existingUser.otpExpires < new Date()) {
            throw new AppError('OTP has expired', StatusCodes.BAD_REQUEST);
      }

      if (existingUser.isVerified === true) {
            throw new AppError('User already verified', StatusCodes.CONFLICT);
      }

      const isOtpMatched = await bcrypt.compare(otp.toString(), existingUser.otp);
      if (!isOtpMatched) throw new AppError('Invalid OTP', StatusCodes.BAD_REQUEST);

      const result = await User.findOneAndUpdate(
            { email },
            {
                  isVerified: true,
                  $unset: { otp: '', otpExpires: '' },
            },
            { new: true }
      ).select('username email role');
      return result;
};

const resendOtpCode = async (email: string) => {
      const existingUser = await User.findOne({ email });
      if (!existingUser) throw new AppError('No account found with the provided credentials.', StatusCodes.NOT_FOUND);

      if (existingUser.isVerified === true) {
            throw new AppError('User already verified', StatusCodes.CONFLICT);
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(otp, 10);
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

      const result = await User.findOneAndUpdate(
            { email },
            {
                  otp: hashedOtp,
                  otpExpires,
            },
            { new: true }
      ).select('username email role');

      await sendEmail({
            to: existingUser.email,
            subject: 'Verify your email',
            html: verificationCodeTemplate(otp),
      });
      return result;
};

const getAllUsers = async () => {
      const result = await User.find().select(
            'username firstName lastName email phone role image isVerified wageType wageAmount workingDays weekendDays idVerificationStatus idNumber createdAt updatedAt'
      );
      return result;
};

const getAdminId = async () => {
      const admin = await User.findOne({ role: 'admin' }).select('_id');
      return admin;
};

const getMyProfile = async (email: string) => {
      const existingUser = await User.findOne({ email });
      if (!existingUser) throw new AppError('No account found with the provided credentials.', StatusCodes.NOT_FOUND);

      const result = await User.findOne({ email }).select(
            '-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires'
      );

      return result;
};

const updateUserProfile = async (payload: any, email: string, file: any) => {
      const user = await User.findOne({ email }).select('image');
      if (!user) throw new AppError('No account found with the provided credentials.', StatusCodes.NOT_FOUND);

      // eslint-disable-next-line prefer-const
      let updateData: any = { ...payload };
      let oldImagePublicId: string | undefined;

      if (file) {
            const uploadResult = await uploadToCloudinary(file.path);
            oldImagePublicId = user.image?.public_id;

            updateData.image = {
                  public_id: uploadResult!.public_id,
                  url: uploadResult!.secure_url,
            };
      }

      const result = await User.findOneAndUpdate({ email }, updateData, {
            new: true,
      }).select('-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires');

      if (file && oldImagePublicId) {
            await deleteFromCloudinary(oldImagePublicId);
      }

      return result;
};

const deleteUserFromDB = async (userId: string) => {
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', StatusCodes.NOT_FOUND);

      const result = await User.findByIdAndDelete(userId);
      return result;
};

const createStaff = async (payload: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phone?: string;
      shopkeeperId: string;
      wageType?: 'per-day' | 'per-hour';
      wageAmount?: number;
      workingDays?: string[];
      weekendDays?: string[];
      idVerificationStatus?: 'pending' | 'verified' | 'rejected';
      idNumber?: string;
}) => {
      const {
            firstName,
            lastName,
            email,
            password,
            phone,
            shopkeeperId,
            wageType,
            wageAmount,
            workingDays,
            weekendDays,
            idVerificationStatus,
            idNumber,
      } = payload;

      if (!shopkeeperId) {
            throw new AppError('Shopkeeper ID is required', StatusCodes.BAD_REQUEST);
      }

      const shopkeeper = await User.findById(shopkeeperId);
      if (!shopkeeper) {
            throw new AppError('Shopkeeper not found', StatusCodes.NOT_FOUND);
      }
      if (shopkeeper.role !== 'shopkeeper') {
            throw new AppError('The provided ID is not a shopkeeper', StatusCodes.BAD_REQUEST);
      }

      const existingUser = await User.isUserExistByEmail(email);
      if (existingUser) {
            throw new AppError('A user with this email already exists', StatusCodes.CONFLICT);
      }

      if (password.length < 6) {
            throw new AppError('Password must be at least 6 characters long', StatusCodes.BAD_REQUEST);
      }

      const result = await User.create({
            firstName,
            lastName,
            email,
            password,
            phone,
            role: 'staff',
            shopkeeperId: new Types.ObjectId(shopkeeperId),
            isVerified: true,
            wageType,
            wageAmount,
            workingDays,
            weekendDays,
            idVerificationStatus,
            idNumber,
      });

      await createNotification({
            to: new mongoose.Types.ObjectId(shopkeeperId),
            message: `${result.firstName} ${result.lastName} has been added as a staff member.`,
            type: 'REGISTRATION',
            title: 'New Staff Added',
            id: new mongoose.Types.ObjectId(result._id),
      });

      return await User.findById(result._id).select(
            '-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires'
      );
};

const getAllStaffByShopkeeper = async (shopkeeperId: string) => {
      if (!Types.ObjectId.isValid(shopkeeperId)) {
            throw new AppError('Invalid shopkeeper ID', StatusCodes.BAD_REQUEST);
      }

      const result = await User.find({
            role: 'staff',
            shopkeeperId: new Types.ObjectId(shopkeeperId),
      }).select('-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires');

      return result;
};

const getMyShopkeeperData = async (userId: string) => {
      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }
      if (user.role !== 'staff') {
            throw new AppError('Only staff members can access this', StatusCodes.FORBIDDEN);
      }

      const shopkeeper = await User.findById(user.shopkeeperId).select(
            '-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires'
      );
      if (!shopkeeper) {
            throw new AppError('Associated shopkeeper not found', StatusCodes.NOT_FOUND);
      }

      return shopkeeper;
};

const getAllShopkeepers = async (query: any) => {
      const { page = 1, limit = 10, search, minRating, maxRating } = query;
      const skip = (Number(page) - 1) * Number(limit);
      const filter: any = { role: 'shopkeeper' };

      //  Rating filter (directly on user)
      if (minRating || maxRating) {
            filter.averageRating = {};

            if (minRating) filter.averageRating.$gte = Number(minRating);
            if (maxRating) filter.averageRating.$lte = Number(maxRating);
      }

      // Search (on user fields, since no shop model exists)
      if (search) {
            filter.$or = [
                  { shopName: { $regex: search, $options: 'i' } },
                  { shopAddress: { $regex: search, $options: 'i' } },
            ];
      }

      const data = await User.find(filter)
            .select('shopName shopAddress totalReviews averageRating')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

      const total = await User.countDocuments(filter);

      return {
            data,
            meta: {
                  total,
                  page: Number(page),
                  limit: Number(limit),
                  totalPage: Math.ceil(total / limit),
            },
      };
};

const getBalanceHistory = async (userId: string, query: any) => {
      return await getUserBalanceHistory(userId, query);
};

const userService = {
      registerUser,
      verifyEmail,
      resendOtpCode,
      getAllUsers,
      getMyProfile,
      updateUserProfile,
      getAdminId,
      deleteUserFromDB,
      getAllShopkeepers,
      getBalanceHistory,
      createStaff,
      getAllStaffByShopkeeper,
      getMyShopkeeperData,
};

export default userService;
