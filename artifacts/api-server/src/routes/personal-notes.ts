import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, personalNotesTable } from "@workspace/db";
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

router.get("/personal-notes", requireAuth, async (req, res): Promise<void> => {
  const notes = await db
    .select()
    .from(personalNotesTable)
    .where(eq(personalNotesTable.userId, req.user!.userId))
    .orderBy(desc(personalNotesTable.updatedAt));
  res.json(notes);
});

router.post("/personal-notes", requireAuth, async (req, res): Promise<void> => {
  const content = validateContent(req.body);
  if (!content) { res.status(400).json({ error: "content is required (max 5000 chars)" }); return; }

  const [note] = await db
    .insert(personalNotesTable)
    .values({ content, userId: req.user!.userId })
    .returning();
  res.status(201).json(note);
});

router.patch("/personal-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const content = validateContent(req.body);
  if (!content) { res.status(400).json({ error: "content is required (max 5000 chars)" }); return; }

  const [existing] = await db
    .select()
    .from(personalNotesTable)
    .where(eq(personalNotesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
  if (existing.userId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const [updated] = await db
    .update(personalNotesTable)
    .set({ content, updatedAt: new Date() })
    .where(eq(personalNotesTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/personal-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select()
    .from(personalNotesTable)
    .where(eq(personalNotesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
  if (existing.userId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(personalNotesTable).where(eq(personalNotesTable.id, id));
  res.sendStatus(204);
});

export default router;
