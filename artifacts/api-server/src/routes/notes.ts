import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, notesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseIntParam(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateContent(body: unknown): string | null {
  const content = (body as any)?.content;
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= 5000 ? trimmed : null;
}

async function attachUserNames(notes: any[]) {
  const userIds = [...new Set(notes.map((n) => n.userId))];
  if (!userIds.length) return notes.map((n) => ({ ...n, userName: null }));
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable);
  const map = Object.fromEntries(users.filter(u => userIds.includes(u.id)).map((u) => [u.id, u.name]));
  return notes.map((n) => ({ ...n, userName: map[n.userId] ?? null }));
}

// ── Project-level notes ────────────────────────────────────────────────────

router.get("/projects/:projectId/notes", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseIntParam(req.params.projectId);
  if (!projectId) { res.status(400).json({ error: "Invalid projectId" }); return; }

  const notes = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.projectId, projectId), isNull(notesTable.taskId)))
    .orderBy(notesTable.createdAt);

  res.json(await attachUserNames(notes));
});

router.post("/projects/:projectId/notes", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseIntParam(req.params.projectId);
  if (!projectId) { res.status(400).json({ error: "Invalid projectId" }); return; }

  const content = validateContent(req.body);
  if (!content) { res.status(400).json({ error: "content is required (max 5000 chars)" }); return; }

  const [note] = await db.insert(notesTable).values({
    content,
    projectId,
    userId: req.user!.userId,
  }).returning();

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, note.userId));

  res.status(201).json({ ...note, userName: user?.name ?? null });
});

// ── Task-level notes ───────────────────────────────────────────────────────

router.get("/projects/:projectId/tasks/:taskId/notes", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseIntParam(req.params.projectId);
  const taskId = parseIntParam(req.params.taskId);
  if (!projectId || !taskId) { res.status(400).json({ error: "Invalid params" }); return; }

  const notes = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.projectId, projectId), eq(notesTable.taskId, taskId)))
    .orderBy(notesTable.createdAt);

  res.json(await attachUserNames(notes));
});

router.post("/projects/:projectId/tasks/:taskId/notes", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseIntParam(req.params.projectId);
  const taskId = parseIntParam(req.params.taskId);
  if (!projectId || !taskId) { res.status(400).json({ error: "Invalid params" }); return; }

  const content = validateContent(req.body);
  if (!content) { res.status(400).json({ error: "content is required (max 5000 chars)" }); return; }

  const [note] = await db.insert(notesTable).values({
    content,
    projectId,
    taskId,
    userId: req.user!.userId,
  }).returning();

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, note.userId));

  res.status(201).json({ ...note, userName: user?.name ?? null });
});

// ── Edit / Delete ──────────────────────────────────────────────────────────

router.patch("/notes/:noteId", requireAuth, async (req, res): Promise<void> => {
  const noteId = parseIntParam(req.params.noteId);
  if (!noteId) { res.status(400).json({ error: "Invalid noteId" }); return; }

  const content = validateContent(req.body);
  if (!content) { res.status(400).json({ error: "content is required (max 5000 chars)" }); return; }

  const [existing] = await db.select().from(notesTable).where(eq(notesTable.id, noteId));
  if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
  if (existing.userId !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [updated] = await db.update(notesTable)
    .set({ content, updatedAt: new Date() })
    .where(eq(notesTable.id, noteId))
    .returning();

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, updated.userId));

  res.json({ ...updated, userName: user?.name ?? null });
});

router.delete("/notes/:noteId", requireAuth, async (req, res): Promise<void> => {
  const noteId = parseIntParam(req.params.noteId);
  if (!noteId) { res.status(400).json({ error: "Invalid noteId" }); return; }

  const [existing] = await db.select().from(notesTable).where(eq(notesTable.id, noteId));
  if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
  if (existing.userId !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(notesTable).where(eq(notesTable.id, noteId));
  res.sendStatus(204);
});

export default router;
