import { Router } from "express";
import dashboardController from "./dashboard.controller";

const router = Router();

router.get('/chart', dashboardController.adminDashboardChart)
router.get('/analytics', dashboardController.getAdminDashboardAnalytics)

const dashboardRouter = router;
export default dashboardRouter;
