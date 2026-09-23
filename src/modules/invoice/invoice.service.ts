import * as fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { companyName } from '../../lib/globalType';
import sendEmail from '../../utils/sendEmail';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import { User } from '../user/user.model';
import { Customer } from '../customer/customer.model';
import {
      IInvoice,
      IInvoiceIdImages,
      IInvoiceOrderDetails,
      IInvoicePayload,
      IInvoicePaymentDetails,
      InvoicePaymentStatus,
      ISendInvoiceEmailPayload,
} from './invoice.interface';
import { Invoice } from './invoice.model';
import { Inventory } from '../inventory/inventory.model';
import RepairRequest from '../repairRequest/repairRequest.model';
import { AuditLog } from '../customer/auditLog.model';

export const sanitizeInvoiceIdImages = <T>(invoice: T): T => {
      if (!invoice) return invoice;
      const invObj: any = typeof (invoice as any).toObject === 'function' ? (invoice as any).toObject() : { ...(invoice as any) };
      const now = Date.now();
      const deleteAfter = invObj.idImageDeleteAfter || invObj.idImages?.deleteAfter;
      if (deleteAfter && new Date(deleteAfter).getTime() <= now) {
            if (invObj.idImages) {
                  invObj.idImages = {
                        isDeleted: true,
                        front: null,
                        back: null,
                        deleteAfter,
                        deletedAt: invObj.idImages.deletedAt || new Date(deleteAfter),
                        message: 'ID image deleted automatically after 28 days per retention policy.',
                  };
            }
      }
      return invObj as T;
};

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

