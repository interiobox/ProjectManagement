import app from "./app";
import { logger } from "./lib/logger";
import { seedAdminUser } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start listening immediately so health checks pass right away.
// Seeding runs after the server is up — non-critical for startup readiness.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  seedAdminUser().catch((seedErr) => {
    logger.error({ err: seedErr }, "Failed to seed admin user");
  });
});
