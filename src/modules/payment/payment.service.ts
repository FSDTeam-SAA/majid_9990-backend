import crypto from 'crypto';
import axios from 'axios';
import config from '../../config/config';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { Shop } from '../shop/shop.model';
import { Payment } from './payment.model';
import { creditUserBalance } from './balanceTransaction.service';
import { TPaymentStatus } from './payment.interface';

const getRyftSecretKey = (): string => {
  const secretKey = (config as { ryft_secret_key?: string }).ryft_secret_key;
  if (!secretKey) {
    throw new AppError('Ryft is not configured. Missing RYFT_SECRET_KEY.', 500);
  }
  return secretKey;
};

const getRyftBaseUrl = (): string => {
  return (config as { ryft_base_url?: string }).ryft_base_url || 'https://api.ryftpay.com/v1';
};

const getRyftHeaders = () => {
  const secretKey = getRyftSecretKey();
  return {
    Authorization: secretKey,
    'Content-Type': 'application/json',
  };
};

const creditPaymentBalance = async (payment: any) => {
  const user = await User.findById(payment.userId);

  let creditUserId = payment.userId.toString();

  if (user) {
    if (user.role === 'user') {
      await User.findByIdAndUpdate(payment.userId, { role: 'shopkeeper' });
    } else if (user.role === 'staff') {
      if (!user.shopkeeperId) {
        throw new AppError('Staff user has no associated shopkeeper', 400);
      }
      creditUserId = user.shopkeeperId.toString();
    }
  }

  const paymentIdentifier = payment.ryftPaymentSessionId || payment.stripeSessionId || payment._id.toString();

  await creditUserBalance({
    userId: creditUserId,
    amount: payment.amount,
    currency: payment.currency,
    source: 'payment',
    description: `Balance credited from payment ${paymentIdentifier}`.trim(),
    referenceId: payment._id.toString(),
    paymentId: payment._id.toString(),
  });
};

// ✅ Create Ryft Payment Session
const createPaymentSession = async (user: any, payload: any) => {
  const { amount, subscriptionId, currency = 'GBP', paymentType = 'plan', shopId } = payload;
  const frontendUrl = (config as { frontend_url?: string }).frontend_url ?? '';
  const ryftBaseUrl = getRyftBaseUrl();
  const ryftPublicKey = (config as { ryft_public_key?: string }).ryft_public_key ?? '';

  const normalizedCurrency = String(currency || 'GBP').toUpperCase();
  const unitAmount = Math.round(Number(amount) * 100);

  const requestBody = {
    amount: unitAmount,
    currency: normalizedCurrency,
    customerEmail: user?.email,
    returnUrl: `${frontendUrl}/payment/success`,
    metadata: {
      userId: user._id.toString(),
      subscriptionId: subscriptionId ? String(subscriptionId) : '',
      paymentType,
      ...(shopId ? { shopId: String(shopId) } : {}),
    },
  };

  let ryftSession: any;

  try {
    const response = await axios.post(`${ryftBaseUrl}/payment-sessions`, requestBody, {
      headers: getRyftHeaders(),
      timeout: 30000,
    });
    ryftSession = response.data;
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Failed to create Ryft payment session';
    console.error('Ryft create payment session error:', error?.response?.data || error);
    throw new AppError(`Ryft payment session creation failed: ${errorMessage}`, 502);
  }

  // save pending payment
  const payment = await Payment.create({
    userId: user._id,
    subscriptionId,
    amount,
    currency: normalizedCurrency.toLowerCase(),
    ryftPaymentSessionId: ryftSession.id,
    clientSecret: ryftSession.clientSecret,
    paymentStatus: 'pending',
    paymentMethod: 'RyftPay',
    paymentType,
    ...(shopId ? { shopId } : {}),
  });

  return {
    id: ryftSession.id,
    clientSecret: ryftSession.clientSecret,
    status: ryftSession.status,
    amount: Number(amount),
    currency: normalizedCurrency,
    publicKey: ryftPublicKey,
    paymentId: payment._id.toString(),
    url: `${frontendUrl}/payment/checkout?clientSecret=${encodeURIComponent(ryftSession.clientSecret)}&sessionId=${encodeURIComponent(ryftSession.id)}`,
  };
};

