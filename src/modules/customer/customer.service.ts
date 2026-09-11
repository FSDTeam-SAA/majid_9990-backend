import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import RepairRequest from '../repairRequest/repairRequest.model';
import { Invoice } from '../invoice/invoice.model';
import customerEmailTemplate from '../../utils/customerEmailTemplate';
import sendEmail from '../../utils/sendEmail';
import { ICustomer } from './customer.interface';
import { Customer } from './customer.model';

type SendCustomerEmailPayload = {
      customerIds?: string[];
      customerId?: string;
      subject: string;
      description: string;
};

const createCustomer = async (userId: string, payload: Partial<ICustomer> = {}) => {
      // Optional: prevent duplicate by phone or email
      if (payload.email) {
            const exists = await Customer.findOne({ email: payload.email });
            if (exists) {
                  throw new AppError('Customer with this email already exists', StatusCodes.CONFLICT);
            }
      }

      const result = await Customer.create({
            ...payload,
            shopkeeperId: payload.shopkeeperId ?? userId,
            shopId: payload.shopId ?? null,
      });

      return result;
};

const updateCustomer = async (id: string, payload: Partial<ICustomer>, userId: string) => {
      const existing = await Customer.findOne({ _id: id });

      if (!existing) {
            throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
      }

      return await Customer.findOneAndUpdate({ _id: id }, payload, {
            new: true,
            runValidators: true,
      });
};

const deleteCustomer = async (id: string, userId: string) => {
      const existing = await Customer.findOne({ _id: id });

      if (!existing) {
            throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
      }

      await Customer.findOneAndDelete({ _id: id });

      return null;
};

const getByShopkeeperId = async (shopkeeperId: string, query: Record<string, unknown> = {}) => {
      const filter: Record<string, unknown> = { shopkeeperId };

      if (query.shopId && Types.ObjectId.isValid(String(query.shopId))) {
            filter.$or = [{ shopId: new Types.ObjectId(String(query.shopId)) }, { shopId: null }];
      }

      const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();

      if (!customers || customers.length === 0) {
            return [];
      }

      try {
            const phoneRepairCounts = await RepairRequest.aggregate([
                  {
                        $match: {
                              userId: new Types.ObjectId(shopkeeperId),
                              phoneNumber: { $exists: true, $ne: '' },
                        },
                  },
                  {
                        $group: {
                              _id: '$phoneNumber',
                              count: { $sum: 1 },
                        },
                  },
            ]);

            const emailRepairCounts = await RepairRequest.aggregate([
                  {
                        $match: {
                              userId: new Types.ObjectId(shopkeeperId),
                              email: { $exists: true, $ne: '' },
                        },
                  },
                  {
                        $group: {
                              _id: { $toLower: '$email' },
                              count: { $sum: 1 },
                        },
                  },
            ]);

            const phoneMap = new Map<string, number>();
            phoneRepairCounts.forEach((item: { _id: string; count: number }) => {
                  if (item._id) phoneMap.set(String(item._id).trim(), item.count);
            });

            const emailMap = new Map<string, number>();
            emailRepairCounts.forEach((item: { _id: string; count: number }) => {
                  if (item._id) emailMap.set(String(item._id).trim().toLowerCase(), item.count);
            });

            // Query invoices strictly adhering to tenant isolation (shopkeeperId + shopId)
            const invoiceFilter: Record<string, unknown> = {
                  shopkeeperId: new Types.ObjectId(shopkeeperId),
            };
            if (query.shopId && Types.ObjectId.isValid(String(query.shopId))) {
                  invoiceFilter.$or = [{ shopId: new Types.ObjectId(String(query.shopId)) }, { shopId: null }];
            }

            const allInvoices = await Invoice.find(invoiceFilter)
                  .sort({ createdAt: -1, _id: -1 })
                  .lean();

            type InvoiceDoc = (typeof allInvoices)[0];
            const invoicesByCustomerId = new Map<string, InvoiceDoc[]>();
            for (const inv of allInvoices) {
                  if (inv.customerInfo) {
                        const cid = String(inv.customerInfo);
                        if (!invoicesByCustomerId.has(cid)) {
                              invoicesByCustomerId.set(cid, []);
                        }
                        invoicesByCustomerId.get(cid)!.push(inv);
                  }
            }

            return customers.map((c) => {
                  const p = (c.phone || '').trim();
                  const e = (c.email || '').trim().toLowerCase();
                  const repairCount = phoneMap.get(p) ?? emailMap.get(e) ?? 0;

                  const customerInvs = invoicesByCustomerId.get(String(c._id)) || [];
                  let totalInvoiced = 0;
                  let totalPaid = 0;
                  let dueAmount = 0;
                  let hasOverdueOrFullDue = false;

                  customerInvs.forEach((inv) => {
                        const invoiceAmount = Number(inv.totalAmount) || 0;
                        const paid = Number(
                              inv.amountPaid ??
                              inv.paymentDetails?.amountPaid ??
                              (inv.paymentStatus === 'paid' ? invoiceAmount : 0)
                        ) || 0;

                        let due = 0;
                        if (inv.dueAmount !== null && inv.dueAmount !== undefined) {
                              due = Number(inv.dueAmount);
                        } else {
                              due = Math.max(0, invoiceAmount - paid);
                        }

                        totalInvoiced += invoiceAmount;
                        totalPaid += paid;
                        dueAmount += due;

                        if (due > 0 && paid === 0) {
                              hasOverdueOrFullDue = true;
                        }
                  });

                  let paymentStatus: 'paid' | 'partial' | 'due' = 'paid';
                  if (dueAmount <= 0) {
                        paymentStatus = 'paid';
                  } else if (hasOverdueOrFullDue || totalPaid === 0) {
                        paymentStatus = 'due';
                  } else {
                        paymentStatus = 'partial';
                  }

                  const lastInv = customerInvs[0];
                  const lastInvoice = lastInv ? {
                        createdAt: lastInv.createdAt,
                        invoiceNumber: lastInv.invoiceNumber || `INV-${String(lastInv._id).slice(-4).toUpperCase()}`,
                        type: lastInv.type || 'Custom Invoice',
                  } : undefined;

                  return {
                        ...c,
                        repairCount,
                        invoicesCount: customerInvs.length,
                        totalInvoiced,
                        totalPaid,
                        dueAmount,
                        paymentStatus,
                        lastInvoice,
                  };
            });
      } catch (err) {
            console.error('Error calculating customer repair counts and invoice metrics:', err);
            return customers.map((c) => ({
                  ...c,
                  repairCount: 0,
                  invoicesCount: 0,
                  totalInvoiced: 0,
                  totalPaid: 0,
                  dueAmount: 0,
                  paymentStatus: 'paid',
            }));
      }
};

