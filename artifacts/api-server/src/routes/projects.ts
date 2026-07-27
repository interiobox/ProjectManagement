import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db, projectsTable, usersTable, tasksTable, filesTable, categoriesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", requireAuth, async (_req, res): Promise<void> => {
  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      description: projectsTable.description,
      status: projectsTable.status,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      createdById: projectsTable.createdById,
      createdByName: usersTable.name,
      taskCount: sql<number>`(select count(*) from tasks where tasks.project_id = ${projectsTable.id})`,
      fileCount: sql<number>`(select count(*) from files f join tasks t on f.task_id = t.id where t.project_id = ${projectsTable.id})`,
    })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.createdById, usersTable.id))
    .orderBy(projectsTable.createdAt);
  res.json(projects);
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.insert(projectsTable).values({
    ...parsed.data,
    createdById: req.user!.userId,
  }).returning();

  await logActivity({
    action: "created project",
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    projectId: project.id,
    userId: req.user!.userId,
  });

  const [creator] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  res.status(201).json({
    ...project,
    createdByName: creator?.name ?? null,
    taskCount: 0,
    fileCount: 0,
  });
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      description: projectsTable.description,
      status: projectsTable.status,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      createdById: projectsTable.createdById,
      createdByName: usersTable.name,
    })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.createdById, usersTable.id))
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      color: categoriesTable.color,
      projectId: categoriesTable.projectId,
      createdAt: categoriesTable.createdAt,
      taskCount: sql<number>`(select count(*) from tasks where tasks.category_id = ${categoriesTable.id})`,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.projectId, params.data.id))
    .orderBy(categoriesTable.name);

  res.json({ ...project, categories });
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.update(projectsTable).set(parsed.data).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await logActivity({
    action: "updated project",
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    projectId: project.id,
    userId: req.user!.userId,
  });
  res.json({ ...project, createdByName: null, taskCount: null, fileCount: null });
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
