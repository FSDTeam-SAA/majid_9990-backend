import dotenv from 'dotenv';

dotenv.config();

export default {
      bcryptSaltRounds: process.env.BCRYPT_SALT_ROUNDS || 10,
      refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
      jwtRefreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,

      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            apiSecret: process.env.CLOUDINARY_API_SECRET,
      },
      email: {
            emailAddress: process.env.EMAIL_ADDRESS,
            emailPass: process.env.EMAIL_PASSWORD,
      },
};
