import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, doublePrecision, boolean, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", [
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "CUSTOMER",
]);

export const branchStatusEnum = pgEnum("branch_status", [
  "active",
  "suspended",
  "blacklisted",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "banned",
  "left",
]);

export const membershipSourceEnum = pgEnum("membership_source", [
  "invite",
  "self_join",
  "admin_created",
]);

export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  branchId: varchar("branch_id", { length: 36 }).references(() => branches.id),
  name: text("name").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const branches = pgTable("branches", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: branchStatusEnum("status").notNull().default("active"),
  category: text("category").default("box"),
  subcategory: text("subcategory"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  city: text("city"),
  address: text("address"),
  coverImageUrl: text("cover_image_url"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const memberships = pgTable("memberships", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  status: membershipStatusEnum("status").notNull().default("active"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  source: membershipSourceEnum("source").notNull().default("self_join"),
}, (table) => [
  uniqueIndex("memberships_user_branch_idx").on(table.userId, table.branchId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  branchId: varchar("branch_id", { length: 36 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  joinedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const registerSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().min(1, "El nombre es obligatorio"),
});

export const createBranchSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  slug: z
    .string()
    .min(1, "El slug es obligatorio")
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
});

export const joinBranchSchema = z.object({
  branchSlug: z.string().optional(),
  branchId: z.string().optional(),
}).refine(d => d.branchSlug || d.branchId, { message: "Se requiere branchSlug o branchId" });

export const favoriteBranchSchema = z.object({
  branchId: z.string().min(1),
  isFavorite: z.boolean(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateBranchData = z.infer<typeof createBranchSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const BRANCH_CATEGORIES = [
  { value: "box", label: "Box / CrossFit" },
  { value: "gym", label: "Gimnasio" },
  { value: "yoga", label: "Yoga / Pilates" },
  { value: "estetica", label: "Estética / Spa" },
  { value: "doctor", label: "Doctor / Clínica" },
  { value: "abogado", label: "Abogado / Legal" },
  { value: "freelancer", label: "Freelancer / Consultor" },
  { value: "otro", label: "Otro" },
] as const;
