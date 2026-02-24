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
  createClientSchema,
  createPlanSchema,
  assignPlanSchema,
  createClassScheduleSchema,
  createBookingSchema,
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

  // --- Branch Admin: Client Management ---
  function requireBranchAdmin(req: any, res: any, next: any) {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const user = req.user as any;
    if (user.role !== "BRANCH_ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    if (!user.branchId) return res.status(400).json({ message: "No hay sucursal asignada" });
    next();
  }

  app.get("/api/branch/clients", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const clients = await storage.getBranchClients(user.branchId);
      res.json(clients);
    } catch (err: any) {
      console.error(`[BRANCH_CLIENTS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener clientes" });
    }
  });

  app.get("/api/branch/clients/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const clientId = req.params.id as string;
    try {
      const profile = await storage.getClientProfile(clientId, user.branchId);
      if (!profile) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      res.json(profile);
    } catch (err: any) {
      console.error(`[CLIENT_PROFILE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener perfil del cliente" });
    }
  });

  app.post("/api/branch/clients", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const result = createClientSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const existing = await storage.getUserByEmail(result.data.email);
      if (existing) {
        const existingMembership = await storage.getMembership(existing.id, actor.branchId);
        if (existingMembership) {
          if (existingMembership.status === "active") {
            return res.status(409).json({ message: "Este cliente ya está registrado en tu sucursal" });
          }
          await storage.updateMembership(existingMembership.id, { status: "active", source: "admin_created" });
          if (result.data.phone) await storage.updateUserPhone(existing.id, result.data.phone);
          await storage.createAuditLog({
            actorUserId: actor.id,
            action: "REACTIVATE_CLIENT",
            branchId: actor.branchId,
            metadata: { clientEmail: existing.email },
          });
          console.log(`[CREATE_CLIENT] Reactivated ${existing.email} for branch ${actor.branchId}`);
          return res.json({ message: "Cliente reactivado", userId: existing.id });
        }
        await storage.createMembership({
          userId: existing.id,
          branchId: actor.branchId,
          status: "active",
          isFavorite: false,
          source: "admin_created",
        });
        if (result.data.phone) await storage.updateUserPhone(existing.id, result.data.phone);
        await storage.createAuditLog({
          actorUserId: actor.id,
          action: "ADD_EXISTING_CLIENT",
          branchId: actor.branchId,
          metadata: { clientEmail: existing.email },
        });
        console.log(`[CREATE_CLIENT] Added existing user ${existing.email} to branch ${actor.branchId}`);
        return res.json({ message: "Cliente agregado", userId: existing.id });
      }

      const plainPassword = result.data.password || generateSecurePassword(12);
      const hash = await bcrypt.hash(plainPassword, 10);

      const newUser = await storage.createUser({
        email: result.data.email,
        passwordHash: hash,
        role: "CUSTOMER",
        name: result.data.name,
        phone: result.data.phone || null,
      });

      await storage.createMembership({
        userId: newUser.id,
        branchId: actor.branchId,
        status: "active",
        isFavorite: false,
        source: "admin_created",
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_CLIENT",
        branchId: actor.branchId,
        metadata: { clientEmail: newUser.email, clientName: newUser.name },
      });

      console.log(`[CREATE_CLIENT] Created new client ${newUser.email} for branch ${actor.branchId}`);
      res.status(201).json({
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        password: plainPassword,
      });
    } catch (err: any) {
      console.error(`[CREATE_CLIENT] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al crear cliente: ${err.message || "error desconocido"}` });
    }
  });

  app.post("/api/branch/clients/:id/notes", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ message: "El contenido de la nota es obligatorio" });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      const note = await storage.createClientNote({
        branchId: actor.branchId,
        userId: clientId,
        content: content.trim(),
        createdBy: actor.id,
      });

      console.log(`[CLIENT_NOTE] Added note for client ${clientId} by ${actor.email}`);
      res.status(201).json(note);
    } catch (err: any) {
      console.error(`[CLIENT_NOTE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al crear nota" });
    }
  });

  app.post("/api/branch/clients/:id/attendance", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      if (membership.status !== "active") {
        return res.status(400).json({ message: "El cliente no tiene una membresía activa" });
      }

      const attendance = await storage.createAttendance({
        branchId: actor.branchId,
        userId: clientId,
        registeredBy: actor.id,
      });

      if (membership.classesRemaining !== null && membership.classesRemaining > 0) {
        await storage.decrementClassesRemaining(membership.id);
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REGISTER_ATTENDANCE",
        branchId: actor.branchId,
        metadata: { clientId },
      });

      console.log(`[ATTENDANCE] Registered for client ${clientId} by ${actor.email}`);
      res.status(201).json(attendance);
    } catch (err: any) {
      console.error(`[ATTENDANCE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al registrar asistencia" });
    }
  });

  app.get("/api/branch/invite-link", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranch(user.branchId);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost:5000";
      const inviteUrl = `${protocol}://${host}/app/${branch.slug}`;
      res.json({ inviteUrl, slug: branch.slug });
    } catch (err: any) {
      console.error(`[INVITE_LINK] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al generar link de invitación" });
    }
  });

  // --- Membership Plans ---
  app.get("/api/branch/plans", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const plans = await storage.getBranchPlans(user.branchId);
      res.json(plans);
    } catch (err: any) {
      console.error(`[PLANS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener planes" });
    }
  });

  app.post("/api/branch/plans", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const data = createPlanSchema.parse(req.body);
      const plan = await storage.createPlan({
        branchId: actor.branchId,
        name: data.name,
        description: data.description || null,
        price: data.price,
        durationDays: data.durationDays ?? null,
        classLimit: data.classLimit ?? null,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_PLAN",
        branchId: actor.branchId,
        metadata: { planId: plan.id, name: plan.name },
      });

      console.log(`[PLAN] Created "${plan.name}" by ${actor.email}`);
      res.status(201).json(plan);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PLAN] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear plan" });
    }
  });

  app.patch("/api/branch/plans/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const planId = req.params.id as string;
    try {
      const existing = await storage.getPlan(planId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }

      const updatePlanSchema = createPlanSchema.partial().extend({ isActive: z.boolean().optional() });
      const data = updatePlanSchema.parse(req.body);
      const updated = await storage.updatePlan(planId, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.durationDays !== undefined && { durationDays: data.durationDays ?? null }),
        ...(data.classLimit !== undefined && { classLimit: data.classLimit ?? null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_PLAN",
        branchId: actor.branchId,
        metadata: { planId, changes: data },
      });

      console.log(`[PLAN] Updated "${planId}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PLAN] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar plan" });
    }
  });

  app.delete("/api/branch/plans/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const planId = req.params.id as string;
    try {
      const existing = await storage.getPlan(planId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }

      const plan = await storage.deactivatePlan(planId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DEACTIVATE_PLAN",
        branchId: actor.branchId,
        metadata: { planId, name: existing.name },
      });

      console.log(`[PLAN] Deactivated "${existing.name}" by ${actor.email}`);
      res.json(plan);
    } catch (err: any) {
      console.error(`[PLAN] Error deactivating:`, err.stack || err);
      res.status(500).json({ message: "Error al desactivar plan" });
    }
  });

  app.post("/api/branch/memberships/:id/assign-plan", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const membershipId = req.params.id as string;
    try {
      const { planId } = assignPlanSchema.parse(req.body);

      const plan = await storage.getPlan(planId);
      if (!plan || plan.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }
      if (!plan.isActive) {
        return res.status(400).json({ message: "Este plan está desactivado" });
      }

      const classesRemaining = plan.classLimit ?? null;
      let expiresAt: Date | null = null;
      if (plan.durationDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
      }

      const membership = await storage.assignPlanToMembership(membershipId, planId, classesRemaining, expiresAt);
      if (!membership) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "ASSIGN_PLAN",
        branchId: actor.branchId,
        metadata: { membershipId, planId, planName: plan.name },
      });

      console.log(`[PLAN] Assigned "${plan.name}" to membership ${membershipId} by ${actor.email}`);
      res.json(membership);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PLAN] Error assigning:`, err.stack || err);
      res.status(500).json({ message: "Error al asignar plan" });
    }
  });

  app.delete("/api/branch/memberships/:id/plan", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const membershipId = req.params.id as string;
    try {
      const membership = await storage.removePlanFromMembership(membershipId);
      if (!membership) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REMOVE_PLAN",
        branchId: actor.branchId,
        metadata: { membershipId },
      });

      console.log(`[PLAN] Removed plan from membership ${membershipId} by ${actor.email}`);
      res.json(membership);
    } catch (err: any) {
      console.error(`[PLAN] Error removing:`, err.stack || err);
      res.status(500).json({ message: "Error al quitar plan" });
    }
  });

  // --- Branch Stats (updated with reservations) ---
  app.get("/api/branch/reservations/stats", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const todayCount = await storage.getTodayBookingsCount(actor.branchId);
      const nextBooking = await storage.getNextBooking(actor.branchId);
      res.json({ todayCount, nextBooking });
    } catch (err: any) {
      console.error(`[RESERVATIONS] Error getting stats:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  // --- Class Schedules ---
  app.get("/api/branch/classes", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const schedules = await storage.getBranchClassSchedules(actor.branchId);
      res.json(schedules);
    } catch (err: any) {
      console.error(`[CLASSES] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al listar clases" });
    }
  });

  app.post("/api/branch/classes", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const data = createClassScheduleSchema.parse(req.body);
      const schedule = await storage.createClassSchedule({
        ...data,
        branchId: actor.branchId,
        description: data.description || null,
        instructorName: data.instructorName || null,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_CLASS",
        branchId: actor.branchId,
        metadata: { classId: schedule.id, name: schedule.name },
      });

      console.log(`[CLASSES] Created "${schedule.name}" by ${actor.email}`);
      res.status(201).json(schedule);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[CLASSES] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear clase" });
    }
  });

  app.patch("/api/branch/classes/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classId = req.params.id as string;
    try {
      const existing = await storage.getClassSchedule(classId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const updateSchema = createClassScheduleSchema.partial().extend({ isActive: z.boolean().optional() });
      const data = updateSchema.parse(req.body);
      const updated = await storage.updateClassSchedule(classId, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.instructorName !== undefined && { instructorName: data.instructorName || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLASS",
        branchId: actor.branchId,
        metadata: { classId, changes: data },
      });

      console.log(`[CLASSES] Updated "${updated?.name}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[CLASSES] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar clase" });
    }
  });

  app.delete("/api/branch/classes/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classId = req.params.id as string;
    try {
      const existing = await storage.getClassSchedule(classId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const updated = await storage.updateClassSchedule(classId, { isActive: false });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DEACTIVATE_CLASS",
        branchId: actor.branchId,
        metadata: { classId, name: existing.name },
      });

      console.log(`[CLASSES] Deactivated "${existing.name}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[CLASSES] Error deactivating:`, err.stack || err);
      res.status(500).json({ message: "Error al desactivar clase" });
    }
  });

  // --- Bookings ---
  app.get("/api/branch/bookings", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    try {
      const bookings = await storage.getBookingsForDate(actor.branchId, date);
      res.json(bookings);
    } catch (err: any) {
      console.error(`[BOOKINGS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al listar reservas" });
    }
  });

  app.get("/api/branch/bookings/class/:classId", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classScheduleId = req.params.classId as string;
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    try {
      const schedule = await storage.getClassSchedule(classScheduleId);
      if (!schedule || schedule.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }
      const bookings = await storage.getBookingsForClassOnDate(classScheduleId, date);
      res.json({ schedule, bookings, capacity: schedule.capacity, booked: bookings.filter(b => b.status !== "cancelled").length });
    } catch (err: any) {
      console.error(`[BOOKINGS] Error listing class bookings:`, err.stack || err);
      res.status(500).json({ message: "Error al listar reservas de clase" });
    }
  });

  app.post("/api/branch/bookings", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const data = createBookingSchema.parse(req.body);
      const schedule = await storage.getClassSchedule(data.classScheduleId);
      if (!schedule || schedule.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const userMembership = await storage.getMembership(data.userId, actor.branchId);
      if (!userMembership || userMembership.status !== "active") {
        return res.status(400).json({ message: "El cliente no pertenece a esta sucursal o no tiene membresía activa" });
      }

      const existingBookings = await storage.getBookingsForClassOnDate(data.classScheduleId, data.bookingDate);
      const activeBookings = existingBookings.filter(b => b.status !== "cancelled");
      if (activeBookings.length >= schedule.capacity) {
        return res.status(400).json({ message: "Clase llena, no hay lugares disponibles" });
      }

      const alreadyBooked = activeBookings.find(b => b.userId === data.userId);
      if (alreadyBooked) {
        return res.status(400).json({ message: "El cliente ya tiene reserva en esta clase" });
      }

      const booking = await storage.createBooking({
        classScheduleId: data.classScheduleId,
        branchId: actor.branchId,
        userId: data.userId,
        bookingDate: data.bookingDate,
        status: "confirmed",
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_BOOKING",
        branchId: actor.branchId,
        metadata: { bookingId: booking.id, classId: data.classScheduleId, userId: data.userId, date: data.bookingDate },
      });

      console.log(`[BOOKINGS] Created booking for user ${data.userId} in class ${schedule.name} on ${data.bookingDate} by ${actor.email}`);
      res.status(201).json(booking);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[BOOKINGS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear reserva" });
    }
  });

  app.patch("/api/branch/bookings/:id/status", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const bookingId = req.params.id as string;
    try {
      const { status } = z.object({ status: z.enum(["confirmed", "cancelled", "attended"]) }).parse(req.body);
      const existing = await storage.getBooking(bookingId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Reserva no encontrada" });
      }

      const updated = await storage.updateBookingStatus(bookingId, status);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_BOOKING_STATUS",
        branchId: actor.branchId,
        metadata: { bookingId, oldStatus: existing.status, newStatus: status },
      });

      console.log(`[BOOKINGS] Updated booking ${bookingId} status to ${status} by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[BOOKINGS] Error updating status:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar reserva" });
    }
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
