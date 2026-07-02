import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt, { JwtPayload } from 'jsonwebtoken';
import AppError from '../errors/AppError';
import { User } from '../modules/user/user.model';

const getTokenUserId = (decoded: JwtPayload) => {
      const userId = decoded._id ?? decoded.userId;

      if (!userId) {
            throw new AppError('Invalid token', StatusCodes.UNAUTHORIZED);
      }

      return userId;
};

export const protect = async (req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new AppError('You are not authorized', StatusCodes.UNAUTHORIZED);

      try {
            const decoded = (await jwt.verify(token, process.env.JWT_SECRET!)) as JwtPayload;
            const userId = getTokenUserId(decoded);
            const user = await User.findById(userId);

            if (!user) {
                  throw new AppError('User not found', StatusCodes.NOT_FOUND);
            }

            req.user = user;
            next();
      } catch (err) {
            throw new AppError('Invalid token', StatusCodes.UNAUTHORIZED);
      }
};

export const optionalProtect = async (req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return next();

      try {
            const decoded = (await jwt.verify(token, process.env.JWT_SECRET!)) as JwtPayload;
            const userId = getTokenUserId(decoded);
            const user = await User.findById(userId);

            if (user) {
                  req.user = user;
            }
            return next();
      } catch (err) {
            return next();
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
