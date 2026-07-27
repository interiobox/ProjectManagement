import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const personalNotesTable = pgTable("personal_notes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PersonalNote = typeof personalNotesTable.$inferSelect;
