import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, filesTable, fileUploadLogsTable, usersTable, tasksTable, projectsTable, googleDriveTokensTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { getAuthorizedDrive, uploadFileToDrive } from "../lib/google-drive";
import { isR2Configured, uploadToR2, deleteFromR2, extractR2Key, getPresignedUrl } from "../lib/r2";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";

const router: IRouter = Router();

// ── Storage ──────────────────────────────────────────────────────────────────
// Use memory storage so we can route the buffer to Drive or to local disk.

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// Serve locally-uploaded files (dev / fallback only)
router.get("/uploads/:filename", (req, res): void => {
  const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filePath);
});

// Proxy R2 files when no public bucket URL is configured.
// Uses ?key= query param to avoid path-to-regexp v8 wildcard restrictions.
router.get("/uploads/r2", requireAuth, async (req, res): Promise<void> => {
  const key = req.query["key"] as string | undefined;
  if (!key) { res.status(400).json({ error: "Missing key query param" }); return; }
  try {
    const url = await getPresignedUrl(key);
    res.redirect(302, url);
  } catch {
    res.status(500).json({ error: "Failed to generate download URL" });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseIntParam(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function taskBelongsToProject(taskId: number, projectId: number): Promise<boolean> {
  const [task] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.projectId, projectId)));
  return Boolean(task);
}

// ── List files (latest version per name) ─────────────────────────────────────

router.get("/projects/:projectId/tasks/:taskId/files", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseIntParam(req.params.projectId);
  const taskId = parseIntParam(req.params.taskId);
  if (!projectId || !taskId) { res.status(400).json({ error: "Invalid params" }); return; }
  if (!await taskBelongsToProject(taskId, projectId)) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

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
      sql`${filesTable.taskId} = ${taskId} AND ${filesTable.version} = (
        SELECT MAX(f2.version) FROM files f2
        WHERE f2.task_id = ${filesTable.taskId} AND f2.name = ${filesTable.name}
      )`
    )
    .orderBy(filesTable.name);

  res.json(files);
});

// ── Upload file (multipart OR JSON fallback) ──────────────────────────────────

