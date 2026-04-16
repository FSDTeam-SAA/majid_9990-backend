import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import subscriptionService from './subscription.service';

const createSubscription = catchAsync(async (req, res) => {
      const result = await subscriptionService.createSubscription(req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Subscription created successfully',
            data: result,
      });
});

const getAllSubscriptions = catchAsync(async (req, res) => {
      const result = await subscriptionService.getAllSubscriptions();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Subscriptions retrieved successfully',
            data: result,
      });
});

const updateSubscription = catchAsync(async (req, res) => {
      const { id } = req.params;
      const result = await subscriptionService.updateSubscription(id as string, req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Subscription updated successfully',
            data: result,
      });
});

const subscriptionController = {
      createSubscription,
      getAllSubscriptions,
      updateSubscription
};

export default subscriptionController;
