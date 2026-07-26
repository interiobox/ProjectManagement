import { db, activityLogsTable } from "@workspace/db";

export async function logActivity(params: {
  action: string;
  entityType: "project" | "task" | "file" | "category" | "user";
  entityId: number;
  entityName?: string;
  projectId: number;
  userId: number;
}): Promise<void> {
  try {
    await db.insert(activityLogsTable).values({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName ?? null,
      projectId: params.projectId,
      userId: params.userId,
    });
  } catch {
    // Non-critical: don't fail the request if activity logging fails
  }
}
