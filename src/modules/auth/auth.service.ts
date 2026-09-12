import { StatusCodes } from 'http-status-codes';
import bcrypt from "bcrypt";

import AppError from "../../errors/AppError";
import sendEmail from "../../utils/sendEmail";

import { User } from "../user/user.model";
import { companyName } from "../../lib/globalType";
import verificationCodeTemplate from "../../utils/verificationCodeTemplate";
import config from '../../config/config';
import { createToken, verifyToken } from '../../utils/tokenGenerate';
import shopService from '../shop/shop.service';
import securityService from '../security/security.service';
import { TwoFactorMethodType } from '../security/security.interface';

const login = async (payload: { email: string; password: string }) => {
  const { email, password } = payload;

  const user = await User.isUserExistByEmail(email);
  if (!user)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  if (user.isVerified === false)
    throw new AppError("Please verify your email", StatusCodes.UNAUTHORIZED);

  const isPasswordValid = await User.isPasswordMatch(password, user.password);
  if (!isPasswordValid)
    throw new AppError("Invalid password", StatusCodes.UNAUTHORIZED);

  const tokenPayload: Record<string, unknown> = {
    _id: user._id,
    email: user.email,
    role: user.role,
  };

  if (user.role === 'staff' && user.shopkeeperId) {
    tokenPayload.shopkeeperId = user.shopkeeperId;
  }

  const accessToken = createToken(
    tokenPayload,
    config.JWT_SECRET as string,
    config.JWT_EXPIRES_IN as string,
  );

  const refreshToken = createToken(
    tokenPayload,
    config.refreshTokenSecret as string,
    config.jwtRefreshTokenExpiresIn as string,
  );

  let shops: unknown[] = [];
  let multiShopEnabled = false;
  let defaultShopId: string | null = null;

  if (user.role === 'shopkeeper' || user.role === 'staff') {
    try {
      const entitlement = await shopService.getEntitlement(user);
      shops = entitlement.shops;
      multiShopEnabled = entitlement.multiShopEnabled;
      defaultShopId = entitlement.defaultShopId;
    } catch {
      // Entitlement is an enhancement to the login payload. Never block login.
    }
  }

  const loginResult = {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      image: user.image,
      phone: user.phone,
      street: user.street,
      location: user.location,
      postalCode: user.postalCode,
      dateOfBirth: user.dateOfBirth,
      shopkeeperId: user.role === 'staff' ? user.shopkeeperId : undefined,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      twoFactorMethod: user.twoFactorMethod || 'email',
    },
    shops,
    multiShopEnabled,
    defaultShopId,
  };

  if ((payload as any).deviceId) {
    try {
      await securityService.registerOrUpdateDevice(user._id.toString(), {
        deviceId: (payload as any).deviceId,
        name: (payload as any).deviceName,
        platform: (payload as any).platform,
        location: (payload as any).location,
      });
    } catch {
      // Device registration enhancement should never block login
    }
  }

  return loginResult;
};

const refreshToken = async (token: string) => {
  if (!token) {
    throw new AppError("Refresh token is required", StatusCodes.UNAUTHORIZED);
  }

  let decodedToken: any;

  try {
    decodedToken = verifyToken(token, config.refreshTokenSecret as string);

    if (!decodedToken) {
      throw new AppError("Invalid token", StatusCodes.UNAUTHORIZED);
    }
  } catch (error) {
    throw new AppError("You are not authorized", StatusCodes.UNAUTHORIZED);
  }

  const email = decodedToken.email as string;
  const userData = await User.findOne({ email });

  if (!userData) {
    throw new AppError("No account found with the provided credentials.", StatusCodes.UNAUTHORIZED);
  }

  const JwtPayload = {
    userId: userData._id,
    role: userData.role,
    email: userData.email,
  };

  const accessToken = createToken(
    JwtPayload,
    config.JWT_SECRET as string,
    config.JWT_EXPIRES_IN as string,
  );

  return { accessToken };
};

