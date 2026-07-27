import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { filesTable } from "./files";
import { tasksTable } from "./tasks";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const fileUploadLogsTable = pgTable("file_upload_logs", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => filesTable.id, { onDelete: "set null" }),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  version: integer("version").notNull(),
  url: text("url"),
  uploadedById: integer("uploaded_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedById: integer("removed_by_id").references(() => usersTable.id, { onDelete: "set null" }),
});

export type FileUploadLog = typeof fileUploadLogsTable.$inferSelect;