import { eq, and, sql, ilike, or, ne, isNull, count, desc, asc, gte } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  branches,
  memberships,
  membershipPlans,
  auditLogs,
  clientNotes,
  attendances,
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
  type ClientNote,
  type InsertClientNote,
  type Attendance,
  type InsertAttendance,
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
} from "@shared/schema";

const BRANCH_TIMEZONE = "America/Mexico_City";

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
  getBranchMetrics(): Promise<BranchMetrics[]>;
  getBranchStats(branchId: string): Promise<BranchStats>;
  searchBranchesNearby(params: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    category?: string;
    q?: string;
  }): Promise<(Branch & { distance_km?: number })[]>;
  updateUser(id: string, data: { name?: string; email?: string }): Promise<User | undefined>;
  updateUserBranch(id: string, branchId: string): Promise<User | undefined>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  getMembership(userId: string, branchId: string): Promise<Membership | undefined>;
  getMembershipById(id: string): Promise<Membership | undefined>;
  getUserMemberships(userId: string): Promise<(Membership & { branch: Branch })[]>;
  createMembership(data: InsertMembership): Promise<Membership>;
  updateMembership(id: string, data: Partial<InsertMembership>): Promise<Membership | undefined>;
  createAuditLog(data: { actorUserId: string; action: string; branchId?: string; metadata?: any }): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<(AuditLog & { actorEmail?: string | null })[]>;
  getBranchClients(branchId: string): Promise<any[]>;
  getClientProfile(userId: string, branchId: string): Promise<any>;
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
  updateBranchProfile(branchId: string, data: { description?: string | null; address?: string | null; city?: string | null; googleMapsUrl?: string | null; operatingHours?: any; category?: string | null; subcategory?: string | null; latitude?: number | null; longitude?: number | null }): Promise<any>;
  getUpcomingBirthdays(branchId: string, daysAhead?: number): Promise<any[]>;
  getBranchReviews(branchId: string): Promise<any[]>;
  getBranchReviewsSummary(branchId: string): Promise<{ averageRating: number; totalReviews: number }>;
  getBranchAnnouncements(branchId: string): Promise<BranchAnnouncement[]>;
  createAnnouncement(data: InsertBranchAnnouncement): Promise<BranchAnnouncement>;
  deleteAnnouncement(id: string): Promise<void>;
  deactivateAllAnnouncements(branchId: string): Promise<void>;
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

  async getBranchMetrics(): Promise<BranchMetrics[]> {
    const results = await db
      .select({
        branchId: memberships.branchId,
        customerCount: sql<number>`COUNT(DISTINCT CASE WHEN ${memberships.status} = 'active' THEN ${memberships.userId} END)`.as("customer_count"),
        activeMemberships: sql<number>`COUNT(CASE WHEN ${memberships.status} = 'active' THEN 1 END)`.as("active_memberships"),
      })
      .from(memberships)
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

    const conditions: any[] = [
      eq(branches.status, "active"),
      isNull(branches.deletedAt),
    ];

    if (category) {
      conditions.push(eq(branches.category, category));
    }

    if (q) {
      conditions.push(
        or(
          ilike(branches.name, `%${q}%`),
          ilike(branches.city, `%${q}%`),
          ilike(branches.description, `%${q}%`)
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

      const results = await db
        .select({
          id: branches.id,
          name: branches.name,
          slug: branches.slug,
          status: branches.status,
          category: branches.category,
          subcategory: branches.subcategory,
          latitude: branches.latitude,
          longitude: branches.longitude,
          city: branches.city,
          address: branches.address,
          coverImageUrl: branches.coverImageUrl,
          description: branches.description,
          createdAt: branches.createdAt,
          deletedAt: branches.deletedAt,
          distance_km: haversine.as("distance_km"),
        })
        .from(branches)
        .where(and(...conditions, sql`${branches.latitude} IS NOT NULL`, sql`${branches.longitude} IS NOT NULL`))
        .orderBy(haversine);

      const withinRadius = results.filter(
        (r) => r.distance_km === null || r.distance_km <= radiusKm
      );

      const withoutCoords = await db
        .select()
        .from(branches)
        .where(
          and(
            ...conditions,
            or(sql`${branches.latitude} IS NULL`, sql`${branches.longitude} IS NULL`)
          )
        )
        .orderBy(branches.createdAt);

      return [
        ...withinRadius.map((r) => ({
          ...r,
          distance_km: r.distance_km ? Math.round(r.distance_km * 10) / 10 : undefined,
        })),
        ...withoutCoords.map((b) => ({ ...b, distance_km: undefined })),
      ] as (Branch & { distance_km?: number })[];
    }

    const results = await db
      .select()
      .from(branches)
      .where(and(...conditions))
      .orderBy(branches.createdAt);

    return results.map((b) => ({ ...b, distance_km: undefined }));
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

  async updateUser(id: string, data: { name?: string; email?: string }): Promise<User | undefined> {
    const setData: any = {};
    if (data.name !== undefined) setData.name = data.name;
    if (data.email !== undefined) setData.email = data.email;
    const [user] = await db.update(users).set(setData).where(eq(users.id, id)).returning();
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

    const clientIds = results.map(r => r.userId);
    let lastAttendanceMap: Record<string, Date> = {};
    if (clientIds.length > 0) {
      const attResults = await db
        .select({
          userId: attendances.userId,
          lastCheckin: sql<string>`MAX(${attendances.checkedInAt})`.as("last_checkin"),
        })
        .from(attendances)
        .where(and(
          eq(attendances.branchId, branchId),
          sql`${attendances.userId} = ANY(${sql`ARRAY[${sql.join(clientIds.map(id => sql`${id}`), sql`,`)}]`})`
        ))
        .groupBy(attendances.userId);

      for (const a of attResults) {
        if (a.lastCheckin) {
          lastAttendanceMap[a.userId] = new Date(a.lastCheckin);
        }
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
      return {
        ...r,
        planName: r.planName || r.planNameSnapshot || null,
        planStatus,
        lastAttendance: lastAttendanceMap[r.userId] || null,
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

    const [attendanceCount] = await db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(attendances)
      .where(and(eq(attendances.userId, userId), eq(attendances.branchId, branchId)));

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
    return results;
  }

  async createBooking(data: InsertClassBooking): Promise<ClassBooking> {
    const [booking] = await db.insert(classBookings).values(data).returning();
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
    const dayOfWeek = new Date(date + "T12:00:00Z").getUTCDay();
    const schedules = await db
      .select()
      .from(classSchedules)
      .where(and(
        eq(classSchedules.branchId, branchId),
        eq(classSchedules.dayOfWeek, dayOfWeek),
        eq(classSchedules.isActive, true)
      ))
      .orderBy(asc(classSchedules.startTime));

    const result = [];
    for (const schedule of schedules) {
      const bookings = await db
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

  async updateBranchProfile(branchId: string, data: { description?: string | null; address?: string | null; city?: string | null; googleMapsUrl?: string | null; operatingHours?: any; category?: string | null; subcategory?: string | null; latitude?: number | null; longitude?: number | null }): Promise<any> {
    const setData: any = {};
    if (data.description !== undefined) setData.description = data.description;
    if (data.address !== undefined) setData.address = data.address;
    if (data.city !== undefined) setData.city = data.city;
    if (data.googleMapsUrl !== undefined) setData.googleMapsUrl = data.googleMapsUrl;
    if (data.operatingHours !== undefined) setData.operatingHours = data.operatingHours;
    if (data.category !== undefined) setData.category = data.category;
    if (data.subcategory !== undefined) setData.subcategory = data.subcategory;
    if (data.latitude !== undefined) setData.latitude = data.latitude;
    if (data.longitude !== undefined) setData.longitude = data.longitude;

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
        createdAt: branchReviews.createdAt,
        userName: users.name,
        userLastName: users.lastName,
      })
      .from(branchReviews)
      .innerJoin(users, eq(branchReviews.userId, users.id))
      .where(eq(branchReviews.branchId, branchId))
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
      .where(eq(branchReviews.branchId, branchId));
    return {
      averageRating: Number(result[0]?.avgRating || 0),
      totalReviews: Number(result[0]?.total || 0),
    };
  }
}

export const storage = new DatabaseStorage();