const createInvoice = async (
      payload: IInvoicePayload,
      file?: Express.Multer.File,
      nidFiles?: { front?: Express.Multer.File; back?: Express.Multer.File }
): Promise<IInvoice> => {
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

      // Handle ID image uploads (e.g. from Purchase Invoice trade-in)
      let idImagesData: IInvoiceIdImages | undefined = undefined;
      let frontUpload = null;
      let backUpload = null;

      if (nidFiles?.front) {
            frontUpload = await uploadToCloudinary(nidFiles.front.path);
            try {
                  if (fs.existsSync(nidFiles.front.path)) fs.unlinkSync(nidFiles.front.path);
            } catch (_) {}
      }
      if (nidFiles?.back) {
            backUpload = await uploadToCloudinary(nidFiles.back.path);
            try {
                  if (fs.existsSync(nidFiles.back.path)) fs.unlinkSync(nidFiles.back.path);
            } catch (_) {}
      }

      if (frontUpload?.secure_url || backUpload?.secure_url) {
            const deleteAfter = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 days
            idImagesData = {
                  front: frontUpload?.secure_url
                        ? { url: frontUpload.secure_url, public_id: frontUpload.public_id }
                        : undefined,
                  back: backUpload?.secure_url
                        ? { url: backUpload.secure_url, public_id: backUpload.public_id }
                        : undefined,
                  deleteAfter,
                  isDeleted: false,
            };
      } else if (payload.idImages) {
            const parsed = parseJsonObject<IInvoiceIdImages>(payload.idImages, 'idImages');
            if (parsed && (parsed.front?.url || parsed.back?.url)) {
                  const deleteAfter = parsed.deleteAfter
                        ? new Date(parsed.deleteAfter)
                        : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
                  idImagesData = {
                        ...parsed,
                        deleteAfter,
                        isDeleted: false,
                  };
            }
      }

      const session = await Invoice.startSession();
      try {
            session.startTransaction();

            const [result] = await Invoice.create(
                  [
                        {
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
                              idImages: idImagesData,
                              idImageDeleteAfter: idImagesData?.deleteAfter,
                        },
                  ],
                  { session }
            );

            // Process payment allocations to previous customer invoices (Callout 4 & 5)
            let allocations: Array<{ invoiceId: string; amountApplied: number }> = [];
            try {
                  allocations = typeof payload.allocations === 'string'
                        ? JSON.parse(payload.allocations)
                        : payload.allocations || [];
            } catch {
                  // Ignore parse errors
            }

            if (Array.isArray(allocations) && allocations.length > 0) {
                  for (const alloc of allocations) {
                        const allocInvoiceId = String(alloc.invoiceId || '').trim();
                        const amountApplied = Number(alloc.amountApplied) || 0;

                        if (allocInvoiceId && allocInvoiceId !== 'today' && amountApplied > 0 && Types.ObjectId.isValid(allocInvoiceId)) {
                              const targetInv = await Invoice.findOne({
                                    _id: new Types.ObjectId(allocInvoiceId),
                                    shopkeeperId,
                              }).session(session);

                              if (targetInv) {
                                    const existingTotal = Number(targetInv.totalAmount) || 0;
                                    const existingPaid = Number(
                                          targetInv.amountPaid ??
                                          targetInv.paymentDetails?.amountPaid ??
                                          (targetInv.paymentStatus === 'paid' ? existingTotal : 0)
                                    ) || 0;
                                    const newPaid = existingPaid + amountApplied;

                                    let newDue = 0;
                                    if (targetInv.dueAmount !== null && targetInv.dueAmount !== undefined) {
                                          newDue = Math.max(0, Number(targetInv.dueAmount) - amountApplied);
                                    } else {
                                          newDue = Math.max(0, existingTotal - newPaid);
                                    }

                                    const newStatus: InvoicePaymentStatus = newDue <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'due';

                                    await Invoice.findByIdAndUpdate(
                                          targetInv._id,
                                          {
                                                $set: {
                                                      amountPaid: newPaid,
                                                      dueAmount: newDue,
                                                      paymentStatus: newStatus,
                                                },
                                          },
                                          { session }
                                    );

                                    await AuditLog.create(
                                          [
                                                {
                                                      action: 'payment_adjustment',
                                                      shopkeeperId,
                                                      shopId: targetInv.shopId || shopId,
                                                      customerId: targetInv.customerInfo,
                                                      invoiceId: targetInv._id,
                                                      details: {
                                                            amountApplied,
                                                            previousDue: targetInv.dueAmount,
                                                            newDue,
                                                            newAmountPaid: newPaid,
                                                            paymentStatus: newStatus,
                                                            paymentMethod,
                                                            createdInvoiceId: result._id,
                                                      },
                                                },
                                          ],
                                          { session }
                                    );
                              }
                        }
                  }
            }

            if (repairRequestId) {
                  const repairRequest = await RepairRequest.findOneAndUpdate(
                        {
                              _id: repairRequestId,
                              userId: shopkeeperId,
                              status: { $in: ['completed', 'approved'] },
                        },
                        { $set: { status: 'collected' } },
                        { new: true, session }
                  );

                  if (!repairRequest) {
                        throw new AppError('Repair order is no longer ready for collection', StatusCodes.CONFLICT);
                  }
            }

            for (const line of lineItems) {
                  let updateRes;
                  if (line.variantId) {
                        updateRes = await Inventory.updateOne(
                              { _id: line.itemId },
                              { $inc: { 'variants.$[variant].quantity': -Number(line.quantity) } },
                              {
                                    arrayFilters: [{ 'variant._id': line.variantId, 'variant.quantity': { $gte: Number(line.quantity) } }],
                                    session,
                              }
                        );
                  } else {
                        updateRes = await Inventory.updateOne(
                              { _id: line.itemId, quantity: { $gte: Number(line.quantity) } },
                              { $inc: { quantity: -Number(line.quantity) } },
                              { session }
                        );
                  }

                  if (updateRes.matchedCount === 0 || updateRes.modifiedCount === 0) {
                        throw new AppError('One or more selected items no longer have enough stock', StatusCodes.CONFLICT);
                  }
            }

            await session.commitTransaction();
            return sanitizeInvoiceIdImages(result);
      } catch (error) {
            await session.abortTransaction();
            throw error;
      } finally {
            await session.endSession();
      }
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
            const invoices = await Invoice.find(listFilter)
                  .populate('shopkeeperId')
                  .populate('customerInfo')
                  .populate('itemsIds', 'itemName imeiNumber expectedPrice image')
                  .sort({ createdAt: -1, _id: -1 });
            return invoices.map(sanitizeInvoiceIdImages);
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
            data: data.map(sanitizeInvoiceIdImages),
            meta: {
                  page,
                  limit,
                  total,
                  totalPage: Math.max(1, Math.ceil(total / limit)),
            },
      };
};

