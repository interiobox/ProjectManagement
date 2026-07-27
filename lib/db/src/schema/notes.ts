import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";
import { tasksTable } from "./tasks";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  projectId: integer("project_id")
    .references(() => projectsTable.id, { onDelete: "cascade" })
    .notNull(),
  // null = project-level note; set = task-level note
  taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
