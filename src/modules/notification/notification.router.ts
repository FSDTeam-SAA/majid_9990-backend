import { Router } from "express";
import { getAllNotifications, markAllAsRead } from "./notification.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.get('/', protect, getAllNotifications);

router.patch('/read/all', markAllAsRead);

const notificationRouter = router;
export default notificationRouter;
