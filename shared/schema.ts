import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, doublePrecision, boolean, uniqueIndex, jsonb, integer, index, numeric, date, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { membershipPlanTaxModeValues } from "./membership-plan-tax";

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
  email: text("email"),
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
  localAccessProvisionedAt: timestamp("local_access_provisioned_at", { withTimezone: true }),
  localAccessProvisionedByBranchId: varchar("local_access_provisioned_by_branch_id", { length: 36 }).references(() => branches.id, { onDelete: "set null" }),
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
  taxMode: text("tax_mode"),
  taxRate: numeric("tax_rate", { precision: 8, scale: 4 }),
  durationDays: integer("duration_days"),
  classLimit: integer("class_limit"),
  cycleMonths: integer("cycle_months").notNull().default(1),
  leaseEnabled: boolean("lease_enabled").notNull().default(false),
  defaultLeaseTermMonths: integer("default_lease_term_months"),
  defaultLeasedItemDescription: text("default_leased_item_description"),
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
  bookingId: varchar("booking_id", { length: 36 }).references(() => classBookings.id, { onDelete: "set null" }),
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
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  medicalNotes: text("medical_notes"),
  injuriesNotes: text("injuries_notes"),
  medicalWarnings: text("medical_warnings"),
  parqAccepted: boolean("parq_accepted").notNull().default(false),
  parqAcceptedDate: text("parq_accepted_date"),
  privateProfileInitialized: boolean("private_profile_initialized").notNull().default(false),
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
  classConsumed: boolean("class_consumed"),
  classConsumedAt: timestamp("class_consumed_at", { withTimezone: true }),
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
  taxMode: z.enum(membershipPlanTaxModeValues).nullable().optional(),
  taxRate: z.coerce.number().min(0, "La tasa de IVA no puede ser negativa").max(100, "La tasa de IVA no puede ser mayor a 100").nullable().optional(),
  durationDays: z.number().int().min(1).nullable().optional(),
  classLimit: z.number().int().min(1).nullable().optional(),
  cycleMonths: z.number().int().min(0).default(1),
  leaseEnabled: z.boolean().optional(),
  defaultLeaseTermMonths: z.number().int().min(1, "El plazo sugerido debe ser mayor a 0").max(120, "El plazo sugerido no puede ser mayor a 120 meses").nullable().optional(),
  defaultLeasedItemDescription: z.string().max(200, "El concepto sugerido no puede exceder 200 caracteres").nullable().optional().or(z.literal("")),
});

