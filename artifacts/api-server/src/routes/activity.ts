import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, activityLogsTable, usersTable, projectsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { GetProjectActivityParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:projectId/activity", requireAuth, async (req, res): Promise<void> => {
  const params = GetProjectActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db
    .select({
      id: activityLogsTable.id,
      action: activityLogsTable.action,
      entityType: activityLogsTable.entityType,
      entityId: activityLogsTable.entityId,
      entityName: activityLogsTable.entityName,
      projectId: activityLogsTable.projectId,
      projectName: projectsTable.name,
      userId: activityLogsTable.userId,
      userName: usersTable.name,
      createdAt: activityLogsTable.createdAt,
    })
    .from(activityLogsTable)
    .leftJoin(usersTable, eq(activityLogsTable.userId, usersTable.id))
    .leftJoin(projectsTable, eq(activityLogsTable.projectId, projectsTable.id))
    .where(eq(activityLogsTable.projectId, params.data.projectId))
    .orderBy(activityLogsTable.createdAt);

  res.json(logs.reverse());
});

export default router;
