import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import { User } from '../user/user.model';
import { IInvoice, IInvoiceOrderDetails, IInvoicePayload, IInvoicePaymentDetails } from './invoice.interface';
import { Invoice } from './invoice.model';
import { Inventory } from '../inventory/inventory.model';
import RepairRequest from '../repairRequest/repairRequest.model';

const resolveShopkeeperId = async (shopkeeperId?: string) => {
      const trimmedShopkeeperId = String(shopkeeperId ?? '').trim();

      if (!trimmedShopkeeperId) {
            throw new AppError('shopkeeperId is required', StatusCodes.BAD_REQUEST);
      }

      if (!Types.ObjectId.isValid(trimmedShopkeeperId)) {
            throw new AppError('Invalid shopkeeperId', StatusCodes.BAD_REQUEST);
      }

      const user = await User.findById(trimmedShopkeeperId);

      if (!user) {
            throw new AppError('Shopkeeper not found', StatusCodes.NOT_FOUND);
      }

      return new Types.ObjectId(trimmedShopkeeperId);
};

const buildInvoiceFile = async (file?: Express.Multer.File) => {
      if (!file) {
            throw new AppError('Invoice PDF is required', StatusCodes.BAD_REQUEST);
      }

      const uploaded = await uploadToCloudinary(file.path);

      if (!uploaded?.public_id || !uploaded.secure_url) {
            throw new AppError('Failed to upload invoice to Cloudinary', StatusCodes.INTERNAL_SERVER_ERROR);
      }

      return {
            public_id: uploaded.public_id,
            url: uploaded.secure_url,
            resource_type: 'raw' as const,
      };
};

const normalizeObjectId = (value?: string) => {
      const trimmedValue = String(value ?? '').trim();

      if (!trimmedValue || !Types.ObjectId.isValid(trimmedValue)) {
            return null;
      }

      return new Types.ObjectId(trimmedValue);
};

const normalizeObjectIdArray = (value?: string | string[]) => {
      const values = Array.isArray(value) ? value : [];

      if (!Array.isArray(value) && value) {
            values.push(value);
      }

      return values
            .map((item) => String(item ?? '').trim())
            .filter((item) => item && Types.ObjectId.isValid(item))
            .map((item) => new Types.ObjectId(item));
};

const parseJsonObject = <T>(value: T | string | undefined, fieldName: string): T | undefined => {
      if (value === undefined || value === null || value === '') {
            return undefined;
      }

      if (typeof value !== 'string') {
            return value;
      }

      try {
            const parsed = JSON.parse(value);

            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                  throw new Error('Expected an object');
            }

            return parsed as T;
      } catch {
            throw new AppError(`${fieldName} must be valid JSON`, StatusCodes.BAD_REQUEST);
      }
};

const normalizeOptionalNumber = (value: unknown, fieldName: string) => {
      if (value === undefined || value === null || value === '') {
            return undefined;
      }

      const parsed = Number(value);

      if (!Number.isFinite(parsed) || parsed < 0) {
            throw new AppError(`${fieldName} must be a non-negative number`, StatusCodes.BAD_REQUEST);
      }

      return parsed;
};

const normalizePaymentDetails = (value: IInvoicePayload['paymentDetails']): IInvoicePaymentDetails | undefined => {
      const details = parseJsonObject<IInvoicePaymentDetails>(value, 'paymentDetails');

      if (!details) {
            return undefined;
      }

      const dueDate = details.dueDate ? new Date(details.dueDate) : undefined;

      if (dueDate && Number.isNaN(dueDate.getTime())) {
            throw new AppError('paymentDetails.dueDate must be a valid date', StatusCodes.BAD_REQUEST);
      }

      return {
            amountReceived: normalizeOptionalNumber(details.amountReceived, 'paymentDetails.amountReceived'),
            changeGiven: normalizeOptionalNumber(details.changeGiven, 'paymentDetails.changeGiven'),
            cardholderName: String(details.cardholderName ?? '').trim() || undefined,
            cardLastFour: String(details.cardLastFour ?? '').trim() || undefined,
            bankName: String(details.bankName ?? '').trim() || undefined,
            accountLastFour: String(details.accountLastFour ?? '').trim() || undefined,
            transactionReference: String(details.transactionReference ?? '').trim() || undefined,
            amountPaid: normalizeOptionalNumber(details.amountPaid, 'paymentDetails.amountPaid'),
            dueAmount: normalizeOptionalNumber(details.dueAmount, 'paymentDetails.dueAmount'),
            dueDate,
            notes: String(details.notes ?? '').trim() || undefined,
      };
};

