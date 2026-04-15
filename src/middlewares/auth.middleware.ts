import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt, { JwtPayload } from 'jsonwebtoken';
import AppError from '../errors/AppError';
import { User } from '../modules/user/user.model';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new AppError('You are not authorized', StatusCodes.UNAUTHORIZED);

      try {
            const decoded = (await jwt.verify(token, process.env.JWT_ACCESS_SECRET!)) as JwtPayload;
            // console.log(decoded)
            const user = await User.findById(decoded._id);
            if (user && (await User.isOTPVerified(user._id))) {
                  req.user = user;
            }
            next();
      } catch (err) {
            throw new AppError('Invalid token', StatusCodes.UNAUTHORIZED);
      }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
      if (req.user?.role !== 'admin') {
            throw new AppError('Access denied. You are not an admin.', StatusCodes.FORBIDDEN);
      }
      next();
};

export const isDriver = (req: Request, res: Response, next: NextFunction): void => {
      if (req.user?.role !== 'driver') {
            throw new AppError('Access denied. You are not an driver.', StatusCodes.FORBIDDEN);
      }
      next();
};