export const assignPlanSchema = z.object({
  planId: z.string().min(1, "Se requiere un plan"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio no es válida")
    .optional(),
});

export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;

export const createClientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().optional(),
  email: z.string().email("Correo electrónico inválido").nullable().optional().or(z.literal("")),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(["M", "F", "NE"]).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
  confirmPotentialDuplicate: z.boolean().optional(),
  reuseExistingClientId: z.string().optional(),
  continueWithoutAppAccess: z.boolean().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
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

export const updateBranchClientPrivateSchema = z.object({
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
  injuriesNotes: z.string().nullable().optional(),
  medicalWarnings: z.string().nullable().optional(),
  parqAccepted: z.boolean().optional(),
  parqAcceptedDate: z.string().nullable().optional(),
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

export const branchCommercialProducts = pgTable("branch_commercial_products", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  sku: text("sku"),
  barcode: text("barcode"),
  costAmount: numeric("cost_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  salePriceAmount: numeric("sale_price_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  isPublicVisible: boolean("is_public_visible").notNull().default(false),
  usesInventory: boolean("uses_inventory").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_commercial_products_branch_idx").on(table.branchId),
  index("branch_commercial_products_active_idx").on(table.isActive),
  index("branch_commercial_products_public_idx").on(table.isPublicVisible),
  index("branch_commercial_products_deleted_at_idx").on(table.deletedAt),
  index("branch_commercial_products_sku_idx").on(table.sku),
  index("branch_commercial_products_barcode_idx").on(table.barcode),
]);

export const branchCommercialProjects = pgTable("branch_commercial_projects", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  customerUserId: varchar("customer_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"),
  startDate: date("start_date").notNull(),
  expectedEndDate: date("expected_end_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("branch_commercial_projects_branch_code_unique").on(table.branchId, table.code),
  uniqueIndex("branch_commercial_projects_branch_id_id_unique").on(table.branchId, table.id),
  index("branch_commercial_projects_branch_status_deleted_idx").on(table.branchId, table.status, table.deletedAt),
  index("branch_commercial_projects_branch_start_date_idx").on(table.branchId, table.startDate),
  index("branch_commercial_projects_branch_customer_idx").on(table.branchId, table.customerUserId),
]);

export const branchSalespeople = pgTable("branch_salespeople", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  lastName: text("last_name"),
  phone: text("phone"),
  email: text("email"),
  employeeCode: text("employee_code"),
  roleLabel: text("role_label"),
  monthlyGoalAmount: numeric("monthly_goal_amount", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_salespeople_branch_idx").on(table.branchId),
  index("branch_salespeople_active_idx").on(table.isActive),
  index("branch_salespeople_user_idx").on(table.userId),
  index("branch_salespeople_deleted_at_idx").on(table.deletedAt),
  index("branch_salespeople_name_idx").on(table.name),
]);

// Note: partial unique idempotency/source indexes for the commercial sales flow
// live in migrations/0022_branch_sales_finance_idempotency.sql on purpose.
// Keep that migration as the source of truth instead of trying to recreate them via db:push.
export const branchSales = pgTable("branch_sales", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  projectId: varchar("project_id", { length: 36 }),
  folio: text("folio").notNull(),
  clientUserId: varchar("client_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  sellerId: varchar("seller_id", { length: 36 }).references(() => branchSalespeople.id, { onDelete: "set null" }),
  sellerUserId: varchar("seller_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  sellerNameSnapshot: text("seller_name_snapshot"),
  sellerMetadata: jsonb("seller_metadata"),
  channel: text("channel").notNull().default("dashboard_products"),
  status: text("status").notNull().default("completed"),
  subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxMode: text("tax_mode"),
  taxRate: numeric("tax_rate", { precision: 8, scale: 4 }),
  subtotalBeforeTax: numeric("subtotal_before_tax", { precision: 12, scale: 2 }),
  taxableSubtotal: numeric("taxable_subtotal", { precision: 12, scale: 2 }),
  taxTotal: numeric("tax_total", { precision: 12, scale: 2 }),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }),
  idempotencyKey: varchar("idempotency_key", { length: 120 }),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledByUserId: varchar("cancelled_by_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  cancellationReason: text("cancellation_reason"),
  cancellationIdempotencyKey: varchar("cancellation_idempotency_key", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.branchId, table.projectId],
    foreignColumns: [branchCommercialProjects.branchId, branchCommercialProjects.id],
    name: "branch_sales_branch_project_fk",
  }).onDelete("restrict"),
  uniqueIndex("branch_sales_branch_folio_unique").on(table.branchId, table.folio),
  index("branch_sales_branch_idx").on(table.branchId),
  index("branch_sales_branch_project_idx").on(table.branchId, table.projectId),
  index("branch_sales_branch_project_status_idx").on(table.branchId, table.projectId, table.status),
  index("branch_sales_created_at_idx").on(table.createdAt),
  index("branch_sales_client_user_idx").on(table.clientUserId),
  index("branch_sales_seller_idx").on(table.sellerId),
  index("branch_sales_status_idx").on(table.status),
]);

export const branchSaleItems = pgTable("branch_sale_items", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id", { length: 36 })
    .notNull()
    .references(() => branchSales.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  itemType: text("item_type").notNull(),
  commercialProductId: varchar("commercial_product_id", { length: 36 }).references(() => branchCommercialProducts.id, { onDelete: "set null" }),
  serviceId: varchar("service_id", { length: 36 }).references(() => branchServices.id, { onDelete: "set null" }),
  planId: varchar("plan_id", { length: 36 }).references(() => membershipPlans.id, { onDelete: "set null" }),
  nameSnapshot: text("name_snapshot").notNull(),
  categorySnapshot: text("category_snapshot"),
  quantity: integer("quantity").notNull(),
  unitPriceAmount: numeric("unit_price_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  costAmountSnapshot: numeric("cost_amount_snapshot", { precision: 12, scale: 2 }).notNull().default("0"),
  lineTotalAmount: numeric("line_total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("branch_sale_items_sale_idx").on(table.saleId),
  index("branch_sale_items_branch_idx").on(table.branchId),
  index("branch_sale_items_commercial_product_idx").on(table.commercialProductId),
  index("branch_sale_items_item_type_idx").on(table.itemType),
]);

export const branchSalePayments = pgTable("branch_sale_payments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id", { length: 36 })
    .notNull()
    .references(() => branchSales.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  paymentMethod: text("payment_method").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("branch_sale_payments_sale_idx").on(table.saleId),
  index("branch_sale_payments_branch_idx").on(table.branchId),
  index("branch_sale_payments_paid_at_idx").on(table.paidAt),
]);

export const branchCommissionRules = pgTable("branch_commission_rules", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  salespersonId: varchar("salesperson_id", { length: 36 })
    .notNull()
    .references(() => branchSalespeople.id),
  name: text("name").notNull(),
  ruleType: text("rule_type").notNull(),
  percentageRate: numeric("percentage_rate", { precision: 8, scale: 4 }),
  fixedAmount: numeric("fixed_amount", { precision: 12, scale: 2 }),
  commercialProductId: varchar("commercial_product_id", { length: 36 }).references(() => branchCommercialProducts.id, { onDelete: "set null" }),
  category: text("category"),
  minimumGoalAmount: numeric("minimum_goal_amount", { precision: 12, scale: 2 }),
  bonusAmount: numeric("bonus_amount", { precision: 12, scale: 2 }),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_commission_rules_branch_idx").on(table.branchId),
  index("branch_commission_rules_salesperson_idx").on(table.salespersonId),
  index("branch_commission_rules_active_idx").on(table.isActive),
  index("branch_commission_rules_deleted_at_idx").on(table.deletedAt),
  index("branch_commission_rules_type_idx").on(table.ruleType),
  index("branch_commission_rules_product_idx").on(table.commercialProductId),
]);

export const branchCommissionAccruals = pgTable("branch_commission_accruals", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  salespersonId: varchar("salesperson_id", { length: 36 })
    .notNull()
    .references(() => branchSalespeople.id),
  saleId: varchar("sale_id", { length: 36 }).references(() => branchSales.id, { onDelete: "set null" }),
  saleItemId: varchar("sale_item_id", { length: 36 }).references(() => branchSaleItems.id, { onDelete: "set null" }),
  commissionRuleId: varchar("commission_rule_id", { length: 36 }).references(() => branchCommissionRules.id, { onDelete: "set null" }),
  accrualType: text("accrual_type").notNull().default("sale"),
  referenceKey: text("reference_key").notNull(),
  periodMonth: text("period_month"),
  status: text("status").notNull().default("approved"),
  baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  rateSnapshot: numeric("rate_snapshot", { precision: 8, scale: 4 }),
  fixedAmountSnapshot: numeric("fixed_amount_snapshot", { precision: 12, scale: 2 }),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  salespersonNameSnapshot: text("salesperson_name_snapshot").notNull(),
  ruleNameSnapshot: text("rule_name_snapshot"),
  calculationSnapshot: jsonb("calculation_snapshot"),
  accruedAt: timestamp("accrued_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("branch_commission_accruals_branch_reference_unique").on(table.branchId, table.referenceKey),
  index("branch_commission_accruals_branch_idx").on(table.branchId),
  index("branch_commission_accruals_salesperson_idx").on(table.salespersonId),
  index("branch_commission_accruals_sale_idx").on(table.saleId),
  index("branch_commission_accruals_status_idx").on(table.status),
  index("branch_commission_accruals_accrued_at_idx").on(table.accruedAt),
  index("branch_commission_accruals_period_month_idx").on(table.periodMonth),
]);

export const branchCommissionPayments = pgTable("branch_commission_payments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  salespersonId: varchar("salesperson_id", { length: 36 })
    .notNull()
    .references(() => branchSalespeople.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 120 }),
  reference: text("reference"),
  notes: text("notes"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("branch_commission_payments_branch_idx").on(table.branchId),
  index("branch_commission_payments_salesperson_idx").on(table.salespersonId),
  index("branch_commission_payments_paid_at_idx").on(table.paidAt),
]);

export const branchCommissionPaymentAllocations = pgTable("branch_commission_payment_allocations", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  commissionPaymentId: varchar("commission_payment_id", { length: 36 })
    .notNull()
    .references(() => branchCommissionPayments.id, { onDelete: "cascade" }),
  commissionAccrualId: varchar("commission_accrual_id", { length: 36 })
    .notNull()
    .references(() => branchCommissionAccruals.id, { onDelete: "cascade" }),
  amountAllocated: numeric("amount_allocated", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("branch_commission_allocations_payment_accrual_unique").on(table.commissionPaymentId, table.commissionAccrualId),
  index("branch_commission_allocations_branch_idx").on(table.branchId),
  index("branch_commission_allocations_payment_idx").on(table.commissionPaymentId),
  index("branch_commission_allocations_accrual_idx").on(table.commissionAccrualId),
]);

export const branchInventoryBalances = pgTable("branch_inventory_balances", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  commercialProductId: varchar("commercial_product_id", { length: 36 })
    .notNull()
    .references(() => branchCommercialProducts.id),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(0),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("branch_inventory_balances_branch_product_unique").on(table.branchId, table.commercialProductId),
  index("branch_inventory_balances_branch_idx").on(table.branchId),
  index("branch_inventory_balances_product_idx").on(table.commercialProductId),
]);

