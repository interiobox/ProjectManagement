import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, tasksTable, projectsTable, categoriesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/feed", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.user!.role === "admin";
  const userId = req.user!.userId;

  // Admins see all tasks; members see tasks they created or are assigned to
  const taskFilter = isAdmin
    ? undefined
    : or(eq(tasksTable.createdById, userId), eq(tasksTable.assignedToId, userId));

  const [projects, tasks] = await Promise.all([
    db
      .select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status })
      .from(projectsTable)
      .orderBy(projectsTable.name),

    db
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
      .where(taskFilter)
      .orderBy(tasksTable.createdAt),
  ]);

  res.json({ projects, tasks });
});

export default router;
