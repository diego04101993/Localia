import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import type {
  ErrorRequestHandler,
  Express,
  Request,
  RequestHandler,
  Response,
} from "express";

export const JSON_BODY_LIMIT = "100kb";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const BLOCKED_SENSITIVE_FILE_EXTENSIONS = [
  ".env",
  ".key",
  ".pem",
  ".p12",
  ".pfx",
  ".php",
  ".phar",
  ".sql",
  ".dump",
  ".bak",
  ".backup",
  ".zip",
  ".tar",
  ".tgz",
] as const;
const NON_SPA_ROOTS = new Set([
  "actuator",
  "etc",
  "phpmyadmin",
  "proc",
  "root",
  "swagger",
  "swagger-ui",
  "var",
  "windows",
  "wp-admin",
  "wp-login",
]);

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator: (req: Request) => string;
  message?: string;
  now?: () => number;
  maxEntries?: number;
};

type HttpErrorInfo = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  errorType: string;
  error: unknown;
};

type HttpErrorHandlerOptions = {
  isProduction?: boolean;
  onError?: (info: HttpErrorInfo) => void;
};

type SensitiveRequestPathGuardOptions = {
  viteDevelopmentRoot?: string;
};

type ReadinessOptions = {
  checkReadiness: (signal: AbortSignal) => Promise<void>;
  timeoutMs?: number;
  successCacheMs?: number;
  failureCacheMs?: number;
  now?: () => number;
};

type ReadinessPoolClient = {
  query: (text: string) => Promise<unknown>;
  release: (destroy?: boolean) => void;
};

type ReadinessPool = {
  connect: () => Promise<ReadinessPoolClient>;
};

type ReadinessStatus = "ready" | "unavailable";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export const PUBLIC_AUTH_RATE_LIMITS = {
  signInIp: { windowMs: FIFTEEN_MINUTES_MS, max: 120 },
  recoveryIp: { windowMs: FIFTEEN_MINUTES_MS, max: 30 },
  registrationIp: { windowMs: ONE_HOUR_MS, max: 30 },
  loginIdentity: { windowMs: FIFTEEN_MINUTES_MS, max: 10 },
  forgotPasswordIdentity: { windowMs: FIFTEEN_MINUTES_MS, max: 5 },
  resetPasswordToken: { windowMs: FIFTEEN_MINUTES_MS, max: 8 },
  registerIdentity: { windowMs: ONE_HOUR_MS, max: 5 },
  googleToken: { windowMs: FIFTEEN_MINUTES_MS, max: 20 },
  appleToken: { windowMs: FIFTEEN_MINUTES_MS, max: 20 },
} as const;

export const READINESS_TIMEOUT_MS = 3_000;
export const READINESS_SUCCESS_CACHE_MS = 5_000;
export const READINESS_FAILURE_CACHE_MS = 1_000;

function safeLogText(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

export function summarizeJsonResponseForLog(body: unknown, statusCode: number): string | null {
  if (!body || typeof body !== "object") return null;

  const responseBody = body as Record<string, unknown>;
  const code = typeof responseBody.code === "string" ? safeLogText(responseBody.code) : null;
  const message = statusCode >= 400 && typeof responseBody.message === "string"
    ? safeLogText(responseBody.message)
    : null;
  const summary = [
    code ? `code=${JSON.stringify(code)}` : null,
    message ? `message=${JSON.stringify(message)}` : null,
  ].filter((value): value is string => !!value);

  return summary.length > 0 ? summary.join(" ") : null;
}

function readRawPath(req: Request): string {
  return (req.originalUrl || req.url || req.path || "/").split("?", 1)[0] || "/";
}

function decodeRequestPath(rawPath: string): string | null {
  let decoded = rawPath;

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }

  return decoded.replace(/\\/g, "/");
}

function hasSensitiveFilename(filename: string): boolean {
  const lowerFilename = filename.toLowerCase();
  if (BLOCKED_SENSITIVE_FILENAMES.has(lowerFilename)) return true;
  if (lowerFilename.endsWith("config.json")) return true;
  if (BLOCKED_SENSITIVE_FILENAME_PARTS.some((part) => lowerFilename.includes(part))) return true;
  return BLOCKED_SENSITIVE_FILE_EXTENSIONS.some((extension) => lowerFilename.endsWith(extension));
}

const BLOCKED_SENSITIVE_FILENAMES = new Set([
  "config.json",
  "credentials.json",
  "id_ed25519",
  "id_rsa",
  "service-account.json",
  "service_account.json",
]);
const BLOCKED_SENSITIVE_FILENAME_PARTS = [
  "backup",
  "credentials",
  "service-account",
  "service_account",
] as const;

function isPathWithinRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function getCanonicalExistingPath(filePath: string): string | null {
  try {
    return realpathSync.native(filePath);
  } catch {
    return null;
  }
}

