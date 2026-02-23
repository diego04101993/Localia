import type { Express } from "express";
import { type Server } from "http";
import passport from "passport";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireRole, isImpersonating, getOriginalUserId } from "./auth";
import { seedDatabase } from "./seed";
import {
  loginSchema,
  createBranchSchema,
  joinBranchSchema,
  favoriteBranchSchema,
} from "@shared/schema";
import { z } from "zod";

function generateSecurePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

const createBranchWithAdminSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  slug: z.string().min(1, "El slug es obligatorio").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  createAdmin: z.boolean().optional().default(false),
  adminEmail: z.string().email("Correo inválido").optional(),
  adminPassword: z.string().min(6).optional(),
  adminName: z.string().optional(),
  category: z.string().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos" });
    }
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user)
        return res.status(401).json({ message: info?.message || "Credenciales incorrectas" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        const { passwordHash, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Error al cerrar sesión" });
      res.json({ message: "Sesión cerrada" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = req.user as any;
    const { passwordHash, ...safeUser } = user;
    let branch = null;
    if (user.branchId) {
      branch = await storage.getBranch(user.branchId);
    }

    const sess = req.session as any;
    const impersonating = !!(sess.impersonating && sess.originalUserId);

    res.json({
      ...safeUser,
      branch: branch || null,
      impersonating,
      impersonatedBranchName: impersonating ? sess.impersonatedBranchName : null,
      originalUserId: impersonating ? sess.originalUserId : null,
    });
  });

  // --- Super Admin: Branches ---
  app.get("/api/branches", requireRole("SUPER_ADMIN"), async (req, res) => {
    const includeDeleted = req.query.include_deleted === "true";
    const allBranches = await storage.getAllBranches(includeDeleted);
    res.json(allBranches);
  });

  app.post("/api/branches", requireRole("SUPER_ADMIN"), async (req, res) => {
    const result = createBranchWithAdminSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    const existing = await storage.getBranchBySlug(result.data.slug);
    if (existing) {
      return res.status(409).json({ message: "Ese slug ya existe" });
    }

    const branch = await storage.createBranch({
      name: result.data.name,
      slug: result.data.slug,
      status: "active",
      category: result.data.category || "box",
    });

    const actor = req.user as any;

    let adminUser = null;
    let plainPassword = null;

    if (result.data.createAdmin && result.data.adminEmail) {
      const existingUser = await storage.getUserByEmail(result.data.adminEmail);
      if (existingUser) {
        await storage.updateBranchStatus(branch.id, "blacklisted");
        await storage.softDeleteBranch(branch.id);
        return res.status(409).json({ message: "Ese correo ya está registrado" });
      }

      plainPassword = result.data.adminPassword || generateSecurePassword();
      const hash = await bcrypt.hash(plainPassword, 10);

      try {
        adminUser = await storage.createUser({
          email: result.data.adminEmail,
          passwordHash: hash,
          role: "BRANCH_ADMIN",
          branchId: branch.id,
          name: result.data.adminName || `Admin ${result.data.name}`,
        });
      } catch (err) {
        await storage.softDeleteBranch(branch.id);
        return res.status(500).json({ message: "Error al crear el administrador" });
      }
    }

    await storage.createAuditLog({
      actorUserId: actor.id,
      action: "CREATE_BRANCH",
      branchId: branch.id,
      metadata: { branchName: branch.name, slug: branch.slug, adminCreated: !!adminUser },
    });

    res.status(201).json({
      branch,
      admin: adminUser
        ? {
            email: adminUser.email,
            password: plainPassword,
            name: adminUser.name,
          }
        : null,
    });
  });

  app.patch("/api/branches/:id/status", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const { status } = req.body;
    const actor = req.user as any;
    console.log(`[UPDATE_STATUS] branchId=${id}, newStatus=${status}, actor=${actor.email}`);

    if (!["active", "suspended", "blacklisted"].includes(status)) {
      console.log(`[UPDATE_STATUS] Invalid status: ${status}`);
      return res.status(400).json({ message: `Estado inválido: ${status}. Válidos: active, suspended, blacklisted` });
    }

    try {
      const oldBranch = await storage.getBranch(id);
      if (!oldBranch) {
        console.log(`[UPDATE_STATUS] Branch not found: ${id}`);
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const branch = await storage.updateBranchStatus(id, status as string);
      console.log(`[UPDATE_STATUS] Success: ${oldBranch.status} -> ${status}`);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_STATUS",
        branchId: id,
        metadata: { oldStatus: oldBranch.status, newStatus: status },
      });

      res.json(branch);
    } catch (err: any) {
      console.error(`[UPDATE_STATUS] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al actualizar estado: ${err.message || "error desconocido"}` });
    }
  });

  // Soft delete
  app.delete("/api/superadmin/branches/:id", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const branch = await storage.getBranch(id);
    if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
    const deleted = await storage.softDeleteBranch(id);

    const actor = req.user as any;
    await storage.createAuditLog({
      actorUserId: actor.id,
      action: "DELETE_BRANCH",
      branchId: id,
      metadata: { branchName: branch.name },
    });

    res.json(deleted);
  });

  // Get branch admin
  app.get("/api/superadmin/branches/:id/admin", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const admins = await storage.getBranchAdmins(id);
    if (admins.length === 0) {
      return res.json(null);
    }
    const a = admins[0];
    res.json({ id: a.id, email: a.email, name: a.name, createdAt: a.createdAt });
  });

  // Update branch admin (name/email or reassign)
  app.patch("/api/superadmin/branches/:id/admin", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const branch = await storage.getBranch(id);
    if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

    const { name, email, reassignEmail } = req.body;
    const actor = req.user as any;

    if (reassignEmail) {
      const existingUser = await storage.getUserByEmail(reassignEmail);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuario no encontrado con ese email" });
      }
      if (existingUser.role !== "BRANCH_ADMIN" && existingUser.role !== "CUSTOMER") {
        return res.status(400).json({ message: "No se puede reasignar un Super Admin" });
      }

      const currentAdmins = await storage.getBranchAdmins(id);
      for (const old of currentAdmins) {
        await storage.updateUser(old.id, {});
        await storage.updateUserBranch(old.id, "");
      }

      await storage.updateUserBranch(existingUser.id, id);
      const updated = await storage.updateUser(existingUser.id, {});
      if (updated && updated.role !== "BRANCH_ADMIN") {
        await storage.updateUser(existingUser.id, {});
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REASSIGN_ADMIN",
        branchId: id,
        metadata: { newAdminEmail: reassignEmail },
      });

      return res.json({ id: existingUser.id, email: existingUser.email, name: existingUser.name });
    }

    const admins = await storage.getBranchAdmins(id);
    if (admins.length === 0) {
      return res.status(404).json({ message: "No hay admin para esta sucursal" });
    }

    const admin = admins[0];
    const updateData: { name?: string; email?: string } = {};
    const metadataLog: any = {};

    if (name && name !== admin.name) {
      updateData.name = name;
      metadataLog.oldName = admin.name;
      metadataLog.newName = name;
    }

    if (email && email !== admin.email) {
      const existingWithEmail = await storage.getUserByEmail(email);
      if (existingWithEmail && existingWithEmail.id !== admin.id) {
        return res.status(409).json({ message: "Ese correo ya está en uso" });
      }
      updateData.email = email;
      metadataLog.oldEmail = admin.email;
      metadataLog.newEmail = email;
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ id: admin.id, email: admin.email, name: admin.name });
    }

    const updated = await storage.updateUser(admin.id, updateData);

    await storage.createAuditLog({
      actorUserId: actor.id,
      action: "UPDATE_ADMIN",
      branchId: id,
      metadata: metadataLog,
    });

    res.json({ id: updated!.id, email: updated!.email, name: updated!.name });
  });

  app.post("/api/superadmin/branches/:id/admin", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const actor = req.user as any;
    const { email, name, password, reassign } = req.body;
    console.log(`[CREATE_ADMIN] branchId=${id}, email=${email}, reassign=${!!reassign}, actor=${actor.email}`);

    try {
      const branch = await storage.getBranch(id);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(id);
      if (admins.length > 0) {
        return res.status(409).json({ message: "Ya existe un admin para esta sucursal. Usa reasignar si quieres cambiar." });
      }

      if (!email) return res.status(400).json({ message: "Email es requerido" });

      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        if (reassign) {
          if (existingUser.role === "SUPER_ADMIN") {
            return res.status(400).json({ message: "No se puede reasignar un Super Admin como admin de sucursal" });
          }
          if (existingUser.branchId && existingUser.role === "BRANCH_ADMIN") {
            const otherBranch = await storage.getBranch(existingUser.branchId);
            if (otherBranch && !otherBranch.deletedAt) {
              return res.status(409).json({ message: `Ese usuario ya es admin de "${otherBranch.name}". Primero desasígnalo de ahí.` });
            }
          }
          await storage.updateUserBranch(existingUser.id, id);
          await storage.updateUser(existingUser.id, { name: name || existingUser.name });
          if (existingUser.role !== "BRANCH_ADMIN") {
            await storage.updateUserRole(existingUser.id, "BRANCH_ADMIN");
          }

          await storage.createAuditLog({
            actorUserId: actor.id,
            action: "REASSIGN_ADMIN",
            branchId: id,
            metadata: { adminEmail: email, reassigned: true },
          });

          console.log(`[CREATE_ADMIN] Reassigned existing user ${email} as admin`);
          return res.status(200).json({
            admin: { id: existingUser.id, email: existingUser.email, name: name || existingUser.name },
            password: null,
            reassigned: true,
          });
        }

        return res.status(409).json({
          message: "Ese correo ya está registrado. ¿Deseas reasignar ese usuario como admin?",
          canReassign: existingUser.role !== "SUPER_ADMIN",
          existingUserRole: existingUser.role,
        });
      }

      const plainPassword = password || generateSecurePassword();
      const hash = await bcrypt.hash(plainPassword, 10);
      const adminUser = await storage.createUser({
        email,
        passwordHash: hash,
        role: "BRANCH_ADMIN",
        branchId: id,
        name: name || `Admin ${branch.name}`,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_ADMIN",
        branchId: id,
        metadata: { adminEmail: email },
      });

      console.log(`[CREATE_ADMIN] Created new admin ${email} for branch ${branch.name}`);
      res.status(201).json({
        admin: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
        password: plainPassword,
      });
    } catch (err: any) {
      console.error(`[CREATE_ADMIN] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al crear admin: ${err.message || "error desconocido"}` });
    }
  });

  app.post("/api/superadmin/branches/:id/reset-admin-password", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const actor = req.user as any;
    console.log(`[RESET_PASSWORD] branchId=${id}, actor=${actor.email}`);

    try {
      const branch = await storage.getBranch(id);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(id);
      if (admins.length === 0) {
        console.log(`[RESET_PASSWORD] No admin for branch ${id}`);
        return res.status(404).json({ message: "No hay administrador para esta sucursal. Primero crea o asigna un admin." });
      }

      const admin = admins[0];
      const newPassword = generateSecurePassword();
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(admin.id, hash);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "RESET_ADMIN_PASSWORD",
        branchId: id,
        metadata: { adminEmail: admin.email },
      });

      console.log(`[RESET_PASSWORD] Success for ${admin.email}`);
      res.json({
        email: admin.email,
        password: newPassword,
        name: admin.name,
      });
    } catch (err: any) {
      console.error(`[RESET_PASSWORD] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al resetear contraseña: ${err.message || "error desconocido"}` });
    }
  });

  app.get("/api/superadmin/branches/:id/welcome-package", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    try {
      const branch = await storage.getBranch(id);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(id);
      const admin = admins.length > 0 ? admins[0] : null;

      res.json({
        branchName: branch.name,
        branchSlug: branch.slug,
        adminEmail: admin?.email || null,
        adminName: admin?.name || null,
        hasAdmin: !!admin,
      });
    } catch (err: any) {
      console.error(`[WELCOME_PACKAGE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener datos del paquete" });
    }
  });

  app.get("/api/superadmin/branches/metrics", requireRole("SUPER_ADMIN"), async (_req, res) => {
    try {
      const metrics = await storage.getBranchMetrics();
      res.json(metrics);
    } catch (err: any) {
      console.error(`[METRICS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener métricas" });
    }
  });

  app.get("/api/superadmin/branches/:id/stats", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const stats = await storage.getBranchStats(req.params.id as string);
      res.json(stats);
    } catch (err: any) {
      console.error(`[BRANCH_STATS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  app.get("/api/branch/stats", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.branchId) return res.status(400).json({ message: "No hay sucursal asignada" });
    try {
      const stats = await storage.getBranchStats(user.branchId);
      res.json(stats);
    } catch (err: any) {
      console.error(`[BRANCH_STATS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  // Branch admins (list)
  app.get("/api/superadmin/branches/:id/admins", requireRole("SUPER_ADMIN"), async (req, res) => {
    const admins = await storage.getBranchAdmins(req.params.id as string);
    res.json(
      admins.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        createdAt: a.createdAt,
      }))
    );
  });

  app.post("/api/superadmin/impersonate", requireRole("SUPER_ADMIN"), async (req, res) => {
    const { branchId } = req.body;
    const actor = req.user as any;
    console.log(`[IMPERSONATE] branchId=${branchId}, actor=${actor.email}`);

    if (!branchId) return res.status(400).json({ message: "branchId requerido" });

    try {
      const branch = await storage.getBranch(branchId);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(branchId);
      if (admins.length === 0) {
        console.log(`[IMPERSONATE] No admin for branch ${branchId}`);
        return res.status(404).json({ message: "No hay admin asignado a esta sucursal. Primero crea o asigna un admin.", noAdmin: true });
      }

      const actorId = actor.id;
      const targetAdmin = admins[0];

      await new Promise<void>((resolve, reject) => {
        req.logIn(targetAdmin, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      const sess = req.session as any;
      sess.originalUserId = actorId;
      sess.impersonating = true;
      sess.impersonatedBranchName = branch.name;
      sess.impersonateExpires = Date.now() + 15 * 60 * 1000;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      await storage.createAuditLog({
        actorUserId: actorId,
        action: "IMPERSONATE_START",
        branchId,
        metadata: { branchName: branch.name, adminEmail: targetAdmin.email },
      });

      console.log(`[IMPERSONATE] Started impersonating ${targetAdmin.email} at ${branch.name}`);
      res.json({ message: "Impersonation active", branchName: branch.name });
    } catch (err: any) {
      console.error(`[IMPERSONATE] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al iniciar modo soporte: ${err.message || "error desconocido"}` });
    }
  });

  // Impersonate: end
  app.post("/api/superadmin/impersonate/end", requireAuth, async (req, res) => {
    const sess = req.session as any;
    if (!sess.impersonating || !sess.originalUserId) {
      return res.status(400).json({ message: "No hay impersonation activa" });
    }

    const originalId = sess.originalUserId;
    const branchName = sess.impersonatedBranchName;
    const originalUser = await storage.getUser(originalId);
    if (!originalUser) {
      return res.status(500).json({ message: "Error al restaurar sesión" });
    }

    delete sess.impersonating;
    delete sess.originalUserId;
    delete sess.impersonatedBranchName;
    delete sess.impersonateExpires;

    await new Promise<void>((resolve, reject) => {
      req.logIn(originalUser, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await storage.createAuditLog({
      actorUserId: originalId,
      action: "IMPERSONATE_END",
      metadata: { branchName },
    });

    res.json({ message: "Impersonation ended" });
  });

  // Audit logs
  app.get("/api/superadmin/audit", requireRole("SUPER_ADMIN"), async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await storage.getAuditLogs(limit);
    res.json(logs);
  });

  // --- Public ---
  app.get("/api/public/branch/:slug", async (req, res) => {
    const branch = await storage.getBranchBySlug(req.params.slug);
    if (!branch || branch.deletedAt) {
      return res.status(404).json({ message: "Sucursal no encontrada" });
    }
    if (branch.status !== "active") {
      return res.status(403).json({ message: "Servicio no activo" });
    }
    res.json(branch);
  });

  // --- Marketplace: Nearby / Search ---
  app.get("/api/branches/nearby", async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = req.query.radius_km ? parseFloat(req.query.radius_km as string) : 50;
    const category = (req.query.category as string) || undefined;
    const q = (req.query.q as string) || undefined;
    const results = await storage.searchBranchesNearby({ lat, lng, radiusKm, category, q });
    res.json(results);
  });

  // --- Memberships ---
  app.get("/api/memberships", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = await storage.getUserMemberships(user.id);
    res.json(result);
  });

  app.post("/api/memberships/join", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = joinBranchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos" });
    }

    let branch;
    if (result.data.branchSlug) {
      branch = await storage.getBranchBySlug(result.data.branchSlug);
    } else if (result.data.branchId) {
      branch = await storage.getBranch(result.data.branchId);
    }

    if (!branch || branch.deletedAt) {
      return res.status(404).json({ message: "Sucursal no encontrada" });
    }
    if (branch.status !== "active") {
      return res.status(403).json({ message: "Sucursal no activa" });
    }

    const existing = await storage.getMembership(user.id, branch.id);
    if (existing) {
      if (existing.status === "banned") {
        return res.status(403).json({ message: "No puedes unirte a esta sucursal" });
      }
      if (existing.status === "left") {
        const updated = await storage.updateMembership(existing.id, { status: "active", source: "self_join" });
        return res.json(updated);
      }
      return res.json(existing);
    }

    const membership = await storage.createMembership({
      userId: user.id,
      branchId: branch.id,
      status: "active",
      isFavorite: true,
      source: "self_join",
    });
    res.status(201).json(membership);
  });

  app.post("/api/memberships/favorite", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = favoriteBranchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos" });
    }

    const branch = await storage.getBranch(result.data.branchId);
    if (!branch || branch.deletedAt || branch.status !== "active") {
      return res.status(403).json({ message: "Sucursal no disponible" });
    }

    const existing = await storage.getMembership(user.id, branch.id);
    if (existing) {
      if (existing.status === "banned") {
        return res.status(403).json({ message: "No puedes interactuar con esta sucursal" });
      }
      const updated = await storage.updateMembership(existing.id, {
        isFavorite: result.data.isFavorite,
        status: existing.status === "left" ? "active" : existing.status,
      });
      return res.json(updated);
    }

    if (result.data.isFavorite) {
      const membership = await storage.createMembership({
        userId: user.id,
        branchId: branch.id,
        status: "active",
        isFavorite: true,
        source: "self_join",
      });
      return res.status(201).json(membership);
    }

    return res.json({ message: "No membership to update" });
  });

  try {
    await seedDatabase();
  } catch (e) {
    console.error("Seed error:", e);
  }

  return httpServer;
}
