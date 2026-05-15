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

const createInvoice = async (payload: IInvoicePayload, file?: Express.Multer.File): Promise<IInvoice> => {
      const shopkeeperId = await resolveShopkeeperId(payload.shopkeeperId);
      const invoiceFile = await buildInvoiceFile(file);

      const type = String(payload.type ?? '').trim();

      if (!type) {
            throw new AppError('type is required', StatusCodes.BAD_REQUEST);
      }

      const result = await Invoice.create({
            shopkeeperId,
            invoice: invoiceFile,
            type,
      });

      return result;
};

const getInvoiceByShopkeeperId = async (shopkeeperId: string) => {
      const trimmedShopkeeperId = String(shopkeeperId ?? '').trim();

      if (!Types.ObjectId.isValid(trimmedShopkeeperId)) {
            throw new AppError('Invalid shopkeeperId', StatusCodes.BAD_REQUEST);
      }

      return await Invoice.find({ shopkeeperId: trimmedShopkeeperId })
            .populate('shopkeeperId', 'firstName lastName email phone role shopName')
            .sort({ createdAt: -1 });
};

const getAllInvoices = async () => {
      return await Invoice.find()
            .populate('shopkeeperId', 'firstName lastName email phone role shopName')
            .sort({ createdAt: -1 });
};

const updateInvoice = async (id: string, payload: IInvoicePayload, file?: Express.Multer.File) => {
      const invoice = await Invoice.findById(id);

      if (!invoice) {
            throw new AppError('Invoice not found', StatusCodes.NOT_FOUND);
      }

      const updateData: Partial<Pick<IInvoice, 'shopkeeperId' | 'type'>> & {
            invoice?: IInvoice['invoice'];
      } = {};

      if (payload.shopkeeperId) {
            updateData.shopkeeperId = await resolveShopkeeperId(payload.shopkeeperId);
      }

      const type = String(payload.type ?? '').trim();

      if (type) {
            updateData.type = type;
      }

      if (file) {
            await deleteFromCloudinary(invoice.invoice.public_id, invoice.invoice.resource_type || 'raw');
            updateData.invoice = await buildInvoiceFile(file);
      }

      const result = await Invoice.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
      }).populate('shopkeeperId', 'firstName lastName email phone role shopName');

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