const getAllInvoices = async () => {
      const invoices = await Invoice.find()
            .populate('shopkeeperId')
            .populate('customerInfo')
            .populate('itemsIds', 'itemName imeiNumber expectedPrice image')
            .sort({ createdAt: -1 });
      return invoices.map(sanitizeInvoiceIdImages);
};

const getInvoiceById = async (id: string) => {
      const trimmedId = String(id ?? '').trim();
      if (!Types.ObjectId.isValid(trimmedId)) {
            throw new AppError('Invalid invoice ID', StatusCodes.BAD_REQUEST);
      }

      const invoice = await Invoice.findById(trimmedId)
            .populate('shopkeeperId')
            .populate('customerInfo')
            .populate('itemsIds', 'itemName imeiNumber expectedPrice image');

      if (!invoice) {
            throw new AppError('Invoice not found', StatusCodes.NOT_FOUND);
      }

      return sanitizeInvoiceIdImages(invoice);
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

      // Also clean up any linked ID images from Cloudinary
      if (invoice.idImages?.front?.public_id) {
            await deleteFromCloudinary(invoice.idImages.front.public_id, 'image');
      }
      if (invoice.idImages?.back?.public_id) {
            await deleteFromCloudinary(invoice.idImages.back.public_id, 'image');
      }

      await Invoice.findByIdAndDelete(id);

      return null;
};

const getInvoicesByCustomerId = async (
      customerId: string,
      shopkeeperId: string,
      shopId?: unknown,
) => {
      const trimmedCustomerId = String(customerId ?? '').trim();
      const trimmedShopkeeperId = String(shopkeeperId ?? '').trim();

      if (!Types.ObjectId.isValid(trimmedCustomerId)) {
            throw new AppError('Invalid customerId', StatusCodes.BAD_REQUEST);
      }
      if (!Types.ObjectId.isValid(trimmedShopkeeperId)) {
            throw new AppError('Invalid shopkeeperId', StatusCodes.BAD_REQUEST);
      }

      const filter: Record<string, unknown> = {
            shopkeeperId: new Types.ObjectId(trimmedShopkeeperId),
            customerInfo: new Types.ObjectId(trimmedCustomerId),
      };

      if (shopId && Types.ObjectId.isValid(String(shopId))) {
            filter.$or = [{ shopId: new Types.ObjectId(String(shopId)) }, { shopId: null }];
      }

      const invoices = await Invoice.find(filter)
            .populate('shopkeeperId')
            .populate('customerInfo')
            .populate('itemsIds', 'itemName imeiNumber expectedPrice image')
            .sort({ createdAt: -1, _id: -1 })
            .lean();

      let totalInvoiced = 0;
      let totalPaid = 0;
      let totalDue = 0;

      const formattedInvoices = invoices.map((rawInv) => {
            const inv = sanitizeInvoiceIdImages(rawInv);
            const invoiceAmount = Number(inv.totalAmount) || 0;
            const paidAmount = Number(
                  inv.amountPaid ??
                  inv.paymentDetails?.amountPaid ??
                  (inv.paymentStatus === 'paid' ? invoiceAmount : 0)
            ) || 0;

            let due = 0;
            if (inv.dueAmount !== null && inv.dueAmount !== undefined) {
                  due = Number(inv.dueAmount);
            } else {
                  due = Math.max(0, invoiceAmount - paidAmount);
            }

            const status = due <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due';

            totalInvoiced += invoiceAmount;
            totalPaid += paidAmount;
            totalDue += due;

            return {
                  ...inv,
                  invoiceAmount,
                  paidAmount,
                  dueAmount: due,
                  status,
            };
      });

      const paymentStatus = totalDue <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'due';

      const paymentActivities = formattedInvoices
            .filter((inv) => inv.paidAmount > 0)
            .map((inv) => ({
                  id: String(inv._id),
                  date: inv.createdAt,
                  amount: inv.paidAmount,
                  paymentMethod: inv.paymentMethod || 'cash',
                  invoiceNumber: inv.invoiceNumber || `INV-${String(inv._id).slice(-4).toUpperCase()}`,
                  invoiceType: inv.type,
            }));

      return {
            invoices: formattedInvoices,
            summary: {
                  totalInvoiced,
                  totalPaid,
                  totalDue,
                  paymentStatus,
                  count: formattedInvoices.length,
            },
            paymentActivities,
      };
};

