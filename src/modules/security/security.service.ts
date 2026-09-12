import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import sendEmail from '../../utils/sendEmail';
import { companyName } from '../../lib/globalType';
import { DeviceSession } from './security.model';
import { TwoFactorMethodType, ITwoFactorSettingsResponse } from './security.interface';
import { TotpUtil, OneTimeCodeUtil } from './security.utils';

const maskEmail = (email: string): string => {
      if (!email || !email.includes('@')) return email;
      const [name, domain] = email.split('@');
      if (name.length <= 2) return `${name[0]}***@${domain}`;
      return `${name[0]}***${name[name.length - 1]}@${domain}`;
};

const maskPhone = (phone: string): string => {
      if (!phone || phone.length < 4) return phone;
      return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
};

const getSettings = async (userId: string): Promise<ITwoFactorSettingsResponse> => {
      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      return {
            enabled: Boolean(user.twoFactorEnabled),
            method: (user.twoFactorMethod as TwoFactorMethodType) || 'email',
            emailVerified: Boolean(user.twoFactorEmailVerified ?? user.isVerified),
            phoneVerified: Boolean(user.twoFactorPhoneVerified),
            hasAuthenticator: Boolean(user.twoFactorSecret && user.twoFactorSecret.length > 0),
      };
};

const toggleTwoFactor = async (userId: string, enabled: boolean): Promise<{ enabled: boolean }> => {
      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      if (enabled) {
            const hasConfirmed =
                  user.twoFactorEmailVerified ||
                  user.isVerified ||
                  user.twoFactorPhoneVerified ||
                  Boolean(user.twoFactorSecret && user.twoFactorSecret.length > 0);

            if (!hasConfirmed) {
                  throw new AppError(
                        'Please confirm your email, phone number, or authenticator app before enabling two-factor authentication.',
                        StatusCodes.BAD_REQUEST
                  );
            }
      }

      user.twoFactorEnabled = enabled;
      await user.save();

      return { enabled: user.twoFactorEnabled };
};

const setMethod = async (userId: string, method: TwoFactorMethodType): Promise<{ method: TwoFactorMethodType }> => {
      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      if (method === 'authenticator' && (!user.twoFactorSecret || user.twoFactorSecret.length === 0)) {
            throw new AppError('Authenticator app is not set up on your account yet.', StatusCodes.BAD_REQUEST);
      }

      if (method === 'sms' && (!user.phone || !user.twoFactorPhoneVerified)) {
            throw new AppError('Please verify your phone number before selecting SMS verification.', StatusCodes.BAD_REQUEST);
      }

      user.twoFactorMethod = method;
      await user.save();

      return { method: user.twoFactorMethod as TwoFactorMethodType };
};

const startAuthenticatorSetup = async (userId: string): Promise<{ secret: string; otpauthUri: string }> => {
      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      const secret = TotpUtil.generateSecret();
      const otpauthUri = TotpUtil.provisioningUri({
            secret,
            account: user.email,
            issuer: companyName || 'imoscan',
      });

      return { secret, otpauthUri };
};

const confirmAuthenticatorSetup = async (
      userId: string,
      payload: { secret: string; code: string }
): Promise<{ success: boolean; message: string }> => {
      const { secret, code } = payload;
      if (!secret || !code) {
            throw new AppError('Secret and code are required', StatusCodes.BAD_REQUEST);
      }

      const isValid = TotpUtil.verify(secret, code);
      if (!isValid) {
            throw new AppError('That code was not correct or has expired. Try again.', StatusCodes.BAD_REQUEST);
      }

      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      user.twoFactorSecret = secret;
      user.twoFactorEnabled = true;
      user.twoFactorMethod = 'authenticator';
      await user.save();

      return {
            success: true,
            message: 'Authenticator app enabled successfully',
      };
};

const removeAuthenticator = async (userId: string): Promise<{ success: boolean; method: string }> => {
      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      user.twoFactorSecret = null;
      user.twoFactorMethod = (user.twoFactorEmailVerified || user.isVerified) ? 'email' : 'sms';
      await user.save();

      return {
            success: true,
            method: user.twoFactorMethod,
      };
};

