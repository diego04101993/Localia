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

    const boxCentral = await storage.createBranch({
      name: "Box Central",
      slug: "box-central",
      status: "active",
      category: "box",
      latitude: 19.4326,
      longitude: -99.1332,
      city: "Ciudad de México",
      address: "Av. Reforma 123, Col. Juárez",
      description: "CrossFit y entrenamiento funcional en el corazón de la ciudad.",
    });

    const boxNorte = await storage.createBranch({
      name: "Box Norte",
      slug: "box-norte",
      status: "active",
      category: "box",
      latitude: 25.6866,
      longitude: -100.3161,
      city: "Monterrey",
      address: "Av. Garza Sada 456, Col. Tecnológico",
      description: "Tu box de CrossFit en Monterrey con los mejores coaches.",
    });

    await storage.createBranch({
      name: "Box Sur",
      slug: "box-sur",
      status: "suspended",
      category: "box",
      latitude: 20.6597,
      longitude: -103.3496,
      city: "Guadalajara",
    });

    const esteticaLuz = await storage.createBranch({
      name: "Estética Luz",
      slug: "estetica-luz",
      status: "active",
      category: "estetica",
      latitude: 19.4284,
      longitude: -99.1677,
      city: "Ciudad de México",
      address: "Calle Ámsterdam 78, Col. Condesa",
      description: "Tratamientos faciales, corporales y spa de lujo.",
    });

    const drPerez = await storage.createBranch({
      name: "Dr. Pérez - Medicina Deportiva",
      slug: "dr-perez",
      status: "active",
      category: "doctor",
      latitude: 19.4352,
      longitude: -99.1412,
      city: "Ciudad de México",
      address: "Paseo de la Reforma 250, Piso 8",
      description: "Especialista en medicina deportiva y rehabilitación.",
    });

    const bufeteLegal = await storage.createBranch({
      name: "Bufete García & Asociados",
      slug: "bufete-garcia",
      status: "active",
      category: "abogado",
      latitude: 19.4270,
      longitude: -99.1678,
      city: "Ciudad de México",
      address: "Av. Insurgentes Sur 1602",
      description: "Asesoría legal integral para empresas y particulares.",
    });

    const yogaZen = await storage.createBranch({
      name: "Yoga Zen Studio",
      slug: "yoga-zen",
      status: "active",
      category: "yoga",
      latitude: 19.4200,
      longitude: -99.1750,
      city: "Ciudad de México",
      address: "Calle Michoacán 30, Col. Roma",
      description: "Clases de yoga, pilates y meditación para todos los niveles.",
    });

    const freelancerHub = await storage.createBranch({
      name: "Coworking Hub CDMX",
      slug: "coworking-hub",
      status: "active",
      category: "freelancer",
      latitude: 19.4310,
      longitude: -99.1530,
      city: "Ciudad de México",
      address: "Calle Durango 200, Col. Roma",
      description: "Espacio de coworking con salas de juntas y café ilimitado.",
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
      branchId: boxCentral.id,
    });

    await storage.createUser({
      email: "norte@boxmanager.com",
      passwordHash: branchAdminHash,
      role: "BRANCH_ADMIN",
      name: "Admin Box Norte",
      branchId: boxNorte.id,
    });

    const customerHash = await bcrypt.hash("cliente123", 10);
    const customer = await storage.createUser({
      email: "cliente@test.com",
      passwordHash: customerHash,
      role: "CUSTOMER",
      name: "Carlos Martínez",
      branchId: null,
    });

    await storage.createMembership({
      userId: customer.id,
      branchId: boxCentral.id,
      status: "active",
      isFavorite: true,
      source: "self_join",
    });

    await storage.createMembership({
      userId: customer.id,
      branchId: esteticaLuz.id,
      status: "active",
      isFavorite: true,
      source: "self_join",
    });

    await storage.createMembership({
      userId: customer.id,
      branchId: yogaZen.id,
      status: "active",
      isFavorite: false,
      source: "self_join",
    });

    log("Database seeded successfully", "seed");
  } catch (err) {
    log(`Seed error: ${err}`, "seed");
  }
}
