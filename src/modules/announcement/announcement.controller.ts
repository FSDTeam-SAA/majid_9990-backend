import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import announcementService from "./announcement.service";


const sendAnnouncement = catchAsync(async (req, res) => {
    const result = await announcementService.sendAnnouncement(req.body);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Announcement sent successfully',
        data: result,
    });
});


const getAnnouncement = catchAsync(async (req, res) => {
    const result = await announcementService.getAnnouncement();

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Announcement retrieved successfully',
        data: result,
    });
});


const announcementController = {
    sendAnnouncement,
    getAnnouncement,
};

export default announcementController;