export const branchSuppliers = pgTable("branch_suppliers", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  taxId: text("tax_id"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_suppliers_branch_idx").on(table.branchId),
  index("branch_suppliers_active_idx").on(table.isActive),
  index("branch_suppliers_deleted_at_idx").on(table.deletedAt),
  index("branch_suppliers_name_idx").on(table.name),
]);

export const branchPurchases = pgTable("branch_purchases", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  projectId: varchar("project_id", { length: 36 }),
  folio: text("folio").notNull(),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => branchSuppliers.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"),
  purchaseDate: date("purchase_date").notNull(),
  expectedDate: date("expected_date"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paymentMethod: text("payment_method"),
  subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxMode: text("tax_mode"),
  taxRate: numeric("tax_rate", { precision: 8, scale: 4 }),
  subtotalBeforeTax: numeric("subtotal_before_tax", { precision: 12, scale: 2 }),
  taxableSubtotal: numeric("taxable_subtotal", { precision: 12, scale: 2 }),
  taxTotal: numeric("tax_total", { precision: 12, scale: 2 }),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  reference: text("reference"),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.branchId, table.projectId],
    foreignColumns: [branchCommercialProjects.branchId, branchCommercialProjects.id],
    name: "branch_purchases_branch_project_fk",
  }).onDelete("restrict"),
  uniqueIndex("branch_purchases_branch_folio_unique").on(table.branchId, table.folio),
  index("branch_purchases_branch_idx").on(table.branchId),
  index("branch_purchases_branch_project_idx").on(table.branchId, table.projectId),
  index("branch_purchases_branch_project_status_idx").on(table.branchId, table.projectId, table.status),
  index("branch_purchases_supplier_idx").on(table.supplierId),
  index("branch_purchases_status_idx").on(table.status),
  index("branch_purchases_payment_status_idx").on(table.paymentStatus),
  index("branch_purchases_purchase_date_idx").on(table.purchaseDate),
  index("branch_purchases_created_at_idx").on(table.createdAt),
]);

export const branchPurchaseItems = pgTable("branch_purchase_items", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id", { length: 36 })
    .notNull()
    .references(() => branchPurchases.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  commercialProductId: varchar("commercial_product_id", { length: 36 }).references(() => branchCommercialProducts.id, { onDelete: "set null" }),
  nameSnapshot: text("name_snapshot").notNull(),
  skuSnapshot: text("sku_snapshot"),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("branch_purchase_items_purchase_idx").on(table.purchaseId),
  index("branch_purchase_items_branch_idx").on(table.branchId),
  index("branch_purchase_items_commercial_product_idx").on(table.commercialProductId),
]);

export const branchInventoryMovements = pgTable("branch_inventory_movements", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  commercialProductId: varchar("commercial_product_id", { length: 36 })
    .notNull()
    .references(() => branchCommercialProducts.id),
  movementType: text("movement_type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  quantityBefore: integer("quantity_before").notNull(),
  quantityAfter: integer("quantity_after").notNull(),
  unitCostSnapshot: numeric("unit_cost_snapshot", { precision: 12, scale: 2 }),
  reason: text("reason").notNull(),
  notes: text("notes"),
  saleId: varchar("sale_id", { length: 36 }).references(() => branchSales.id, { onDelete: "set null" }),
  saleItemId: varchar("sale_item_id", { length: 36 }).references(() => branchSaleItems.id, { onDelete: "set null" }),
  purchaseId: varchar("purchase_id", { length: 36 }).references(() => branchPurchases.id, { onDelete: "set null" }),
  purchaseItemId: varchar("purchase_item_id", { length: 36 }).references(() => branchPurchaseItems.id, { onDelete: "set null" }),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("branch_inventory_movements_branch_idx").on(table.branchId),
  index("branch_inventory_movements_product_idx").on(table.commercialProductId),
  index("branch_inventory_movements_type_idx").on(table.movementType),
  index("branch_inventory_movements_created_at_idx").on(table.createdAt),
  index("branch_inventory_movements_sale_idx").on(table.saleId),
  index("branch_inventory_movements_purchase_idx").on(table.purchaseId),
]);

export const branchServices = pgTable("branch_services", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  baseDurationMinutes: integer("base_duration_minutes"),
  capacity: integer("capacity"),
  requiresAgenda: boolean("requires_agenda").notNull().default(false),
  visibility: text("visibility").notNull().default("public"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_services_branch_idx").on(table.branchId),
  index("branch_services_active_idx").on(table.isActive),
  index("branch_services_deleted_at_idx").on(table.deletedAt),
  index("branch_services_category_idx").on(table.category),
]);