const sendInvoiceEmail = async (userId: string, payload: ISendInvoiceEmailPayload) => {
      const email = payload.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) {
            throw new AppError('Valid recipient email is required', StatusCodes.BAD_REQUEST);
      }

      const sender = await User.findById(userId).select('firstName lastName shopName email');
      const senderName = sender
            ? [sender.firstName, sender.lastName].filter(Boolean).join(' ') || (sender as any).shopName
            : 'Shopkeeper';

      const invoiceRef = payload.invoiceRef || 'Invoice';
      const amountLabel = payload.amountLabel || '';
      const customerName = payload.customerName || 'Valued Customer';
      const pdfUrl = payload.pdfUrl || '';

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice ${invoiceRef}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff; border-radius:12px; overflow:hidden;
          box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#111827; padding:24px 30px;">
              <h2 style="margin:0; color:#ffffff; font-size:18px; letter-spacing:0.5px;">
                ${companyName} · Invoice Copy
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <p style="margin:0 0 12px 0; font-size:15px; color:#4b5563;">
                Hello ${customerName},
              </p>
              <p style="font-size:15px; line-height:1.6; color:#4b5563; margin:0 0 20px 0;">
                Please find your invoice copy for reference <strong>${invoiceRef}</strong> below.
              </p>
              
              <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:18px 24px; margin-bottom:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px; color:#6b7280; padding-bottom:6px;">Invoice Reference:</td>
                    <td align="right" style="font-size:14px; font-weight:700; color:#111827; padding-bottom:6px;">${invoiceRef}</td>
                  </tr>
                  ${amountLabel ? `
                  <tr>
                    <td style="font-size:13px; color:#6b7280;">Total Amount:</td>
                    <td align="right" style="font-size:16px; font-weight:700; color:#0A9F55;">${amountLabel}</td>
                  </tr>` : ''}
                </table>
              </div>

              ${pdfUrl ? `
              <div style="text-align:center; margin:28px 0;">
                <a href="${pdfUrl}" target="_blank"
                  style="display:inline-block; background:#0A9F55; color:#ffffff; text-decoration:none;
                  padding:13px 28px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.3px;">
                  View & Download Invoice (PDF)
                </a>
              </div>
              ` : ''}

              <p style="margin:24px 0 0 0; font-size:14px; color:#374151;">
                Best regards,<br />
                <strong>${senderName}</strong>
              </p>

              <div style="margin:30px 0; border-top:1px solid #e5e7eb;"></div>
              <p style="font-size:12px; color:#9ca3af; margin:0;">
                This is an automated invoice email sent via ${companyName}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb; padding:16px 30px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#6b7280;">
                © ${new Date().getFullYear()} ${companyName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      let attachments: any[] | undefined = undefined;
      if (pdfUrl && (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://'))) {
            const cleanRef = invoiceRef.replace(/[^a-zA-Z0-9_-]/g, '_');
            attachments = [
                  {
                        filename: `${cleanRef || 'Invoice'}.pdf`,
                        path: pdfUrl,
                        contentType: 'application/pdf',
                  },
            ];
      }

      const result = await sendEmail({
            to: email,
            subject: `Invoice ${invoiceRef}`,
            html,
            fromName: senderName,
            attachments,
      });

      if (!result.success) {
            throw new AppError(result.error || 'Failed to send invoice email', StatusCodes.INTERNAL_SERVER_ERROR);
      }

      // If customerId is provided and customer has no email, optionally save
      if (payload.customerId && Types.ObjectId.isValid(payload.customerId)) {
            const cust = await Customer.findById(payload.customerId);
            if (cust && !cust.email) {
                  await Customer.findByIdAndUpdate(payload.customerId, { email });
            }
      }

      return {
            sent: true,
            recipient: email,
            invoiceRef,
      };
};

const invoiceService = {
      createInvoice,
      getInvoiceById,
      getInvoiceByShopkeeperId,
      getInvoicesByCustomerId,
      getAllInvoices,
      updateInvoice,
      deleteInvoice,
      sendInvoiceEmail,
};

export default invoiceService;

