const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type RuntimeDatabaseTarget = {
  host: string | null;
  databaseName: string | null;
  redactedUrl: string | null;
  isLocal: boolean;
};

function normalizeBooleanEnv(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export function getRuntimeDatabaseTarget(databaseUrl = process.env.DATABASE_URL): RuntimeDatabaseTarget {
  if (!databaseUrl) {
    return {
      host: null,
      databaseName: null,
      redactedUrl: null,
      isLocal: false,
    };
  }

  try {
    const url = new URL(databaseUrl);
    const username = url.username ? `${url.username}:***@` : "";
    const port = url.port ? `:${url.port}` : "";
    const databaseName = url.pathname.replace(/^\//, "") || null;

    return {
      host: url.hostname || null,
      databaseName,
      redactedUrl: `${url.protocol}//${username}${url.hostname}${port}${url.pathname}`,
      isLocal: LOCAL_DATABASE_HOSTS.has(url.hostname),
    };
  } catch {
    return {
      host: null,
      databaseName: null,
      redactedUrl: null,
      isLocal: false,
    };
  }
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isRemoteDatabaseAllowedInDevelopment(): boolean {
  return normalizeBooleanEnv(process.env.ALLOW_REMOTE_DATABASE_IN_DEV);
}

export function assertDevelopmentDatabaseSafety(): void {
  if (isProductionRuntime()) {
    return;
  }

  const target = getRuntimeDatabaseTarget();
  if (!target.redactedUrl) {
    throw new Error("DATABASE_URL must be set");
  }

  if (!target.isLocal && !isRemoteDatabaseAllowedInDevelopment()) {
    throw new Error(
      `REMOTE_DATABASE_BLOCKED_IN_DEVELOPMENT :: ${target.redactedUrl} :: define ALLOW_REMOTE_DATABASE_IN_DEV=true only when you intentionally want development to use a remote database`,
    );
  }
}

export function shouldRunStartupMaintenance(): boolean {
  return isProductionRuntime();
}

export function shouldRunBackgroundJobs(): boolean {
  return isProductionRuntime();
}

export function shouldRunSeedOnStartup(): boolean {
  if (isProductionRuntime()) {
    return normalizeBooleanEnv(process.env.RUN_SEED);
  }

  return normalizeBooleanEnv(process.env.RUN_SEED) && getRuntimeDatabaseTarget().isLocal;
}

export function shouldEnableSessionStoreMaintenance(): boolean {
  return isProductionRuntime();
}
