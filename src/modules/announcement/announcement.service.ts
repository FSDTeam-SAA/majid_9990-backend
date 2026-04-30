import announcementTemplate from "../../utils/announcementTampale";
import sendEmail from "../../utils/sendEmail";
import Notification from "../notification/notification.model";
import { User } from "../user/user.model";
import { IAnnouncement } from "./announcement.interface";
import Announcement from "./announcement.model";


const sendAnnouncement = async (payload: IAnnouncement) => {
      const announcement = await Announcement.create(payload);
      const users = await User.find({}, { email: 1, _id: 1 });

      const emails = users.map((user) => user.email);

      // Email send
      await Promise.all(
            emails.map((email) =>
                  sendEmail({
                        to: email,
                        subject: 'New Announcement',
                        html: announcementTemplate(announcement.title, announcement.message),
                  })
            )
      );

      // Notifications
      const notifications = users.map((user) => ({
            userId: user._id,
            title: announcement.title,
            message: announcement.message,
            type: 'ANNOUNCEMENT',
            id: announcement._id,
            to: user._id,
      }));

      await Notification.insertMany(notifications);

      return announcement;
};


const getAnnouncement = async (query: any) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const search = query.search || '';
      const filter = search ? { title: { $regex: search, $options: 'i' } } : {};

      const result = await Announcement.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });

      const total = await Announcement.countDocuments(filter);

      return {
            data: result,
            meta: {
                  total,
                  page,
                  limit,
                  totalPage: Math.ceil(total / limit),
            },
      };
};


const announcementService = {
    sendAnnouncement,
    getAnnouncement,
};

export default announcementService;