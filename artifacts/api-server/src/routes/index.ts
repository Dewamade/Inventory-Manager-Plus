import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import materialsRouter from "./materials";
import scanInRouter from "./scanIn";
import scanOutRouter from "./scanOut";
import historyRouter from "./history";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(materialsRouter);
router.use(scanInRouter);
router.use(scanOutRouter);
router.use(historyRouter);
router.use(dashboardRouter);

export default router;

import backupRouter from "./backup";   // add this line
// ... existing imports ...
router.use(backupRouter);              // add this line at the bottom