export const branchServiceSaleOptions = pgTable("branch_service_sale_options", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  serviceId: varchar("service_id", { length: 36 })
    .notNull()
    .references(() => branchServices.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("individual"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  includedUses: integer("included_uses"),
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  validityDays: integer("validity_days"),
  requiresRegisteredClient: boolean("requires_registered_client").notNull().default(false),
  allowsWalkIn: boolean("allows_walk_in").notNull().default(true),
  isPosFavorite: boolean("is_pos_favorite").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  internalNotes: text("internal_notes"),
  displayOrder: integer("display_order").notNull().default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_service_sale_options_branch_idx").on(table.branchId),
  index("branch_service_sale_options_service_idx").on(table.serviceId),
  index("branch_service_sale_options_type_idx").on(table.type),
  index("branch_service_sale_options_active_idx").on(table.isActive),
  index("branch_service_sale_options_deleted_at_idx").on(table.deletedAt),
]);

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

export const insertBranchCommercialProductSchema = createInsertSchema(branchCommercialProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchCommercialProjectSchema = createInsertSchema(branchCommercialProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchSalespersonSchema = createInsertSchema(branchSalespeople).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchSaleSchema = createInsertSchema(branchSales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBranchSaleItemSchema = createInsertSchema(branchSaleItems).omit({
  id: true,
  createdAt: true,
});

export const insertBranchSalePaymentSchema = createInsertSchema(branchSalePayments).omit({
  id: true,
  createdAt: true,
});

export const insertBranchCommissionRuleSchema = createInsertSchema(branchCommissionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchCommissionAccrualSchema = createInsertSchema(branchCommissionAccruals).omit({
  id: true,
  createdAt: true,
});

export const insertBranchCommissionPaymentSchema = createInsertSchema(branchCommissionPayments).omit({
  id: true,
  createdAt: true,
});

export const insertBranchCommissionPaymentAllocationSchema = createInsertSchema(branchCommissionPaymentAllocations).omit({
  id: true,
  createdAt: true,
});

export const insertBranchInventoryBalanceSchema = createInsertSchema(branchInventoryBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBranchSupplierSchema = createInsertSchema(branchSuppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchPurchaseSchema = createInsertSchema(branchPurchases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
});

export const insertBranchPurchaseItemSchema = createInsertSchema(branchPurchaseItems).omit({
  id: true,
  createdAt: true,
});

export const insertBranchInventoryMovementSchema = createInsertSchema(branchInventoryMovements).omit({
  id: true,
  createdAt: true,
});

export const insertBranchServiceSchema = createInsertSchema(branchServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchServiceSaleOptionSchema = createInsertSchema(branchServiceSaleOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
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
export type BranchCommercialProduct = typeof branchCommercialProducts.$inferSelect;
export type InsertBranchCommercialProduct = z.infer<typeof insertBranchCommercialProductSchema>;
export type BranchCommercialProject = typeof branchCommercialProjects.$inferSelect;
export type InsertBranchCommercialProject = z.infer<typeof insertBranchCommercialProjectSchema>;
export type BranchSalesperson = typeof branchSalespeople.$inferSelect;
export type InsertBranchSalesperson = z.infer<typeof insertBranchSalespersonSchema>;
export type BranchSale = typeof branchSales.$inferSelect;
export type InsertBranchSale = z.infer<typeof insertBranchSaleSchema>;
export type BranchSaleItem = typeof branchSaleItems.$inferSelect;
export type InsertBranchSaleItem = z.infer<typeof insertBranchSaleItemSchema>;
export type BranchSalePayment = typeof branchSalePayments.$inferSelect;
export type InsertBranchSalePayment = z.infer<typeof insertBranchSalePaymentSchema>;
export type BranchCommissionRule = typeof branchCommissionRules.$inferSelect;
export type InsertBranchCommissionRule = z.infer<typeof insertBranchCommissionRuleSchema>;
export type BranchCommissionAccrual = typeof branchCommissionAccruals.$inferSelect;
export type InsertBranchCommissionAccrual = z.infer<typeof insertBranchCommissionAccrualSchema>;
export type BranchCommissionPayment = typeof branchCommissionPayments.$inferSelect;
export type InsertBranchCommissionPayment = z.infer<typeof insertBranchCommissionPaymentSchema>;
export type BranchCommissionPaymentAllocation = typeof branchCommissionPaymentAllocations.$inferSelect;
export type InsertBranchCommissionPaymentAllocation = z.infer<typeof insertBranchCommissionPaymentAllocationSchema>;
export type BranchInventoryBalance = typeof branchInventoryBalances.$inferSelect;
export type InsertBranchInventoryBalance = z.infer<typeof insertBranchInventoryBalanceSchema>;
export type BranchSupplier = typeof branchSuppliers.$inferSelect;
export type InsertBranchSupplier = z.infer<typeof insertBranchSupplierSchema>;
export type BranchPurchase = typeof branchPurchases.$inferSelect;
export type InsertBranchPurchase = z.infer<typeof insertBranchPurchaseSchema>;
export type BranchPurchaseItem = typeof branchPurchaseItems.$inferSelect;
export type InsertBranchPurchaseItem = z.infer<typeof insertBranchPurchaseItemSchema>;
export type BranchInventoryMovement = typeof branchInventoryMovements.$inferSelect;
export type InsertBranchInventoryMovement = z.infer<typeof insertBranchInventoryMovementSchema>;
export type BranchService = typeof branchServices.$inferSelect;
export type InsertBranchService = z.infer<typeof insertBranchServiceSchema>;
export type BranchServiceSaleOption = typeof branchServiceSaleOptions.$inferSelect;
export type InsertBranchServiceSaleOption = z.infer<typeof insertBranchServiceSaleOptionSchema>;
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
  sourceId: varchar("source_id", { length: 120 }),
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

export const branchChargeEventDomainValues = ["membership_plan", "lease_installment"] as const;
export const branchChargeEventTypeValues = ["assign", "renew", "payment"] as const;
export const branchLeaseInstallmentPaymentSourceValues = ["webcool", "external"] as const;
export type BranchLeaseInstallmentPaymentSource = (typeof branchLeaseInstallmentPaymentSourceValues)[number];

export const branchLeaseContracts = pgTable("branch_lease_contracts", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  membershipId: varchar("membership_id", { length: 36 }).references(() => memberships.id, { onDelete: "set null" }),
  planId: varchar("plan_id", { length: 36 }).references(() => membershipPlans.id, { onDelete: "set null" }),
  clientUserId: varchar("client_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  contractStartDate: date("contract_start_date").notNull(),
  contractEndDate: date("contract_end_date").notNull(),
  contractTermMonths: integer("contract_term_months").notNull(),
  preWebcoolPaidInstallments: integer("pre_webcool_paid_installments").notNull().default(0),
  leasedItemDescription: text("leased_item_description").notNull(),
  notes: text("notes"),
  capturedPriceCents: integer("captured_price_cents").notNull().default(0),
  assetValueCents: integer("asset_value_cents"),
  assetSubtotalBeforeTaxCents: integer("asset_subtotal_before_tax_cents"),
  assetTaxableSubtotalCents: integer("asset_taxable_subtotal_cents"),
  assetTaxTotalCents: integer("asset_tax_total_cents"),
  assetFinalTotalCents: integer("asset_final_total_cents"),
  downPaymentType: text("down_payment_type"),
  downPaymentRate: numeric("down_payment_rate", { precision: 8, scale: 4 }),
  downPaymentInputCents: integer("down_payment_input_cents"),
  downPaymentSubtotalBeforeTaxCents: integer("down_payment_subtotal_before_tax_cents"),
  downPaymentTaxableSubtotalCents: integer("down_payment_taxable_subtotal_cents"),
  downPaymentTaxTotalCents: integer("down_payment_tax_total_cents"),
  downPaymentFinalTotalCents: integer("down_payment_final_total_cents"),
  financedPrincipalBeforeTaxCents: integer("financed_principal_before_tax_cents"),
  financialSurchargeRate: numeric("financial_surcharge_rate", { precision: 8, scale: 4 }),
  financialSurchargeTotalCents: integer("financial_surcharge_total_cents"),
  financedSubtotalBeforeTaxCents: integer("financed_subtotal_before_tax_cents"),
  financedTaxableSubtotalCents: integer("financed_taxable_subtotal_cents"),
  financedTaxTotalCents: integer("financed_tax_total_cents"),
  financedFinalTotalCents: integer("financed_final_total_cents"),
  contractFinalTotalCents: integer("contract_final_total_cents"),
  taxModeSnapshot: text("tax_mode_snapshot"),
  taxRateSnapshot: numeric("tax_rate_snapshot", { precision: 8, scale: 4 }),
  monthlySubtotalBeforeTaxCents: integer("monthly_subtotal_before_tax_cents"),
  monthlyTaxableSubtotalCents: integer("monthly_taxable_subtotal_cents"),
  monthlyTaxTotalCents: integer("monthly_tax_total_cents"),
  monthlyFinalTotalCents: integer("monthly_final_total_cents").notNull().default(0),
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default("MXN"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
}, (table) => [
  index("branch_lease_contracts_branch_membership_created_idx").on(table.branchId, table.membershipId, table.createdAt),
  index("branch_lease_contracts_branch_client_created_idx").on(table.branchId, table.clientUserId, table.createdAt),
  index("branch_lease_contracts_branch_plan_created_idx").on(table.branchId, table.planId, table.createdAt),
  index("branch_lease_contracts_branch_end_date_idx").on(table.branchId, table.contractEndDate),
]);

export const branchChargeEvents = pgTable("branch_charge_events", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  chargeDomain: text("charge_domain").notNull(),
  eventType: text("event_type").notNull(),
  operationKey: varchar("operation_key", { length: 120 }).notNull(),
  membershipId: varchar("membership_id", { length: 36 }).references(() => memberships.id, { onDelete: "set null" }),
  planId: varchar("plan_id", { length: 36 }).references(() => membershipPlans.id, { onDelete: "set null" }),
  clientUserId: varchar("client_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  leaseContractId: varchar("lease_contract_id", { length: 36 }),
  leaseInstallmentId: varchar("lease_installment_id", { length: 36 }),
  financeEntryId: varchar("finance_entry_id", { length: 36 }).references(() => branchFinanceEntries.id, { onDelete: "set null" }),
  planNameSnapshot: text("plan_name_snapshot").notNull(),
  basePriceCents: integer("base_price_cents").notNull().default(0),
  taxMode: text("tax_mode"),
  taxRate: numeric("tax_rate", { precision: 8, scale: 4 }),
  subtotalBeforeTaxCents: integer("subtotal_before_tax_cents"),
  taxableSubtotalCents: integer("taxable_subtotal_cents"),
  taxTotalCents: integer("tax_total_cents"),
  finalTotalCents: integer("final_total_cents").notNull().default(0),
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default("MXN"),
  chargedAt: timestamp("charged_at", { withTimezone: true }).defaultNow().notNull(),
  snapshotVersion: integer("snapshot_version").notNull().default(1),
  contextJson: jsonb("context_json"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.leaseContractId],
    foreignColumns: [branchLeaseContracts.id],
    name: "branch_charge_events_lease_contract_fk",
  }).onDelete("set null"),
  uniqueIndex("branch_charge_events_branch_operation_key_unique").on(table.branchId, table.operationKey),
  index("branch_charge_events_branch_membership_created_idx").on(table.branchId, table.membershipId, table.createdAt),
  index("branch_charge_events_branch_client_charged_idx").on(table.branchId, table.clientUserId, table.chargedAt),
  index("branch_charge_events_branch_domain_event_charged_idx").on(table.branchId, table.chargeDomain, table.eventType, table.chargedAt),
  index("branch_charge_events_branch_lease_contract_charged_idx").on(table.branchId, table.leaseContractId, table.chargedAt),
]);

export const branchLeaseInstallments = pgTable("branch_lease_installments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  leaseContractId: varchar("lease_contract_id", { length: 36 })
    .notNull()
    .references(() => branchLeaseContracts.id),
  installmentNumber: integer("installment_number").notNull(),
  dueDate: date("due_date").notNull(),
  subtotalBeforeTaxCents: integer("subtotal_before_tax_cents").notNull().default(0),
  taxableSubtotalCents: integer("taxable_subtotal_cents").notNull().default(0),
  taxTotalCents: integer("tax_total_cents").notNull().default(0),
  finalTotalCents: integer("final_total_cents").notNull().default(0),
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default("MXN"),
  paymentSource: text("payment_source").$type<BranchLeaseInstallmentPaymentSource | null>(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  financeEntryId: varchar("finance_entry_id", { length: 36 }).references(() => branchFinanceEntries.id),
  chargeEventId: varchar("charge_event_id", { length: 36 }).references(() => branchChargeEvents.id),
  recordedByUserId: varchar("recorded_by_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("branch_lease_installments_branch_contract_number_unique").on(table.branchId, table.leaseContractId, table.installmentNumber),
  uniqueIndex("branch_lease_installments_finance_entry_unique")
    .on(table.financeEntryId)
    .where(sql`${table.financeEntryId} IS NOT NULL`),
  uniqueIndex("branch_lease_installments_charge_event_unique")
    .on(table.chargeEventId)
    .where(sql`${table.chargeEventId} IS NOT NULL`),
  index("branch_lease_installments_branch_contract_due_idx").on(table.branchId, table.leaseContractId, table.dueDate),
  index("branch_lease_installments_branch_payment_source_due_idx").on(table.branchId, table.paymentSource, table.dueDate),
]);

export const branchRecurringExpenses = pgTable("branch_recurring_expenses", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  category: text("category").notNull().default("otro"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  paymentDay: integer("payment_day"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  lastRegisteredAt: timestamp("last_registered_at", { withTimezone: true }),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_recurring_expenses_branch_idx").on(table.branchId),
  index("branch_recurring_expenses_active_idx").on(table.isActive),
  index("branch_recurring_expenses_deleted_at_idx").on(table.deletedAt),
]);

export const branchStaffMembers = pgTable("branch_staff_members", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  phone: text("phone"),
  payPerClass: numeric("pay_per_class", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("branch_staff_members_branch_idx").on(table.branchId),
  index("branch_staff_members_active_idx").on(table.isActive),
  index("branch_staff_members_deleted_at_idx").on(table.deletedAt),
]);

export const branchStaffClassLogs = pgTable("branch_staff_class_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id", { length: 36 })
    .notNull()
    .references(() => branches.id),
  staffId: varchar("staff_id", { length: 36 })
    .notNull()
    .references(() => branchStaffMembers.id),
  classesCount: integer("classes_count").notNull(),
  paymentTotal: numeric("payment_total", { precision: 12, scale: 2 }).notNull(),
  classDate: date("class_date").notNull(),
  notes: text("notes"),
  financeEntryId: varchar("finance_entry_id", { length: 36 }).references(() => branchFinanceEntries.id),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("branch_staff_class_logs_branch_idx").on(table.branchId),
  index("branch_staff_class_logs_staff_idx").on(table.staffId),
  index("branch_staff_class_logs_class_date_idx").on(table.classDate),
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

export const insertBranchChargeEventSchema = createInsertSchema(branchChargeEvents).omit({
  id: true,
  createdAt: true,
});

export const insertBranchLeaseContractSchema = createInsertSchema(branchLeaseContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});

export const insertBranchRecurringExpenseSchema = createInsertSchema(branchRecurringExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  lastRegisteredAt: true,
});

export const insertBranchStaffMemberSchema = createInsertSchema(branchStaffMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBranchStaffClassLogSchema = createInsertSchema(branchStaffClassLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type BranchChargeEvent = typeof branchChargeEvents.$inferSelect;
export type InsertBranchChargeEvent = z.infer<typeof insertBranchChargeEventSchema>;
export type BranchLeaseContract = typeof branchLeaseContracts.$inferSelect;
export type InsertBranchLeaseContract = z.infer<typeof insertBranchLeaseContractSchema>;
export type BranchLeaseInstallment = typeof branchLeaseInstallments.$inferSelect;
export type BranchRecurringExpense = typeof branchRecurringExpenses.$inferSelect;
export type InsertBranchRecurringExpense = z.infer<typeof insertBranchRecurringExpenseSchema>;
export type BranchStaffMember = typeof branchStaffMembers.$inferSelect;
export type InsertBranchStaffMember = z.infer<typeof insertBranchStaffMemberSchema>;
export type BranchStaffClassLog = typeof branchStaffClassLogs.$inferSelect;
export type InsertBranchStaffClassLog = z.infer<typeof insertBranchStaffClassLogSchema>;
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
  "luz",
  "agua",
  "internet",
  "productos",
  "insumos",
  "sueldos",
  "secretaria",
  "enfermera",
  "limpieza",
  "profesor",
  "mantenimiento",
  "publicidad",
  "sales_commission",
  "otro",
] as const;
export const branchFinancePaymentMethodValues = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "mercado_pago",
  "otro",
] as const;
export const quickChargeSingleSessionSchema = z.object({
  customerName: z.string().min(1, "El nombre del cliente es obligatorio").max(160, "Maximo 160 caracteres"),
  whatsapp: z.string().max(40, "Maximo 40 caracteres").nullable().optional(),
  paymentMethod: z.enum(branchFinancePaymentMethodValues),
  note: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").optional(),
  requestId: z.string().max(120, "Maximo 120 caracteres").optional(),
});
export const monthlyBillingStatusValues = [
  "pending",
  "paid",
  "overdue",
] as const;
export const branchRecurringExpenseFrequencyValues = [
  "monthly",
  "weekly",
  "biweekly",
  "one_time",
] as const;
export const branchRecurringExpenseCategoryValues = [
  "renta",
  "luz",
  "agua",
  "internet",
  "nomina",
  "insumos",
  "secretaria",
  "enfermera",
  "limpieza",
  "publicidad",
  "otro",
] as const;
export const branchServiceVisibilityValues = [
  "public",
  "internal",
] as const;
export const branchServiceSaleOptionTypeValues = [
  "individual",
  "prueba",
  "paquete",
  "membresia",
  "day_pass",
  "gift_card",
  "especial",
] as const;
export const branchSaleStatusValues = [
  "draft",
  "completed",
  "cancelled",
] as const;
export const branchCommercialProjectStatusValues = [
  "draft",
  "active",
  "completed",
  "cancelled",
  "archived",
] as const;
export const branchSaleChannelValues = [
  "dashboard_products",
  "dashboard_manual",
  "pos_future",
] as const;
export const branchSaleTaxModeValues = membershipPlanTaxModeValues;
export const branchCommissionRuleTypeValues = [
  "percentage_all_sales",
  "fixed_per_sale",
  "percentage_product",
  "fixed_product",
  "percentage_category",
  "bonus_monthly_goal",
] as const;
export const branchCommissionAccrualTypeValues = [
  "sale",
  "monthly_bonus",
] as const;
export const branchCommissionAccrualStatusValues = [
  "accrued",
  "approved",
  "partially_paid",
  "paid",
  "reversed",
] as const;
export const branchSaleItemTypeValues = [
  "commercial_product",
  "service",
  "plan",
  "other",
] as const;
export const branchInventoryMovementTypeValues = [
  "initial",
  "manual_entry",
  "positive_adjustment",
  "negative_adjustment",
  "purchase",
  "sale",
  "sale_cancellation",
  "return",
  "waste",
  "damaged",
] as const;
export const branchInventoryStatusValues = [
  "not_tracked",
  "uninitialized",
  "available",
  "low_stock",
  "out_of_stock",
] as const;
export const branchPurchaseStatusValues = [
  "draft",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
] as const;
export const branchPurchasePaymentStatusValues = [
  "unpaid",
  "partial",
  "paid",
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
  sourceId: z.string().max(120).nullable().optional(),
  metadata: z.any().optional(),
});

export const updateBranchFinanceEntrySchema = createBranchFinanceEntrySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const registerLeaseInstallmentPaymentSchema = z.object({
  paymentMethod: z.enum(branchFinancePaymentMethodValues),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
});

export const createBranchRecurringExpenseSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  category: z.enum(branchRecurringExpenseCategoryValues),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  frequency: z.enum(branchRecurringExpenseFrequencyValues),
  paymentDay: z.coerce.number().int().min(1, "Debe ser del 1 al 31").max(31, "Debe ser del 1 al 31").nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateBranchRecurringExpenseSchema = createBranchRecurringExpenseSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const registerBranchRecurringExpenseChargeSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  paymentMethod: z.enum(branchFinancePaymentMethodValues).nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
});

export const createBranchStaffMemberSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  phone: z.string().max(40, "Maximo 40 caracteres").nullable().optional(),
  payPerClass: z.coerce.number().positive("El pago por clase debe ser mayor a 0"),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateBranchStaffMemberSchema = createBranchStaffMemberSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const createBranchStaffClassLogSchema = z.object({
  staffId: z.string().min(1, "El profesor o empleado es obligatorio"),
  classesCount: z.coerce.number().int().min(1, "Debes registrar al menos una clase"),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  paymentMethod: z.enum(branchFinancePaymentMethodValues).nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
});

export const createBranchSalespersonSchema = z.object({
  userId: z.string().min(1).nullable().optional(),
  name: z.string().min(1, "El nombre es obligatorio").max(120, "Maximo 120 caracteres"),
  lastName: z.string().max(120, "Maximo 120 caracteres").nullable().optional(),
  phone: z.string().max(40, "Maximo 40 caracteres").nullable().optional(),
  email: z.string().email("Correo invalido").max(160, "Maximo 160 caracteres").nullable().optional().or(z.literal("")),
  employeeCode: z.string().max(60, "Maximo 60 caracteres").nullable().optional(),
  roleLabel: z.string().max(120, "Maximo 120 caracteres").nullable().optional(),
  monthlyGoalAmount: z.coerce.number().min(0, "La meta no puede ser negativa").nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateBranchSalespersonSchema = createBranchSalespersonSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

const branchCommissionRuleDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");

const branchCommissionRuleSchemaBase = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  ruleType: z.enum(branchCommissionRuleTypeValues),
  percentageRate: z.coerce.number().min(0, "El porcentaje no puede ser negativo").max(100, "El porcentaje no puede ser mayor a 100").nullable().optional(),
  fixedAmount: z.coerce.number().min(0, "El monto fijo no puede ser negativo").nullable().optional(),
  commercialProductId: z.string().min(1).nullable().optional(),
  category: z.string().max(120, "Maximo 120 caracteres").nullable().optional(),
  minimumGoalAmount: z.coerce.number().min(0, "La meta minima no puede ser negativa").nullable().optional(),
  bonusAmount: z.coerce.number().min(0, "El bono no puede ser negativo").nullable().optional(),
  priority: z.coerce.number().int().min(0, "La prioridad no puede ser negativa").max(9999, "Prioridad demasiado alta").optional(),
  isActive: z.boolean().optional(),
  validFrom: branchCommissionRuleDateSchema.nullable().optional(),
  validUntil: branchCommissionRuleDateSchema.nullable().optional(),
});

function validateBranchCommissionRule(data: {
  ruleType?: string;
  percentageRate?: number | null;
  fixedAmount?: number | null;
  commercialProductId?: string | null;
  category?: string | null;
  minimumGoalAmount?: number | null;
  bonusAmount?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}, ctx: z.RefinementCtx) {
  const requiresPercentage = data.ruleType === "percentage_all_sales" || data.ruleType === "percentage_product" || data.ruleType === "percentage_category";
  const requiresFixed = data.ruleType === "fixed_per_sale" || data.ruleType === "fixed_product";
  const requiresProduct = data.ruleType === "percentage_product" || data.ruleType === "fixed_product";
  const requiresCategory = data.ruleType === "percentage_category";
  const requiresBonus = data.ruleType === "bonus_monthly_goal";

  if (requiresPercentage && (data.percentageRate == null || Number.isNaN(data.percentageRate))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentageRate"], message: "Esta regla requiere un porcentaje" });
  }
  if (requiresFixed && (data.fixedAmount == null || Number.isNaN(data.fixedAmount))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fixedAmount"], message: "Esta regla requiere un monto fijo" });
  }
  if (requiresProduct && !data.commercialProductId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["commercialProductId"], message: "Selecciona un producto para esta regla" });
  }
  if (requiresCategory && !data.category?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category"], message: "Especifica la categoria para esta regla" });
  }
  if (requiresBonus) {
    if (data.minimumGoalAmount == null || Number.isNaN(data.minimumGoalAmount)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minimumGoalAmount"], message: "La regla de bono requiere una meta minima" });
    }
    if (data.bonusAmount == null || Number.isNaN(data.bonusAmount)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bonusAmount"], message: "La regla de bono requiere un monto de bono" });
    }
  }
  if (data.validFrom && data.validUntil && data.validUntil < data.validFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validUntil"], message: "La fecha final no puede ser anterior a la inicial" });
  }
}

export const createBranchCommissionRuleSchema = branchCommissionRuleSchemaBase.superRefine((data, ctx) => {
  validateBranchCommissionRule(data, ctx);
});

export const updateBranchCommissionRuleSchema = branchCommissionRuleSchemaBase.partial().superRefine((data, ctx) => {
  if (Object.keys(data).length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debes enviar al menos un campo para actualizar" });
    return;
  }
  validateBranchCommissionRule(data, ctx);
});

export const createBranchCommissionPaymentSchema = z.object({
  amount: z.coerce.number().positive("El pago debe ser mayor a 0"),
  paymentMethod: z.enum(branchFinancePaymentMethodValues),
  idempotencyKey: z.string().trim().min(8, "Idempotency key invalida").max(120, "Maximo 120 caracteres").optional(),
  reference: z.string().max(160, "Maximo 160 caracteres").nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  periodStart: branchCommissionRuleDateSchema.nullable().optional(),
  periodEnd: branchCommissionRuleDateSchema.nullable().optional(),
  accrualIds: z.array(z.string().min(1)).optional(),
}).superRefine((data, ctx) => {
  if (data.periodStart && data.periodEnd && data.periodEnd < data.periodStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["periodEnd"], message: "La fecha final no puede ser anterior a la inicial" });
  }
});

