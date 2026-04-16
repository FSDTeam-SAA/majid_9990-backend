import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import subscriptionService from './subscription.service';

const creteSubscription = catchAsync(async (req, res) => {
      const result = await subscriptionService.creteSubscription(req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Subscription created successfully',
            data: result,
      });
});

const subscriptionController = {
      creteSubscription,
};

export default subscriptionController;