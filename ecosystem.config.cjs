/**
 * PM2 process config for Hostinger (or any VPS/Node.js host).
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save          # persist across reboots
 *   pm2 startup       # generate OS-level startup hook
 */
module.exports = {
  apps: [
    {
      name: "archpm",
      script: "artifacts/api-server/dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",

      // Environment — copy these to Hostinger's Node.js environment variables
      // panel instead of committing secrets here.
      env_production: {
        NODE_ENV: "production",
        PORT: "3000", // Change if Hostinger assigns a different port
        // DATABASE_URL and SESSION_SECRET must be set in the hosting panel
        // or in a .env file that is NOT committed to git.
      },

      // Restart policy
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Logging
      error_file: "logs/archpm-error.log",
      out_file: "logs/archpm-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
