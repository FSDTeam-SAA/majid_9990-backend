import { Router } from "express";
import { getAllNotificationByUser, getAllNotifications, getShopkeeperAllNotifications, markAllAsRead } from "./notification.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.get('/', protect, getAllNotifications);
router.get("/shopkeeper", protect, getShopkeeperAllNotifications);
router.get("/user", protect, getAllNotificationByUser);


router.patch('/read/all', markAllAsRead);


const notificationRouter = router;
export default notificationRouter;
