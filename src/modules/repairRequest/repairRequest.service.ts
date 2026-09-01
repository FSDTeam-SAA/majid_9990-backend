import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { uploadToCloudinary } from '../../utils/cloudinary';
import config from '../../config/config';
import { generateTechnicianFeedback } from '../../utils/technicianFeedback';
import { sendRepairCompletionEmail, sendRepairStatusEmail } from '../../utils/email/email.service';
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

const addNewRepairRequest = async (payload: IRepairRequest, files: Express.Multer.File[] = [], userId: string) => {
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', StatusCodes.UNAUTHORIZED);

      if (!payload.firstName) throw new AppError('First name is required', StatusCodes.BAD_REQUEST);
      if (!payload.email) throw new AppError('Email is required', StatusCodes.BAD_REQUEST);
      if (!payload.phoneNumber) throw new AppError('Phone number is required', StatusCodes.BAD_REQUEST); // ✅ ADDED
      if (!payload.deviceModel) throw new AppError('Device model is required', StatusCodes.BAD_REQUEST);
      if (!payload.description) throw new AppError('Description is required', StatusCodes.BAD_REQUEST);

      const images: { public_id: string; url: string }[] = [];
      for (const file of files) {
            const uploaded = await uploadToCloudinary(file.path);
            if (uploaded && uploaded.public_id && uploaded.secure_url) {
                  images.push({ public_id: uploaded.public_id, url: uploaded.secure_url });
            }
      }

      const newRequest = await RepairRequest.create({
            userId: payload.userId || user._id,
            shopId: payload.shopId ?? null,
            firstName: payload.firstName,
            email: payload.email,
            phoneNumber: payload.phoneNumber, // ✅ ADDED
            price: payload.price || 0, // ✅ ADDED
            deviceModel: payload.deviceModel,
            IMEINumber: payload.IMEINumber,
            description: payload.description,
            technician: payload.technician?.trim(),
            images,
            status: payload.status || 'inProgress',
      });

      return newRequest;
};

const getMyRepairRequestsHistory = async (userId: string, query: any) => {
      const { page, limit, skip } = getPagination(query);

      const readyForCollection = String(query.readyForCollection ?? '').toLowerCase() === 'true';
      const filter: FilterQuery<IRepairRequest> = readyForCollection
            ? { userId, status: { $in: ['completed', 'approved'] } }
            : { userId };
      if (query.shopId && Types.ObjectId.isValid(String(query.shopId))) {
            filter.$or = [{ shopId: new Types.ObjectId(String(query.shopId)) }, { shopId: null }];
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

const updateStatusByShopKeeper = async (id: string, payload: IRepairRequestStatusUpdatePayload) => {
      assertValidRepairRequestId(id);

      if (!payload.status) {
            throw new AppError('Status is required', StatusCodes.BAD_REQUEST);
      }

      const update: {
            $set: Record<string, unknown>;
            $unset?: Record<string, 1>;
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

      const result = await RepairRequest.findByIdAndUpdate(id, update, {
            new: true,
            runValidators: true,
      });

      if (!result) {
            throw new AppError('Repair request not found', StatusCodes.NOT_FOUND);
      }

      // ✅ If status is completed, generate feedback AND send email
      if (payload.status === 'completed') {
            // Generate technician feedback first
            const updatedWithFeedback = await generateAndSaveTechnicianFeedback(id);

            if (updatedWithFeedback) {
                  // Send email notification
                  await sendCompletionEmail(updatedWithFeedback);
            }

            return updatedWithFeedback;
      } else {
            // Send status update email with live tracking link and PDF report
            await sendStatusUpdateEmail(result);
      }

      return result;
};

const resolveShopInfo = async (repairRequest: IRepairRequest) => {
      try {
            if (repairRequest.shopId && Types.ObjectId.isValid(String(repairRequest.shopId))) {
                  const shop = await Shop.findById(repairRequest.shopId).select(
                        'shopName shopAddress whatsappNumber phone email'
                  );
                  if (shop && shop.shopName) {
                        return {
                              shopName: shop.shopName,
                              shopAddress: shop.shopAddress || '',
                              shopPhone: shop.whatsappNumber || (shop as any).phone || '',
                        };
                  }
            }

            if (repairRequest.userId && Types.ObjectId.isValid(String(repairRequest.userId))) {
                  const user = await User.findById(repairRequest.userId).select(
                        'shopName shopAddress whatsappNumber phone'
                  );
                  if (user && user.shopName) {
                        return {
                              shopName: user.shopName,
                              shopAddress: user.shopAddress || '',
                              shopPhone: user.whatsappNumber || user.phone || '',
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
            approved: 'Quote Approved',
            rejected: 'Repair Rejected',
            collected: 'Device Collected',
            inReview: 'Under Review',
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

            const pdfData = {
                  requestId: shortId || rawId,
                  customerName: repairRequest.firstName,
                  customerEmail: repairRequest.email,
                  customerPhone: repairRequest.phoneNumber,
                  deviceModel: repairRequest.deviceModel,
                  imei: repairRequest.IMEINumber,
                  description: repairRequest.description,
                  status: repairRequest.status,
                  statusLabel,
                  statusNote: customNote,
                  price: repairRequest.price,
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
                  description: repairRequest.description,
                  status: repairRequest.status,
                  statusLabel,
                  statusNote: customNote,
                  price: repairRequest.price,
                  shopName: shopInfo.shopName,
                  requestId: shortId || rawId,
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

// ✅ Helper function to send completion email
const sendCompletionEmail = async (repairRequest: IRepairRequest) => {
      try {
            if (!repairRequest.email) return;

            const shopInfo = await resolveShopInfo(repairRequest);
            const rawId = (repairRequest as any)._id?.toString() || '';
            const shortId = rawId ? rawId.slice(-6).toUpperCase() : '';
            const trackingUrl = getTrackingUrl(rawId);
            const statusLabel = getStatusDisplayLabel('completed');

            const pdfData = {
                  requestId: shortId || rawId,
                  customerName: repairRequest.firstName,
                  customerEmail: repairRequest.email,
                  customerPhone: repairRequest.phoneNumber,
                  deviceModel: repairRequest.deviceModel,
                  imei: repairRequest.IMEINumber,
                  description: repairRequest.description,
                  status: 'completed',
                  statusLabel,
                  price: repairRequest.price,
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
                  description: repairRequest.description,
                  price: repairRequest.price,
                  technicianFeedback: repairRequest.technicianFeedback,
                  completionDate: new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                  }),
                  requestId: shortId || rawId,
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
            status: 'completed',
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

const repairRequestService = {
      addNewRepairRequest,
      getMyRepairRequestsHistory,
      getSingleRepairRequest,
      updateStatusByShopKeeper,
      addNoteByShopKeeper,
      addTeachNoteByTechnician,
      generateTechnicianFeedbackByRequest,
      getUserDescriptions,
      getTechnicians,
      getCompletedRepairRequests,
      sendCompletionEmail,
};

export default repairRequestService;