export const createBranchSupplierSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  contactName: z.string().max(160, "Maximo 160 caracteres").nullable().optional(),
  phone: z.string().max(40, "Maximo 40 caracteres").nullable().optional(),
  email: z.string().email("Correo invalido").max(160, "Maximo 160 caracteres").nullable().optional().or(z.literal("")),
  taxId: z.string().max(40, "Maximo 40 caracteres").nullable().optional(),
  address: z.string().max(240, "Maximo 240 caracteres").nullable().optional(),
  paymentTerms: z.string().max(160, "Maximo 160 caracteres").nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateBranchSupplierSchema = createBranchSupplierSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const createBranchPurchaseItemInputSchema = z.object({
  commercialProductId: z.string().min(1, "El producto es obligatorio"),
  quantityOrdered: z.coerce.number().int().min(1, "La cantidad debe ser mayor a 0"),
  unitCost: z.coerce.number().min(0, "El costo no puede ser negativo"),
  updateReferenceCost: z.boolean().optional(),
});

export const createBranchPurchaseSchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
  supplierId: z.string().min(1).nullable().optional(),
  status: z.enum(branchPurchaseStatusValues).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").nullable().optional(),
  paymentStatus: z.enum(branchPurchasePaymentStatusValues).optional(),
  paymentMethod: z.enum(branchFinancePaymentMethodValues).nullable().optional(),
  paidAmount: z.coerce.number().min(0, "El pago no puede ser negativo").optional(),
  discountAmount: z.coerce.number().min(0, "El descuento no puede ser negativo").optional(),
  taxMode: z.enum(branchSaleTaxModeValues).default("tax_exempt"),
  taxRate: z.coerce.number().min(0, "La tasa de IVA no puede ser negativa").max(100, "La tasa de IVA no puede ser mayor a 100").default(16),
  reference: z.string().max(120, "Maximo 120 caracteres").nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  items: z.array(createBranchPurchaseItemInputSchema).min(1, "Debes agregar al menos un producto"),
});

