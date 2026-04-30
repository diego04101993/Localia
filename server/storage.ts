import { eq, and, sql, or, ne, isNull, count, desc, asc, gte, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  branches,
  memberships,
  branchClientCrm,
  branchCustomerBlocks,
  membershipPlans,
  auditLogs,
  systemEvents,
  pushTokens,
  notifications,
  clientNotes,
  attendances,
  customerReports,
  classSchedules,
  classBookings,
  branchPhotos,
  branchPosts,
  branchProducts,
  branchVideos,
  type User,
  type InsertUser,
  type Branch,
  type InsertBranch,
  type Membership,
  type InsertMembership,
  type AuditLog,
  type SystemEvent,
  type PushToken,
  type Notification,
  type ClientNote,
  type InsertClientNote,
  type Attendance,
  type InsertAttendance,
  type BranchClientCrm,
  type BranchCustomerBlock,
  type CustomerReport,
  type MembershipPlan,
  type InsertMembershipPlan,
  type ClassSchedule,
  type InsertClassSchedule,
  type ClassBooking,
  type InsertClassBooking,
  type BranchPhoto,
  type InsertBranchPhoto,
  type BranchPost,
  type InsertBranchPost,
  type BranchProduct,
  type InsertBranchProduct,
  type BranchVideo,
  type InsertBranchVideo,
  branchAnnouncements,
  type BranchAnnouncement,
  type InsertBranchAnnouncement,
  branchReviews,
  type BranchReview,
  passwordResetTokens,
  type PasswordResetToken,
  promotions,
  type Promotion,
  type InsertPromotion,
} from "@shared/schema";

const BRANCH_TIMEZONE = "America/Mexico_City";
const CRM_ACTIVITY_WINDOW_DAYS = 30;
const CRM_ACTIVITY_WINDOW_MS = CRM_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function getMxLocalDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE });
}

function getMxLocalDateAndTime(): { today: string; currentTime: string } {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE });
  const timeStr = now.toLocaleTimeString("en-GB", { timeZone: BRANCH_TIMEZONE, hour12: false });
  const currentTime = timeStr.substring(0, 5);
  return { today, currentTime };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedSearchSql(column: any) {
  return sql`regexp_replace(
    translate(lower(coalesce(${column}, '')), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun'),
    '[^a-z0-9]+',
    ' ',
    'g'
  )`;

  return sql`regexp_replace(
    translate(lower(coalesce(${column}, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
    '[^a-z0-9]+',
    ' ',
    'g'
  )`;
}

function normalizedSearchSqlSafe(column: any) {
  return sql`regexp_replace(
    translate(lower(coalesce(${column}, '')), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+',
    ' ',
    'g'
  )`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLatestDate(...values: Array<Date | string | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const value of values) {
    const date = toDate(value);
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) {
      latest = date;
    }
  }
  return latest;
}

function resolveCrmClientStatus(
  manualStatus: string | null | undefined,
  lastVisit: Date | string | null | undefined,
  joinedAt: Date | string | null | undefined,
): string {
  if (manualStatus) return manualStatus;

  const visitDate = toDate(lastVisit);
  if (visitDate && Date.now() - visitDate.getTime() <= CRM_ACTIVITY_WINDOW_MS) {
    return "activo";
  }

  const joinedDate = toDate(joinedAt);
  if (!visitDate && joinedDate && Date.now() - joinedDate.getTime() <= CRM_ACTIVITY_WINDOW_MS) {
    return "nuevo";
  }

  return "inactivo";
}

function buildNotificationVisibilityCondition(actor: { id: string; role: string; branchId?: string | null }) {
  const conditions = [eq(notifications.recipientUserId, actor.id)];

  if (actor.role === "SUPER_ADMIN") {
    conditions.push(and(
      eq(notifications.roleTarget, "SUPER_ADMIN"),
      isNull(notifications.recipientUserId),
    )!);
  } else if (actor.role === "BRANCH_ADMIN" && actor.branchId) {
    conditions.push(and(
      eq(notifications.roleTarget, "BRANCH_ADMIN"),
      eq(notifications.branchId, actor.branchId),
      isNull(notifications.recipientUserId),
    )!);
  } else if (actor.role === "CUSTOMER") {
    conditions.push(and(
      eq(notifications.roleTarget, "CUSTOMER"),
      isNull(notifications.recipientUserId),
      isNull(notifications.branchId),
    )!);
  }

  return conditions.length === 1 ? conditions[0] : or(...conditions)!;
}

export interface BranchMetrics {
  branchId: string;
  customerCount: number;
  activeMemberships: number;
}

