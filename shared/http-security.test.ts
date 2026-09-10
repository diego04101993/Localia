import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import express, { type Express } from "express";

import {
  apiNotFoundHandler,
  checkPostgresReadiness,
  createHttpErrorHandler,
  createRateLimitMiddleware,
  createSensitiveRequestPathGuard,
  generalNotFoundHandler,
  isSensitiveOrInvalidRequestPath,
  JSON_BODY_LIMIT,
  PUBLIC_AUTH_RATE_LIMITS,
  registerOperationalHealthRoutes,
  registerPublicAuthRateLimits,
  rejectSensitiveRequestPaths,
  requestContextMiddleware,
  sanitizeProductionJsonErrors,
  summarizeJsonResponseForLog,
} from "../server/http-security";
import { serveStatic } from "../server/static";
import { setupVite } from "../server/vite";

async function withHttpServer(
  app: Express,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function withRealViteServer(
  run: (baseUrl: string, getReadinessCheckCount: () => number) => Promise<void>,
): Promise<void> {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const app = express();
  const server = createServer(app);
  let readinessCheckCount = 0;

  app.disable("x-powered-by");
  app.use(requestContextMiddleware);
  app.use(createSensitiveRequestPathGuard({ viteDevelopmentRoot: projectRoot }));
  registerOperationalHealthRoutes(app, {
    checkReadiness: async () => {
      readinessCheckCount += 1;
    },
  });
  app.use("/api", apiNotFoundHandler);

  const vite = await setupVite(server, app);
  app.use(generalNotFoundHandler);
  app.use(createHttpErrorHandler({ isProduction: false }));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run(`http://127.0.0.1:${address.port}`, () => readinessCheckCount);
  } finally {
    await vite.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function extractModuleImports(source: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /(?:from\s+|import\s*)["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]?.startsWith("/")) imports.add(match[1]);
    }
  }
  return [...imports];
}

function toViteFsPath(filePath: string): string {
  return `/@fs/${filePath.replace(/\\/g, "/")}`;
}

function createProductionTestApp(distPath: string): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(requestContextMiddleware);
  app.use(sanitizeProductionJsonErrors(true));
  app.use(rejectSensitiveRequestPaths);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
  registerPublicAuthRateLimits(app);

  app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/register", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/forgot-password", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/reset-password", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/google-mobile", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/apple-mobile", (_req, res) => res.json({ ok: true }));
  app.post("/api/echo", (req, res) => res.json(req.body));
  app.get("/api/boom", () => {
    throw new Error("SELECT secret FROM users at C:\\private\\server.ts");
  });
  app.get("/api/direct-500", (_req, res) => {
    res.status(500).json({ message: "raw database failure at C:\\private" });
  });

  app.use("/api", apiNotFoundHandler);
  serveStatic(app, { distPath });
  app.use(generalNotFoundHandler);
  app.use(createHttpErrorHandler({ isProduction: true }));
  return app;
}

