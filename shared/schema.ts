import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, doublePrecision, boolean, uniqueIndex, jsonb, integer } from "drizzle-orm/pg-core";
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
  phone: text("phone"),
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
  planId: varchar("plan_id", { length: 36 }),
  classesRemaining: integer("classes_remaining"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("memberships_user_branch_idx").on(table.userId, table.branchId),
]);

export const membershipPlans = pgTable("membership_plans", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull().default(0),
  durationDays: integer("duration_days"),
  classLimit: integer("class_limit"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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

export const clientNotes = pgTable("client_notes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdBy: varchar("created_by", { length: 36 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attendances = pgTable("attendances", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  registeredBy: varchar("registered_by", { length: 36 })
    .notNull()
    .references(() => users.id),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).defaultNow().notNull(),
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

export const insertClientNoteSchema = createInsertSchema(clientNotes).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendances).omit({
  id: true,
  checkedInAt: true,
});

export type ClientNote = typeof clientNotes.$inferSelect;
export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;
export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "attended",
]);

export const classSchedules = pgTable("class_schedules", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  description: text("description"),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  capacity: integer("capacity").notNull().default(10),
  instructorName: text("instructor_name"),
  isActive: boolean("is_active").notNull().default(true),
  routineDescription: text("routine_description"),
  routineImageUrl: text("routine_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const classBookings = pgTable("class_bookings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  classScheduleId: varchar("class_schedule_id", { length: 36 })
    .notNull()
    .references(() => classSchedules.id),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  bookingDate: text("booking_date").notNull(),
  status: bookingStatusEnum("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertClassScheduleSchema = createInsertSchema(classSchedules).omit({
  id: true,
  createdAt: true,
});

export const insertClassBookingSchema = createInsertSchema(classBookings).omit({
  id: true,
  createdAt: true,
});

export const createClassScheduleSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  capacity: z.number().int().min(1, "Mínimo 1 lugar"),
  instructorName: z.string().optional(),
});

export const createBookingSchema = z.object({
  classScheduleId: z.string().min(1),
  userId: z.string().min(1),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
});

export type ClassSchedule = typeof classSchedules.$inferSelect;
export type InsertClassSchedule = z.infer<typeof insertClassScheduleSchema>;
export type ClassBooking = typeof classBookings.$inferSelect;
export type InsertClassBooking = z.infer<typeof insertClassBookingSchema>;

export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).omit({
  id: true,
  createdAt: true,
});

export const createPlanSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  price: z.number().int().min(0, "El precio no puede ser negativo"),
  durationDays: z.number().int().min(1).nullable().optional(),
  classLimit: z.number().int().min(1).nullable().optional(),
});

export const assignPlanSchema = z.object({
  planId: z.string().min(1, "Se requiere un plan"),
});

export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;

export const createClientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  phone: z.string().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});

export const branchPhotoTypeEnum = pgEnum("branch_photo_type", [
  "profile",
  "facility",
]);

export const branchPostMediaTypeEnum = pgEnum("branch_post_media_type", [
  "image",
  "video",
]);

export const branchPhotos = pgTable("branch_photos", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  type: branchPhotoTypeEnum("type").notNull(),
  url: text("url").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const branchPosts = pgTable("branch_posts", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: branchPostMediaTypeEnum("media_type"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const branchProducts = pgTable("branch_products", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull().default(0),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const branchVideos = pgTable("branch_videos", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  title: text("title"),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertBranchPhotoSchema = createInsertSchema(branchPhotos).omit({
  id: true,
  createdAt: true,
});

export const insertBranchPostSchema = createInsertSchema(branchPosts).omit({
  id: true,
  createdAt: true,
});

export const insertBranchProductSchema = createInsertSchema(branchProducts).omit({
  id: true,
  createdAt: true,
});

export const insertBranchVideoSchema = createInsertSchema(branchVideos).omit({
  id: true,
  createdAt: true,
});

export type BranchPhoto = typeof branchPhotos.$inferSelect;
export type InsertBranchPhoto = z.infer<typeof insertBranchPhotoSchema>;
export type BranchPost = typeof branchPosts.$inferSelect;
export type InsertBranchPost = z.infer<typeof insertBranchPostSchema>;
export type BranchProduct = typeof branchProducts.$inferSelect;
export type InsertBranchProduct = z.infer<typeof insertBranchProductSchema>;
export type BranchVideo = typeof branchVideos.$inferSelect;
export type InsertBranchVideo = z.infer<typeof insertBranchVideoSchema>;

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