const markPaymentAsPaid = async (payment: any, sessionData?: any) => {
  const paymentId =
    typeof sessionData?.paymentId === 'string'
      ? sessionData.paymentId
      : sessionData?.id || sessionData?.lastPaymentId;

  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, paymentStatus: { $ne: 'paid' } },
    {
      paymentStatus: 'paid',
      ryftPaymentId: paymentId,
      paymentMethod: sessionData?.paymentMethod || 'RyftPay',
    },
    { new: true }
  );

  if (updatedPayment) {
    if (updatedPayment.paymentType === 'add_shop' && updatedPayment.shopId) {
      await Shop.updateOne(
        { _id: updatedPayment.shopId },
        { $set: { isActive: true, activatedAt: new Date() } }
      );
    } else {
      await creditPaymentBalance(updatedPayment);
    }
  }

  return updatedPayment;
};

// Verify Webhook Signature
const verifyWebhookSignature = (rawBody: Buffer | string, signatureHeader?: string | string[]): boolean => {
  const webhookSecret = (config as { ryft_webhook_secret?: string }).ryft_webhook_secret;

  if (!webhookSecret || webhookSecret === 'whsec_replace_me' || webhookSecret === 'whsec_xxx') {
    // If not configured, proceed in development / test mode
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const sig = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  try {
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const hmac = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

    // Support both raw hex and sha256=hex format
    const expected = sig.startsWith('sha256=') ? sig.slice(7) : sig;

    const hmacBuffer = Buffer.from(hmac, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (hmacBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hmacBuffer, expectedBuffer);
  } catch (error) {
    console.error('Ryft webhook signature verification error:', error);
    return false;
  }
};

// Handle Webhook
const handleRyftWebhook = async (event: any) => {
  const eventType = String(event?.eventType || event?.type || '').toLowerCase();
  const eventData = event?.data || event?.paymentSession || event;

  const sessionId = eventData?.id || eventData?.paymentSessionId || eventData?.sessionId;
  const metadataPaymentId = eventData?.metadata?.paymentId;

  const query: any = {};
  if (sessionId) {
    query.ryftPaymentSessionId = sessionId;
  } else if (metadataPaymentId) {
    query._id = metadataPaymentId;
  } else {
    console.warn('Ryft webhook received with no identifiable session ID', event);
    return;
  }

  const isSuccessEvent =
    eventType.includes('captured') ||
    eventType.includes('approved') ||
    eventType.includes('succeeded') ||
    String(eventData?.status || '').toLowerCase() === 'captured' ||
    String(eventData?.status || '').toLowerCase() === 'approved';

  const isFailureEvent =
    eventType.includes('failed') ||
    eventType.includes('cancelled') ||
    eventType.includes('expired') ||
    String(eventData?.status || '').toLowerCase() === 'failed';

  if (isSuccessEvent) {
    const payment = await Payment.findOne({ ...query, paymentStatus: { $ne: 'paid' } });
    if (payment) {
      await markPaymentAsPaid(payment, eventData);
    }
  } else if (isFailureEvent) {
    await Payment.findOneAndUpdate(
      { ...query, paymentStatus: { $ne: 'paid' } },
      { paymentStatus: 'failed' }
    );
  }
};

// Sync Pending Payments
const syncPendingPayments = async () => {
  const ryftBaseUrl = getRyftBaseUrl();
  const secretKey = (config as { ryft_secret_key?: string }).ryft_secret_key;

  if (!secretKey || secretKey === 'sk_test_replace_me') {
    return { processed: 0, updatedCount: 0 };
  }

  const pendingPayments = await Payment.find({
    paymentStatus: 'pending',
    ryftPaymentSessionId: { $exists: true, $ne: '' },
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  let updatedCount = 0;

  for (const payment of pendingPayments) {
    if (!payment.ryftPaymentSessionId) {
      continue;
    }

    try {
      const response = await axios.get(
        `${ryftBaseUrl}/payment-sessions/${payment.ryftPaymentSessionId}`,
        {
          headers: getRyftHeaders(),
          timeout: 15000,
        }
      );

      const session: any = response.data;
      const status = String(session?.status || '').toLowerCase();

      const isPaid = status === 'captured' || status === 'approved' || status === 'succeeded';
      const isFailed = status === 'failed' || status === 'expired' || status === 'cancelled';

      if (isPaid) {
        await markPaymentAsPaid(payment, session);
        updatedCount += 1;
        continue;
      }

      if (isFailed) {
        await Payment.findOneAndUpdate(
          { _id: payment._id, paymentStatus: { $ne: 'paid' } },
          { paymentStatus: 'failed' }
        );
        updatedCount += 1;
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        await Payment.findOneAndUpdate(
          { _id: payment._id, paymentStatus: { $ne: 'failed' } },
          { paymentStatus: 'failed' }
        );
        updatedCount += 1;
        continue;
      }

      console.error(`Ryft payment sync failed for ${payment.ryftPaymentSessionId}`, error?.message || error);
    }
  }

  return { processed: pendingPayments.length, updatedCount };
};

const startPaymentStatusSyncScheduler = () => {
  const intervalMs = Number(process.env.PAYMENT_SYNC_INTERVAL_MS || 1 * 60 * 1000);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return;
  }

  setTimeout(() => {
    void syncPendingPayments().catch((error) => {
      console.error('Initial Ryft payment sync failed', error);
    });
  }, 15000);

  setInterval(() => {
    void syncPendingPayments().catch((error) => {
      console.error('Scheduled Ryft payment sync failed', error);
    });
  }, intervalMs);
};

// Get My Payments
const getMyPayments = async (userId: string) => {
  return await Payment.find({ userId }).sort({ createdAt: -1 });
};

// Get All Payments (Admin)
const getAllPayments = async () => {
  return await Payment.find().populate('userId subscriptionId').sort({ createdAt: -1 });
};

const updatePaymentStatus = async (paymentId: string, nextStatus: TPaymentStatus) => {
  const allowedStatuses: TPaymentStatus[] = ['pending', 'paid', 'failed'];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new AppError('Invalid payment status', 400);
  }

  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.paymentStatus === nextStatus) {
    return await Payment.findById(paymentId).populate('userId subscriptionId');
  }

  if (payment.paymentStatus === 'paid' && nextStatus !== 'paid') {
    throw new AppError('Paid payments cannot be moved back to another status.', 400);
  }

  payment.paymentStatus = nextStatus;

  if (nextStatus === 'paid') {
    if (payment.paymentType === 'add_shop' && payment.shopId) {
      await Shop.updateOne(
        { _id: payment.shopId },
        { $set: { isActive: true, activatedAt: new Date() } }
      );
    } else {
      const paymentIdentifier = payment.ryftPaymentSessionId || payment.stripeSessionId || payment._id.toString();
      await creditUserBalance({
        userId: payment.userId.toString(),
        amount: payment.amount,
        currency: payment.currency,
        source: 'payment',
        description: `Balance credited from admin payment update ${paymentIdentifier}`.trim(),
        referenceId: payment._id.toString(),
        paymentId: payment._id.toString(),
      });
    }
  }

  await payment.save();

  return await Payment.findById(paymentId).populate('userId subscriptionId');
};

const deletePayment = async (paymentId: string) => {
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.paymentStatus === 'paid') {
    throw new AppError('Paid payments cannot be deleted.', 400);
  }

  await payment.deleteOne();

  return { _id: paymentId };
};

export default {
  createPaymentSession,
  verifyWebhookSignature,
  handleRyftWebhook,
  syncPendingPayments,
  startPaymentStatusSyncScheduler,
  getMyPayments,
  getAllPayments,
  updatePaymentStatus,
  deletePayment,
};