export const receiveBranchPurchaseSchema = z.object({
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
});

export const createBranchServiceSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  category: z.string().min(1, "La categoria es obligatoria").max(120, "Maximo 120 caracteres"),
  description: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
  baseDurationMinutes: z.coerce.number().int().min(1, "La duracion debe ser mayor a 0").max(1440, "Duracion demasiado grande").nullable().optional(),
  capacity: z.coerce.number().int().min(1, "La capacidad debe ser mayor a 0").max(10000, "Capacidad demasiado grande").nullable().optional(),
  requiresAgenda: z.boolean().optional(),
  visibility: z.enum(branchServiceVisibilityValues).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const updateBranchServiceSchema = createBranchServiceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const createBranchCommercialProductSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  category: z.string().min(1, "La categoria es obligatoria").max(120, "Maximo 120 caracteres"),
  description: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
  photoUrl: z.string().max(2048, "URL demasiado larga").nullable().optional(),
  sku: z.string().max(80, "Maximo 80 caracteres").nullable().optional(),
  barcode: z.string().max(120, "Maximo 120 caracteres").nullable().optional(),
  costAmount: z.coerce.number().min(0, "El costo no puede ser negativo"),
  salePriceAmount: z.coerce.number().min(0, "El precio de venta no puede ser negativo"),
  isActive: z.boolean().optional(),
  isPublicVisible: z.boolean().optional(),
  usesInventory: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const updateBranchCommercialProductSchema = createBranchCommercialProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const createBranchSaleProductSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Debes registrar al menos una unidad").max(9999, "Cantidad demasiado grande"),
  clientUserId: z.string().min(1).nullable().optional(),
  sellerId: z.string().min(1).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  paymentMethod: z.enum(branchFinancePaymentMethodValues),
  idempotencyKey: z.string().trim().min(8, "Idempotency key invalida").max(120, "Maximo 120 caracteres").optional(),
  discountAmount: z.coerce.number().min(0, "El descuento no puede ser negativo").default(0),
  taxMode: z.enum(branchSaleTaxModeValues).default("tax_exempt"),
  taxRate: z.coerce.number().min(0, "La tasa de IVA no puede ser negativa").max(100, "La tasa de IVA no puede ser mayor a 100").default(16),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  paymentReference: z.string().max(160, "Maximo 160 caracteres").nullable().optional(),
});