export function isAllowedViteDevelopmentRequestPath(rawPath: string, projectRoot: string): boolean {
  const decodedPath = decodeRequestPath(rawPath);
  if (!decodedPath || decodedPath.includes("\0") || !decodedPath.startsWith("/@fs/")) {
    return false;
  }

  const requestedPath = decodedPath.slice("/@fs/".length);
  if (!path.isAbsolute(requestedPath)) {
    return false;
  }

  const target = getCanonicalExistingPath(requestedPath);
  if (!target || hasSensitiveFilename(path.basename(target))) {
    return false;
  }

  const allowedRoots = ["client", "shared", "attached_assets", "node_modules"]
    .map((directory) => getCanonicalExistingPath(path.resolve(projectRoot, directory)))
    .filter((directory): directory is string => directory !== null);
  const allowedRoot = allowedRoots.find((root) => isPathWithinRoot(root, target));
  if (!allowedRoot) {
    return false;
  }

  const relativeSegments = path.relative(allowedRoot, target).split(path.sep).filter(Boolean);
  const allowedRootName = path.basename(allowedRoot).toLowerCase();
  return !relativeSegments.some((segment, index) => {
    if (!segment.startsWith(".")) return false;
    return !(allowedRootName === "node_modules" && index === 0 && segment === ".vite");
  });
}

export function isSensitiveOrInvalidRequestPath(rawPath: string): boolean {
  const decodedPath = decodeRequestPath(rawPath);
  if (!decodedPath || decodedPath.includes("\0")) return true;

  const segments = decodedPath.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".." || segment.startsWith("."))) {
    return true;
  }
  if (segments.some((segment) => /^[A-Za-z]:$/.test(segment))) {
    return true;
  }

  const firstSegment = (segments[0] ?? "").toLowerCase();
  if (firstSegment === "@fs") {
    return true;
  }
  if (NON_SPA_ROOTS.has(firstSegment) || /^api[._-]/.test(firstSegment)) {
    return true;
  }

  const filename = segments.at(-1) ?? "";
  return hasSensitiveFilename(filename);
}

export function shouldServeSpaNavigation(req: Request): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!String(req.get("accept") || "").toLowerCase().includes("text/html")) return false;

  const rawPath = readRawPath(req);
  if (isSensitiveOrInvalidRequestPath(rawPath)) return false;

  const decodedPath = decodeRequestPath(rawPath);
  if (!decodedPath) return false;

  const segments = decodedPath.split("/").filter(Boolean);
  const firstSegment = (segments[0] ?? "").toLowerCase();
  const lastSegment = segments.at(-1) ?? "";

  if (/^api(?:$|[._/-])/.test(firstSegment)) return false;
  if (NON_SPA_ROOTS.has(firstSegment)) return false;
  if (lastSegment.includes(".")) return false;

  return true;
}

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const incomingRequestId = req.get("x-request-id")?.trim();
  const requestId = incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
};

export function createSensitiveRequestPathGuard(
  options: SensitiveRequestPathGuardOptions = {},
): RequestHandler {
  return (req, res, next) => {
    const rawPath = readRawPath(req);
    const isAllowedVitePath = options.viteDevelopmentRoot
      ? isAllowedViteDevelopmentRequestPath(rawPath, options.viteDevelopmentRoot)
      : false;
    if (isAllowedVitePath || !isSensitiveOrInvalidRequestPath(rawPath)) {
      next();
      return;
    }

    res.status(404).json({ message: "Recurso no encontrado" });
  };
}

export const rejectSensitiveRequestPaths = createSensitiveRequestPathGuard();

