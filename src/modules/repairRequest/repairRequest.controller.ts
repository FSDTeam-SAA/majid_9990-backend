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


const repairRequestController = {
    addNewRepairRequest,
};

export default repairRequestController;