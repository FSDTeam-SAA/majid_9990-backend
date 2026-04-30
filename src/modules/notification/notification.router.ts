import { Router } from "express";
import { getAllNotificationByAdmin, getAllNotificationByUser, getAllNotifications, getShopkeeperAllNotifications, getSingleNotification, markAllAsRead, markAsReadSingleNotification } from "./notification.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.get('/', protect, getAllNotifications);
router.get("/shopkeeper", protect, getShopkeeperAllNotifications);
router.get("/user", protect, getAllNotificationByUser);
router.get("/admin", protect, getAllNotificationByAdmin);
router.get('/:id',  getSingleNotification);
router.patch('/read/:id',  markAsReadSingleNotification);

router.patch('/read/all', markAllAsRead);


const notificationRouter = router;
export default notificationRouter;
