import crypto from 'crypto';
import axios from 'axios';
import config from '../../config/config';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { Shop } from '../shop/shop.model';
import { Payment } from './payment.model';
import { creditUserBalance } from './balanceTransaction.service';
import { TPaymentStatus } from './payment.interface';

export const PLATFORM_FEE_PERCENTAGE = 2; // 2% platform split for connected accounts

const getRyftSecretKey = (): string => {
  const secretKey = (config as { ryft_secret_key?: string }).ryft_secret_key;
  if (!secretKey) {
    throw new AppError('Ryft is not configured. Missing RYFT_SECRET_KEY.', 500);
  }
  return secretKey;
};

const getRyftBaseUrl = (): string => {
  const secretKey = (config as { ryft_secret_key?: string }).ryft_secret_key || '';
  const configuredUrl = (config as { ryft_base_url?: string }).ryft_base_url;

  if (configuredUrl && configuredUrl !== 'https://api.ryftpay.com/v1') {
    return configuredUrl.replace(/\/+$/, '');
  }

  // Automatic Sandbox API detection when using sandbox credentials
  if (secretKey.startsWith('sk_sandbox_')) {
    return 'https://sandbox-api.ryftpay.com/v1';
  }

  return (configuredUrl || 'https://api.ryftpay.com/v1').replace(/\/+$/, '');
};

const getRyftHeaders = (subAccountId?: string) => {
  const secretKey = getRyftSecretKey();
  const headers: Record<string, string> = {
    Authorization: secretKey,
    'Content-Type': 'application/json',
  };

  if (subAccountId && subAccountId.trim()) {
    headers['Account'] = subAccountId.trim();
  }

  return headers;
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

// ==========================================
// 🚀 Ryft Sub-Account Onboarding & Connect
// ==========================================

const extractRyftErrorMessage = (error: any, defaultMessage: string): string => {
  const errorItems = error?.response?.data?.errors;
  if (Array.isArray(errorItems) && errorItems.length > 0) {
    return errorItems.map((e: any) => e.message || e.code || JSON.stringify(e)).join('; ');
  }
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    defaultMessage
  );
};

