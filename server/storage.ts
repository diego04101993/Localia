import { eq, and, sql, ilike, or, ne, isNull, count, desc, asc } from "drizzle-orm";
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
} from "@shared/schema";

export interface BranchMetrics {
  branchId: string;
  customerCount: number;
  activeMemberships: number;
}

export interface BranchStats {
  activeMemberships: number;
  uniqueActiveCustomers: number;
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
  getPlan(id: string): Promise<MembershipPlan | undefined>;
  assignPlanToMembership(membershipId: string, planId: string, classesRemaining: number | null, expiresAt: Date | null): Promise<Membership | undefined>;
  removePlanFromMembership(membershipId: string): Promise<Membership | undefined>;
  decrementClassesRemaining(membershipId: string): Promise<Membership | undefined>;
  getBranchClassSchedules(branchId: string): Promise<ClassSchedule[]>;
  createClassSchedule(data: InsertClassSchedule): Promise<ClassSchedule>;
  updateClassSchedule(id: string, data: Partial<InsertClassSchedule>): Promise<ClassSchedule | undefined>;
  getClassSchedule(id: string): Promise<ClassSchedule | undefined>;
  getBookingsForDate(branchId: string, date: string): Promise<any[]>;
  getBookingsForClassOnDate(classScheduleId: string, date: string): Promise<any[]>;
  createBooking(data: InsertClassBooking): Promise<ClassBooking>;
  updateBookingStatus(id: string, status: string): Promise<ClassBooking | undefined>;
  getBooking(id: string): Promise<ClassBooking | undefined>;
  getTodayBookingsCount(branchId: string): Promise<number>;
  getNextBooking(branchId: string): Promise<{ className: string; startTime: string; bookingDate: string } | null>;
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
        uniqueActiveCustomers: sql<number>`COUNT(DISTINCT CASE WHEN ${memberships.status} = 'active' THEN ${memberships.userId} END)`.as("unique_active_customers"),
      })
      .from(memberships)
      .where(eq(memberships.branchId, branchId));

    return {
      activeMemberships: Number(result?.activeMemberships) || 0,
      uniqueActiveCustomers: Number(result?.uniqueActiveCustomers) || 0,
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

  async getBranchClients(branchId: string): Promise<any[]> {
    const results = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        membershipId: memberships.id,
        membershipStatus: memberships.status,
        joinedAt: memberships.joinedAt,
        lastSeenAt: memberships.lastSeenAt,
        source: memberships.source,
        isFavorite: memberships.isFavorite,
        planId: memberships.planId,
        classesRemaining: memberships.classesRemaining,
        expiresAt: memberships.expiresAt,
        planName: membershipPlans.name,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(eq(memberships.branchId, branchId))
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

    return results.map(r => ({
      ...r,
      lastAttendance: lastAttendanceMap[r.userId] || null,
    }));
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

    return {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt },
      membership,
      plan,
      notes,
      recentAttendances,
      totalAttendances: Number(attendanceCount?.count) || 0,
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

  async getPlan(id: string): Promise<MembershipPlan | undefined> {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, id));
    return plan;
  }

  async assignPlanToMembership(membershipId: string, planId: string, classesRemaining: number | null, expiresAt: Date | null): Promise<Membership | undefined> {
    const [m] = await db
      .update(memberships)
      .set({ planId, classesRemaining, expiresAt })
      .where(eq(memberships.id, membershipId))
      .returning();
    return m;
  }

  async removePlanFromMembership(membershipId: string): Promise<Membership | undefined> {
    const [m] = await db
      .update(memberships)
      .set({ planId: null, classesRemaining: null, expiresAt: null })
      .where(eq(memberships.id, membershipId))
      .returning();
    return m;
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

  async getBooking(id: string): Promise<ClassBooking | undefined> {
    const [booking] = await db.select().from(classBookings).where(eq(classBookings.id, id));
    return booking;
  }

  async getTodayBookingsCount(branchId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
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
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toTimeString().slice(0, 5);
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
}

export const storage = new DatabaseStorage();
