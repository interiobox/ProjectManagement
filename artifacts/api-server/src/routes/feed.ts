import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, tasksTable, projectsTable, categoriesTable, usersTable, taskAssigneesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getTaskAssignees, withLegacyAssignee } from "../lib/task-assignees";

const router: IRouter = Router();

router.get("/feed", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.user!.role === "admin";
  const userId = req.user!.userId;

  // Admins see all tasks; members see tasks they created or are assigned to
  const assignedTaskRows = isAdmin
    ? []
    : await db
        .select({ taskId: taskAssigneesTable.taskId })
        .from(taskAssigneesTable)
        .where(eq(taskAssigneesTable.userId, userId));
  const assignedTaskIds = new Set(assignedTaskRows.map(row => row.taskId));

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
      .orderBy(tasksTable.createdAt),
  ]);

  const assigneeMap = await getTaskAssignees(tasks.map(task => task.id));
  const visibleTasks = isAdmin
    ? tasks
    : tasks.filter(task =>
        task.createdById === userId ||
        task.assignedToId === userId ||
        assignedTaskIds.has(task.id),
      );
  res.json({
    projects,
    tasks: visibleTasks.map(task => {
      const assignees = withLegacyAssignee(
        assigneeMap.get(task.id) ?? [],
        task.assignedToId,
        task.assignedToName,
      );
      return {
        ...task,
        assigneeIds: assignees.map(assignee => assignee.id),
        assignees,
      };
    }),
  });
});

export default router;