const getAll = async () => {
      return await Customer.find().sort({ createdAt: -1 });
};

const sendEmailToCustomers = async (shopkeeperId: string, payload: SendCustomerEmailPayload) => {
      const customerIds = Array.from(
            new Set(
                  [payload.customerId, ...(payload.customerIds || [])]
                        .filter((id): id is string => Boolean(id && id.trim()))
                        .map((id) => id.trim())
            )
      );

      if (!customerIds.length) {
            throw new AppError('At least one customer must be selected', StatusCodes.BAD_REQUEST);
      }

      const subject = payload.subject?.trim();
      const description = payload.description?.trim();

      if (!subject) {
            throw new AppError('Subject is required', StatusCodes.BAD_REQUEST);
      }

      if (!description) {
            throw new AppError('Description is required', StatusCodes.BAD_REQUEST);
      }

      const customers = await Customer.find({
            _id: { $in: customerIds },
            shopkeeperId,
      }).sort({ createdAt: -1 });

      if (!customers.length) {
            throw new AppError('No matching customers were found', StatusCodes.NOT_FOUND);
      }

      const recipients = customers.reduce<
            Array<{
                  customerId: string;
                  name: string;
                  email: string;
            }>
      >((acc, customer) => {
            if (!customer.email) return acc;

            const email = customer.email.trim().toLowerCase();
            if (!email) return acc;

            if (acc.some((item) => item.email === email)) {
                  return acc;
            }

            acc.push({
                  customerId: customer._id.toString(),
                  name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer',
                  email,
            });

            return acc;
      }, []);

      if (!recipients.length) {
            throw new AppError('The selected customers do not have email addresses', StatusCodes.BAD_REQUEST);
      }

      const sender = await User.findById(shopkeeperId).select('firstName lastName');
      const senderName = sender ? [sender.firstName, sender.lastName].filter(Boolean).join(' ') : undefined;

      const results = await Promise.allSettled(
            recipients.map((recipient) =>
                  sendEmail({
                        to: recipient.email,
                        subject,
                        html: customerEmailTemplate({
                              customerName: recipient.name,
                              subject,
                              message: description,
                              senderName,
                        }),
                  })
            )
      );

      const sentCount = results.filter((result) => result.status === 'fulfilled' && result.value.success).length;
      const failedCount = results.length - sentCount;

      return {
            totalSelected: customerIds.length,
            matchedCustomers: customers.length,
            recipients: recipients.length,
            sentCount,
            failedCount,
            skippedCount: customers.length - recipients.length,
            results: results.map((result, index) => ({
                  customerId: recipients[index]?.customerId,
                  email: recipients[index]?.email,
                  status: result.status,
                  error: result.status === 'rejected' ? result.reason?.message || 'Failed to send email' : undefined,
            })),
      };
};

const customerService = {
      createCustomer,
      updateCustomer,
      deleteCustomer,
      getByShopkeeperId,
      getAll,
      sendEmailToCustomers,
};

export default customerService;
