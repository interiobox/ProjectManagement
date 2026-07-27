import { google } from "googleapis";
import { Readable } from "stream";
import { db, googleDriveTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── OAuth client ─────────────────────────────────────────────────────────────

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `https://${process.env.REPLIT_DEV_DOMAIN}/api/drive/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    prompt: "consent",
    state,
  });
}

// ── Token storage ─────────────────────────────────────────────────────────────

export async function getStoredTokens() {
  const [row] = await db.select().from(googleDriveTokensTable).limit(1);
  return row ?? null;
}

export async function isConnected(): Promise<boolean> {
  return (await getStoredTokens()) !== null;
}

// ── Authorized clients ────────────────────────────────────────────────────────

export async function getAuthorizedClient() {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt.getTime(),
  });

  // Persist refreshed tokens automatically
  client.on("tokens", async (newTokens) => {
    await db
      .update(googleDriveTokensTable)
      .set({
        accessToken: newTokens.access_token ?? tokens.accessToken,
        ...(newTokens.refresh_token
          ? { refreshToken: newTokens.refresh_token }
          : {}),
        expiresAt: newTokens.expiry_date
          ? new Date(newTokens.expiry_date)
          : tokens.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(googleDriveTokensTable.id, tokens.id));
  });

  return client;
}

export async function getAuthorizedDrive() {
  const auth = await getAuthorizedClient();
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}

// ── Drive helpers ─────────────────────────────────────────────────────────────

type Drive = ReturnType<typeof google.drive>;

/** Find or create a folder by name under a parent (or Drive root). */
export async function ensureFolder(
  drive: Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const parent = parentId ?? "root";
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parent}' in parents`;

  const res = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 1,
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent],
    },
    fields: "id",
  });

  return created.data.id!;
}

export interface DriveUploadOptions {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  projectName: string;
  taskName: string;
  /** Cached root folder id so we don't recreate the top-level folder each time */
  rootFolderId?: string | null;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  /** The ArchPM root folder id (to be persisted for future uploads) */
  rootFolderId: string;
}

/**
 * Upload a file to Drive under ArchPM/{projectName}/{taskName}/
 * and make it readable by anyone with the link.
 */
export async function uploadFileToDrive(
  drive: Drive,
  opts: DriveUploadOptions
): Promise<DriveUploadResult> {
  // Folder path: ArchPM → project → task
  const rootId =
    opts.rootFolderId ?? (await ensureFolder(drive, "ArchPM"));
  const projectFolderId = await ensureFolder(drive, opts.projectName, rootId);
  const taskFolderId = await ensureFolder(drive, opts.taskName, projectFolderId);

  const body = Readable.from(opts.buffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name: opts.fileName,
      parents: [taskFolderId],
    },
    media: {
      mimeType: opts.mimeType,
      body,
    },
    fields: "id,webViewLink",
  });

  // Make the file readable by anyone with the link
  await drive.permissions.create({
    fileId: uploaded.data.id!,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileId: uploaded.data.id!,
    webViewLink: uploaded.data.webViewLink!,
    rootFolderId: rootId,
  };
}