const normalizeOrderDetails = (value: IInvoicePayload['orderDetails']): IInvoiceOrderDetails | undefined => {
      const details = parseJsonObject<IInvoiceOrderDetails>(value, 'orderDetails');

      if (!details) {
            return undefined;
      }

      return {
            checkoutMode: String(details.checkoutMode ?? '').trim() || undefined,
            marketplace: String(details.marketplace ?? '').trim() || undefined,
            orderNumber: String(details.orderNumber ?? '').trim() || undefined,
            deliveryFrom: String(details.deliveryFrom ?? '').trim() || undefined,
            deliveryTo: String(details.deliveryTo ?? '').trim() || undefined,
      };
};

const createInvoice = async (payload: IInvoicePayload, file?: Express.Multer.File): Promise<IInvoice> => {
      const shopkeeperId = await resolveShopkeeperId(payload.shopkeeperId);
      const shopId = normalizeObjectId(payload.shopId);
      const type = String(payload.type ?? '').trim();
      const customerInfo = normalizeObjectId(payload.customerInfo ?? undefined);
      const itemsIds = normalizeObjectIdArray(payload.itemsIds);
      const paymentMethod =
            String(payload.paymentMethod ?? '')
                  .trim()
                  .toLowerCase() || undefined;
      const paymentDetails = normalizePaymentDetails(payload.paymentDetails);
      const orderDetails = normalizeOrderDetails(payload.orderDetails);
      const repairRequestId = normalizeObjectId(payload.repairRequestId);
      const totalAmount = normalizeOptionalNumber(payload.totalAmount, 'totalAmount');
      const dueAmount = normalizeOptionalNumber(payload.dueAmount, 'dueAmount');
      const amountPaid = normalizeOptionalNumber(payload.amountPaid, 'amountPaid');
      let lineItems: Array<{ itemId: string; quantity: number; variantId?: string }> = [];
      try {
            lineItems = typeof payload.lineItems === 'string' ? JSON.parse(payload.lineItems) : payload.lineItems || [];
      } catch {
            throw new AppError('lineItems must be valid JSON', StatusCodes.BAD_REQUEST);
      }
      for (const line of lineItems) {
            if (!Types.ObjectId.isValid(line.itemId) || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0) {
                  throw new AppError('Invalid invoice line item', StatusCodes.BAD_REQUEST);
            }
            const stockFilter: any = line.variantId
                  ? { _id: line.itemId, variants: { $elemMatch: { _id: line.variantId, quantity: { $gte: Number(line.quantity) } } } }
                  : { _id: line.itemId, quantity: { $gte: Number(line.quantity) } };
            if (!(await Inventory.exists(stockFilter))) {
                  throw new AppError('One or more selected items no longer have enough stock', StatusCodes.CONFLICT);
            }
      }

      if (!type) {
            throw new AppError('type is required', StatusCodes.BAD_REQUEST);
      }

      if (payload.customerInfo && !customerInfo) {
            throw new AppError('Invalid customerInfo', StatusCodes.BAD_REQUEST);
      }

      if (payload.paymentStatus && !['paid', 'partial', 'due'].includes(payload.paymentStatus)) {
            throw new AppError('Invalid paymentStatus', StatusCodes.BAD_REQUEST);
      }

      if (repairRequestId) {
            const isReadyForCollection = await RepairRequest.exists({
                  _id: repairRequestId,
                  userId: shopkeeperId,
                  status: { $in: ['completed', 'approved'] },
            });

            if (!isReadyForCollection) {
                  throw new AppError('Repair order is no longer ready for collection', StatusCodes.CONFLICT);
            }
      }

      if (paymentMethod === 'card' && paymentDetails?.cardLastFour && !/^\d{4}$/.test(paymentDetails.cardLastFour)) {
            throw new AppError('Card last four digits must contain exactly 4 numbers', StatusCodes.BAD_REQUEST);
      }

      const invoiceFile = await buildInvoiceFile(file);

      const result = await Invoice.create({
            shopkeeperId,
            shopId,
            invoice: invoiceFile,
            type,
            customerInfo,
            itemsIds,

            totalAmount,
            dueAmount,
            repairRequestId: normalizeObjectId(payload.repairRequestId),
            tax: normalizeOptionalNumber(payload.tax, 'tax'),
            taxName: payload.taxName,
            taxIncludedInPrice: payload.taxIncludedInPrice,
            paymentMethod,
            paymentStatus: payload.paymentStatus,
            paymentDetails,
            amountPaid,
            invoiceNumber: String(payload.invoiceNumber ?? '').trim() || undefined,
            currency:
                  String(payload.currency ?? '')
                        .trim()
                        .toUpperCase() || undefined,
            orderDetails,
            discountName: payload.discountName?.trim(),
            discountPercentage: normalizeOptionalNumber(payload.discountPercentage, 'discountPercentage'),
            discountAmount: normalizeOptionalNumber(payload.discountAmount, 'discountAmount'),
            lineItems,
      });

      if (repairRequestId) {
            const repairRequest = await RepairRequest.findOneAndUpdate(
                  {
                        _id: repairRequestId,
                        userId: shopkeeperId,
                        status: { $in: ['completed', 'approved'] },
                  },
                  { $set: { status: 'collected' } },
                  { new: true },
            );

            if (!repairRequest) {
                  throw new AppError('Repair order is no longer ready for collection', StatusCodes.CONFLICT);
            }
      }

      for (const line of lineItems) {
            if (line.variantId) {
                  await Inventory.updateOne({ _id: line.itemId }, { $inc: { 'variants.$[variant].quantity': -Number(line.quantity) } }, { arrayFilters: [{ 'variant._id': line.variantId, 'variant.quantity': { $gte: Number(line.quantity) } }] });
            } else {
                  await Inventory.updateOne({ _id: line.itemId, quantity: { $gte: Number(line.quantity) } }, { $inc: { quantity: -Number(line.quantity) } });
            }
      }

      return result;
};

