import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import repairRequestService from './repairRequest.service';

const addNewRepairRequest = catchAsync(async (req, res) => {
      const id = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId.toString() : req.user.id;
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
      const id = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId.toString() : req.user.id;
      const result = await repairRequestService.getMyRepairRequestsHistory(id, req.query);

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
      const files = req.files as Express.Multer.File[];
      const result = await repairRequestService.addNoteByShopKeeper(id as string, req.body, files);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Repair request note added successfully',
            data: result,
      });
});

const addTeachNoteByTechnician = catchAsync(async (req, res) => {
      const { id } = req.params;
      const result = await repairRequestService.addTeachNoteByTechnician(id as string, req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Repair request technician note added successfully',
            data: result,
      });
});

const generateTechnicianFeedback = catchAsync(async (req, res) => {
      const { id } = req.params;
      const result = await repairRequestService.generateTechnicianFeedbackByRequest(id as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Technician feedback generated successfully',
            data: result,
      });
});


const getUserDescriptions = catchAsync(async (req, res) => {
      const { userId } = req.params;

      const result = await repairRequestService.getUserDescriptions(userId as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'User descriptions retrieved successfully',
            data: result,
      });
});

const getCompletedRepairRequests = catchAsync(async (req, res) => {
      const id = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId.toString() : req.user.id;
      const result = await repairRequestService.getCompletedRepairRequests(id, req.query);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Completed repair requests retrieved successfully',
            data: result.data,
            meta: result.meta,
      });
});


const repairRequestController = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getSingleRepairRequest,
      updateStatusByShopKeeper,
      addNoteByShopKeeper,
      addTeachNoteByTechnician,
      generateTechnicianFeedback,
      getUserDescriptions,
      getCompletedRepairRequests,
};

export default repairRequestController;
