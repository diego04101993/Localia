import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, doublePrecision, boolean, uniqueIndex, jsonb, integer, index, numeric, date } from "drizzle-orm/pg-core";
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
  lastName: text("last_name"),
  phone: text("phone"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  googleId: text("google_id").unique(),
  firebaseUid: text("firebase_uid").unique(),
  authProvider: text("auth_provider").notNull().default("email"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  medicalNotes: text("medical_notes"),
  injuriesNotes: text("injuries_notes"),
  medicalWarnings: text("medical_warnings"),
  parqAccepted: boolean("parq_accepted").notNull().default(false),
  parqAcceptedDate: text("parq_accepted_date"),
  avatarUrl: text("avatar_url"),
  acceptedTerms: boolean("accepted_terms").notNull().default(false),
  acceptedTermsAt: text("accepted_terms_at"),
  termsVersion: text("terms_version"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: text("email_verified_at"),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationTokenExpiresAt: text("email_verification_token_expires_at"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  blockedReason: text("blocked_reason"),
  blockedBy: varchar("blocked_by", { length: 36 }),
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
  searchKeywords: text("search_keywords"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  city: text("city"),
  address: text("address"),
  coverImageUrl: text("cover_image_url"),
  description: text("description"),
  cancelCutoffMinutes: integer("cancel_cutoff_minutes").notNull().default(120),
  whatsappTemplates: jsonb("whatsapp_templates"),
  whatsappNumber: text("whatsapp_number"),
  googleMapsUrl: text("google_maps_url"),
  operatingHours: jsonb("operating_hours"),
  summaryHours: text("summary_hours"),
  locations: jsonb("locations").$type<Array<{ name: string; address: string; googleMapsUrl: string }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const categories = pgTable("categories", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  icon: text("icon"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("categories_is_active_idx").on(table.isActive),
  index("categories_display_order_idx").on(table.displayOrder),
]);

export const subcategories = pgTable("subcategories", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  categoryKey: text("category_key")
    .notNull()
    .references(() => categories.key),
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("subcategories_category_key_idx").on(table.categoryKey),
  index("subcategories_is_active_idx").on(table.isActive),
]);

export const categoryKeywords = pgTable("category_keywords", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  categoryKey: text("category_key").references(() => categories.key),
  subcategoryId: varchar("subcategory_id", { length: 36 }).references(() => subcategories.id),
  keyword: text("keyword").notNull(),
  normalizedKeyword: text("normalized_keyword").notNull(),
  kind: text("kind").notNull().default("alias"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("category_keywords_category_key_idx").on(table.categoryKey),
  index("category_keywords_subcategory_id_idx").on(table.subcategoryId),
  index("category_keywords_normalized_keyword_idx").on(table.normalizedKeyword),
]);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: jsonb("value_json").notNull(),
  scope: text("scope").notNull().default("global"),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("app_settings_scope_idx").on(table.scope),
]);

export const searchLogs = pgTable("search_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  queryRaw: text("query_raw"),
  queryNormalized: text("query_normalized"),
  category: text("category"),
  subcategory: text("subcategory"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  zone: text("zone"),
  resultCount: integer("result_count").notNull().default(0),
  selectedBranchId: varchar("selected_branch_id", { length: 36 }).references(() => branches.id),
  source: text("source").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("search_logs_created_at_idx").on(table.createdAt),
  index("search_logs_query_normalized_idx").on(table.queryNormalized),
  index("search_logs_category_idx").on(table.category),
]);

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
  planNameSnapshot: text("plan_name_snapshot"),
  classesRemaining: integer("classes_remaining"),
  classesTotal: integer("classes_total"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  membershipStartDate: timestamp("membership_start_date", { withTimezone: true }),
  membershipEndDate: timestamp("membership_end_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  renewedFromId: varchar("renewed_from_id", { length: 36 }),
  clientStatus: text("client_status").notNull().default("active"),
  hasDebt: boolean("has_debt").notNull().default(false),
  debtAmount: integer("debt_amount").notNull().default(0),
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
  cycleMonths: integer("cycle_months").notNull().default(1),
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

export const systemEvents = pgTable("system_events", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  branchId: varchar("branch_id", { length: 36 }).references(() => branches.id),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  payload: jsonb("payload"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const pushTokens = pgTable("push_tokens", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  token: text("token").notNull(),
  platform: text("platform").notNull(),
  deviceName: text("device_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("push_tokens_token_unique").on(table.token),
]);

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  recipientUserId: varchar("recipient_user_id", { length: 36 }).references(() => users.id),
  branchId: varchar("branch_id", { length: 36 }).references(() => branches.id),
  roleTarget: userRoleEnum("role_target"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
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

export const branchClientCrm = pgTable("branch_client_crm", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  clientStatus: text("client_status"),
  lastVisit: timestamp("last_visit", { withTimezone: true }),
  tags: text("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("branch_client_crm_branch_user_idx").on(table.branchId, table.userId),
]);

export const customerReportStatusEnum = pgEnum("customer_report_status", [
  "pending",
  "reviewed",
  "dismissed",
  "escalated",
]);

export const branchCustomerBlocks = pgTable("branch_customer_blocks", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  blockedByUserId: varchar("blocked_by_user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  reason: text("reason"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  unblockedAt: timestamp("unblocked_at", { withTimezone: true }),
});

export const customerReports = pgTable("customer_reports", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  reportedByUserId: varchar("reported_by_user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  note: text("note"),
  status: customerReportStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByUserId: varchar("reviewed_by_user_id", { length: 36 }).references(() => users.id),
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

export const publicCustomerRegisterSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "Los apellidos son obligatorios"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(["M", "F", "NE"]).optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar los términos y aviso de privacidad" }),
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const createBranchSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  slug: z
    .string()
    .min(1, "El slug es obligatorio")
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
});

export const createBranchFormSchema = createBranchSchema.extend({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  searchKeywords: z.string().optional(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertSubcategorySchema = createInsertSchema(subcategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategoryKeywordSchema = createInsertSchema(categoryKeywords).omit({
  id: true,
  normalizedKeyword: true,
  createdAt: true,
});

export const insertAppSettingSchema = createInsertSchema(appSettings).omit({
  updatedAt: true,
});

export const insertSearchLogSchema = createInsertSchema(searchLogs).omit({
  id: true,
  createdAt: true,
});

export const createCatalogCategorySchema = z.object({
  key: z
    .string()
    .min(1, "La clave es obligatoria")
    .regex(/^[a-z0-9._-]+$/, "Solo minúsculas, números, punto, guion y guion bajo"),
  label: z.string().min(1, "La etiqueta es obligatoria"),
  icon: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().optional(),
});

export const updateCatalogCategorySchema = createCatalogCategorySchema.omit({ key: true }).partial();

export const createCatalogSubcategorySchema = z.object({
  categoryKey: z.string().min(1, "La categoría es obligatoria"),
  label: z.string().min(1, "La subcategoría es obligatoria"),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().optional(),
});

export const updateCatalogSubcategorySchema = createCatalogSubcategorySchema.partial();

export const createCategoryKeywordLinkSchema = z.object({
  categoryKey: z.string().nullable().optional(),
  subcategoryId: z.string().nullable().optional(),
  keyword: z.string().min(1, "La palabra clave es obligatoria"),
  kind: z.string().min(1).optional(),
}).refine((data) => !!(data.categoryKey || data.subcategoryId), {
  message: "Debes ligar la keyword a una categoría o subcategoría",
  path: ["categoryKey"],
});

export const updateAppSettingSchema = z.object({
  valueJson: z.any(),
  scope: z.string().min(1).optional(),
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
export type InsertBranch = typeof branches.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateBranchData = z.infer<typeof createBranchSchema>;
export type CreateBranchFormData = z.infer<typeof createBranchFormSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type CategoryKeyword = typeof categoryKeywords.$inferSelect;
export type InsertCategoryKeyword = z.infer<typeof insertCategoryKeywordSchema>;
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type SearchLog = typeof searchLogs.$inferSelect;
export type InsertSearchLog = z.infer<typeof insertSearchLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type SystemEvent = typeof systemEvents.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type Notification = typeof notifications.$inferSelect;

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
export type BranchClientCrm = typeof branchClientCrm.$inferSelect;
export type BranchCustomerBlock = typeof branchCustomerBlocks.$inferSelect;
export type CustomerReport = typeof customerReports.$inferSelect;

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "attended",
  "no_show",
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

export const bookingSourceEnum = pgEnum("booking_source", [
  "dashboard",
  "app",
]);

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
  lateCancellation: boolean("late_cancellation").notNull().default(false),
  source: bookingSourceEnum("source").notNull().default("dashboard"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reservationAuditLogs = pgTable("reservation_audit_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id", { length: 36 })
    .notNull()
    .references(() => classBookings.id),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  customerUserId: varchar("customer_user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  source: text("source").notNull().default("system"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("reservation_audit_logs_booking_idx").on(table.bookingId),
  index("reservation_audit_logs_branch_idx").on(table.branchId),
  index("reservation_audit_logs_created_at_idx").on(table.createdAt),
]);

export const insertClassScheduleSchema = createInsertSchema(classSchedules).omit({
  id: true,
  createdAt: true,
});

export const insertClassBookingSchema = createInsertSchema(classBookings).omit({
  id: true,
  createdAt: true,
});

export const insertReservationAuditLogSchema = createInsertSchema(reservationAuditLogs).omit({
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
export type ReservationAuditLog = typeof reservationAuditLogs.$inferSelect;
export type InsertReservationAuditLog = z.infer<typeof insertReservationAuditLogSchema>;

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
  cycleMonths: z.number().int().min(0).default(1),
});

export const assignPlanSchema = z.object({
  planId: z.string().min(1, "Se requiere un plan"),
});

export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;

export const createClientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().optional(),
  email: z.string().email("Correo electrónico inválido"),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(["M", "F", "NE"]).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  gender: z.enum(["M", "F", "NE"]).nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
  injuriesNotes: z.string().nullable().optional(),
  medicalWarnings: z.string().nullable().optional(),
  parqAccepted: z.boolean().optional(),
  parqAcceptedDate: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export const branchClientCrmStatusValues = ["nuevo", "activo", "inactivo", "vip"] as const;
export const customerReportReasonValues = [
  "comentario_ofensivo",
  "mal_comportamiento",
  "no_respeto_reglas",
  "spam",
  "otro",
] as const;
export const customerReportStatusValues = ["pending", "reviewed", "dismissed", "escalated"] as const;

export const updateBranchClientCrmSchema = z.object({
  clientStatus: z.enum(branchClientCrmStatusValues).nullable().optional(),
  tags: z.string().nullable().optional(),
});

export const createCustomerReportSchema = z.object({
  reason: z.enum(customerReportReasonValues),
  note: z.string().nullable().optional(),
  blockLocally: z.boolean().optional(),
});

export const updateBranchCustomerBlockSchema = z.object({
  reason: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const updateCustomerReportStatusSchema = z.object({
  status: z.enum(customerReportStatusValues),
});

export const updateCustomerGlobalBlockSchema = z.object({
  isBlocked: z.boolean(),
  reason: z.string().nullable().optional(),
  hideReviews: z.boolean().optional(),
});

export const pushPlatformValues = ["ios", "android", "web"] as const;

export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
});

export const registerPushTokenSchema = z.object({
  token: z.string().min(1, "Token requerido").max(4096),
  platform: z.enum(pushPlatformValues),
  deviceName: z.string().max(120).nullable().optional(),
});

export const unregisterPushTokenSchema = z.object({
  token: z.string().min(1, "Token requerido").max(4096),
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
  type: text("type").notNull().default("product"),
  durationMinutes: integer("duration_minutes"),
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

export const branchAnnouncements = pgTable("branch_announcements", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  message: text("message").notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertBranchAnnouncementSchema = createInsertSchema(branchAnnouncements).omit({
  id: true,
  createdAt: true,
});

export type BranchAnnouncement = typeof branchAnnouncements.$inferSelect;
export type InsertBranchAnnouncement = z.infer<typeof insertBranchAnnouncementSchema>;

export const branchReviews = pgTable("branch_reviews", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  adminReply: text("admin_reply"),
  isHidden: boolean("is_hidden").notNull().default(false),
  hiddenReason: text("hidden_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reviewReportStatusEnum = pgEnum("review_report_status", [
  "pending",
  "reviewed",
  "dismissed",
]);

export const reviewReports = pgTable("review_reports", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id", { length: 36 })
    .notNull()
    .references(() => branchReviews.id),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  reporterUserId: varchar("reporter_user_id", { length: 36 }).references(() => users.id),
  reportedByRole: text("reported_by_role").notNull().default("CUSTOMER"),
  reason: text("reason").notNull(),
  note: text("note"),
  status: reviewReportStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  reviewedByUserId: varchar("reviewed_by_user_id", { length: 36 }).references(() => users.id),
  resolutionNote: text("resolution_note"),
}, (table) => [
  index("review_reports_review_idx").on(table.reviewId),
  index("review_reports_branch_idx").on(table.branchId),
  index("review_reports_status_idx").on(table.status),
]);

export const reviewModerationLogs = pgTable("review_moderation_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id", { length: 36 })
    .notNull()
    .references(() => branchReviews.id),
  action: text("action").notNull(),
  actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("review_moderation_logs_review_idx").on(table.reviewId),
  index("review_moderation_logs_created_at_idx").on(table.createdAt),
]);

export const notificationJobs = pgTable("notification_jobs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  branchId: varchar("branch_id", { length: 36 }).references(() => branches.id),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  payload: jsonb("payload"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("notification_jobs_status_idx").on(table.status),
  index("notification_jobs_scheduled_for_idx").on(table.scheduledFor),
  index("notification_jobs_branch_idx").on(table.branchId),
]);

export const branchFinanceEntries = pgTable("branch_finance_entries", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  type: text("type").notNull(),
  category: text("category"),
  concept: text("concept").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  clientUserId: varchar("client_user_id", { length: 36 }).references(() => users.id),
  clientName: text("client_name"),
  notes: text("notes"),
  entryDate: date("entry_date").notNull(),
  source: text("source"),
  sourceId: varchar("source_id", { length: 36 }),
  metadata: jsonb("metadata"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_finance_entries_branch_idx").on(table.branchId),
  index("branch_finance_entries_entry_date_idx").on(table.entryDate),
  index("branch_finance_entries_type_idx").on(table.type),
  index("branch_finance_entries_deleted_at_idx").on(table.deletedAt),
  index("branch_finance_entries_client_user_idx").on(table.clientUserId),
]);

export const branchMonthlyBilling = pgTable("branch_monthly_billing", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => branches.id),
  monthlyFeeAmount: numeric("monthly_fee_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentDay: integer("payment_day").notNull(),
  lastPaymentDate: date("last_payment_date"),
  nextPaymentDate: date("next_payment_date"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  sellerName: text("seller_name"),
  sellerCommissionAmount: numeric("seller_commission_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("branch_monthly_billing_status_idx").on(table.paymentStatus),
  index("branch_monthly_billing_next_payment_date_idx").on(table.nextPaymentDate),
  index("branch_monthly_billing_seller_name_idx").on(table.sellerName),
]);

export const insertBranchReviewSchema = createInsertSchema(branchReviews).omit({
  id: true,
  createdAt: true,
});

export const insertReviewReportSchema = createInsertSchema(reviewReports).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertReviewModerationLogSchema = createInsertSchema(reviewModerationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationJobSchema = createInsertSchema(notificationJobs).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertBranchFinanceEntrySchema = createInsertSchema(branchFinanceEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchMonthlyBillingSchema = createInsertSchema(branchMonthlyBilling).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BranchReview = typeof branchReviews.$inferSelect;
export type InsertBranchReview = z.infer<typeof insertBranchReviewSchema>;
export type ReviewReport = typeof reviewReports.$inferSelect;
export type InsertReviewReport = z.infer<typeof insertReviewReportSchema>;
export type ReviewModerationLog = typeof reviewModerationLogs.$inferSelect;
export type InsertReviewModerationLog = z.infer<typeof insertReviewModerationLogSchema>;
export type NotificationJob = typeof notificationJobs.$inferSelect;
export type InsertNotificationJob = z.infer<typeof insertNotificationJobSchema>;
export type BranchFinanceEntry = typeof branchFinanceEntries.$inferSelect;
export type InsertBranchFinanceEntry = z.infer<typeof insertBranchFinanceEntrySchema>;
export type BranchMonthlyBilling = typeof branchMonthlyBilling.$inferSelect;
export type InsertBranchMonthlyBilling = z.infer<typeof insertBranchMonthlyBillingSchema>;

// ─── Password Reset Tokens ───────────────────────────────────────────────────
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const promotions = pgTable("promotions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 }).notNull().references(() => branches.id),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  isGlobal: boolean("is_global").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true });
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotions.$inferSelect;

export const reviewReportReasonValues = [
  "ofensiva",
  "spam",
  "falsa",
  "acoso",
  "otro",
] as const;

export const reviewReportStatusValues = ["pending", "reviewed", "dismissed"] as const;

export const createReviewReportSchema = z.object({
  reason: z.enum(reviewReportReasonValues),
  note: z.string().nullable().optional(),
});

export const updateReviewReportStatusSchema = z.object({
  status: z.enum(reviewReportStatusValues),
  resolutionNote: z.string().nullable().optional(),
});

export const updateReviewReplySchema = z.object({
  adminReply: z.string().nullable().optional(),
});

export const updateReviewVisibilitySchema = z.object({
  hidden: z.boolean(),
  reason: z.string().nullable().optional(),
});

export const branchFinanceEntryTypeValues = ["income", "expense"] as const;
export const branchFinanceIncomeCategories = [
  "membresia",
  "paquete",
  "servicio",
  "producto",
  "clase",
  "otro",
] as const;
export const branchFinanceExpenseCategories = [
  "renta",
  "productos",
  "sueldos",
  "mantenimiento",
  "publicidad",
  "otro",
] as const;
export const branchFinancePaymentMethodValues = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "mercado_pago",
  "otro",
] as const;
export const monthlyBillingStatusValues = [
  "pending",
  "paid",
  "overdue",
] as const;

export const createBranchFinanceEntrySchema = z.object({
  type: z.enum(branchFinanceEntryTypeValues),
  category: z.string().min(1, "La categoria es obligatoria").nullable().optional(),
  concept: z.string().min(1, "El concepto es obligatorio").max(160, "Maximo 160 caracteres"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  paymentMethod: z.enum(branchFinancePaymentMethodValues).nullable().optional(),
  clientUserId: z.string().min(1).nullable().optional(),
  clientName: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  source: z.string().max(40).nullable().optional(),
  sourceId: z.string().max(36).nullable().optional(),
  metadata: z.any().optional(),
});

export const updateBranchFinanceEntrySchema = createBranchFinanceEntrySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const upsertBranchMonthlyBillingSchema = z.object({
  monthlyFeeAmount: z.coerce.number().min(0, "El monto no puede ser negativo"),
  paymentDay: z.coerce.number().int().min(1, "Debe ser del 1 al 31").max(31, "Debe ser del 1 al 31"),
  lastPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").nullable().optional(),
  nextPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").nullable().optional(),
  paymentStatus: z.enum(monthlyBillingStatusValues).optional(),
  sellerName: z.string().max(160, "Maximo 160 caracteres").nullable().optional(),
  sellerCommissionAmount: z.coerce.number().min(0, "La comision no puede ser negativa").optional(),
  notes: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
});

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

export const BRANCH_SUBCATEGORY_PLACEHOLDERS: Record<string, string> = {
  doctor: "Ej. Nutriologo, Ginecologo, Psicologo, Dentista",
  estetica: "Ej. Unas, Pestanas, Masajes, Barberia",
  freelancer: "Ej. Arquitecto, Fotografo, Contador, Disenador",
  otro: "Ej. Escuela de natacion, Veterinaria, Reposteria",
  default: "Ej. Especialidad principal del negocio",
};

export const BRANCH_SEARCH_KEYWORDS_PLACEHOLDER =
  "Ej. nutricion, dieta, bajar de peso";
