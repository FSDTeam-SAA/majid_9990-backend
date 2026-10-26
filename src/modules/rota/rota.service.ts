import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { Shop } from '../shop/shop.model';
import { Rota } from './rota.model';
import { IShift } from './rota.interface';

// Helper: Normalize date to Monday 00:00:00.000 UTC
export const getMondayOfWeek = (inputDate?: Date | string): Date => {
  const d = inputDate ? new Date(inputDate) : new Date();
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Helper: Get array of 7 dates (Mon-Sun)
export const getWeekDates = (monday: Date): Date[] => {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    days.push(nextDay);
  }
  return days;
};

const getRota = async (shopId: string, weekStartDateStr?: string) => {
  if (!Types.ObjectId.isValid(shopId)) {
    throw new AppError('Invalid Shop ID', StatusCodes.BAD_REQUEST);
  }

  const weekStartDate = getMondayOfWeek(weekStartDateStr);

  let rota = await Rota.findOne({
    shopId: new Types.ObjectId(shopId),
    weekStartDate,
  }).populate('shifts.staffId', 'firstName lastName email staffId hourlyWage image');

  // Fetch all staff members assigned to this store or shopkeeper
  const shop = await Shop.findById(shopId);
  const staffQuery: Record<string, unknown> = {
    role: 'staff',
    $or: [
      { shopId: new Types.ObjectId(shopId) },
      { assignedShopId: new Types.ObjectId(shopId) },
    ],
  };

  if (shop?.shopkeeperId) {
    (staffQuery.$or as Array<Record<string, unknown>>).push({
      shopkeeperId: shop.shopkeeperId,
    });
  }

  const staffMembers = await User.find(staffQuery).select(
    'firstName lastName email staffId hourlyWage image workingDays'
  );

  const weekDates = getWeekDates(weekStartDate);

  // If no rota exists, generate a default template draft
  if (!rota) {
    const initialShifts: IShift[] = [];
    staffMembers.forEach((member) => {
      weekDates.forEach((date, dayIdx) => {
        // Monday (0) to Friday (4) scheduled 09:00 - 17:00, Sat/Sun off by default
        const isDefaultOff = dayIdx >= 5;
        initialShifts.push({
          staffId: member._id as unknown as Types.ObjectId,
          date,
          startTime: '09:00',
          endTime: '17:00',
          hours: isDefaultOff ? 0 : 8,
          isOff: isDefaultOff,
          note: isDefaultOff ? 'Off' : '',
        });
      });
    });

    rota = await Rota.create({
      shopId: new Types.ObjectId(shopId),
      weekStartDate,
      status: 'draft',
      shifts: initialShifts,
    });

    rota = await Rota.findById(rota._id).populate(
      'shifts.staffId',
      'firstName lastName email staffId hourlyWage image'
    );
  }

  // Calculate Coverage & Stats
  const dailyCoverage: Record<string, number> = {};
  weekDates.forEach((d) => {
    dailyCoverage[d.toISOString().split('T')[0]] = 0;
  });

  let totalScheduledHours = 0;
  let estimatedRotaCost = 0;
  let unfilledShifts = 0;

  if (rota?.shifts) {
    rota.shifts.forEach((shift) => {
      if (!shift.isOff && shift.hours > 0) {
        const dateKey = new Date(shift.date).toISOString().split('T')[0];
        dailyCoverage[dateKey] = (dailyCoverage[dateKey] || 0) + 1;
        totalScheduledHours += shift.hours;

        const staffObj = shift.staffId as unknown as { hourlyWage?: number };
        const hourlyWage = staffObj?.hourlyWage || 12;
        estimatedRotaCost += shift.hours * hourlyWage;
      } else if (shift.isOff) {
        // Unfilled or off shift
      }
    });
  }

  return {
    rota,
    staffMembers,
    weekDates,
    dailyCoverage,
    totalScheduledHours,
    estimatedRotaCost,
    unfilledShifts,
  };
};

const saveRota = async (
  user: any,
  payload: {
    shopId: string;
    weekStartDate: string;
    shifts: IShift[];
    status?: 'draft' | 'published';
  }
) => {
  const { shopId, weekStartDate: weekStr, shifts, status = 'draft' } = payload;
  if (!Types.ObjectId.isValid(shopId)) {
    throw new AppError('Invalid Shop ID', StatusCodes.BAD_REQUEST);
  }

  const weekStartDate = getMondayOfWeek(weekStr);

  const updatedRota = await Rota.findOneAndUpdate(
    { shopId: new Types.ObjectId(shopId), weekStartDate },
    {
      shopId: new Types.ObjectId(shopId),
      weekStartDate,
      status,
      shifts,
      createdBy: user?._id ? new Types.ObjectId(user._id) : undefined,
      publishedAt: status === 'published' ? new Date() : undefined,
    },
    { new: true, upsert: true }
  ).populate('shifts.staffId', 'firstName lastName email staffId hourlyWage image');

  return updatedRota;
};

const publishRota = async (shopId: string, weekStartDateStr: string) => {
  if (!Types.ObjectId.isValid(shopId)) {
    throw new AppError('Invalid Shop ID', StatusCodes.BAD_REQUEST);
  }

  const weekStartDate = getMondayOfWeek(weekStartDateStr);

  const rota = await Rota.findOneAndUpdate(
    { shopId: new Types.ObjectId(shopId), weekStartDate },
    { status: 'published', publishedAt: new Date() },
    { new: true }
  ).populate('shifts.staffId', 'firstName lastName email staffId hourlyWage image');

  if (!rota) {
    throw new AppError('Rota not found to publish', StatusCodes.NOT_FOUND);
  }

  return rota;
};

const copyLastWeek = async (shopId: string, currentWeekStartDateStr: string) => {
  if (!Types.ObjectId.isValid(shopId)) {
    throw new AppError('Invalid Shop ID', StatusCodes.BAD_REQUEST);
  }

  const currentMonday = getMondayOfWeek(currentWeekStartDateStr);
  const lastWeekMonday = new Date(currentMonday);
  lastWeekMonday.setDate(currentMonday.getDate() - 7);

  const lastWeekRota = await Rota.findOne({
    shopId: new Types.ObjectId(shopId),
    weekStartDate: lastWeekMonday,
  });

  if (!lastWeekRota || !lastWeekRota.shifts.length) {
    throw new AppError(
      'No shifts found in the previous week to copy',
      StatusCodes.NOT_FOUND
    );
  }

  // Clone shifts and project to current week dates
  const newShifts: IShift[] = lastWeekRota.shifts.map((shift) => {
    const shiftDate = new Date(shift.date);
    const dayOffset = (shiftDate.getDay() + 6) % 7; // Mon=0, Sun=6
    const projectedDate = new Date(currentMonday);
    projectedDate.setDate(currentMonday.getDate() + dayOffset);

    return {
      staffId: shift.staffId,
      date: projectedDate,
      startTime: shift.startTime,
      endTime: shift.endTime,
      hours: shift.hours,
      isOff: shift.isOff,
      note: shift.note,
    };
  });

  const rota = await Rota.findOneAndUpdate(
    { shopId: new Types.ObjectId(shopId), weekStartDate: currentMonday },
    {
      shopId: new Types.ObjectId(shopId),
      weekStartDate: currentMonday,
      status: 'draft',
      shifts: newShifts,
    },
    { new: true, upsert: true }
  ).populate('shifts.staffId', 'firstName lastName email staffId hourlyWage image');

  return rota;
};

const rotaService = {
  getRota,
  saveRota,
  publishRota,
  copyLastWeek,
};

export default rotaService;
