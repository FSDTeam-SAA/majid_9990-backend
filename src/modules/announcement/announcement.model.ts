import { model, Schema } from "mongoose";
import { IAnnouncement } from "./announcement.interface";

const announcementSchema = new Schema<IAnnouncement>({
    title: { type: String, required: true },
    message: { type: String, required: true },
} ,{ timestamps: true, versionKey: false });


const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
export default Announcement;