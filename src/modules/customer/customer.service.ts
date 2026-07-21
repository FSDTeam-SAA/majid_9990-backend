import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
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

const getByShopkeeperId = async (shopkeeperId: string) => {
      return await Customer.find({ shopkeeperId }).sort({ createdAt: -1 });
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
