import path from "path";
import { fileURLToPath } from "url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production, serve the built React SPA and handle client-side routing.
// The API routes above take priority; everything else falls through here.
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Relative path from artifacts/api-server/dist/ to artifacts/arch-pm/dist/public/
  const staticDir = path.resolve(__dirname, "../../arch-pm/dist/public");

  app.use(express.static(staticDir));

  // SPA fallback — any non-API path serves index.html so client-side routing works.
  // Express 5 / path-to-regexp v8 requires named wildcards; use *splat syntax.
  app.get("*splat", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
