import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import locationService from './location.service';

const parseIp = (req: any) => {
      const forwarded = (req.headers && req.headers['x-forwarded-for']) || '';
      const ipFromHeader = forwarded ? String(forwarded).split(',')[0].trim() : null;
      const remote = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : null;
      const ip = ipFromHeader || remote || req.ip;
      // strip IPv6 prefix if present
      return String(ip || '').replace(/^::ffff:/, '');
};

const getCountryCode = catchAsync(async (req, res) => {
      // Allow testIp query param for development/testing
      const testIp = req.query.testIp as string;
      const ip = testIp || parseIp(req);

      if (!ip) {
            sendResponse(res, {
                  statusCode: StatusCodes.BAD_REQUEST,
                  success: false,
                  message: 'Unable to determine client IP address',
            });
            return;
      }

      const geo = await locationService.getGeoForIp(ip);

      if (!geo) {
            sendResponse(res, {
                  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                  success: false,
                  message: 'Failed to fetch geo information',
            });
            return;
      }

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Country code fetched',
            data: {
                  ip,
                  country: geo.country_name || null,
                  countryCode: geo.country || geo.country_code || null,
            },
      });
});

const locationController = {
      getCountryCode,
};

export default locationController;
