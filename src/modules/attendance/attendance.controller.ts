import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import attendanceService from './attendance.service';

const verifyToken = catchAsync(async (req, res) => {
  const token = (req.query.token as string) || (req.body.token as string);
  const result = await attendanceService.verifyStoreToken(token);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Store NFC token verified successfully',
    data: result,
  });
});

const staffCheck = catchAsync(async (req, res) => {
  const staffId = (req.query.staffId as string) || (req.body.staffId as string);
  const storeToken = (req.query.storeToken as string) || (req.body.storeToken as string);

  const result = await attendanceService.checkStaff(staffId, storeToken);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Staff verified successfully',
    data: result,
  });
});

const clockTap = catchAsync(async (req, res) => {
  const result = await attendanceService.clockTap(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance record submitted successfully',
    data: result,
  });
});

const getStaffAttendance = catchAsync(async (req, res) => {
  const paramStaffId = Array.isArray(req.params.staffId) ? req.params.staffId[0] : req.params.staffId;
  const staffId = paramStaffId || (req.user?._id?.toString() as string);
  const result = await attendanceService.getStaffAttendanceHistory(staffId, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Staff attendance history fetched successfully',
    data: result,
  });
});

const getShopAttendanceLogs = catchAsync(async (req, res) => {
  const paramShopId = Array.isArray(req.params.shopId) ? req.params.shopId[0] : req.params.shopId;
  const shopId = paramShopId || (req.query.shopId as string) || (req.user?.shopId?.toString() as string);
  const result = await attendanceService.getShopAttendanceLogs(shopId, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop attendance logs fetched successfully',
    data: result,
  });
});

const getNfcSettings = catchAsync(async (req, res) => {
  const paramShopId = Array.isArray(req.params.shopId) ? req.params.shopId[0] : req.params.shopId;
  const shopId = paramShopId || (req.user?.shopId?.toString() as string);
  const rotate = req.query.rotate === 'true';
  const result = await attendanceService.getOrGenerateNfcToken(shopId, rotate);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'NFC store settings fetched successfully',
    data: result,
  });
});

const updateNfcSettings = catchAsync(async (req, res) => {
  const paramShopId = Array.isArray(req.params.shopId) ? req.params.shopId[0] : req.params.shopId;
  const shopId = paramShopId || (req.user?.shopId?.toString() as string);
  const result = await attendanceService.updateNfcSettings(shopId, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'NFC store settings updated successfully',
    data: result,
  });
});

const attendanceController = {
  verifyToken,
  staffCheck,
  clockTap,
  getStaffAttendance,
  getShopAttendanceLogs,
  getNfcSettings,
  updateNfcSettings,
};

export default attendanceController;
