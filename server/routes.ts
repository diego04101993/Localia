import type { Express } from "express";
import { type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireRole } from "./auth";
import { seedDatabase } from "./seed";
import {
  loginSchema,
  createBranchSchema,
  joinBranchSchema,
  favoriteBranchSchema,
} from "@shared/schema";

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
        return res
          .status(401)
          .json({ message: info?.message || "Credenciales incorrectas" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        const { passwordHash, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Error al cerrar sesión" });
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

  app.get(
    "/api/branches",
    requireRole("SUPER_ADMIN"),
    async (_req, res) => {
      const allBranches = await storage.getAllBranches();
      res.json(allBranches);
    }
  );

  app.post(
    "/api/branches",
    requireRole("SUPER_ADMIN"),
    async (req, res) => {
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
    }
  );

  app.patch(
    "/api/branches/:id/status",
    requireRole("SUPER_ADMIN"),
    async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      if (!["active", "suspended", "blacklisted"].includes(status)) {
        return res.status(400).json({ message: "Estado inválido" });
      }
      const branch = await storage.updateBranchStatus(id, status as string);
      if (!branch)
        return res
          .status(404)
          .json({ message: "Sucursal no encontrada" });
      res.json(branch);
    }
  );

  app.get("/api/public/branch/:slug", async (req, res) => {
    const branch = await storage.getBranchBySlug(req.params.slug);
    if (!branch)
      return res
        .status(404)
        .json({ message: "Sucursal no encontrada" });
    if (branch.status !== "active") {
      return res.status(403).json({ message: "Servicio no activo" });
    }
    res.json(branch);
  });

  // --- Marketplace: Nearby / Search ---
  app.get("/api/branches/nearby", async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = req.query.radius_km
      ? parseFloat(req.query.radius_km as string)
      : 50;
    const category = (req.query.category as string) || undefined;
    const q = (req.query.q as string) || undefined;

    const results = await storage.searchBranchesNearby({
      lat,
      lng,
      radiusKm,
      category,
      q,
    });
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

    if (!branch) {
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
        const updated = await storage.updateMembership(existing.id, {
          status: "active",
          source: "self_join",
        });
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
    if (!branch || branch.status !== "active") {
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

  // Push schema and seed
  try {
    await seedDatabase();
  } catch (e) {
    console.error("Seed error:", e);
  }

  return httpServer;
}
