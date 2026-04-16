import bcrypt from 'bcrypt';
import { model, Schema } from 'mongoose';

import config from '../../config/config';
import { IUser, userModel } from './user.interface';

const userSchema = new Schema<IUser>(
      {
            firstName: {
                  type: String,
                  required: true,
            },
            lastName: {
                  type: String,
                  required: true,
            },
            email: {
                  type: String,
                  required: true,
                  unique: true,
            },
            phone: {
                  type: String,
            },
            password: {
                  type: String,
                  required: true,
            },
            street: {
                  type: String,
            },
            location: {
                  type: String,
            },
            postalCode: {
                  type: String,
            },
            dateOfBirth: {
                  type: Date,
            },
            role: {
                  type: String,
                  enum: ['user', 'admin'],
                  default: 'user',
            },
            image: {
                  public_id: {
                        type: String,
                  },
                  url: {
                        type: String,
                  },
            },
            isVerified: {
                  type: Boolean,
                  default: false,
            },
            otp: { type: String, default: null },
            otpExpires: { type: Date, default: null },
            resetPasswordOtp: { type: String, default: null },
            resetPasswordOtpExpires: { type: Date, default: null },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

userSchema.pre('save', async function (next) {
      this.password = await bcrypt.hash(this.password, Number(config.bcryptSaltRounds));

      next();
});

userSchema.post('save', function (doc, next) {
      doc.password = '';
      next();
});

userSchema.statics.isPasswordMatch = async function (password: string, hashedPassword: string) {
      return await bcrypt.compare(password, hashedPassword);
};

userSchema.statics.isUserExistByEmail = async function (email: string): Promise<IUser | null> {
      return await User.findOne({ email });
};

userSchema.statics.isUserExistById = async function (_id: string): Promise<IUser | null> {
      return await User.findOne({ _id });
};

userSchema.statics.isOTPVerified = async function (_id: string): Promise<boolean> {
      const user = await User.findOne({ _id });
      if (!user) return false;
      return user.isVerified;
};

export const User = model<IUser, userModel>('User', userSchema);
