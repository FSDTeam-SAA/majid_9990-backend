import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import paymentService from './payment.service';
import { StatusCodes } from 'http-status-codes';

// Create session
const createPayment = catchAsync(async (req, res) => {
  const session = await paymentService.createPaymentSession(req.user, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Ryft payment session created',
    data: session,
  });
});

// Ryft Webhook Handler
const ryftWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['signature'] || req.headers['x-ryft-signature'] || req.headers['stripe-signature'];
    const rawBody = req.body;

    const isValid = paymentService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid webhook signature' });
    }

    let payload = rawBody;
    if (Buffer.isBuffer(rawBody)) {
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (err) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid JSON payload' });
      }
    } else if (typeof rawBody === 'string') {
      try {
        payload = JSON.parse(rawBody);
      } catch (err) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid JSON payload' });
      }
    }

    await paymentService.handleRyftWebhook(payload);

    res.status(StatusCodes.OK).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error?.message || 'Webhook processing failed' });
  }
};

// My payments
const getMyPayments = catchAsync(async (req, res) => {
  const result = await paymentService.getMyPayments(req.user._id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'My payments fetched',
    data: result,
  });
});

// All payments (admin)
const getAllPayments = catchAsync(async (req, res) => {
  const result = await paymentService.getAllPayments();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All payments fetched',
    data: result,
  });
});

const updatePaymentStatus = catchAsync(async (req, res) => {
  const result = await paymentService.updatePaymentStatus(req.params.id as string, req.body?.paymentStatus);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment status updated',
    data: result,
  });
});

const deletePayment = catchAsync(async (req, res) => {
  const result = await paymentService.deletePayment(req.params.id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment deleted',
    data: result,
  });
});

export default {
  createPayment,
  ryftWebhook,
  stripeWebhook: ryftWebhook, // alias for safety
  getMyPayments,
  getAllPayments,
  updatePaymentStatus,
  deletePayment,
};
