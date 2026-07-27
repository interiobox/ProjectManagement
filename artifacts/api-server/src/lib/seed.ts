import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";

const ADMIN_EMAIL = "admin@archfirm.com";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin";

/**
 * Idempotently seeds the default admin user.
 * Safe to call on every startup — does nothing if the user already exists.
 */
export async function seedAdminUser(): Promise<void> {
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing) {
    logger.debug({ email: ADMIN_EMAIL }, "Admin user already exists, skipping seed");
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await db.insert(usersTable).values({
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    passwordHash,
    role: "admin",
  });

  logger.info({ email: ADMIN_EMAIL }, "Seeded default admin user");
}
