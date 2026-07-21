import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import { User } from '../user/user.model';
import { IInvoice, IInvoicePayload } from './invoice.interface';
import { Invoice } from './invoice.model';

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

const createInvoice = async (payload: IInvoicePayload, file?: Express.Multer.File): Promise<IInvoice> => {
      const shopkeeperId = await resolveShopkeeperId(payload.shopkeeperId);
      const invoiceFile = await buildInvoiceFile(file);

      const type = String(payload.type ?? '').trim();
      const customerInfo = normalizeObjectId(payload.customerInfo ?? undefined);
      const itemsIds = normalizeObjectIdArray(payload.itemsIds);

      if (!type) {
            throw new AppError('type is required', StatusCodes.BAD_REQUEST);
      }

      const result = await Invoice.create({
            shopkeeperId,
            invoice: invoiceFile,
            type,
            customerInfo,
            itemsIds,

            totalAmount: payload.totalAmount,
            dueAmount: payload.dueAmount,
            repairRequestId: normalizeObjectId(payload.repairRequestId),
            tax: payload.tax,
            paymentMethod: payload.paymentMethod?.trim(),
            discountName: payload.discountName?.trim(),
            discountPercentage: payload.discountPercentage,
            discountAmount: payload.discountAmount,
      });

      return result;
};

const getInvoiceByShopkeeperId = async (shopkeeperId: string) => {
      const trimmedShopkeeperId = String(shopkeeperId ?? '').trim();

      if (!Types.ObjectId.isValid(trimmedShopkeeperId)) {
            throw new AppError('Invalid shopkeeperId', StatusCodes.BAD_REQUEST);
      }

      return await Invoice.find({ shopkeeperId: trimmedShopkeeperId })
            .populate('shopkeeperId')
            .populate('customerInfo')
            .populate('itemsIds', 'itemName imeiNumber expectedPrice image')
            .sort({ createdAt: -1 });
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
                  | 'paymentMethod'
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

      if (payload.paymentMethod !== undefined) {
            updateData.paymentMethod = payload.paymentMethod?.trim();
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
