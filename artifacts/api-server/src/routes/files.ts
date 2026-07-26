import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, filesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import {
  UploadFileBody,
  UploadFileParams,
  ListFilesParams,
  GetFileHistoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:projectId/tasks/:taskId/files", requireAuth, async (req, res): Promise<void> => {
  const params = ListFilesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Return latest version of each file name
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
      sql`${filesTable.taskId} = ${params.data.taskId} AND ${filesTable.version} = (
        SELECT MAX(f2.version) FROM files f2 WHERE f2.task_id = ${filesTable.taskId} AND f2.name = ${filesTable.name}
      )`
    )
    .orderBy(filesTable.name);
  res.json(files);
});

router.post("/projects/:projectId/tasks/:taskId/files", requireAuth, async (req, res): Promise<void> => {
  const params = UploadFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UploadFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Calculate next version for this file name in this task
  const [versionRow] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${filesTable.version}), 0)` })
    .from(filesTable)
    .where(and(eq(filesTable.taskId, params.data.taskId), eq(filesTable.name, parsed.data.name)));

  const nextVersion = (versionRow?.maxVersion ?? 0) + 1;

  const [file] = await db.insert(filesTable).values({
    name: parsed.data.name,
    mimeType: parsed.data.mimeType,
    size: parsed.data.size,
    url: parsed.data.url,
    version: nextVersion,
    taskId: params.data.taskId,
    uploadedById: req.user!.userId,
  }).returning();

  await logActivity({
    action: nextVersion > 1 ? `uploaded file version ${nextVersion}` : "uploaded file",
    entityType: "file",
    entityId: file.id,
    entityName: file.name,
    projectId: params.data.projectId,
    userId: req.user!.userId,
  });

  res.status(201).json({ ...file, uploadedByName: null });
});

router.get("/projects/:projectId/tasks/:taskId/files/:fileId/history", requireAuth, async (req, res): Promise<void> => {
  const params = GetFileHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Find the file name for this fileId
  const [baseFile] = await db.select({ name: filesTable.name, taskId: filesTable.taskId })
    .from(filesTable)
    .where(eq(filesTable.id, params.data.fileId));

  if (!baseFile) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  // Return all versions with that name in the same task
  const versions = await db
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
    .where(and(eq(filesTable.taskId, baseFile.taskId), eq(filesTable.name, baseFile.name)))
    .orderBy(filesTable.version);

  res.json(versions);
});

export default router;