export function sanitizeProductionJsonErrors(isProduction = process.env.NODE_ENV === "production"): RequestHandler {
  return (_req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      if (isProduction && res.statusCode === 500) {
        return originalJson({
          message: "Error interno del servidor",
          requestId: getResponseRequestId(res),
        });
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}

function getResponseRequestId(res: Response): string {
  const requestId = res.locals.requestId;
  return typeof requestId === "string" && requestId.length > 0 ? requestId : "unavailable";
}

function normalizeErrorStatus(error: any): number {
  if (error?.type === "entity.too.large" || error?.name === "PayloadTooLargeError") return 413;
  if (error?.type === "entity.parse.failed") return 400;

  const candidate = Number(error?.status ?? error?.statusCode);
  return Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
}

function safeErrorMessage(status: number, error: any): string {
  if (error?.type === "entity.parse.failed") return "JSON inválido";
  if (status === 413) return "Solicitud demasiado grande.";

  switch (status) {
    case 400:
      return "Solicitud inválida";
    case 401:
      return "No autenticado";
    case 403:
      return "Acceso denegado";
    case 404:
      return "Recurso no encontrado";
    case 409:
      return "Conflicto con el estado actual";
    case 429:
      return "Demasiadas solicitudes. Intenta nuevamente más tarde.";
    case 503:
      return "Servicio temporalmente no disponible";
    default:
      return "Error interno del servidor";
  }
}

function safeErrorType(error: any): string {
  const rawType = typeof error?.type === "string"
    ? error.type
    : typeof error?.name === "string"
      ? error.name
      : "Error";
  return rawType.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "Error";
}

export function createHttpErrorHandler(options: HttpErrorHandlerOptions = {}): ErrorRequestHandler {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";

  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const status = normalizeErrorStatus(error);
    const requestId = getResponseRequestId(res);
    options.onError?.({
      requestId,
      method: req.method,
      path: req.path,
      status,
      errorType: safeErrorType(error),
      error,
    });

    const safeMessage = safeErrorMessage(status, error);
    const message = !isProduction
      && error?.type !== "entity.parse.failed"
      && status !== 413
      && typeof error?.message === "string"
      && error.message.trim().length > 0
      ? error.message
      : safeMessage;

    res.status(status).json({
      message,
      ...(status >= 500 ? { requestId } : {}),
    });
  };
}

export const apiNotFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "API endpoint no encontrado" });
};

export const generalNotFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Recurso no encontrado" });
};

function clientAddress(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function normalizedBodyValue(req: Request, field: string): string {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const value = body[field];
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 512) : "(missing)";
}

function hashedIdentity(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function pruneExpiredRateLimitBuckets(buckets: Map<string, RateLimitBucket>, now: number): void {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

function earliestRateLimitReset(buckets: Map<string, RateLimitBucket>, fallback: number): number {
  let earliest = Number.POSITIVE_INFINITY;
  buckets.forEach((bucket) => {
    earliest = Math.min(earliest, bucket.resetAt);
  });
  return Number.isFinite(earliest) ? earliest : fallback;
}

function sendRateLimitResponse(
  res: Response,
  resetAt: number,
  currentTime: number,
  message?: string,
): void {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - currentTime) / 1000));
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({
    code: "RATE_LIMITED",
    message: message ?? "Demasiadas solicitudes. Intenta nuevamente más tarde.",
  });
}

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, RateLimitBucket>();
  const now = options.now ?? Date.now;
  const maxEntries = Math.max(1, options.maxEntries ?? 10_000);
  let requestsUntilPrune = 500;

  return (req, res, next) => {
    const currentTime = now();
    const key = options.keyGenerator(req);
    let bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= currentTime) {
      buckets.delete(key);
      bucket = undefined;
    }

    requestsUntilPrune -= 1;
    if (requestsUntilPrune <= 0) {
      pruneExpiredRateLimitBuckets(buckets, currentTime);
      requestsUntilPrune = 500;
    }

    if (!bucket) {
      if (buckets.size >= maxEntries) {
        pruneExpiredRateLimitBuckets(buckets, currentTime);
      }
      if (buckets.size >= maxEntries) {
        sendRateLimitResponse(
          res,
          earliestRateLimitReset(buckets, currentTime + options.windowMs),
          currentTime,
          options.message,
        );
        return;
      }

      bucket = {
        count: 0,
        resetAt: currentTime + options.windowMs,
      };
      buckets.set(key, bucket);
    }

    if (bucket.count >= options.max) {
      sendRateLimitResponse(res, bucket.resetAt, currentTime, options.message);
      return;
    }

    bucket.count += 1;
    next();
  };
}

function createIdentityRateLimit(windowMs: number, max: number, field: string): RequestHandler {
  return createRateLimitMiddleware({
    windowMs,
    max,
    keyGenerator: (req) => `${clientAddress(req)}:${hashedIdentity(normalizedBodyValue(req, field))}`,
  });
}

function createIpRateLimit(windowMs: number, max: number): RequestHandler {
  return createRateLimitMiddleware({
    windowMs,
    max,
    keyGenerator: clientAddress,
  });
}

