import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { Shop } from '../shop/shop.model';
import { LeaveRequest } from './leave.model';
import { TLeaveType, TLeaveStatus } from './leave.interface';

const getLeaveBalance = async (staffId: string) => {
  let staff = null;

  if (Types.ObjectId.isValid(staffId)) {
    staff = await User.findById(staffId);
  }
  if (!staff) {
    staff = await User.findOne({
      $or: [{ staffId: staffId.trim() }, { idNumber: staffId.trim() }],
    });
  }

  if (!staff) {
    throw new AppError('Staff member not found', StatusCodes.NOT_FOUND);
  }

  const totalAllowanceHours = staff.leaveAllowanceHours ?? 160;
  const usedHours = staff.usedLeaveHours ?? 0;
  const bookedHours = staff.bookedLeaveHours ?? 0;
  const remainingHours = Math.max(0, totalAllowanceHours - usedHours - bookedHours);

  return {
    staffId: staff._id,
    staffName: `${staff.firstName} ${staff.lastName || ''}`.trim(),
    totalAllowanceHours,
    usedHours,
    bookedHours,
    remainingHours,
  };
};

const createLeaveRequest = async (
  staffIdInput: string,
  payload: {
    shopId?: string;
    leaveType: TLeaveType;
    date: string | Date;
    endDate?: string | Date;
    durationHours: number;
    note?: string;
  }
) => {
  const { shopId: inputShopId, leaveType, date, endDate, durationHours, note } = payload;

  let staff = null;
  if (Types.ObjectId.isValid(staffIdInput)) {
    staff = await User.findById(staffIdInput);
  }
  if (!staff) {
    staff = await User.findOne({
      $or: [{ staffId: staffIdInput.trim() }, { idNumber: staffIdInput.trim() }],
    });
  }

  if (!staff) {
    throw new AppError('Staff member not found', StatusCodes.NOT_FOUND);
  }

  // Resolve shopId
  let resolvedShopId = inputShopId || staff.shopId || staff.assignedShopId;
  if (!resolvedShopId) {
    const shop = await Shop.findOne({ shopkeeperId: staff.shopkeeperId });
    resolvedShopId = shop?._id;
  }
  if (!resolvedShopId) {
    const defaultShop = await Shop.findOne();
    resolvedShopId = defaultShop?._id;
  }

  if (!resolvedShopId) {
    throw new AppError('Store could not be determined for this staff member', StatusCodes.BAD_REQUEST);
  }

  // Increment booked leave hours
  staff.bookedLeaveHours = (staff.bookedLeaveHours || 0) + Number(durationHours);
  await staff.save();

  const newRequest = await LeaveRequest.create({
    staffId: staff._id,
    shopId: resolvedShopId,
    leaveType,
    date: new Date(date),
    endDate: endDate ? new Date(endDate) : undefined,
    durationHours: Number(durationHours),
    note: note || '',
    status: 'pending',
  });

  return newRequest;
};

const getLeaveRequests = async (query: {
  shopId?: string;
  staffId?: string;
  status?: TLeaveStatus;
}) => {
  const filter: Record<string, unknown> = {};

  if (query.shopId && Types.ObjectId.isValid(query.shopId)) {
    filter.shopId = new Types.ObjectId(query.shopId);
  }

  if (query.staffId) {
    if (Types.ObjectId.isValid(query.staffId)) {
      filter.staffId = new Types.ObjectId(query.staffId);
    } else {
      const staff = await User.findOne({ staffId: query.staffId.trim() });
      if (staff) {
        filter.staffId = staff._id;
      }
    }
  }

  if (query.status) {
    filter.status = query.status;
  }

  const requests = await LeaveRequest.find(filter)
    .populate('staffId', 'firstName lastName email staffId image')
    .populate('shopId', 'shopName storeCode')
    .sort({ createdAt: -1 });

  return requests;
};

const decideLeaveRequest = async (
  leaveId: string,
  user: any,
  status: 'approved' | 'rejected',
  managerComment?: string
) => {
  if (!Types.ObjectId.isValid(leaveId)) {
    throw new AppError('Invalid Leave Request ID', StatusCodes.BAD_REQUEST);
  }

  const leaveRequest = await LeaveRequest.findById(leaveId);
  if (!leaveRequest) {
    throw new AppError('Leave request not found', StatusCodes.NOT_FOUND);
  }

  if (leaveRequest.status !== 'pending') {
    throw new AppError(`Leave request has already been ${leaveRequest.status}`, StatusCodes.BAD_REQUEST);
  }

  const staff = await User.findById(leaveRequest.staffId);
  if (staff) {
    const hours = leaveRequest.durationHours || 0;
    // Release booked hours
    staff.bookedLeaveHours = Math.max(0, (staff.bookedLeaveHours || 0) - hours);

    if (status === 'approved' && leaveRequest.leaveType !== 'unpaid') {
      // Deduct from remaining by adding to used hours
      staff.usedLeaveHours = (staff.usedLeaveHours || 0) + hours;
    }

    await staff.save();
  }

  leaveRequest.status = status;
  leaveRequest.decidedBy = user?._id ? new Types.ObjectId(user._id) : undefined;
  leaveRequest.decidedAt = new Date();
  if (managerComment) {
    leaveRequest.managerComment = managerComment;
  }

  await leaveRequest.save();

  return leaveRequest;
};

const leaveService = {
  getLeaveBalance,
  createLeaveRequest,
  getLeaveRequests,
  decideLeaveRequest,
};

export default leaveService;
