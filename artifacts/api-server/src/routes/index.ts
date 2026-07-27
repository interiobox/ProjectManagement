import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import categoriesRouter from "./categories";
import tasksRouter from "./tasks";
import filesRouter from "./files";
import activityRouter from "./activity";
import dashboardRouter from "./dashboard";
import notesRouter from "./notes";
import feedRouter from "./feed";
import personalNotesRouter from "./personal-notes";
import driveRouter from "./drive";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(projectsRouter);
router.use(categoriesRouter);
router.use(tasksRouter);
router.use(filesRouter);
router.use(activityRouter);
router.use(dashboardRouter);
router.use(notesRouter);
router.use(feedRouter);
router.use(personalNotesRouter);
router.use(driveRouter);

export default router;
