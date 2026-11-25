import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { FilterQuery, Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { uploadToCloudinary } from '../../utils/cloudinary';
import config from '../../config/config';
import { generateTechnicianFeedback } from '../../utils/technicianFeedback';
import { sendRepairCompletionEmail, sendRepairStatusEmail } from '../../utils/email/email.service';
import { getCurrencySymbol } from '../../utils/email/email.templates';
import {
      decryptDevicePasscode,
      DevicePasscodeType,
      encryptDevicePasscode,
      isAuthorizedTechnicianRole,
} from '../../utils/passcodeCrypto';
import { User } from '../user/user.model';
import Shop from '../shop/shop.model';
import { IRepairRequest, IRepairRequestStatusUpdatePayload } from './repairRequest.interface';
import RepairRequest from './repairRequest.model';
import { generateRepairStatusPdfBuffer } from './repairPdf.service';

const assertValidRepairRequestId = (id: string) => {
      if (!Types.ObjectId.isValid(id)) {
            throw new AppError('Valid repair request id is required', StatusCodes.BAD_REQUEST);
      }
};

const getPagination = (query: { page?: unknown; limit?: unknown }) => {
      const requestedPage = Number.parseInt(String(query.page ?? ''), 10);
      const requestedLimit = Number.parseInt(String(query.limit ?? ''), 10);
      const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 10;

      return {
            page,
            limit,
            skip: (page - 1) * limit,
      };
};

const normalizeRepairIssues = (issues: unknown): any[] => {
      if (!Array.isArray(issues)) return [];
      return issues.map((iss: any) => {
            const category = iss?.category || iss?.issueCategory || 'General Issue';
            const rawProblems = iss?.problems || iss?.commonProblems || [];
            const problems = Array.isArray(rawProblems)
                  ? rawProblems.map((p: any) => String(p)).filter(Boolean)
                  : typeof rawProblems === 'string' && rawProblems.trim().length > 0
                    ? [rawProblems.trim()]
                    : ['Repair inspection'];
            const parsedPrice = Number(iss?.estimatedPrice ?? iss?.price ?? 0);
            return {
                  ...iss,
                  category,
                  problems: problems.length > 0 ? problems : ['Repair inspection'],
                  additionalInfo: iss?.additionalInfo || iss?.additionalDetails || '',
                  estimatedTime: iss?.estimatedTime || '1-2 Hours',
                  estimatedPrice: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0,
            };
      });
};

const buildPasscodeField = (raw: any) => {
      if (!raw || typeof raw !== 'object') return undefined;
      if (raw.clear === true || raw.type === 'none') {
            return { type: 'none' as const, encryptedValue: '', isSet: false, maskedValue: '', lengthHint: 0 };
      }
      const rawType = String(raw.type || '').toLowerCase();
      const allowedTypes: DevicePasscodeType[] = ['pin', 'password', 'pattern'];
      const type: DevicePasscodeType = allowedTypes.includes(rawType as DevicePasscodeType)
            ? (rawType as DevicePasscodeType)
            : 'pin';
      const secret = String(raw.value ?? raw.passcode ?? '').trim();
      if (!secret) {
            return undefined;
      }
      return encryptDevicePasscode(type, secret);
};

const uploadEvidenceFiles = async (
      files: Express.Multer.File[] = [],
      photoType: 'booking' | 'completion' | 'note' = 'booking'
) => {
      const photos: any[] = [];
      for (const file of files) {
            const uploaded = await uploadToCloudinary(file.path);
            if (uploaded && uploaded.public_id && uploaded.secure_url) {
                  photos.push({
                        url: uploaded.secure_url,
                        public_id: uploaded.public_id,
                        uploadedAt: new Date(),
                        autoDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        usedFor:
                              photoType === 'completion'
                                    ? 'Completion verification photo'
                                    : photoType === 'note'
                                      ? 'Repair note photo'
                                      : 'Booking intake photo',
                        photoType,
                  });
            }
      }
      return photos;
};

const extractRepairPhotoGroups = (evidencePhotos: any[] = []) => {
      const bookingPhotos: string[] = [];
      const completionPhotos: string[] = [];
      for (const p of evidencePhotos || []) {
            const url = typeof p === 'string' ? p : p?.url;
            if (!url) continue;
            if (p?.photoType === 'completion' || /completion/i.test(String(p?.usedFor || ''))) {
                  completionPhotos.push(url);
            } else {
                  bookingPhotos.push(url);
            }
      }
      return { bookingPhotos, completionPhotos };
};

const addNewRepairRequest = async (payload: IRepairRequest, files: Express.Multer.File[] = [], userId: string) => {
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', StatusCodes.UNAUTHORIZED);

      if (!payload.firstName) throw new AppError('First name is required', StatusCodes.BAD_REQUEST);
      if (!payload.phoneNumber) throw new AppError('Phone number is required', StatusCodes.BAD_REQUEST);
      if (!payload.deviceModel) throw new AppError('Device model is required', StatusCodes.BAD_REQUEST);
      if (!payload.description && (!payload.issues || payload.issues.length === 0)) {
            throw new AppError('Description or repair issues are required', StatusCodes.BAD_REQUEST);
      }

      // Normalize problems and category across both payload naming conventions
      const normalizedIssues = normalizeRepairIssues(payload.issues);

      const desc =
            payload.description ||
            (normalizedIssues.length > 0
                  ? normalizedIssues.map((i: any) => `${i.category}: ${(i.problems || []).join(', ')}`).join('; ')
                  : 'Repair Request');

      const uploadedPhotos = await uploadEvidenceFiles(files, 'booking');
      const existingEvidence = Array.isArray(payload.evidencePhotos)
            ? payload.evidencePhotos.map((p: any) => ({
                    ...p,
                    photoType: p?.photoType || 'booking',
              }))
            : [];
      const evidencePhotos: any[] = [...existingEvidence, ...uploadedPhotos];

      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      const orderNumber = payload.orderNumber || `R-${randomSuffix}`;

      const historyEvents = payload.history && payload.history.length > 0 ? payload.history : [
            {
                  title: 'Request Booked',
                  description: `Booked by ${payload.firstName || 'Customer'}`,
                  actor: 'Shopkeeper',
                  createdAt: new Date(),
            },
            {
                  title: 'In Progress',
                  description: `Assigned to: ${payload.technician?.trim() || 'Unassigned'} - Ready to start`,
                  actor: 'Shopkeeper',
                  createdAt: new Date(),
            },
      ];

      if (normalizedIssues.length > 0) {
            for (const iss of normalizedIssues) {
                  const probList = Array.isArray(iss.problems) ? iss.problems : [];
                  historyEvents.push({
                        title: 'Issue Added',
                        description: `${iss.category}${probList.length > 0 ? ` - ${probList.join(', ')}` : ''}`,
                        actor: 'Shopkeeper',
                        createdAt: new Date(),
                  });
            }
      }

      if (evidencePhotos.length > 0) {
            historyEvents.push({
                  title: `Booking Photo Uploaded (${evidencePhotos.length})`,
                  description: 'Booking intake photos added',
                  actor: 'Shopkeeper',
                  createdAt: new Date(),
            });
      }

      const rawCustomerId = String((payload as any).customerId || '').trim();
      const customerId = rawCustomerId && Types.ObjectId.isValid(rawCustomerId)
            ? new Types.ObjectId(rawCustomerId)
            : null;
      const passcodeField = buildPasscodeField((payload as any).devicePasscode);

      // Keep IMEI and Serial Number strictly independent — never auto-copy one into the other.
      const cleanSerial = payload.serialNumber != null ? String(payload.serialNumber).trim() : '';
      const cleanImei = payload.IMEINumber != null ? String(payload.IMEINumber).trim() : '';

      const numericPrice = Number(payload.price);
      const safePrice = Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice : 0;

      const newRequest = await RepairRequest.create({
            orderNumber,
            userId: payload.userId || user._id,
            shopId: payload.shopId ?? null,
            customerId,
            firstName: payload.firstName,
            email: payload.email || '',
            phoneNumber: payload.phoneNumber,
            price: safePrice,
            currency: payload.currency ? String(payload.currency).trim().toUpperCase() : (user.currency || 'GBP'),
            deviceModel: payload.deviceModel,
            category: payload.category || 'Mobile Phone',
            brand: payload.brand || '',
            modelName: payload.modelName || payload.deviceModel,
            modelCode: payload.modelCode || '',
            releaseYear: payload.releaseYear || '',
            colour: payload.colour || '',
            condition: payload.condition || 'Good',
            serialType: payload.serialType
                  ? (payload.serialType.toLowerCase() as 'imei' | 'serial' | 'both')
                  : 'imei',
            serialNumber: cleanSerial,
            IMEINumber: cleanImei,
            ...(passcodeField ? { devicePasscode: passcodeField } : {}),
            description: desc,
            issues: normalizedIssues,
            evidencePhotos,
            history: historyEvents,
            technician: payload.technician?.trim(),
            status: payload.status || 'inProgress',
            expectedCollectionDate: payload.expectedCollectionDate
                  ? new Date(payload.expectedCollectionDate)
                  : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });

      return newRequest;
};

const getMyRepairRequestsHistory = async (userId: string, query: any) => {
      const { page, limit, skip } = getPagination(query);

      const readyForCollection = String(query.readyForCollection ?? '').toLowerCase() === 'true';
      const filter: FilterQuery<IRepairRequest> = readyForCollection
            ? { userId, status: { $in: ['completed', 'ready-for-collection', 'approved'] } }
            : { userId };

      const andConditions: FilterQuery<IRepairRequest>[] = [];
      if (query.shopId && Types.ObjectId.isValid(String(query.shopId))) {
            andConditions.push({ $or: [{ shopId: new Types.ObjectId(String(query.shopId)) }, { shopId: null }] });
      }
      if (query.search && String(query.search).trim()) {
            const rawQ = String(query.search).trim();
            const escaped = rawQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const digitsOnly = rawQ.replace(/[^a-zA-Z0-9-]/g, '');
            const searchOr: any[] = [
                  { orderNumber: { $regex: escaped, $options: 'i' } },
                  { deviceModel: { $regex: escaped, $options: 'i' } },
                  { firstName: { $regex: escaped, $options: 'i' } },
                  { phoneNumber: { $regex: escaped, $options: 'i' } },
                  { email: { $regex: escaped, $options: 'i' } },
                  { IMEINumber: { $regex: escaped, $options: 'i' } },
                  { serialNumber: { $regex: escaped, $options: 'i' } },
                  { modelCode: { $regex: escaped, $options: 'i' } },
            ];
            if (digitsOnly && !digitsOnly.startsWith('R-') && /^\d+$/.test(digitsOnly)) {
                  searchOr.push({ orderNumber: { $regex: `R-${digitsOnly}`, $options: 'i' } });
            }
            andConditions.push({ $or: searchOr });
      }
      if (andConditions.length > 0) {
            filter.$and = andConditions;
      }

      const data = await RepairRequest.find(filter).skip(skip).limit(limit).sort({ createdAt: -1, _id: -1 });
      const total = await RepairRequest.countDocuments(filter);

      return {
            data,
            meta: {
                  page,
                  limit,
                  total,
                  totalPage: Math.max(1, Math.ceil(total / limit)),
            },
      };
};

const getSingleRepairRequest = async (id: string) => {
      assertValidRepairRequestId(id);
      const result = await RepairRequest.findById(id);
      return result;
};

const generateAndSaveTechnicianFeedback = async (id: string) => {
      assertValidRepairRequestId(id);

      const repair = await RepairRequest.findById(id);

      if (!repair) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      const feedback = await generateTechnicianFeedback({
            customerName: repair.firstName,
            deviceModel: repair.deviceModel,
            issueReported: repair.description,
      });

      const result = await RepairRequest.findByIdAndUpdate(
            id,
            {
                  $set: {
                        technicianFeedback: feedback,
                  },
            },
            {
                  new: true,
                  runValidators: true,
            }
      );

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      return result;
};

const updateStatusByShopKeeper = async (
      id: string,
      payload: IRepairRequestStatusUpdatePayload,
      files: Express.Multer.File[] = []
) => {
      assertValidRepairRequestId(id);

      if (!payload.status) {
            throw new AppError('Status is required', StatusCodes.BAD_REQUEST);
      }

      const update: {
            $set: Record<string, unknown>;
            $unset?: Record<string, 1>;
            $push?: Record<string, unknown>;
      } = {
            $set: {
                  status: payload.status,
            },
      };

      if (payload.status === 'waiting-for-parts') {
            const waitingForPartsDays = Number(payload.waitingForPartsDays);
            const waitingForPartsDescription = payload.waitingForPartsDescription?.trim();

            if (!Number.isFinite(waitingForPartsDays) || waitingForPartsDays <= 0) {
                  throw new AppError('Waiting for parts days is required', StatusCodes.BAD_REQUEST);
            }

            if (!waitingForPartsDescription) {
                  throw new AppError('Waiting for parts description is required', StatusCodes.BAD_REQUEST);
            }

            update.$set.waitingForPartsDays = waitingForPartsDays;
            update.$set.waitingForPartsDescription = waitingForPartsDescription;
      } else {
            update.$unset = {
                  waitingForPartsDays: 1,
                  waitingForPartsDescription: 1,
            };
      }

      if (payload.expectedCollectionDate) {
            update.$set.expectedCollectionDate = new Date(payload.expectedCollectionDate);
      }

      if (Array.isArray(payload.issues)) {
            const normIssues = normalizeRepairIssues(payload.issues);
            update.$set.issues = normIssues;
            if (payload.price !== undefined) {
                  const p = Number(payload.price);
                  update.$set.price = Number.isFinite(p) && p >= 0 ? p : 0;
            }
            if (payload.description !== undefined) {
                  update.$set.description = payload.description;
            } else if (normIssues.length > 0) {
                  update.$set.description = normIssues
                        .map((i: any) => `${i.category}: ${(i.problems || []).join(', ')}`)
                        .join('; ');
            }
      } else if (payload.price !== undefined) {
            const p = Number(payload.price);
            if (Number.isFinite(p) && p >= 0) {
                  update.$set.price = p;
            }
      }

      if (payload.status === 'rejected') {
            const reason = (payload.rejectionReason || payload.unableToRepairReason || (payload as any).reason)?.trim();
            if (!reason) {
                  throw new AppError('Rejection reason is required when rejecting a repair job', StatusCodes.BAD_REQUEST);
            }
            update.$set.rejectionReason = reason;
            update.$set.rejectedAt = new Date();
      }

      if (payload.status === 'completed' || payload.status === 'ready-for-collection') {
            update.$set.completedAt = new Date();
      }

      if (payload.status === 'unable-to-repair') {
            if (payload.unableToRepairReason) {
                  update.$set.unableToRepairReason = payload.unableToRepairReason;
            }
            if (payload.unableToRepairNote) {
                  update.$set.unableToRepairNote = payload.unableToRepairNote;
            }
            if (payload.unableToRepairCustomerMessage) {
                  update.$set.unableToRepairCustomerMessage = payload.unableToRepairCustomerMessage;
            }
      }

      const historyPush: any[] = [
            {
                  title: getStatusDisplayLabel(payload.status),
                  description: `Status updated to ${getStatusDisplayLabel(payload.status)}`,
                  actor: 'Shopkeeper',
                  createdAt: new Date(),
            },
      ];

      let uploadedPhotos: any[] = [];
      if (files && files.length > 0) {
            const photoType =
                  payload.photoType ||
                  (payload.status === 'completed' ||
                  payload.status === 'ready-for-collection' ||
                  payload.status === 'collected'
                        ? 'completion'
                        : 'booking');
            uploadedPhotos = await uploadEvidenceFiles(files, photoType);
            if (uploadedPhotos.length > 0) {
                  historyPush.push({
                        title:
                              photoType === 'completion'
                                    ? `Completion Photo Uploaded (${uploadedPhotos.length})`
                                    : `Photo Uploaded (${uploadedPhotos.length})`,
                        description:
                              photoType === 'completion'
                                    ? 'Completion verification photos attached'
                                    : 'Photos attached',
                        actor: 'Technician',
                        createdAt: new Date(),
                  });
            }
      }

      update.$push = {
            history: { $each: historyPush },
            ...(uploadedPhotos.length > 0 ? { evidencePhotos: { $each: uploadedPhotos } } : {}),
      };

      const result = await RepairRequest.findByIdAndUpdate(id, update, {
            new: true,
            runValidators: true,
      });

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      // If status is completed or ready-for-collection, generate feedback AND send email
      if (payload.status === 'completed' || payload.status === 'ready-for-collection') {
            const updatedWithFeedback = await generateAndSaveTechnicianFeedback(id);

            if (updatedWithFeedback) {
                  await sendCompletionEmail(updatedWithFeedback);
            }

            return updatedWithFeedback;
      } else {
            // Send status update email with live tracking link and PDF report
            const customMessage =
                  result.status === 'unable-to-repair'
                        ? result.unableToRepairCustomerMessage || result.unableToRepairReason
                        : result.status === 'rejected'
                          ? result.rejectionReason
                          : undefined;
            await sendStatusUpdateEmail(result, customMessage);
      }

      return result;
};

const uploadRepairPhotos = async (
      id: string,
      files: Express.Multer.File[],
      photoType: 'booking' | 'completion' | 'note' = 'completion',
      actor = 'Technician'
) => {
      assertValidRepairRequestId(id);

      if (!files || files.length === 0) {
            throw new AppError('At least one image file is required', StatusCodes.BAD_REQUEST);
      }

      const uploaded = await uploadEvidenceFiles(files, photoType);
      if (uploaded.length === 0) {
            throw new AppError('Failed to upload repair photos', StatusCodes.INTERNAL_SERVER_ERROR);
      }

      const result = await RepairRequest.findByIdAndUpdate(
            id,
            {
                  $push: {
                        evidencePhotos: { $each: uploaded },
                        history: {
                              title:
                                    photoType === 'completion'
                                          ? `Completion Photo Uploaded (${uploaded.length})`
                                          : `Booking Photo Uploaded (${uploaded.length})`,
                              description:
                                    photoType === 'completion'
                                          ? 'Completion verification photos added'
                                          : 'Intake photos added',
                              actor,
                              createdAt: new Date(),
                        },
                  },
            },
            { new: true, runValidators: true }
      );

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      return result;
};

const revealDevicePasscode = async (
      id: string,
      authCtx: { userId?: string; staffSessionToken?: string; pin?: string }
) => {
      assertValidRepairRequestId(id);

      const repair = await RepairRequest.findById(id).select('+devicePasscode.encryptedValue');
      if (!repair) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      let effectiveRole = '';
      let effectiveJobRole = '';
      let effectiveName = '';
      let actingUserId = authCtx.userId;

      if (authCtx.staffSessionToken && authCtx.staffSessionToken !== 'invalid') {
            try {
                  const decoded: any = jwt.verify(authCtx.staffSessionToken, config.JWT_SECRET as string);
                  if (decoded?._id) {
                        actingUserId = String(decoded._id);
                  }
            } catch {
                  throw new AppError('Invalid or expired staff session', StatusCodes.UNAUTHORIZED);
            }
      }

      if (actingUserId && Types.ObjectId.isValid(actingUserId)) {
            const actorUser = await User.findById(actingUserId).select('role jobRole firstName lastName email');
            if (actorUser) {
                  effectiveRole = actorUser.role || '';
                  effectiveJobRole = (actorUser as any).jobRole || '';
                  effectiveName =
                        `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() ||
                        actorUser.email ||
                        effectiveRole;
            }
      }

      let isAuthorized = isAuthorizedTechnicianRole({
            role: effectiveRole,
            jobRole: effectiveJobRole,
            actorName: effectiveName,
            assignedTechnician: repair.technician,
      });

      // If switched to a non-technician or explicit PIN is supplied for override verification
      if (!isAuthorized && authCtx.pin && /^\d{4,6}$/.test(String(authCtx.pin).trim())) {
            const ownerId = repair.userId?.toString();
            if (ownerId && Types.ObjectId.isValid(ownerId)) {
                  const techCandidates = await User.find({
                        shopkeeperId: new Types.ObjectId(ownerId),
                        role: 'staff',
                  }).select('+staffPin firstName lastName email jobRole');

                  for (const cand of techCandidates) {
                        if (!cand.staffPin) continue;
                        const pinOk = await bcrypt.compare(String(authCtx.pin).trim(), cand.staffPin);
                        if (!pinOk) continue;
                        const candName = `${cand.firstName || ''} ${cand.lastName || ''}`.trim() || cand.email;
                        if (
                              isAuthorizedTechnicianRole({
                                    role: 'staff',
                                    jobRole: (cand as any).jobRole,
                                    actorName: candName,
                                    assignedTechnician: repair.technician,
                              })
                        ) {
                              isAuthorized = true;
                              effectiveName = candName;
                              break;
                        }
                  }
            }
      }

      if (!isAuthorized) {
            throw new AppError(
                  'Only authorised technicians or shop owners can reveal the device passcode',
                  StatusCodes.FORBIDDEN
            );
      }

      const pc = (repair as any).devicePasscode;
      if (!pc || !pc.isSet || pc.type === 'none' || !pc.encryptedValue) {
            return {
                  type: pc?.type || 'none',
                  isSet: false,
                  value: '',
                  maskedValue: '',
                  revealedBy: effectiveName,
                  revealedAt: new Date(),
            };
      }

      const value = decryptDevicePasscode(pc.encryptedValue);
      await RepairRequest.findByIdAndUpdate(id, {
            $push: {
                  history: {
                        title: 'Passcode Viewed',
                        description: `Device passcode revealed by ${effectiveName || 'Authorised Technician'}`,
                        actor: effectiveName || 'Authorised Technician',
                        createdAt: new Date(),
                  },
            },
      });

      return {
            type: pc.type,
            isSet: true,
            value,
            maskedValue: pc.maskedValue || '••••••',
            revealedBy: effectiveName || 'Authorised Technician',
            revealedAt: new Date(),
      };
};

const resolveShopInfo = async (repairRequest: IRepairRequest) => {
      try {
            if (repairRequest.shopId && Types.ObjectId.isValid(String(repairRequest.shopId))) {
                  const shop = await Shop.findById(repairRequest.shopId).select(
                        'shopName shopAddress whatsappNumber phone email currency'
                  );
                  if (shop && shop.shopName) {
                        return {
                              shopName: shop.shopName,
                              shopAddress: shop.shopAddress || '',
                              shopPhone: shop.whatsappNumber || (shop as any).phone || '',
                              currency: shop.currency || 'GBP',
                        };
                  }
            }

            if (repairRequest.userId && Types.ObjectId.isValid(String(repairRequest.userId))) {
                  const user = await User.findById(repairRequest.userId).select(
                        'shopName shopAddress whatsappNumber phone currency'
                  );
                  if (user && user.shopName) {
                        return {
                              shopName: user.shopName,
                              shopAddress: user.shopAddress || '',
                              shopPhone: user.whatsappNumber || user.phone || '',
                              currency: user.currency || 'GBP',
                        };
                  }
            }
      } catch (err) {
            console.error('Error resolving shop info:', err);
      }

      return {
            shopName: 'Imoscan Repair Service',
            shopAddress: '',
            shopPhone: '',
            currency: 'GBP',
      };
};

const getTrackingUrl = (repairId: string): string => {
      const frontendUrl = (config as { frontend_url?: string }).frontend_url || 'https://imoscan.com';
      return `${frontendUrl.replace(/\/$/, '')}/my-invoice/${repairId}`;
};

const getStatusDisplayLabel = (status: string): string => {
      const map: Record<string, string> = {
            inProgress: 'Order Booked / In Progress',
            'order-assigned': 'Technician Assigned',
            diagnosing: 'Diagnosing Started',
            quote_sent: 'Quote Sent',
            'start-work': 'Repair in Progress',
            repairing: 'Repair in Progress',
            'waiting-for-parts': 'Waiting for Parts',
            completed: 'Repair Completed',
            'ready-for-collection': 'Ready to Collect',
            reassigned: 'Technician Reassigned',
            approved: 'Quote Approved',
            rejected: 'Repair Rejected',
            collected: 'Device Collected',
            inReview: 'Under Review',
            'unable-to-repair': 'Unable to Repair',
      };
      return map[status] || status.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const sendStatusUpdateEmail = async (repairRequest: IRepairRequest, customNote?: string) => {
      try {
            if (!repairRequest.email) return;

            const shopInfo = await resolveShopInfo(repairRequest);
            const rawId = (repairRequest as any)._id?.toString() || '';
            const shortId = rawId ? rawId.slice(-6).toUpperCase() : '';
            const trackingUrl = getTrackingUrl(rawId);
            const statusLabel = getStatusDisplayLabel(repairRequest.status);

            const repairCurrency = (repairRequest as any).currency || shopInfo.currency || 'GBP';
            const currencySymbol = getCurrencySymbol(repairCurrency);
            const { bookingPhotos, completionPhotos } = extractRepairPhotoGroups(
                  (repairRequest as any).evidencePhotos
            );
            const formattedIssues = (repairRequest.issues || []).map((iss: any) => ({
                  category: iss.category || 'Repair Issue',
                  problems: iss.problems || [],
                  estimatedPrice: iss.estimatedPrice,
                  estimatedTime: iss.estimatedTime,
                  partName: iss.selectedPart?.partName,
            }));

            const pdfData = {
                  requestId: shortId || rawId,
                  orderNumber: repairRequest.orderNumber,
                  customerName: repairRequest.firstName,
                  customerEmail: repairRequest.email,
                  customerPhone: repairRequest.phoneNumber,
                  deviceModel: repairRequest.deviceModel,
                  imei: repairRequest.IMEINumber,
                  serialNumber: repairRequest.serialNumber,
                  condition: repairRequest.condition,
                  colour: repairRequest.colour,
                  description: repairRequest.description,
                  issues: formattedIssues,
                  bookingPhotos,
                  completionPhotos,
                  status: repairRequest.status,
                  statusLabel,
                  statusNote: customNote,
                  price: repairRequest.price,
                  currency: repairCurrency,
                  currencySymbol,
                  shopName: shopInfo.shopName,
                  shopPhone: shopInfo.shopPhone,
                  shopAddress: shopInfo.shopAddress,
                  technicianFeedback: repairRequest.technicianFeedback,
                  waitingForPartsDays: repairRequest.waitingForPartsDays,
                  waitingForPartsDescription: repairRequest.waitingForPartsDescription,
                  technicianNotes: repairRequest.technicianNotes,
                  trackingUrl,
                  createdAt: repairRequest.createdAt,
                  updatedAt: repairRequest.updatedAt,
            };

            const pdfBuffer = generateRepairStatusPdfBuffer(pdfData);

            const emailData = {
                  customerName: repairRequest.firstName,
                  deviceModel: repairRequest.deviceModel,
                  imei: repairRequest.IMEINumber,
                  serialNumber: repairRequest.serialNumber,
                  condition: repairRequest.condition,
                  colour: repairRequest.colour,
                  description: repairRequest.description,
                  issues: formattedIssues,
                  bookingPhotos,
                  completionPhotos,
                  status: repairRequest.status,
                  statusLabel,
                  statusNote: customNote,
                  price: repairRequest.price,
                  currency: repairCurrency,
                  currencySymbol,
                  shopName: shopInfo.shopName,
                  requestId: shortId || rawId,
                  orderNumber: repairRequest.orderNumber,
                  trackingUrl,
                  technicianFeedback: repairRequest.technicianFeedback,
                  waitingForPartsDays: repairRequest.waitingForPartsDays,
                  waitingForPartsDescription: repairRequest.waitingForPartsDescription,
            };

            const result = await sendRepairStatusEmail(repairRequest.email, emailData, pdfBuffer);

            if (!result.success) {
                  console.error('Failed to send repair status email:', result.error);
            } else {
                  console.log('Repair status email sent successfully to:', repairRequest.email);
            }

            return result;
      } catch (error) {
            console.error('Error in sendStatusUpdateEmail:', error);
      }
};

// Helper function to send completion email
const sendCompletionEmail = async (repairRequest: IRepairRequest) => {
      try {
            if (!repairRequest.email) return;

            const shopInfo = await resolveShopInfo(repairRequest);
            const rawId = (repairRequest as any)._id?.toString() || '';
            const shortId = rawId ? rawId.slice(-6).toUpperCase() : '';
            const trackingUrl = getTrackingUrl(rawId);
            const statusLabel = getStatusDisplayLabel(repairRequest.status || 'completed');

            const repairCurrency = (repairRequest as any).currency || shopInfo.currency || 'GBP';
            const currencySymbol = getCurrencySymbol(repairCurrency);
            const { bookingPhotos, completionPhotos } = extractRepairPhotoGroups(
                  (repairRequest as any).evidencePhotos
            );
            const formattedIssues = (repairRequest.issues || []).map((iss: any) => ({
                  category: iss.category || 'Repair Issue',
                  problems: iss.problems || [],
                  estimatedPrice: iss.estimatedPrice,
                  estimatedTime: iss.estimatedTime,
                  partName: iss.selectedPart?.partName,
            }));

            const pdfData = {
                  requestId: shortId || rawId,
                  orderNumber: repairRequest.orderNumber,
                  customerName: repairRequest.firstName,
                  customerEmail: repairRequest.email,
                  customerPhone: repairRequest.phoneNumber,
                  deviceModel: repairRequest.deviceModel,
                  imei: repairRequest.IMEINumber,
                  serialNumber: repairRequest.serialNumber,
                  condition: repairRequest.condition,
                  colour: repairRequest.colour,
                  description: repairRequest.description,
                  issues: formattedIssues,
                  bookingPhotos,
                  completionPhotos,
                  status: repairRequest.status || 'completed',
                  statusLabel,
                  price: repairRequest.price,
                  currency: repairCurrency,
                  currencySymbol,
                  shopName: shopInfo.shopName,
                  shopPhone: shopInfo.shopPhone,
                  shopAddress: shopInfo.shopAddress,
                  technicianFeedback: repairRequest.technicianFeedback,
                  trackingUrl,
                  createdAt: repairRequest.createdAt,
                  updatedAt: new Date(),
            };

            const pdfBuffer = generateRepairStatusPdfBuffer(pdfData);

            const emailData = {
                  customerName: repairRequest.firstName,
                  deviceModel: repairRequest.deviceModel,
                  imei: repairRequest.IMEINumber,
                  serialNumber: repairRequest.serialNumber,
                  condition: repairRequest.condition,
                  colour: repairRequest.colour,
                  description: repairRequest.description,
                  issues: formattedIssues,
                  bookingPhotos,
                  completionPhotos,
                  price: repairRequest.price,
                  currency: repairCurrency,
                  currencySymbol,
                  technicianFeedback: repairRequest.technicianFeedback,
                  completionDate: new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                  }),
                  requestId: shortId || rawId,
                  orderNumber: repairRequest.orderNumber,
                  shopName: shopInfo.shopName,
                  trackingUrl,
            };

            const result = await sendRepairCompletionEmail(repairRequest.email, emailData, pdfBuffer);

            if (!result.success) {
                  console.error('Failed to send completion email:', result.error);
            } else {
                  console.log('Completion email sent successfully to:', repairRequest.email);
            }

            return result;
      } catch (error) {
            console.error('Error in sendCompletionEmail:', error);
      }
};

const addNoteByShopKeeper = async (id: string, payload: any, files: Express.Multer.File[] = []) => {
      assertValidRepairRequestId(id);

      const { message, cost, estimatedDays, assignedPerson } = payload;

      // Upload images to Cloudinary if provided
      const images: { public_id: string; url: string }[] = [];
      for (const file of files) {
            const uploaded = await uploadToCloudinary(file.path);
            if (uploaded && uploaded.public_id && uploaded.secure_url) {
                  images.push({ public_id: uploaded.public_id, url: uploaded.secure_url });
            }
      }

      const newNote = {
            message,
            cost,
            estimatedDays,
            date: new Date(),
            images,
            assignedPerson,
      };

      const result = await RepairRequest.findByIdAndUpdate(
            id,
            {
                  $push: {
                        shopkeeperNotes: newNote,
                  },
                  $set: {
                        status: 'quote_sent',
                  },
            },
            { new: true }
      );

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      // Send status update email notifying customer of quote/note
      await sendStatusUpdateEmail(result, message ? `New note/quote: ${message}` : undefined);

      return result;
};

const addTeachNoteByTechnician = async (id: string, payload: any) => {
      assertValidRepairRequestId(id);

      // ✅ Normalize (single or array)
      const incomingNotes = Array.isArray(payload) ? payload : [payload];

      if (incomingNotes.length === 0) {
            throw new Error('Payload must not be empty');
      }

      // ✅ Validate
      incomingNotes.forEach((item) => {
            if (!item.partName || item.cost == null || item.time == null) {
                  throw new Error('Each technician note must have partName, cost, and time');
            }
      });

      // ✅ Get existing document
      const repair = await RepairRequest.findById(id);

      if (!repair) {
            throw new Error('Repair request not found');
      }

      let existingNotes: any[] = repair.technicianNotes || [];

      // ✅ Convert existing to map (by partName)
      const noteMap = new Map();

      existingNotes.forEach((note) => {
            noteMap.set(note.partName, note);
      });

      // ✅ Merge logic (update OR insert)
      incomingNotes.forEach((newNote) => {
            if (noteMap.has(newNote.partName)) {
                  // 🔄 UPDATE existing
                  const old = noteMap.get(newNote.partName);

                  noteMap.set(newNote.partName, {
                        ...(old.toObject?.() || old),
                        ...newNote, // overwrite changed fields
                  });
            } else {
                  // ➕ ADD new
                  noteMap.set(newNote.partName, newNote);
            }
      });

      // ✅ Convert back to array
      const finalNotes = Array.from(noteMap.values());

      // ✅ Save updated array
      const result = await RepairRequest.findByIdAndUpdate(
            id,
            {
                  $set: {
                        technicianNotes: finalNotes,
                        status: 'waiting-for-parts',
                  },
            },
            {
                  new: true,
                  runValidators: true,
            }
      );

      if (result) {
            const partsSummary = finalNotes.map((n: any) => n.partName).filter(Boolean).join(', ');
            await sendStatusUpdateEmail(result, partsSummary ? `Parts ordered/required: ${partsSummary}` : undefined);
      }

      return result;
};

const generateTechnicianFeedbackByRequest = async (id: string) => {
      return generateAndSaveTechnicianFeedback(id);
};

const getUserDescriptions = async (userId: string) => {
      if (!Types.ObjectId.isValid(userId)) {
            throw new AppError('Valid user id is required', StatusCodes.BAD_REQUEST);
      }

      const repairRequests = await RepairRequest.find(
            { userId },
            {
                  description: 1,
                  deviceModel: 1,
                  status: 1,
                  createdAt: 1,
            }
      ).sort({ createdAt: -1 });

      return repairRequests;
};

const getTechnicians = async (userId: string) => {
      const technicians = await RepairRequest.distinct('technician', {
            userId,
            technician: { $exists: true, $ne: '' },
      });

      return technicians.sort((first, second) => first.localeCompare(second));
};

// Add this method to the repairRequestService object
const getCompletedRepairRequests = async (userId: string, query: any) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter: FilterQuery<IRepairRequest> = {
            userId,
            status: { $in: ['completed', 'ready-for-collection'] },
      };

      const data = await RepairRequest.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });
      const total = await RepairRequest.countDocuments(filter);

      return {
            data,
            meta: {
                  page,
                  limit,
                  total,
                  totalPage: Math.ceil(total / limit),
            },
      };
};

const getCustomerRepairHistory = async (
      shopkeeperId: string,
      query: { phone?: string; email?: string; customerId?: string }
) => {
      const { phone, email, customerId } = query;
      const orConditions: any[] = [];
      if (customerId && Types.ObjectId.isValid(customerId.trim())) {
            orConditions.push({ customerId: new Types.ObjectId(customerId.trim()) });
      }
      if (phone && phone.trim()) {
            orConditions.push({ phoneNumber: phone.trim() });
      }
      if (email && email.trim()) {
            orConditions.push({ email: { $regex: new RegExp(`^${email.trim()}$`, 'i') } });
      }

      if (orConditions.length === 0) {
            return {
                  repairs: [],
                  devices: [],
                  issues: [],
                  totalRepairs: 0,
                  recognizedDevicesCount: 0,
                  mostRecentRepair: null,
            };
      }

      const filter: FilterQuery<IRepairRequest> = {
            userId: new Types.ObjectId(shopkeeperId),
            $or: orConditions,
      };

      const repairs = await RepairRequest.find(filter).sort({ createdAt: -1 });

      const devices = Array.from(new Set(repairs.map((r) => r.deviceModel?.trim()).filter(Boolean)));
      const issues = Array.from(new Set(repairs.map((r) => r.description?.trim()).filter(Boolean)));

      return {
            repairs,
            devices,
            issues,
            totalRepairs: repairs.length,
            recognizedDevicesCount: devices.length,
            mostRecentRepair: repairs[0] || null,
      };
};

const updateRepairRequestDetails = async (id: string, payload: any) => {
      assertValidRepairRequestId(id);

      const updateData: Record<string, any> = {};

      if (payload.firstName !== undefined) updateData.firstName = payload.firstName;
      if (payload.customerName !== undefined && !payload.firstName) updateData.firstName = payload.customerName;
      if (payload.customerId !== undefined) {
            const cid = String(payload.customerId || '').trim();
            updateData.customerId = cid && Types.ObjectId.isValid(cid) ? new Types.ObjectId(cid) : null;
      }
      if (payload.email !== undefined) updateData.email = payload.email;
      if (payload.phoneNumber !== undefined) updateData.phoneNumber = payload.phoneNumber;
      if (payload.phone !== undefined && !payload.phoneNumber) updateData.phoneNumber = payload.phone;
      if (payload.deviceModel !== undefined) updateData.deviceModel = payload.deviceModel;
      if (payload.modelName !== undefined) updateData.modelName = payload.modelName;
      if (payload.serialType !== undefined) updateData.serialType = String(payload.serialType).toLowerCase();
      if (payload.serialNumber !== undefined) updateData.serialNumber = String(payload.serialNumber || '').trim();
      if (payload.IMEINumber !== undefined) updateData.IMEINumber = String(payload.IMEINumber || '').trim();
      if (payload.colour !== undefined) updateData.colour = payload.colour;
      if (payload.brand !== undefined) updateData.brand = payload.brand;
      if (payload.modelCode !== undefined) updateData.modelCode = payload.modelCode;
      if (payload.releaseYear !== undefined) updateData.releaseYear = payload.releaseYear;
      if (payload.condition !== undefined) updateData.condition = payload.condition;
      if (payload.expectedCollectionDate !== undefined && payload.expectedCollectionDate) {
            updateData.expectedCollectionDate = new Date(payload.expectedCollectionDate);
      }
      if (Array.isArray(payload.issues)) {
            const normalizedIssues = normalizeRepairIssues(payload.issues);
            updateData.issues = normalizedIssues;
            if (payload.description === undefined && normalizedIssues.length > 0) {
                  updateData.description = normalizedIssues
                        .map((i: any) => `${i.category}: ${(i.problems || []).join(', ')}`)
                        .join('; ');
            }
      }
      if (payload.price !== undefined) {
            const parsedPrice = Number(payload.price);
            updateData.price = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
      }
      if (payload.currency !== undefined) updateData.currency = String(payload.currency).trim().toUpperCase();
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.technician !== undefined) updateData.technician = payload.technician;
      if (payload.technicianName !== undefined) updateData.technician = payload.technicianName;

      const passcodeField = buildPasscodeField(payload.devicePasscode);
      if (passcodeField) {
            updateData.devicePasscode = passcodeField;
      }

      const updateOp: Record<string, any> = { $set: updateData };
      if (Array.isArray(payload.issues)) {
            updateOp.$push = {
                  history: {
                        title: 'Faults & Estimate Updated',
                        description: 'Confirmed faults, pricing or parts updated',
                        actor: payload.updatedBy || 'Technician',
                        createdAt: new Date(),
                  },
            };
      }

      const result = await RepairRequest.findByIdAndUpdate(
            id,
            updateOp,
            { new: true, runValidators: true }
      );

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      return result;
};

const repairRequestService = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getSingleRepairRequest,
      updateStatusByShopKeeper,
      uploadRepairPhotos,
      revealDevicePasscode,
      updateRepairRequestDetails,
      addNoteByShopKeeper,
      addTeachNoteByTechnician,
      generateTechnicianFeedbackByRequest,
      getUserDescriptions,
      getTechnicians,
      getCompletedRepairRequests,
      getCustomerRepairHistory,
      sendCompletionEmail,
};

export default repairRequestService;
