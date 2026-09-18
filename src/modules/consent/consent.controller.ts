import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { consentService } from './consent.service';
import { getShopFromRequest } from '../shop/shop.utils';

// POST /consent/request (authenticated: shopkeeper or staff)
const requestConsent = catchAsync(async (req, res) => {
      const userId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      let shopId: any = null;
      try {
            shopId = await getShopFromRequest(req);
      } catch (err) {
            shopId = null;
      }
      if (shopId) {
            req.body.shopId = shopId.toString();
      }

      const result = await consentService.createConsent(userId.toString(), req.body);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Consent request created successfully',
            data: result,
      });
});

// GET /consent/public/:token (public endpoint for customer browser)
const getPublicConsent = catchAsync(async (req, res) => {
      const token = req.params.token as string;
      const result = await consentService.getConsentByToken(token);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Consent details retrieved',
            data: result,
      });
});

// GET /consent/:id (authenticated: check consent status by ID or reference)
const getConsentById = catchAsync(async (req, res) => {
      const id = req.params.id as string;
      const userId = req.user?._id?.toString();
      const result = await consentService.getConsentById(id, userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Consent details retrieved',
            data: result,
      });
});

// POST /consent/verify/:identifier (public or authenticated)
const verifyConsentCode = catchAsync(async (req, res) => {
      const identifier = req.params.identifier as string;
      const result = await consentService.verifyConsentCode(identifier, req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: result.message,
            data: result,
      });
});

// POST /consent/approve/:identifier (public or authenticated)
const approveConsent = catchAsync(async (req, res) => {
      const identifier = req.params.identifier as string;
      const result = await consentService.approveConsent(identifier, req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: result.message,
            data: result,
      });
});

// POST /consent/decline/:identifier
const declineConsent = catchAsync(async (req, res) => {
      const identifier = req.params.identifier as string;
      const result = await consentService.declineConsent(identifier);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: result.message,
            data: result,
      });
});

// POST /consent/resend/:identifier (authenticated)
const resendCode = catchAsync(async (req, res) => {
      const identifier = req.params.identifier as string;
      const result = await consentService.resendConsentCode(identifier, req.user?._id?.toString());

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'New verification code sent',
            data: result,
      });
});

// GET /consent/my-requests (authenticated)
const listMyConsents = catchAsync(async (req, res) => {
      const userId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const result = await consentService.listConsentsByShopkeeper(userId.toString());

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Consent requests fetched',
            data: result,
      });
});

export const consentController = {
      requestConsent,
      getPublicConsent,
      getConsentById,
      verifyConsentCode,
      approveConsent,
      declineConsent,
      resendCode,
      listMyConsents,
};
