import { Router } from "express";
import dashboardController from "./dashboard.controller";

const router = Router();

router.get('/chart', dashboardController.adminDashboardChart)

const dashboardRouter = router;
export default dashboardRouter;