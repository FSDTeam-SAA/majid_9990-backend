import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import securityService from './security.service';

const getSettings = catchAsync(async (req, res) => {
      const result = await securityService.getSettings(req.user._id);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Security settings retrieved successfully',
            data: result,
      });
});

const toggleTwoFactor = catchAsync(async (req, res) => {
      const { enabled } = req.body;
      const result = await securityService.toggleTwoFactor(req.user._id, Boolean(enabled));

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: enabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled',
            data: result,
      });
});

const setMethod = catchAsync(async (req, res) => {
      const { method } = req.body;
      const result = await securityService.setMethod(req.user._id, method);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Two-factor verification method updated',
            data: result,
      });
});

const startAuthenticatorSetup = catchAsync(async (req, res) => {
      const result = await securityService.startAuthenticatorSetup(req.user._id);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Authenticator setup started',
            data: result,
      });
});

const confirmAuthenticatorSetup = catchAsync(async (req, res) => {
      const result = await securityService.confirmAuthenticatorSetup(req.user._id, req.body);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: result.message,
            data: result,
      });
});

const removeAuthenticator = catchAsync(async (req, res) => {
      const result = await securityService.removeAuthenticator(req.user._id);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Authenticator removed successfully',
            data: result,
      });
});

const sendChallenge = catchAsync(async (req, res) => {
      const { method } = req.body;
      const result = await securityService.sendChallenge(req.user._id, method);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: `Verification code sent to ${result.destination}`,
            data: result,
      });
});

const verifyChallenge = catchAsync(async (req, res) => {
      const { code } = req.body;
      const isValid = await securityService.verifyChallenge(req.user._id, code);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: isValid ? 'Code verified successfully' : 'Invalid or expired code',
            data: { valid: isValid },
      });
});

const confirmDestination = catchAsync(async (req, res) => {
      const { method, code } = req.body;
      const result = await securityService.confirmDestination(req.user._id, method, code);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: `${method === 'sms' ? 'Phone number' : 'Email'} verified for two-factor authentication`,
            data: result,
      });
});

const listDevices = catchAsync(async (req, res) => {
      const currentDeviceId = (req.headers['x-device-id'] as string) || req.query.deviceId?.toString();
      const result = await securityService.listDevices(req.user._id, currentDeviceId);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Login devices retrieved successfully',
            data: result,
      });
});

const registerDevice = catchAsync(async (req, res) => {
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
      const result = await securityService.registerOrUpdateDevice(req.user._id, {
            ...req.body,
            ipAddress,
      });

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Device registered successfully',
            data: result,
      });
});

const removeDevice = catchAsync(async (req, res) => {
      const deviceId = Array.isArray(req.params.deviceId) ? req.params.deviceId[0] : String(req.params.deviceId);
      const result = await securityService.removeDevice(req.user._id, deviceId);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: result ? 'Device removed successfully' : 'Device not found',
            data: { removed: result },
      });
});

const verifyCode = catchAsync(async (req, res) => {
      const { code } = req.body;
      const isValid = await securityService.verifyChallenge(req.user._id, code);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: isValid ? 'Code verified' : 'Invalid or expired verification code',
            data: { valid: isValid },
      });
});

const securityController = {
      getSettings,
      toggleTwoFactor,
      setMethod,
      startAuthenticatorSetup,
      confirmAuthenticatorSetup,
      removeAuthenticator,
      sendChallenge,
      verifyChallenge,
      confirmDestination,
      listDevices,
      registerDevice,
      removeDevice,
      verifyCode,
};

export default securityController;
