import serverless from 'serverless-http';
import app from '../../artifacts/api-server/src/app';
import { seedAdminUser } from '../../artifacts/api-server/src/lib/seed';

// Seed the default admin user on cold start (idempotent — safe to run every
// time a new function instance starts up).
await seedAdminUser().catch(console.error);

export const handler = serverless(app);
