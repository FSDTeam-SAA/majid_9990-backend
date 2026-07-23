import Stripe from 'stripe';
import { Request, Response } from 'express';
import config from '../../config/config';
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
            message: 'Stripe session created',
            data: session,
      });
});

// Webhook (IMPORTANT: raw body)
const stripeWebhook = async (req: Request, res: Response) => {
      const sig = req.headers['stripe-signature'];

      if (!sig || Array.isArray(sig)) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing stripe signature' });
      }

      const stripe = new Stripe((config as any).stripe_secret_key as string);

      const event = stripe.webhooks.constructEvent(req.body, sig, (config as any).stripe_webhook_secret as string);

      await paymentService.handleStripeWebhook(event);

      res.json({ received: true });
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
      const result = await paymentService.updatePaymentStatus(req.params.id, req.body?.paymentStatus);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Payment status updated',
            data: result,
      });
});

const deletePayment = catchAsync(async (req, res) => {
      const result = await paymentService.deletePayment(req.params.id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Payment deleted',
            data: result,
      });
});

export default {
      createPayment,
      stripeWebhook,
      getMyPayments,
      getAllPayments,
      updatePaymentStatus,
      deletePayment,
};
