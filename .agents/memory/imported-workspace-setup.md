---
name: Imported workspace setup
description: First-run dependency setup for imported pnpm workspace projects
---

Imported pnpm workspaces may have a complete lockfile but no `node_modules`, causing managed workflows to report missing Vite or esbuild binaries before application code is evaluated.

**Why:** The imported project had valid package manifests and lockfile, but all workflows failed until dependencies were installed.

**How to apply:** Run the workspace's frozen-lockfile install before debugging workflow startup. Then apply the documented development database schema if the API seeds or queries tables during startup.