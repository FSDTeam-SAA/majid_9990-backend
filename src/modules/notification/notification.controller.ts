import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/sendResponse";
import catchAsync from "../../utils/catchAsync";
import Notification from "./notification.model";
import AppError from "../../errors/AppError";

export const markAllAsRead = catchAsync(async (req, res) => {
      const result = await Notification.updateMany({ isViewed: false }, { isViewed: true });

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'All notifications marked as read successfully',
            data: result,
      });
});


export const getAllNotifications = catchAsync(async (req, res) => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const total = await Notification.countDocuments();
      const notifications = await Notification.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Notifications fetched successfully',
            meta: {
                  page,
                  limit,
                  totalPage: Math.ceil(total / limit),
                  total,
            },
            data: notifications,
      });
});




export const getShopkeeperAllNotifications = catchAsync(async (req, res) => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const shopkeeperId = req.user?.id || req.user?._id;

      if (!shopkeeperId) {
            throw new AppError('Unauthorized request', StatusCodes.UNAUTHORIZED);
      }

      const total = await Notification.countDocuments({
            to: shopkeeperId, 
      });

      const notifications = await Notification.find({
            to: shopkeeperId, 
      })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Shopkeeper notifications fetched successfully',
            meta: {
                  page,
                  limit,
                  totalPage: Math.ceil(total / limit),
                  total,
            },
            data: notifications,
      });
});


export const getAllNotificationByUser = catchAsync(async (req, res) => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const userId = req.user?.id || req.user?._id;

      if (!userId) {
            throw new AppError('Unauthorized request', StatusCodes.UNAUTHORIZED);
      }

      const total = await Notification.countDocuments({
            to: userId, 
      });

      const notifications = await Notification.find({
            to: userId, 
      })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'User notifications fetched successfully',
            meta: {
                  page,
                  limit,
                  totalPage: Math.ceil(total / limit),
                  total,
            },
            data: notifications,    
      });
});

export const getAllNotificationByAdmin = catchAsync(async (req, res) => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const total = await Notification.countDocuments();

      const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Admin notifications fetched successfully',
            meta: {
                  page,
                  limit,
                  totalPage: Math.ceil(total / limit),
                  total,
            },
            data: notifications,    
      });
});

export const getSingleNotification = catchAsync(async (req, res) => {
      const notification = await Notification.findById(req.params.id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Notification retrieved successfully',
            data: notification,
      });
});


export const markAsReadSingleNotification = catchAsync(async (req, res) => {
      const { id } = req.params;
      const notification = await Notification.findById(id);

      if (!notification) {
            throw new AppError('Notification not found', StatusCodes.NOT_FOUND);
      }

      await Notification.findByIdAndUpdate(id, { isViewed: true });

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Notification marked as read successfully',
            data: notification,
      });
})