type InvoicePaginationQuery = {
      page?: unknown;
      limit?: unknown;
      shopId?: unknown;
};

const getInvoiceByShopkeeperId = async (shopkeeperId: string, query: InvoicePaginationQuery = {}) => {
      const trimmedShopkeeperId = String(shopkeeperId ?? '').trim();

      if (!Types.ObjectId.isValid(trimmedShopkeeperId)) {
            throw new AppError('Invalid shopkeeperId', StatusCodes.BAD_REQUEST);
      }

      const shouldPaginate = query.page !== undefined || query.limit !== undefined;

      if (!shouldPaginate) {
            const listFilter: Record<string, unknown> = { shopkeeperId: trimmedShopkeeperId };
            if (query.shopId && Types.ObjectId.isValid(String(query.shopId))) {
                  listFilter.$or = [{ shopId: new Types.ObjectId(String(query.shopId)) }, { shopId: null }];
            }
            return await Invoice.find(listFilter)
                  .populate('shopkeeperId')
                  .populate('customerInfo')
                  .populate('itemsIds', 'itemName imeiNumber expectedPrice image')
                  .sort({ createdAt: -1, _id: -1 });
      }

      const requestedPage = Number.parseInt(String(query.page ?? ''), 10);
      const requestedLimit = Number.parseInt(String(query.limit ?? ''), 10);
      const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 10;
      const filter: Record<string, unknown> = { shopkeeperId: trimmedShopkeeperId };
      if (query.shopId && Types.ObjectId.isValid(String(query.shopId))) {
            filter.$or = [{ shopId: new Types.ObjectId(String(query.shopId)) }, { shopId: null }];
      }

      const [data, total] = await Promise.all([
            Invoice.find(filter)
            .populate('shopkeeperId')
            .populate('customerInfo')
            .populate('itemsIds', 'itemName imeiNumber expectedPrice image')
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
            Invoice.countDocuments(filter),
      ]);

      return {
            data,
            meta: {
                  page,
                  limit,
                  total,
                  totalPage: Math.max(1, Math.ceil(total / limit)),
            },
      };
};

const getAllInvoices = async () => {
      return await Invoice.find()
            .populate('shopkeeperId')
            .populate('customerInfo')
            .populate('itemsIds', 'itemName imeiNumber expectedPrice image')
            .sort({ createdAt: -1 });
};

