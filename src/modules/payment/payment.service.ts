import Stripe from 'stripe';
import config from '../../config/config';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { Payment } from './payment.model';
import { creditUserBalance } from './balanceTransaction.service';

let stripeClient: InstanceType<typeof Stripe> | null = null;

const getStripeClient = () => {
      if (stripeClient) return stripeClient;

      const stripeSecretKey = (config as { stripe_secret_key?: string }).stripe_secret_key;

      if (!stripeSecretKey) {
            throw new AppError('Stripe is not configured. Missing STRIPE_SECRET_KEY.', 500);
      }

      stripeClient = new Stripe(stripeSecretKey, {
            apiVersion: '2026-04-22.dahlia',
      });

      return stripeClient;
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

      await creditUserBalance({
            userId: creditUserId,
            amount: payment.amount,
            currency: payment.currency,
            source: 'payment',
            description: `Balance credited from payment ${payment.stripeSessionId ?? ''}`.trim(),
            referenceId: payment._id.toString(),
            paymentId: payment._id.toString(),
      });
};

// ✅ Create Checkout Session
const createPaymentSession = async (user: any, payload: any) => {
      const stripe = getStripeClient();
      const { amount, subscriptionId } = payload;
      const frontendUrl = (config as { frontend_url?: string }).frontend_url ?? '';

      const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            success_url: `${frontendUrl}/success`,
            cancel_url: `${frontendUrl}/cancel`,
            customer_email: user.email,

            line_items: [
                  {
                        price_data: {
                              currency: 'usd',
                              product_data: {
                                    name: 'Subscription Payment',
                              },
                              unit_amount: amount * 100, // cents
                        },
                        quantity: 1,
                  },
            ],

            metadata: {
                  userId: user._id.toString(),
                  subscriptionId: subscriptionId || '',
            },
      });

      // save pending payment
      await Payment.create({
            userId: user._id,
            subscriptionId,
            amount,
            currency: 'usd',
            stripeSessionId: session.id,
            paymentStatus: 'pending',
      });

      return session;
};

const markPaymentAsPaid = async (payment: any, session: any) => {
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

      const updatedPayment = await Payment.findOneAndUpdate(
            { _id: payment._id, paymentStatus: { $ne: 'paid' } },
            {
                  paymentStatus: 'paid',
                  stripePaymentIntentId: paymentIntentId,
                  paymentMethod: session.payment_method_types?.[0],
            },
            { new: true }
      );

      if (updatedPayment) {
            await creditPaymentBalance(updatedPayment);
      }
};

// Handle Webhook
const handleStripeWebhook = async (event: any) => {
      if (event.type === 'checkout.session.completed') {
            const session: any = event.data.object;

            const payment = await Payment.findOne({ stripeSessionId: session.id, paymentStatus: { $ne: 'paid' } });

            if (payment) {
                  await markPaymentAsPaid(payment, session);
            }
      }

      if (event.type === 'payment_intent.payment_failed') {
            const intent: any = event.data.object;

            await Payment.findOneAndUpdate(
                  { stripePaymentIntentId: intent.id },
                  {
                        paymentStatus: 'failed',
                  }
            );
      }
};

const syncPendingPayments = async () => {
      const stripe = getStripeClient();
      const pendingPayments = await Payment.find({
            paymentStatus: 'pending',
            stripeSessionId: { $exists: true, $ne: '' },
      })
            .sort({ createdAt: 1 })
            .limit(100)
            .lean();

      let updatedCount = 0;

      for (const payment of pendingPayments) {
            if (!payment.stripeSessionId) {
                  continue;
            }

            try {
                  const session: any = await stripe.checkout.sessions.retrieve(payment.stripeSessionId, {
                        expand: ['payment_intent'],
                  });

                  const paymentStatus = session.payment_status;
                  const isPaid = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
                  const isExpired = session.status === 'expired' || (paymentStatus === 'unpaid' && session.expires_at && session.expires_at * 1000 < Date.now());

                  if (isPaid) {
                        await markPaymentAsPaid(payment, session);
                        updatedCount += 1;
                        continue;
                  }

                  if (isExpired) {
                        await Payment.findOneAndUpdate(
                              { _id: payment._id, paymentStatus: { $ne: 'failed' } },
                              { paymentStatus: 'failed' }
                        );
                        updatedCount += 1;
                  }
            } catch (error: any) {
                  if (error?.type === 'StripeInvalidRequestError' || error?.code === 'resource_missing') {
                        await Payment.findOneAndUpdate(
                              { _id: payment._id, paymentStatus: { $ne: 'failed' } },
                              { paymentStatus: 'failed' }
                        );
                        updatedCount += 1;
                        continue;
                  }

                  console.error(`Payment sync failed for ${payment.stripeSessionId}`, error);
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
                  console.error('Initial payment sync failed', error);
            });
      }, 15000);

      setInterval(() => {
            void syncPendingPayments().catch((error) => {
                  console.error('Scheduled payment sync failed', error);
            });
      }, intervalMs);
};

// Get My Payments
const getMyPayments = async (userId: string) => {
      return await Payment.find({ userId }).sort({ createdAt: -1 });
};

// Get All Payments (Admin)
const getAllPayments = async () => {
      return await Payment.find().populate('userId subscriptionId');
};

export default {
      createPaymentSession,
      handleStripeWebhook,
      syncPendingPayments,
      startPaymentStatusSyncScheduler,
      getMyPayments,
      getAllPayments,
};