export function registerPublicAuthRateLimits(app: Express): void {
  const limits = PUBLIC_AUTH_RATE_LIMITS;
  const signInByIp = createIpRateLimit(limits.signInIp.windowMs, limits.signInIp.max);
  const recoveryByIp = createIpRateLimit(limits.recoveryIp.windowMs, limits.recoveryIp.max);
  const registrationByIp = createIpRateLimit(limits.registrationIp.windowMs, limits.registrationIp.max);
  const login = createIdentityRateLimit(limits.loginIdentity.windowMs, limits.loginIdentity.max, "email");
  const forgotPassword = createIdentityRateLimit(
    limits.forgotPasswordIdentity.windowMs,
    limits.forgotPasswordIdentity.max,
    "email",
  );
  const resetPassword = createIdentityRateLimit(
    limits.resetPasswordToken.windowMs,
    limits.resetPasswordToken.max,
    "token",
  );
  const register = createIdentityRateLimit(
    limits.registerIdentity.windowMs,
    limits.registerIdentity.max,
    "email",
  );
  const googleLogin = createIdentityRateLimit(limits.googleToken.windowMs, limits.googleToken.max, "idToken");
  const appleLogin = createIdentityRateLimit(
    limits.appleToken.windowMs,
    limits.appleToken.max,
    "firebaseIdToken",
  );

  app.post("/api/auth/login", signInByIp, login);
  app.post("/api/auth/register", registrationByIp, register);
  app.post("/api/auth/forgot-password", recoveryByIp, forgotPassword);
  app.post("/api/auth/reset-password", recoveryByIp, resetPassword);
  app.post("/api/auth/google-mobile", signInByIp, googleLogin);
  app.post("/api/auth/apple-mobile", signInByIp, appleLogin);
}

function readinessAbortError(): Error {
  const error = new Error("Readiness check aborted");
  error.name = "AbortError";
  return error;
}

async function acquireReadinessClient(pool: ReadinessPool, signal: AbortSignal): Promise<ReadinessPoolClient> {
  if (signal.aborted) throw readinessAbortError();

  let abortedWhileWaiting = false;
  const handleAbort = () => {
    abortedWhileWaiting = true;
  };
  signal.addEventListener("abort", handleAbort, { once: true });

  try {
    const client = await pool.connect();
    if (abortedWhileWaiting || signal.aborted) {
      client.release(true);
      throw readinessAbortError();
    }
    return client;
  } finally {
    signal.removeEventListener("abort", handleAbort);
  }
}

export async function checkPostgresReadiness(pool: ReadinessPool, signal: AbortSignal): Promise<void> {
  const client = await acquireReadinessClient(pool, signal);
  let released = false;

  const releaseClient = (destroy = false) => {
    if (released) return;
    released = true;
    client.release(destroy);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", handleAbort);
        if (error) reject(error);
        else resolve();
      };
      const handleAbort = () => {
        releaseClient(true);
        finish(readinessAbortError());
      };

      signal.addEventListener("abort", handleAbort, { once: true });
      if (signal.aborted) {
        handleAbort();
        return;
      }

      void Promise.resolve()
        .then(() => client.query("SELECT 1"))
        .then(() => finish(), (error) => finish(error));
    });
  } finally {
    releaseClient();
  }
}

export function registerOperationalHealthRoutes(app: Express, options: ReadinessOptions): void {
  const timeoutMs = Math.max(1, options.timeoutMs ?? READINESS_TIMEOUT_MS);
  const successCacheMs = Math.max(0, options.successCacheMs ?? READINESS_SUCCESS_CACHE_MS);
  const failureCacheMs = Math.max(0, options.failureCacheMs ?? READINESS_FAILURE_CACHE_MS);
  const now = options.now ?? Date.now;
  let cached: { status: ReadinessStatus; expiresAt: number } | null = null;
  let activeCheck: { response: Promise<ReadinessStatus>; completion: Promise<void> } | null = null;

  const getReadinessStatus = (): Promise<ReadinessStatus> => {
    const currentTime = now();
    if (cached && cached.expiresAt > currentTime) {
      return Promise.resolve(cached.status);
    }
    if (activeCheck) {
      return activeCheck.response;
    }

    const controller = new AbortController();
    let timeout: NodeJS.Timeout | undefined;
    const checkPromise = Promise.resolve().then(() => options.checkReadiness(controller.signal));
    const completedResult = checkPromise.then<ReadinessStatus, ReadinessStatus>(
      () => "ready",
      () => "unavailable",
    );
    const timeoutResult = new Promise<ReadinessStatus>((resolve) => {
      timeout = setTimeout(() => {
        controller.abort();
        resolve("unavailable");
      }, timeoutMs);
      timeout.unref?.();
    });
    const response = Promise.race([completedResult, timeoutResult]);
    const currentCheck = {
      response,
      completion: Promise.resolve(),
    };
    currentCheck.completion = checkPromise
      .then(() => undefined, () => undefined)
      .finally(() => {
        if (timeout) clearTimeout(timeout);
        if (activeCheck === currentCheck) activeCheck = null;
      });
    activeCheck = currentCheck;

    void response.then((status) => {
      const cacheMs = status === "ready" ? successCacheMs : failureCacheMs;
      cached = { status, expiresAt: now() + cacheMs };
    });

    return response;
  };

  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ok" });
  });

  app.get("/api/ready", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const status = await getReadinessStatus();
    if (status === "ready") {
      res.status(200).json({ status: "ready" });
    } else {
      res.status(503).json({ status: "unavailable" });
    }
  });
}