export interface BranchStats {
  activeMemberships: number;
  uniqueActiveCustomers: number;
  totalCustomers: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  getAllBranches(includeDeleted?: boolean): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  getBranchBySlug(slug: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranchStatus(id: string, status: string): Promise<Branch | undefined>;
  softDeleteBranch(id: string): Promise<Branch | undefined>;
  getBranchAdmins(branchId: string): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getBranchMetrics(): Promise<BranchMetrics[]>;
  getBranchStats(branchId: string): Promise<BranchStats>;
  searchBranchesNearby(params: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    category?: string;
    q?: string;
  }): Promise<(Branch & { distance_km?: number })[]>;
  updateUser(id: string, data: { name?: string; lastName?: string; email?: string; phone?: string }): Promise<User | undefined>;
  acceptTerms(id: string, version: string): Promise<User | undefined>;
  activateCustomerAccount(id: string, data: { passwordHash: string; name?: string; lastName?: string; phone?: string; birthDate?: string; gender?: string; termsVersion: string }): Promise<User | undefined>;
  createPasswordResetToken(userId: string, token: string, expiresAt: string): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  invalidateUserPasswordResetTokens(userId: string): Promise<void>;
  setEmailVerified(userId: string): Promise<User | undefined>;
  setEmailVerificationToken(userId: string, token: string, expiresAt: string): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  updateUserBranch(id: string, branchId: string): Promise<User | undefined>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  getMembership(userId: string, branchId: string): Promise<Membership | undefined>;
  getMembershipById(id: string): Promise<Membership | undefined>;
  getUserMemberships(userId: string): Promise<(Membership & { branch: Branch })[]>;
  createMembership(data: InsertMembership): Promise<Membership>;
  updateMembership(id: string, data: Partial<InsertMembership>): Promise<Membership | undefined>;
  createAuditLog(data: { actorUserId: string; action: string; branchId?: string; metadata?: any }): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<(AuditLog & { actorEmail?: string | null })[]>;
  createSystemEvent(data: { eventType: string; branchId?: string | null; userId?: string | null; payload?: any; status?: string }): Promise<SystemEvent>;
  getSystemEvents(limit?: number): Promise<(SystemEvent & { branchName?: string | null; userEmail?: string | null; userName?: string | null })[]>;
  upsertPushToken(data: { userId: string; token: string; platform: string; deviceName?: string | null }): Promise<PushToken>;
  deactivatePushToken(userId: string, token: string): Promise<boolean>;
  getActivePushTokensByUser(userId: string): Promise<PushToken[]>;
  getActivePushTokensByUsers(userIds: string[]): Promise<PushToken[]>;
  getActivePushTokensByBranch(branchId: string): Promise<PushToken[]>;
  createNotification(data: { recipientUserId?: string | null; branchId?: string | null; roleTarget?: string | null; type: string; title: string; message: string; data?: any; isRead?: boolean; readAt?: Date | null }): Promise<Notification>;
  getNotificationsForActor(actor: { id: string; role: string; branchId?: string | null }, options?: { limit?: number; page?: number; status?: "all" | "read" | "unread" }): Promise<Notification[]>;
  getNotificationSummary(actor: { id: string; role: string; branchId?: string | null }): Promise<{ totalCount: number; unreadCount: number; readCount: number }>;
  markNotificationRead(notificationId: string, actor: { id: string; role: string; branchId?: string | null }): Promise<Notification | undefined>;
  markAllNotificationsRead(actor: { id: string; role: string; branchId?: string | null }): Promise<number>;
  deleteNotification(notificationId: string, actor: { id: string; role: string; branchId?: string | null }): Promise<boolean>;
  deleteReadNotifications(actor: { id: string; role: string; branchId?: string | null }): Promise<number>;
  deleteAllNotifications(actor: { id: string; role: string; branchId?: string | null }): Promise<number>;
  cleanupOldNotifications(maxAgeDays?: number): Promise<number>;
  getBranchClients(branchId: string, includeLeft?: boolean): Promise<any[]>;
  getClientProfile(userId: string, branchId: string): Promise<any>;
  updateBranchClientCrm(branchId: string, userId: string, data: { clientStatus?: string | null; tags?: string | null; lastVisit?: Date | null }): Promise<any>;
  getActiveBranchCustomerBlock(branchId: string, userId: string): Promise<BranchCustomerBlock | null>;
  setBranchCustomerBlock(branchId: string, userId: string, data: { blockedByUserId: string; reason?: string | null; note?: string | null }): Promise<BranchCustomerBlock>;
  unblockBranchCustomer(branchId: string, userId: string): Promise<number>;
  createCustomerReport(data: { branchId: string; userId: string; reportedByUserId: string; reason: string; note?: string | null }): Promise<CustomerReport>;
  getCustomerReports(params?: { branchId?: string; userId?: string; status?: string }): Promise<any[]>;
  updateCustomerReportStatus(reportId: string, status: string, reviewedByUserId: string): Promise<any>;
  createClientNote(data: InsertClientNote): Promise<ClientNote>;
  getClientNotes(userId: string, branchId: string): Promise<(ClientNote & { createdByName?: string })[]>;
  createAttendance(data: InsertAttendance): Promise<Attendance>;
  getClientAttendances(userId: string, branchId: string, limit?: number): Promise<Attendance[]>;
  updateUserPhone(id: string, phone: string | null): Promise<User | undefined>;
  getBranchPlans(branchId: string): Promise<MembershipPlan[]>;
  createPlan(data: InsertMembershipPlan): Promise<MembershipPlan>;
  updatePlan(id: string, data: Partial<InsertMembershipPlan>): Promise<MembershipPlan | undefined>;
  deactivatePlan(id: string): Promise<MembershipPlan | undefined>;
  detachPlanFromMemberships(planId: string, planName: string): Promise<number>;
  getPlan(id: string): Promise<MembershipPlan | undefined>;
  assignPlanToMembership(membershipId: string, planId: string, classesRemaining: number | null, classesTotal: number | null, expiresAt: Date | null): Promise<Membership | undefined>;
  removePlanFromMembership(membershipId: string): Promise<Membership | undefined>;
  getMembershipByUserAndBranch(userId: string, branchId: string): Promise<Membership | undefined>;
  reconcilePastBookings(branchId: string): Promise<number>;
  autoMarkAttendedBookings(branchId: string): Promise<number>;
  getAllActiveBranchIds(): Promise<string[]>;
  cancelFutureBookingsForUser(userId: string, branchId: string): Promise<number>;
  decrementClassesRemaining(membershipId: string): Promise<Membership | undefined>;
  getBranchClassSchedules(branchId: string): Promise<ClassSchedule[]>;
  createClassSchedule(data: InsertClassSchedule): Promise<ClassSchedule>;
  updateClassSchedule(id: string, data: Partial<InsertClassSchedule>): Promise<ClassSchedule | undefined>;
  getClassSchedule(id: string): Promise<ClassSchedule | undefined>;
  getBookingsForDate(branchId: string, date: string): Promise<any[]>;
  getBookingsForClassOnDate(classScheduleId: string, date: string): Promise<any[]>;
  createBooking(data: InsertClassBooking): Promise<ClassBooking>;
  updateBookingStatus(id: string, status: string): Promise<ClassBooking | undefined>;
  markBookingLateCancellation(id: string): Promise<void>;
  getBooking(id: string): Promise<ClassBooking | undefined>;
  getTodayBookingsCount(branchId: string): Promise<number>;
  getNextBooking(branchId: string): Promise<{ className: string; startTime: string; bookingDate: string } | null>;
  getTvModeData(branchId: string, date: string): Promise<any[]>;
  updateClassRoutine(classId: string, routineDescription: string | null, routineImageUrl: string | null): Promise<ClassSchedule | undefined>;
  getBranchPhotos(branchId: string): Promise<BranchPhoto[]>;
  addBranchPhoto(data: InsertBranchPhoto): Promise<BranchPhoto>;
  deleteBranchPhoto(id: string): Promise<void>;
  reorderBranchPhotos(branchId: string, ids: string[]): Promise<void>;
  getBranchPosts(branchId: string): Promise<BranchPost[]>;
  createBranchPost(data: InsertBranchPost): Promise<BranchPost>;
  updateBranchPost(id: string, data: Partial<InsertBranchPost>): Promise<BranchPost | undefined>;
  deleteBranchPost(id: string): Promise<void>;
  reorderBranchPosts(branchId: string, ids: string[]): Promise<void>;
  getBranchProducts(branchId: string): Promise<BranchProduct[]>;
  createBranchProduct(data: InsertBranchProduct): Promise<BranchProduct>;
  updateBranchProduct(id: string, data: Partial<InsertBranchProduct>): Promise<BranchProduct | undefined>;
  deleteBranchProduct(id: string): Promise<void>;
  reorderBranchProducts(branchId: string, ids: string[]): Promise<void>;
  getBranchVideos(branchId: string): Promise<BranchVideo[]>;
  addBranchVideo(data: InsertBranchVideo): Promise<BranchVideo>;
  deleteBranchVideo(id: string): Promise<void>;
  reorderBranchVideos(branchId: string, ids: string[]): Promise<void>;
  copyClassSchedules(branchId: string, fromDay: number, toDay: number): Promise<ClassSchedule[]>;
  getExpiringMemberships(branchId: string, daysAhead: number): Promise<any[]>;
  getExpiredMemberships(branchId: string): Promise<any[]>;
  markExpiredMemberships(branchId: string): Promise<number>;
  renewMembership(membershipId: string, planId: string, classesRemaining: number | null, classesTotal: number | null, expiresAt: Date, paidAt: Date): Promise<Membership | undefined>;
  getInactiveClients(branchId: string, daysSince: number): Promise<any[]>;
  getClientsWithoutClasses(branchId: string): Promise<any[]>;
  getMembershipsAssignedToPlan(planId: string): Promise<number>;
  updateClient(userId: string, data: { name?: string; email?: string; lastName?: string | null; phone?: string | null; birthDate?: string | null; gender?: string | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null; medicalNotes?: string | null; injuriesNotes?: string | null; medicalWarnings?: string | null; parqAccepted?: boolean; parqAcceptedDate?: string | null; avatarUrl?: string | null }): Promise<any>;
  updateClientStatus(membershipId: string, clientStatus: string): Promise<any>;
  updateClientDebt(membershipId: string, hasDebt: boolean, debtAmount: number): Promise<any>;
  softDeleteMembership(membershipId: string): Promise<any>;
  getUpcomingBookingsForUser(branchId: string, userId: string, fromDate: string, limit?: number): Promise<any[]>;
  updateBranchWhatsappTemplates(branchId: string, templates: Record<string, string>): Promise<any>;
  updateBranchProfile(branchId: string, data: { description?: string | null; address?: string | null; city?: string | null; googleMapsUrl?: string | null; operatingHours?: any; category?: string | null; subcategory?: string | null; searchKeywords?: string | null; latitude?: number | null; longitude?: number | null; whatsappNumber?: string | null }): Promise<any>;
  getUpcomingBirthdays(branchId: string, daysAhead?: number): Promise<any[]>;
  getBranchReviews(branchId: string): Promise<any[]>;
  getBranchReviewsSummary(branchId: string): Promise<{ averageRating: number; totalReviews: number }>;
  getUserReview(branchId: string, userId: string): Promise<BranchReview | null>;
  createOrUpdateReview(branchId: string, userId: string, rating: number, comment?: string | null): Promise<BranchReview>;
  getCustomerAppOverview(): Promise<{ total: number; active: number; blocked: number; recent: number; pendingReports: number }>;
  getCustomerAppUsers(search?: string): Promise<any[]>;
  getCustomerAppUserDetail(userId: string): Promise<any>;
  updateCustomerGlobalBlock(userId: string, data: { isBlocked: boolean; blockedReason?: string | null; blockedBy?: string | null }): Promise<User | undefined>;
  hideCustomerReviews(userId: string, hidden: boolean, reason?: string | null): Promise<number>;
  deleteCustomerAppUserSafely(userId: string): Promise<{ deleted: boolean; reason?: string }>;
  getBranchRatings(branchIds: string[]): Promise<Record<string, { averageRating: number; totalReviews: number }>>;
  getBranchRanking(): Promise<{ id: string; name: string; slug: string; category: string | null; subcategory: string | null; city: string | null; address: string | null; coverImageUrl: string | null; profileImageUrl: string | null; averageRating: number; totalReviews: number }[]>;
  getBranchAnnouncements(branchId: string): Promise<BranchAnnouncement[]>;
  createAnnouncement(data: InsertBranchAnnouncement): Promise<BranchAnnouncement>;
  deleteAnnouncement(id: string): Promise<void>;
  deactivateAllAnnouncements(branchId: string): Promise<void>;
  createPromotion(data: InsertPromotion): Promise<Promotion>;
  getBranchPromotions(branchId: string): Promise<Promotion[]>;
  getGlobalPromotions(): Promise<(Promotion & { branchName: string; branchSlug: string; branchWhatsapp: string | null })[]>;
  getBranchActivePromotions(branchId: string): Promise<Promotion[]>;
  deletePromotion(id: string, branchId: string): Promise<void>;
  updatePromotion(id: string, branchId: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllBranches(includeDeleted = false): Promise<Branch[]> {
    if (includeDeleted) {
      return db.select().from(branches).orderBy(
        asc(sql`CASE WHEN ${branches.status} = 'active' THEN 0 WHEN ${branches.status} = 'suspended' THEN 1 ELSE 2 END`),
        desc(branches.createdAt)
      );
    }
    return db
      .select()
      .from(branches)
      .where(isNull(branches.deletedAt))
      .orderBy(
        asc(sql`CASE WHEN ${branches.status} = 'active' THEN 0 WHEN ${branches.status} = 'suspended' THEN 1 ELSE 2 END`),
        desc(branches.createdAt)
      );
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch;
  }

  async getBranchBySlug(slug: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.slug, slug));
    return branch;
  }

  async createBranch(insertBranch: InsertBranch): Promise<Branch> {
    const [branch] = await db.insert(branches).values(insertBranch).returning();
    return branch;
  }

  async updateBranchStatus(id: string, status: string): Promise<Branch | undefined> {
    const [branch] = await db
      .update(branches)
      .set({ status: status as any })
      .where(eq(branches.id, id))
      .returning();
    return branch;
  }

  async softDeleteBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db
      .update(branches)
      .set({
        deletedAt: new Date(),
        status: "blacklisted" as any,
      })
      .where(eq(branches.id, id))
      .returning();
    return branch;
  }

  async getBranchAdmins(branchId: string): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        and(
          eq(users.branchId, branchId),
          eq(users.role, "BRANCH_ADMIN")
        )
      );
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.role, role as any));
  }

  async getBranchMetrics(): Promise<BranchMetrics[]> {
    const results = await db
      .select({
        branchId: memberships.branchId,
        customerCount: sql<number>`COUNT(DISTINCT CASE WHEN ${memberships.status} = 'active' THEN ${memberships.userId} END)`.as("customer_count"),
        activeMemberships: sql<number>`COUNT(CASE WHEN ${memberships.status} = 'active' THEN 1 END)`.as("active_memberships"),
      })
      .from(memberships)
      .innerJoin(branches, eq(memberships.branchId, branches.id))
      .where(isNull(branches.deletedAt))
      .groupBy(memberships.branchId);

    return results.map((r) => ({
      branchId: r.branchId,
      customerCount: Number(r.customerCount) || 0,
      activeMemberships: Number(r.activeMemberships) || 0,
    }));
  }

  async getBranchStats(branchId: string): Promise<BranchStats> {
    const [result] = await db
      .select({
        activeMemberships: sql<number>`COUNT(CASE WHEN ${memberships.status} = 'active' THEN 1 END)`.as("active_memberships"),
        uniqueActiveCustomers: sql<number>`COUNT(DISTINCT CASE WHEN ${memberships.status} = 'active' AND ${memberships.clientStatus} = 'active' THEN ${memberships.userId} END)`.as("unique_active_customers"),
        totalCustomers: sql<number>`COUNT(DISTINCT CASE WHEN ${memberships.status} = 'active' THEN ${memberships.userId} END)`.as("total_customers"),
      })
      .from(memberships)
      .where(eq(memberships.branchId, branchId));

    return {
      activeMemberships: Number(result?.activeMemberships) || 0,
      uniqueActiveCustomers: Number(result?.uniqueActiveCustomers) || 0,
      totalCustomers: Number(result?.totalCustomers) || 0,
    };
  }

  async searchBranchesNearby(params: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    category?: string;
    q?: string;
  }): Promise<(Branch & { distance_km?: number })[]> {
    const { lat, lng, radiusKm = 50, category, q } = params;
    const normalizedQuery = q ? normalizeSearchText(q) : "";

    const conditions: any[] = [
      eq(branches.status, "active"),
      isNull(branches.deletedAt),
    ];

    if (category) {
      conditions.push(eq(branches.category, category));
    }

    if (normalizedQuery) {
      const likeQuery = `%${normalizedQuery}%`;
      conditions.push(
        or(
          sql`${normalizedSearchSqlSafe(branches.name)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(branches.category)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(branches.city)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(branches.address)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(branches.description)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(branches.subcategory)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(branches.searchKeywords)} LIKE ${likeQuery}`
        )
      );
    }

    if (lat !== undefined && lng !== undefined) {
      const haversine = sql<number>`
        6371 * acos(
          cos(radians(${lat})) * cos(radians(${branches.latitude})) *
          cos(radians(${branches.longitude}) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(${branches.latitude}))
        )
      `;

      const profileImgSubquery = sql<string | null>`(SELECT url FROM branch_photos WHERE branch_id = branches.id AND type = 'profile' LIMIT 1)`;

      const results = await db
        .select({
          id: branches.id,
          name: branches.name,
          slug: branches.slug,
          status: branches.status,
          category: branches.category,
          subcategory: branches.subcategory,
          searchKeywords: branches.searchKeywords,
          latitude: branches.latitude,
          longitude: branches.longitude,
          city: branches.city,
          address: branches.address,
          coverImageUrl: branches.coverImageUrl,
          description: branches.description,
          createdAt: branches.createdAt,
          deletedAt: branches.deletedAt,
          distance_km: haversine.as("distance_km"),
          profileImageUrl: profileImgSubquery.as("profile_image_url"),
        })
        .from(branches)
        .where(and(...conditions, sql`${branches.latitude} IS NOT NULL`, sql`${branches.longitude} IS NOT NULL`))
        .orderBy(haversine);

      const withinRadius = results.filter(
        (r) => r.distance_km === null || r.distance_km <= radiusKm
      );

      const withoutCoords = await db
        .select({
          id: branches.id,
          name: branches.name,
          slug: branches.slug,
          status: branches.status,
          category: branches.category,
          subcategory: branches.subcategory,
          searchKeywords: branches.searchKeywords,
          latitude: branches.latitude,
          longitude: branches.longitude,
          city: branches.city,
          address: branches.address,
          coverImageUrl: branches.coverImageUrl,
          description: branches.description,
          cancelCutoffMinutes: branches.cancelCutoffMinutes,
          whatsappTemplates: branches.whatsappTemplates,
          googleMapsUrl: branches.googleMapsUrl,
          operatingHours: branches.operatingHours,
          locations: branches.locations,
          createdAt: branches.createdAt,
          deletedAt: branches.deletedAt,
          profileImageUrl: profileImgSubquery.as("profile_image_url"),
        })
        .from(branches)
        .where(
          and(
            ...conditions,
            or(sql`${branches.latitude} IS NULL`, sql`${branches.longitude} IS NULL`)
          )
        )
        .orderBy(branches.createdAt);

      const combined = [
        ...withinRadius.map((r) => ({
          ...r,
          distance_km: r.distance_km ? Math.round(r.distance_km * 10) / 10 : undefined,
        })),
        ...withoutCoords.map((b) => ({ ...b, distance_km: undefined })),
      ] as (Branch & { distance_km?: number; profileImageUrl?: string | null; averageRating?: number; totalReviews?: number })[];
      const ratingMap = await this.getBranchRatings(combined.map(b => b.id));
      return combined.map(b => ({ ...b, ...(ratingMap[b.id] || { averageRating: 0, totalReviews: 0 }) }));
    }

    const profileImgSubquery = sql<string | null>`(SELECT url FROM branch_photos WHERE branch_id = branches.id AND type = 'profile' LIMIT 1)`;

    const results = await db
      .select({
        id: branches.id,
        name: branches.name,
        slug: branches.slug,
        status: branches.status,
        category: branches.category,
        subcategory: branches.subcategory,
        searchKeywords: branches.searchKeywords,
        latitude: branches.latitude,
        longitude: branches.longitude,
        city: branches.city,
        address: branches.address,
        coverImageUrl: branches.coverImageUrl,
        description: branches.description,
        cancelCutoffMinutes: branches.cancelCutoffMinutes,
        whatsappTemplates: branches.whatsappTemplates,
        googleMapsUrl: branches.googleMapsUrl,
        operatingHours: branches.operatingHours,
        locations: branches.locations,
        createdAt: branches.createdAt,
        deletedAt: branches.deletedAt,
        profileImageUrl: profileImgSubquery.as("profile_image_url"),
      })
      .from(branches)
      .where(and(...conditions))
      .orderBy(branches.createdAt);

    const resultsWithDistance = results.map((b) => ({ ...b, distance_km: undefined })) as (Branch & { distance_km?: number; profileImageUrl?: string | null; averageRating?: number; totalReviews?: number })[];
    const ratingMap = await this.getBranchRatings(resultsWithDistance.map(b => b.id));
    return resultsWithDistance.map(b => ({ ...b, ...(ratingMap[b.id] || { averageRating: 0, totalReviews: 0 }) }));
  }

  async getMembership(userId: string, branchId: string): Promise<Membership | undefined> {
    const [m] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.branchId, branchId)));
    return m;
  }

  async getMembershipById(id: string): Promise<Membership | undefined> {
    const [m] = await db.select().from(memberships).where(eq(memberships.id, id));
    return m;
  }

  async getUserMemberships(userId: string): Promise<(Membership & { branch: Branch })[]> {
    const results = await db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        branchId: memberships.branchId,
        status: memberships.status,
        isFavorite: memberships.isFavorite,
        joinedAt: memberships.joinedAt,
        lastSeenAt: memberships.lastSeenAt,
        source: memberships.source,
        branch: branches,
      })
      .from(memberships)
      .innerJoin(branches, eq(memberships.branchId, branches.id))
      .where(
        and(
          eq(memberships.userId, userId),
          ne(memberships.status, "banned"),
          isNull(branches.deletedAt)
        )
      )
      .orderBy(memberships.joinedAt);

    return results as any;
  }

  async createMembership(data: InsertMembership): Promise<Membership> {
    const [m] = await db.insert(memberships).values(data).returning();
    return m;
  }

  async updateMembership(id: string, data: Partial<InsertMembership>): Promise<Membership | undefined> {
    const [m] = await db
      .update(memberships)
      .set(data as any)
      .where(eq(memberships.id, id))
      .returning();
    return m;
  }

  async updateUser(id: string, data: { name?: string; lastName?: string; email?: string; phone?: string }): Promise<User | undefined> {
    const setData: any = {};
    if (data.name !== undefined) setData.name = data.name;
    if (data.lastName !== undefined) setData.lastName = data.lastName;
    if (data.email !== undefined) setData.email = data.email;
    if (data.phone !== undefined) setData.phone = data.phone;
    if (Object.keys(setData).length === 0) return this.getUser(id);
    const [user] = await db.update(users).set(setData).where(eq(users.id, id)).returning();
    return user;
  }

  async acceptTerms(id: string, version: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({
      acceptedTerms: true,
      acceptedTermsAt: new Date().toISOString(),
      termsVersion: version,
    }).where(eq(users.id, id)).returning();
    return user;
  }

  async activateCustomerAccount(id: string, data: { passwordHash: string; name?: string; lastName?: string; phone?: string; birthDate?: string; gender?: string; termsVersion: string }): Promise<User | undefined> {
    const setData: any = {
      passwordHash: data.passwordHash,
      acceptedTerms: true,
      acceptedTermsAt: new Date().toISOString(),
      termsVersion: data.termsVersion,
    };
    if (data.name) setData.name = data.name;
    if (data.lastName !== undefined) setData.lastName = data.lastName;
    if (data.phone !== undefined) setData.phone = data.phone;
    if (data.birthDate !== undefined) setData.birthDate = data.birthDate;
    if (data.gender !== undefined) setData.gender = data.gender;
    const [user] = await db.update(users).set(setData).where(eq(users.id, id)).returning();
    return user;
  }

  // ─── Password Reset ───────────────────────────────────────────────────────
  async createPasswordResetToken(userId: string, token: string, expiresAt: string): Promise<PasswordResetToken> {
    const [row] = await db.insert(passwordResetTokens).values({ userId, token, expiresAt }).returning();
    return row;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return row;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, id));
  }

  async invalidateUserPasswordResetTokens(userId: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.userId, userId));
  }

  // ─── Email Verification ───────────────────────────────────────────────────
  async setEmailVerified(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date().toISOString(), emailVerificationToken: null, emailVerificationTokenExpiresAt: null })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async setEmailVerificationToken(userId: string, token: string, expiresAt: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ emailVerificationToken: token, emailVerificationTokenExpiresAt: expiresAt })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async updateUserBranch(id: string, branchId: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ branchId }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ role: role as any }).where(eq(users.id, id)).returning();
    return user;
  }

  async createAuditLog(data: { actorUserId: string; action: string; branchId?: string; metadata?: any }): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values({
      actorUserId: data.actorUserId,
      action: data.action,
      branchId: data.branchId || null,
      metadata: data.metadata || null,
    }).returning();
    return log;
  }

  async getAuditLogs(limit = 50): Promise<(AuditLog & { actorEmail?: string | null })[]> {
    const results = await db
      .select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        action: auditLogs.action,
        branchId: auditLogs.branchId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    return results;
  }

  async createSystemEvent(data: {
    eventType: string;
    branchId?: string | null;
    userId?: string | null;
    payload?: any;
    status?: string;
  }): Promise<SystemEvent> {
    const [event] = await db
      .insert(systemEvents)
      .values({
        eventType: data.eventType,
        branchId: data.branchId ?? null,
        userId: data.userId ?? null,
        payload: data.payload ?? null,
        status: data.status ?? "pending",
      })
      .returning();
    return event;
  }

  async getSystemEvents(limit = 100): Promise<(SystemEvent & { branchName?: string | null; userEmail?: string | null; userName?: string | null })[]> {
    const results = await db
      .select({
        id: systemEvents.id,
        eventType: systemEvents.eventType,
        branchId: systemEvents.branchId,
        userId: systemEvents.userId,
        payload: systemEvents.payload,
        status: systemEvents.status,
        createdAt: systemEvents.createdAt,
        processedAt: systemEvents.processedAt,
        branchName: branches.name,
        userEmail: users.email,
        userName: users.name,
      })
      .from(systemEvents)
      .leftJoin(branches, eq(systemEvents.branchId, branches.id))
      .leftJoin(users, eq(systemEvents.userId, users.id))
      .orderBy(desc(systemEvents.createdAt))
      .limit(limit);

    return results as any;
  }

  async upsertPushToken(data: {
    userId: string;
    token: string;
    platform: string;
    deviceName?: string | null;
  }): Promise<PushToken> {
    const now = new Date();
    const [pushToken] = await db
      .insert(pushTokens)
      .values({
        userId: data.userId,
        token: data.token,
        platform: data.platform,
        deviceName: data.deviceName ?? null,
        isActive: true,
        updatedAt: now,
        lastUsedAt: now,
      })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId: data.userId,
          platform: data.platform,
          deviceName: data.deviceName ?? null,
          isActive: true,
          updatedAt: now,
          lastUsedAt: now,
        },
      })
      .returning();

    return pushToken;
  }

  async deactivatePushToken(userId: string, token: string): Promise<boolean> {
    const now = new Date();
    const rows = await db
      .update(pushTokens)
      .set({
        isActive: false,
        updatedAt: now,
      })
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)))
      .returning({ id: pushTokens.id });

    return rows.length > 0;
  }

  async getActivePushTokensByUser(userId: string): Promise<PushToken[]> {
    return db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)))
      .orderBy(desc(pushTokens.updatedAt));
  }

  async getActivePushTokensByUsers(userIds: string[]): Promise<PushToken[]> {
    if (userIds.length === 0) return [];

    return db
      .select()
      .from(pushTokens)
      .where(and(inArray(pushTokens.userId, userIds), eq(pushTokens.isActive, true)))
      .orderBy(desc(pushTokens.updatedAt));
  }

  async getActivePushTokensByBranch(branchId: string): Promise<PushToken[]> {
    const activeMembers = await db
      .select({
        userId: memberships.userId,
      })
      .from(memberships)
      .where(and(eq(memberships.branchId, branchId), eq(memberships.status, "active")));

    const userIds = Array.from(new Set(activeMembers.map((member) => member.userId)));
    return this.getActivePushTokensByUsers(userIds);
  }

  async createNotification(data: {
    recipientUserId?: string | null;
    branchId?: string | null;
    roleTarget?: string | null;
    type: string;
    title: string;
    message: string;
    data?: any;
    isRead?: boolean;
    readAt?: Date | null;
  }): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({
        recipientUserId: data.recipientUserId ?? null,
        branchId: data.branchId ?? null,
        roleTarget: (data.roleTarget as any) ?? null,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data ?? null,
        isRead: data.isRead ?? false,
        readAt: data.readAt ?? null,
      })
      .returning();

    return notification;
  }

  async getNotificationsForActor(
    actor: { id: string; role: string; branchId?: string | null },
    options?: { limit?: number; page?: number; status?: "all" | "read" | "unread" },
  ): Promise<Notification[]> {
    const visibility = buildNotificationVisibilityCondition(actor);
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const page = Math.max(options?.page ?? 1, 1);
    const status = options?.status ?? "all";
    const conditions = [visibility];

    if (status === "read") {
      conditions.push(eq(notifications.isRead, true));
    } else if (status === "unread") {
      conditions.push(eq(notifications.isRead, false));
    }

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  async getNotificationSummary(actor: { id: string; role: string; branchId?: string | null }): Promise<{ totalCount: number; unreadCount: number; readCount: number }> {
    const visibility = buildNotificationVisibilityCondition(actor);
    const [summary] = await db
      .select({
        totalCount: count(notifications.id),
        unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${notifications.isRead} = false)`,
        readCount: sql<number>`COUNT(*) FILTER (WHERE ${notifications.isRead} = true)`,
      })
      .from(notifications)
      .where(visibility);

    return {
      totalCount: Number(summary?.totalCount) || 0,
      unreadCount: Number(summary?.unreadCount) || 0,
      readCount: Number(summary?.readCount) || 0,
    };
  }

  async markNotificationRead(notificationId: string, actor: { id: string; role: string; branchId?: string | null }): Promise<Notification | undefined> {
    const visibility = buildNotificationVisibilityCondition(actor);
    const now = new Date();
    const [notification] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: now,
      })
      .where(and(eq(notifications.id, notificationId), visibility))
      .returning();

    return notification;
  }

  async markAllNotificationsRead(actor: { id: string; role: string; branchId?: string | null }): Promise<number> {
    const visibility = buildNotificationVisibilityCondition(actor);
    const now = new Date();
    const rows = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: now,
      })
      .where(and(eq(notifications.isRead, false), visibility))
      .returning({ id: notifications.id });

    return rows.length;
  }

  async deleteNotification(notificationId: string, actor: { id: string; role: string; branchId?: string | null }): Promise<boolean> {
    const visibility = buildNotificationVisibilityCondition(actor);
    const rows = await db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), visibility))
      .returning({ id: notifications.id });

    return rows.length > 0;
  }

  async deleteReadNotifications(actor: { id: string; role: string; branchId?: string | null }): Promise<number> {
    const visibility = buildNotificationVisibilityCondition(actor);
    const rows = await db
      .delete(notifications)
      .where(and(eq(notifications.isRead, true), visibility))
      .returning({ id: notifications.id });

    return rows.length;
  }

  async deleteAllNotifications(actor: { id: string; role: string; branchId?: string | null }): Promise<number> {
    const visibility = buildNotificationVisibilityCondition(actor);
    const rows = await db
      .delete(notifications)
      .where(visibility)
      .returning({ id: notifications.id });

    return rows.length;
  }

  async cleanupOldNotifications(maxAgeDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const rows = await db
      .delete(notifications)
      .where(sql`${notifications.createdAt} < ${cutoff}`)
      .returning({ id: notifications.id });

    return rows.length;
  }

  async upsertBranchClientCrm(branchId: string, userId: string, data: { clientStatus?: string | null; tags?: string | null; lastVisit?: Date | null }): Promise<BranchClientCrm> {
    const now = new Date();
    const setData: Record<string, any> = {
      updatedAt: now,
    };

    if (data.clientStatus !== undefined) setData.clientStatus = data.clientStatus;
    if (data.tags !== undefined) setData.tags = data.tags;
    if (data.lastVisit !== undefined) setData.lastVisit = data.lastVisit;

    const [row] = await db
      .insert(branchClientCrm)
      .values({
        branchId,
        userId,
        clientStatus: data.clientStatus ?? null,
        tags: data.tags ?? null,
        lastVisit: data.lastVisit ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [branchClientCrm.branchId, branchClientCrm.userId],
        set: setData,
      })
      .returning();

    return row;
  }

  async touchBranchClientLastVisit(branchId: string, userId: string, lastVisit: Date = new Date()): Promise<void> {
    await this.upsertBranchClientCrm(branchId, userId, { lastVisit });
  }

  async getActiveBranchCustomerBlock(branchId: string, userId: string): Promise<BranchCustomerBlock | null> {
    const [block] = await db
      .select()
      .from(branchCustomerBlocks)
      .where(and(
        eq(branchCustomerBlocks.branchId, branchId),
        eq(branchCustomerBlocks.userId, userId),
        isNull(branchCustomerBlocks.unblockedAt),
      ))
      .orderBy(desc(branchCustomerBlocks.createdAt))
      .limit(1);

    return block || null;
  }

  async setBranchCustomerBlock(
    branchId: string,
    userId: string,
    data: { blockedByUserId: string; reason?: string | null; note?: string | null },
  ): Promise<BranchCustomerBlock> {
    const existing = await this.getActiveBranchCustomerBlock(branchId, userId);
    if (existing) {
      const [updated] = await db
        .update(branchCustomerBlocks)
        .set({
          blockedByUserId: data.blockedByUserId,
          reason: data.reason ?? null,
          note: data.note ?? null,
        })
        .where(eq(branchCustomerBlocks.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(branchCustomerBlocks)
      .values({
        branchId,
        userId,
        blockedByUserId: data.blockedByUserId,
        reason: data.reason ?? null,
        note: data.note ?? null,
      })
      .returning();
    return created;
  }

  async unblockBranchCustomer(branchId: string, userId: string): Promise<number> {
    const result = await db
      .update(branchCustomerBlocks)
      .set({ unblockedAt: new Date() })
      .where(and(
        eq(branchCustomerBlocks.branchId, branchId),
        eq(branchCustomerBlocks.userId, userId),
        isNull(branchCustomerBlocks.unblockedAt),
      ));

    return Number((result as any).rowCount || 0);
  }

  async createCustomerReport(data: {
    branchId: string;
    userId: string;
    reportedByUserId: string;
    reason: string;
    note?: string | null;
  }): Promise<CustomerReport> {
    const [report] = await db
      .insert(customerReports)
      .values({
        branchId: data.branchId,
        userId: data.userId,
        reportedByUserId: data.reportedByUserId,
        reason: data.reason,
        note: data.note ?? null,
      })
      .returning();
    return report;
  }

  async getCustomerReports(params?: { branchId?: string; userId?: string; status?: string }): Promise<any[]> {
    const conditions: any[] = [];
    if (params?.branchId) conditions.push(eq(customerReports.branchId, params.branchId));
    if (params?.userId) conditions.push(eq(customerReports.userId, params.userId));
    if (params?.status) conditions.push(eq(customerReports.status, params.status as any));

    const branchReporterAlias = sql<string>`(
      SELECT u.name
      FROM users u
      WHERE u.id = ${customerReports.reportedByUserId}
      LIMIT 1
    )`;
    const reviewActorAlias = sql<string>`(
      SELECT u.name
      FROM users u
      WHERE u.id = ${customerReports.reviewedByUserId}
      LIMIT 1
    )`;

    const query = db
      .select({
        id: customerReports.id,
        branchId: customerReports.branchId,
        userId: customerReports.userId,
        reportedByUserId: customerReports.reportedByUserId,
        reason: customerReports.reason,
        note: customerReports.note,
        status: customerReports.status,
        createdAt: customerReports.createdAt,
        reviewedAt: customerReports.reviewedAt,
        reviewedByUserId: customerReports.reviewedByUserId,
        branchName: branches.name,
        branchSlug: branches.slug,
        customerName: users.name,
        customerLastName: users.lastName,
        customerEmail: users.email,
        reporterName: branchReporterAlias.as("reporter_name"),
        reviewerName: reviewActorAlias.as("reviewer_name"),
      })
      .from(customerReports)
      .innerJoin(branches, eq(customerReports.branchId, branches.id))
      .innerJoin(users, eq(customerReports.userId, users.id));

    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(customerReports.createdAt))
      : await query.orderBy(desc(customerReports.createdAt));

    return rows;
  }

  async updateCustomerReportStatus(reportId: string, status: string, reviewedByUserId: string): Promise<any> {
    const reviewedAt = status === "pending" ? null : new Date();
    const reviewedBy = status === "pending" ? null : reviewedByUserId;
    const [updated] = await db
      .update(customerReports)
      .set({
        status: status as any,
        reviewedAt,
        reviewedByUserId: reviewedBy,
      })
      .where(eq(customerReports.id, reportId))
      .returning();
    return updated;
  }

  async getBranchClients(branchId: string, includeLeft: boolean = false): Promise<any[]> {
    const conditions = [eq(memberships.branchId, branchId)];
    if (!includeLeft) {
      conditions.push(ne(memberships.status, "left"));
    }

    const results = await db
      .select({
        userId: users.id,
        name: users.name,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        birthDate: users.birthDate,
        gender: users.gender,
        avatarUrl: users.avatarUrl,
        membershipId: memberships.id,
        membershipStatus: memberships.status,
        clientStatus: memberships.clientStatus,
        hasDebt: memberships.hasDebt,
        debtAmount: memberships.debtAmount,
        joinedAt: memberships.joinedAt,
        lastSeenAt: memberships.lastSeenAt,
        source: memberships.source,
        isFavorite: memberships.isFavorite,
        planId: memberships.planId,
        planNameSnapshot: memberships.planNameSnapshot,
        classesRemaining: memberships.classesRemaining,
        classesTotal: memberships.classesTotal,
        expiresAt: memberships.expiresAt,
        paidAt: memberships.paidAt,
        membershipStartDate: memberships.membershipStartDate,
        membershipEndDate: memberships.membershipEndDate,
        planName: membershipPlans.name,
        cycleMonths: membershipPlans.cycleMonths,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(and(...conditions))
      .orderBy(desc(memberships.joinedAt));

    const clientIds = results.map((r) => r.userId);
    const lastAttendanceMap: Record<string, Date> = {};
    const latestBookingMap: Record<string, Date> = {};
    const crmMap: Record<string, BranchClientCrm> = {};
    const localBlockMap: Record<string, BranchCustomerBlock> = {};
    const reportCountMap: Record<string, number> = {};

    if (clientIds.length > 0) {
      const [attResults, bookingResults, crmResults, blockResults, reportResults] = await Promise.all([
        db
          .select({
            userId: attendances.userId,
            lastCheckin: sql<string>`MAX(${attendances.checkedInAt})`.as("last_checkin"),
          })
          .from(attendances)
          .where(and(
            eq(attendances.branchId, branchId),
            inArray(attendances.userId, clientIds),
          ))
          .groupBy(attendances.userId),
        db
          .select({
            userId: classBookings.userId,
            lastBookingAt: sql<string>`MAX(${classBookings.createdAt})`.as("last_booking_at"),
          })
          .from(classBookings)
          .where(and(
            eq(classBookings.branchId, branchId),
            inArray(classBookings.userId, clientIds),
          ))
          .groupBy(classBookings.userId),
        db
          .select()
          .from(branchClientCrm)
          .where(and(
            eq(branchClientCrm.branchId, branchId),
            inArray(branchClientCrm.userId, clientIds),
          )),
        db
          .select()
          .from(branchCustomerBlocks)
          .where(and(
            eq(branchCustomerBlocks.branchId, branchId),
            inArray(branchCustomerBlocks.userId, clientIds),
            isNull(branchCustomerBlocks.unblockedAt),
          )),
        db
          .select({
            userId: customerReports.userId,
            total: sql<number>`COUNT(*)`.as("total"),
          })
          .from(customerReports)
          .where(and(
            eq(customerReports.branchId, branchId),
            inArray(customerReports.userId, clientIds),
          ))
          .groupBy(customerReports.userId),
      ]);

      for (const attendance of attResults) {
        if (attendance.lastCheckin) {
          lastAttendanceMap[attendance.userId] = new Date(attendance.lastCheckin);
        }
      }

      for (const booking of bookingResults) {
        if (booking.lastBookingAt) {
          latestBookingMap[booking.userId] = new Date(booking.lastBookingAt);
        }
      }

      for (const crm of crmResults) {
        crmMap[crm.userId] = crm;
      }

      for (const block of blockResults) {
        localBlockMap[block.userId] = block;
      }

      for (const report of reportResults) {
        reportCountMap[report.userId] = Number(report.total) || 0;
      }
    }

    const now = new Date();
    return results.map(r => {
      let planStatus: "active" | "expired" | "deleted" | null = null;
      if (r.planId) {
        planStatus = (r.expiresAt && new Date(r.expiresAt) < now) ? "expired" : "active";
      } else if (r.planNameSnapshot) {
        planStatus = "deleted";
      }
      const crm = crmMap[r.userId];
      const lastAttendance = lastAttendanceMap[r.userId] || null;
      const lastVisit = getLatestDate(
        crm?.lastVisit,
        lastAttendance,
        latestBookingMap[r.userId],
      );
      const localBlock = localBlockMap[r.userId] || null;
      return {
        ...r,
        planName: r.planName || r.planNameSnapshot || null,
        planStatus,
        lastAttendance,
        crmClientStatus: resolveCrmClientStatus(crm?.clientStatus, lastVisit, r.joinedAt),
        crmManualStatus: crm?.clientStatus || null,
        lastVisit,
        tags: crm?.tags || null,
        isLocallyBlocked: !!localBlock,
        localBlockedAt: localBlock?.createdAt || null,
        localBlockReason: localBlock?.reason || null,
        reportCount: reportCountMap[r.userId] || 0,
      };
    });
  }

  async getClientProfile(userId: string, branchId: string): Promise<any> {
    const [membership] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.branchId, branchId)));

    if (!membership) return null;

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return null;

    let plan: MembershipPlan | null = null;
    if (membership.planId) {
      const [p] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, membership.planId));
      plan = p || null;
    }

    const notes = await this.getClientNotes(userId, branchId);
    const recentAttendances = await this.getClientAttendances(userId, branchId, 10);
    const [crmEntry] = await db
      .select()
      .from(branchClientCrm)
      .where(and(eq(branchClientCrm.branchId, branchId), eq(branchClientCrm.userId, userId)))
      .limit(1);
    const localBlock = await this.getActiveBranchCustomerBlock(branchId, userId);
    const reports = await this.getCustomerReports({ branchId, userId });

    const [attendanceCount] = await db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(attendances)
      .where(and(eq(attendances.userId, userId), eq(attendances.branchId, branchId)));

    const [latestBookingActivity] = await db
      .select({
        lastBookingAt: sql<string>`MAX(${classBookings.createdAt})`.as("last_booking_at"),
      })
      .from(classBookings)
      .where(and(eq(classBookings.userId, userId), eq(classBookings.branchId, branchId)));

    const today = getMxLocalDate();
    const nextBookingResults = await db
      .select({
        bookingDate: classBookings.bookingDate,
        className: classSchedules.name,
        startTime: classSchedules.startTime,
      })
      .from(classBookings)
      .innerJoin(classSchedules, eq(classBookings.classScheduleId, classSchedules.id))
      .where(
        and(
          eq(classBookings.userId, userId),
          eq(classBookings.branchId, branchId),
          eq(classBookings.status, "confirmed"),
          gte(classBookings.bookingDate, today)
        )
      )
      .orderBy(classBookings.bookingDate, classSchedules.startTime)
      .limit(1);

    const nextBooking = nextBookingResults.length > 0
      ? { bookingDate: nextBookingResults[0].bookingDate, className: nextBookingResults[0].className, startTime: nextBookingResults[0].startTime }
      : null;

    let planStatus: "active" | "expired" | "deleted" | null = null;
    if (membership.planId) {
      planStatus = (membership.expiresAt && new Date(membership.expiresAt) < new Date()) ? "expired" : "active";
    } else if (membership.planNameSnapshot) {
      planStatus = "deleted";
    }

    const lastVisit = getLatestDate(
      crmEntry?.lastVisit,
      recentAttendances[0]?.checkedInAt,
      latestBookingActivity?.lastBookingAt,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        birthDate: user.birthDate,
        gender: user.gender,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        medicalNotes: user.medicalNotes,
        injuriesNotes: user.injuriesNotes,
        medicalWarnings: user.medicalWarnings,
        parqAccepted: user.parqAccepted,
        parqAcceptedDate: user.parqAcceptedDate,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      membership,
      crm: {
        clientStatus: resolveCrmClientStatus(crmEntry?.clientStatus, lastVisit, membership.joinedAt),
        manualStatus: crmEntry?.clientStatus || null,
        lastVisit,
        tags: crmEntry?.tags || null,
      },
      moderation: {
        localBlock: localBlock
          ? {
              id: localBlock.id,
              reason: localBlock.reason,
              note: localBlock.note,
              createdAt: localBlock.createdAt,
            }
          : null,
        reports,
      },
      planStatus,
      planNameSnapshot: membership.planNameSnapshot,
      plan,
      notes,
      recentAttendances,
      totalAttendances: Number(attendanceCount?.count) || 0,
      nextBooking,
    };
  }

  async createClientNote(data: InsertClientNote): Promise<ClientNote> {
    const [note] = await db.insert(clientNotes).values(data).returning();
    return note;
  }

  async getClientNotes(userId: string, branchId: string): Promise<(ClientNote & { createdByName?: string })[]> {
    const results = await db
      .select({
        id: clientNotes.id,
        branchId: clientNotes.branchId,
        userId: clientNotes.userId,
        content: clientNotes.content,
        createdBy: clientNotes.createdBy,
        createdAt: clientNotes.createdAt,
        createdByName: users.name,
      })
      .from(clientNotes)
      .leftJoin(users, eq(clientNotes.createdBy, users.id))
      .where(and(eq(clientNotes.userId, userId), eq(clientNotes.branchId, branchId)))
      .orderBy(desc(clientNotes.createdAt));

    return results.map(r => ({
      ...r,
      createdByName: r.createdByName ?? undefined,
    }));
  }

  async createAttendance(data: InsertAttendance): Promise<Attendance> {
    const [att] = await db.insert(attendances).values(data).returning();
    await this.touchBranchClientLastVisit(data.branchId, data.userId);
    return att;
  }

  async getClientAttendances(userId: string, branchId: string, limit = 10): Promise<Attendance[]> {
    return db
      .select()
      .from(attendances)
      .where(and(eq(attendances.userId, userId), eq(attendances.branchId, branchId)))
      .orderBy(desc(attendances.checkedInAt))
      .limit(limit);
  }

  async updateUserPhone(id: string, phone: string | null): Promise<User | undefined> {
    const [user] = await db.update(users).set({ phone }).where(eq(users.id, id)).returning();
    return user;
  }

  async getBranchPlans(branchId: string): Promise<MembershipPlan[]> {
    return db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.branchId, branchId))
      .orderBy(desc(membershipPlans.isActive), asc(membershipPlans.name));
  }

  async createPlan(data: InsertMembershipPlan): Promise<MembershipPlan> {
    const [plan] = await db.insert(membershipPlans).values(data).returning();
    return plan;
  }

  async updatePlan(id: string, data: Partial<InsertMembershipPlan>): Promise<MembershipPlan | undefined> {
    const [plan] = await db
      .update(membershipPlans)
      .set(data)
      .where(eq(membershipPlans.id, id))
      .returning();
    return plan;
  }

  async deactivatePlan(id: string): Promise<MembershipPlan | undefined> {
    const [plan] = await db
      .update(membershipPlans)
      .set({ isActive: false })
      .where(eq(membershipPlans.id, id))
      .returning();
    return plan;
  }

  async detachPlanFromMemberships(planId: string, planName: string): Promise<number> {
    const affected = await db
      .update(memberships)
      .set({ planId: null, planNameSnapshot: planName })
      .where(and(eq(memberships.planId, planId), eq(memberships.status, "active")))
      .returning({ id: memberships.id });
    return affected.length;
  }

  async getPlan(id: string): Promise<MembershipPlan | undefined> {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, id));
    return plan;
  }

  async assignPlanToMembership(membershipId: string, planId: string, classesRemaining: number | null, classesTotal: number | null, expiresAt: Date | null): Promise<Membership | undefined> {
    const now = new Date();
    const [m] = await db
      .update(memberships)
      .set({
        planId,
        planNameSnapshot: null,
        classesRemaining,
        classesTotal,
        expiresAt,
        membershipStartDate: now,
        membershipEndDate: expiresAt,
        paidAt: now,
      })
      .where(eq(memberships.id, membershipId))
      .returning();
    return m;
  }

  async removePlanFromMembership(membershipId: string): Promise<Membership | undefined> {
    const [m] = await db
      .update(memberships)
      .set({ planId: null, classesRemaining: null, classesTotal: null, expiresAt: null, membershipStartDate: null, membershipEndDate: null, paidAt: null, renewedFromId: null })
      .where(eq(memberships.id, membershipId))
      .returning();
    return m;
  }

  async getMembershipByUserAndBranch(userId: string, branchId: string): Promise<Membership | undefined> {
    const [m] = await db.select().from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.branchId, branchId)));
    return m;
  }

  // Rule 2: Auto no-show reconciliation
  // Called on GET /api/branch/bookings — marks past confirmed bookings as no_show and deducts class
  //
  // Test scenarios:
  // 1. Client with 5 classes books 10am class. Class ends. reconcile → classesRemaining=4, booking=no_show
  // 2. Client cancels >3hrs before class → no deduction (classesRemaining stays same)
  // 3. Client cancels <3hrs before class → lateCancellation=true, classesRemaining decremented
  async reconcilePastBookings(branchId: string): Promise<number> {
    // First: auto-mark attended for bookings whose class START has passed.
    await this.autoMarkAttendedBookings(branchId);

    const { today, currentTime } = getMxLocalDateAndTime();

    // Fetch confirmed bookings up to and including today (local time).
    // We include today because same-day classes that have already ended need reconciling.
    // We use JavaScript to filter — not SQL — so we can properly handle
    // midnight-crossing classes (e.g. 23:00→00:00 where endTime < startTime).
    const candidates = await db
      .select({
        bookingId: classBookings.id,
        userId: classBookings.userId,
        bookingDate: classBookings.bookingDate,
        startTime: classSchedules.startTime,
        endTime: classSchedules.endTime,
      })
      .from(classBookings)
      .innerJoin(classSchedules, eq(classBookings.classScheduleId, classSchedules.id))
      .where(
        and(
          eq(classBookings.branchId, branchId),
          eq(classBookings.status, "confirmed"),
          sql`${classBookings.bookingDate} <= ${today}`
        )
      );

    let count = 0;
    for (const booking of candidates) {
      const { startTime, endTime, bookingDate } = booking;

      // Determine actual end date. If endTime < startTime the class crosses midnight.
      let endDate = bookingDate;
      if (endTime < startTime) {
        const d = new Date(bookingDate + "T12:00:00");
        d.setDate(d.getDate() + 1);
        endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }

      // The booking is past only when the real end datetime is in the past.
      const isPast =
        endDate < today ||
        (endDate === today && endTime <= currentTime);

      if (!isPast) continue;

      await db.update(classBookings).set({ status: "no_show" as any }).where(eq(classBookings.id, booking.bookingId));

      const mem = await this.getMembershipByUserAndBranch(booking.userId, branchId);
      if (mem && mem.classesRemaining !== null && mem.classesRemaining > 0) {
        await this.decrementClassesRemaining(mem.id);
      }
      count++;
    }
    return count;
  }

  // Auto-mark attended: runs on page load (via reconcilePastBookings) and from background job.
  // Finds confirmed bookings whose class START time has already passed and marks them as attended,
  // creating an attendance record and deducting 1 class — exactly the same as the manual "Asistió" button.
  // Guard: only processes status === "confirmed"; once attended or no_show, never re-processed.
  async autoMarkAttendedBookings(branchId: string): Promise<number> {
    const { today, currentTime } = getMxLocalDateAndTime();

    const candidates = await db
      .select({
        bookingId: classBookings.id,
        userId: classBookings.userId,
        branchId: classBookings.branchId,
        bookingDate: classBookings.bookingDate,
        startTime: classSchedules.startTime,
      })
      .from(classBookings)
      .innerJoin(classSchedules, eq(classBookings.classScheduleId, classSchedules.id))
      .where(
        and(
          eq(classBookings.branchId, branchId),
          eq(classBookings.status, "confirmed"),
          sql`${classBookings.bookingDate} <= ${today}`
        )
      );

    let count = 0;
    for (const booking of candidates) {
      // Class start is always on bookingDate (no midnight-crossing needed for start time).
      const classStarted =
        booking.bookingDate < today ||
        (booking.bookingDate === today && booking.startTime <= currentTime);

      if (!classStarted) continue;

      await db
        .update(classBookings)
        .set({ status: "attended" as any })
        .where(eq(classBookings.id, booking.bookingId));

      // Create attendance record — same as manual "Asistió". registeredBy = userId (system auto check-in).
      try {
        await this.createAttendance({
          userId: booking.userId,
          branchId: booking.branchId,
          registeredBy: booking.userId,
        });
      } catch (attErr: any) {
        console.error(`[AUTO-ATTEND] Error creating attendance record:`, attErr.message);
      }

      // Deduct 1 class from membership if applicable — same logic as manual button.
      const mem = await this.getMembershipByUserAndBranch(booking.userId, branchId);
      if (mem && mem.classesRemaining !== null && mem.classesRemaining > 0) {
        await this.decrementClassesRemaining(mem.id);
      }

      console.log(`[AUTO-ATTEND] Marked booking ${booking.bookingId} as attended for user ${booking.userId}`);
      count++;
    }
    return count;
  }

  async getAllActiveBranchIds(): Promise<string[]> {
    const result = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.status, "active"), isNull(branches.deletedAt)));
    return result.map(r => r.id);
  }

  async cancelFutureBookingsForUser(userId: string, branchId: string): Promise<number> {
    const today = getMxLocalDate();
    const result = await db
      .update(classBookings)
      .set({ status: "cancelled" as any })
      .where(
        and(
          eq(classBookings.userId, userId),
          eq(classBookings.branchId, branchId),
          eq(classBookings.status, "confirmed"),
          gte(classBookings.bookingDate, today)
        )
      )
      .returning({ id: classBookings.id });
    return result.length;
  }

  async decrementClassesRemaining(membershipId: string): Promise<Membership | undefined> {
    const [m] = await db
      .update(memberships)
      .set({ classesRemaining: sql`GREATEST(${memberships.classesRemaining} - 1, 0)` })
      .where(and(eq(memberships.id, membershipId), sql`${memberships.classesRemaining} IS NOT NULL AND ${memberships.classesRemaining} > 0`))
      .returning();
    return m;
  }

  async getBranchClassSchedules(branchId: string): Promise<ClassSchedule[]> {
    return db
      .select()
      .from(classSchedules)
      .where(eq(classSchedules.branchId, branchId))
      .orderBy(asc(classSchedules.dayOfWeek), asc(classSchedules.startTime));
  }

  async createClassSchedule(data: InsertClassSchedule): Promise<ClassSchedule> {
    const [schedule] = await db.insert(classSchedules).values(data).returning();
    return schedule;
  }

  async updateClassSchedule(id: string, data: Partial<InsertClassSchedule>): Promise<ClassSchedule | undefined> {
    const [schedule] = await db
      .update(classSchedules)
      .set(data)
      .where(eq(classSchedules.id, id))
      .returning();
    return schedule;
  }

  async getClassSchedule(id: string): Promise<ClassSchedule | undefined> {
    const [schedule] = await db.select().from(classSchedules).where(eq(classSchedules.id, id));
    return schedule;
  }

  async getBookingsForDate(branchId: string, date: string): Promise<any[]> {
    const results = await db
      .select({
        id: classBookings.id,
        classScheduleId: classBookings.classScheduleId,
        userId: classBookings.userId,
        bookingDate: classBookings.bookingDate,
        status: classBookings.status,
        source: classBookings.source,
        createdAt: classBookings.createdAt,
        userName: users.name,
        userEmail: users.email,
        className: classSchedules.name,
        startTime: classSchedules.startTime,
        endTime: classSchedules.endTime,
      })
      .from(classBookings)
      .innerJoin(users, eq(classBookings.userId, users.id))
      .innerJoin(classSchedules, eq(classBookings.classScheduleId, classSchedules.id))
      .where(and(
        eq(classBookings.branchId, branchId),
        eq(classBookings.bookingDate, date)
      ))
      .orderBy(asc(classSchedules.startTime), asc(users.name));
    return results;
  }

  async getBookingsForClassOnDate(classScheduleId: string, date: string): Promise<any[]> {
    const results = await db
      .select({
        id: classBookings.id,
        userId: classBookings.userId,
        status: classBookings.status,
        createdAt: classBookings.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(classBookings)
      .innerJoin(users, eq(classBookings.userId, users.id))
      .where(and(
        eq(classBookings.classScheduleId, classScheduleId),
        eq(classBookings.bookingDate, date)
      ))
      .orderBy(asc(users.name));

    // Deduplicate: keep only the most relevant booking per user.
    // A user may have multiple records if they booked, cancelled, and rebooked.
    // Priority: attended (1) > confirmed (2) > no_show (3) > cancelled (4)
    const statusPriority: Record<string, number> = { attended: 1, confirmed: 2, no_show: 3, cancelled: 4 };
    const byUser = new Map<string, typeof results[0]>();
    for (const row of results) {
      const existing = byUser.get(row.userId);
      const rowPriority = statusPriority[row.status] ?? 99;
      const existingPriority = existing ? (statusPriority[existing.status] ?? 99) : 99;
      if (!existing || rowPriority < existingPriority) {
        byUser.set(row.userId, row);
      }
    }
    return Array.from(byUser.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }

  async createBooking(data: InsertClassBooking): Promise<ClassBooking> {
    const [booking] = await db.insert(classBookings).values(data).returning();
    await this.touchBranchClientLastVisit(data.branchId, data.userId);
    return booking;
  }

  async updateBookingStatus(id: string, status: string): Promise<ClassBooking | undefined> {
    const [booking] = await db
      .update(classBookings)
      .set({ status: status as any })
      .where(eq(classBookings.id, id))
      .returning();
    return booking;
  }

  async markBookingLateCancellation(id: string): Promise<void> {
    await db.update(classBookings).set({ lateCancellation: true }).where(eq(classBookings.id, id));
  }

  async getBooking(id: string): Promise<ClassBooking | undefined> {
    const [booking] = await db.select().from(classBookings).where(eq(classBookings.id, id));
    return booking;
  }

  async getTodayBookingsCount(branchId: string): Promise<number> {
    const today = getMxLocalDate();
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(classBookings)
      .where(and(
        eq(classBookings.branchId, branchId),
        eq(classBookings.bookingDate, today),
        ne(classBookings.status, "cancelled")
      ));
    return Number(result?.count) || 0;
  }

  async getNextBooking(branchId: string): Promise<{ className: string; startTime: string; bookingDate: string } | null> {
    const { today, currentTime: now } = getMxLocalDateAndTime();
    const results = await db
      .select({
        className: classSchedules.name,
        startTime: classSchedules.startTime,
        bookingDate: classBookings.bookingDate,
      })
      .from(classBookings)
      .innerJoin(classSchedules, eq(classBookings.classScheduleId, classSchedules.id))
      .where(and(
        eq(classBookings.branchId, branchId),
        ne(classBookings.status, "cancelled"),
        or(
          sql`${classBookings.bookingDate} > ${today}`,
          and(
            eq(classBookings.bookingDate, today),
            sql`${classSchedules.startTime} >= ${now}`
          )
        )
      ))
      .orderBy(asc(classBookings.bookingDate), asc(classSchedules.startTime))
      .limit(1);
    return results[0] || null;
  }

  async getTvModeData(branchId: string, date: string): Promise<any[]> {
    // Use same day-of-week computation as getBookingsForClassOnDate callers:
    // parse as local noon to avoid UTC boundary issues
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const schedules = await db
      .select()
      .from(classSchedules)
      .where(and(
        eq(classSchedules.branchId, branchId),
        eq(classSchedules.dayOfWeek, dayOfWeek),
        eq(classSchedules.isActive, true)
      ))
      .orderBy(asc(classSchedules.startTime));

    const statusPriority: Record<string, number> = { attended: 1, confirmed: 2, no_show: 3, cancelled: 4 };

    const result = [];
    for (const schedule of schedules) {
      const rawBookings = await db
        .select({
          id: classBookings.id,
          userId: classBookings.userId,
          status: classBookings.status,
          userName: users.name,
          userEmail: users.email,
        })
        .from(classBookings)
        .innerJoin(users, eq(classBookings.userId, users.id))
        .where(and(
          eq(classBookings.classScheduleId, schedule.id),
          eq(classBookings.bookingDate, date)
        ))
        .orderBy(asc(users.name));

      // Deduplicate per user — same logic as getBookingsForClassOnDate
      const byUser = new Map<string, typeof rawBookings[0]>();
      for (const row of rawBookings) {
        const existing = byUser.get(row.userId);
        const rowPriority = statusPriority[row.status] ?? 99;
        const existingPriority = existing ? (statusPriority[existing.status] ?? 99) : 99;
        if (!existing || rowPriority < existingPriority) {
          byUser.set(row.userId, row);
        }
      }
      const bookings = Array.from(byUser.values()).sort((a, b) => a.userName.localeCompare(b.userName));

      const attended = bookings.filter(b => b.status === "attended").length;
      const confirmed = bookings.filter(b => b.status === "confirmed").length;
      const cancelled = bookings.filter(b => b.status === "cancelled").length;

      result.push({
        id: schedule.id,
        name: schedule.name,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        capacity: schedule.capacity,
        instructorName: schedule.instructorName,
        routineDescription: schedule.routineDescription,
        routineImageUrl: schedule.routineImageUrl,
        bookings,
        summary: { total: bookings.length, attended, confirmed, cancelled },
      });
    }
    return result;
  }

  async updateClassRoutine(classId: string, routineDescription: string | null, routineImageUrl: string | null): Promise<ClassSchedule | undefined> {
    const [updated] = await db
      .update(classSchedules)
      .set({ routineDescription, routineImageUrl })
      .where(eq(classSchedules.id, classId))
      .returning();
    return updated;
  }

  async getBranchPhotos(branchId: string): Promise<BranchPhoto[]> {
    return db
      .select()
      .from(branchPhotos)
      .where(eq(branchPhotos.branchId, branchId))
      .orderBy(asc(branchPhotos.displayOrder));
  }

  async addBranchPhoto(data: InsertBranchPhoto): Promise<BranchPhoto> {
    const [photo] = await db.insert(branchPhotos).values(data).returning();
    return photo;
  }

  async deleteBranchPhoto(id: string): Promise<void> {
    await db.delete(branchPhotos).where(eq(branchPhotos.id, id));
  }

  async reorderBranchPhotos(branchId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(branchPhotos)
        .set({ displayOrder: i })
        .where(and(eq(branchPhotos.id, ids[i]), eq(branchPhotos.branchId, branchId)));
    }
  }

  async getBranchPosts(branchId: string): Promise<BranchPost[]> {
    return db
      .select()
      .from(branchPosts)
      .where(eq(branchPosts.branchId, branchId))
      .orderBy(asc(branchPosts.displayOrder));
  }

  async createBranchPost(data: InsertBranchPost): Promise<BranchPost> {
    const [post] = await db.insert(branchPosts).values(data).returning();
    return post;
  }

  async updateBranchPost(id: string, data: Partial<InsertBranchPost>): Promise<BranchPost | undefined> {
    const [post] = await db
      .update(branchPosts)
      .set(data as any)
      .where(eq(branchPosts.id, id))
      .returning();
    return post;
  }

  async deleteBranchPost(id: string): Promise<void> {
    await db.delete(branchPosts).where(eq(branchPosts.id, id));
  }

  async reorderBranchPosts(branchId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(branchPosts)
        .set({ displayOrder: i })
        .where(and(eq(branchPosts.id, ids[i]), eq(branchPosts.branchId, branchId)));
    }
  }

  async getBranchProducts(branchId: string): Promise<BranchProduct[]> {
    return db
      .select()
      .from(branchProducts)
      .where(eq(branchProducts.branchId, branchId))
      .orderBy(asc(branchProducts.displayOrder));
  }

  async createBranchProduct(data: InsertBranchProduct): Promise<BranchProduct> {
    const [product] = await db.insert(branchProducts).values(data).returning();
    return product;
  }

  async updateBranchProduct(id: string, data: Partial<InsertBranchProduct>): Promise<BranchProduct | undefined> {
    const [product] = await db
      .update(branchProducts)
      .set(data as any)
      .where(eq(branchProducts.id, id))
      .returning();
    return product;
  }

  async deleteBranchProduct(id: string): Promise<void> {
    await db.delete(branchProducts).where(eq(branchProducts.id, id));
  }

  async reorderBranchProducts(branchId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(branchProducts)
        .set({ displayOrder: i })
        .where(and(eq(branchProducts.id, ids[i]), eq(branchProducts.branchId, branchId)));
    }
  }

  async getBranchVideos(branchId: string): Promise<BranchVideo[]> {
    return db
      .select()
      .from(branchVideos)
      .where(eq(branchVideos.branchId, branchId))
      .orderBy(asc(branchVideos.displayOrder));
  }

  async addBranchVideo(data: InsertBranchVideo): Promise<BranchVideo> {
    const [video] = await db.insert(branchVideos).values(data).returning();
    return video;
  }

  async deleteBranchVideo(id: string): Promise<void> {
    await db.delete(branchVideos).where(eq(branchVideos.id, id));
  }

  async reorderBranchVideos(branchId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(branchVideos)
        .set({ displayOrder: i })
        .where(and(eq(branchVideos.id, ids[i]), eq(branchVideos.branchId, branchId)));
    }
  }
  async copyClassSchedules(branchId: string, fromDay: number, toDay: number): Promise<ClassSchedule[]> {
    const sourceSchedules = await db
      .select()
      .from(classSchedules)
      .where(and(
        eq(classSchedules.branchId, branchId),
        eq(classSchedules.dayOfWeek, fromDay),
        eq(classSchedules.isActive, true)
      ))
      .orderBy(asc(classSchedules.startTime));

    if (sourceSchedules.length === 0) return [];

    const existingOnTarget = await db
      .select()
      .from(classSchedules)
      .where(and(
        eq(classSchedules.branchId, branchId),
        eq(classSchedules.dayOfWeek, toDay),
        eq(classSchedules.isActive, true)
      ));

    const existingSet = new Set(
      existingOnTarget.map(s => `${s.name}|${s.startTime}`)
    );

    const toCopy = sourceSchedules.filter(
      s => !existingSet.has(`${s.name}|${s.startTime}`)
    );

    if (toCopy.length === 0) return [];

    const created: ClassSchedule[] = [];
    for (const s of toCopy) {
      const [newSchedule] = await db.insert(classSchedules).values({
        branchId,
        name: s.name,
        description: s.description,
        dayOfWeek: toDay,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        instructorName: s.instructorName,
        isActive: true,
      }).returning();
      created.push(newSchedule);
    }

    return created;
  }

  async getExpiringMemberships(branchId: string, daysAhead: number): Promise<any[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const results = await db
      .select({
        userId: users.id,
        name: users.name,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        membershipId: memberships.id,
        planName: membershipPlans.name,
        expiresAt: memberships.expiresAt,
        classesRemaining: memberships.classesRemaining,
        classesTotal: memberships.classesTotal,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(and(
        eq(memberships.branchId, branchId),
        eq(memberships.status, "active"),
        sql`${memberships.expiresAt} IS NOT NULL`,
        sql`${memberships.expiresAt} >= ${now.toISOString()}`,
        sql`${memberships.expiresAt} <= ${futureDate.toISOString()}`
      ))
      .orderBy(asc(memberships.expiresAt));

    return results;
  }

  async getInactiveClients(branchId: string, daysSince: number): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSince);

    const results = await db
      .select({
        userId: users.id,
        name: users.name,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        membershipId: memberships.id,
        joinedAt: memberships.joinedAt,
        lastSeenAt: memberships.lastSeenAt,
        planName: membershipPlans.name,
        lastAttendance: sql<string>`(
          SELECT MAX(${attendances.checkedInAt})
          FROM ${attendances}
          WHERE ${attendances.userId} = ${users.id}
            AND ${attendances.branchId} = ${memberships.branchId}
        )`.as("last_attendance"),
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(and(
        eq(memberships.branchId, branchId),
        eq(memberships.status, "active"),
        sql`COALESCE(
          (SELECT MAX(${attendances.checkedInAt}) FROM ${attendances} WHERE ${attendances.userId} = ${users.id} AND ${attendances.branchId} = ${memberships.branchId}),
          ${memberships.joinedAt}
        ) < ${cutoffDate.toISOString()}`
      ))
      .orderBy(asc(sql`COALESCE(
        (SELECT MAX(${attendances.checkedInAt}) FROM ${attendances} WHERE ${attendances.userId} = ${users.id} AND ${attendances.branchId} = ${memberships.branchId}),
        ${memberships.joinedAt}
      )`));

    return results;
  }

  async getClientsWithoutClasses(branchId: string): Promise<any[]> {
    const results = await db
      .select({
        userId: users.id,
        name: users.name,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        membershipId: memberships.id,
        planName: membershipPlans.name,
        classesRemaining: memberships.classesRemaining,
        classesTotal: memberships.classesTotal,
        expiresAt: memberships.expiresAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(and(
        eq(memberships.branchId, branchId),
        eq(memberships.status, "active"),
        eq(memberships.clientStatus, "active"),
        sql`${memberships.classesRemaining} IS NOT NULL AND ${memberships.classesRemaining} = 0`,
        sql`${memberships.expiresAt} IS NOT NULL AND ${memberships.expiresAt} >= NOW()`
      ));
    return results;
  }

  async getExpiredMemberships(branchId: string): Promise<any[]> {
    const now = new Date();
    const results = await db
      .select({
        userId: users.id,
        name: users.name,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        membershipId: memberships.id,
        planName: membershipPlans.name,
        expiresAt: memberships.expiresAt,
        classesRemaining: memberships.classesRemaining,
        paidAt: memberships.paidAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(and(
        eq(memberships.branchId, branchId),
        eq(memberships.status, "active"),
        eq(memberships.clientStatus, "active"),
        sql`${memberships.expiresAt} IS NOT NULL`,
        sql`${memberships.expiresAt} < ${now.toISOString()}`
      ))
      .orderBy(asc(memberships.expiresAt));
    return results;
  }

  async markExpiredMemberships(branchId: string): Promise<number> {
    const now = new Date();
    const result = await db
      .update(memberships)
      .set({ clientStatus: "inactive" })
      .where(and(
        eq(memberships.branchId, branchId),
        eq(memberships.status, "active"),
        eq(memberships.clientStatus, "active"),
        sql`${memberships.expiresAt} IS NOT NULL`,
        sql`${memberships.expiresAt} < ${now.toISOString()}`
      ))
      .returning();
    return result.length;
  }

  async renewMembership(membershipId: string, planId: string, classesRemaining: number | null, classesTotal: number | null, expiresAt: Date, paidAt: Date): Promise<Membership | undefined> {
    const [m] = await db
      .update(memberships)
      .set({
        planId,
        classesRemaining,
        classesTotal,
        expiresAt,
        membershipStartDate: paidAt,
        membershipEndDate: expiresAt,
        paidAt,
        clientStatus: "active",
      })
      .where(eq(memberships.id, membershipId))
      .returning();
    return m;
  }

  async getMembershipsAssignedToPlan(planId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(memberships)
      .where(and(
        eq(memberships.planId, planId),
        eq(memberships.status, "active")
      ));
    return Number(result?.count) || 0;
  }

  async updateClient(userId: string, data: { name?: string; email?: string; lastName?: string | null; phone?: string | null; birthDate?: string | null; gender?: string | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null; medicalNotes?: string | null; injuriesNotes?: string | null; medicalWarnings?: string | null; parqAccepted?: boolean; parqAcceptedDate?: string | null; avatarUrl?: string | null }): Promise<any> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = data.emergencyContactPhone;
    if (data.medicalNotes !== undefined) updateData.medicalNotes = data.medicalNotes;
    if (data.injuriesNotes !== undefined) updateData.injuriesNotes = data.injuriesNotes;
    if (data.medicalWarnings !== undefined) updateData.medicalWarnings = data.medicalWarnings;
    if (data.parqAccepted !== undefined) updateData.parqAccepted = data.parqAccepted;
    if (data.parqAcceptedDate !== undefined) updateData.parqAcceptedDate = data.parqAcceptedDate;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    if (Object.keys(updateData).length === 0) return null;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return updated;
  }

  async updateClientDebt(membershipId: string, hasDebt: boolean, debtAmount: number): Promise<any> {
    const [updated] = await db
      .update(memberships)
      .set({ hasDebt, debtAmount })
      .where(eq(memberships.id, membershipId))
      .returning();
    return updated;
  }

  async updateClientStatus(membershipId: string, clientStatus: string): Promise<any> {
    const [updated] = await db
      .update(memberships)
      .set({ clientStatus })
      .where(eq(memberships.id, membershipId))
      .returning();
    return updated;
  }

  async updateBranchClientCrm(branchId: string, userId: string, data: { clientStatus?: string | null; tags?: string | null; lastVisit?: Date | null }): Promise<any> {
    const membership = await this.getMembership(userId, branchId);
    const crmEntry = await this.upsertBranchClientCrm(branchId, userId, data);
    const lastVisit = getLatestDate(crmEntry.lastVisit);

    return {
      clientStatus: crmEntry.clientStatus,
      crmClientStatus: resolveCrmClientStatus(crmEntry.clientStatus, lastVisit, membership?.joinedAt || null),
      lastVisit,
      tags: crmEntry.tags,
    };
  }

  async softDeleteMembership(membershipId: string): Promise<any> {
    const [updated] = await db
      .update(memberships)
      .set({ status: "left" })
      .where(eq(memberships.id, membershipId))
      .returning();
    return updated;
  }

  async getUpcomingBookingsForUser(branchId: string, userId: string, fromDate: string, limit: number = 5): Promise<any[]> {
    const results = await db
      .select({
        id: classBookings.id,
        classScheduleId: classBookings.classScheduleId,
        bookingDate: classBookings.bookingDate,
        status: classBookings.status,
        className: classSchedules.name,
        startTime: classSchedules.startTime,
        endTime: classSchedules.endTime,
        instructorName: classSchedules.instructorName,
      })
      .from(classBookings)
      .innerJoin(classSchedules, eq(classBookings.classScheduleId, classSchedules.id))
      .where(and(
        eq(classBookings.branchId, branchId),
        eq(classBookings.userId, userId),
        gte(classBookings.bookingDate, fromDate),
        eq(classBookings.status, "confirmed")
      ))
      .orderBy(asc(classBookings.bookingDate), asc(classSchedules.startTime))
      .limit(limit);
    return results;
  }

  async updateBranchWhatsappTemplates(branchId: string, templates: Record<string, string>): Promise<any> {
    const [updated] = await db
      .update(branches)
      .set({ whatsappTemplates: templates })
      .where(eq(branches.id, branchId))
      .returning();
    return updated;
  }

  async getBranchAnnouncements(branchId: string): Promise<BranchAnnouncement[]> {
    return await db
      .select()
      .from(branchAnnouncements)
      .where(eq(branchAnnouncements.branchId, branchId))
      .orderBy(desc(branchAnnouncements.createdAt));
  }

  async createAnnouncement(data: InsertBranchAnnouncement): Promise<BranchAnnouncement> {
    const [announcement] = await db.insert(branchAnnouncements).values(data).returning();
    return announcement;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(branchAnnouncements).where(eq(branchAnnouncements.id, id));
  }

  async deactivateAllAnnouncements(branchId: string): Promise<void> {
    await db
      .update(branchAnnouncements)
      .set({ isActive: false })
      .where(and(eq(branchAnnouncements.branchId, branchId), eq(branchAnnouncements.isActive, true)));
  }

  async updateBranchProfile(branchId: string, data: { description?: string | null; address?: string | null; city?: string | null; googleMapsUrl?: string | null; operatingHours?: any; locations?: any; category?: string | null; subcategory?: string | null; searchKeywords?: string | null; latitude?: number | null; longitude?: number | null; whatsappNumber?: string | null }): Promise<any> {
    const setData: any = {};
    if (data.description !== undefined) setData.description = data.description;
    if (data.address !== undefined) setData.address = data.address;
    if (data.city !== undefined) setData.city = data.city;
    if (data.googleMapsUrl !== undefined) setData.googleMapsUrl = data.googleMapsUrl;
    if (data.operatingHours !== undefined) setData.operatingHours = data.operatingHours;
    if (data.locations !== undefined) setData.locations = data.locations;
    if (data.category !== undefined) setData.category = data.category;
    if (data.subcategory !== undefined) setData.subcategory = data.subcategory;
    if (data.searchKeywords !== undefined) setData.searchKeywords = data.searchKeywords;
    if (data.latitude !== undefined) setData.latitude = data.latitude;
    if (data.longitude !== undefined) setData.longitude = data.longitude;
    if (data.whatsappNumber !== undefined) setData.whatsappNumber = data.whatsappNumber;

    if (Object.keys(setData).length === 0) return null;

    const [updated] = await db
      .update(branches)
      .set(setData)
      .where(eq(branches.id, branchId))
      .returning();
    return updated;
  }

  async getUpcomingBirthdays(branchId: string, daysAhead: number = 7): Promise<any[]> {
    const results = await db.execute(sql`
      SELECT u.id as "userId", u.name, u.last_name as "lastName", u.phone, u.birth_date as "birthDate",
             m.id as "membershipId"
      FROM users u
      INNER JOIN memberships m ON m.user_id = u.id
      WHERE m.branch_id = ${branchId}
        AND m.status = 'active'
        AND u.birth_date IS NOT NULL
        AND u.birth_date != ''
        AND (
          TO_DATE(u.birth_date, 'YYYY-MM-DD') IS NOT NULL
          AND (
            (EXTRACT(MONTH FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) = EXTRACT(MONTH FROM CURRENT_DATE)
             AND EXTRACT(DAY FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) >= EXTRACT(DAY FROM CURRENT_DATE)
             AND EXTRACT(DAY FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) <= EXTRACT(DAY FROM (CURRENT_DATE + ${daysAhead}::int)))
            OR
            (EXTRACT(MONTH FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) = EXTRACT(MONTH FROM (CURRENT_DATE + ${daysAhead}::int))
             AND EXTRACT(MONTH FROM CURRENT_DATE) != EXTRACT(MONTH FROM (CURRENT_DATE + ${daysAhead}::int))
             AND EXTRACT(DAY FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) <= EXTRACT(DAY FROM (CURRENT_DATE + ${daysAhead}::int)))
          )
        )
      ORDER BY EXTRACT(MONTH FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')), EXTRACT(DAY FROM TO_DATE(u.birth_date, 'YYYY-MM-DD'))
    `);
    return results.rows as any[];
  }

  async getBranchReviews(branchId: string): Promise<any[]> {
    const results = await db
      .select({
        id: branchReviews.id,
        rating: branchReviews.rating,
        comment: branchReviews.comment,
        adminReply: branchReviews.adminReply,
        isHidden: branchReviews.isHidden,
        hiddenReason: branchReviews.hiddenReason,
        createdAt: branchReviews.createdAt,
        userName: users.name,
        userLastName: users.lastName,
      })
      .from(branchReviews)
      .innerJoin(users, eq(branchReviews.userId, users.id))
      .where(and(
        eq(branchReviews.branchId, branchId),
        eq(branchReviews.isHidden, false),
      ))
      .orderBy(desc(branchReviews.createdAt))
      .limit(20);
    return results;
  }

  async getBranchReviewsSummary(branchId: string): Promise<{ averageRating: number; totalReviews: number }> {
    const result = await db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${branchReviews.rating}), 0)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(branchReviews)
      .where(and(
        eq(branchReviews.branchId, branchId),
        eq(branchReviews.isHidden, false),
      ));
    return {
      averageRating: Number(result[0]?.avgRating || 0),
      totalReviews: Number(result[0]?.total || 0),
    };
  }

  async getUserReview(branchId: string, userId: string): Promise<BranchReview | null> {
    const result = await db
      .select()
      .from(branchReviews)
      .where(and(eq(branchReviews.branchId, branchId), eq(branchReviews.userId, userId)))
      .limit(1);
    return result[0] || null;
  }

  async createOrUpdateReview(branchId: string, userId: string, rating: number, comment?: string | null): Promise<BranchReview> {
    const existing = await this.getUserReview(branchId, userId);
    if (existing) {
      const updated = await db
        .update(branchReviews)
        .set({ rating, comment: comment || null })
        .where(eq(branchReviews.id, existing.id))
        .returning();
      return updated[0];
    }
    const inserted = await db
      .insert(branchReviews)
      .values({ branchId, userId, rating, comment: comment || null })
      .returning();
    return inserted[0];
  }

  async getCustomerAppOverview(): Promise<{ total: number; active: number; blocked: number; recent: number; pendingReports: number }> {
    const [userStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        blocked: sql<number>`COUNT(*) FILTER (WHERE ${users.isBlocked} = true)`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${users.isBlocked} = false)`,
        recent: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= NOW() - INTERVAL '30 days')`,
      })
      .from(users)
      .where(eq(users.role, "CUSTOMER"));

    const [reportStats] = await db
      .select({
        pending: sql<number>`COUNT(*) FILTER (WHERE ${customerReports.status} = 'pending')`,
      })
      .from(customerReports);

    return {
      total: Number(userStats?.total) || 0,
      active: Number(userStats?.active) || 0,
      blocked: Number(userStats?.blocked) || 0,
      recent: Number(userStats?.recent) || 0,
      pendingReports: Number(reportStats?.pending) || 0,
    };
  }

  async getCustomerAppUsers(search?: string): Promise<any[]> {
    const conditions: any[] = [eq(users.role, "CUSTOMER")];
    const normalizedQuery = search ? normalizeSearchText(search) : "";

    if (normalizedQuery) {
      const likeQuery = `%${normalizedQuery}%`;
      const fullName = sql<string>`concat_ws(' ', ${users.name}, coalesce(${users.lastName}, ''))`;
      conditions.push(
        or(
          sql`${normalizedSearchSqlSafe(fullName)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(users.email)} LIKE ${likeQuery}`,
          sql`${normalizedSearchSqlSafe(users.phone)} LIKE ${likeQuery}`,
        ),
      );
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
        isBlocked: users.isBlocked,
        blockedAt: users.blockedAt,
        blockedReason: users.blockedReason,
        blockedBy: users.blockedBy,
        branchCount: sql<number>`(
          SELECT COUNT(DISTINCT m.branch_id)
          FROM memberships m
          WHERE m.user_id = ${users.id}
            AND m.status = 'active'
        )`,
        reviewCount: sql<number>`(
          SELECT COUNT(*)
          FROM branch_reviews r
          WHERE r.user_id = ${users.id}
        )`,
        lastActivity: sql<Date | null>`NULLIF(GREATEST(
          COALESCE(${users.createdAt}, to_timestamp(0)),
          COALESCE((SELECT MAX(m.last_seen_at) FROM memberships m WHERE m.user_id = ${users.id}), to_timestamp(0)),
          COALESCE((SELECT MAX(cb.created_at) FROM class_bookings cb WHERE cb.user_id = ${users.id}), to_timestamp(0)),
          COALESCE((SELECT MAX(bc.last_visit) FROM branch_client_crm bc WHERE bc.user_id = ${users.id}), to_timestamp(0)),
          COALESCE((SELECT MAX(rv.created_at) FROM branch_reviews rv WHERE rv.user_id = ${users.id}), to_timestamp(0))
        ), to_timestamp(0))`,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));

    return rows.map((row) => ({
      ...row,
      branchCount: Number(row.branchCount) || 0,
      reviewCount: Number(row.reviewCount) || 0,
    }));
  }

  async getCustomerAppUserDetail(userId: string): Promise<any> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, "CUSTOMER")))
      .limit(1);

    if (!user) return null;

    const [membershipCountRows, reviewCountRows] = await Promise.all([
      db
        .select({
          total: sql<number>`COUNT(DISTINCT ${memberships.branchId})`,
        })
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"))),
      db
        .select({
          total: sql<number>`COUNT(*)`,
        })
        .from(branchReviews)
        .where(eq(branchReviews.userId, userId)),
    ]);

    const membershipsRows = await db
      .select({
        id: memberships.id,
        branchId: memberships.branchId,
        status: memberships.status,
        joinedAt: memberships.joinedAt,
        lastSeenAt: memberships.lastSeenAt,
        clientStatus: memberships.clientStatus,
        isFavorite: memberships.isFavorite,
        branchName: branches.name,
        branchSlug: branches.slug,
      })
      .from(memberships)
      .innerJoin(branches, eq(memberships.branchId, branches.id))
      .where(eq(memberships.userId, userId))
      .orderBy(desc(memberships.joinedAt));

    const reviewRows = await db
      .select({
        id: branchReviews.id,
        branchId: branchReviews.branchId,
        rating: branchReviews.rating,
        comment: branchReviews.comment,
        adminReply: branchReviews.adminReply,
        isHidden: branchReviews.isHidden,
        hiddenReason: branchReviews.hiddenReason,
        createdAt: branchReviews.createdAt,
        branchName: branches.name,
        branchSlug: branches.slug,
      })
      .from(branchReviews)
      .innerJoin(branches, eq(branchReviews.branchId, branches.id))
      .where(eq(branchReviews.userId, userId))
      .orderBy(desc(branchReviews.createdAt));

    const reports = await this.getCustomerReports({ userId });
    const localBlocks = await db
      .select({
        id: branchCustomerBlocks.id,
        branchId: branchCustomerBlocks.branchId,
        reason: branchCustomerBlocks.reason,
        note: branchCustomerBlocks.note,
        createdAt: branchCustomerBlocks.createdAt,
        unblockedAt: branchCustomerBlocks.unblockedAt,
        branchName: branches.name,
        branchSlug: branches.slug,
      })
      .from(branchCustomerBlocks)
      .innerJoin(branches, eq(branchCustomerBlocks.branchId, branches.id))
      .where(eq(branchCustomerBlocks.userId, userId))
      .orderBy(desc(branchCustomerBlocks.createdAt));

    const [lastActivityRow] = await db
      .select({
        lastActivity: sql<Date | null>`NULLIF(GREATEST(
          COALESCE(${users.createdAt}, to_timestamp(0)),
          COALESCE((SELECT MAX(m.last_seen_at) FROM memberships m WHERE m.user_id = ${userId}), to_timestamp(0)),
          COALESCE((SELECT MAX(cb.created_at) FROM class_bookings cb WHERE cb.user_id = ${userId}), to_timestamp(0)),
          COALESCE((SELECT MAX(bc.last_visit) FROM branch_client_crm bc WHERE bc.user_id = ${userId}), to_timestamp(0)),
          COALESCE((SELECT MAX(rv.created_at) FROM branch_reviews rv WHERE rv.user_id = ${userId}), to_timestamp(0))
        ), to_timestamp(0))`,
      })
      .from(users)
      .where(eq(users.id, userId));

    return {
      user,
      stats: {
        branchCount: Number(membershipCountRows[0]?.total) || 0,
        reviewCount: Number(reviewCountRows[0]?.total) || 0,
        lastActivity: lastActivityRow?.lastActivity || null,
      },
      memberships: membershipsRows,
      reviews: reviewRows,
      reports,
      localBlocks,
    };
  }

  async updateCustomerGlobalBlock(
    userId: string,
    data: { isBlocked: boolean; blockedReason?: string | null; blockedBy?: string | null },
  ): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        isBlocked: data.isBlocked,
        blockedAt: data.isBlocked ? new Date() : null,
        blockedReason: data.isBlocked ? (data.blockedReason ?? null) : null,
        blockedBy: data.isBlocked ? (data.blockedBy ?? null) : null,
      })
      .where(and(eq(users.id, userId), eq(users.role, "CUSTOMER")))
      .returning();

    return updated;
  }

  async hideCustomerReviews(userId: string, hidden: boolean, reason?: string | null): Promise<number> {
    const result = await db
      .update(branchReviews)
      .set({
        isHidden: hidden,
        hiddenReason: hidden ? (reason ?? "Moderado por Super Admin") : null,
      })
      .where(eq(branchReviews.userId, userId));
    return Number((result as any).rowCount || 0);
  }

  async deleteCustomerAppUserSafely(userId: string): Promise<{ deleted: boolean; reason?: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, "CUSTOMER")))
      .limit(1);

    if (!user) {
      return { deleted: false, reason: "Usuario no encontrado" };
    }

    const [bookingCount, attendanceCount, activeMembershipCount] = await Promise.all([
      db.select({ total: sql<number>`COUNT(*)` }).from(classBookings).where(eq(classBookings.userId, userId)),
      db.select({ total: sql<number>`COUNT(*)` }).from(attendances).where(eq(attendances.userId, userId)),
      db.select({ total: sql<number>`COUNT(*)` }).from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.status, "active"))),
    ]);

    if (Number(bookingCount[0]?.total) > 0) {
      return { deleted: false, reason: "El usuario tiene reservas registradas" };
    }
    if (Number(attendanceCount[0]?.total) > 0) {
      return { deleted: false, reason: "El usuario tiene asistencias registradas" };
    }
    if (Number(activeMembershipCount[0]?.total) > 0) {
      return { deleted: false, reason: "El usuario tiene membresias activas" };
    }

    await db.delete(systemEvents).where(eq(systemEvents.userId, userId));
    await db.delete(notifications).where(eq(notifications.recipientUserId, userId));
    await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
    await db.delete(branchReviews).where(eq(branchReviews.userId, userId));
    await db.delete(customerReports).where(eq(customerReports.userId, userId));
    await db.delete(branchCustomerBlocks).where(eq(branchCustomerBlocks.userId, userId));
    await db.delete(branchClientCrm).where(eq(branchClientCrm.userId, userId));
    await db.delete(clientNotes).where(eq(clientNotes.userId, userId));
    await db.delete(memberships).where(eq(memberships.userId, userId));
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    return { deleted: true };
  }

  async getBranchRatings(branchIds: string[]): Promise<Record<string, { averageRating: number; totalReviews: number }>> {
    if (!branchIds.length) return {};
    const rows = await db
      .select({
        branchId: branchReviews.branchId,
        avgRating: sql<number>`ROUND(AVG(${branchReviews.rating})::numeric, 1)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(branchReviews)
      .where(and(
        inArray(branchReviews.branchId, branchIds),
        eq(branchReviews.isHidden, false),
      ))
      .groupBy(branchReviews.branchId);
    const map: Record<string, { averageRating: number; totalReviews: number }> = {};
    for (const row of rows) {
      map[row.branchId] = { averageRating: Number(row.avgRating) || 0, totalReviews: Number(row.total) || 0 };
    }
    return map;
  }

  async getBranchRanking(): Promise<{ id: string; name: string; slug: string; category: string | null; subcategory: string | null; city: string | null; address: string | null; coverImageUrl: string | null; profileImageUrl: string | null; averageRating: number; totalReviews: number }[]> {
    const profileImgSubquery = sql<string | null>`(SELECT url FROM branch_photos WHERE branch_id = branches.id AND type = 'profile' LIMIT 1)`;
    const rows = await db
      .select({
        id: branches.id,
        name: branches.name,
        slug: branches.slug,
        category: branches.category,
        subcategory: branches.subcategory,
        city: branches.city,
        address: branches.address,
        coverImageUrl: branches.coverImageUrl,
        profileImageUrl: profileImgSubquery.as("profile_image_url"),
        avgRating: sql<number>`ROUND(COALESCE(AVG(${branchReviews.rating}), 0)::numeric, 1)`,
        totalReviews: sql<number>`COUNT(${branchReviews.id})`,
      })
      .from(branches)
      .leftJoin(branchReviews, eq(branchReviews.branchId, branches.id))
      .where(and(
        eq(branches.status, "active"),
        isNull(branches.deletedAt),
        sql`(${branchReviews.id} IS NULL OR ${branchReviews.isHidden} = false)`,
      ))
      .groupBy(branches.id)
      .having(sql`COUNT(${branchReviews.id}) > 0`)
      .orderBy(desc(sql`ROUND(COALESCE(AVG(${branchReviews.rating}), 0)::numeric, 1)`), desc(sql`COUNT(${branchReviews.id})`))
      .limit(50);
    return rows.map(r => ({
      ...r,
      averageRating: Number(r.avgRating) || 0,
      totalReviews: Number(r.totalReviews) || 0,
    }));
  }

  async createPromotion(data: InsertPromotion): Promise<Promotion> {
    const [promo] = await db.insert(promotions).values(data).returning();
    return promo;
  }

  async getBranchPromotions(branchId: string): Promise<Promotion[]> {
    return db
      .select()
      .from(promotions)
      .where(eq(promotions.branchId, branchId))
      .orderBy(desc(promotions.createdAt));
  }

  async getGlobalPromotions(): Promise<(Promotion & { branchName: string; branchSlug: string; branchWhatsapp: string | null })[]> {
    const today = getMxLocalDate();
    const rows = await db
      .select({
        id: promotions.id,
        branchId: promotions.branchId,
        title: promotions.title,
        description: promotions.description,
        imageUrl: promotions.imageUrl,
        startDate: promotions.startDate,
        endDate: promotions.endDate,
        isActive: promotions.isActive,
        isGlobal: promotions.isGlobal,
        createdAt: promotions.createdAt,
        branchName: branches.name,
        branchSlug: branches.slug,
        branchWhatsapp: branches.whatsappNumber,
      })
      .from(promotions)
      .innerJoin(branches, eq(promotions.branchId, branches.id))
      .where(
        and(
          eq(promotions.isActive, true),
          eq(promotions.isGlobal, true),
          eq(branches.status, "active"),
          or(isNull(promotions.endDate), gte(promotions.endDate, today))
        )
      )
      .orderBy(desc(promotions.createdAt));
    return rows;
  }

  async getBranchActivePromotions(branchId: string): Promise<Promotion[]> {
    const today = getMxLocalDate();
    return db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.branchId, branchId),
          eq(promotions.isActive, true),
          or(isNull(promotions.endDate), gte(promotions.endDate, today))
        )
      )
      .orderBy(desc(promotions.createdAt));
  }

  async deletePromotion(id: string, branchId: string): Promise<void> {
    await db.delete(promotions).where(and(eq(promotions.id, id), eq(promotions.branchId, branchId)));
  }

  async updatePromotion(id: string, branchId: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updated] = await db
      .update(promotions)
      .set(data)
      .where(and(eq(promotions.id, id), eq(promotions.branchId, branchId)))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
