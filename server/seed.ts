import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { log } from "./index";

export async function seedDatabase() {
  try {
    const existingAdmin = await storage.getUserByEmail("admin@boxmanager.com");
    if (existingAdmin) {
      log("Seed data already exists, skipping", "seed");
      return;
    }

    log("Seeding database...", "seed");

    const branch = await storage.createBranch({
      name: "Box Central",
      slug: "box-central",
      status: "active",
    });

    const branch2 = await storage.createBranch({
      name: "Box Norte",
      slug: "box-norte",
      status: "active",
    });

    const branch3 = await storage.createBranch({
      name: "Box Sur",
      slug: "box-sur",
      status: "suspended",
    });

    const superAdminHash = await bcrypt.hash("admin123", 10);
    await storage.createUser({
      email: "admin@boxmanager.com",
      passwordHash: superAdminHash,
      role: "SUPER_ADMIN",
      name: "Super Admin",
      branchId: null,
    });

    const branchAdminHash = await bcrypt.hash("branch123", 10);
    await storage.createUser({
      email: "central@boxmanager.com",
      passwordHash: branchAdminHash,
      role: "BRANCH_ADMIN",
      name: "Admin Box Central",
      branchId: branch.id,
    });

    await storage.createUser({
      email: "norte@boxmanager.com",
      passwordHash: branchAdminHash,
      role: "BRANCH_ADMIN",
      name: "Admin Box Norte",
      branchId: branch2.id,
    });

    log("Database seeded successfully", "seed");
  } catch (err) {
    log(`Seed error: ${err}`, "seed");
  }
}
