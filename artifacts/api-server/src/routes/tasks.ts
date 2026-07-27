import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, tasksTable, usersTable, categoriesTable, filesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import {
  CreateTaskBody,
  CreateTaskParams,
  UpdateTaskBody,
  UpdateTaskParams,
  DeleteTaskParams,
  ListTasksParams,
  GetTaskParams,
} from "@workspace/api-zod";
import {
  getTaskAssignees,
  replaceTaskAssignees,
  validateAssigneeIds,
  withLegacyAssignee,
} from "../lib/task-assignees";

const router: IRouter = Router();

router.get("/projects/:projectId/tasks", requireAuth, async (req, res): Promise<void> => {
  const params = ListTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const tasks = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      categoryId: tasksTable.categoryId,
      categoryName: categoriesTable.name,
      assignedToId: tasksTable.assignedToId,
      assignedToName: usersTable.name,
      createdById: tasksTable.createdById,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      fileCount: sql<number>`(select count(*) from files where files.task_id = ${tasksTable.id})`,
    })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .leftJoin(usersTable, eq(tasksTable.assignedToId, usersTable.id))
    .where(eq(tasksTable.projectId, params.data.projectId))
    .orderBy(tasksTable.createdAt);

  // Include createdByName via a second pass (to avoid ambiguous join on usersTable)
  const createdByIds = [...new Set(tasks.map(t => t.createdById))];
  const creators = createdByIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(
        inArray(usersTable.id, createdByIds)
      )
    : [];
  const creatorMap = Object.fromEntries(creators.map(c => [c.id, c.name]));

  const assigneeMap = await getTaskAssignees(tasks.map(task => task.id));
  res.json(tasks.map(t => {
    const assignees = withLegacyAssignee(
      assigneeMap.get(t.id) ?? [],
      t.assignedToId,
      t.assignedToName,
    );
    return {
      ...t,
      createdByName: creatorMap[t.createdById] ?? null,
      assigneeIds: assignees.map(assignee => assignee.id),
      assignees,
    };
  }));
});

router.post("/projects/:projectId/tasks", requireAuth, async (req, res): Promise<void> => {
  const params = CreateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { assigneeIds: rawAssigneeIds, ...taskData } = parsed.data;
  let assigneeIds: number[];
  try {
    assigneeIds = await validateAssigneeIds(rawAssigneeIds ?? (taskData.assignedToId ? [taskData.assignedToId] : []));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid assignees" });
    return;
  }
  const [task] = await db.insert(tasksTable).values({
    ...taskData,
    assignedToId: assigneeIds[0] ?? null,
    projectId: params.data.projectId,
    createdById: req.user!.userId,
  }).returning();
  await replaceTaskAssignees(task.id, assigneeIds);

  await logActivity({
    action: "created task",
    entityType: "task",
    entityId: task.id,
    entityName: task.title,
    projectId: params.data.projectId,
    userId: req.user!.userId,
  });

  const assignees = (await getTaskAssignees([task.id])).get(task.id) ?? [];
  res.status(201).json({
    ...task,
    categoryName: null,
    assignedToName: null,
    createdByName: null,
    fileCount: 0,
    assigneeIds: assignees.map(assignee => assignee.id),
    assignees,
  });
});

router.get("/projects/:projectId/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      categoryId: tasksTable.categoryId,
      categoryName: categoriesTable.name,
      assignedToId: tasksTable.assignedToId,
      assignedToName: usersTable.name,
      createdById: tasksTable.createdById,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .leftJoin(usersTable, eq(tasksTable.assignedToId, usersTable.id))
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.projectId, params.data.projectId)));

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Get latest version of each file for this task
  const files = await db
    .select({
      id: filesTable.id,
      name: filesTable.name,
      mimeType: filesTable.mimeType,
      size: filesTable.size,
      version: filesTable.version,
      url: filesTable.url,
      taskId: filesTable.taskId,
      uploadedById: filesTable.uploadedById,
      uploadedByName: usersTable.name,
      createdAt: filesTable.createdAt,
    })
    .from(filesTable)
    .leftJoin(usersTable, eq(filesTable.uploadedById, usersTable.id))
    .where(
      sql`${filesTable.taskId} = ${task.id} AND ${filesTable.version} = (
        SELECT MAX(f2.version) FROM files f2 WHERE f2.task_id = ${filesTable.taskId} AND f2.name = ${filesTable.name}
      )`
    )
    .orderBy(filesTable.name);

  const [creator] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, task.createdById));
  const assignees = withLegacyAssignee(
    (await getTaskAssignees([task.id])).get(task.id) ?? [],
    task.assignedToId,
    task.assignedToName,
  );
  res.json({
    ...task,
    createdByName: creator?.name ?? null,
    assigneeIds: assignees.map(assignee => assignee.id),
    assignees,
    files,
  });
});

router.patch("/projects/:projectId/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { assigneeIds: rawAssigneeIds, ...taskUpdates } = parsed.data;
  let assigneeIds: number[] | undefined = rawAssigneeIds;
  if (assigneeIds === undefined && "assignedToId" in parsed.data) {
    assigneeIds = parsed.data.assignedToId ? [parsed.data.assignedToId] : [];
  }
  if (assigneeIds !== undefined) {
    try {
      assigneeIds = await validateAssigneeIds(assigneeIds);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid assignees" });
      return;
    }
    taskUpdates.assignedToId = assigneeIds[0] ?? null;
  }
  const [task] = await db.update(tasksTable).set(taskUpdates).where(
    and(eq(tasksTable.id, params.data.id), eq(tasksTable.projectId, params.data.projectId))
  ).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (assigneeIds !== undefined) {
    await replaceTaskAssignees(task.id, assigneeIds);
  }
  await logActivity({
    action: "updated task",
    entityType: "task",
    entityId: task.id,
    entityName: task.title,
    projectId: task.projectId,
    userId: req.user!.userId,
  });

  // Re-fetch related names so the client gets complete data after the update
  const [categoryRow] = task.categoryId
    ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, task.categoryId))
    : [null];
  const assignees = withLegacyAssignee(
    (await getTaskAssignees([task.id])).get(task.id) ?? [],
    task.assignedToId,
    null,
  );
  const [creatorRow] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, task.createdById));
  const [fileCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(filesTable)
    .where(eq(filesTable.taskId, task.id));

  res.json({
    ...task,
    categoryName: categoryRow?.name ?? null,
    assignedToName: assignees[0]?.name ?? null,
    createdByName: creatorRow?.name ?? null,
    fileCount: fileCountRow?.count ?? 0,
    assigneeIds: assignees.map(assignee => assignee.id),
    assignees,
  });
});

router.delete("/projects/:projectId/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(tasksTable).where(
    and(eq(tasksTable.id, params.data.id), eq(tasksTable.projectId, params.data.projectId))
  );
  res.sendStatus(204);
});

export default router;
