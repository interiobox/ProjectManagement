import { Router } from "express";
import crypto from "crypto";
import { google } from "googleapis";
import { db, googleDriveTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getOAuth2Client,
  getAuthUrl,
  getStoredTokens,
} from "../lib/google-drive";
import { requireAuth, requireAdmin, verifyToken } from "../lib/auth";

const router = Router();

// ── CSRF state store (10-minute TTL) ─────────────────────────────────────────

const pendingStates = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (now - v > 10 * 60 * 1000) pendingStates.delete(k);
  }
}, 60_000).unref();

// ── Middleware: accept JWT from Bearer header OR ?token= query param ──────────
// (Needed for the /auth redirect which the browser initiates without AJAX.)

function requireAdminFlexible(req: any, res: any, next: any): void {
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;

  if (queryToken) {
    try {
      const payload = verifyToken(queryToken);
      if (payload.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      req.user = payload;
      next();
    } catch {
      res.status(401).send("Invalid or expired token. Please log in again.");
    }
    return;
  }

  requireAdmin(req, res, next);
}

// ── GET /drive/status ─────────────────────────────────────────────────────────

router.get("/drive/status", requireAuth, async (_req, res): Promise<void> => {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) {
      res.json({ connected: false });
      return;
    }
    res.json({
      connected: true,
      email: tokens.connectedByEmail,
      connectedAt: tokens.createdAt,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /drive/auth — redirect to Google OAuth consent screen ─────────────────

router.get("/drive/auth", requireAdminFlexible, (_req, res): void => {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    pendingStates.set(state, Date.now());
    const url = getAuthUrl(state);
    res.redirect(url);
  } catch (e: any) {
    res
      .status(500)
      .send(
        `Google OAuth is not configured on this server: ${e.message}. ` +
          `Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.`
      );
  }
});

// ── GET /drive/callback — Google redirects here after user consent ────────────

router.get("/drive/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`/settings?drive_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state || !pendingStates.has(state)) {
    res
      .status(400)
      .send("Invalid OAuth state. Please return to Settings and try again.");
    return;
  }
  pendingStates.delete(state);

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch the authorised user's email address
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2Api.userinfo.get();
    const email = userInfo.data.email ?? null;

    const expiresAt = new Date(tokens.expiry_date ?? Date.now() + 3_600_000);

    const existing = await getStoredTokens();
    if (existing) {
      await db
        .update(googleDriveTokensTable)
        .set({
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token ?? existing.refreshToken,
          expiresAt,
          connectedByEmail: email,
          // Reset root folder id so it gets re-discovered with the new token
          driveRootFolderId: null,
          updatedAt: new Date(),
        })
        .where(eq(googleDriveTokensTable.id, existing.id));
    } else {
      await db.insert(googleDriveTokensTable).values({
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiresAt,
        connectedByEmail: email,
      });
    }

    res.redirect("/settings?drive=connected");
  } catch (e: any) {
    res.redirect(
      `/settings?drive_error=${encodeURIComponent(e.message)}`
    );
  }
});

// ── DELETE /drive/disconnect ──────────────────────────────────────────────────

router.delete(
  "/drive/disconnect",
  requireAdmin,
  async (_req, res): Promise<void> => {
    await db.delete(googleDriveTokensTable);
    res.sendStatus(204);
  }
);

export default router;
