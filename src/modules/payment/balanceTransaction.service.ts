import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { BalanceTransaction } from './balanceTransaction.model';
import { TBalanceTransactionSource, TBalanceTransactionType } from './balanceTransaction.interface';

const toMoney = (value: number) => Number(value.toFixed(3));

const parseMoney = (value: unknown) => {
      const amount = Number(value);

      if (!Number.isFinite(amount) || amount < 0) {
            throw new AppError('Invalid balance amount', 400);
      }

      return toMoney(amount);
};

type BalanceActionInput = {
      userId: string;
      amount: number;
      currency?: string;
      source: TBalanceTransactionSource;
      description: string;
      referenceId?: string;
      paymentId?: string;
      serviceId?: number;
      serviceName?: string;
      imei?: string;
      metadata?: Record<string, unknown>;
};

const createTransaction = async (
      userId: string,
      transactionType: TBalanceTransactionType,
      amount: number,
      currency: string,
      balanceBefore: number,
      balanceAfter: number,
      payload: Pick<
            BalanceActionInput,
            'source' | 'description' | 'referenceId' | 'paymentId' | 'serviceId' | 'serviceName' | 'imei' | 'metadata'
      >
) => {
      return await BalanceTransaction.create({
            userId,
            transactionType,
            amount,
            currency,
            balanceBefore,
            balanceAfter,
            ...payload,
            paymentId: payload.paymentId,
      });
};

export const creditUserBalance = async (input: BalanceActionInput) => {
      const userId = String(input.userId ?? '').trim();
      const amount = parseMoney(input.amount);
      const currency = String(input.currency ?? 'USD').trim() || 'USD';

      if (!userId) {
            throw new AppError('User is required', 400);
      }

      if (amount === 0) {
            const user = await User.findById(userId);

            if (!user) {
                  throw new AppError('User not found', 404);
            }

            return {
                  user,
                  transaction: null,
            };
      }

      const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: amount } }, { new: true });

      if (!updatedUser) {
            throw new AppError('User not found', 404);
      }

      const balanceAfter = toMoney(Number(updatedUser.balance ?? 0));
      const balanceBefore = toMoney(balanceAfter - amount);

      const transaction = await createTransaction(userId, 'credit', amount, currency, balanceBefore, balanceAfter, {
            source: input.source,
            description: input.description,
            referenceId: input.referenceId,
            paymentId: input.paymentId,
            serviceId: input.serviceId,
            serviceName: input.serviceName,
            imei: input.imei,
            metadata: input.metadata,
      });

      return { user: updatedUser, transaction };
};

export const debitUserBalance = async (input: BalanceActionInput) => {
      const userId = String(input.userId ?? '').trim();
      const amount = parseMoney(input.amount);
      const currency = String(input.currency ?? 'USD').trim() || 'USD';

      if (!userId) {
            throw new AppError('User is required', 400);
      }

      if (amount === 0) {
            const user = await User.findById(userId);

            if (!user) {
                  throw new AppError('User not found', 404);
            }

            return {
                  user,
                  transaction: null,
            };
      }

      const updatedUser = await User.findOneAndUpdate(
            {
                  _id: userId,
                  $expr: {
                        $gte: [{ $ifNull: ['$balance', 0] }, amount],
                  },
            },
            { $inc: { balance: -amount } },
            { new: true }
      );

      if (!updatedUser) {
            throw new AppError('Insufficient balance', 402);
      }

      const balanceAfter = toMoney(Number(updatedUser.balance ?? 0));
      const balanceBefore = toMoney(balanceAfter + amount);

      const transaction = await createTransaction(userId, 'debit', amount, currency, balanceBefore, balanceAfter, {
            source: input.source,
            description: input.description,
            referenceId: input.referenceId,
            paymentId: input.paymentId,
            serviceId: input.serviceId,
            serviceName: input.serviceName,
            imei: input.imei,
            metadata: input.metadata,
      });

      return { user: updatedUser, transaction };
};

export const getUserBalanceHistory = async (userId: string, query: any) => {
      const page = Math.max(Number(query?.page ?? 1), 1);
      const limit = Math.max(Number(query?.limit ?? 10), 1);
      const skip = (page - 1) * limit;

      const [data, total, user] = await Promise.all([
            BalanceTransaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            BalanceTransaction.countDocuments({ userId }),
            User.findById(userId).select('balance'),
      ]);

      return {
            data,
            meta: {
                  total,
                  page,
                  limit,
                  totalPage: Math.ceil(total / limit),
                  currentBalance: Number(user?.balance ?? 0),
            },
      };
};
