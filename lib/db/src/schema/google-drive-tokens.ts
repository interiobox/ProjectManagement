import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const googleDriveTokensTable = pgTable("google_drive_tokens", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  driveRootFolderId: text("drive_root_folder_id"),
  connectedByEmail: text("connected_by_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoogleDriveTokenRecord = typeof googleDriveTokensTable.$inferSelect;
