import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import leaveService from './leave.service';

const getLeaveBalance = catchAsync(async (req, res) => {
  const paramStaffId = Array.isArray(req.params.staffId) ? req.params.staffId[0] : req.params.staffId;
  const staffId = paramStaffId || (req.user?._id?.toString() as string);
  const result = await leaveService.getLeaveBalance(staffId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Staff leave balance fetched successfully',
    data: result,
  });
});

const createLeaveRequest = catchAsync(async (req, res) => {
  const staffId = (req.body.staffId as string) || (req.user?._id?.toString() as string);
  const result = await leaveService.createLeaveRequest(staffId, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Leave request submitted successfully',
    data: result,
  });
});

const getLeaveRequests = catchAsync(async (req, res) => {
  const result = await leaveService.getLeaveRequests(req.query as any);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Leave requests fetched successfully',
    data: result,
  });
});

const decideLeaveRequest = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, managerComment } = req.body;
  const result = await leaveService.decideLeaveRequest(id, req.user, status, managerComment);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Leave request ${status} successfully`,
    data: result,
  });
});

const leaveController = {
  getLeaveBalance,
  createLeaveRequest,
  getLeaveRequests,
  decideLeaveRequest,
};

export default leaveController;
