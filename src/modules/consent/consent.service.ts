import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { companyName } from '../../lib/globalType';
import sendEmail from '../../utils/sendEmail';
import { User } from '../user/user.model';
import { Shop } from '../shop/shop.model';
import { Customer } from '../customer/customer.model';
import { OneTimeCodeUtil } from '../security/security.utils';
import {
      IApproveConsentPayload,
      IConsent,
      ICreateConsentPayload,
      IVerifyConsentPayload,
} from './consent.interface';
import { Consent } from './consent.model';

const CODE_EXPIRY_MINUTES = 15;
const MAX_VERIFICATION_ATTEMPTS = 5;

const generateReference = async (): Promise<string> => {
      let reference = '';
      let isUnique = false;
      let counter = 0;
      while (!isUnique && counter < 10) {
            counter++;
            const rand = crypto.randomInt(10000, 99999);
            reference = `CN-${rand}`;
            const existing = await Consent.findOne({ reference });
            if (!existing) isUnique = true;
      }
      return reference || `CN-${Date.now().toString().slice(-5)}`;
};

const maskDestination = (channel: string, email?: string, phone?: string): string => {
      if (channel === 'sms' && phone) {
            const digits = phone.replace(/\D/g, '');
            const tail = digits.length >= 4 ? digits.slice(-4) : digits;
            return `•••• ${tail}`;
      }
      if (email && email.includes('@')) {
            const [name, domain] = email.split('@');
            if (name.length <= 2) return `${name[0]}***@${domain}`;
            return `${name[0]}***${name[name.length - 1]}@${domain}`;
      }
      return 'your contact';
};

