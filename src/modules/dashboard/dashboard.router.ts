import { Router } from "express";
import dashboardController from "./dashboard.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.get('/chart', dashboardController.adminDashboardChart)
router.get('/analytics', dashboardController.getAdminDashboardAnalytics)
router.get('/shopkeeper-analytics', protect, dashboardController.getShopkeeperDashboardAnalytics)

const dashboardRouter = router;
export default dashboardRouter;
