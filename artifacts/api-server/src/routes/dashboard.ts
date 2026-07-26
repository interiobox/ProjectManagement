import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, tasksTable, filesTable, usersTable, activityLogsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const [[projects], [tasks], [files], [users]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(projectsTable),
    db.select({ count: sql<number>`count(*)` }).from(tasksTable),
    db.select({ count: sql<number>`count(*)` }).from(filesTable),
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
  ]);

  const taskStatusRows = await db
    .select({ status: tasksTable.status, count: sql<number>`count(*)` })
    .from(tasksTable)
    .groupBy(tasksTable.status);

  const projectStatusRows = await db
    .select({ status: projectsTable.status, count: sql<number>`count(*)` })
    .from(projectsTable)
    .groupBy(projectsTable.status);

  const tasksByStatus = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const row of taskStatusRows) {
    const k = row.status as keyof typeof tasksByStatus;
    if (k in tasksByStatus) tasksByStatus[k] = Number(row.count);
  }

  const projectsByStatus = { active: 0, on_hold: 0, completed: 0, archived: 0 };
  for (const row of projectStatusRows) {
    const k = row.status as keyof typeof projectsByStatus;
    if (k in projectsByStatus) projectsByStatus[k] = Number(row.count);
  }

  res.json({
    totalProjects: Number(projects?.count ?? 0),
    totalTasks: Number(tasks?.count ?? 0),
    totalFiles: Number(files?.count ?? 0),
    totalUsers: Number(users?.count ?? 0),
    tasksByStatus,
    projectsByStatus,
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (_req, res): Promise<void> => {
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
    .orderBy(sql`${activityLogsTable.createdAt} DESC`)
    .limit(20);

  res.json(logs);
});

export default router;
