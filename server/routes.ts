import type { Express } from "express";
import { type Server } from "http";
import passport from "passport";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireRole } from "./auth";
import { seedDatabase } from "./seed";
import { loginSchema, createBranchSchema } from "@shared/schema";

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
      if (!user) return res.status(401).json({ message: info?.message || "Credenciales incorrectas" });
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

    res.json({ ...safeUser, branch: branch || null });
  });

  app.get("/api/branches", requireRole("SUPER_ADMIN"), async (_req, res) => {
    const branches = await storage.getAllBranches();
    res.json(branches);
  });

  app.post("/api/branches", requireRole("SUPER_ADMIN"), async (req, res) => {
    const result = createBranchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos" });
    }
    const existing = await storage.getBranchBySlug(result.data.slug);
    if (existing) {
      return res.status(409).json({ message: "Ese slug ya existe" });
    }
    const branch = await storage.createBranch({
      name: result.data.name,
      slug: result.data.slug,
      status: "active",
    });
    res.status(201).json(branch);
  });

  app.patch("/api/branches/:id/status", requireRole("SUPER_ADMIN"), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!["active", "suspended", "blacklisted"].includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }
    const branch = await storage.updateBranchStatus(id, status as string);
    if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
    res.json(branch);
  });

  app.get("/api/public/branch/:slug", async (req, res) => {
    const branch = await storage.getBranchBySlug(req.params.slug);
    if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
    if (branch.status !== "active") {
      return res.status(403).json({ message: "Servicio no activo" });
    }
    res.json(branch);
  });

  // Push schema and seed
  try {
    await seedDatabase();
  } catch (e) {
    console.error("Seed error:", e);
  }

  return httpServer;
}
