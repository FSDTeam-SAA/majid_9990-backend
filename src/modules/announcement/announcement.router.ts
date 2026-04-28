import { Router } from "express";
import announcementController from "./announcement.controller";

const router = Router();

router.post("/send", announcementController.sendAnnouncement)
router.get("/all", announcementController.getAnnouncement)

const announcementRouter = router;
export default announcementRouter;