export const createBranchCheckoutItemSchema = z.object({
  commercialProductId: z.string().min(1, "El producto es obligatorio"),
  quantity: z.coerce.number().int().min(1, "Debes registrar al menos una unidad").max(9999, "Cantidad demasiado grande"),
});

export const createBranchCheckoutPaymentSchema = z.object({
  paymentMethod: z.enum(branchFinancePaymentMethodValues),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  reference: z.string().max(160, "Maximo 160 caracteres").nullable().optional(),
});

export const createBranchCheckoutSchema = z.object({
  items: z.array(createBranchCheckoutItemSchema).min(1, "Debes agregar al menos un producto"),
  clientUserId: z.string().min(1).nullable().optional(),
  sellerId: z.string().min(1).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  discountAmount: z.coerce.number().min(0, "El descuento no puede ser negativo").default(0),
  taxMode: z.enum(branchSaleTaxModeValues).default("tax_exempt"),
  taxRate: z.coerce.number().min(0, "La tasa de IVA no puede ser negativa").max(100, "La tasa de IVA no puede ser mayor a 100").default(16),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
  payments: z.array(createBranchCheckoutPaymentSchema).min(1, "Debes registrar al menos un pago"),
  idempotencyKey: z.string().trim().min(8, "Idempotency key invalida").max(120, "Maximo 120 caracteres"),
});

