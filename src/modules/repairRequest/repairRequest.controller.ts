import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import repairRequestService from "./repairRequest.service";


const addNewRepairRequest = catchAsync(async (req, res) => {
    const result = await repairRequestService.addNewRepairRequest(req.body);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Repair request created successfully',
        data: result,
    });
});


const repairRequestController = {
    addNewRepairRequest,
};

export default repairRequestController;