const buildConsentEmailHtml = ({
      shopName,
      customerName,
      code,
      secureLink,
      itemName,
      agreedValue,
      currency,
      paymentMethod,
}: {
      shopName: string;
      customerName: string;
      code: string;
      secureLink: string;
      itemName: string;
      agreedValue: number;
      currency: string;
      paymentMethod: string;
}): string => {
      return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Customer Consent - ${shopName}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b; border-radius:18px; border:1px solid #334155; overflow:hidden; box-shadow:0 12px 32px rgba(0,0,0,0.35);">
          <tr>
            <td style="padding:28px 32px; background:linear-gradient(135deg, #1e293b, #0f172a); border-bottom:1px solid #334155;">
              <div style="font-size:12px; font-weight:700; color:#10b981; letter-spacing:1px; text-transform:uppercase;">Customer Consent Request</div>
              <h1 style="margin:6px 0 0 0; font-size:22px; color:#ffffff; font-weight:800;">${shopName}</h1>
              <p style="margin:4px 0 0 0; font-size:12px; color:#94a3b8;">Powered by ${companyName || 'imoscan'}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0; font-size:15px; color:#e2e8f0;">
                Hello <strong>${customerName}</strong>,
              </p>
              <p style="margin:0 0 24px 0; font-size:14px; line-height:1.6; color:#94a3b8;">
                Please review and approve your sale or trade-in transaction with <strong>${shopName}</strong>. Enter the 6-digit code below to confirm and agree to terms.
              </p>

              <!-- Code Box -->
              <div style="background:#0f172a; border:1.5px dashed #10b981; border-radius:14px; padding:22px; text-align:center; margin-bottom:26px;">
                <div style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">Your Verification Code</div>
                <div style="font-size:32px; font-weight:800; letter-spacing:8px; color:#10b981; font-family:monospace;">${code}</div>
                <div style="font-size:12px; color:#64748b; margin-top:8px;">Valid for 15 minutes</div>
              </div>

              <!-- Transaction Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a; border-radius:12px; border:1px solid #334155; margin-bottom:26px;">
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #1e293b; font-size:13px; color:#94a3b8;">Item</td>
                  <td style="padding:12px 16px; border-bottom:1px solid #1e293b; font-size:13px; color:#ffffff; font-weight:700; text-align:right;">${itemName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #1e293b; font-size:13px; color:#94a3b8;">Agreed value</td>
                  <td style="padding:12px 16px; border-bottom:1px solid #1e293b; font-size:13px; color:#10b981; font-weight:700; text-align:right;">${currency} ${agreedValue.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:#94a3b8;">Payment</td>
                  <td style="padding:12px 16px; font-size:13px; color:#ffffff; font-weight:700; text-align:right;">${paymentMethod}</td>
                </tr>
              </table>

              <!-- Action Link -->
              <div style="text-align:center; margin-bottom:20px;">
                <a href="${secureLink}" style="display:inline-block; background:#10b981; color:#0f172a; font-size:15px; font-weight:800; text-decoration:none; padding:14px 28px; border-radius:12px;">
                  Open Consent & Agree
                </a>
              </div>

              <p style="font-size:12px; line-height:1.5; color:#64748b; margin:0; text-align:center;">
                If the button does not work, visit: <br/>
                <a href="${secureLink}" style="color:#10b981; word-break:break-all;">${secureLink}</a>
              </p>

              <div style="margin:26px 0; border-top:1px solid #334155;"></div>

              <div style="background:#0f172a; border-radius:10px; padding:12px 16px; border:1px solid #1e293b; font-size:12px; color:#94a3b8; line-height:1.5;">
                <strong style="color:#e2e8f0;">Privacy notice:</strong> We collect your ID image, contact details and device details for this transaction. Your original ID image is scheduled for deletion automatically within 28 days.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#0f172a; padding:16px 32px; text-align:center; border-top:1px solid #334155;">
              <p style="margin:0; font-size:11px; color:#64748b;">
                © ${new Date().getFullYear()} ${shopName} • Powered by ${companyName || 'imoscan'}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const createConsent = async (userId: string, payload: ICreateConsentPayload) => {
      const {
            customerName,
            customerEmail,
            customerPhone,
            itemName,
            agreedValue,
            currency = 'GBP',
            paymentMethod = 'Cash',
            channel = 'email',
            sendEmailNow = true,
      } = payload;

      if (!customerName || !customerName.trim()) {
            throw new AppError('Customer name is required', StatusCodes.BAD_REQUEST);
      }
      if (!itemName || !itemName.trim()) {
            throw new AppError('Item name is required', StatusCodes.BAD_REQUEST);
      }
      if (typeof agreedValue !== 'number' || agreedValue < 0) {
            throw new AppError('Valid agreed value is required', StatusCodes.BAD_REQUEST);
      }
      if (channel === 'email' && (!customerEmail || !customerEmail.trim())) {
            throw new AppError('Customer email is required for email consent', StatusCodes.BAD_REQUEST);
      }
      if (channel === 'sms' && (!customerPhone || !customerPhone.trim())) {
            throw new AppError('Customer phone is required for SMS consent', StatusCodes.BAD_REQUEST);
      }

      const shopkeeper = await User.findById(userId);
      if (!shopkeeper) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      let shop = null;
      if (payload.shopId && Types.ObjectId.isValid(payload.shopId)) {
            shop = await Shop.findById(payload.shopId);
      }
      if (!shop) {
            shop = await Shop.findOne({ shopkeeperId: shopkeeper._id, isDefault: true });
      }

      const shopName = shop?.shopName || shopkeeper.shopName || [shopkeeper.firstName, shopkeeper.lastName].filter(Boolean).join(' ') || 'Mobile Kit Distribution';

      // 6-digit code and salt
      const rawCode = OneTimeCodeUtil.generateCode();
      const codeSalt = OneTimeCodeUtil.newSalt();
      const codeHash = OneTimeCodeUtil.hash(rawCode, codeSalt);
      const secureToken = crypto.randomBytes(24).toString('hex');
      const reference = await generateReference();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

      const frontendUrl = process.env.FRONTEND_URL || 'https://imoscan.com';
      const secureLink = `${frontendUrl}/customer/consent/${secureToken}`;

      const consent = await Consent.create({
            shopkeeperId: shopkeeper._id,
            shopId: shop?._id || null,
            customerId: payload.customerId && Types.ObjectId.isValid(payload.customerId) ? new Types.ObjectId(payload.customerId) : null,
            reference,
            codeHash,
            codeSalt,
            secureToken,
            customerName: customerName.trim(),
            customerEmail: customerEmail?.trim().toLowerCase() || '',
            customerPhone: customerPhone?.trim() || '',
            itemName: itemName.trim(),
            agreedValue,
            currency,
            paymentMethod: paymentMethod.trim(),
            channel,
            status: 'pending',
            verificationAttempts: 0,
            expiresAt,
            termsVersion: '2026-09-07',
            termsSnapshot: {
                  quickTermsUrl: `${frontendUrl}/terms-conditions`,
                  fullTermsUrl: `${frontendUrl}/terms-conditions`,
                  termsVersion: '2026-09-07',
                  privacyNoticeSummary: 'We collect your ID image, contact details and device details for this transaction. Original ID image is deleted within 28 days.',
            },
      });

      let emailSent = false;
      let emailError = '';

      if (sendEmailNow && customerEmail && customerEmail.trim()) {
            try {
                  const emailRes = await sendEmail({
                        to: customerEmail.trim(),
                        subject: `Consent Request: Sale or trade-in with ${shopName}`,
                        html: buildConsentEmailHtml({
                              shopName,
                              customerName: customerName.trim(),
                              code: rawCode,
                              secureLink,
                              itemName: itemName.trim(),
                              agreedValue,
                              currency,
                              paymentMethod: paymentMethod.trim(),
                        }),
                        fromName: shopName,
                  });
                  emailSent = Boolean(emailRes.success);
                  if (!emailRes.success) {
                        emailError = emailRes.error || 'Failed to dispatch email';
                  }
            } catch (err: any) {
                  emailError = err.message || 'Error sending email';
            }
      }

      const copyMessage = `Hi ${customerName.trim()}, please review your sale or trade-in with ${shopName}.\n\nOpen: ${secureLink}\nYour code: ${rawCode}\n\nEnter the code, read the terms and confirm if you agree.`;

      return {
            consentId: consent._id.toString(),
            reference: consent.reference,
            secureToken: consent.secureToken,
            secureLink,
            code: rawCode, // provided so mobile app and shopkeeper can display/share copy message
            maskedDestination: maskDestination(channel, customerEmail, customerPhone),
            expiresAt: consent.expiresAt,
            copyMessage,
            emailSent,
            emailError: emailError || undefined,
            status: consent.status,
            customerName: consent.customerName,
            itemName: consent.itemName,
            agreedValue: consent.agreedValue,
            currency: consent.currency,
            paymentMethod: consent.paymentMethod,
            shopName,
      };
};

const getConsentByToken = async (secureToken: string) => {
      if (!secureToken) {
            throw new AppError('Secure token is required', StatusCodes.BAD_REQUEST);
      }

      const consent = await Consent.findOne({ secureToken }).populate('shopkeeperId', 'firstName lastName shopName shopAddress email phone');
      if (!consent) {
            throw new AppError('Consent request not found or link has expired', StatusCodes.NOT_FOUND);
      }

      let shop = null;
      if (consent.shopId) {
            shop = await Shop.findById(consent.shopId).lean();
      }
      const shopkeeper: any = consent.shopkeeperId;
      const shopName = shop?.shopName || shopkeeper?.shopName || [shopkeeper?.firstName, shopkeeper?.lastName].filter(Boolean).join(' ') || 'Mobile Kit Distribution';

      const isExpired = consent.status === 'pending' && new Date() > consent.expiresAt;
      if (isExpired && consent.status !== 'expired') {
            consent.status = 'expired';
            await consent.save();
      }

      return {
            id: consent._id.toString(),
            reference: consent.reference,
            secureToken: consent.secureToken,
            customerName: consent.customerName,
            customerEmail: consent.customerEmail,
            customerPhone: consent.customerPhone,
            itemName: consent.itemName,
            agreedValue: consent.agreedValue,
            currency: consent.currency,
            paymentMethod: consent.paymentMethod,
            channel: consent.channel,
            status: consent.status,
            shopName,
            expiresAt: consent.expiresAt,
            verifiedAt: consent.verifiedAt,
            approvedAt: consent.approvedAt,
            termsVersion: consent.termsVersion,
            termsSnapshot: consent.termsSnapshot,
            idImageDeleteAfter: consent.idImageDeleteAfter,
      };
};

const getConsentById = async (id: string, userId?: string) => {
      const consent = await Consent.findById(id);
      if (!consent) {
            throw new AppError('Consent not found', StatusCodes.NOT_FOUND);
      }

      let shopName = 'Mobile Kit Distribution';
      if (consent.shopId) {
            const shop = await Shop.findById(consent.shopId).lean();
            if (shop?.shopName) shopName = shop.shopName;
      }
      if (shopName === 'Mobile Kit Distribution' && consent.shopkeeperId) {
            const user = await User.findById(consent.shopkeeperId).lean();
            if (user?.shopName) shopName = user.shopName;
      }

      return {
            id: consent._id.toString(),
            reference: consent.reference,
            secureToken: consent.secureToken,
            customerName: consent.customerName,
            customerEmail: consent.customerEmail,
            customerPhone: consent.customerPhone,
            itemName: consent.itemName,
            agreedValue: consent.agreedValue,
            currency: consent.currency,
            paymentMethod: consent.paymentMethod,
            channel: consent.channel,
            status: consent.status,
            shopName,
            expiresAt: consent.expiresAt,
            verifiedAt: consent.verifiedAt,
            approvedAt: consent.approvedAt,
            termsVersion: consent.termsVersion,
            deviceMetadata: consent.deviceMetadata,
            idImageDeleteAfter: consent.idImageDeleteAfter,
            allowsCapture: consent.status === 'approved',
      };
};

const verifyConsentCode = async (identifier: string, payload: IVerifyConsentPayload) => {
      const { code } = payload;
      if (!code || code.trim().length !== 6) {
            throw new AppError('Please enter a 6-digit verification code', StatusCodes.BAD_REQUEST);
      }

      const consent = await Consent.findOne({
            $or: [
                  { _id: Types.ObjectId.isValid(identifier) ? new Types.ObjectId(identifier) : undefined },
                  { secureToken: identifier },
                  { reference: identifier },
            ].filter(Boolean),
      });

      if (!consent) {
            throw new AppError('Consent request not found', StatusCodes.NOT_FOUND);
      }

      if (consent.status === 'approved') {
            return {
                  verified: true,
                  status: consent.status,
                  message: 'Consent is already approved',
                  consent,
            };
      }

      if (consent.status === 'declined') {
            throw new AppError('This consent request was declined', StatusCodes.BAD_REQUEST);
      }

      if (new Date() > consent.expiresAt) {
            consent.status = 'expired';
            await consent.save();
            throw new AppError('The verification code has expired. Please request a new code.', StatusCodes.BAD_REQUEST);
      }

      if (consent.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
            consent.status = 'expired';
            await consent.save();
            throw new AppError('Too many failed attempts. Code has been invalidated.', StatusCodes.BAD_REQUEST);
      }

      const isValid = OneTimeCodeUtil.matches(code.trim(), consent.codeSalt, consent.codeHash);
      if (!isValid) {
            consent.verificationAttempts += 1;
            await consent.save();
            const remaining = MAX_VERIFICATION_ATTEMPTS - consent.verificationAttempts;
            throw new AppError(
                  remaining > 0 ? `Incorrect code. ${remaining} attempts remaining.` : 'Too many failed attempts. Code has been invalidated.',
                  StatusCodes.BAD_REQUEST
            );
      }

      consent.status = 'verified';
      consent.verifiedAt = new Date();
      await consent.save();

      return {
            verified: true,
            status: consent.status,
            reference: consent.reference,
            secureToken: consent.secureToken,
            message: 'Code verified successfully',
      };
};

const approveConsent = async (identifier: string, payload: IApproveConsentPayload) => {
      const { confirmAge18, confirmOwnership, confirmTermsAgreed, deviceMetadata } = payload;

      if (!confirmAge18 || !confirmOwnership || !confirmTermsAgreed) {
            throw new AppError(
                  'All declarations (Age 18+, ownership/right to sell, and Terms agreement) must be confirmed.',
                  StatusCodes.BAD_REQUEST
            );
      }

      const consent = await Consent.findOne({
            $or: [
                  { _id: Types.ObjectId.isValid(identifier) ? new Types.ObjectId(identifier) : undefined },
                  { secureToken: identifier },
                  { reference: identifier },
            ].filter(Boolean),
      });

      if (!consent) {
            throw new AppError('Consent request not found', StatusCodes.NOT_FOUND);
      }

      if (consent.status !== 'verified' && consent.status !== 'approved') {
            throw new AppError('Please verify the 6-digit code before approving consent.', StatusCodes.BAD_REQUEST);
      }

      const approvedAt = new Date();
      const idImageDeleteAfter = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 days

      consent.status = 'approved';
      consent.approvedAt = approvedAt;
      consent.idImageDeleteAfter = idImageDeleteAfter;
      if (deviceMetadata) consent.deviceMetadata = deviceMetadata;

      consent.termsSnapshot = {
            ...consent.termsSnapshot,
            confirmAge18: Boolean(confirmAge18),
            confirmOwnership: Boolean(confirmOwnership),
            confirmTermsAgreed: Boolean(confirmTermsAgreed),
      };

      await consent.save();

      return {
            approved: true,
            status: consent.status,
            reference: consent.reference,
            approvedAt: consent.approvedAt,
            idImageDeleteAfter: consent.idImageDeleteAfter,
            message: 'Consent approved successfully. Handset scanning and ID capture unlocked.',
      };
};

const declineConsent = async (identifier: string) => {
      const consent = await Consent.findOne({
            $or: [
                  { _id: Types.ObjectId.isValid(identifier) ? new Types.ObjectId(identifier) : undefined },
                  { secureToken: identifier },
                  { reference: identifier },
            ].filter(Boolean),
      });

      if (!consent) {
            throw new AppError('Consent request not found', StatusCodes.NOT_FOUND);
      }

      consent.status = 'declined';
      consent.declinedAt = new Date();
      await consent.save();

      return {
            declined: true,
            status: consent.status,
            reference: consent.reference,
            message: 'Consent declined',
      };
};

const resendConsentCode = async (identifier: string, userId?: string) => {
      const consent = await Consent.findOne({
            $or: [
                  { _id: Types.ObjectId.isValid(identifier) ? new Types.ObjectId(identifier) : undefined },
                  { secureToken: identifier },
                  { reference: identifier },
            ].filter(Boolean),
      });

      if (!consent) {
            throw new AppError('Consent request not found', StatusCodes.NOT_FOUND);
      }

      const rawCode = OneTimeCodeUtil.generateCode();
      const codeSalt = OneTimeCodeUtil.newSalt();
      const codeHash = OneTimeCodeUtil.hash(rawCode, codeSalt);
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

      consent.codeSalt = codeSalt;
      consent.codeHash = codeHash;
      consent.expiresAt = expiresAt;
      consent.verificationAttempts = 0;
      consent.status = 'pending';
      await consent.save();

      let shopName = 'Mobile Kit Distribution';
      if (consent.shopId) {
            const shop = await Shop.findById(consent.shopId).lean();
            if (shop?.shopName) shopName = shop.shopName;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'https://imoscan.com';
      const secureLink = `${frontendUrl}/customer/consent/${consent.secureToken}`;

      let emailSent = false;
      if (consent.customerEmail) {
            try {
                  const res = await sendEmail({
                        to: consent.customerEmail,
                        subject: `New Code: Consent Request with ${shopName}`,
                        html: buildConsentEmailHtml({
                              shopName,
                              customerName: consent.customerName,
                              code: rawCode,
                              secureLink,
                              itemName: consent.itemName,
                              agreedValue: consent.agreedValue,
                              currency: consent.currency || 'GBP',
                              paymentMethod: consent.paymentMethod,
                        }),
                        fromName: shopName,
                  });
                  emailSent = Boolean(res.success);
            } catch (err) {
                  console.error('Failed to resend consent email:', err);
            }
      }

      return {
            success: true,
            reference: consent.reference,
            code: rawCode,
            secureLink,
            emailSent,
            expiresAt,
            maskedDestination: maskDestination(consent.channel, consent.customerEmail, consent.customerPhone),
      };
};

const listConsentsByShopkeeper = async (shopkeeperId: string) => {
      const consents = await Consent.find({ shopkeeperId }).sort({ createdAt: -1 }).limit(100).lean();
      return consents.map((c) => ({
            id: c._id.toString(),
            reference: c.reference,
            customerName: c.customerName,
            customerEmail: c.customerEmail,
            customerPhone: c.customerPhone,
            itemName: c.itemName,
            agreedValue: c.agreedValue,
            currency: c.currency,
            paymentMethod: c.paymentMethod,
            channel: c.channel,
            status: c.status,
            createdAt: c.createdAt,
            approvedAt: c.approvedAt,
            allowsCapture: c.status === 'approved',
      }));
};

export const consentService = {
      createConsent,
      getConsentByToken,
      getConsentById,
      verifyConsentCode,
      approveConsent,
      declineConsent,
      resendConsentCode,
      listConsentsByShopkeeper,
};