function postJson(baseUrl: string, requestPath: string, body: Record<string, unknown>, ip: string): Promise<Response> {
  return fetch(`${baseUrl}${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify(body),
  });
}

function createTestDist(): string {
  const root = mkdtempSync(path.join(tmpdir(), "webcool-http-security-"));
  mkdirSync(path.join(root, "assets"));
  writeFileSync(path.join(root, "index.html"), "<!doctype html><title>WebCool test app</title>");
  writeFileSync(path.join(root, "assets", "app.js"), "globalThis.webcoolAsset = true;");
  writeFileSync(path.join(root, "manifest.webmanifest"), "{}");
  writeFileSync(path.join(root, "config.json"), "{\"secret\":true}");
  writeFileSync(path.join(root, "apiconfig.json"), "{\"secret\":true}");
  writeFileSync(path.join(root, "api-docs"), "not-public");
  writeFileSync(path.join(root, "index.php"), "not-public");
  writeFileSync(path.join(root, ".env"), "SECRET=not-public");
  writeFileSync(path.join(root, "private.key"), "not-public");
  return root;
}

test("malformed JSON returns a sanitized 400 with correlation header", async () => {
  const distPath = createTestDist();
  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 400);
      assert.equal(body.message, "JSON inválido");
      assert.match(response.headers.get("x-request-id") ?? "", /^[A-Za-z0-9._:-]+$/);
      assert.equal("stack" in body, false);
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("oversized JSON returns 413 without raising the global 100 KB limit", async () => {
  const distPath = createTestDist();
  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: "x".repeat(110_000) }),
      });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 413);
      assert.equal(body.message, "Solicitud demasiado grande.");
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("production 500 responses never expose stacks, SQL, local paths, or raw messages", async () => {
  const distPath = createTestDist();
  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      for (const endpoint of ["/api/boom", "/api/direct-500"]) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        const body = await response.json() as Record<string, unknown>;
        const serialized = JSON.stringify(body);

        assert.equal(response.status, 500);
        assert.equal(body.message, "Error interno del servidor");
        assert.equal(body.requestId, response.headers.get("x-request-id"));
        assert.doesNotMatch(serialized, /SELECT|private|server\.ts|stack|database failure/i);
      }
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("unknown API routes return JSON 404 rather than the SPA", async () => {
  const distPath = createTestDist();
  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/does-not-exist`, {
        headers: { Accept: "text/html" },
      });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 404);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(body.message, "API endpoint no encontrado");
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("scanner and sensitive paths never receive a SPA 200", async () => {
  const distPath = createTestDist();
  const paths = [
    "/api_keys.env",
    "/apiserver-etcd-client.key",
    "/.env",
    "/.git/config",
    "/config.json",
    "/private.key",
    "/apiconfig.json",
    "/api_smartapp/storage/",
    "/api-docs",
    "/swagger",
    "/actuator",
    "/index.php",
  ];

  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      for (const requestPath of paths) {
        const response = await fetch(`${baseUrl}${requestPath}`, {
          headers: { Accept: "text/html" },
        });
        assert.equal(response.status, 404, requestPath);
        assert.doesNotMatch(await response.text(), /WebCool test app/, requestPath);
      }
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("real SPA navigation and legitimate static assets remain available", async () => {
  const distPath = createTestDist();
  const spaPaths = [
    "/",
    "/dashboard",
    "/superadmin",
    "/forgot-password",
    "/reset-password?token=test",
    "/verify-email?token=test",
    "/terminos",
    "/privacidad",
    "/delete-account",
    "/explore",
    "/promotions",
    "/favorites",
    "/profile",
    "/app/test-branch",
  ];
  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      for (const spaPath of spaPaths) {
        const spaResponse = await fetch(`${baseUrl}${spaPath}`, {
          headers: { Accept: "text/html,application/xhtml+xml" },
        });
        assert.equal(spaResponse.status, 200, spaPath);
        assert.match(spaResponse.headers.get("content-type") ?? "", /text\/html/, spaPath);
        assert.match(await spaResponse.text(), /WebCool test app/, spaPath);
      }

      const assetResponse = await fetch(`${baseUrl}/assets/app.js`);
      assert.equal(assetResponse.status, 200);
      assert.match(assetResponse.headers.get("content-type") ?? "", /javascript/);
      assert.match(await assetResponse.text(), /webcoolAsset/);

      const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
      assert.equal(manifestResponse.status, 200);
      assert.deepEqual(await manifestResponse.json(), {});
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("real Vite serves the browser bootstrap graph while sensitive files stay blocked", async () => {
  const projectRoot = path.resolve(import.meta.dirname, "..");

  await withRealViteServer(async (baseUrl, getReadinessCheckCount) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(getReadinessCheckCount(), 0, "health must not reach the simulated database");

    const ready = await fetch(`${baseUrl}/api/ready`);
    assert.equal(ready.status, 200);
    assert.equal(getReadinessCheckCount(), 1);

    const pageResponse = await fetch(`${baseUrl}/`, {
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const page = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(pageResponse.headers.get("content-type") ?? "", /text\/html/);
    assert.match(page, /id=["']root["']/);

    const entryMatch = page.match(/src=["']([^"']*\/src\/main\.tsx[^"']*)["']/);
    assert.ok(entryMatch?.[1], "Vite HTML must contain the real application entry module");

    const bootstrapPaths = ["/@vite/client", "/@react-refresh", entryMatch[1]];
    const bootstrapSources = new Map<string, string>();
    for (const requestPath of bootstrapPaths) {
      const response = await fetch(`${baseUrl}${requestPath}`);
      const source = await response.text();
      assert.equal(response.status, 200, requestPath);
      assert.match(response.headers.get("content-type") ?? "", /javascript/, requestPath);
      assert.doesNotMatch(source, /Recurso no encontrado/, requestPath);
      bootstrapSources.set(requestPath, source);
    }

    const directImports = new Set<string>();
    for (const source of bootstrapSources.values()) {
      for (const requestPath of extractModuleImports(source)) directImports.add(requestPath);
    }
    assert.ok(
      [...directImports].some((requestPath) => requestPath.startsWith("/@fs/") && requestPath.includes("node_modules")),
      "the regression must exercise Vite's absolute dependency URLs",
    );
    assert.ok([...directImports].some((requestPath) => requestPath.includes("/src/App.tsx")));
    assert.ok([...directImports].some((requestPath) => requestPath.includes("/src/index.css")));

    for (const requestPath of directImports) {
      const response = await fetch(`${baseUrl}${requestPath}`);
      const source = await response.text();
      assert.equal(response.status, 200, requestPath);
      assert.match(response.headers.get("content-type") ?? "", /javascript/, requestPath);
      assert.doesNotMatch(source, /Recurso no encontrado/, requestPath);
    }

    const sensitivePaths = [
      "/.env",
      "/.git/config",
      toViteFsPath(path.resolve(projectRoot, ".env")),
      toViteFsPath(path.resolve(projectRoot, "server", "index.ts")),
      `${toViteFsPath(path.resolve(projectRoot, "client"))}/%252e%252e/server/index.ts`,
    ];
    for (const requestPath of sensitivePaths) {
      const response = await fetch(`${baseUrl}${requestPath}`, {
        headers: { Accept: "text/html" },
      });
      assert.equal(response.status, 404, requestPath);
      assert.doesNotMatch(await response.text(), /assertDevelopmentDatabaseSafety|DATABASE_URL/, requestPath);
    }
  });
});

test("request IDs are validated, echoed, and paired with low-risk security headers", async () => {
  const distPath = createTestDist();
  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/does-not-exist`, {
        headers: { "X-Request-Id": "manual-test-123" },
      });

      assert.equal(response.headers.get("x-request-id"), "manual-test-123");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
      assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
      assert.equal(response.headers.get("x-powered-by"), null);
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("login allows reasonable use, throttles abuse, and isolates another identity", async () => {
  const distPath = createTestDist();
  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      const login = (email: string) => fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "valid-test-password" }),
      });

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await login("first@example.test");
        assert.equal(response.status, 200, `attempt ${attempt + 1}`);
      }

      const blocked = await login("first@example.test");
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get("retry-after")) >= 1);

      const otherIdentity = await login("second@example.test");
      assert.equal(otherIdentity.status, 200);
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("shared IP limits cannot be bypassed with different emails or equivalent sign-in routes", async () => {
  const distPath = createTestDist();
  const sharedIp = "198.51.100.10";
  const otherIp = "198.51.100.11";
  const signInPaths = ["/api/auth/login", "/api/auth/google-mobile", "/api/auth/apple-mobile"];

  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      for (let attempt = 0; attempt < PUBLIC_AUTH_RATE_LIMITS.signInIp.max; attempt += 1) {
        const requestPath = signInPaths[attempt % signInPaths.length];
        const body = requestPath.endsWith("login")
          ? { email: `shared-${attempt}@example.test`, password: "valid-test-password" }
          : requestPath.includes("google")
            ? { idToken: `google-token-${attempt}` }
            : { firebaseIdToken: `apple-token-${attempt}` };
        const response = await postJson(baseUrl, requestPath, body, sharedIp);
        assert.equal(response.status, 200, `attempt ${attempt + 1} via ${requestPath}`);
      }

      const rotatedRoute = await postJson(
        baseUrl,
        "/api/auth/apple-mobile",
        { firebaseIdToken: "another-unvalidated-token" },
        sharedIp,
      );
      assert.equal(rotatedRoute.status, 429);
      assert.ok(Number(rotatedRoute.headers.get("retry-after")) >= 1);
      assert.equal(rotatedRoute.headers.get("cache-control"), "no-store");

      const otherIpResponse = await postJson(
        baseUrl,
        "/api/auth/login",
        { email: "legitimate@example.test", password: "valid-test-password" },
        otherIp,
      );
      assert.equal(otherIpResponse.status, 200);
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("recovery and registration IP limits survive rotated tokens and emails", async () => {
  const distPath = createTestDist();
  const sharedIp = "203.0.113.20";

  try {
    await withHttpServer(createProductionTestApp(distPath), async (baseUrl) => {
      for (let attempt = 0; attempt < PUBLIC_AUTH_RATE_LIMITS.recoveryIp.max; attempt += 1) {
        const isReset = attempt % 2 === 0;
        const response = await postJson(
          baseUrl,
          isReset ? "/api/auth/reset-password" : "/api/auth/forgot-password",
          isReset
            ? { token: `unvalidated-reset-token-${attempt}`, password: "new-password" }
            : { email: `recovery-${attempt}@example.test` },
          sharedIp,
        );
        assert.equal(response.status, 200, `recovery attempt ${attempt + 1}`);
      }

      const switchedRecoveryRoute = await postJson(
        baseUrl,
        "/api/auth/forgot-password",
        { email: "rotated-again@example.test" },
        sharedIp,
      );
      assert.equal(switchedRecoveryRoute.status, 429);

      for (let attempt = 0; attempt < PUBLIC_AUTH_RATE_LIMITS.registrationIp.max; attempt += 1) {
        const response = await postJson(
          baseUrl,
          "/api/auth/register",
          { email: `registration-${attempt}@example.test` },
          sharedIp,
        );
        assert.equal(response.status, 200, `registration attempt ${attempt + 1}`);
      }

      const rotatedRegistration = await postJson(
        baseUrl,
        "/api/auth/register",
        { email: "registration-new-identity@example.test" },
        sharedIp,
      );
      assert.equal(rotatedRegistration.status, 429);
    });
  } finally {
    rmSync(distPath, { recursive: true, force: true });
  }
});

test("rate-limit storage expires entries and never evicts active counters at capacity", async () => {
  let currentTime = 1_000;
  const app = express();
  app.get(
    "/limited",
    createRateLimitMiddleware({
      windowMs: 1_000,
      max: 1,
      maxEntries: 2,
      now: () => currentTime,
      keyGenerator: (req) => req.get("x-test-key") || "missing",
    }),
    (_req, res) => res.json({ ok: true }),
  );

  await withHttpServer(app, async (baseUrl) => {
    const request = (key: string) => fetch(`${baseUrl}/limited`, { headers: { "X-Test-Key": key } });

    assert.equal((await request("a")).status, 200);
    assert.equal((await request("b")).status, 200);
    assert.equal((await request("c")).status, 429);
    assert.equal((await request("a")).status, 429, "active counter a must not be evicted");

    currentTime += 1_001;
    assert.equal((await request("c")).status, 200, "expired entries must free bounded storage");
  });
});

test("readiness coalesces concurrent checks, caches briefly, and health never checks the database", async () => {
  let checkCount = 0;
  const app = express();
  app.use(requestContextMiddleware);
  registerOperationalHealthRoutes(app, {
    checkReadiness: async () => {
      checkCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
    timeoutMs: 200,
    successCacheMs: 1_000,
  });

  await withHttpServer(app, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.deepEqual(await health.json(), { status: "ok" });
    assert.equal(checkCount, 0);

    const responses = await Promise.all(
      Array.from({ length: 25 }, () => fetch(`${baseUrl}/api/ready`)),
    );
    assert.ok(responses.every((response) => response.status === 200));
    assert.ok(responses.every((response) => response.headers.get("cache-control") === "no-store"));
    assert.equal(checkCount, 1);

    const cached = await fetch(`${baseUrl}/api/ready`);
    assert.equal(cached.status, 200);
    assert.equal(checkCount, 1);
  });
});

test("failed readiness is sanitized, cached briefly, and recovers after expiry", async () => {
  let currentTime = 1_000;
  let shouldFail = true;
  let checkCount = 0;
  const app = express();
  app.use(requestContextMiddleware);
  registerOperationalHealthRoutes(app, {
    checkReadiness: async () => {
      checkCount += 1;
      if (shouldFail) throw new Error("postgresql://secret@private-host/database");
    },
    timeoutMs: 100,
    successCacheMs: 500,
    failureCacheMs: 100,
    now: () => currentTime,
  });

  await withHttpServer(app, async (baseUrl) => {
    const unavailable = await fetch(`${baseUrl}/api/ready`);
    const responseText = await unavailable.text();
    assert.equal(unavailable.status, 503);
    assert.deepEqual(JSON.parse(responseText), { status: "unavailable" });
    assert.doesNotMatch(responseText, /postgresql|secret|private-host|database/i);

    assert.equal((await fetch(`${baseUrl}/api/ready`)).status, 503);
    assert.equal(checkCount, 1);

    shouldFail = false;
    currentTime += 101;
    assert.equal((await fetch(`${baseUrl}/api/ready`)).status, 200);
    assert.equal(checkCount, 2);
  });
});

test("slow readiness aborts one shared operation without accumulating pending checks", async () => {
  let currentTime = 1_000;
  let mode: "slow" | "healthy" = "slow";
  let checkCount = 0;
  let activeChecks = 0;
  let maxActiveChecks = 0;
  let abortedChecks = 0;
  const app = express();
  app.use(requestContextMiddleware);
  registerOperationalHealthRoutes(app, {
    checkReadiness: async (signal) => {
      checkCount += 1;
      if (mode === "healthy") return;

      activeChecks += 1;
      maxActiveChecks = Math.max(maxActiveChecks, activeChecks);
      await new Promise<void>((_resolve, reject) => {
        const handleAbort = () => {
          activeChecks -= 1;
          abortedChecks += 1;
          reject(new Error("aborted fake database check"));
        };
        signal.addEventListener("abort", handleAbort, { once: true });
        if (signal.aborted) handleAbort();
      });
    },
    timeoutMs: 30,
    successCacheMs: 100,
    failureCacheMs: 100,
    now: () => currentTime,
  });

  await withHttpServer(app, async (baseUrl) => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => fetch(`${baseUrl}/api/ready`)),
    );
    assert.ok(responses.every((response) => response.status === 503));
    assert.equal(checkCount, 1);
    assert.equal(maxActiveChecks, 1);
    assert.equal(activeChecks, 0);
    assert.equal(abortedChecks, 1);

    mode = "healthy";
    currentTime += 101;
    assert.equal((await fetch(`${baseUrl}/api/ready`)).status, 200);
    assert.equal(checkCount, 2);
  });
});

test("PostgreSQL readiness releases healthy clients and destroys only its timed-out client", async () => {
  const normalReleases: boolean[] = [];
  let normalQueries = 0;
  await checkPostgresReadiness({
    connect: async () => ({
      query: async () => {
        normalQueries += 1;
      },
      release: (destroy = false) => normalReleases.push(destroy),
    }),
  }, new AbortController().signal);
  assert.equal(normalQueries, 1);
  assert.deepEqual(normalReleases, [false]);

  let markQueryStarted: (() => void) | undefined;
  const queryStarted = new Promise<void>((resolve) => {
    markQueryStarted = resolve;
  });
  const timedOutReleases: boolean[] = [];
  const controller = new AbortController();
  const pending = checkPostgresReadiness({
    connect: async () => ({
      query: async () => {
        markQueryStarted?.();
        await new Promise(() => undefined);
      },
      release: (destroy = false) => timedOutReleases.push(destroy),
    }),
  }, controller.signal);

  await queryStarted;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(timedOutReleases, [true]);
});

test("encoded traversal and absolute filesystem paths are rejected before static serving", () => {
  assert.equal(isSensitiveOrInvalidRequestPath("/uploads/../outside"), true);
  assert.equal(isSensitiveOrInvalidRequestPath("/uploads/%2e%2e/outside"), true);
  assert.equal(isSensitiveOrInvalidRequestPath("/uploads/%252e%252e/outside"), true);
  assert.equal(isSensitiveOrInvalidRequestPath("/C:%5Cprivate%5Cfile"), true);
});

test("HTTP log summaries never serialize successful credentials or unrelated response fields", () => {
  const sensitiveSuccess = {
    success: true,
    credentials: {
      email: "client@example.test",
      temporaryPassword: "DoNotLogThis123!",
    },
  };
  assert.equal(summarizeJsonResponseForLog(sensitiveSuccess, 200), null);

  const errorSummary = summarizeJsonResponseForLog({
    code: "SAFE_CODE",
    message: "Mensaje seguro",
    token: "secret-token",
    stack: "C:\\private\\server.ts",
  }, 400);
  assert.equal(errorSummary, 'code="SAFE_CODE" message="Mensaje seguro"');
  assert.doesNotMatch(errorSummary ?? "", /secret-token|private|server\.ts/);
});