export const cancelBranchSaleSchema = z.object({
  reason: z.string().trim().min(3, "El motivo es obligatorio").max(500, "Maximo 500 caracteres"),
  idempotencyKey: z.string().trim().min(8, "Idempotency key invalida").max(120, "Maximo 120 caracteres"),
});

export const createBranchCommercialProjectSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  description: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
  customerUserId: z.string().min(1).nullable().optional(),
  status: z.enum(branchCommercialProjectStatusValues).default("draft"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  expectedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").nullable().optional(),
  notes: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
});

export const updateBranchCommercialProjectSchema = createBranchCommercialProjectSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debes enviar al menos un campo para actualizar" },
);

export const linkBranchCommercialProjectSaleSchema = z.object({
  saleId: z.string().min(1, "La venta es obligatoria"),
});

export const linkBranchCommercialProjectPurchaseSchema = z.object({
  purchaseId: z.string().min(1, "La compra es obligatoria"),
});

export const createBranchCommercialProjectFromSaleSchema = z.object({
  saleId: z.string().min(1, "La venta es obligatoria"),
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres").optional(),
  description: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
  notes: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
  expectedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").nullable().optional(),
});

export const createBranchInventoryInitialSchema = z.object({
  quantity: z.coerce.number().int().min(0, "La cantidad inicial no puede ser negativa").max(1000000, "Cantidad demasiado grande"),
  minimumStock: z.coerce.number().int().min(0, "La existencia minima no puede ser negativa").max(1000000, "Cantidad demasiado grande").default(0),
  unitCost: z.coerce.number().min(0, "El costo unitario no puede ser negativo").nullable().optional(),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
});

export const createBranchInventoryEntrySchema = z.object({
  quantity: z.coerce.number().int().min(1, "Debes registrar al menos una unidad").max(1000000, "Cantidad demasiado grande"),
  minimumStock: z.coerce.number().int().min(0, "La existencia minima no puede ser negativa").max(1000000, "Cantidad demasiado grande").nullable().optional(),
  unitCost: z.coerce.number().min(0, "El costo unitario no puede ser negativo").nullable().optional(),
  reason: z.string().min(1, "El motivo es obligatorio").max(160, "Maximo 160 caracteres"),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
});

export const createBranchInventoryAdjustmentSchema = z.object({
  newQuantity: z.coerce.number().int().min(0, "La nueva cantidad no puede ser negativa").max(1000000, "Cantidad demasiado grande").nullable().optional(),
  quantityDelta: z.coerce.number().int().min(-1000000, "Ajuste demasiado grande").max(1000000, "Ajuste demasiado grande").nullable().optional(),
  minimumStock: z.coerce.number().int().min(0, "La existencia minima no puede ser negativa").max(1000000, "Cantidad demasiado grande").nullable().optional(),
  unitCost: z.coerce.number().min(0, "El costo unitario no puede ser negativo").nullable().optional(),
  reason: z.string().min(1, "El motivo es obligatorio").max(160, "Maximo 160 caracteres"),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
}).refine(
  (data) => (data.newQuantity != null ? 1 : 0) + (data.quantityDelta != null ? 1 : 0) === 1,
  { message: "Debes enviar una nueva cantidad o una diferencia, pero no ambas" },
).refine(
  (data) => data.quantityDelta == null || data.quantityDelta !== 0,
  { message: "La diferencia no puede ser 0" },
);

export const createBranchInventoryWasteSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Debes registrar al menos una unidad").max(1000000, "Cantidad demasiado grande"),
  movementType: z.enum(["waste", "damaged"]).default("waste"),
  reason: z.string().min(1, "El motivo es obligatorio").max(160, "Maximo 160 caracteres"),
  notes: z.string().max(500, "Maximo 500 caracteres").nullable().optional(),
});

const branchServiceSaleOptionBaseSchema = z.object({
  serviceId: z.string().min(1, "El servicio es obligatorio"),
  name: z.string().min(1, "El nombre es obligatorio").max(160, "Maximo 160 caracteres"),
  type: z.enum(branchServiceSaleOptionTypeValues),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  includedUses: z.coerce.number().int().min(1, "Los usos deben ser mayores a 0").max(10000, "Demasiados usos").nullable().optional(),
  isUnlimited: z.boolean().optional(),
  validityDays: z.coerce.number().int().min(1, "La vigencia debe ser mayor a 0").max(3650, "Vigencia demasiado grande").nullable().optional(),
  requiresRegisteredClient: z.boolean().optional(),
  allowsWalkIn: z.boolean().optional(),
  isPosFavorite: z.boolean().optional(),
  isActive: z.boolean().optional(),
  internalNotes: z.string().max(1000, "Maximo 1000 caracteres").nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const createBranchServiceSaleOptionSchema = branchServiceSaleOptionBaseSchema.refine(
  (data) => !(data.isUnlimited && data.includedUses != null),
  { message: "No puedes combinar usos incluidos con ilimitado" },
).refine(
  (data) => data.type !== "membresia" || (data.requiresRegisteredClient ?? true),
  { message: "Las opciones tipo membresia requieren cliente registrado" },
);

export const updateBranchServiceSaleOptionSchema = branchServiceSaleOptionBaseSchema.partial()
  .refine(
    (data) => !(data.isUnlimited && data.includedUses != null),
    { message: "No puedes combinar usos incluidos con ilimitado" },
  )
  .refine(
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
