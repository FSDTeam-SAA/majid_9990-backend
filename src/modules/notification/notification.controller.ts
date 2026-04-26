import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/sendResponse";
import catchAsync from "../../utils/catchAsync";
import Notification from "./notification.model";

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
