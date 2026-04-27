import { Model } from "mongoose";

export interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  street: string;
  location: string;
  postalCode: string;
  dateOfBirth: Date;
  role: string;
  image: {
    public_id: string;
    url: string;
  };
  isVerified: boolean;
  otp?: string | null;
  otpExpires?: Date | null;
  resetPasswordOtp?: string | null;
  resetPasswordOtpExpires?: Date | null;
  shopName?: string;
  shopAddress?: string;
  whatsappNumber?: string;
}

export interface userModel extends Model<IUser> {
      isPasswordMatch(password: string, hashedPassword: string): Promise<boolean>;
      isUserExistByEmail(email: string): Promise<IUser | null>;
      isUserExistById(_id: string): Promise<IUser | null>;
      isOTPVerified(_id: string): Promise<boolean>;
}

