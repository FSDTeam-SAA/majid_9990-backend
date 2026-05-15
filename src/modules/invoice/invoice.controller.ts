import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import invoiceService from './invoice.service';

const createInvoice = catchAsync(async (req, res) => {
      const result = await invoiceService.createInvoice(req.body, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Invoice created successfully',
            data: result,
      });
});

const getInvoiceByShopkeeperId = catchAsync(async (req, res) => {
      const shopkeeperId = Array.isArray(req.params.shopkeeperId)
            ? req.params.shopkeeperId[0]
            : req.params.shopkeeperId;
      const result = await invoiceService.getInvoiceByShopkeeperId(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Invoices fetched successfully',
            data: result,
      });
});

const getAllInvoices = catchAsync(async (_req, res) => {
      const result = await invoiceService.getAllInvoices();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Invoices fetched successfully',
            data: result,
      });
});

const updateInvoice = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await invoiceService.updateInvoice(id, req.body, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Invoice updated successfully',
            data: result,
      });
});

const deleteInvoice = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      await invoiceService.deleteInvoice(id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Invoice deleted successfully',
            data: null,
      });
});

export default {
      createInvoice,
      getInvoiceByShopkeeperId,
      getAllInvoices,
      updateInvoice,
      deleteInvoice,
};