const forgotPassword = async (email: string) => {
  if (!email) throw new Error("Email is required");

  const isExistingUser = await User.isUserExistByEmail(email);
  if (!isExistingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  await User.findByIdAndUpdate(
    isExistingUser._id,
    {
      resetPasswordOtp: hashedOtp,
      resetPasswordOtpExpires: otpExpires,
    },
    { new: true },
  );

  await sendEmail({
    to: isExistingUser.email,
    subject: "Reset your password",
    html: verificationCodeTemplate(otp),
  });

  const JwtToken = {
    userId: isExistingUser._id,
    email: isExistingUser.email,
    role: isExistingUser.role,
  };

  const accessToken = createToken(
    JwtToken,
    config.JWT_SECRET as string,
    config.JWT_EXPIRES_IN as string,
  );

  return { accessToken };
};

const resendForgotOtpCode = async (email: string) => {
  const existingUser = await User.isUserExistByEmail(email);
  if (!existingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  await User.findOneAndUpdate(
    { email },
    {
      resetPasswordOtp: hashedOtp,
      resetPasswordOtpExpires: otpExpires,
    },
    { new: true },
  ).select("username email role");

  await sendEmail({
    to: existingUser.email,
    subject: `${companyName} - Password Reset OTP`,
    html: verificationCodeTemplate(otp),
  });
  // return result;
};

const verifyOtp = async (email: string, otp: string) => {
  if (!otp) {
    throw new AppError("OTP is required", StatusCodes.BAD_REQUEST);
  }

  const isExistingUser = await User.isUserExistByEmail(email);
  if (!isExistingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  if (
    !isExistingUser.resetPasswordOtp ||
    !isExistingUser.resetPasswordOtpExpires
  ) {
    throw new AppError(
      "Password reset OTP not requested or has expired",
      StatusCodes.BAD_REQUEST,
    );
  }

  if (isExistingUser.resetPasswordOtpExpires < new Date()) {
    throw new AppError(
      "Password reset OTP has expired",
      StatusCodes.BAD_REQUEST,
    );
  }

  const isOtpMatched = await bcrypt.compare(
    otp.toString(),
    isExistingUser.resetPasswordOtp,
  );
  if (!isOtpMatched) throw new Error("Invalid OTP");

  await User.findByIdAndUpdate(
    isExistingUser._id,
    {
      resetPasswordOtp: "",
      resetPasswordOtpExpires: "",
    },
    { new: true },
  );

  const JwtToken = {
    userId: isExistingUser._id,
    email: isExistingUser.email,
    role: isExistingUser.role,
  };

  const accessToken = createToken(
    JwtToken,
    config.JWT_SECRET as string,
    config.JWT_EXPIRES_IN as string,
  );

  return { accessToken };
};

const resetPassword = async (
  payload: { newPassword: string },
  email: string,
) => {
  if (!payload.newPassword)
    throw new AppError("Password is required", StatusCodes.BAD_REQUEST);

  const isExistingUser = await User.isUserExistByEmail(email);
  if (!isExistingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  const isSamePassword = await bcrypt.compare(
    payload.newPassword,
    isExistingUser.password,
  );
  if (isSamePassword) {
    throw new AppError(
      "New password cannot be the same as the current password",
      StatusCodes.BAD_REQUEST,
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcryptSaltRounds),
  );

  const result = await User.findOneAndUpdate(
    { email },
    {
      password: hashedPassword,
      otp: undefined,
      otpExpires: undefined,
    },
    { new: true },
  ).select(
    "-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires",
  );

  return result;
};

const changePassword = async (
  payload: {
    currentPassword: string;
    newPassword: string;
  },
  email: string,
) => {
  const { currentPassword, newPassword } = payload;
  if (!currentPassword || !newPassword) {
    throw new AppError(
      "Current and new passwords are required",
      StatusCodes.BAD_REQUEST,
    );
  }

  const isExistingUser = await User.isUserExistByEmail(email);
  if (!isExistingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  const isPasswordMatched = await User.isPasswordMatch(
    currentPassword,
    isExistingUser.password,
  );

  if (!isPasswordMatched)
    throw new AppError(
      "Current password is incorrect",
      StatusCodes.BAD_REQUEST,
    );

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcryptSaltRounds),
  );

  const result = await User.findOneAndUpdate(
    { email },
    {
      password: hashedPassword,
    },
    { new: true },
  ).select(
    "-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires",
  );

  return result;
};

const send2FaChallenge = async (email: string, method?: TwoFactorMethodType) => {
  if (!email) {
    throw new AppError("Email is required", StatusCodes.BAD_REQUEST);
  }
  return await securityService.sendChallenge(email, method);
};

const verify2Fa = async (email: string, code: string) => {
  if (!email || !code) {
    throw new AppError("Email and code are required", StatusCodes.BAD_REQUEST);
  }
  const isValid = await securityService.verifyChallenge(email, code);
  if (!isValid) {
    throw new AppError("Invalid or expired verification code", StatusCodes.BAD_REQUEST);
  }
  return { valid: true };
};

const authService = {
  login,
  refreshToken,
  forgotPassword,
  resendForgotOtpCode,
  verifyOtp,
  resetPassword,
  changePassword,
  send2FaChallenge,
  verify2Fa,
};

export default authService;
