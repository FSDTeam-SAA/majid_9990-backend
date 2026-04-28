import { Router } from "express";
import announcementController from "./announcement.controller";

const router = Router();

router.post("/send", announcementController.sendAnnouncement)


const announcementRouter = router;
export default announcementRouter;