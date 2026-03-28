import type { Express } from "express";
import { type Server } from "http";
import passport from "passport";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireRole, isImpersonating, getOriginalUserId } from "./auth";
import { seedDatabase } from "./seed";
import {
  loginSchema,
  createBranchSchema,
  joinBranchSchema,
  favoriteBranchSchema,
  createClientSchema,
  updateClientSchema,
  createPlanSchema,
  assignPlanSchema,
  createClassScheduleSchema,
  createBookingSchema,
} from "@shared/schema";
import { z } from "zod";

const DEFAULT_CANCEL_CUTOFF_MINUTES = 180;

function addCalendarMonths(from: Date, months: number): Date {
  if (months === 0) {
    const result = new Date(from);
    result.setDate(result.getDate() + 1);
    return result;
  }
  const result = new Date(from);
  const dayOfMonth = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== dayOfMonth) {
    result.setDate(0);
  }
  return result;
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const ext = path.extname(file.originalname).toLowerCase() || `.${file.mimetype.split("/")[1]}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Permitidos: jpg, png, webp, mp4, webm`));
    }
  },
});

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

  const express = (await import("express")).default;
  app.use("/uploads", express.static(uploadsDir));

  app.post("/api/branch/upload", requireAuth, (req, res, next) => {
    const user = req.user as any;
    if (user.role !== "BRANCH_ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    if (!user.branchId) {
      return res.status(400).json({ message: "No hay sucursal asignada" });
    }
    next();
  }, (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "El archivo excede el tamaño máximo de 10MB" });
          }
          return res.status(400).json({ message: `Error de archivo: ${err.message}` });
        }
        return res.status(400).json({ message: err.message || "Error al subir archivo" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }
      const url = `/uploads/${req.file.filename}`;
      console.log(`[UPLOAD] File uploaded: ${url} by ${(req.user as any).email}`);
      res.json({ url });
    });
  });

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

  app.patch("/api/user/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;
    try {
      const { name, lastName, phone } = req.body;
      if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
        return res.status(400).json({ message: "Nombre inválido" });
      }
      const updated = await storage.updateUser(actor.id, {
        name: name?.trim(),
        lastName: lastName?.trim() ?? undefined,
        phone: phone?.trim() ?? undefined,
      });
      const { passwordHash, ...safeUser } = updated as any;
      res.json(safeUser);
    } catch (err: any) {
      console.error("[PATCH /api/user/me]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar perfil" });
    }
  });

  app.post("/api/user/me/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Se requiere contraseña actual y nueva" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });
    }
    try {
      const user = await storage.getUser(actor.id);
      if (!user?.passwordHash) return res.status(400).json({ message: "Error de autenticación" });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Contraseña actual incorrecta" });
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(actor.id, hash);
      res.json({ message: "Contraseña actualizada" });
    } catch (err: any) {
      console.error("[CHANGE-PASSWORD]", err.stack || err);
      res.status(500).json({ message: "Error al cambiar contraseña" });
    }
  });

  app.patch("/api/user/me/email", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;
    const { currentPassword, newEmail } = req.body;
    if (!currentPassword || !newEmail) {
      return res.status(400).json({ message: "Se requiere contraseña y nuevo correo" });
    }
    if (typeof newEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ message: "Correo inválido" });
    }
    try {
      const user = await storage.getUser(actor.id);
      if (!user?.passwordHash) return res.status(400).json({ message: "Error de autenticación" });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Contraseña incorrecta" });
      const existing = await storage.getUserByEmail(newEmail.toLowerCase().trim());
      if (existing && existing.id !== actor.id) {
        return res.status(400).json({ message: "Ese correo ya está en uso" });
      }
      const updated = await storage.updateUser(actor.id, { email: newEmail.toLowerCase().trim() });
      const { passwordHash, ...safeUser } = updated as any;
      res.json(safeUser);
    } catch (err: any) {
      console.error("[CHANGE-EMAIL]", err.stack || err);
      res.status(500).json({ message: "Error al cambiar correo" });
    }
  });

  app.post("/api/user/me/avatar", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;

    upload.single("file")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "El archivo excede el tamaño máximo de 10MB" });
        }
        return res.status(400).json({ message: err.message || "Error al subir archivo" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }

      try {
        const existingUser = await storage.getUser(actor.id);
        if (existingUser?.avatarUrl) {
          const oldPath = path.join(process.cwd(), existingUser.avatarUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        await storage.updateClient(actor.id, { avatarUrl });

        console.log(`[AVATAR] Self-upload for user ${actor.id} (${actor.email})`);
        res.json({ avatarUrl });
      } catch (err: any) {
        console.error(`[AVATAR] Self-upload error:`, err.stack || err);
        res.status(500).json({ message: "Error al subir foto de perfil" });
      }
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

  app.get("/api/branch/alerts", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (user.role !== "BRANCH_ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    if (!user.branchId) return res.status(400).json({ message: "No hay sucursal asignada" });
    try {
      await storage.reconcilePastBookings(user.branchId);
      const daysAhead = parseInt(req.query.daysAhead as string) || 3;
      const daysSince = parseInt(req.query.daysSince as string) || 30;
      const [expiringMemberships, expiredMemberships, inactiveClients, clientsWithoutClasses, upcomingBirthdays] = await Promise.all([
        storage.getExpiringMemberships(user.branchId, daysAhead),
        storage.getExpiredMemberships(user.branchId),
        storage.getInactiveClients(user.branchId, daysSince),
        storage.getClientsWithoutClasses(user.branchId),
        storage.getUpcomingBirthdays(user.branchId, 7),
      ]);
      res.json({ expiringMemberships, expiredMemberships, inactiveClients, clientsWithoutClasses, upcomingBirthdays });
    } catch (err: any) {
      console.error(`[BRANCH_ALERTS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener alertas" });
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
      await storage.reconcilePastBookings(user.branchId);
      const includeLeft = req.query.include_left === "true";
      const clients = await storage.getBranchClients(user.branchId, includeLeft);
      res.json(clients);
    } catch (err: any) {
      console.error(`[BRANCH_CLIENTS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener clientes" });
    }
  });

  app.get("/api/branch/clients/export", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const clients = await storage.getBranchClients(user.branchId);
      const header = "nombre,apellido,email,telefono,genero,fechaNacimiento,status,ingreso,ultimaVisita,plan,clasesRestantes";
      const escCsv = (val: string | null | undefined) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const rows = clients.map((c: any) => [
        escCsv(c.name),
        escCsv(c.lastName),
        escCsv(c.email),
        escCsv(c.phone),
        escCsv(c.gender),
        escCsv(c.birthDate),
        escCsv(c.membershipStatus),
        escCsv(c.joinedAt ? new Date(c.joinedAt).toISOString().split("T")[0] : null),
        escCsv(c.lastSeenAt ? new Date(c.lastSeenAt).toISOString().split("T")[0] : null),
        escCsv(c.planName),
        c.classesRemaining !== null && c.classesRemaining !== undefined ? String(c.classesRemaining) : "",
      ].join(","));
      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=clientes.csv");
      res.send(csv);
    } catch (err: any) {
      console.error(`[EXPORT_CSV] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al exportar clientes" });
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

      if (result.data.lastName || result.data.birthDate || result.data.gender || result.data.emergencyContactName || result.data.emergencyContactPhone || result.data.medicalNotes) {
        await storage.updateClient(newUser.id, {
          lastName: result.data.lastName || null,
          birthDate: result.data.birthDate || null,
          gender: result.data.gender || null,
          emergencyContactName: result.data.emergencyContactName || null,
          emergencyContactPhone: result.data.emergencyContactPhone || null,
          medicalNotes: result.data.medicalNotes || null,
        });
      }

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

  app.patch("/api/branch/clients/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const result = updateClientSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      if (result.data.email) {
        const existing = await storage.getUserByEmail(result.data.email);
        if (existing && existing.id !== clientId) {
          return res.status(409).json({ message: "Ese email ya está registrado por otro usuario" });
        }
      }

      const updated = await storage.updateClient(clientId, result.data);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLIENT",
        branchId: actor.branchId,
        metadata: { clientId, fields: Object.keys(result.data) },
      });

      console.log(`[UPDATE_CLIENT] Updated client ${clientId} by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[UPDATE_CLIENT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar cliente" });
    }
  });

  app.delete("/api/branch/clients/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      if (membership.status === "left") {
        return res.status(400).json({ message: "El cliente ya fue eliminado" });
      }

      await storage.softDeleteMembership(membership.id);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "SOFT_DELETE_CLIENT",
        branchId: actor.branchId,
        metadata: { clientId, membershipId: membership.id },
      });

      console.log(`[DELETE_CLIENT] Soft deleted client ${clientId} by ${actor.email}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[DELETE_CLIENT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar cliente" });
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
      if (membership.clientStatus === "frozen") {
        return res.status(400).json({ message: "El cliente está congelado. No se puede registrar asistencia." });
      }
      if (membership.expiresAt && new Date(membership.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Plan vencido. Renueva para registrar asistencia." });
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

  app.post("/api/branch/clients/:id/avatar", requireBranchAdmin, (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    upload.single("file")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "El archivo excede el tamaño máximo de 10MB" });
        }
        return res.status(400).json({ message: err.message || "Error al subir archivo" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }

      try {
        const membership = await storage.getMembership(clientId, actor.branchId);
        if (!membership) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
        }

        const existingUser = await storage.getUser(clientId);
        if (existingUser?.avatarUrl) {
          const oldPath = path.join(process.cwd(), existingUser.avatarUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        await storage.updateClient(clientId, { avatarUrl });

        console.log(`[AVATAR] Uploaded for client ${clientId} by ${actor.email}`);
        res.json({ avatarUrl });
      } catch (err: any) {
        console.error(`[AVATAR] Error:`, err.stack || err);
        res.status(500).json({ message: "Error al subir avatar" });
      }
    });
  });

  app.delete("/api/branch/clients/:id/avatar", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      const existingUser = await storage.getUser(clientId);
      if (existingUser?.avatarUrl) {
        const oldPath = path.join(process.cwd(), existingUser.avatarUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      await storage.updateClient(clientId, { avatarUrl: null });

      console.log(`[AVATAR] Removed for client ${clientId} by ${actor.email}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[AVATAR] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar avatar" });
    }
  });

  app.patch("/api/branch/clients/:id/status", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const { clientStatus } = req.body;

    if (!clientStatus || !["active", "inactive", "frozen"].includes(clientStatus)) {
      return res.status(400).json({ message: "Status inválido. Usa: active, inactive, frozen" });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      await storage.updateClientStatus(membership.id, clientStatus);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLIENT_STATUS",
        branchId: actor.branchId,
        metadata: { clientId, clientStatus },
      });

      console.log(`[CLIENT_STATUS] ${clientId} → ${clientStatus} by ${actor.email}`);
      res.json({ success: true, clientStatus });
    } catch (err: any) {
      console.error(`[CLIENT_STATUS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar status" });
    }
  });

  app.patch("/api/branch/clients/:id/debt", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const { hasDebt, debtAmount } = req.body;

    if (typeof hasDebt !== "boolean") {
      return res.status(400).json({ message: "hasDebt debe ser boolean" });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      const amount = hasDebt ? Math.max(0, Math.round(Number(debtAmount) || 0)) : 0;
      await storage.updateClientDebt(membership.id, hasDebt, amount);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLIENT_DEBT",
        branchId: actor.branchId,
        metadata: { clientId, hasDebt, debtAmount: amount },
      });

      console.log(`[CLIENT_DEBT] ${clientId} hasDebt=${hasDebt} amount=${amount} by ${actor.email}`);
      res.json({ success: true, hasDebt, debtAmount: amount });
    } catch (err: any) {
      console.error(`[CLIENT_DEBT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar adeudo" });
    }
  });

  app.post("/api/branch/clients/:id/reset-password", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      const client = await storage.getUser(clientId);
      if (!client) return res.status(404).json({ message: "Usuario no encontrado" });

      const newPassword = generateSecurePassword(12);
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(clientId, hash);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "RESET_CLIENT_PASSWORD",
        branchId: actor.branchId,
        metadata: { clientId, clientEmail: client.email },
      });

      console.log(`[RESET_CLIENT_PASSWORD] Reset password for ${client.email} by ${actor.email}`);
      res.json({ email: client.email, password: newPassword });
    } catch (err: any) {
      console.error(`[RESET_CLIENT_PASSWORD] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al resetear contraseña" });
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
      const cm = data.cycleMonths ?? 1;
      const plan = await storage.createPlan({
        branchId: actor.branchId,
        name: data.name,
        description: data.description || null,
        price: data.price,
        durationDays: cm === 0 ? 1 : cm * 30,
        classLimit: data.classLimit ?? null,
        cycleMonths: cm,
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
        ...(data.cycleMonths !== undefined && { cycleMonths: data.cycleMonths, durationDays: data.cycleMonths === 0 ? 1 : (data.cycleMonths ?? 1) * 30 }),
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
      const detached = await storage.detachPlanFromMemberships(planId, existing.name);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DEACTIVATE_PLAN",
        branchId: actor.branchId,
        metadata: { planId, name: existing.name, detachedClients: detached },
      });

      console.log(`[PLAN] Deactivated "${existing.name}" by ${actor.email}, detached ${detached} client(s)`);
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
      const classesTotal = plan.classLimit ?? null;
      const expiresAt = addCalendarMonths(new Date(), plan.cycleMonths || 1);

      const membership = await storage.assignPlanToMembership(membershipId, planId, classesRemaining, classesTotal, expiresAt);
      if (!membership) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      const cancelled = await storage.cancelFutureBookingsForUser(membership.userId, actor.branchId);
      if (cancelled > 0) {
        console.log(`[PLAN] Cancelled ${cancelled} future bookings for user ${membership.userId} on plan assignment`);
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "ASSIGN_PLAN",
        branchId: actor.branchId,
        metadata: { membershipId, planId, planName: plan.name, cancelledBookings: cancelled },
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

      const cancelled = await storage.cancelFutureBookingsForUser(membership.userId, actor.branchId);
      if (cancelled > 0) {
        console.log(`[PLAN] Cancelled ${cancelled} future bookings for user ${membership.userId} on plan removal`);
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REMOVE_PLAN",
        branchId: actor.branchId,
        metadata: { membershipId, cancelledBookings: cancelled },
      });

      console.log(`[PLAN] Removed plan from membership ${membershipId} by ${actor.email}`);
      res.json(membership);
    } catch (err: any) {
      console.error(`[PLAN] Error removing:`, err.stack || err);
      res.status(500).json({ message: "Error al quitar plan" });
    }
  });

  app.post("/api/branch/memberships/:id/renew", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const membershipId = req.params.id as string;
    try {
      const targetMembership = await storage.getMembershipById(membershipId);
      if (!targetMembership || targetMembership.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      if (!targetMembership.planId) {
        return res.status(400).json({ message: "No hay plan asignado para renovar" });
      }

      const plan = await storage.getPlan(targetMembership.planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }

      const now = new Date();
      const expiresAt = addCalendarMonths(now, plan.cycleMonths || 1);

      const classesRemaining = plan.classLimit ?? null;
      const classesTotal = plan.classLimit ?? null;

      const renewed = await storage.renewMembership(
        targetMembership.id, plan.id, classesRemaining, classesTotal, expiresAt, now
      );

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "RENEW_MEMBERSHIP",
        branchId: actor.branchId,
        metadata: { membershipId: targetMembership.id, planId: plan.id, planName: plan.name, paidAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
      });

      console.log(`[RENEW] Renewed "${plan.name}" for membership ${targetMembership.id} by ${actor.email}`);
      res.json(renewed);
    } catch (err: any) {
      console.error(`[RENEW] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al renovar membresía" });
    }
  });

  app.get("/api/branch/plans/:id/assignments", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const planId = req.params.id as string;
    try {
      const plan = await storage.getPlan(planId);
      if (!plan || plan.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }
      const count = await storage.getMembershipsAssignedToPlan(planId);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: "Error" });
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

  // --- Copy Week Schedule ---
  app.post("/api/branch/classes/copy-week", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const copySchema = z.object({
        fromDay: z.number().int().min(0).max(6),
        toDay: z.number().int().min(0).max(6),
      });
      const data = copySchema.parse(req.body);

      if (data.fromDay === data.toDay) {
        return res.status(400).json({ message: "El día origen y destino no pueden ser iguales" });
      }

      const created = await storage.copyClassSchedules(actor.branchId, data.fromDay, data.toDay);

      if (created.length === 0) {
        return res.json({ message: "No hay clases nuevas para copiar (ya existen o no hay clases en el día origen)", copied: 0 });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "COPY_WEEK_SCHEDULE",
        branchId: actor.branchId,
        metadata: { fromDay: data.fromDay, toDay: data.toDay, copiedCount: created.length },
      });

      console.log(`[CLASSES] Copied ${created.length} schedules from day ${data.fromDay} to ${data.toDay} by ${actor.email}`);
      res.json({ message: `Se copiaron ${created.length} clases`, copied: created.length, classes: created });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[CLASSES] Error copying week:`, err.stack || err);
      res.status(500).json({ message: "Error al copiar horario" });
    }
  });

  // --- Bookings ---
  app.get("/api/branch/bookings", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const date = (req.query.date as string) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    try {
      const reconciled = await storage.reconcilePastBookings(actor.branchId);
      if (reconciled > 0) {
        console.log(`[RECONCILE] Marked ${reconciled} no-show bookings for branch ${actor.branchId}`);
      }
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
    const date = (req.query.date as string) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
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
      if (userMembership.clientStatus === "inactive") {
        return res.status(400).json({ message: "El cliente está inactivo. No se puede reservar." });
      }
      if (userMembership.clientStatus === "frozen") {
        return res.status(400).json({ message: "El cliente está congelado. No se puede reservar." });
      }
      if (userMembership.expiresAt && new Date(userMembership.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Plan vencido. Renueva para reservar." });
      }
      if (userMembership.classesRemaining !== null && userMembership.classesRemaining <= 0) {
        return res.status(400).json({ message: "Sin clases disponibles. Renueva para reservar." });
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
        source: "dashboard",
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
      const { status } = z.object({ status: z.enum(["confirmed", "cancelled", "attended", "no_show"]) }).parse(req.body);
      const existing = await storage.getBooking(bookingId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Reserva no encontrada" });
      }

      const alreadyProcessed = existing.status === "attended" || existing.status === "no_show";

      // Rule 1: Block "attended" if plan is expired
      if (status === "attended" && !alreadyProcessed) {
        const mem = await storage.getMembershipByUserAndBranch(existing.userId, actor.branchId);
        if (mem && mem.expiresAt && new Date(mem.expiresAt) < new Date()) {
          return res.status(400).json({ message: "Plan vencido. Renueva la membresía antes de marcar asistencia." });
        }
      }

      let lateCancellation = false;
      if (status === "cancelled" && existing.status === "confirmed") {
        // Rule 3: Cancellation cutoff — late cancel deducts like no_show
        const schedule = await storage.getClassSchedule(existing.classScheduleId);
        const branch = await storage.getBranch(actor.branchId);
        if (schedule && branch) {
          const cutoff = (branch as any).cancelCutoffMinutes ?? DEFAULT_CANCEL_CUTOFF_MINUTES;
          const bookingDateStr = existing.bookingDate;
          const classStart = new Date(`${bookingDateStr}T${schedule.startTime}:00`);
          const now = new Date();
          const diffMin = (classStart.getTime() - now.getTime()) / 60000;
          if (diffMin < cutoff) {
            lateCancellation = true;
          }
        }
      }

      const updated = await storage.updateBookingStatus(bookingId, status);

      if (lateCancellation) {
        await storage.markBookingLateCancellation(bookingId);
      }

      if (status === "attended" && !alreadyProcessed) {
        try {
          await storage.createAttendance({
            userId: existing.userId,
            branchId: actor.branchId,
            registeredBy: actor.id,
          });
        } catch (attErr: any) {
          console.error(`[BOOKINGS] Error creating attendance record:`, attErr.message);
        }
      }

      // Class deduction rules:
      // - attended: -1 class (if plan active and not unlimited)
      // - no_show: -1 class (if plan active and not unlimited)
      // - cancelled + lateCancellation: -1 class (treated as no_show)
      // - cancelled before cutoff: no deduction
      // - already processed (attended/no_show): no double deduction
      const shouldDeduct = !alreadyProcessed && (status === "attended" || status === "no_show" || (status === "cancelled" && lateCancellation));
      let classesRemaining: number | null = null;
      if (shouldDeduct) {
        const mem = await storage.getMembershipByUserAndBranch(existing.userId, actor.branchId);
        if (mem && mem.classesRemaining !== null && mem.classesRemaining > 0) {
          const decremented = await storage.decrementClassesRemaining(mem.id);
          classesRemaining = decremented?.classesRemaining ?? null;
        } else if (mem) {
          classesRemaining = mem.classesRemaining;
        }
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_BOOKING_STATUS",
        branchId: actor.branchId,
        metadata: { bookingId, oldStatus: existing.status, newStatus: status, lateCancellation },
      });

      console.log(`[BOOKINGS] Updated booking ${bookingId} status to ${status}${lateCancellation ? " (late cancel)" : ""} by ${actor.email}`);
      res.json({ ...updated, lateCancellation, classesRemaining });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[BOOKINGS] Error updating status:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar reserva" });
    }
  });

  // --- Branch Content Management ---

  // Photos
  app.get("/api/branch/photos", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const photos = await storage.getBranchPhotos(user.branchId);
      res.json(photos);
    } catch (err: any) {
      console.error(`[PHOTOS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener fotos" });
    }
  });

  app.post("/api/branch/photos", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { type, url } = req.body;
      if (!type || !url) {
        return res.status(400).json({ message: "Se requiere type y url" });
      }
      if (!["profile", "facility"].includes(type)) {
        return res.status(400).json({ message: "Tipo inválido. Permitidos: profile, facility" });
      }

      const existing = await storage.getBranchPhotos(actor.branchId);
      const profilePhotos = existing.filter(p => p.type === "profile");
      const facilityPhotos = existing.filter(p => p.type === "facility");

      if (type === "profile" && profilePhotos.length >= 1) {
        return res.status(400).json({ message: "Solo se permite 1 foto de perfil. Elimina la actual primero." });
      }
      if (type === "facility" && facilityPhotos.length >= 5) {
        return res.status(400).json({ message: "Máximo 5 fotos de instalaciones permitidas" });
      }

      const displayOrder = type === "profile" ? 0 : facilityPhotos.length;
      const photo = await storage.addBranchPhoto({
        branchId: actor.branchId,
        type,
        url,
        displayOrder,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_PHOTO",
        branchId: actor.branchId,
        metadata: { photoId: photo.id, type },
      });

      console.log(`[PHOTOS] Added ${type} photo by ${actor.email}`);
      res.status(201).json(photo);
    } catch (err: any) {
      console.error(`[PHOTOS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al agregar foto" });
    }
  });

  app.delete("/api/branch/photos/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const photoId = req.params.id as string;
    try {
      const photos = await storage.getBranchPhotos(actor.branchId);
      const photo = photos.find(p => p.id === photoId);
      if (!photo) {
        return res.status(404).json({ message: "Foto no encontrada" });
      }

      await storage.deleteBranchPhoto(photoId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_PHOTO",
        branchId: actor.branchId,
        metadata: { photoId, type: photo.type },
      });

      console.log(`[PHOTOS] Deleted photo ${photoId} by ${actor.email}`);
      res.json({ message: "Foto eliminada" });
    } catch (err: any) {
      console.error(`[PHOTOS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar foto" });
    }
  });

  app.post("/api/branch/photos/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchPhotos(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[PHOTOS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar fotos" });
    }
  });

  // Posts
  app.get("/api/branch/posts", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const posts = await storage.getBranchPosts(user.branchId);
      res.json(posts);
    } catch (err: any) {
      console.error(`[POSTS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener posts" });
    }
  });

  app.post("/api/branch/posts", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { title, content, mediaUrl, mediaType } = req.body;
      if (!title || !content) {
        return res.status(400).json({ message: "Se requiere título y contenido" });
      }

      const existing = await storage.getBranchPosts(actor.branchId);
      if (existing.length >= 3) {
        return res.status(400).json({ message: "Máximo 3 posts fijos permitidos" });
      }

      if (mediaType && !["image", "video"].includes(mediaType)) {
        return res.status(400).json({ message: "Tipo de media inválido. Permitidos: image, video" });
      }

      const post = await storage.createBranchPost({
        branchId: actor.branchId,
        title,
        content,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        displayOrder: existing.length,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_POST",
        branchId: actor.branchId,
        metadata: { postId: post.id, title },
      });

      console.log(`[POSTS] Created "${title}" by ${actor.email}`);
      res.status(201).json(post);
    } catch (err: any) {
      console.error(`[POSTS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear post" });
    }
  });

  app.patch("/api/branch/posts/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const postId = req.params.id as string;
    try {
      const posts = await storage.getBranchPosts(actor.branchId);
      const post = posts.find(p => p.id === postId);
      if (!post) {
        return res.status(404).json({ message: "Post no encontrado" });
      }

      const { title, content, mediaUrl, mediaType } = req.body;
      if (mediaType && !["image", "video"].includes(mediaType)) {
        return res.status(400).json({ message: "Tipo de media inválido" });
      }

      const updated = await storage.updateBranchPost(postId, {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(mediaUrl !== undefined && { mediaUrl: mediaUrl || null }),
        ...(mediaType !== undefined && { mediaType: mediaType || null }),
      });

      console.log(`[POSTS] Updated "${postId}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[POSTS] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar post" });
    }
  });

  app.delete("/api/branch/posts/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const postId = req.params.id as string;
    try {
      const posts = await storage.getBranchPosts(actor.branchId);
      const post = posts.find(p => p.id === postId);
      if (!post) {
        return res.status(404).json({ message: "Post no encontrado" });
      }

      await storage.deleteBranchPost(postId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_POST",
        branchId: actor.branchId,
        metadata: { postId, title: post.title },
      });

      console.log(`[POSTS] Deleted "${post.title}" by ${actor.email}`);
      res.json({ message: "Post eliminado" });
    } catch (err: any) {
      console.error(`[POSTS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar post" });
    }
  });

  app.post("/api/branch/posts/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchPosts(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[POSTS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar posts" });
    }
  });

  // Products
  app.get("/api/branch/products", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const products = await storage.getBranchProducts(user.branchId);
      res.json(products);
    } catch (err: any) {
      console.error(`[PRODUCTS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener productos" });
    }
  });

  app.post("/api/branch/products", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { name, description, price, imageUrl, type, durationMinutes } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Se requiere nombre del producto" });
      }
      if (price === undefined || typeof price !== "number" || price < 0) {
        return res.status(400).json({ message: "Se requiere un precio válido" });
      }

      const existing = await storage.getBranchProducts(actor.branchId);
      const product = await storage.createBranchProduct({
        branchId: actor.branchId,
        name,
        description: description || null,
        price,
        imageUrl: imageUrl || null,
        type: type || "product",
        durationMinutes: durationMinutes || null,
        displayOrder: existing.length,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_PRODUCT",
        branchId: actor.branchId,
        metadata: { productId: product.id, name },
      });

      console.log(`[PRODUCTS] Created "${name}" by ${actor.email}`);
      res.status(201).json(product);
    } catch (err: any) {
      console.error(`[PRODUCTS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear producto" });
    }
  });

  app.patch("/api/branch/products/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const productId = req.params.id as string;
    try {
      const products = await storage.getBranchProducts(actor.branchId);
      const product = products.find(p => p.id === productId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      const { name, description, price, imageUrl, isActive, type, durationMinutes } = req.body;
      const updated = await storage.updateBranchProduct(productId, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(price !== undefined && { price }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(isActive !== undefined && { isActive }),
        ...(type !== undefined && { type }),
        ...(durationMinutes !== undefined && { durationMinutes: durationMinutes || null }),
      });

      console.log(`[PRODUCTS] Updated "${productId}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[PRODUCTS] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar producto" });
    }
  });

  app.delete("/api/branch/products/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const productId = req.params.id as string;
    try {
      const products = await storage.getBranchProducts(actor.branchId);
      const product = products.find(p => p.id === productId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      await storage.deleteBranchProduct(productId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_PRODUCT",
        branchId: actor.branchId,
        metadata: { productId, name: product.name },
      });

      console.log(`[PRODUCTS] Deleted "${product.name}" by ${actor.email}`);
      res.json({ message: "Producto eliminado" });
    } catch (err: any) {
      console.error(`[PRODUCTS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar producto" });
    }
  });

  app.post("/api/branch/products/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchProducts(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[PRODUCTS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar productos" });
    }
  });

  // Videos
  app.get("/api/branch/videos", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const videos = await storage.getBranchVideos(user.branchId);
      res.json(videos);
    } catch (err: any) {
      console.error(`[VIDEOS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener videos" });
    }
  });

  app.post("/api/branch/videos", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { title, url, thumbnailUrl } = req.body;
      if (!url) {
        return res.status(400).json({ message: "Se requiere la URL del video" });
      }

      const existing = await storage.getBranchVideos(actor.branchId);
      if (existing.length >= 2) {
        return res.status(400).json({ message: "Tu plan actual permite máximo 2 videos" });
      }

      const video = await storage.addBranchVideo({
        branchId: actor.branchId,
        title: title || null,
        url,
        thumbnailUrl: thumbnailUrl || null,
        displayOrder: existing.length,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_VIDEO",
        branchId: actor.branchId,
        metadata: { videoId: video.id, title: title || "Sin título" },
      });

      console.log(`[VIDEOS] Added video by ${actor.email}`);
      res.status(201).json(video);
    } catch (err: any) {
      console.error(`[VIDEOS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al agregar video" });
    }
  });

  app.delete("/api/branch/videos/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const videoId = req.params.id as string;
    try {
      const videos = await storage.getBranchVideos(actor.branchId);
      const video = videos.find(v => v.id === videoId);
      if (!video) {
        return res.status(404).json({ message: "Video no encontrado" });
      }

      await storage.deleteBranchVideo(videoId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_VIDEO",
        branchId: actor.branchId,
        metadata: { videoId, title: video.title },
      });

      console.log(`[VIDEOS] Deleted video ${videoId} by ${actor.email}`);
      res.json({ message: "Video eliminado" });
    } catch (err: any) {
      console.error(`[VIDEOS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar video" });
    }
  });

  app.post("/api/branch/videos/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchVideos(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[VIDEOS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar videos" });
    }
  });

  // --- TV Mode ---
  app.get("/api/branch/tv-data", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const date = (req.query.date as string) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const data = await storage.getTvModeData(user.branchId, date);
      res.json(data);
    } catch (err: any) {
      console.error(`[TV_MODE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener datos de TV Mode" });
    }
  });

  app.patch("/api/branch/classes/:id/routine", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classId = req.params.id;
    try {
      const schedule = await storage.getClassSchedule(classId);
      if (!schedule || schedule.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const { routineDescription, routineImageUrl } = req.body;
      if (routineDescription !== undefined && routineDescription !== null && typeof routineDescription !== "string") {
        return res.status(400).json({ message: "routineDescription debe ser texto o null" });
      }
      if (routineImageUrl !== undefined && routineImageUrl !== null && typeof routineImageUrl !== "string") {
        return res.status(400).json({ message: "routineImageUrl debe ser texto o null" });
      }

      const updated = await storage.updateClassRoutine(
        classId,
        typeof routineDescription === "string" ? routineDescription : null,
        typeof routineImageUrl === "string" ? routineImageUrl : null
      );

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLASS_ROUTINE",
        branchId: actor.branchId,
        metadata: { classId, className: schedule.name },
      });

      console.log(`[TV_MODE] Updated routine for class ${schedule.name} by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[TV_MODE] Error updating routine:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar rutina" });
    }
  });

  app.patch("/api/branch/profile", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { description, address, city, googleMapsUrl, operatingHours, locations, category, subcategory, latitude, longitude } = req.body;
      const updated = await storage.updateBranchProfile(actor.branchId, {
        ...(description !== undefined && { description }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(googleMapsUrl !== undefined && { googleMapsUrl }),
        ...(operatingHours !== undefined && { operatingHours }),
        ...(locations !== undefined && { locations }),
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
      });
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_BRANCH_PROFILE",
        branchId: actor.branchId,
        metadata: { fields: Object.keys(req.body) },
      });
      res.json(updated);
    } catch (err: any) {
      console.error(`[BRANCH_PROFILE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar perfil" });
    }
  });

  app.get("/api/public/branch/:slug/reviews", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const [reviews, summary] = await Promise.all([
        storage.getBranchReviews(branch.id),
        storage.getBranchReviewsSummary(branch.id),
      ]);
      res.json({ reviews, ...summary });
    } catch (err: any) {
      console.error(`[REVIEWS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reseñas" });
    }
  });

  app.get("/api/public/branch/:slug/my-review", async (req, res) => {
    if (!req.isAuthenticated()) return res.json({ review: null });
    try {
      const actor = req.user as any;
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const review = await storage.getUserReview(branch.id, actor.id);
      res.json({ review });
    } catch (err: any) {
      console.error(`[MY-REVIEW] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reseña" });
    }
  });

  app.post("/api/public/branch/:slug/reviews", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    try {
      const actor = req.user as any;
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Calificación inválida (1-5)" });
      }
      const review = await storage.createOrUpdateReview(branch.id, actor.id, Number(rating), comment || null);
      res.json({ review });
    } catch (err: any) {
      console.error(`[POST-REVIEW] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al guardar reseña" });
    }
  });

  app.get("/api/branch/reviews", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const [reviews, summary] = await Promise.all([
        storage.getBranchReviews(actor.branchId),
        storage.getBranchReviewsSummary(actor.branchId),
      ]);
      res.json({ reviews, ...summary });
    } catch (err: any) {
      console.error(`[REVIEWS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reseñas" });
    }
  });

  // --- WhatsApp Templates ---
  app.get("/api/branch/whatsapp-templates", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const branch = await storage.getBranch(actor.branchId);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const defaults: Record<string, string> = {
        expired_membership: "Hola {firstName}, tu membresía en {branchName} ha vencido. ¡Renueva para seguir entrenando!",
        expiring_membership: "Hola {firstName}, tu membresía en {branchName} vence pronto ({expiresAt}). ¡Renueva a tiempo!",
        no_classes: "Hola {firstName}, te has quedado sin clases disponibles en {branchName}. Contacta al estudio para renovar.",
        birthday_greeting: "Hola {firstName}, todo el equipo de {branchName} te desea un feliz cumpleaños. Te esperamos pronto!",
        plan_renewal: "Hola {firstName}, tu renovación en {branchName} quedó lista. Tu plan {planName} ya está activo y vence el {expiresAt}. ¡Gracias por continuar con nosotros!",
      };
      const saved = (branch as any).whatsappTemplates || {};
      res.json({ ...defaults, ...saved });
    } catch (err: any) {
      console.error(`[WHATSAPP_TEMPLATES] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener plantillas" });
    }
  });

  app.patch("/api/branch/whatsapp-templates", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const templates = req.body;
      if (!templates || typeof templates !== "object") {
        return res.status(400).json({ message: "Datos inválidos" });
      }
      const allowed = ["expired_membership", "expiring_membership", "no_classes", "booking_confirmed", "birthday_greeting", "plan_renewal"];
      const filtered: Record<string, string> = {};
      for (const key of allowed) {
        if (typeof templates[key] === "string" && templates[key].trim().length > 0) {
          filtered[key] = templates[key].trim();
        }
      }
      await storage.updateBranchWhatsappTemplates(actor.branchId, filtered);
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_WHATSAPP_TEMPLATES",
        branchId: actor.branchId,
        metadata: { keys: Object.keys(filtered) },
      });
      res.json(filtered);
    } catch (err: any) {
      console.error(`[WHATSAPP_TEMPLATES] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al guardar plantillas" });
    }
  });

  // --- Announcements ---
  app.get("/api/branch/announcements", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const announcements = await storage.getBranchAnnouncements(actor.branchId);
      res.json(announcements);
    } catch (err: any) {
      console.error(`[ANNOUNCEMENTS] Error fetching:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener anuncios" });
    }
  });

  app.post("/api/branch/announcements", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { message, imageUrl } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "El mensaje es requerido" });
      }
      if (message.length > 500) {
        return res.status(400).json({ message: "El mensaje no puede tener más de 500 caracteres" });
      }

      await storage.deactivateAllAnnouncements(actor.branchId);

      const announcement = await storage.createAnnouncement({
        branchId: actor.branchId,
        message: message.trim(),
        imageUrl: imageUrl || null,
        isActive: true,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_ANNOUNCEMENT",
        branchId: actor.branchId,
        metadata: { announcementId: announcement.id },
      });

      res.json(announcement);
    } catch (err: any) {
      console.error(`[ANNOUNCEMENTS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear anuncio" });
    }
  });

  app.delete("/api/branch/announcements/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const announcements = await storage.getBranchAnnouncements(actor.branchId);
      const target = announcements.find(a => a.id === req.params.id);
      if (!target) {
        return res.status(404).json({ message: "Anuncio no encontrado" });
      }

      await storage.deleteAnnouncement(req.params.id);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_ANNOUNCEMENT",
        branchId: actor.branchId,
        metadata: { announcementId: req.params.id },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error(`[ANNOUNCEMENTS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar anuncio" });
    }
  });

  // --- Public ---
  app.get("/api/public/branch/:slug/announcements", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const all = await storage.getBranchAnnouncements(branch.id);
      const active = all.filter(a => a.isActive);
      res.json(active);
    } catch (err: any) {
      console.error(`[PUBLIC_ANNOUNCEMENTS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener anuncios" });
    }
  });

  app.get("/api/public/branch/:slug/content", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const [photos, posts, products, videos] = await Promise.all([
        storage.getBranchPhotos(branch.id),
        storage.getBranchPosts(branch.id),
        storage.getBranchProducts(branch.id),
        storage.getBranchVideos(branch.id),
      ]);

      const activeProducts = products.filter(p => p.isActive);

      res.json({
        photos,
        posts,
        products: activeProducts,
        videos,
      });
    } catch (err: any) {
      console.error(`[PUBLIC_CONTENT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener contenido" });
    }
  });

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

  // --- Public: Schedule & Client Bookings ---
  app.get("/api/public/branch/:slug/schedule", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      await storage.reconcilePastBookings(branch.id);
      const schedules = await storage.getBranchClassSchedules(branch.id);
      const activeSchedules = schedules.filter(s => s.isActive);

      const date = req.query.date as string | undefined;
      let spotsMap: Record<string, number> = {};
      if (date) {
        const allBookings = await storage.getBookingsForDate(branch.id, date);
        const activeBookings = allBookings.filter((b: any) => b.status !== "cancelled" && b.status !== "no_show");
        for (const b of activeBookings) {
          spotsMap[b.classScheduleId] = (spotsMap[b.classScheduleId] || 0) + 1;
        }
      }

      res.json({
        schedules: activeSchedules,
        cancelCutoffMinutes: branch.cancelCutoffMinutes ?? DEFAULT_CANCEL_CUTOFF_MINUTES,
        spotsTaken: spotsMap,
      });
    } catch (err: any) {
      console.error(`[PUBLIC_SCHEDULE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener horario" });
    }
  });

  app.get("/api/public/branch/:slug/my-bookings", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
      if (!mem || mem.status !== "active") {
        return res.json({ bookings: [], membership: null });
      }
      await storage.reconcilePastBookings(branch.id);
      const allBookings = await storage.getBookingsForDate(branch.id, req.query.date as string || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }));
      const myBookings = allBookings.filter((b: any) => b.userId === user.id);
      res.json({
        bookings: myBookings,
        membership: {
          id: mem.id,
          planId: mem.planId,
          classesRemaining: mem.classesRemaining,
          classesTotal: mem.classesTotal,
          expiresAt: mem.expiresAt,
          membershipStartDate: mem.membershipStartDate,
          membershipEndDate: mem.membershipEndDate,
          clientStatus: mem.clientStatus,
        },
      });
    } catch (err: any) {
      console.error(`[PUBLIC_MY_BOOKINGS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reservas" });
    }
  });

  app.get("/api/public/branch/:slug/my-upcoming-bookings", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
      if (!mem || mem.status !== "active") {
        return res.json([]);
      }
      await storage.reconcilePastBookings(branch.id);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const bookings = await storage.getUpcomingBookingsForUser(branch.id, user.id, today, 5);
      res.json(bookings);
    } catch (err: any) {
      console.error(`[PUBLIC_UPCOMING] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reservas" });
    }
  });

  app.post("/api/public/branch/:slug/book", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
      if (!mem || mem.status !== "active") {
        return res.status(403).json({ message: "Debes ser miembro para reservar" });
      }
      if (mem.clientStatus === "frozen") {
        return res.status(403).json({ message: "Tu membresía está congelada" });
      }
      if (mem.clientStatus === "inactive") {
        return res.status(403).json({ message: "Tu membresía está inactiva" });
      }
      if (mem.expiresAt && new Date(mem.expiresAt) < new Date()) {
        return res.status(403).json({ message: "Tu membresía ha vencido" });
      }
      if (mem.classesRemaining !== null && mem.classesRemaining <= 0) {
        return res.status(403).json({ message: "No tienes clases disponibles" });
      }

      const { classScheduleId, bookingDate } = createBookingSchema.omit({ userId: true }).parse(req.body);
      const schedule = await storage.getClassSchedule(classScheduleId);
      if (!schedule || schedule.branchId !== branch.id || !schedule.isActive) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const existing = await storage.getBookingsForClassOnDate(classScheduleId, bookingDate);
      const activeBookings = existing.filter((b: any) => b.status !== "cancelled" && b.status !== "no_show");
      if (activeBookings.length >= schedule.capacity) {
        return res.status(400).json({ message: "Clase llena" });
      }
      if (activeBookings.some((b: any) => b.userId === user.id)) {
        return res.status(400).json({ message: "Ya tienes reserva en esta clase" });
      }

      const booking = await storage.createBooking({
        classScheduleId,
        branchId: branch.id,
        userId: user.id,
        bookingDate,
        source: "app",
      });

      res.status(201).json(booking);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PUBLIC_BOOK] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al crear reserva" });
    }
  });

  app.post("/api/public/branch/:slug/cancel-booking", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const { bookingId } = z.object({ bookingId: z.string().min(1) }).parse(req.body);
      const booking = await storage.getBooking(bookingId);
      if (!booking || booking.userId !== user.id || booking.branchId !== branch.id) {
        return res.status(404).json({ message: "Reserva no encontrada" });
      }
      if (booking.status !== "confirmed") {
        return res.status(400).json({ message: "Solo puedes cancelar reservas confirmadas" });
      }

      const schedule = await storage.getClassSchedule(booking.classScheduleId);
      const cutoff = branch.cancelCutoffMinutes ?? DEFAULT_CANCEL_CUTOFF_MINUTES;
      let lateCancellation = false;

      if (schedule) {
        const classStart = new Date(`${booking.bookingDate}T${schedule.startTime}:00`);
        const diffMin = (classStart.getTime() - Date.now()) / 60000;
        if (diffMin < cutoff) {
          lateCancellation = true;
        }
      }

      await storage.updateBookingStatus(bookingId, "cancelled");
      if (lateCancellation) {
        await storage.markBookingLateCancellation(bookingId);
        const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
        if (mem && mem.classesRemaining !== null && mem.classesRemaining > 0) {
          await storage.decrementClassesRemaining(mem.id);
        }
      }

      res.json({ success: true, lateCancellation });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PUBLIC_CANCEL] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al cancelar reserva" });
    }
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

  app.post("/api/memberships/leave", requireAuth, async (req, res) => {
    const user = req.user as any;
    const { branchSlug } = req.body;
    if (!branchSlug || typeof branchSlug !== "string") {
      return res.status(400).json({ message: "branchSlug requerido" });
    }
    try {
      const branch = await storage.getBranchBySlug(branchSlug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const existing = await storage.getMembership(user.id, branch.id);
      if (!existing || existing.status !== "active") {
        return res.status(400).json({ message: "No eres miembro activo de esta sucursal" });
      }
      const updated = await storage.updateMembership(existing.id, { status: "left" });
      return res.json(updated);
    } catch (err: any) {
      console.error("[LEAVE]", err.stack || err);
      res.status(500).json({ message: "Error al salir de la sucursal" });
    }
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

  // Background job: every 60 seconds, auto-mark attended for confirmed bookings
  // whose class start time has passed, for all active branches.
  // This is the same logic as the manual "Asistió" button — no separate deduction logic.
  setInterval(async () => {
    try {
      const branchIds = await storage.getAllActiveBranchIds();
      for (const branchId of branchIds) {
        const count = await storage.autoMarkAttendedBookings(branchId);
        if (count > 0) {
          console.log(`[AUTO-ATTEND] Processed ${count} booking(s) for branch ${branchId}`);
        }
      }
    } catch (err: any) {
      console.error("[AUTO-ATTEND] Background job error:", err.message);
    }
  }, 60_000);

  return httpServer;
}
