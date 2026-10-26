import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import wagesService from './wages.service';

const getMonthlySummary = catchAsync(async (req, res) => {
  const shopId = (req.query.shopId as string) || (req.user?.shopId?.toString() as string);
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;

  const result = await wagesService.getMonthlyWagesSummary(shopId, month, year);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Monthly wages summary fetched successfully',
    data: result,
  });
});

const getExceptionById = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await wagesService.getExceptionById(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exception details fetched successfully',
    data: result,
  });
});

const resolveException = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await wagesService.resolveException(id, req.user, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exception decision approved successfully',
    data: result,
  });
});

const updateStage = catchAsync(async (req, res) => {
  const { shopId, month, year, stage } = req.body;
  const result = await wagesService.updatePayPeriodStage(shopId, month, year, stage, req.user);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pay period stage updated successfully',
    data: result,
  });
});

const exportCsv = catchAsync(async (req, res) => {
  const shopId = (req.query.shopId as string) || (req.user?.shopId?.toString() as string);
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();

  const csv = await wagesService.exportWagesCsv(shopId, month, year);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="wages-${year}-${month}.csv"`
  );
  res.status(StatusCodes.OK).send(csv);
});

const wagesController = {
  getMonthlySummary,
  getExceptionById,
  resolveException,
  updateStage,
  exportCsv,
};

export default wagesController;
