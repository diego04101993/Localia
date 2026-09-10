import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import path from "node:path";
import {
  assertDevelopmentDatabaseSafety,
  getRuntimeDatabaseTarget,
  isRemoteDatabaseAllowedInDevelopment,
  shouldRunStartupMaintenance,
} from "./runtime-safety";
import {
  apiNotFoundHandler,
  checkPostgresReadiness,
  createHttpErrorHandler,
  createSensitiveRequestPathGuard,
  generalNotFoundHandler,
  JSON_BODY_LIMIT,
  registerOperationalHealthRoutes,
  registerPublicAuthRateLimits,
  rejectSensitiveRequestPaths,
  requestContextMiddleware,
  sanitizeProductionJsonErrors,
  summarizeJsonResponseForLog,
} from "./http-security";

dotenv.config();

const app = express();
const httpServer = createServer(app);
app.disable("x-powered-by");

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use(requestContextMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path === "/api" || path.startsWith("/api/")) {
      let logLine = `requestId=${res.locals.requestId} ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const responseSummary = summarizeJsonResponseForLog(capturedJsonResponse, res.statusCode);
      if (responseSummary) {
        logLine += ` :: ${responseSummary}`;
      }

      log(logLine);
    }
  });

  next();
});

app.use(sanitizeProductionJsonErrors());
app.use(process.env.NODE_ENV === "production"
  ? rejectSensitiveRequestPaths
  : createSensitiveRequestPathGuard({ viteDevelopmentRoot: path.resolve(process.cwd()) }));

registerOperationalHealthRoutes(app, {
  checkReadiness: async (signal) => {
    const { pool } = await import("./db");
    await checkPostgresReadiness(pool, signal);
  },
});

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
registerPublicAuthRateLimits(app);

(async () => {
  assertDevelopmentDatabaseSafety();

  const databaseTarget = getRuntimeDatabaseTarget();
  if (process.env.NODE_ENV === "production") {
    log(`database target ${databaseTarget.redactedUrl ?? "(unknown)"}`, "runtime");
  } else if (databaseTarget.isLocal) {
    log(`development database target ${databaseTarget.redactedUrl ?? "(unknown)"} [local]`, "runtime");
  } else {
    log(
      `development database target ${databaseTarget.redactedUrl ?? "(unknown)"} [remote allowed=${isRemoteDatabaseAllowedInDevelopment()}]`,
      "runtime",
    );
  }

  const { registerRoutes } = await import("./routes");
  const { createNotificationCleanupJob } = await import("./notifications");
  await registerRoutes(httpServer, app);
  if (shouldRunStartupMaintenance()) {
    createNotificationCleanupJob();
    log("automatic age-based deletion disabled", "finance-retention");
  } else {
    log("startup maintenance disabled outside production", "runtime");
  }

  app.use("/api", apiNotFoundHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  app.use(generalNotFoundHandler);
  app.use(createHttpErrorHandler({
    onError: ({ requestId, method, path, status, errorType, error }) => {
      log(`requestId=${requestId} ${method} ${path} ${status} type=${errorType}`, "http-error");
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
    },
  }));

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