const updateInvoice = async (id: string, payload: IInvoicePayload, file?: Express.Multer.File) => {
      const invoice = await Invoice.findById(id);

      if (!invoice) {
            throw new AppError('Invoice not found', StatusCodes.NOT_FOUND);
      }

      const updateData: Partial<
            Pick<
                  IInvoice,
                  | 'shopkeeperId'
                  | 'type'
                  | 'customerInfo'
                  | 'itemsIds'
                  | 'totalAmount'
                  | 'dueAmount'
                  | 'repairRequestId'
                  | 'tax'
                  | 'taxName'
                  | 'taxIncludedInPrice'
                  | 'paymentMethod'
                  | 'paymentStatus'
                  | 'paymentDetails'
                  | 'amountPaid'
                  | 'invoiceNumber'
                  | 'currency'
                  | 'orderDetails'
                  | 'discountName'
                  | 'discountPercentage'
                  | 'discountAmount'
            >
      > & {
            invoice?: IInvoice['invoice'];
      } = {};

      if (payload.totalAmount !== undefined) {
            updateData.totalAmount = payload.totalAmount;
      }

      if (payload.dueAmount !== undefined) {
            updateData.dueAmount = payload.dueAmount;
      }

      if (payload.tax !== undefined) {
            updateData.tax = payload.tax;
      }

      if (payload.taxName !== undefined) {
            updateData.taxName = payload.taxName?.trim() || undefined;
      }

      if (payload.taxIncludedInPrice !== undefined) {
            updateData.taxIncludedInPrice = payload.taxIncludedInPrice;
      }

      if (payload.paymentMethod !== undefined) {
            updateData.paymentMethod = payload.paymentMethod?.trim().toLowerCase();
      }

      if (payload.paymentStatus !== undefined) {
            updateData.paymentStatus = payload.paymentStatus;
      }

      if (payload.paymentDetails !== undefined) {
            updateData.paymentDetails = normalizePaymentDetails(payload.paymentDetails);
      }

      if (payload.amountPaid !== undefined) {
            updateData.amountPaid = normalizeOptionalNumber(payload.amountPaid, 'amountPaid');
      }

      if (payload.invoiceNumber !== undefined) {
            updateData.invoiceNumber = payload.invoiceNumber?.trim();
      }

      if (payload.currency !== undefined) {
            updateData.currency = payload.currency?.trim().toUpperCase();
      }

      if (payload.orderDetails !== undefined) {
            updateData.orderDetails = normalizeOrderDetails(payload.orderDetails);
      }

      if (payload.discountName !== undefined) {
            updateData.discountName = payload.discountName?.trim();
      }

      if (payload.discountPercentage !== undefined) {
            updateData.discountPercentage = payload.discountPercentage;
      }

      if (payload.discountAmount !== undefined) {
            updateData.discountAmount = payload.discountAmount;
      }

      if (payload.repairRequestId !== undefined) {
            const repairRequestId = normalizeObjectId(payload.repairRequestId);

            if (repairRequestId !== null) {
                  updateData.repairRequestId = repairRequestId;
            }
      }

      if (payload.shopkeeperId) {
            updateData.shopkeeperId = await resolveShopkeeperId(payload.shopkeeperId);
      }

      const type = String(payload.type ?? '').trim();

      if (type) {
            updateData.type = type;
      }

      if (payload.customerInfo) {
            const customerInfo = normalizeObjectId(payload.customerInfo);
            if (customerInfo) {
                  updateData.customerInfo = customerInfo;
            }
      }

      if (payload.itemsIds && Array.isArray(payload.itemsIds)) {
            updateData.itemsIds = normalizeObjectIdArray(payload.itemsIds);
      }

      if (file) {
            await deleteFromCloudinary(invoice.invoice.public_id, invoice.invoice.resource_type || 'raw');
            updateData.invoice = await buildInvoiceFile(file);
      }

      const result = await Invoice.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
      })
            .populate('shopkeeperId', 'firstName lastName email phone role shopName')
            .populate('customerInfo', 'firstName lastName email phone address')
            .populate('itemsIds', 'itemName imeiNumber expectedPrice image');

      return result;
};

const deleteInvoice = async (id: string) => {
      const invoice = await Invoice.findById(id);

      if (!invoice) {
            throw new AppError('Invoice not found', StatusCodes.NOT_FOUND);
      }

      await deleteFromCloudinary(invoice.invoice.public_id, invoice.invoice.resource_type || 'raw');
      await Invoice.findByIdAndDelete(id);

      return null;
};

const invoiceService = {
      createInvoice,
      getInvoiceByShopkeeperId,
      getAllInvoices,
      updateInvoice,
      deleteInvoice,
};

export default invoiceService;
