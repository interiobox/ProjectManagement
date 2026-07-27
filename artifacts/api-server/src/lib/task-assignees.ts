import { eq, inArray } from "drizzle-orm";
import { db, taskAssigneesTable, usersTable } from "@workspace/db";

export type TaskAssignee = {
  id: number;
  name: string;
  email: string;
};

export async function getTaskAssignees(taskIds: number[]) {
  const result = new Map<number, TaskAssignee[]>();
  if (taskIds.length === 0) return result;

  const rows = await db
    .select({
      taskId: taskAssigneesTable.taskId,
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(taskAssigneesTable)
    .innerJoin(usersTable, eq(taskAssigneesTable.userId, usersTable.id))
    .where(inArray(taskAssigneesTable.taskId, taskIds));

  for (const row of rows) {
    const current = result.get(row.taskId) ?? [];
    current.push({ id: row.id, name: row.name, email: row.email });
    result.set(row.taskId, current);
  }

  return result;
}

export function withLegacyAssignee(
  assignees: TaskAssignee[],
  legacyId: number | null | undefined,
  legacyName: string | null | undefined,
  legacyEmail?: string | null,
) {
  if (!legacyId || assignees.some(assignee => assignee.id === legacyId)) return assignees;
  return [
    ...assignees,
    {
      id: legacyId,
      name: legacyName ?? "Unknown user",
      email: legacyEmail ?? "",
    },
  ];
}

export async function validateAssigneeIds(assigneeIds: number[]) {
  const uniqueIds = [...new Set(assigneeIds)];
  if (uniqueIds.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error("assigneeIds must contain positive integer user IDs");
  }

  if (uniqueIds.length === 0) return uniqueIds;

  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, uniqueIds));
  if (users.length !== uniqueIds.length) {
    throw new Error("One or more assignees could not be found");
  }

  return uniqueIds;
}

export async function replaceTaskAssignees(taskId: number, assigneeIds: number[]) {
  await db.delete(taskAssigneesTable).where(eq(taskAssigneesTable.taskId, taskId));
  if (assigneeIds.length > 0) {
    await db.insert(taskAssigneesTable).values(
      assigneeIds.map(userId => ({ taskId, userId })),
    );
  }
}