const sendChallenge = async (
      userIdOrEmail: any,
      method?: TwoFactorMethodType
): Promise<{ sent: boolean; destination: string }> => {
      const isEmail = typeof userIdOrEmail === 'string' && userIdOrEmail.includes('@');
      const query = isEmail ? { email: userIdOrEmail } : { _id: userIdOrEmail };
      const user = await User.findOne(query);
      if (!user) {
            throw new AppError('Account not found', StatusCodes.NOT_FOUND);
      }

      const selectedMethod = method || (user.twoFactorMethod as TwoFactorMethodType) || 'email';
      const destination = selectedMethod === 'sms' ? user.phone : user.email;

      if (!destination) {
            throw new AppError(`No registered destination found for ${selectedMethod}`, StatusCodes.BAD_REQUEST);
      }

      const code = OneTimeCodeUtil.generateCode();
      const salt = OneTimeCodeUtil.newSalt();
      const codeHash = OneTimeCodeUtil.hash(code, salt);

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      user.twoFactorChallenge = {
            codeHash,
            salt,
            method: selectedMethod,
            destination,
            expiresAt,
            attempts: 0,
      };

      await user.save();

      if (selectedMethod === 'email') {
            const html = `
                  <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px;">
                        <h2 style="color: #0f172a; margin-top: 0;">Security Verification Code</h2>
                        <p style="color: #475569; font-size: 15px; line-height: 1.5;">
                              Your 6-digit verification code is:
                        </p>
                        <div style="text-align: center; margin: 28px 0;">
                              <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 12px 24px; background: #e2e8f0; border-radius: 8px; color: #1e293b; display: inline-block;">
                                    ${code}
                              </span>
                        </div>
                        <p style="color: #64748b; font-size: 13px;">
                              This code is valid for 15 minutes. If you did not request this, please change your password immediately.
                        </p>
                  </div>
            `;

            await sendEmail({
                  to: user.email,
                  subject: `${companyName || 'imoscan'} - Verification Code: ${code}`,
                  html,
            });
      } else {
            console.log(`[SMS 2FA] Code for ${destination}: ${code}`);
      }

      const masked = selectedMethod === 'sms' ? maskPhone(destination) : maskEmail(destination);
      return {
            sent: true,
            destination: masked,
      };
};

const verifyChallenge = async (userIdOrEmail: any, code: string): Promise<boolean> => {
      const isEmail = typeof userIdOrEmail === 'string' && userIdOrEmail.includes('@');
      const query = isEmail ? { email: userIdOrEmail } : { _id: userIdOrEmail };
      const user = await User.findOne(query);
      if (!user) return false;

      const trimmed = code.replace(/[\s-]/g, '');

      // Check authenticator TOTP if user is using authenticator app
      if (user.twoFactorMethod === 'authenticator' && user.twoFactorSecret) {
            return TotpUtil.verify(user.twoFactorSecret, trimmed);
      }

      // Otherwise check Email / SMS one-time challenge
      const challenge = user.twoFactorChallenge;
      if (!challenge || !challenge.codeHash || !challenge.salt || !challenge.expiresAt) {
            return false;
      }

      if (new Date() > new Date(challenge.expiresAt)) {
            user.twoFactorChallenge = undefined;
            await user.save();
            return false;
      }

      const attempts = Number(challenge.attempts || 0);
      if (attempts >= 5) {
            user.twoFactorChallenge = undefined;
            await user.save();
            return false;
      }

      const matched = OneTimeCodeUtil.matches(trimmed, challenge.salt, challenge.codeHash);
      if (matched) {
            if (challenge.method === 'email') {
                  user.twoFactorEmailVerified = true;
                  user.isVerified = true;
            } else if (challenge.method === 'sms') {
                  user.twoFactorPhoneVerified = true;
            }
            user.twoFactorChallenge = undefined;
            await user.save();
            return true;
      }

      challenge.attempts = attempts + 1;
      await user.save();
      return false;
};

const confirmDestination = async (
      userId: string,
      method: 'email' | 'sms',
      code?: string
): Promise<{ success: boolean }> => {
      if (code) {
            const isValid = await verifyChallenge(userId, code);
            if (!isValid) {
                  throw new AppError('That code was not correct or has expired. Try again.', StatusCodes.BAD_REQUEST);
            }
      }

      const user = await User.findById(userId);
      if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      if (method === 'email') {
            user.twoFactorEmailVerified = true;
            user.isVerified = true;
      } else if (method === 'sms') {
            user.twoFactorPhoneVerified = true;
      }

      await user.save();
      return { success: true };
};

const listDevices = async (userId: string, currentDeviceId?: string) => {
      const devices = await DeviceSession.find({ userId, status: 'active' }).sort({ lastActive: -1 });

      return devices.map((d) => ({
            id: d.deviceId,
            name: d.name,
            platform: d.platform,
            location: d.location,
            lastActive: d.lastActive,
            isCurrent: Boolean(currentDeviceId && d.deviceId === currentDeviceId),
      }));
};

const registerOrUpdateDevice = async (
      userId: string,
      payload: {
            deviceId: string;
            name?: string;
            platform?: string;
            location?: string;
            ipAddress?: string;
      }
) => {
      const { deviceId, name, platform, location, ipAddress } = payload;
      if (!deviceId) return null;

      const session = await DeviceSession.findOneAndUpdate(
            { userId, deviceId },
            {
                  $set: {
                        name: name || 'This device',
                        platform: platform || '',
                        location: location || 'Approximate location unavailable',
                        ipAddress: ipAddress || '',
                        lastActive: new Date(),
                        status: 'active',
                  },
            },
            { upsert: true, new: true }
      );

      return session;
};

const removeDevice = async (userId: string, deviceId: string): Promise<boolean> => {
      const result = await DeviceSession.findOneAndUpdate(
            { userId, deviceId },
            { $set: { status: 'revoked' } }
      );
      return Boolean(result);
};

const securityService = {
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
      registerOrUpdateDevice,
      removeDevice,
};

export default securityService;
