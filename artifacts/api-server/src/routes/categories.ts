import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import {
  CreateCategoryBody,
  CreateCategoryParams,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
  ListCategoriesParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:projectId/categories", requireAuth, async (req, res): Promise<void> => {
  const params = ListCategoriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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
    .where(eq(categoriesTable.projectId, params.data.projectId))
    .orderBy(categoriesTable.name);
  res.json(categories);
});

router.post("/projects/:projectId/categories", requireAuth, async (req, res): Promise<void> => {
  const params = CreateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.insert(categoriesTable).values({
    ...parsed.data,
    projectId: params.data.projectId,
  }).returning();
  await logActivity({
    action: "created category",
    entityType: "category",
    entityId: category.id,
    entityName: category.name,
    projectId: params.data.projectId,
    userId: req.user!.userId,
  });
  res.status(201).json({ ...category, taskCount: 0 });
});

router.patch("/projects/:projectId/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.update(categoriesTable)
    .set(parsed.data)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.projectId, params.data.projectId)))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json({ ...category, taskCount: null });
});

router.delete("/projects/:projectId/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(categoriesTable)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.projectId, params.data.projectId)));
  res.sendStatus(204);
});

export default router;
