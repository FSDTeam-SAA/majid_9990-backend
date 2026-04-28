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



// controller
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



const repairRequestController = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getShopKeepersShopsHistory,
      getSingleRepairRequest,
};

export default repairRequestController;