const createRyftSubAccountOnboardingLink = async (user: any, redirectUrlParam?: string) => {
  const secretKey = getRyftSecretKey();
  const ryftBaseUrl = getRyftBaseUrl();
  const frontendUrl = (config as { frontend_url?: string }).frontend_url || 'http://localhost:3000';
  let targetRedirectUrl = redirectUrlParam || `${frontendUrl}/shopkeeper/settings/payment-setup?status=onboard_complete`;

  // Ryft requires https scheme for redirect/return URLs
  if (!targetRedirectUrl.startsWith('https://')) {
    targetRedirectUrl = targetRedirectUrl.replace(/^http:\/\//i, 'https://');
  }

  const currentUser = await User.findById(user._id || user.id);
  if (!currentUser) {
    throw new AppError('User not found', 404);
  }

  // Helper to create hosted account onboarding link via /account-links
  const getLinkForAccountId = async (accId: string) => {
    const linkResponse = await axios.post(
      `${ryftBaseUrl}/account-links`,
      {
        accountId: accId,
        redirectUrl: targetRedirectUrl,
      },
      {
        headers: {
          Authorization: secretKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    return linkResponse.data?.url;
  };

  // Helper to create a sub-account entity on Ryft via /accounts
  const createNewAccount = async (): Promise<string> => {
    const accountResponse = await axios.post(
      `${ryftBaseUrl}/accounts`,
      {
        email: currentUser.email,
      },
      {
        headers: {
          Authorization: secretKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const id = accountResponse.data?.id;
    if (!id) {
      throw new AppError('Failed to create Ryft sub-account', 500);
    }
    return id;
  };

  try {
    let accountId = currentUser.ryftAccountId;
    let url: string | undefined;

    if (accountId) {
      try {
        url = await getLinkForAccountId(accountId);
      } catch (err: any) {
        // If the stored accountId was not found on Ryft (e.g. sandbox reset or invalid ID), create a new one
        if (err?.response?.status === 404) {
          const newAccountId = await createNewAccount();
          currentUser.ryftAccountId = newAccountId;
          accountId = newAccountId;
          url = await getLinkForAccountId(newAccountId);
        } else {
          throw err;
        }
      }
    } else {
      const newAccountId = await createNewAccount();
      currentUser.ryftAccountId = newAccountId;
      accountId = newAccountId;
      url = await getLinkForAccountId(newAccountId);
    }

    if (currentUser.ryftAccountStatus === 'not_created') {
      currentUser.ryftAccountStatus = 'pending';
    }

    if (url) {
      currentUser.ryftOnboardingUrl = url;
    }

    await currentUser.save();

    return {
      url,
      accountId: currentUser.ryftAccountId || accountId || null,
      status: currentUser.ryftAccountStatus || 'pending',
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      environment: ryftBaseUrl.includes('sandbox') ? 'sandbox' : 'production',
    };
  } catch (error: any) {
    const errorMessage = extractRyftErrorMessage(error, 'Failed to create Ryft sub-account onboarding link');
    console.error('Ryft sub-account onboarding error:', error?.response?.data || error);
    throw new AppError(`Ryft onboarding failed: ${errorMessage}`, 502);
  }
};

const getRyftSubAccountStatus = async (user: any) => {
  const currentUser = await User.findById(user._id || user.id);
  if (!currentUser) {
    throw new AppError('User not found', 404);
  }

  const ryftBaseUrl = getRyftBaseUrl();
  const secretKey = (config as { ryft_secret_key?: string }).ryft_secret_key;
  const isConfigured = Boolean(secretKey && secretKey !== 'sk_test_replace_me');
  const isSandbox = ryftBaseUrl.includes('sandbox') || (secretKey ? secretKey.startsWith('sk_sandbox_') : false);

  if (!currentUser.ryftAccountId) {
    return {
      isOnboarded: false,
      accountId: null,
      status: currentUser.ryftAccountStatus || 'not_created',
      payoutsEnabled: false,
      detailsSubmitted: false,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      isConfigured,
      isSandbox,
      accountCurrency: currentUser.ryftAccountCurrency || 'GBP',
      environment: isSandbox ? 'sandbox' : 'production',
    };
  }

  try {
    const response = await axios.get(`${ryftBaseUrl}/accounts/${currentUser.ryftAccountId}`, {
      headers: getRyftHeaders(),
      timeout: 15000,
    });

    const account = response.data;
    const status = String(account?.status || account?.verification?.status || 'pending').toLowerCase();
    const payoutsEnabled = Boolean(account?.payoutsEnabled ?? account?.settings?.payouts?.enabled ?? (status === 'enabled' || status === 'verified'));
    const detailsSubmitted = Boolean(account?.detailsSubmitted ?? (status !== 'unverified' && status !== 'pending'));

    currentUser.ryftAccountStatus = status;
    currentUser.ryftPayoutsEnabled = payoutsEnabled;
    currentUser.ryftDetailsSubmitted = detailsSubmitted;
    if (account?.currency) {
      currentUser.ryftAccountCurrency = account.currency;
    }
    await currentUser.save();

    return {
      isOnboarded: Boolean(payoutsEnabled || status === 'enabled' || status === 'verified'),
      accountId: currentUser.ryftAccountId,
      status,
      payoutsEnabled,
      detailsSubmitted,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      isConfigured,
      isSandbox,
      accountCurrency: currentUser.ryftAccountCurrency || account?.currency || 'GBP',
      environment: isSandbox ? 'sandbox' : 'production',
      rawAccount: account,
    };
  } catch (error: any) {
    console.warn(`Could not query Ryft sub-account ${currentUser.ryftAccountId}:`, error?.response?.data || error?.message);
    return {
      isOnboarded: Boolean(currentUser.ryftPayoutsEnabled),
      accountId: currentUser.ryftAccountId,
      status: currentUser.ryftAccountStatus || 'pending',
      payoutsEnabled: Boolean(currentUser.ryftPayoutsEnabled),
      detailsSubmitted: Boolean(currentUser.ryftDetailsSubmitted),
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      isConfigured,
      isSandbox,
      accountCurrency: currentUser.ryftAccountCurrency || 'GBP',
      environment: isSandbox ? 'sandbox' : 'production',
    };
  }
};

const saveRyftSubAccount = async (user: any, payload: { accountId: string; status?: string }) => {
  const { accountId, status } = payload;
  if (!accountId || !accountId.trim()) {
    throw new AppError('accountId is required', 400);
  }

  const currentUser = await User.findById(user._id || user.id);
  if (!currentUser) {
    throw new AppError('User not found', 404);
  }

  currentUser.ryftAccountId = accountId.trim();
  if (status) {
    currentUser.ryftAccountStatus = status;
  }

  await currentUser.save();

  return await getRyftSubAccountStatus(currentUser);
};

// ==========================================
// 💳 Create Ryft Payment Session (Split / Platform Fee)
// ==========================================

const createPaymentSession = async (user: any, payload: any) => {
  const {
    amount,
    subscriptionId,
    currency,
    paymentType = 'plan',
    shopId,
    subAccountId: explicitSubAccountId,
    recipientUserId,
  } = payload;

  const frontendUrl = (config as { frontend_url?: string }).frontend_url || 'https://localhost:3000';
  const ryftBaseUrl = getRyftBaseUrl();
  const ryftPublicKey = (config as { ryft_public_key?: string }).ryft_public_key ?? '';

  const configuredCurrency = (process.env.RYFT_CURRENCY || 'GBP').toUpperCase();
  let normalizedCurrency = String(currency || configuredCurrency).toUpperCase();
  // Ryft sandbox/UK merchant accounts require GBP unless multi-currency is enabled on the merchant account
  if (configuredCurrency === 'GBP' && normalizedCurrency !== 'GBP') {
    normalizedCurrency = 'GBP';
  }
  const unitAmount = Math.round(Number(amount) * 100);

  // Ryft requires https scheme for returnUrl
  let returnUrl = `${frontendUrl.replace(/\/+$/, '')}/payment/success`;
  if (!returnUrl.startsWith('https://')) {
    returnUrl = returnUrl.replace(/^http:\/\//i, 'https://');
  }

  // Resolve whether this payment routes to a shopkeeper's connected account
  let targetSubAccountId: string | null = explicitSubAccountId ? String(explicitSubAccountId).trim() : null;
  let targetRecipientId: string | null = recipientUserId ? String(recipientUserId) : null;

  if (!targetSubAccountId) {
    if (paymentType === 'plan' || paymentType === 'add_shop') {
      // Platform payments (subscriptions, plan upgrades, adding shop slots) go directly to platform
      targetSubAccountId = null;
      targetRecipientId = null;
    } else if (recipientUserId) {
      const recipient = await User.findById(recipientUserId);
      if (recipient?.ryftAccountId) {
        targetSubAccountId = recipient.ryftAccountId;
      }
    } else if (shopId) {
      const shop = await Shop.findById(shopId);
      if (shop?.shopkeeperId) {
        targetRecipientId = shop.shopkeeperId.toString();
        const shopkeeper = await User.findById(shop.shopkeeperId);
        if (shopkeeper?.ryftAccountId) {
          targetSubAccountId = shopkeeper.ryftAccountId;
        }
      }
    } else {
      // If a shopkeeper is creating a payment for their own services/invoices
      const currentUser = await User.findById(user._id || user.id);
      if (currentUser?.role === 'shopkeeper' && currentUser.ryftAccountId) {
        targetSubAccountId = currentUser.ryftAccountId;
        targetRecipientId = currentUser._id.toString();
      }
    }
  }

  const isSplitPayment = Boolean(targetSubAccountId);
  let platformFeeMinor = 0;

  if (isSplitPayment) {
    // 2% Platform split
    platformFeeMinor = Math.round(unitAmount * (PLATFORM_FEE_PERCENTAGE / 100));
  }

  const requestBody: Record<string, any> = {
    amount: unitAmount,
    currency: normalizedCurrency,
    customerEmail: user?.email,
    returnUrl,
    metadata: {
      userId: user._id.toString(),
      subscriptionId: subscriptionId ? String(subscriptionId) : '',
      paymentType,
      isSplitPayment: isSplitPayment ? 'true' : 'false',
      ...(targetSubAccountId ? { subAccountId: targetSubAccountId } : {}),
      ...(platformFeeMinor > 0 ? { platformFee: String(platformFeeMinor) } : {}),
      ...(shopId ? { shopId: String(shopId) } : {}),
    },
  };

  if (isSplitPayment && platformFeeMinor > 0) {
    requestBody.platformFee = platformFeeMinor;
  }

  let ryftSession: any;

  try {
    const headers = getRyftHeaders(targetSubAccountId || undefined);
    const response = await axios.post(`${ryftBaseUrl}/payment-sessions`, requestBody, {
      headers,
      timeout: 30000,
    });
    ryftSession = response.data;
  } catch (error: any) {
    const errorMessage = extractRyftErrorMessage(error, 'Failed to create Ryft payment session');
    console.error('Ryft create payment session error:', error?.response?.data || error);
    throw new AppError(`Ryft payment session creation failed: ${errorMessage}`, 502);
  }

  // Save pending payment record in DB
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
    isSplitPayment,
    subAccountId: targetSubAccountId || undefined,
    platformFee: isSplitPayment ? platformFeeMinor / 100 : 0,
    platformFeePercentage: isSplitPayment ? PLATFORM_FEE_PERCENTAGE : 0,
    shopkeeperAmount: isSplitPayment ? (unitAmount - platformFeeMinor) / 100 : 0,
    recipientUserId: targetRecipientId || undefined,
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
    isSplitPayment,
    platformFee: isSplitPayment ? platformFeeMinor / 100 : 0,
    platformFeePercentage: isSplitPayment ? PLATFORM_FEE_PERCENTAGE : 0,
    shopkeeperAmount: isSplitPayment ? (unitAmount - platformFeeMinor) / 100 : Number(amount),
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
  const eventData = event?.data || event?.paymentSession || event?.account || event;

  // Handle Account Webhook Events (Sub-account updates)
  if (eventType.startsWith('account.') || eventType.includes('account')) {
    const accountId = eventData?.id || eventData?.accountId;
    if (accountId) {
      const status = String(eventData?.status || eventData?.verificationStatus || 'pending').toLowerCase();
      const payoutsEnabled = Boolean(eventData?.payoutsEnabled ?? (status === 'enabled' || status === 'verified'));
      const detailsSubmitted = Boolean(eventData?.detailsSubmitted ?? true);

      await User.findOneAndUpdate(
        { ryftAccountId: accountId },
        {
          ryftAccountStatus: status,
          ryftPayoutsEnabled: payoutsEnabled,
          ryftDetailsSubmitted: detailsSubmitted,
          ...(eventData?.currency ? { ryftAccountCurrency: eventData.currency } : {}),
        }
      );
    }
    return;
  }

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
          headers: getRyftHeaders(payment.subAccountId),
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
  createRyftSubAccountOnboardingLink,
  getRyftSubAccountStatus,
  saveRyftSubAccount,
  verifyWebhookSignature,
  handleRyftWebhook,
  syncPendingPayments,
  startPaymentStatusSyncScheduler,
  getMyPayments,
  getAllPayments,
  updatePaymentStatus,
  deletePayment,
};
