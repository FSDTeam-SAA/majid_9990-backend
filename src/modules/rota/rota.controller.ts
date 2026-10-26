import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import rotaService from './rota.service';

const getRota = catchAsync(async (req, res) => {
  const shopId = (req.query.shopId as string) || (req.user?.shopId?.toString() as string);
  const weekStartDate = req.query.weekStartDate as string;

  const result = await rotaService.getRota(shopId, weekStartDate);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Weekly rota fetched successfully',
    data: result,
  });
});

const saveRota = catchAsync(async (req, res) => {
  const result = await rotaService.saveRota(req.user, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Rota saved successfully',
    data: result,
  });
});

const publishRota = catchAsync(async (req, res) => {
  const { shopId, weekStartDate } = req.body;
  const result = await rotaService.publishRota(shopId, weekStartDate);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Rota published successfully',
    data: result,
  });
});

const copyLastWeek = catchAsync(async (req, res) => {
  const { shopId, weekStartDate } = req.body;
  const result = await rotaService.copyLastWeek(shopId, weekStartDate);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Previous week shifts copied successfully',
    data: result,
  });
});

const rotaController = {
  getRota,
  saveRota,
  publishRota,
  copyLastWeek,
};

export default rotaController;