router.post(
  "/projects/:projectId/tasks/:taskId/files",
  requireAuth,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const projectId = parseIntParam(req.params.projectId);
    const taskId = parseIntParam(req.params.taskId);
    if (!projectId || !taskId) { res.status(400).json({ error: "Invalid params" }); return; }
    if (!await taskBelongsToProject(taskId, projectId)) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    let name: string;
    let mimeType: string;
    let size: number;
    let url: string;

    if (req.file) {
      // Real multipart upload — try Drive first, fall back to local disk
      name = req.file.originalname;
      mimeType = req.file.mimetype || "application/octet-stream";
      size = req.file.size;

      const drive = await getAuthorizedDrive();
      if (drive) {
        // 1st priority: Google Drive
        const [projectRow] = await db
          .select({ name: projectsTable.name })
          .from(projectsTable)
          .where(eq(projectsTable.id, projectId));

        const [taskRow] = await db
          .select({ title: tasksTable.title })
          .from(tasksTable)
          .where(eq(tasksTable.id, taskId));

        const [tokenRow] = await db.select().from(googleDriveTokensTable).limit(1);

        const result = await uploadFileToDrive(drive, {
          fileName: name,
          mimeType,
          buffer: req.file.buffer,
          projectName: projectRow?.name ?? `project-${projectId}`,
          taskName: taskRow?.title ?? `task-${taskId}`,
          rootFolderId: tokenRow?.driveRootFolderId,
        });

        url = result.webViewLink;

        if (tokenRow && !tokenRow.driveRootFolderId) {
          await db
            .update(googleDriveTokensTable)
            .set({ driveRootFolderId: result.rootFolderId, updatedAt: new Date() })
            .where(eq(googleDriveTokensTable.id, tokenRow.id));
        }
      } else if (isR2Configured()) {
        // 2nd priority: Cloudflare R2
        const hash = createHash("md5").update(Date.now() + name).digest("hex").slice(0, 8);
        const ext = path.extname(name);
        const key = `tasks/${taskId}/${hash}${ext}`;
        url = await uploadToR2(req.file.buffer, key, mimeType);
      } else {
        // Fallback: local disk (dev only — ephemeral on Render/Railway)
        const hash = createHash("md5").update(Date.now() + name).digest("hex").slice(0, 8);
        const ext = path.extname(name);
        const filename = `${hash}${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
        const baseUrl = process.env.API_BASE_URL ?? "";
        url = `${baseUrl}/api/uploads/${filename}`;
      }
    } else {
      // JSON fallback (existing behaviour)
      const body = req.body as any;
      if (!body?.name || typeof body.name !== "string") {
        res.status(400).json({ error: "name is required" }); return;
      }
      name = body.name;
      mimeType = body.mimeType ?? "application/octet-stream";
      size = Number(body.size) || 0;
      url = body.url ?? "";
    }

    // Version calculation
    const [versionRow] = await db
      .select({ maxVersion: sql<number>`COALESCE(MAX(${filesTable.version}), 0)` })
      .from(filesTable)
      .where(and(eq(filesTable.taskId, taskId), eq(filesTable.name, name)));

    const nextVersion = (versionRow?.maxVersion ?? 0) + 1;

    const [file] = await db.transaction(async (tx) => {
      const [createdFile] = await tx.insert(filesTable).values({
        name,
        mimeType,
        size,
        url,
        version: nextVersion,
        taskId,
        uploadedById: req.user!.userId,
      }).returning();

      await tx.insert(fileUploadLogsTable).values({
        fileId: createdFile.id,
        taskId,
        projectId,
        name,
        mimeType,
        size,
        url,
        version: nextVersion,
        uploadedById: req.user!.userId,
        createdAt: createdFile.createdAt,
      });

      return [createdFile];
    });

    await logActivity({
      action: nextVersion > 1 ? `uploaded file version ${nextVersion}` : "uploaded file",
      entityType: "file",
      entityId: file.id,
      entityName: file.name,
      projectId,
      userId: req.user!.userId,
    });

    const [uploader] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId));
    res.status(201).json({ ...file, uploadedByName: uploader?.name ?? null });
  }
);

// ── Delete a file version ──────────────────────────────────────────────────────

router.delete("/projects/:projectId/tasks/:taskId/files/:fileId", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseIntParam(req.params.projectId);
  const taskId = parseIntParam(req.params.taskId);
  const fileId = parseIntParam(req.params.fileId);
  if (!projectId || !taskId || !fileId) { res.status(400).json({ error: "Invalid params" }); return; }
  if (!await taskBelongsToProject(taskId, projectId)) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [file] = await db
    .select({
      id: filesTable.id,
      name: filesTable.name,
      url: filesTable.url,
      taskId: filesTable.taskId,
      uploadedById: filesTable.uploadedById,
    })
    .from(filesTable)
    .where(and(eq(filesTable.id, fileId), eq(filesTable.taskId, taskId)));

  if (!file) { res.status(404).json({ error: "File not found" }); return; }
  if (file.uploadedById !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Only the uploader or an admin can remove this file" });
    return;
  }

  const removedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(fileUploadLogsTable)
      .set({ removedAt, removedById: req.user!.userId })
      .where(eq(fileUploadLogsTable.fileId, fileId));
    await tx.delete(filesTable).where(eq(filesTable.id, fileId));
  });

  // Clean up the stored file from whichever backend it lives in.
  if (file.url) {
    try {
      const r2Key = extractR2Key(file.url);
      if (r2Key) {
        // R2 object
        await deleteFromR2(r2Key);
      } else {
        // Local disk (dev fallback)
        const pathname = new URL(file.url, "http://localhost").pathname;
        if (pathname.startsWith("/api/uploads/")) {
          const storedPath = path.join(UPLOADS_DIR, path.basename(pathname));
          if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
        }
      }
    } catch {
      // A malformed or external URL — nothing to remove locally.
    }
  }

  await logActivity({
    action: "removed file",
    entityType: "file",
    entityId: file.id,
    entityName: file.name,
    projectId,
    userId: req.user!.userId,
  });

  res.sendStatus(204);
});

// ── File version history ──────────────────────────────────────────────────────

router.get("/projects/:projectId/tasks/:taskId/files/history", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseIntParam(req.params.projectId);
  const taskId = parseIntParam(req.params.taskId);
  if (!projectId || !taskId) { res.status(400).json({ error: "Invalid params" }); return; }
  if (!await taskBelongsToProject(taskId, projectId)) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const removedUsers = alias(usersTable, "removed_users");
  const uploads = await db
    .select({
      id: filesTable.id,
      fileId: filesTable.id,
      name: filesTable.name,
      mimeType: filesTable.mimeType,
      size: filesTable.size,
      version: filesTable.version,
      url: filesTable.url,
      taskId: filesTable.taskId,
      uploadedById: filesTable.uploadedById,
      uploadedByName: usersTable.name,
      createdAt: filesTable.createdAt,
      removedAt: sql<Date | null>`NULL`,
      removedById: sql<number | null>`NULL`,
      removedByName: sql<string | null>`NULL`,
    })
    .from(filesTable)
    .leftJoin(usersTable, eq(filesTable.uploadedById, usersTable.id))
    .where(eq(filesTable.taskId, taskId))
    .orderBy(desc(filesTable.createdAt), desc(filesTable.id));

  const loggedUploads = await db
    .select({
      id: fileUploadLogsTable.id,
      fileId: fileUploadLogsTable.fileId,
      name: fileUploadLogsTable.name,
      mimeType: fileUploadLogsTable.mimeType,
      size: fileUploadLogsTable.size,
      version: fileUploadLogsTable.version,
      url: fileUploadLogsTable.url,
      taskId: fileUploadLogsTable.taskId,
      uploadedById: fileUploadLogsTable.uploadedById,
      uploadedByName: usersTable.name,
      createdAt: fileUploadLogsTable.createdAt,
      removedAt: fileUploadLogsTable.removedAt,
      removedById: fileUploadLogsTable.removedById,
      removedByName: removedUsers.name,
    })
    .from(fileUploadLogsTable)
    .leftJoin(usersTable, eq(fileUploadLogsTable.uploadedById, usersTable.id))
    .leftJoin(removedUsers, eq(fileUploadLogsTable.removedById, removedUsers.id))
    .where(eq(fileUploadLogsTable.taskId, taskId))
    .orderBy(desc(fileUploadLogsTable.createdAt), desc(fileUploadLogsTable.id));

  const loggedFileIds = new Set(loggedUploads.map(upload => upload.fileId).filter((id): id is number => id !== null));
  const legacyUploads = uploads
    .filter(upload => !loggedFileIds.has(upload.fileId))
    .map(upload => ({ ...upload, id: -upload.id }));

  res.json([...loggedUploads, ...legacyUploads].sort((a, b) => {
    const createdAtDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return createdAtDiff || b.id - a.id;
  }));
});

router.get("/projects/:projectId/tasks/:taskId/files/:fileId/history", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseIntParam(req.params.taskId);
  const fileId = parseIntParam(req.params.fileId);
  if (!taskId || !fileId) { res.status(400).json({ error: "Invalid params" }); return; }
  const projectId = parseIntParam(req.params.projectId);
  if (!projectId) { res.status(400).json({ error: "Invalid params" }); return; }
  if (!await taskBelongsToProject(taskId, projectId)) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [baseFile] = await db
    .select({ name: filesTable.name, taskId: filesTable.taskId })
    .from(filesTable)
    .where(eq(filesTable.id, fileId));

  if (!baseFile) { res.status(404).json({ error: "File not found" }); return; }
  if (baseFile.taskId !== taskId) { res.status(404).json({ error: "File not found" }); return; }

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
