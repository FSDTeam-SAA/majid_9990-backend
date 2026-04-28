import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import repairRequestService from "./repairRequest.service";

const addNewRepairRequest = catchAsync(async (req, res) => {
    const { id } = req.user;
    const files = req.files as Express.Multer.File[];
    const result = await repairRequestService.addNewRepairRequest(req.body, files, id);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Repair request created successfully',
        data: result,
    });
});

const getMyRepairRequestsHistory = catchAsync(async (req, res) => {
  const { id } = req.user;
  const result = await repairRequestService.getMyRepairRequestsHistory(
    id,
    req.query
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Repair requests retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getShopKeepersShopsHistory = catchAsync(async (req, res) => {
  const { id } = req.user;
  const result = await repairRequestService.getShopKeepersShopsHistory(
    id,
    req.query
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Repair requests retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});


const getSingleRepairRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await repairRequestService.getSingleRepairRequest(id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Repair request retrieved successfully',
    data: result,
  });
});



const updateStatusByShopKeeper = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await repairRequestService.updateStatusByShopKeeper(id as string, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Repair request status updated successfully',
    data: result,
  });
});


const addNoteByShopKeeper = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await repairRequestService.addNoteByShopKeeper(id as string, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Repair request status updated successfully',
    data: result,
  });
});

const updateQuoteStatusByUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await repairRequestService.updateQuoteStatusByUser(id as string, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Repair request status updated successfully',
    data: result,
  });
});

const repairRequestController = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getShopKeepersShopsHistory,
      getSingleRepairRequest,
      updateStatusByShopKeeper,
      addNoteByShopKeeper,
      updateQuoteStatusByUser,
};

export default repairRequestController;