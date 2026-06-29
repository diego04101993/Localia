import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { pool } from "./db";

const PgSession = connectPgSimple(session);
export const CUSTOMER_BLOCKED_MESSAGE = "Tu cuenta ha sido bloqueada. Contacta a soporte.";
const DEFAULT_CUSTOMER_SESSION_MAX_AGE_DAYS = 365;
const DEFAULT_ADMIN_SESSION_MAX_AGE_DAYS = 30;
const MAX_ALLOWED_SESSION_DAYS = 365;
const ADMIN_ROLES = new Set(["SUPER_ADMIN", "BRANCH_ADMIN"]);

const sessionTimingConfig = {
  customerMaxAgeMs: DEFAULT_CUSTOMER_SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  adminMaxAgeMs: DEFAULT_ADMIN_SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
};

function isBlockedCustomer(user: any): boolean {
  return user?.role === "CUSTOMER" && !!user?.isBlocked;
}

export async function getBranchAdminAccessIssue(user: any): Promise<string | null> {
  if (user?.role !== "BRANCH_ADMIN") {
    return null;
  }

  const branchId = typeof user?.branchId === "string" ? user.branchId.trim() : "";
  if (!branchId) {
    return "No tienes una sucursal activa asignada";
  }

  const branch = await storage.getBranch(branchId);
  if (!branch || branch.deletedAt) {
    return "Tu sucursal ya no está disponible";
  }

  if (branch.status !== "active") {
    return "Tu sucursal no está activa";
  }

  return null;
}

function resolveSessionMaxAgeDays(): number {
  const rawValue = Number.parseInt(process.env.SESSION_MAX_AGE_DAYS || "", 10);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return DEFAULT_CUSTOMER_SESSION_MAX_AGE_DAYS;
  }
  return Math.min(rawValue, MAX_ALLOWED_SESSION_DAYS);
}

function resolveAdminSessionMaxAgeDays(customerMaxAgeDays: number): number {
  const rawValue = Number.parseInt(process.env.ADMIN_SESSION_MAX_AGE_DAYS || "", 10);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return Math.min(DEFAULT_ADMIN_SESSION_MAX_AGE_DAYS, customerMaxAgeDays);
  }
  return Math.min(Math.max(rawValue, 1), customerMaxAgeDays, MAX_ALLOWED_SESSION_DAYS);
}

function shouldLogSessionDebug(): boolean {
  return process.env.SESSION_DEBUG_LOGS === "true";
}

function authDebugLog(message: string) {
  if (!shouldLogSessionDebug()) return;
  console.log(`[AUTH] ${message}`);
}

function resolveSessionMaxAgeMsForRole(role?: string | null, impersonating = false): number {
  if (impersonating || (role && ADMIN_ROLES.has(role))) {
    return sessionTimingConfig.adminMaxAgeMs;
  }
  return sessionTimingConfig.customerMaxAgeMs;
}

export function applySessionLifetimeForRequest(req: Request, user?: { role?: string | null } | null) {
  const sess = req.session as any;
  if (!sess?.cookie) return;

  const effectiveUser = user ?? ((req.user as any) || null);
  const impersonating = !!(sess.impersonating && sess.originalUserId);
  const targetMaxAgeMs = resolveSessionMaxAgeMsForRole(effectiveUser?.role, impersonating);

  if (sess.cookie.maxAge !== targetMaxAgeMs) {
    sess.cookie.maxAge = targetMaxAgeMs;
  }
}

export function setupAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  const customerSessionMaxAgeDays = resolveSessionMaxAgeDays();
  const adminSessionMaxAgeDays = resolveAdminSessionMaxAgeDays(customerSessionMaxAgeDays);
  const customerSessionMaxAgeMs = customerSessionMaxAgeDays * 24 * 60 * 60 * 1000;
  const adminSessionMaxAgeMs = adminSessionMaxAgeDays * 24 * 60 * 60 * 1000;
  const sessionTtlSeconds = Math.floor(Math.max(customerSessionMaxAgeMs, adminSessionMaxAgeMs) / 1000);
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN?.trim();

  sessionTimingConfig.customerMaxAgeMs = customerSessionMaxAgeMs;
  sessionTimingConfig.adminMaxAgeMs = adminSessionMaxAgeMs;

  if (isProduction && !sessionSecret) {
    throw new Error("SESSION_SECRET es obligatorio en produccion");
  }

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  const sessionStore = new PgSession({
    pool: pool as any,
    tableName: "session",
    createTableIfMissing: true,
    ttl: sessionTtlSeconds,
    pruneSessionInterval: 60 * 60,
  });

  authDebugLog(
    `Session store configurado: customer=${customerSessionMaxAgeDays} dias, admin=${adminSessionMaxAgeDays} dias, rolling=true, secure=${isProduction}, sameSite=lax, domain=${cookieDomain || "(default)"}`,
  );

  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret || "box-manager-secret-key",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      proxy: isProduction,
      cookie: {
        maxAge: customerSessionMaxAgeMs,
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, _res, next) => {
    if (req.session && (req.isAuthenticated?.() || (req.session as any)?.impersonating)) {
      applySessionLifetimeForRequest(req);
    }
    next();
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) return done(null, false, { message: "Credenciales incorrectas" });
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return done(null, false, { message: "Credenciales incorrectas" });
          if (isBlockedCustomer(user)) {
            return done(null, false, { message: CUSTOMER_BLOCKED_MESSAGE });
          }
          const branchAccessIssue = await getBranchAdminAccessIssue(user);
          if (branchAccessIssue) {
            return done(null, false, { message: branchAccessIssue });
          }
          authDebugLog(`Autenticacion local exitosa para ${user.email} (${user.role})`);
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        authDebugLog(`Sesion sin usuario asociado o expirada para id=${id}`);
      }
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    authDebugLog(`Sesion no encontrada para ${req.method} ${req.path}`);
    return res.status(401).json({ message: "No autenticado" });
  }
  const user = req.user as any;
  if (isBlockedCustomer(user)) {
    return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
  }
  const branchAccessIssue = await getBranchAdminAccessIssue(user);
  if (branchAccessIssue) {
    return res.status(403).json({ message: branchAccessIssue });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      authDebugLog(`Sesion no encontrada para ${req.method} ${req.path}`);
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = req.user as any;
    if (isBlockedCustomer(user)) {
      return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
    }
    const branchAccessIssue = await getBranchAdminAccessIssue(user);
    if (branchAccessIssue) {
      return res.status(403).json({ message: branchAccessIssue });
    }
    const sess = req.session as any;
    const impersonating = !!(sess.impersonating && sess.originalUserId);

    if (impersonating) {
      if (roles.includes("SUPER_ADMIN") || roles.includes(user.role)) {
        return next();
      }
      return res.status(403).json({ message: "Acceso denegado" });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    next();
  };
}

export function isImpersonating(req: Request): boolean {
  const sess = req.session as any;
  return !!(sess.impersonating && sess.originalUserId);
}

export function getOriginalUserId(req: Request): string | null {
  const sess = req.session as any;
  return sess.originalUserId || null;
}
