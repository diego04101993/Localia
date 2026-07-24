import { eq, and, sql, or, ne, isNull, count, desc, asc, gte, inArray, lte } from "drizzle-orm";
import { db } from "./db";
import { getBranchClientIdentityControl } from "./branch-client-identity";
import {
  users,
  branches,
  categories,
  subcategories,
  categoryKeywords,
  appSettings,
  searchLogs,
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
  reservationAuditLogs,
  branchPhotos,
  branchPosts,
  branchProducts,
  branchCommercialProducts,
  branchCommercialProjects,
  branchSalespeople,
  branchSales,
  branchSaleItems,
  branchSalePayments,
  branchCommissionRules,
  branchCommissionAccruals,
  branchCommissionPayments,
  branchCommissionPaymentAllocations,
  branchInventoryBalances,
  branchInventoryMovements,
  branchSuppliers,
  branchPurchases,
  branchPurchaseItems,
  branchServices,
  branchServiceSaleOptions,
  branchVideos,
  type User,
  type InsertUser,
  type Branch,
  type InsertBranch,
  type Category,
  type InsertCategory,
  type Subcategory,
  type InsertSubcategory,
  type CategoryKeyword,
  type InsertCategoryKeyword,
  type AppSetting,
  type InsertAppSetting,
  type SearchLog,
  type InsertSearchLog,
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
  type BranchCommercialProduct,
  type InsertBranchCommercialProduct,
  type BranchCommercialProject,
  type InsertBranchCommercialProject,
  type BranchSalesperson,
  type InsertBranchSalesperson,
  type BranchSale,
  type InsertBranchSale,
  type BranchSaleItem,
  type InsertBranchSaleItem,
  type BranchSalePayment,
  type InsertBranchSalePayment,
  type BranchCommissionRule,
  type InsertBranchCommissionRule,
  type BranchCommissionAccrual,
  type InsertBranchCommissionAccrual,
  type BranchCommissionPayment,
  type InsertBranchCommissionPayment,
  type BranchCommissionPaymentAllocation,
  type InsertBranchCommissionPaymentAllocation,
  type BranchInventoryBalance,
  type InsertBranchInventoryBalance,
  type BranchInventoryMovement,
  type InsertBranchInventoryMovement,
  type BranchSupplier,
  type InsertBranchSupplier,
  type BranchPurchase,
  type InsertBranchPurchase,
  type BranchPurchaseItem,
  type InsertBranchPurchaseItem,
  type BranchService,
  type InsertBranchService,
  type BranchServiceSaleOption,
  type InsertBranchServiceSaleOption,
  type BranchVideo,
  type InsertBranchVideo,
  branchAnnouncements,
  type BranchAnnouncement,
  type InsertBranchAnnouncement,
  branchReviews,
  type BranchReview,
  reviewReports,
  type ReviewReport,
  type InsertReviewReport,
  reviewModerationLogs,
  type ReviewModerationLog,
  type InsertReviewModerationLog,
  notificationJobs,
  type NotificationJob,
  type InsertNotificationJob,
  branchFinanceEntries,
  type BranchFinanceEntry,
  type InsertBranchFinanceEntry,
  branchRecurringExpenses,
  type BranchRecurringExpense,
  type InsertBranchRecurringExpense,
  branchStaffMembers,
  type BranchStaffMember,
  type InsertBranchStaffMember,
  branchStaffClassLogs,
  type BranchStaffClassLog,
  type InsertBranchStaffClassLog,
  branchMonthlyBilling,
  type BranchMonthlyBilling,
  type InsertBranchMonthlyBilling,
  type ReservationAuditLog,
  type InsertReservationAuditLog,
  passwordResetTokens,
  type PasswordResetToken,
  promotions,
  type Promotion,
  type InsertPromotion,
} from "@shared/schema";
import { normalizeSearchText } from "./search-utils";

const BRANCH_TIMEZONE = "America/Mexico_City";
const COMMERCIAL_LARGE_SALE_THRESHOLD = 10000;
const CRM_ACTIVITY_WINDOW_DAYS = 30;
const CRM_ACTIVITY_WINDOW_MS = CRM_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_GLOBAL_APP_SETTINGS: Array<{ key: string; valueJson: any; scope: string }> = [
  {
    key: "search.default_radius_km",
    valueJson: { km: 50 },
    scope: "global",
  },
  {
    key: "search.max_radius_km",
    valueJson: { km: 100 },
    scope: "global",
  },
  {
    key: "search.category_radius_overrides",
    valueJson: {},
    scope: "global",
  },
];

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

function getCurrentMonthRange() {
  const today = getMxLocalDate();
  return {
    from: `${today.slice(0, 7)}-01`,
    to: today,
  };
}

function getMonthRangeByKey(month?: string | null): { monthKey: string; from: string; toExclusive: string } {
  const monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : getMxLocalDate().slice(0, 7);
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const from = `${monthKey}-01`;
  const nextMonthDate = new Date(year, monthNumber, 1);
  const toExclusive = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { monthKey, from, toExclusive };
}

function toFinanceAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

type CommercialTaxSnapshotLike = {
  taxMode?: string | null;
  subtotalBeforeTax?: number | null;
  taxableSubtotal?: number | null;
  taxTotal?: number | null;
  grandTotal?: number | null;
};

function hasStoredCommercialTaxBreakdown(row: CommercialTaxSnapshotLike) {
  return row.taxMode != null
    || row.subtotalBeforeTax != null
    || row.taxableSubtotal != null
    || row.taxTotal != null
    || row.grandTotal != null;
}

const BRANCH_COMMERCIAL_PROJECT_CODE_UNIQUE = "branch_commercial_projects_branch_code_unique";

type CommercialTaxMode = "tax_included" | "tax_added" | "tax_exempt";

function computeCommercialTaxSnapshot(params: {
  subtotalAmount: number;
  discountAmount: number;
  taxMode: CommercialTaxMode;
  taxRate: number;
}) {
  const subtotalAmount = roundMoney(Math.max(0, params.subtotalAmount || 0));
  const discountAmount = roundMoney(Math.max(0, params.discountAmount || 0));
  const discountedSubtotal = roundMoney(Math.max(0, subtotalAmount - discountAmount));
  const taxMode = params.taxMode;
  const taxRate = taxMode === "tax_exempt" ? 0 : roundMoney(Math.max(0, params.taxRate || 0));
  const taxFactor = taxRate > 0 ? taxRate / 100 : 0;

  if (taxMode === "tax_included" && taxFactor > 0) {
    const subtotalBeforeTax = roundMoney(subtotalAmount / (1 + taxFactor));
    const taxableSubtotal = roundMoney(discountedSubtotal / (1 + taxFactor));
    const taxTotal = roundMoney(discountedSubtotal - taxableSubtotal);
    return {
      taxMode,
      taxRate,
      subtotalBeforeTax,
      taxableSubtotal,
      taxTotal,
      grandTotal: discountedSubtotal,
    };
  }

  if (taxMode === "tax_added" && taxFactor > 0) {
    const subtotalBeforeTax = subtotalAmount;
    const taxableSubtotal = discountedSubtotal;
    const taxTotal = roundMoney(taxableSubtotal * taxFactor);
    return {
      taxMode,
      taxRate,
      subtotalBeforeTax,
      taxableSubtotal,
      taxTotal,
      grandTotal: roundMoney(taxableSubtotal + taxTotal),
    };
  }

  return {
    taxMode,
    taxRate: 0,
    subtotalBeforeTax: subtotalAmount,
    taxableSubtotal: discountedSubtotal,
    taxTotal: 0,
    grandTotal: discountedSubtotal,
  };
}

const COMMISSION_RULE_SPECIFICITY: Record<string, number> = {
  percentage_product: 300,
  fixed_product: 300,
  percentage_category: 200,
  percentage_all_sales: 100,
  fixed_per_sale: 100,
  bonus_monthly_goal: 0,
};

function normalizeOptionalTextValue(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function isPgUniqueViolation(error: any) {
  return error?.code === "23505";
}

function isPgUniqueViolationForConstraint(error: any, constraintName: string) {
  if (!isPgUniqueViolation(error)) return false;
  const constraint = typeof error?.constraint === "string" ? error.constraint : "";
  const message = typeof error?.message === "string" ? error.message : "";
  return constraint === constraintName || message.includes(constraintName);
}

function getMxDateParts(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  const localDate = date.toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE });
  return {
    date: localDate,
    monthKey: localDate.slice(0, 7),
  };
}

function isRuleActiveForDate(rule: BranchCommissionRuleRow, localDate: string) {
  if (!rule.isActive || rule.deletedAt) return false;
  if (rule.validFrom && localDate < rule.validFrom) return false;
  if (rule.validUntil && localDate > rule.validUntil) return false;
  return true;
}

function computeInventoryStatus(
  usesInventory: boolean,
  balance: { quantityOnHand: number; minimumStock: number } | null,
): "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock" {
  if (!usesInventory) return "not_tracked";
  if (!balance) return "uninitialized";
  if (balance.quantityOnHand <= 0) return "out_of_stock";
  if (balance.minimumStock > 0 && balance.quantityOnHand <= balance.minimumStock) return "low_stock";
  return "available";
}

function generateBranchSaleFolio(date = new Date()): string {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE }).replace(/-/g, "");
  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VTA-${ymd}-${stamp}${random}`;
}

function generateBranchPurchaseFolio(date = new Date()): string {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE }).replace(/-/g, "");
  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `COM-${ymd}-${stamp}${random}`;
}

function generateBranchCommercialProjectCode(date = new Date()): string {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE }).replace(/-/g, "");
  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRJ-${ymd}-${stamp}${random}`;
}

function mapRecurringCategoryToFinanceCategory(category: string): string {
  if (category === "nomina") return "sueldos";
  return category;
}

function getMembershipFinanceEventKey(params: {
  eventType: "assign" | "renew";
  membershipId: string;
  planId: string;
  expiresAt?: Date | string | null;
  paidAt?: Date | string | null;
}): string {
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const expiresAtValue = params.expiresAt
    ? typeof params.expiresAt === "string" && dateOnlyPattern.test(params.expiresAt)
      ? params.expiresAt
      : formatDateOnly(new Date(params.expiresAt))
    : "sin-expiracion";
  const paidAtValue = params.paidAt
    ? typeof params.paidAt === "string" && dateOnlyPattern.test(params.paidAt)
      ? params.paidAt
      : formatDateOnly(new Date(params.paidAt))
    : getMxLocalDate();
  return `${params.eventType}:${params.membershipId}:${params.planId}:${expiresAtValue}:${paidAtValue}`;
}

function getClampedMonthDate(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeCurrentCyclePaymentDate(paymentDay: number, fromDate = new Date()): string {
  return formatDateOnly(getClampedMonthDate(fromDate.getFullYear(), fromDate.getMonth(), paymentDay));
}

function computeNextMonthlyPaymentDate(paymentDay: number, fromDate = new Date()): string {
  const year = fromDate.getFullYear();
  const monthIndex = fromDate.getMonth() + 1;
  return formatDateOnly(getClampedMonthDate(year + Math.floor(monthIndex / 12), monthIndex % 12, paymentDay));
}

function resolveMonthlyBillingStatus(
  paymentStatus: string | null | undefined,
  nextPaymentDate: string | null | undefined,
): "pending" | "paid" | "overdue" {
  const today = getMxLocalDate();
  if (nextPaymentDate && nextPaymentDate < today) {
    return "overdue";
  }
  if (paymentStatus === "paid") {
    return "paid";
  }
  return "pending";
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

async function ensureDefaultGlobalAppSettings() {
  for (const setting of DEFAULT_GLOBAL_APP_SETTINGS) {
    await db
      .insert(appSettings)
      .values({
        key: setting.key,
        valueJson: setting.valueJson,
        scope: setting.scope,
      })
      .onConflictDoNothing({ target: appSettings.key });
  }
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

export interface SearchSuggestion {
  type: "category" | "subcategory" | "keyword" | "branch";
  label: string;
  normalized: string;
  categoryKey?: string | null;
  subcategoryId?: string | null;
  branchId?: string | null;
  branchSlug?: string | null;
}

export interface SearchLogRow extends SearchLog {
  userEmail?: string | null;
  selectedBranchName?: string | null;
}

export interface SearchMetrics {
  topQueries: Array<{ query: string; total: number }>;
  zeroResultQueries: Array<{ query: string; total: number }>;
  topCategories: Array<{ category: string; total: number }>;
}

export interface ReservationAuditRow extends ReservationAuditLog {
  customerName?: string | null;
  customerLastName?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  className?: string | null;
  bookingDate?: string | null;
  bookingStatus?: string | null;
}

export interface ReviewReportRow extends ReviewReport {
  reviewRating?: number | null;
  reviewComment?: string | null;
  branchName?: string | null;
  branchSlug?: string | null;
  reporterName?: string | null;
  reviewerName?: string | null;
  customerName?: string | null;
  customerLastName?: string | null;
  isHidden?: boolean;
  hiddenReason?: string | null;
  adminReply?: string | null;
}

export interface PlatformMetrics {
  totalAppUsers: number;
  activeBranches: number;
  totalSearches: number;
  zeroResultSearches: number;
  reservationStats: {
    created: number;
    cancelled: number;
    attended: number;
    noShow: number;
  };
  mostActiveBranches: Array<{
    branchId: string;
    branchName: string;
    totalReservations: number;
  }>;
}

export interface BranchDashboardMetrics {
  upcomingBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  activeClients: number;
  inactiveClients: number;
  lowClassesClients: number;
  activePromotions: number;
  recentReviews: number;
}

export interface BranchFinanceEntryRow {
  id: string;
  branchId: string;
  type: "income" | "expense";
  category: string | null;
  concept: string;
  amount: number;
  paymentMethod: string | null;
  clientUserId: string | null;
  clientName: string | null;
  clientDisplayName: string | null;
  clientEmail: string | null;
  notes: string | null;
  entryDate: string;
  source: string | null;
  sourceId: string | null;
  metadata: any;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchFinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  todayIncome: number;
  todayExpense: number;
  monthIncome: number;
  monthExpense: number;
  dailyBreakdown: Array<{ date: string; income: number; expense: number; net: number }>;
  topIncomeCategories: Array<{ category: string; total: number }>;
  topExpenseCategories: Array<{ category: string; total: number }>;
}

export interface BranchFinanceEntriesResult {
  items: BranchFinanceEntryRow[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface BranchRecurringExpenseRow {
  id: string;
  branchId: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  paymentDay: number | null;
  notes: string | null;
  isActive: boolean;
  lastRegisteredAt: Date | string | null;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchStaffMemberRow {
  id: string;
  branchId: string;
  name: string;
  phone: string | null;
  payPerClass: number;
  notes: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchStaffClassLogRow {
  id: string;
  branchId: string;
  staffId: string;
  staffName: string;
  classesCount: number;
  paymentTotal: number;
  classDate: string;
  notes: string | null;
  financeEntryId: string | null;
  paymentMethod: string | null;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchServiceSaleOptionRow {
  id: string;
  branchId: string;
  serviceId: string;
  name: string;
  type: string;
  price: number;
  includedUses: number | null;
  isUnlimited: boolean;
  validityDays: number | null;
  requiresRegisteredClient: boolean;
  allowsWalkIn: boolean;
  isPosFavorite: boolean;
  isActive: boolean;
  internalNotes: string | null;
  displayOrder: number;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchCommercialProductRow {
  id: string;
  branchId: string;
  name: string;
  category: string;
  description: string | null;
  photoUrl: string | null;
  sku: string | null;
  barcode: string | null;
  costAmount: number;
  salePriceAmount: number;
  isActive: boolean;
  isPublicVisible: boolean;
  usesInventory: boolean;
  displayOrder: number;
  inventoryQuantityOnHand?: number | null;
  inventoryMinimumStock?: number | null;
  inventoryStatus?: "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock";
  inventoryUpdatedAt?: Date | string | null;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchCommercialProductListPage {
  items: BranchCommercialProductRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    categories: string[];
  };
  summary: {
    total: number;
    active: number;
    publicVisible: number;
    inventoryReady: number;
  };
}

export interface BranchSalespersonRow {
  id: string;
  branchId: string;
  userId: string | null;
  name: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  employeeCode: string | null;
  roleLabel: string | null;
  monthlyGoalAmount: number | null;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
}

export interface BranchSalespersonSummaryRow {
  salespersonId: string;
  branchId: string;
  month: string;
  totalSoldAmount: number;
  salesCount: number;
  averageTicketAmount: number;
  productsSoldCount: number;
  monthlyGoalAmount: number | null;
  goalProgressPercent: number | null;
}

export interface BranchCommissionRuleRow {
  id: string;
  branchId: string;
  salespersonId: string;
  name: string;
  ruleType: string;
  percentageRate: number | null;
  fixedAmount: number | null;
  commercialProductId: string | null;
  category: string | null;
  minimumGoalAmount: number | null;
  bonusAmount: number | null;
  priority: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
}

export interface BranchCommissionAccrualRow {
  id: string;
  branchId: string;
  salespersonId: string;
  saleId: string | null;
  saleItemId: string | null;
  commissionRuleId: string | null;
  accrualType: string;
  referenceKey: string;
  periodMonth: string | null;
  status: string;
  baseAmount: number;
  rateSnapshot: number | null;
  fixedAmountSnapshot: number | null;
  commissionAmount: number;
  salespersonNameSnapshot: string;
  ruleNameSnapshot: string | null;
  calculationSnapshot: any;
  accruedAt: Date | string;
  approvedAt: Date | string | null;
  paidAmount: number;
  reversedAt: Date | string | null;
  reversalReason: string | null;
  createdAt: Date | string;
}

export interface BranchCommissionPaymentAllocationRow {
  id: string;
  branchId: string;
  commissionPaymentId: string;
  commissionAccrualId: string;
  amountAllocated: number;
  createdAt: Date | string;
}

export interface BranchCommissionPaymentRow {
  id: string;
  branchId: string;
  salespersonId: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: Date | string;
  createdBy: string | null;
  createdAt: Date | string;
  allocations?: BranchCommissionPaymentAllocationRow[];
}

export interface BranchSalespersonCommissionSummaryRow {
  salespersonId: string;
  branchId: string;
  month: string;
  totalSoldAmount: number;
  salesCount: number;
  averageTicketAmount: number;
  productsSoldCount: number;
  monthlyGoalAmount: number | null;
  goalProgressPercent: number | null;
  generatedCommissionAmount: number;
  approvedCommissionAmount: number;
  paidCommissionAmount: number;
  pendingCommissionAmount: number;
  reversedCommissionAmount: number;
  bonusGeneratedAmount: number;
}

export interface BranchSaleItemRow {
  id: string;
  saleId: string;
  branchId: string;
  itemType: string;
  commercialProductId: string | null;
  serviceId: string | null;
  planId: string | null;
  nameSnapshot: string;
  categorySnapshot: string | null;
  quantity: number;
  unitPriceAmount: number;
  discountAmount: number;
  costAmountSnapshot: number;
  lineTotalAmount: number;
  metadata: any;
  createdAt: Date | string;
}

export interface BranchSalePaymentRow {
  id: string;
  saleId: string;
  branchId: string;
  paymentMethod: string;
  amount: number;
  reference: string | null;
  paidAt: Date | string;
  createdBy: string | null;
  createdAt: Date | string;
}

export interface BranchSaleRow {
  id: string;
  branchId: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  folio: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  clientEmail: string | null;
  sellerId: string | null;
  sellerUserId: string | null;
  sellerNameSnapshot: string | null;
  sellerMetadata: any;
  channel: string;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  taxMode: string | null;
  taxRate: number | null;
  subtotalBeforeTax: number | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  notes: string | null;
  createdBy: string | null;
  cancelledAt: Date | string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  items: BranchSaleItemRow[];
  payments: BranchSalePaymentRow[];
}

export interface BranchInventoryBalanceRow {
  id: string;
  branchId: string;
  commercialProductId: string;
  quantityOnHand: number;
  minimumStock: number;
  status: "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock";
  updatedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchInventoryMovementRow {
  id: string;
  branchId: string;
  commercialProductId: string;
  movementType: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCostSnapshot: number | null;
  reason: string;
  notes: string | null;
  saleId: string | null;
  saleItemId: string | null;
  purchaseId: string | null;
  purchaseItemId: string | null;
  createdBy: string | null;
  metadata: any;
  createdAt: Date | string;
}

export interface BranchInventorySummaryRow {
  productId: string;
  usesInventory: boolean;
  balance: BranchInventoryBalanceRow | null;
  status: "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock";
  movementCount: number;
  recentMovements: BranchInventoryMovementRow[];
}

export interface BranchSupplierRow {
  id: string;
  branchId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
}

export interface BranchPurchaseItemRow {
  id: string;
  purchaseId: string;
  branchId: string;
  commercialProductId: string | null;
  nameSnapshot: string;
  skuSnapshot: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
  metadata: any;
  createdAt: Date | string;
}

export interface BranchCommercialProjectSummaryRow {
  linkedSalesCount: number;
  linkedPurchasesCount: number;
  linkedDraftPurchasesCount: number;
  revenueBeforeTax: number;
  revenueHistoricalWithoutBreakdown: number;
  taxCollected: number;
  revenueGrossTotal: number;
  cashCollectedTotal: number;
  purchaseCommittedBeforeTax: number;
  purchaseCommittedHistoricalWithoutBreakdown: number;
  purchaseReceivedBeforeTax: number;
  purchaseReceivedHistoricalWithoutBreakdown: number;
  purchasePaidTotal: number;
  committedProfitEstimate: number;
  receivedProfitEstimate: number;
  cashFlowNet: number;
  marginPercent: number | null;
}

export interface BranchCommercialProjectRow {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description: string | null;
  customerUserId: string | null;
  customerDisplayName: string | null;
  status: "draft" | "active" | "completed" | "cancelled" | "archived";
  startDate: string;
  expectedEndDate: string | null;
  completedAt: Date | string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  summary: BranchCommercialProjectSummaryRow;
}

export interface BranchCommercialProjectLinkedSaleRow {
  id: string;
  folio: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  taxMode: string | null;
  taxRate: number | null;
  subtotalBeforeTax: number | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  createdAt: Date | string;
  cancelledAt: Date | string | null;
}

export interface BranchPurchaseRow {
  id: string;
  branchId: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  folio: string;
  supplierId: string | null;
  supplierName: string | null;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  purchaseDate: string;
  expectedDate: string | null;
  receivedAt: Date | string | null;
  paymentStatus: "unpaid" | "partial" | "paid";
  paymentMethod: string | null;
  subtotalAmount: number;
  discountAmount: number;
  taxMode: string | null;
  taxRate: number | null;
  subtotalBeforeTax: number | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  totalAmount: number;
  paidAmount: number;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  cancelledAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  totalItems: number;
  totalUnitsOrdered: number;
  totalUnitsReceived: number;
}

export interface BranchPurchaseDetailRow extends BranchPurchaseRow {
  items: BranchPurchaseItemRow[];
}

export interface BranchCommercialProjectLinkedPurchaseRow {
  id: string;
  folio: string;
  supplierId: string | null;
  supplierName: string | null;
  status: string;
  purchaseDate: string;
  paymentStatus: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  taxMode: string | null;
  taxRate: number | null;
  subtotalBeforeTax: number | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  receivedAt: Date | string | null;
  cancelledAt: Date | string | null;
  createdAt: Date | string;
}

export interface BranchCommercialProjectDetailRow extends BranchCommercialProjectRow {
  sales: BranchCommercialProjectLinkedSaleRow[];
  purchases: BranchCommercialProjectLinkedPurchaseRow[];
}

export interface BranchCommercialProjectListPage {
  items: BranchCommercialProjectRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BranchCommercialProjectLinkableSaleRow {
  id: string;
  folio: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  status: string;
  totalAmount: number;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  createdAt: Date | string;
}

export interface BranchCommercialProjectLinkableSalesPage {
  items: BranchCommercialProjectLinkableSaleRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BranchCommercialProjectLinkablePurchaseRow {
  id: string;
  folio: string;
  supplierId: string | null;
  supplierName: string | null;
  status: string;
  totalAmount: number;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  purchaseDate: string;
}

export interface BranchCommercialProjectLinkablePurchasesPage {
  items: BranchCommercialProjectLinkablePurchaseRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BranchCommercialDashboardTopProductRow {
  productId: string;
  name: string;
  category: string | null;
  unitsSold: number;
  revenueAmount: number;
  grossProfitAmount: number;
  lastSoldAt: Date | string | null;
  quantityOnHand: number | null;
  minimumStock: number | null;
  inventoryStatus: "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock";
}

export interface BranchCommercialDashboardTopCategoryRow {
  category: string;
  unitsSold: number;
  revenueAmount: number;
  grossProfitAmount: number;
}

export interface BranchCommercialDashboardTopSalespersonRow {
  salespersonId: string;
  name: string;
  totalSoldAmount: number;
  salesCount: number;
  averageTicketAmount: number;
  productsSoldCount: number;
  customersCount: number;
  generatedCommissionAmount: number;
  paidCommissionAmount: number;
  pendingCommissionAmount: number;
  monthlyGoalAmount: number | null;
  goalProgressPercent: number | null;
  lastSaleAt: Date | string | null;
}

export interface BranchCommercialDashboardTopCustomerRow {
  clientUserId: string;
  clientName: string;
  clientEmail: string | null;
  totalSpentAmount: number;
  salesCount: number;
  lastPurchaseAt: Date | string | null;
  firstPurchaseAt: Date | string | null;
}

export interface BranchCommercialDashboardTopSupplierRow {
  supplierId: string | null;
  supplierName: string;
  totalPurchasedAmount: number;
  purchasesCount: number;
  lastPurchaseAt: Date | string | null;
}

export interface BranchCommercialDashboardRow {
  month: string;
  salesTodayAmount: number;
  salesMonthAmount: number;
  ticketCount: number;
  averageTicketAmount: number;
  productsSoldCount: number;
  grossProfitAmount: number;
  topProducts: BranchCommercialDashboardTopProductRow[];
  topCategories: BranchCommercialDashboardTopCategoryRow[];
  topSalespeople: BranchCommercialDashboardTopSalespersonRow[];
  topCustomers: BranchCommercialDashboardTopCustomerRow[];
  firstPurchaseCustomers: BranchCommercialDashboardTopCustomerRow[];
  lowStockCount: number;
  outOfStockCount: number;
  uninitializedInventoryCount: number;
  inventoryEstimatedValue: number;
  generatedCommissionAmount: number;
  paidCommissionAmount: number;
  pendingCommissionAmount: number;
  purchasesReceivedCount: number;
  totalPurchasedAmount: number;
  topSuppliers: BranchCommercialDashboardTopSupplierRow[];
}

export interface BranchClientCommercialHistoryItemRow {
  saleId: string;
  folio: string;
  saleDate: Date | string;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  sellerId: string | null;
  sellerName: string | null;
  channel: string;
  notes: string | null;
  items: BranchSaleItemRow[];
  payments: BranchSalePaymentRow[];
}

export interface BranchClientCommercialHistorySummaryRow {
  totalSpentAmount: number;
  salesCount: number;
  averageTicketAmount: number;
  lastPurchaseAt: Date | string | null;
  currentMonthAmount: number;
}

export interface BranchClientCommercialHistoryResult {
  summary: BranchClientCommercialHistorySummaryRow;
  items: BranchClientCommercialHistoryItemRow[];
  total: number;
  page: number;
  limit: number;
  filter: "all" | "products" | "services" | "current_month";
}

export interface BranchCommercialProductPerformanceSaleRow {
  saleId: string;
  folio: string;
  saleDate: Date | string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  sellerName: string | null;
  quantitySold: number;
  revenueAmount: number;
  grossProfitAmount: number;
  paymentMethods: string[];
}

export interface BranchCommercialProductPerformanceRow {
  productId: string;
  productName: string;
  category: string;
  from: string | null;
  to: string | null;
  salesCount: number;
  unitsSold: number;
  revenueAmount: number;
  costAmountSold: number;
  grossProfitAmount: number;
  grossMarginPercent: number | null;
  lastSaleAt: Date | string | null;
  quantityOnHand: number | null;
  minimumStock: number | null;
  inventoryStatus: "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock";
  recentSales: BranchCommercialProductPerformanceSaleRow[];
}

export interface BranchSupplierSummaryProductRow {
  commercialProductId: string | null;
  name: string;
  unitsOrdered: number;
  unitsReceived: number;
  totalPurchasedAmount: number;
}

export interface BranchSupplierSummaryRow {
  supplierId: string;
  supplierName: string;
  totalPurchasedAmount: number;
  purchasesCount: number;
  averageTicketAmount: number;
  lastPurchaseAt: Date | string | null;
  productsSuppliedCount: number;
  receivedPurchasesCount: number;
  pendingPurchasesCount: number;
  topProducts: BranchSupplierSummaryProductRow[];
}

export interface BranchCommissionPaymentDetailRow extends BranchCommissionPaymentRow {
  salespersonName: string | null;
  totalAllocatedAmount: number;
}

export interface BranchCommercialNotificationSignals {
  lowStockProducts: Array<{
    productId: string;
    productName: string;
    quantityOnHand: number;
    minimumStock: number;
    updatedAt: Date | string;
  }>;
  outOfStockProducts: Array<{
    productId: string;
    productName: string;
    quantityOnHand: number;
    minimumStock: number;
    updatedAt: Date | string;
  }>;
  firstPurchaseCustomers: BranchCommercialDashboardTopCustomerRow[];
  goalReachedSalespeople: BranchCommercialDashboardTopSalespersonRow[];
  largeSales: Array<{
    saleId: string;
    folio: string;
    totalAmount: number;
    clientUserId: string | null;
    clientDisplayName: string | null;
    sellerId: string | null;
    sellerName: string | null;
    createdAt: Date | string;
  }>;
  receivedPurchases: Array<{
    purchaseId: string;
    folio: string;
    supplierId: string | null;
    supplierName: string | null;
    receivedAt: Date | string | null;
    totalAmount: number;
  }>;
  pendingCommissions: BranchCommercialDashboardTopSalespersonRow[];
}

export interface BranchServiceRow {
  id: string;
  branchId: string;
  name: string;
  category: string;
  description: string | null;
  baseDurationMinutes: number | null;
  capacity: number | null;
  requiresAgenda: boolean;
  visibility: "public" | "internal";
  isActive: boolean;
  displayOrder: number;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  options: BranchServiceSaleOptionRow[];
}

export interface BranchHardDeleteResult {
  deleted: boolean;
  reason?: string;
  branchName?: string;
  deletedAdminCount: number;
  deletedAdminFirebaseUids: string[];
  uploadUrls: string[];
}

export interface BranchPurgeEstimateRow {
  branchId: string;
  branchName: string;
  counts: Record<string, number>;
  uploadCount: number;
}

export interface BranchMonthlyBillingRow {
  id: string | null;
  branchId: string;
  branchName: string;
  branchSlug: string;
  branchStatus: string;
  monthlyFeeAmount: number;
  paymentDay: number | null;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
  paymentStatus: "pending" | "paid" | "overdue";
  sellerName: string | null;
  sellerCommissionAmount: number;
  notes: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string | null | undefined): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteCustomerAccount(id: string): Promise<void>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  getAllBranches(includeDeleted?: boolean): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  getBranchBySlug(slug: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranchStatus(id: string, status: string): Promise<Branch | undefined>;
  updateBranch(id: string, data: {
    name?: string;
    slug?: string;
    status?: string;
    category?: string | null;
    subcategory?: string | null;
    searchKeywords?: string | null;
  }): Promise<Branch | undefined>;
  softDeleteBranch(id: string): Promise<Branch | undefined>;
  hardDeleteBranch(id: string): Promise<BranchHardDeleteResult>;
  estimateBranchPurge(branchId: string): Promise<BranchPurgeEstimateRow | undefined>;
  getBranchAdmins(branchId: string): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getBranchMetrics(): Promise<BranchMetrics[]>;
  getBranchStats(branchId: string): Promise<BranchStats>;
  searchBranchesNearby(params: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    category?: string;
    subcategory?: string;
    zone?: string;
    q?: string;
  }): Promise<(Branch & { distance_km?: number })[]>;
  listCategories(): Promise<Category[]>;
  listPublicCategories(): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(key: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  listSubcategories(categoryKey?: string): Promise<(Subcategory & { categoryLabel?: string | null })[]>;
  listPublicSubcategories(categoryKey?: string): Promise<(Subcategory & { categoryLabel?: string | null })[]>;
  createSubcategory(data: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: string, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined>;
  listCategoryKeywords(filters?: { categoryKey?: string; subcategoryId?: string }): Promise<(CategoryKeyword & { categoryLabel?: string | null; subcategoryLabel?: string | null })[]>;
  createCategoryKeyword(data: InsertCategoryKeyword): Promise<CategoryKeyword>;
  deleteCategoryKeyword(id: string): Promise<boolean>;
  listAppSettings(scope?: string): Promise<AppSetting[]>;
  upsertAppSetting(key: string, data: { valueJson: any; scope?: string; updatedBy?: string | null }): Promise<AppSetting>;
  createSearchLog(data: InsertSearchLog): Promise<SearchLog>;
  getSearchLogs(limit?: number): Promise<SearchLogRow[]>;
  getSearchMetrics(limit?: number): Promise<SearchMetrics>;
  getSearchSuggestions(q: string, limit?: number): Promise<SearchSuggestion[]>;
  updateSearchLogSelection(logId: string, selectedBranchId: string): Promise<SearchLog | undefined>;
  getBranchFinanceSummary(branchId: string, filters?: { from?: string; to?: string }): Promise<BranchFinanceSummary>;
  getBranchFinanceEntries(branchId: string, filters?: {
    from?: string;
    to?: string;
    type?: string;
    category?: string;
    clientId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<BranchFinanceEntriesResult>;
  listBranchFinanceEntriesForExport(branchId: string, filters?: {
    from?: string;
    to?: string;
    type?: string;
  }): Promise<BranchFinanceEntryRow[]>;
  getBranchFinanceEntry(branchId: string, entryId: string): Promise<BranchFinanceEntryRow | undefined>;
  createBranchFinanceEntry(data: InsertBranchFinanceEntry): Promise<BranchFinanceEntryRow>;
  findBranchFinanceEntryBySource(branchId: string, source: string, sourceId: string): Promise<BranchFinanceEntryRow | undefined>;
  updateBranchFinanceEntry(branchId: string, entryId: string, data: Partial<InsertBranchFinanceEntry>): Promise<BranchFinanceEntryRow | undefined>;
  softDeleteBranchFinanceEntry(branchId: string, entryId: string): Promise<boolean>;
  getSuperAdminMonthlyBilling(): Promise<BranchMonthlyBillingRow[]>;
  upsertBranchMonthlyBilling(branchId: string, data: {
    monthlyFeeAmount: number;
    paymentDay: number;
    lastPaymentDate?: string | null;
    nextPaymentDate?: string | null;
    paymentStatus?: "pending" | "paid" | "overdue";
    sellerName?: string | null;
    sellerCommissionAmount?: number;
    notes?: string | null;
  }): Promise<BranchMonthlyBillingRow | undefined>;
  markBranchMonthlyBillingPaid(branchId: string, paidDate?: string): Promise<BranchMonthlyBillingRow | undefined>;
  updateUser(id: string, data: {
    name?: string;
    lastName?: string | null;
    email?: string;
    phone?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    avatarUrl?: string | null;
    googleId?: string | null;
    firebaseUid?: string | null;
    authProvider?: string | null;
    emailVerified?: boolean;
    emailVerifiedAt?: string | null;
  }): Promise<User | undefined>;
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
  findAuditLogByReference(params: { action: string; branchId?: string | null; referenceId: string }): Promise<AuditLog | undefined>;
  getAuditLogs(limit?: number): Promise<(AuditLog & { actorEmail?: string | null })[]>;
  createSystemEvent(data: { eventType: string; branchId?: string | null; userId?: string | null; payload?: any; status?: string }): Promise<SystemEvent>;
  getSystemEvents(limit?: number): Promise<(SystemEvent & { branchName?: string | null; userEmail?: string | null; userName?: string | null })[]>;
  upsertPushToken(data: { userId: string; token: string; platform: string; deviceName?: string | null }): Promise<PushToken>;
  deactivatePushToken(userId: string, token: string): Promise<boolean>;
  getActivePushTokensByUser(userId: string): Promise<PushToken[]>;
  getActivePushTokensByUsers(userIds: string[]): Promise<PushToken[]>;
  getActivePushTokensByBranch(branchId: string): Promise<PushToken[]>;
  createNotification(data: { recipientUserId?: string | null; branchId?: string | null; roleTarget?: string | null; type: string; title: string; message: string; data?: any; isRead?: boolean; readAt?: Date | null }): Promise<Notification>;
  findNotificationByReference(params: { type: string; referenceId: string; branchId?: string | null; recipientUserId?: string | null; roleTarget?: string | null }): Promise<Notification | undefined>;
  getNotificationsForActor(actor: { id: string; role: string; branchId?: string | null }, options?: { limit?: number; page?: number; status?: "all" | "read" | "unread" }): Promise<Notification[]>;
  getNotificationSummary(actor: { id: string; role: string; branchId?: string | null }): Promise<{ totalCount: number; unreadCount: number; readCount: number }>;
  markNotificationRead(notificationId: string, actor: { id: string; role: string; branchId?: string | null }): Promise<Notification | undefined>;
  markAllNotificationsRead(actor: { id: string; role: string; branchId?: string | null }): Promise<number>;
  deleteNotification(notificationId: string, actor: { id: string; role: string; branchId?: string | null }): Promise<boolean>;
  deleteReadNotifications(actor: { id: string; role: string; branchId?: string | null }): Promise<number>;
  deleteAllNotifications(actor: { id: string; role: string; branchId?: string | null }): Promise<number>;
  cleanupOldNotifications(maxAgeDays?: number): Promise<number>;
  cleanupOldBranchFinanceEntries(maxAgeDays?: number): Promise<number>;
  getBranchRecurringExpenses(branchId: string): Promise<BranchRecurringExpenseRow[]>;
  createBranchRecurringExpense(data: InsertBranchRecurringExpense): Promise<BranchRecurringExpenseRow>;
  updateBranchRecurringExpense(branchId: string, recurringExpenseId: string, data: Partial<InsertBranchRecurringExpense>): Promise<BranchRecurringExpenseRow | undefined>;
  softDeleteBranchRecurringExpense(branchId: string, recurringExpenseId: string): Promise<boolean>;
  registerBranchRecurringExpenseInFinance(
    branchId: string,
    recurringExpenseId: string,
    data: { entryDate: string; paymentMethod?: string | null; notes?: string | null; createdBy?: string | null },
  ): Promise<BranchFinanceEntryRow | undefined>;
  getBranchStaffMembers(branchId: string): Promise<BranchStaffMemberRow[]>;
  createBranchStaffMember(data: InsertBranchStaffMember): Promise<BranchStaffMemberRow>;
  updateBranchStaffMember(branchId: string, staffId: string, data: Partial<InsertBranchStaffMember>): Promise<BranchStaffMemberRow | undefined>;
  softDeleteBranchStaffMember(branchId: string, staffId: string): Promise<boolean>;
  getBranchStaffClassLogs(branchId: string, filters?: { from?: string; to?: string; staffId?: string; limit?: number }): Promise<BranchStaffClassLogRow[]>;
  createBranchStaffClassLogAndFinanceEntry(data: {
    branchId: string;
    staffId: string;
    classesCount: number;
    classDate: string;
    paymentMethod?: string | null;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchStaffClassLogRow>;
  getBranchClients(branchId: string, includeLeft?: boolean): Promise<any[]>;
  getBranchClientCommercialHistory(
    branchId: string,
    userId: string,
    filters?: {
      filter?: "all" | "products" | "services" | "current_month";
      page?: number;
      limit?: number;
    },
  ): Promise<BranchClientCommercialHistoryResult>;
  linkBranchClientToAppUser(branchId: string, sourceUserId: string, targetUserId: string): Promise<{
    membershipId: string | null;
    updatedTargetFields: string[];
    transferredCounts: Record<string, number>;
  }>;
  getClientProfile(userId: string, branchId: string): Promise<any>;
  updateBranchClientCrm(branchId: string, userId: string, data: { clientStatus?: string | null; tags?: string | null; lastVisit?: Date | null }): Promise<any>;
  updateBranchClientPrivateProfile(
    branchId: string,
    userId: string,
    data: {
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      medicalNotes?: string | null;
      injuriesNotes?: string | null;
      medicalWarnings?: string | null;
      parqAccepted?: boolean;
      parqAcceptedDate?: string | null;
    },
  ): Promise<any>;
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
  assignPlanToMembership(
    membershipId: string,
    planId: string,
    classesRemaining: number | null,
    classesTotal: number | null,
    expiresAt: Date | null,
    startDate: Date,
  ): Promise<Membership | undefined>;
  removePlanFromMembership(membershipId: string): Promise<Membership | undefined>;
  createMembershipFinanceEntry(data: {
    branchId: string;
    membershipId: string;
    userId: string;
    planId: string;
    planName: string;
    amount: number;
    paidAt: Date | string | null | undefined;
    expiresAt?: Date | string | null;
    paymentMethod?: string | null;
    createdBy?: string | null;
    eventType: "assign" | "renew";
  }): Promise<BranchFinanceEntryRow | null>;
  getMembershipByUserAndBranch(userId: string, branchId: string): Promise<Membership | undefined>;
  reconcilePastBookings(branchId: string): Promise<number>;
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
  createBookingAtomically(params: {
    classScheduleId: string;
    branchId: string;
    userId: string;
    bookingDate: string;
    source: InsertClassBooking["source"];
    requireActiveSchedule?: boolean;
    excludeNoShowFromCapacity?: boolean;
  }): Promise<{ booking?: ClassBooking; error?: "CLASS_NOT_FOUND" | "CLASS_FULL" | "ALREADY_BOOKED" }>;
  updateBookingStatus(id: string, status: string): Promise<ClassBooking | undefined>;
  markBookingLateCancellation(id: string): Promise<void>;
  createReservationAuditLog(data: InsertReservationAuditLog): Promise<ReservationAuditLog>;
  getReservationAuditLogs(filters?: { branchId?: string; limit?: number }): Promise<ReservationAuditRow[]>;
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
  getBranchCommercialProducts(branchId: string): Promise<BranchCommercialProductRow[]>;
  getBranchCommercialProductsPage(branchId: string, filters?: {
    page?: number | null;
    pageSize?: number | null;
    search?: string | null;
    status?: "all" | "active" | "inactive" | "archived" | null;
    category?: string | null;
    inventoryMode?: "all" | "inventory" | "no_inventory" | null;
    publicMode?: "all" | "public" | "private" | null;
    sort?: "updated_desc" | "name_asc" | "price_desc" | "price_asc" | "category_asc" | null;
  }): Promise<BranchCommercialProductListPage>;
  getBranchCommercialProductById(branchId: string, productId: string): Promise<BranchCommercialProductRow | undefined>;
  getBranchCommercialProductPerformance(
    branchId: string,
    productId: string,
    filters?: { from?: string | null; to?: string | null },
  ): Promise<BranchCommercialProductPerformanceRow | undefined>;
  createBranchCommercialProduct(data: InsertBranchCommercialProduct): Promise<BranchCommercialProductRow>;
  updateBranchCommercialProduct(branchId: string, productId: string, data: Partial<InsertBranchCommercialProduct>): Promise<BranchCommercialProductRow | undefined>;
  softDeleteBranchCommercialProduct(branchId: string, productId: string): Promise<boolean>;
  getBranchCommercialProjects(branchId: string, filters?: {
    page?: number | null;
    pageSize?: number | null;
    search?: string | null;
    status?: string | null;
    customerId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    sort?: "updated_desc" | "name_asc" | "name_desc" | "start_date_desc" | "start_date_asc" | null;
    includeArchived?: boolean;
  }): Promise<BranchCommercialProjectListPage>;
  getBranchCommercialProjectById(branchId: string, projectId: string): Promise<BranchCommercialProjectDetailRow | undefined>;
  getBranchCommercialProjectOptions(branchId: string): Promise<Array<{ id: string; code: string; name: string; status: string }>>;
  getBranchCommercialProjectLinkableSales(branchId: string, filters?: {
    page?: number | null;
    pageSize?: number | null;
    search?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): Promise<BranchCommercialProjectLinkableSalesPage>;
  getBranchCommercialProjectLinkablePurchases(branchId: string, filters?: {
    page?: number | null;
    pageSize?: number | null;
    search?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): Promise<BranchCommercialProjectLinkablePurchasesPage>;
  createBranchCommercialProject(data: InsertBranchCommercialProject): Promise<BranchCommercialProjectRow>;
  createBranchCommercialProjectFromSale(data: {
    branchId: string;
    saleId: string;
    name?: string | null;
    description?: string | null;
    notes?: string | null;
    expectedEndDate?: string | null;
    createdByUserId?: string | null;
  }): Promise<BranchCommercialProjectDetailRow>;
  updateBranchCommercialProject(branchId: string, projectId: string, data: Partial<InsertBranchCommercialProject>): Promise<BranchCommercialProjectRow | undefined>;
  linkBranchSaleToCommercialProject(branchId: string, projectId: string, saleId: string): Promise<BranchCommercialProjectDetailRow>;
  linkBranchPurchaseToCommercialProject(branchId: string, projectId: string, purchaseId: string): Promise<BranchCommercialProjectDetailRow>;
  getBranchCommercialDashboard(branchId: string, month?: string | null): Promise<BranchCommercialDashboardRow>;
  getBranchCommercialNotificationSignals(branchId: string): Promise<BranchCommercialNotificationSignals>;
  getBranchSaleDetail(branchId: string, saleId: string): Promise<BranchSaleRow | undefined>;
  cancelBranchSale(data: {
    branchId: string;
    saleId: string;
    reason: string;
    cancelledByUserId: string;
    idempotencyKey: string;
  }): Promise<BranchSaleRow | undefined>;
  getBranchSalespeople(branchId: string, filters?: { isActive?: boolean | null }): Promise<BranchSalespersonRow[]>;
  getBranchSalespersonById(branchId: string, salespersonId: string): Promise<BranchSalespersonRow | undefined>;
  getBranchSalespeopleRanking(branchId: string, month?: string | null): Promise<BranchCommercialDashboardTopSalespersonRow[]>;
  createBranchSalesperson(data: InsertBranchSalesperson): Promise<BranchSalespersonRow>;
  updateBranchSalesperson(branchId: string, salespersonId: string, data: Partial<InsertBranchSalesperson>): Promise<BranchSalespersonRow | undefined>;
  softDeleteBranchSalesperson(branchId: string, salespersonId: string): Promise<boolean>;
  getBranchSalespersonSummary(branchId: string, salespersonId: string, month?: string | null): Promise<BranchSalespersonSummaryRow | undefined>;
  getBranchSalespersonSales(branchId: string, salespersonId: string, month?: string | null): Promise<BranchSaleRow[]>;
  getBranchCommissionRules(branchId: string, salespersonId: string): Promise<BranchCommissionRuleRow[]>;
  getBranchCommissionRuleById(branchId: string, ruleId: string): Promise<BranchCommissionRuleRow | undefined>;
  createBranchCommissionRule(data: InsertBranchCommissionRule): Promise<BranchCommissionRuleRow>;
  updateBranchCommissionRule(branchId: string, ruleId: string, data: Partial<InsertBranchCommissionRule>): Promise<BranchCommissionRuleRow | undefined>;
  softDeleteBranchCommissionRule(branchId: string, ruleId: string): Promise<boolean>;
  getBranchSalespersonCommissions(branchId: string, salespersonId: string, month?: string | null): Promise<BranchCommissionAccrualRow[]>;
  getBranchSalespersonCommissionSummary(branchId: string, salespersonId: string, month?: string | null): Promise<BranchSalespersonCommissionSummaryRow | undefined>;
  getBranchSalespersonCommissionPayments(branchId: string, salespersonId: string, month?: string | null): Promise<BranchCommissionPaymentRow[]>;
  getBranchCommissionPaymentById(branchId: string, paymentId: string): Promise<BranchCommissionPaymentDetailRow | undefined>;
  createBranchSalespersonCommissionPayment(data: {
    branchId: string;
    salespersonId: string;
    amount: number;
    paymentMethod: string;
    idempotencyKey?: string | null;
    reference?: string | null;
    notes?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    accrualIds?: string[] | null;
    paidAt?: Date | null;
    createdBy?: string | null;
  }): Promise<BranchCommissionPaymentRow>;
  getBranchSuppliers(branchId: string): Promise<BranchSupplierRow[]>;
  getBranchSupplierById(branchId: string, supplierId: string): Promise<BranchSupplierRow | undefined>;
  getBranchSupplierSummary(branchId: string, supplierId: string): Promise<BranchSupplierSummaryRow | undefined>;
  createBranchSupplier(data: InsertBranchSupplier): Promise<BranchSupplierRow>;
  updateBranchSupplier(branchId: string, supplierId: string, data: Partial<InsertBranchSupplier>): Promise<BranchSupplierRow | undefined>;
  softDeleteBranchSupplier(branchId: string, supplierId: string): Promise<boolean>;
  getBranchPurchases(branchId: string, filters?: {
    status?: string | null;
    supplierId?: string | null;
    from?: string | null;
    to?: string | null;
  }): Promise<BranchPurchaseRow[]>;
  getBranchPurchaseById(branchId: string, purchaseId: string): Promise<BranchPurchaseDetailRow | undefined>;
  createBranchPurchase(data: {
    purchase: InsertBranchPurchase;
    items: InsertBranchPurchaseItem[];
  }): Promise<BranchPurchaseDetailRow>;
  receiveBranchPurchase(data: {
    branchId: string;
    purchaseId: string;
    receivedBy?: string | null;
    notes?: string | null;
  }): Promise<BranchPurchaseDetailRow>;
  cancelBranchPurchase(branchId: string, purchaseId: string): Promise<BranchPurchaseDetailRow | undefined>;
  createBranchSale(data: {
    sale: InsertBranchSale;
    items: InsertBranchSaleItem[];
    payments: InsertBranchSalePayment[];
    finance?: {
      source: string;
      category?: string | null;
      notes?: string | null;
      entryDate?: string | null;
      metadata?: any;
      clientName?: string | null;
    } | null;
    inventoryAdjustment?: {
      commercialProductId: string;
      quantity: number;
      unitCostSnapshot?: number | null;
      createdBy?: string | null;
      notes?: string | null;
      metadata?: any;
    } | null;
    inventoryAdjustments?: Array<{
      commercialProductId: string;
      quantity: number;
      unitCostSnapshot?: number | null;
      createdBy?: string | null;
      notes?: string | null;
      metadata?: any;
    }> | null;
  }): Promise<BranchSaleRow>;
  getBranchCommercialProductInventory(branchId: string, productId: string): Promise<BranchInventorySummaryRow>;
  getBranchCommercialProductInventoryMovements(branchId: string, productId: string, limit?: number): Promise<BranchInventoryMovementRow[]>;
  createBranchCommercialProductInitialInventory(data: {
    branchId: string;
    commercialProductId: string;
    quantity: number;
    minimumStock: number;
    unitCost?: number | null;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow>;
  createBranchCommercialProductInventoryEntry(data: {
    branchId: string;
    commercialProductId: string;
    quantity: number;
    minimumStock?: number | null;
    unitCost?: number | null;
    reason: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow>;
  adjustBranchCommercialProductInventory(data: {
    branchId: string;
    commercialProductId: string;
    newQuantity?: number | null;
    quantityDelta?: number | null;
    minimumStock?: number | null;
    unitCost?: number | null;
    reason: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow>;
  createBranchCommercialProductInventoryWaste(data: {
    branchId: string;
    commercialProductId: string;
    quantity: number;
    movementType: "waste" | "damaged";
    reason: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow>;
  getBranchServices(branchId: string): Promise<BranchServiceRow[]>;
  createBranchService(data: InsertBranchService): Promise<BranchServiceRow>;
  updateBranchService(branchId: string, serviceId: string, data: Partial<InsertBranchService>): Promise<BranchServiceRow | undefined>;
  softDeleteBranchService(branchId: string, serviceId: string): Promise<boolean>;
  createBranchServiceSaleOption(data: InsertBranchServiceSaleOption): Promise<BranchServiceSaleOptionRow>;
  updateBranchServiceSaleOption(branchId: string, optionId: string, data: Partial<InsertBranchServiceSaleOption>): Promise<BranchServiceSaleOptionRow | undefined>;
  softDeleteBranchServiceSaleOption(branchId: string, optionId: string): Promise<boolean>;
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
  updateClient(userId: string, data: { name?: string; email?: string | null; lastName?: string | null; phone?: string | null; birthDate?: string | null; gender?: string | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null; medicalNotes?: string | null; injuriesNotes?: string | null; medicalWarnings?: string | null; parqAccepted?: boolean; parqAcceptedDate?: string | null; avatarUrl?: string | null }): Promise<any>;
  updateClientStatus(membershipId: string, clientStatus: string): Promise<any>;
  updateClientDebt(membershipId: string, hasDebt: boolean, debtAmount: number): Promise<any>;
  softDeleteMembership(membershipId: string): Promise<any>;
  getUpcomingBookingsForUser(branchId: string, userId: string, fromDate: string, limit?: number): Promise<any[]>;
  updateBranchWhatsappTemplates(branchId: string, templates: Record<string, string>): Promise<any>;
  updateBranchProfile(branchId: string, data: { name?: string | null; description?: string | null; address?: string | null; city?: string | null; googleMapsUrl?: string | null; operatingHours?: any; summaryHours?: string | null; category?: string | null; subcategory?: string | null; searchKeywords?: string | null; latitude?: number | null; longitude?: number | null; whatsappNumber?: string | null }): Promise<any>;
  getUpcomingBirthdays(branchId: string, daysAhead?: number): Promise<any[]>;
  getBranchReviews(branchId: string): Promise<any[]>;
  getBranchReviewsSummary(branchId: string): Promise<{ averageRating: number; totalReviews: number }>;
  getUserReview(branchId: string, userId: string): Promise<BranchReview | null>;
  createOrUpdateReview(branchId: string, userId: string, rating: number, comment?: string | null): Promise<BranchReview>;
  getBranchReviewById(reviewId: string): Promise<BranchReview | undefined>;
  updateReviewReply(reviewId: string, adminReply: string | null): Promise<BranchReview | undefined>;
  updateReviewVisibility(reviewId: string, hidden: boolean, reason?: string | null): Promise<BranchReview | undefined>;
  createReviewReport(data: InsertReviewReport): Promise<ReviewReport>;
  getReviewReports(filters?: { branchId?: string; status?: string; limit?: number }): Promise<ReviewReportRow[]>;
  updateReviewReportStatus(reportId: string, status: string, reviewedByUserId: string, resolutionNote?: string | null): Promise<ReviewReport | undefined>;
  createReviewModerationLog(data: InsertReviewModerationLog): Promise<ReviewModerationLog>;
  getReviewModerationLogs(limit?: number): Promise<Array<ReviewModerationLog & { branchName?: string | null; reviewComment?: string | null; actorName?: string | null }>>;
  getBlockedCustomerUsers(): Promise<User[]>;
  createNotificationJob(data: InsertNotificationJob): Promise<NotificationJob>;
  getNotificationJobs(filters?: { branchId?: string; status?: string; limit?: number }): Promise<NotificationJob[]>;
  updateNotificationJob(id: string, data: Partial<InsertNotificationJob> & { processedAt?: Date | null; attempts?: number; status?: string; lastError?: string | null }): Promise<NotificationJob | undefined>;
  getPlatformMetrics(): Promise<PlatformMetrics>;
  getBranchDashboardMetrics(branchId: string): Promise<BranchDashboardMetrics>;
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

  async getUserByEmail(email: string | null | undefined): Promise<User | undefined> {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail) {
      return undefined;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(btrim(${users.email})) = ${normalizedEmail}`);
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async deleteCustomerAccount(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const userReviewRows = await tx
        .select({ id: branchReviews.id })
        .from(branchReviews)
        .where(eq(branchReviews.userId, id));
      const userReviewIds = userReviewRows.map((row) => row.id);

      const userBookingRows = await tx
        .select({ id: classBookings.id })
        .from(classBookings)
        .where(eq(classBookings.userId, id));
      const userBookingIds = userBookingRows.map((row) => row.id);

      const reviewReportsClauses = [eq(reviewReports.reporterUserId, id)];
      const reviewModerationClauses = [eq(reviewModerationLogs.actorUserId, id)];
      if (userReviewIds.length > 0) {
        reviewReportsClauses.push(inArray(reviewReports.reviewId, userReviewIds));
        reviewModerationClauses.push(inArray(reviewModerationLogs.reviewId, userReviewIds));
      }

      const reservationAuditClauses = [
        eq(reservationAuditLogs.customerUserId, id),
        eq(reservationAuditLogs.actorUserId, id),
      ];
      if (userBookingIds.length > 0) {
        reservationAuditClauses.push(inArray(reservationAuditLogs.bookingId, userBookingIds));
      }

      await tx.delete(reviewReports).where(or(...reviewReportsClauses));
      await tx.delete(reviewModerationLogs).where(or(...reviewModerationClauses));
      await tx.delete(reservationAuditLogs).where(or(...reservationAuditClauses));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, id));
      await tx.delete(branchReviews).where(eq(branchReviews.userId, id));
      await tx.delete(classBookings).where(eq(classBookings.userId, id));
      await tx.delete(searchLogs).where(eq(searchLogs.userId, id));
      await tx.delete(memberships).where(eq(memberships.userId, id));
      await tx.delete(pushTokens).where(eq(pushTokens.userId, id));
      await tx.delete(notifications).where(eq(notifications.recipientUserId, id));
      await tx
        .delete(clientNotes)
        .where(or(eq(clientNotes.userId, id), eq(clientNotes.createdBy, id)));
      await tx
        .delete(attendances)
        .where(or(eq(attendances.userId, id), eq(attendances.registeredBy, id)));
      await tx.delete(branchClientCrm).where(eq(branchClientCrm.userId, id));
      await tx
        .delete(branchCustomerBlocks)
        .where(or(eq(branchCustomerBlocks.userId, id), eq(branchCustomerBlocks.blockedByUserId, id)));
      await tx
        .delete(customerReports)
        .where(
          or(
            eq(customerReports.userId, id),
            eq(customerReports.reportedByUserId, id),
            eq(customerReports.reviewedByUserId, id),
          ),
        );
      await tx.delete(notificationJobs).where(eq(notificationJobs.userId, id));
      await tx
        .delete(branchFinanceEntries)
        .where(or(eq(branchFinanceEntries.clientUserId, id), eq(branchFinanceEntries.createdBy, id)));
      await tx.delete(systemEvents).where(eq(systemEvents.userId, id));
      await tx.delete(auditLogs).where(eq(auditLogs.actorUserId, id));

      const deletedRows = await tx.delete(users).where(eq(users.id, id)).returning({ id: users.id });
      if (deletedRows.length == 0) {
        throw new Error("User not found");
      }
    });
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

  async updateBranch(id: string, data: {
    name?: string;
    slug?: string;
    status?: string;
    category?: string | null;
    subcategory?: string | null;
    searchKeywords?: string | null;
  }): Promise<Branch | undefined> {
    const setData: Partial<InsertBranch> = {};
    if (data.name !== undefined) setData.name = data.name;
    if (data.slug !== undefined) setData.slug = data.slug;
    if (data.status !== undefined) setData.status = data.status as any;
    if (data.category !== undefined) setData.category = data.category;
    if (data.subcategory !== undefined) setData.subcategory = data.subcategory;
    if (data.searchKeywords !== undefined) setData.searchKeywords = data.searchKeywords;

    if (Object.keys(setData).length === 0) {
      const [existing] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
      return existing;
    }

    const [branch] = await db
      .update(branches)
      .set(setData)
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

  async estimateBranchPurge(branchId: string): Promise<BranchPurgeEstimateRow | undefined> {
    const [branch] = await db
      .select({ id: branches.id, name: branches.name, coverImageUrl: branches.coverImageUrl })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    if (!branch) return undefined;

    const countRow = async (value: Promise<Array<{ total: number }>>) => Number((await value)[0]?.total ?? 0);
    const [
      adminUsers,
      clientCrmCount,
      membershipsCount,
      membershipPlansCount,
      schedulesCount,
      bookingsCount,
      reviewsCount,
      notificationsCount,
      financeEntriesCount,
      recurringExpensesCount,
      staffMembersCount,
      staffClassLogsCount,
      servicesCount,
      serviceOptionsCount,
      commercialProjectsCount,
      salesCount,
      salespeopleCount,
      commercialProductsCount,
      inventoryBalancesCount,
      inventoryMovementsCount,
      suppliersCount,
      purchasesCount,
      purchaseItemsCount,
      commissionRulesCount,
      commissionAccrualsCount,
      commissionPaymentsCount,
      commissionAllocationsCount,
      promotionsCount,
      announcementsCount,
      photosCount,
      postsCount,
      videosCount,
      legacyProductsCount,
      monthlyBillingCount,
    ] = await Promise.all([
      countRow(db.select({ total: count() }).from(users).where(and(eq(users.branchId, branchId), eq(users.role, "BRANCH_ADMIN")))),
      countRow(db.select({ total: count() }).from(branchClientCrm).where(eq(branchClientCrm.branchId, branchId))),
      countRow(db.select({ total: count() }).from(memberships).where(eq(memberships.branchId, branchId))),
      countRow(db.select({ total: count() }).from(membershipPlans).where(eq(membershipPlans.branchId, branchId))),
      countRow(db.select({ total: count() }).from(classSchedules).where(eq(classSchedules.branchId, branchId))),
      countRow(db.select({ total: count() }).from(classBookings).where(eq(classBookings.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchReviews).where(eq(branchReviews.branchId, branchId))),
      countRow(db.select({ total: count() }).from(notifications).where(eq(notifications.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchFinanceEntries).where(eq(branchFinanceEntries.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchRecurringExpenses).where(eq(branchRecurringExpenses.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchStaffMembers).where(eq(branchStaffMembers.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchStaffClassLogs).where(eq(branchStaffClassLogs.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchServices).where(eq(branchServices.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchServiceSaleOptions).where(eq(branchServiceSaleOptions.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchCommercialProjects).where(eq(branchCommercialProjects.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchSales).where(eq(branchSales.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchSalespeople).where(eq(branchSalespeople.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchCommercialProducts).where(eq(branchCommercialProducts.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchInventoryBalances).where(eq(branchInventoryBalances.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchInventoryMovements).where(eq(branchInventoryMovements.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchSuppliers).where(eq(branchSuppliers.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchPurchases).where(eq(branchPurchases.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchPurchaseItems).where(eq(branchPurchaseItems.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchCommissionRules).where(eq(branchCommissionRules.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchCommissionAccruals).where(eq(branchCommissionAccruals.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchCommissionPayments).where(eq(branchCommissionPayments.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchCommissionPaymentAllocations).where(eq(branchCommissionPaymentAllocations.branchId, branchId))),
      countRow(db.select({ total: count() }).from(promotions).where(eq(promotions.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchAnnouncements).where(eq(branchAnnouncements.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchPhotos).where(eq(branchPhotos.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchPosts).where(eq(branchPosts.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchVideos).where(eq(branchVideos.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchProducts).where(eq(branchProducts.branchId, branchId))),
      countRow(db.select({ total: count() }).from(branchMonthlyBilling).where(eq(branchMonthlyBilling.branchId, branchId))),
    ]);

    const uploadUrls = new Set<string>();
    const addUploadUrl = (value: string | null | undefined) => {
      if (typeof value === "string" && value.trim().length > 0) {
        uploadUrls.add(value.trim());
      }
    };

    addUploadUrl(branch.coverImageUrl);
    const [adminRows, scheduleRows, photoRows, postRows, productRows, commercialProductRows, videoRows, announcementRows, promotionRows] = await Promise.all([
      db.select({ avatarUrl: users.avatarUrl }).from(users).where(and(eq(users.branchId, branchId), eq(users.role, "BRANCH_ADMIN"))),
      db.select({ routineImageUrl: classSchedules.routineImageUrl }).from(classSchedules).where(eq(classSchedules.branchId, branchId)),
      db.select({ url: branchPhotos.url }).from(branchPhotos).where(eq(branchPhotos.branchId, branchId)),
      db.select({ mediaUrl: branchPosts.mediaUrl }).from(branchPosts).where(eq(branchPosts.branchId, branchId)),
      db.select({ imageUrl: branchProducts.imageUrl }).from(branchProducts).where(eq(branchProducts.branchId, branchId)),
      db.select({ photoUrl: branchCommercialProducts.photoUrl }).from(branchCommercialProducts).where(eq(branchCommercialProducts.branchId, branchId)),
      db.select({ url: branchVideos.url, thumbnailUrl: branchVideos.thumbnailUrl }).from(branchVideos).where(eq(branchVideos.branchId, branchId)),
      db.select({ imageUrl: branchAnnouncements.imageUrl }).from(branchAnnouncements).where(eq(branchAnnouncements.branchId, branchId)),
      db.select({ imageUrl: promotions.imageUrl }).from(promotions).where(eq(promotions.branchId, branchId)),
    ]);

    adminRows.forEach((row) => addUploadUrl(row.avatarUrl));
    scheduleRows.forEach((row) => addUploadUrl(row.routineImageUrl));
    photoRows.forEach((row) => addUploadUrl(row.url));
    postRows.forEach((row) => addUploadUrl(row.mediaUrl));
    productRows.forEach((row) => addUploadUrl(row.imageUrl));
    commercialProductRows.forEach((row) => addUploadUrl(row.photoUrl));
    videoRows.forEach((row) => {
      addUploadUrl(row.url);
      addUploadUrl(row.thumbnailUrl);
    });
    announcementRows.forEach((row) => addUploadUrl(row.imageUrl));
    promotionRows.forEach((row) => addUploadUrl(row.imageUrl));

    return {
      branchId,
      branchName: branch.name,
      counts: {
        adminUsers,
        clientCrm: clientCrmCount,
        memberships: membershipsCount,
        membershipPlans: membershipPlansCount,
        schedules: schedulesCount,
        bookings: bookingsCount,
        reviews: reviewsCount,
        notifications: notificationsCount,
        financeEntries: financeEntriesCount,
        recurringExpenses: recurringExpensesCount,
        staffMembers: staffMembersCount,
        staffClassLogs: staffClassLogsCount,
        services: servicesCount,
        serviceOptions: serviceOptionsCount,
        commercialProjects: commercialProjectsCount,
        sales: salesCount,
        salespeople: salespeopleCount,
        commercialProducts: commercialProductsCount,
        inventoryBalances: inventoryBalancesCount,
        inventoryMovements: inventoryMovementsCount,
        suppliers: suppliersCount,
        purchases: purchasesCount,
        purchaseItems: purchaseItemsCount,
        commissionRules: commissionRulesCount,
        commissionAccruals: commissionAccrualsCount,
        commissionPayments: commissionPaymentsCount,
        commissionAllocations: commissionAllocationsCount,
        promotions: promotionsCount,
        announcements: announcementsCount,
        photos: photosCount,
        posts: postsCount,
        videos: videosCount,
        legacyProducts: legacyProductsCount,
        monthlyBilling: monthlyBillingCount,
      },
      uploadCount: uploadUrls.size,
    };
  }

  async hardDeleteBranch(id: string): Promise<BranchHardDeleteResult> {
    let purgePhase = "PURGE_INIT";
    const [branch] = await db
      .select()
      .from(branches)
      .where(eq(branches.id, id))
      .limit(1);

    if (!branch) {
      return {
        deleted: false,
        reason: "Sucursal no encontrada",
        deletedAdminCount: 0,
        uploadUrls: [],
        deletedAdminFirebaseUids: [],
      };
    }

    const uploadUrls = new Set<string>();
    const deletedAdminFirebaseUids = new Set<string>();
    let deletedAdminCount = 0;

    const addUploadUrl = (value: string | null | undefined) => {
      if (typeof value === "string" && value.trim().length > 0) {
        uploadUrls.add(value.trim());
      }
    };

    try {
      await db.transaction(async (tx) => {
      purgePhase = "PURGE_DB_LOAD_ADMINS";
      const adminRows = await tx
        .select({ id: users.id, avatarUrl: users.avatarUrl, firebaseUid: users.firebaseUid })
        .from(users)
        .where(and(eq(users.branchId, id), eq(users.role, "BRANCH_ADMIN")));

      const adminIds = adminRows.map((row) => row.id);
      deletedAdminCount = adminIds.length;

      addUploadUrl(branch.coverImageUrl);
      adminRows.forEach((row) => {
        addUploadUrl(row.avatarUrl);
        if (typeof row.firebaseUid === "string" && row.firebaseUid.trim().length > 0) {
          deletedAdminFirebaseUids.add(row.firebaseUid.trim());
        }
      });

      purgePhase = "PURGE_DB_COLLECT_RELATED_ROWS";
      const [
        scheduleRows,
        photoRows,
        postRows,
        productRows,
        commercialProductRows,
        videoRows,
        announcementRows,
        promotionRows,
        reviewRows,
        bookingRows,
      ] = await Promise.all([
        tx
          .select({ routineImageUrl: classSchedules.routineImageUrl })
          .from(classSchedules)
          .where(eq(classSchedules.branchId, id)),
        tx.select({ url: branchPhotos.url }).from(branchPhotos).where(eq(branchPhotos.branchId, id)),
        tx.select({ mediaUrl: branchPosts.mediaUrl }).from(branchPosts).where(eq(branchPosts.branchId, id)),
        tx.select({ imageUrl: branchProducts.imageUrl }).from(branchProducts).where(eq(branchProducts.branchId, id)),
        tx.select({ photoUrl: branchCommercialProducts.photoUrl }).from(branchCommercialProducts).where(eq(branchCommercialProducts.branchId, id)),
        tx
          .select({ url: branchVideos.url, thumbnailUrl: branchVideos.thumbnailUrl })
          .from(branchVideos)
          .where(eq(branchVideos.branchId, id)),
        tx
          .select({ imageUrl: branchAnnouncements.imageUrl })
          .from(branchAnnouncements)
          .where(eq(branchAnnouncements.branchId, id)),
        tx.select({ imageUrl: promotions.imageUrl }).from(promotions).where(eq(promotions.branchId, id)),
        tx.select({ id: branchReviews.id }).from(branchReviews).where(eq(branchReviews.branchId, id)),
        tx.select({ id: classBookings.id }).from(classBookings).where(eq(classBookings.branchId, id)),
      ]);

      scheduleRows.forEach((row) => addUploadUrl(row.routineImageUrl));
      photoRows.forEach((row) => addUploadUrl(row.url));
      postRows.forEach((row) => addUploadUrl(row.mediaUrl));
      productRows.forEach((row) => addUploadUrl(row.imageUrl));
      commercialProductRows.forEach((row) => addUploadUrl(row.photoUrl));
      videoRows.forEach((row) => {
        addUploadUrl(row.url);
        addUploadUrl(row.thumbnailUrl);
      });
      announcementRows.forEach((row) => addUploadUrl(row.imageUrl));
      promotionRows.forEach((row) => addUploadUrl(row.imageUrl));

      const reviewIds = reviewRows.map((row) => row.id);
      const bookingIds = bookingRows.map((row) => row.id);

      purgePhase = "PURGE_DB_DELETE_LOGS_AND_MODERATION";
      const reviewModerationClauses = [];
      if (reviewIds.length > 0) {
        reviewModerationClauses.push(inArray(reviewModerationLogs.reviewId, reviewIds));
      }
      if (adminIds.length > 0) {
        reviewModerationClauses.push(inArray(reviewModerationLogs.actorUserId, adminIds));
      }
      if (reviewModerationClauses.length > 0) {
        await tx.delete(reviewModerationLogs).where(or(...reviewModerationClauses)!);
      }

      const reviewReportClauses = [eq(reviewReports.branchId, id)];
      if (reviewIds.length > 0) {
        reviewReportClauses.push(inArray(reviewReports.reviewId, reviewIds));
      }
      if (adminIds.length > 0) {
        reviewReportClauses.push(inArray(reviewReports.reporterUserId, adminIds));
        reviewReportClauses.push(inArray(reviewReports.reviewedByUserId, adminIds));
      }
      await tx.delete(reviewReports).where(or(...reviewReportClauses)!);

      const reservationAuditClauses = [eq(reservationAuditLogs.branchId, id)];
      if (bookingIds.length > 0) {
        reservationAuditClauses.push(inArray(reservationAuditLogs.bookingId, bookingIds));
      }
      if (adminIds.length > 0) {
        reservationAuditClauses.push(inArray(reservationAuditLogs.actorUserId, adminIds));
      }
      await tx.delete(reservationAuditLogs).where(or(...reservationAuditClauses)!);

      const searchLogClauses = [eq(searchLogs.selectedBranchId, id)];
      if (adminIds.length > 0) {
        searchLogClauses.push(inArray(searchLogs.userId, adminIds));
      }
      await tx.delete(searchLogs).where(or(...searchLogClauses)!);

      const notificationClauses = [eq(notifications.branchId, id)];
      if (adminIds.length > 0) {
        notificationClauses.push(inArray(notifications.recipientUserId, adminIds));
      }
      await tx.delete(notifications).where(or(...notificationClauses)!);

      const systemEventClauses = [eq(systemEvents.branchId, id)];
      if (adminIds.length > 0) {
        systemEventClauses.push(inArray(systemEvents.userId, adminIds));
      }
      await tx.delete(systemEvents).where(or(...systemEventClauses)!);

      const notificationJobClauses = [eq(notificationJobs.branchId, id)];
      if (adminIds.length > 0) {
        notificationJobClauses.push(inArray(notificationJobs.userId, adminIds));
      }
      await tx.delete(notificationJobs).where(or(...notificationJobClauses)!);

      const customerReportClauses = [eq(customerReports.branchId, id)];
      if (adminIds.length > 0) {
        customerReportClauses.push(inArray(customerReports.reportedByUserId, adminIds));
        customerReportClauses.push(inArray(customerReports.reviewedByUserId, adminIds));
      }
      await tx.delete(customerReports).where(or(...customerReportClauses)!);

      const customerBlockClauses = [eq(branchCustomerBlocks.branchId, id)];
      if (adminIds.length > 0) {
        customerBlockClauses.push(inArray(branchCustomerBlocks.blockedByUserId, adminIds));
      }
      await tx.delete(branchCustomerBlocks).where(or(...customerBlockClauses)!);

      const clientNoteClauses = [eq(clientNotes.branchId, id)];
      if (adminIds.length > 0) {
        clientNoteClauses.push(inArray(clientNotes.createdBy, adminIds));
      }
      await tx.delete(clientNotes).where(or(...clientNoteClauses)!);

      const attendanceClauses = [eq(attendances.branchId, id)];
      if (adminIds.length > 0) {
        attendanceClauses.push(inArray(attendances.registeredBy, adminIds));
      }
      await tx.delete(attendances).where(or(...attendanceClauses)!);

      const auditLogClauses = [eq(auditLogs.branchId, id)];
      if (adminIds.length > 0) {
        auditLogClauses.push(inArray(auditLogs.actorUserId, adminIds));
      }
      await tx.delete(auditLogs).where(or(...auditLogClauses)!);

      purgePhase = "PURGE_DB_DELETE_STAFF_CLASS_LOGS";
      await tx.delete(branchStaffClassLogs).where(eq(branchStaffClassLogs.branchId, id));

      purgePhase = "PURGE_DB_DELETE_FINANCE";
      const financeClauses = [eq(branchFinanceEntries.branchId, id)];
      if (adminIds.length > 0) {
        financeClauses.push(inArray(branchFinanceEntries.createdBy, adminIds));
      }
      await tx.delete(branchFinanceEntries).where(or(...financeClauses)!);

      purgePhase = "PURGE_DB_DELETE_BRANCH_TABLES";
      await tx.delete(branchMonthlyBilling).where(eq(branchMonthlyBilling.branchId, id));
      await tx.delete(promotions).where(eq(promotions.branchId, id));
      await tx.delete(branchAnnouncements).where(eq(branchAnnouncements.branchId, id));
      await tx.delete(branchPhotos).where(eq(branchPhotos.branchId, id));
      await tx.delete(branchPosts).where(eq(branchPosts.branchId, id));
      await tx.delete(branchProducts).where(eq(branchProducts.branchId, id));
      await tx.delete(branchServiceSaleOptions).where(eq(branchServiceSaleOptions.branchId, id));
      await tx.delete(branchServices).where(eq(branchServices.branchId, id));
      await tx.delete(branchStaffMembers).where(eq(branchStaffMembers.branchId, id));
      await tx.delete(branchRecurringExpenses).where(eq(branchRecurringExpenses.branchId, id));
      await tx.delete(branchInventoryMovements).where(eq(branchInventoryMovements.branchId, id));
      await tx.delete(branchPurchaseItems).where(eq(branchPurchaseItems.branchId, id));
      await tx.delete(branchPurchases).where(eq(branchPurchases.branchId, id));
      await tx.delete(branchSuppliers).where(eq(branchSuppliers.branchId, id));
      await tx.delete(branchInventoryBalances).where(eq(branchInventoryBalances.branchId, id));
      await tx.delete(branchCommissionPaymentAllocations).where(eq(branchCommissionPaymentAllocations.branchId, id));
      await tx.delete(branchCommissionPayments).where(eq(branchCommissionPayments.branchId, id));
      await tx.delete(branchCommissionAccruals).where(eq(branchCommissionAccruals.branchId, id));
      await tx.delete(branchCommissionRules).where(eq(branchCommissionRules.branchId, id));
      await tx.delete(branchSales).where(eq(branchSales.branchId, id));
      await tx.delete(branchCommercialProjects).where(eq(branchCommercialProjects.branchId, id));
      await tx.delete(branchSalespeople).where(eq(branchSalespeople.branchId, id));
      await tx.delete(branchCommercialProducts).where(eq(branchCommercialProducts.branchId, id));
      await tx.delete(branchVideos).where(eq(branchVideos.branchId, id));
      await tx.delete(branchClientCrm).where(eq(branchClientCrm.branchId, id));
      await tx.delete(classBookings).where(eq(classBookings.branchId, id));
      await tx.delete(classSchedules).where(eq(classSchedules.branchId, id));
      await tx.delete(branchReviews).where(eq(branchReviews.branchId, id));
      await tx.delete(memberships).where(eq(memberships.branchId, id));
      await tx.delete(membershipPlans).where(eq(membershipPlans.branchId, id));

      purgePhase = "PURGE_DB_DELETE_BRANCH_ADMINS";
      if (adminIds.length > 0) {
        await tx.delete(pushTokens).where(inArray(pushTokens.userId, adminIds));
        await tx.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, adminIds));
        await tx.delete(users).where(inArray(users.id, adminIds));
      }

      purgePhase = "PURGE_DB_CLEAR_LINKED_USERS";
      await tx.update(users).set({ branchId: null }).where(eq(users.branchId, id));
      purgePhase = "PURGE_DB_DELETE_BRANCH";
      await tx.delete(branches).where(eq(branches.id, id));
    });
    } catch (error) {
      console.error(`[BRANCH_PURGE][${purgePhase}] branch=${id}`, error instanceof Error ? error.stack || error.message : error);
      if (error && typeof error === "object") {
        (error as Record<string, unknown>).purgePhase = purgePhase;
      }
      throw error;
    }

    return {
      deleted: true,
      branchName: branch.name,
      deletedAdminCount,
      uploadUrls: Array.from(uploadUrls),
      deletedAdminFirebaseUids: Array.from(deletedAdminFirebaseUids),
    };
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
    subcategory?: string;
    zone?: string;
    q?: string;
  }): Promise<(Branch & { distance_km?: number })[]> {
    const { lat, lng, radiusKm = 50, category, subcategory, zone, q } = params;
    const normalizedQuery = q ? normalizeSearchText(q) : "";
    const normalizedSubcategory = subcategory ? normalizeSearchText(subcategory) : "";
    const normalizedZone = zone ? normalizeSearchText(zone) : "";

    const conditions: any[] = [
      eq(branches.status, "active"),
      isNull(branches.deletedAt),
    ];

    if (category) {
      conditions.push(eq(branches.category, category));
    }

    if (normalizedSubcategory) {
      const likeSubcategory = `%${normalizedSubcategory}%`;
      conditions.push(sql`${normalizedSearchSqlSafe(branches.subcategory)} LIKE ${likeSubcategory}`);
    }

    if (normalizedZone) {
      const likeZone = `%${normalizedZone}%`;
      conditions.push(
        or(
          sql`${normalizedSearchSqlSafe(branches.city)} LIKE ${likeZone}`,
          sql`${normalizedSearchSqlSafe(branches.address)} LIKE ${likeZone}`,
        ),
      );
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

  async listCategories(): Promise<Category[]> {
    return db
      .select()
      .from(categories)
      .orderBy(asc(categories.displayOrder), asc(categories.label));
  }

  async listPublicCategories(): Promise<Category[]> {
    return db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.displayOrder), asc(categories.label));
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values({
        key: data.key,
        label: data.label,
        icon: data.icon ?? null,
        isActive: data.isActive ?? true,
        displayOrder: data.displayOrder ?? 0,
      })
      .returning();

    return category;
  }

  async updateCategory(key: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const setData: Partial<InsertCategory> & { updatedAt?: Date } = {};
    if (data.label !== undefined) setData.label = data.label;
    if (data.icon !== undefined) setData.icon = data.icon;
    if (data.isActive !== undefined) setData.isActive = data.isActive;
    if (data.displayOrder !== undefined) setData.displayOrder = data.displayOrder;
    if (Object.keys(setData).length === 0) {
      const [existing] = await db.select().from(categories).where(eq(categories.key, key)).limit(1);
      return existing;
    }

    setData.updatedAt = new Date();
    const [updated] = await db
      .update(categories)
      .set(setData)
      .where(eq(categories.key, key))
      .returning();

    return updated;
  }

  async listSubcategories(categoryKey?: string): Promise<(Subcategory & { categoryLabel?: string | null })[]> {
    const conditions = categoryKey ? [eq(subcategories.categoryKey, categoryKey)] : [];

    return db
      .select({
        id: subcategories.id,
        categoryKey: subcategories.categoryKey,
        label: subcategories.label,
        isActive: subcategories.isActive,
        displayOrder: subcategories.displayOrder,
        createdAt: subcategories.createdAt,
        updatedAt: subcategories.updatedAt,
        categoryLabel: categories.label,
      })
      .from(subcategories)
      .innerJoin(categories, eq(subcategories.categoryKey, categories.key))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(categories.displayOrder), asc(subcategories.displayOrder), asc(subcategories.label));
  }

  async listPublicSubcategories(categoryKey?: string): Promise<(Subcategory & { categoryLabel?: string | null })[]> {
    const conditions: any[] = [
      eq(subcategories.isActive, true),
      eq(categories.isActive, true),
    ];

    if (categoryKey) {
      conditions.push(eq(subcategories.categoryKey, categoryKey));
    }

    return db
      .select({
        id: subcategories.id,
        categoryKey: subcategories.categoryKey,
        label: subcategories.label,
        isActive: subcategories.isActive,
        displayOrder: subcategories.displayOrder,
        createdAt: subcategories.createdAt,
        updatedAt: subcategories.updatedAt,
        categoryLabel: categories.label,
      })
      .from(subcategories)
      .innerJoin(categories, eq(subcategories.categoryKey, categories.key))
      .where(and(...conditions))
      .orderBy(asc(categories.displayOrder), asc(subcategories.displayOrder), asc(subcategories.label));
  }

  async createSubcategory(data: InsertSubcategory): Promise<Subcategory> {
    const [subcategory] = await db
      .insert(subcategories)
      .values({
        categoryKey: data.categoryKey,
        label: data.label,
        isActive: data.isActive ?? true,
        displayOrder: data.displayOrder ?? 0,
      })
      .returning();

    return subcategory;
  }

  async updateSubcategory(id: string, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined> {
    const setData: Partial<InsertSubcategory> & { updatedAt?: Date } = {};
    if (data.categoryKey !== undefined) setData.categoryKey = data.categoryKey;
    if (data.label !== undefined) setData.label = data.label;
    if (data.isActive !== undefined) setData.isActive = data.isActive;
    if (data.displayOrder !== undefined) setData.displayOrder = data.displayOrder;
    if (Object.keys(setData).length === 0) {
      const [existing] = await db.select().from(subcategories).where(eq(subcategories.id, id)).limit(1);
      return existing;
    }

    setData.updatedAt = new Date();
    const [updated] = await db
      .update(subcategories)
      .set(setData)
      .where(eq(subcategories.id, id))
      .returning();

    return updated;
  }

  async listCategoryKeywords(filters?: { categoryKey?: string; subcategoryId?: string }): Promise<(CategoryKeyword & { categoryLabel?: string | null; subcategoryLabel?: string | null })[]> {
    const conditions: any[] = [];

    if (filters?.categoryKey) {
      conditions.push(eq(categoryKeywords.categoryKey, filters.categoryKey));
    }
    if (filters?.subcategoryId) {
      conditions.push(eq(categoryKeywords.subcategoryId, filters.subcategoryId));
    }

    return db
      .select({
        id: categoryKeywords.id,
        categoryKey: categoryKeywords.categoryKey,
        subcategoryId: categoryKeywords.subcategoryId,
        keyword: categoryKeywords.keyword,
        normalizedKeyword: categoryKeywords.normalizedKeyword,
        kind: categoryKeywords.kind,
        createdAt: categoryKeywords.createdAt,
        categoryLabel: categories.label,
        subcategoryLabel: subcategories.label,
      })
      .from(categoryKeywords)
      .leftJoin(categories, eq(categoryKeywords.categoryKey, categories.key))
      .leftJoin(subcategories, eq(categoryKeywords.subcategoryId, subcategories.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(categories.displayOrder), asc(subcategories.displayOrder), asc(categoryKeywords.keyword));
  }

  async createCategoryKeyword(data: InsertCategoryKeyword): Promise<CategoryKeyword> {
    let resolvedCategoryKey = data.categoryKey ?? null;

    if (data.subcategoryId) {
      const [subcategory] = await db
        .select({
          categoryKey: subcategories.categoryKey,
        })
        .from(subcategories)
        .where(eq(subcategories.id, data.subcategoryId))
        .limit(1);

      if (subcategory?.categoryKey) {
        resolvedCategoryKey = subcategory.categoryKey;
      }
    }

    const [keyword] = await db
      .insert(categoryKeywords)
      .values({
        categoryKey: resolvedCategoryKey,
        subcategoryId: data.subcategoryId ?? null,
        keyword: data.keyword,
        normalizedKeyword: normalizeSearchText(data.keyword),
        kind: data.kind ?? "alias",
      })
      .returning();

    return keyword;
  }

  async deleteCategoryKeyword(id: string): Promise<boolean> {
    const deleted = await db
      .delete(categoryKeywords)
      .where(eq(categoryKeywords.id, id))
      .returning({ id: categoryKeywords.id });

    return deleted.length > 0;
  }

  async listAppSettings(scope?: string): Promise<AppSetting[]> {
    if (!scope || scope === "global") {
      await ensureDefaultGlobalAppSettings();
    }

    const conditions = scope ? [eq(appSettings.scope, scope)] : [];

    return db
      .select()
      .from(appSettings)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(appSettings.key));
  }

  async upsertAppSetting(key: string, data: { valueJson: any; scope?: string; updatedBy?: string | null }): Promise<AppSetting> {
    const [setting] = await db
      .insert(appSettings)
      .values({
        key,
        valueJson: data.valueJson,
        scope: data.scope ?? "global",
        updatedBy: data.updatedBy ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          valueJson: data.valueJson,
          scope: data.scope ?? "global",
          updatedBy: data.updatedBy ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return setting;
  }

  async createSearchLog(data: InsertSearchLog): Promise<SearchLog> {
    const [log] = await db
      .insert(searchLogs)
      .values({
        userId: data.userId ?? null,
        queryRaw: data.queryRaw ?? null,
        queryNormalized: data.queryNormalized ?? (data.queryRaw ? normalizeSearchText(data.queryRaw) : null),
        category: data.category ?? null,
        subcategory: data.subcategory ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        zone: data.zone ?? null,
        resultCount: data.resultCount ?? 0,
        selectedBranchId: data.selectedBranchId ?? null,
        source: data.source ?? "unknown",
      })
      .returning();

    return log;
  }

  async updateSearchLogSelection(logId: string, selectedBranchId: string): Promise<SearchLog | undefined> {
    const [updated] = await db
      .update(searchLogs)
      .set({ selectedBranchId })
      .where(eq(searchLogs.id, logId))
      .returning();

    return updated;
  }

  async getSearchLogs(limit = 50): Promise<SearchLogRow[]> {
    return db
      .select({
        id: searchLogs.id,
        userId: searchLogs.userId,
        queryRaw: searchLogs.queryRaw,
        queryNormalized: searchLogs.queryNormalized,
        category: searchLogs.category,
        subcategory: searchLogs.subcategory,
        lat: searchLogs.lat,
        lng: searchLogs.lng,
        zone: searchLogs.zone,
        resultCount: searchLogs.resultCount,
        selectedBranchId: searchLogs.selectedBranchId,
        source: searchLogs.source,
        createdAt: searchLogs.createdAt,
        userEmail: users.email,
        selectedBranchName: branches.name,
      })
      .from(searchLogs)
      .leftJoin(users, eq(searchLogs.userId, users.id))
      .leftJoin(branches, eq(searchLogs.selectedBranchId, branches.id))
      .orderBy(desc(searchLogs.createdAt))
      .limit(limit);
  }

  async getSearchMetrics(limit = 10): Promise<SearchMetrics> {
    const topQueries = await db
      .select({
        query: sql<string>`max(coalesce(${searchLogs.queryRaw}, ${searchLogs.queryNormalized}))`.as("query"),
        total: sql<number>`count(*)::int`.as("total"),
      })
      .from(searchLogs)
      .where(sql`${searchLogs.queryNormalized} is not null and ${searchLogs.queryNormalized} <> ''`)
      .groupBy(searchLogs.queryNormalized)
      .orderBy(desc(sql`count(*)::int`))
      .limit(limit);

    const zeroResultQueries = await db
      .select({
        query: sql<string>`max(coalesce(${searchLogs.queryRaw}, ${searchLogs.queryNormalized}))`.as("query"),
        total: sql<number>`count(*)::int`.as("total"),
      })
      .from(searchLogs)
      .where(and(eq(searchLogs.resultCount, 0), sql`${searchLogs.queryNormalized} is not null and ${searchLogs.queryNormalized} <> ''`))
      .groupBy(searchLogs.queryNormalized)
      .orderBy(desc(sql`count(*)::int`))
      .limit(limit);

    const topCategories = await db
      .select({
        category: searchLogs.category,
        total: sql<number>`count(*)::int`.as("total"),
      })
      .from(searchLogs)
      .where(sql`${searchLogs.category} is not null and ${searchLogs.category} <> ''`)
      .groupBy(searchLogs.category)
      .orderBy(desc(sql`count(*)::int`))
      .limit(limit);

    return {
      topQueries: topQueries.map((row) => ({
        query: row.query || "Sin texto",
        total: Number(row.total) || 0,
      })),
      zeroResultQueries: zeroResultQueries.map((row) => ({
        query: row.query || "Sin texto",
        total: Number(row.total) || 0,
      })),
      topCategories: topCategories.map((row) => ({
        category: row.category || "Sin categoría",
        total: Number(row.total) || 0,
      })),
    };
  }

  async getSearchSuggestions(q: string, limit = 10): Promise<SearchSuggestion[]> {
    const normalizedQuery = normalizeSearchText(q);
    if (!normalizedQuery || normalizedQuery.length < 2) {
      return [];
    }

    const likeQuery = `%${normalizedQuery}%`;

    const [categoryRows, subcategoryRows, keywordRows, branchRows] = await Promise.all([
      db
        .select({
          key: categories.key,
          label: categories.label,
        })
        .from(categories)
        .where(and(eq(categories.isActive, true), sql`${normalizedSearchSqlSafe(categories.label)} LIKE ${likeQuery}`))
        .orderBy(asc(categories.displayOrder), asc(categories.label))
        .limit(limit),
      db
        .select({
          id: subcategories.id,
          categoryKey: subcategories.categoryKey,
          label: subcategories.label,
        })
        .from(subcategories)
        .innerJoin(categories, eq(subcategories.categoryKey, categories.key))
        .where(and(
          eq(subcategories.isActive, true),
          eq(categories.isActive, true),
          sql`${normalizedSearchSqlSafe(subcategories.label)} LIKE ${likeQuery}`,
        ))
        .orderBy(asc(categories.displayOrder), asc(subcategories.displayOrder), asc(subcategories.label))
        .limit(limit),
      db
        .select({
          id: categoryKeywords.id,
          categoryKey: categoryKeywords.categoryKey,
          subcategoryId: categoryKeywords.subcategoryId,
          keyword: categoryKeywords.keyword,
          normalizedKeyword: categoryKeywords.normalizedKeyword,
        })
        .from(categoryKeywords)
        .where(sql`${categoryKeywords.normalizedKeyword} LIKE ${likeQuery}`)
        .orderBy(asc(categoryKeywords.keyword))
        .limit(limit),
      db
        .select({
          id: branches.id,
          slug: branches.slug,
          name: branches.name,
        })
        .from(branches)
        .where(and(
          eq(branches.status, "active"),
          isNull(branches.deletedAt),
          sql`${normalizedSearchSqlSafe(branches.name)} LIKE ${likeQuery}`,
        ))
        .orderBy(asc(branches.name))
        .limit(limit),
    ]);

    const suggestions: SearchSuggestion[] = [
      ...categoryRows.map((row) => ({
        type: "category" as const,
        label: row.label,
        normalized: normalizeSearchText(row.label),
        categoryKey: row.key,
      })),
      ...subcategoryRows.map((row) => ({
        type: "subcategory" as const,
        label: row.label,
        normalized: normalizeSearchText(row.label),
        categoryKey: row.categoryKey,
        subcategoryId: row.id,
      })),
      ...keywordRows.map((row) => ({
        type: "keyword" as const,
        label: row.keyword,
        normalized: row.normalizedKeyword,
        categoryKey: row.categoryKey,
        subcategoryId: row.subcategoryId,
      })),
      ...branchRows.map((row) => ({
        type: "branch" as const,
        label: row.name,
        normalized: normalizeSearchText(row.name),
        branchId: row.id,
        branchSlug: row.slug,
      })),
    ];

    const deduped = Array.from(
      new Map(
        suggestions.map((item) => [`${item.type}:${item.normalized}:${item.branchSlug ?? item.subcategoryId ?? item.categoryKey ?? ""}`, item]),
      ).values(),
    );

    return deduped
      .sort((a, b) => {
        const aStarts = a.normalized.startsWith(normalizedQuery) ? 0 : 1;
        const bStarts = b.normalized.startsWith(normalizedQuery) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.label.localeCompare(b.label, "es");
      })
      .slice(0, limit);
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

  async updateUser(id: string, data: {
    name?: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    avatarUrl?: string | null;
    googleId?: string | null;
    firebaseUid?: string | null;
    authProvider?: string | null;
    emailVerified?: boolean;
    emailVerifiedAt?: string | null;
  }): Promise<User | undefined> {
    const setData: any = {};
    if (data.name !== undefined) setData.name = data.name;
    if (data.lastName !== undefined) setData.lastName = data.lastName;
    if (data.email !== undefined) setData.email = data.email;
    if (data.phone !== undefined) setData.phone = data.phone;
    if (data.birthDate !== undefined) setData.birthDate = data.birthDate;
    if (data.gender !== undefined) setData.gender = data.gender;
    if (data.avatarUrl !== undefined) setData.avatarUrl = data.avatarUrl;
    if (data.googleId !== undefined) setData.googleId = data.googleId;
    if (data.firebaseUid !== undefined) setData.firebaseUid = data.firebaseUid;
    if (data.authProvider !== undefined) setData.authProvider = data.authProvider;
    if (data.emailVerified !== undefined) setData.emailVerified = data.emailVerified;
    if (data.emailVerifiedAt !== undefined) setData.emailVerifiedAt = data.emailVerifiedAt;
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

  async findAuditLogByReference(params: { action: string; branchId?: string | null; referenceId: string }): Promise<AuditLog | undefined> {
    const conditions = [
      eq(auditLogs.action, params.action),
      sql`COALESCE(${auditLogs.metadata} ->> 'referenceId', '') = ${params.referenceId}`,
    ];

    if (params.branchId) {
      conditions.push(eq(auditLogs.branchId, params.branchId));
    } else {
      conditions.push(isNull(auditLogs.branchId));
    }

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);

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

  async findNotificationByReference(params: {
    type: string;
    referenceId: string;
    branchId?: string | null;
    recipientUserId?: string | null;
    roleTarget?: string | null;
  }): Promise<Notification | undefined> {
    const conditions = [
      eq(notifications.type, params.type),
      sql`COALESCE(${notifications.data} ->> 'referenceId', '') = ${params.referenceId}`,
    ];

    if (params.branchId) {
      conditions.push(eq(notifications.branchId, params.branchId));
    } else {
      conditions.push(isNull(notifications.branchId));
    }

    if (params.recipientUserId) {
      conditions.push(eq(notifications.recipientUserId, params.recipientUserId));
    } else {
      conditions.push(isNull(notifications.recipientUserId));
    }

    if (params.roleTarget) {
      conditions.push(eq(notifications.roleTarget, params.roleTarget as any));
    } else {
      conditions.push(isNull(notifications.roleTarget));
    }

    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(1);

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

  async cleanupOldBranchFinanceEntries(maxAgeDays = 90): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
      .toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE });

    const rows = await db
      .delete(branchFinanceEntries)
      .where(sql`${branchFinanceEntries.entryDate} < ${cutoff}`)
      .returning({ id: branchFinanceEntries.id });

    return rows.length;
  }

  async upsertBranchClientCrm(
    branchId: string,
    userId: string,
    data: {
      clientStatus?: string | null;
      tags?: string | null;
      lastVisit?: Date | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      medicalNotes?: string | null;
      injuriesNotes?: string | null;
      medicalWarnings?: string | null;
      parqAccepted?: boolean;
      parqAcceptedDate?: string | null;
      privateProfileInitialized?: boolean;
    },
  ): Promise<BranchClientCrm> {
    const now = new Date();
    const setData: Record<string, any> = {
      updatedAt: now,
    };

    if (data.clientStatus !== undefined) setData.clientStatus = data.clientStatus;
    if (data.tags !== undefined) setData.tags = data.tags;
    if (data.lastVisit !== undefined) setData.lastVisit = data.lastVisit;
    if (data.emergencyContactName !== undefined) setData.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) setData.emergencyContactPhone = data.emergencyContactPhone;
    if (data.medicalNotes !== undefined) setData.medicalNotes = data.medicalNotes;
    if (data.injuriesNotes !== undefined) setData.injuriesNotes = data.injuriesNotes;
    if (data.medicalWarnings !== undefined) setData.medicalWarnings = data.medicalWarnings;
    if (data.parqAccepted !== undefined) setData.parqAccepted = data.parqAccepted;
    if (data.parqAcceptedDate !== undefined) setData.parqAcceptedDate = data.parqAcceptedDate;
    if (data.privateProfileInitialized !== undefined) setData.privateProfileInitialized = data.privateProfileInitialized;

    const [row] = await db
      .insert(branchClientCrm)
      .values({
        branchId,
        userId,
        clientStatus: data.clientStatus ?? null,
        tags: data.tags ?? null,
        lastVisit: data.lastVisit ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        medicalNotes: data.medicalNotes ?? null,
        injuriesNotes: data.injuriesNotes ?? null,
        medicalWarnings: data.medicalWarnings ?? null,
        parqAccepted: data.parqAccepted ?? false,
        parqAcceptedDate: data.parqAcceptedDate ?? null,
        privateProfileInitialized: data.privateProfileInitialized ?? false,
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
        firebaseUid: users.firebaseUid,
        authProvider: users.authProvider,
        acceptedTerms: users.acceptedTerms,
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
    const individualPurchaseCountMap: Record<string, number> = {};
    const lastIndividualPurchaseAtMap: Record<string, string | null> = {};

    if (clientIds.length > 0) {
      const [attResults, bookingResults, crmResults, blockResults, reportResults, purchaseResults] = await Promise.all([
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
        db
          .select({
            userId: branchFinanceEntries.clientUserId,
            total: sql<number>`COUNT(*)`.as("total"),
            lastEntryDate: sql<string>`MAX(${branchFinanceEntries.entryDate})`.as("last_entry_date"),
          })
          .from(branchFinanceEntries)
          .where(and(
            eq(branchFinanceEntries.branchId, branchId),
            eq(branchFinanceEntries.source, "service_sale"),
            inArray(branchFinanceEntries.clientUserId, clientIds),
            isNull(branchFinanceEntries.deletedAt),
          ))
          .groupBy(branchFinanceEntries.clientUserId),
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

      for (const purchase of purchaseResults) {
        if (!purchase.userId) continue;
        individualPurchaseCountMap[purchase.userId] = Number(purchase.total) || 0;
        lastIndividualPurchaseAtMap[purchase.userId] = purchase.lastEntryDate || null;
      }
    }

    const now = new Date();
    return results.map(r => {
      const {
        authProvider,
        acceptedTerms,
        ...client
      } = r;
      let planStatus: "active" | "expired" | "deleted" | null = null;
      if (client.planId) {
        planStatus = (client.expiresAt && new Date(client.expiresAt) < now) ? "expired" : "active";
      } else if (client.planNameSnapshot) {
        planStatus = "deleted";
      }
      const crm = crmMap[client.userId];
      const lastAttendance = lastAttendanceMap[client.userId] || null;
      const lastVisit = getLatestDate(
        crm?.lastVisit,
        lastAttendance,
        latestBookingMap[client.userId],
      );
      const localBlock = localBlockMap[client.userId] || null;
      const identityControl = getBranchClientIdentityControl(
        {
          email: client.email,
          authProvider,
          firebaseUid: client.firebaseUid,
          acceptedTerms,
        },
        { source: client.source },
      );

      return {
        ...client,
        planName: client.planName || client.planNameSnapshot || null,
        planStatus,
        identityControl,
        lastAttendance,
        crmClientStatus: resolveCrmClientStatus(crm?.clientStatus, lastVisit, client.joinedAt),
        crmManualStatus: crm?.clientStatus || null,
        lastVisit,
        tags: crm?.tags || null,
        isLocallyBlocked: !!localBlock,
        localBlockedAt: localBlock?.createdAt || null,
        localBlockReason: localBlock?.reason || null,
        reportCount: reportCountMap[client.userId] || 0,
        individualPurchaseCount: individualPurchaseCountMap[client.userId] || 0,
        lastIndividualPurchaseAt: lastIndividualPurchaseAtMap[client.userId] || null,
      };
    });
  }

  async getBranchClientCommercialHistory(
    branchId: string,
    userId: string,
    filters?: {
      filter?: "all" | "products" | "services" | "current_month";
      page?: number;
      limit?: number;
    },
  ): Promise<BranchClientCommercialHistoryResult> {
    const membership = await this.getMembershipByUserAndBranch(userId, branchId);
    const filter = filters?.filter ?? "all";
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(filters?.limit ?? 10) || 10));

    if (!membership) {
      return {
        summary: {
          totalSpentAmount: 0,
          salesCount: 0,
          averageTicketAmount: 0,
          lastPurchaseAt: null,
          currentMonthAmount: 0,
        },
        items: [],
        total: 0,
        page,
        limit,
        filter,
      };
    }

    const monthRange = getMonthRangeByKey();
    const filterClauses = [
      eq(branchSales.branchId, branchId),
      eq(branchSales.clientUserId, userId),
      eq(branchSales.status, "completed"),
    ];

    if (filter === "current_month") {
      filterClauses.push(sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${monthRange.from}`);
      filterClauses.push(sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${monthRange.toExclusive}`);
    }

    if (filter === "products") {
      filterClauses.push(sql`
        EXISTS (
          SELECT 1
          FROM ${branchSaleItems}
          WHERE ${branchSaleItems.saleId} = ${branchSales.id}
            AND ${branchSaleItems.itemType} = 'commercial_product'
        )
      `);
    }

    if (filter === "services") {
      filterClauses.push(sql`
        EXISTS (
          SELECT 1
          FROM ${branchSaleItems}
          WHERE ${branchSaleItems.saleId} = ${branchSales.id}
            AND ${branchSaleItems.itemType} <> 'commercial_product'
        )
      `);
    }

    const [summaryRows, currentMonthRows, totalRows, saleRows] = await Promise.all([
      db
        .select({
          totalSpentAmount: sql<number>`COALESCE(SUM(${branchSales.totalAmount}), 0)`.as("total_spent_amount"),
          salesCount: sql<number>`COUNT(*)`.as("sales_count"),
          lastPurchaseAt: sql<Date | string | null>`MAX(${branchSales.createdAt})`.as("last_purchase_at"),
        })
        .from(branchSales)
        .where(and(...filterClauses))
        .limit(1),
      db
        .select({
          totalSpentAmount: sql<number>`COALESCE(SUM(${branchSales.totalAmount}), 0)`.as("total_spent_amount"),
        })
        .from(branchSales)
        .where(and(
          eq(branchSales.branchId, branchId),
          eq(branchSales.clientUserId, userId),
          eq(branchSales.status, "completed"),
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${monthRange.from}`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${monthRange.toExclusive}`,
        ))
        .limit(1),
      db
        .select({ total: sql<number>`COUNT(*)`.as("total") })
        .from(branchSales)
        .where(and(...filterClauses))
        .limit(1),
      db
        .select({
          id: branchSales.id,
          folio: branchSales.folio,
          createdAt: branchSales.createdAt,
          totalAmount: branchSales.totalAmount,
          paidAmount: branchSales.paidAmount,
          discountAmount: branchSales.discountAmount,
          sellerId: branchSales.sellerId,
          sellerNameSnapshot: branchSales.sellerNameSnapshot,
          channel: branchSales.channel,
          notes: branchSales.notes,
        })
        .from(branchSales)
        .where(and(...filterClauses))
        .orderBy(desc(branchSales.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    const saleIds = saleRows.map((row) => row.id);
    const [itemRows, paymentRows] = saleIds.length
      ? await Promise.all([
          db
            .select()
            .from(branchSaleItems)
            .where(inArray(branchSaleItems.saleId, saleIds))
            .orderBy(asc(branchSaleItems.createdAt)),
          db
            .select()
            .from(branchSalePayments)
            .where(inArray(branchSalePayments.saleId, saleIds))
            .orderBy(asc(branchSalePayments.createdAt)),
        ])
      : [[], []];

    const itemsBySaleId = new Map<string, BranchSaleItemRow[]>();
    for (const row of itemRows) {
      const current = itemsBySaleId.get(row.saleId) ?? [];
      current.push(this.mapBranchSaleItemRow(row));
      itemsBySaleId.set(row.saleId, current);
    }

    const paymentsBySaleId = new Map<string, BranchSalePaymentRow[]>();
    for (const row of paymentRows) {
      const current = paymentsBySaleId.get(row.saleId) ?? [];
      current.push(this.mapBranchSalePaymentRow(row));
      paymentsBySaleId.set(row.saleId, current);
    }

    const summaryRow = summaryRows[0];
    const totalSpentAmount = toFinanceAmount(summaryRow?.totalSpentAmount);
    const salesCount = Number(summaryRow?.salesCount ?? 0);

    return {
      summary: {
        totalSpentAmount,
        salesCount,
        averageTicketAmount: salesCount > 0 ? Number((totalSpentAmount / salesCount).toFixed(2)) : 0,
        lastPurchaseAt: summaryRow?.lastPurchaseAt ?? null,
        currentMonthAmount: toFinanceAmount(currentMonthRows[0]?.totalSpentAmount),
      },
      items: saleRows.map((row) => ({
        saleId: row.id,
        folio: row.folio,
        saleDate: row.createdAt,
        totalAmount: toFinanceAmount(row.totalAmount),
        paidAmount: toFinanceAmount(row.paidAmount),
        discountAmount: toFinanceAmount(row.discountAmount),
        sellerId: row.sellerId ?? null,
        sellerName: row.sellerNameSnapshot ?? null,
        channel: row.channel,
        notes: row.notes ?? null,
        items: itemsBySaleId.get(row.id) ?? [],
        payments: paymentsBySaleId.get(row.id) ?? [],
      })),
      total: Number(totalRows[0]?.total ?? 0),
      page,
      limit,
      filter,
    };
  }

  async linkBranchClientToAppUser(
    branchId: string,
    sourceUserId: string,
    targetUserId: string,
  ): Promise<{
    membershipId: string | null;
    updatedTargetFields: string[];
    transferredCounts: Record<string, number>;
  }> {
    if (sourceUserId === targetUserId) {
      return {
        membershipId: null,
        updatedTargetFields: [],
        transferredCounts: {},
      };
    }

    return db.transaction(async (tx) => {
      const [sourceUser] = await tx.select().from(users).where(eq(users.id, sourceUserId)).limit(1);
      const [targetUser] = await tx.select().from(users).where(eq(users.id, targetUserId)).limit(1);
      const [sourceMembership] = await tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.userId, sourceUserId), eq(memberships.branchId, branchId)))
        .limit(1);
      const [targetMembership] = await tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.userId, targetUserId), eq(memberships.branchId, branchId)))
        .limit(1);

      if (!sourceUser || !targetUser || !sourceMembership) {
        throw new Error("No se pudo vincular el cliente de la sucursal");
      }
      if (targetMembership) {
        throw new Error("El usuario app ya pertenece a esta sucursal");
      }

      const targetUpdates: Record<string, any> = {};
      if ((!targetUser.name || !targetUser.name.trim()) && sourceUser.name?.trim()) {
        targetUpdates.name = sourceUser.name.trim();
      }
      if ((!targetUser.lastName || !targetUser.lastName.trim()) && sourceUser.lastName?.trim()) {
        targetUpdates.lastName = sourceUser.lastName.trim();
      }
      if ((!targetUser.phone || !targetUser.phone.trim()) && sourceUser.phone?.trim()) {
        targetUpdates.phone = sourceUser.phone.trim();
      }
      if ((!targetUser.birthDate || !targetUser.birthDate.trim()) && sourceUser.birthDate?.trim()) {
        targetUpdates.birthDate = sourceUser.birthDate.trim();
      }
      if ((!targetUser.gender || !targetUser.gender.trim()) && sourceUser.gender?.trim()) {
        targetUpdates.gender = sourceUser.gender.trim();
      }
      if ((!targetUser.avatarUrl || !targetUser.avatarUrl.trim()) && sourceUser.avatarUrl?.trim()) {
        targetUpdates.avatarUrl = sourceUser.avatarUrl.trim();
      }

      if (Object.keys(targetUpdates).length > 0) {
        await tx.update(users).set(targetUpdates).where(eq(users.id, targetUserId));
      }

      const [sourceCrm] = await tx
        .select()
        .from(branchClientCrm)
        .where(and(eq(branchClientCrm.branchId, branchId), eq(branchClientCrm.userId, sourceUserId)))
        .limit(1);
      const [targetCrm] = await tx
        .select()
        .from(branchClientCrm)
        .where(and(eq(branchClientCrm.branchId, branchId), eq(branchClientCrm.userId, targetUserId)))
        .limit(1);

      if (sourceCrm && targetCrm) {
        const mergedCrmUpdate: Record<string, any> = {};

        if (!targetCrm.clientStatus && sourceCrm.clientStatus) mergedCrmUpdate.clientStatus = sourceCrm.clientStatus;
        if (!targetCrm.tags && sourceCrm.tags) mergedCrmUpdate.tags = sourceCrm.tags;
        if (!targetCrm.emergencyContactName && sourceCrm.emergencyContactName) mergedCrmUpdate.emergencyContactName = sourceCrm.emergencyContactName;
        if (!targetCrm.emergencyContactPhone && sourceCrm.emergencyContactPhone) mergedCrmUpdate.emergencyContactPhone = sourceCrm.emergencyContactPhone;
        if (!targetCrm.medicalNotes && sourceCrm.medicalNotes) mergedCrmUpdate.medicalNotes = sourceCrm.medicalNotes;
        if (!targetCrm.injuriesNotes && sourceCrm.injuriesNotes) mergedCrmUpdate.injuriesNotes = sourceCrm.injuriesNotes;
        if (!targetCrm.medicalWarnings && sourceCrm.medicalWarnings) mergedCrmUpdate.medicalWarnings = sourceCrm.medicalWarnings;
        if (!targetCrm.parqAccepted && sourceCrm.parqAccepted) mergedCrmUpdate.parqAccepted = true;
        if (!targetCrm.parqAcceptedDate && sourceCrm.parqAcceptedDate) mergedCrmUpdate.parqAcceptedDate = sourceCrm.parqAcceptedDate;
        if (!targetCrm.privateProfileInitialized && sourceCrm.privateProfileInitialized) {
          mergedCrmUpdate.privateProfileInitialized = true;
        }
        if (
          sourceCrm.lastVisit &&
          (!targetCrm.lastVisit || new Date(sourceCrm.lastVisit).getTime() > new Date(targetCrm.lastVisit).getTime())
        ) {
          mergedCrmUpdate.lastVisit = sourceCrm.lastVisit;
        }

        if (Object.keys(mergedCrmUpdate).length > 0) {
          mergedCrmUpdate.updatedAt = new Date();
          await tx.update(branchClientCrm).set(mergedCrmUpdate).where(eq(branchClientCrm.id, targetCrm.id));
        }

        await tx.delete(branchClientCrm).where(eq(branchClientCrm.id, sourceCrm.id));
      } else if (sourceCrm) {
        await tx
          .update(branchClientCrm)
          .set({ userId: targetUserId, updatedAt: new Date() })
          .where(eq(branchClientCrm.id, sourceCrm.id));
      }

      const transferredCounts: Record<string, number> = {};

      const noteRows = await tx
        .update(clientNotes)
        .set({ userId: targetUserId })
        .where(and(eq(clientNotes.branchId, branchId), eq(clientNotes.userId, sourceUserId)))
        .returning({ id: clientNotes.id });
      transferredCounts.clientNotes = noteRows.length;

      const attendanceRows = await tx
        .update(attendances)
        .set({ userId: targetUserId })
        .where(and(eq(attendances.branchId, branchId), eq(attendances.userId, sourceUserId)))
        .returning({ id: attendances.id });
      transferredCounts.attendances = attendanceRows.length;

      const bookingRows = await tx
        .update(classBookings)
        .set({ userId: targetUserId })
        .where(and(eq(classBookings.branchId, branchId), eq(classBookings.userId, sourceUserId)))
        .returning({ id: classBookings.id });
      transferredCounts.classBookings = bookingRows.length;

      const financeRows = await tx
        .update(branchFinanceEntries)
        .set({ clientUserId: targetUserId })
        .where(and(eq(branchFinanceEntries.branchId, branchId), eq(branchFinanceEntries.clientUserId, sourceUserId)))
        .returning({ id: branchFinanceEntries.id });
      transferredCounts.financeEntries = financeRows.length;

      const reviewRows = await tx
        .update(branchReviews)
        .set({ userId: targetUserId })
        .where(and(eq(branchReviews.branchId, branchId), eq(branchReviews.userId, sourceUserId)))
        .returning({ id: branchReviews.id });
      transferredCounts.branchReviews = reviewRows.length;

      const blockRows = await tx
        .update(branchCustomerBlocks)
        .set({ userId: targetUserId })
        .where(and(eq(branchCustomerBlocks.branchId, branchId), eq(branchCustomerBlocks.userId, sourceUserId)))
        .returning({ id: branchCustomerBlocks.id });
      transferredCounts.branchBlocks = blockRows.length;

      const reportRows = await tx
        .update(customerReports)
        .set({ userId: targetUserId })
        .where(and(eq(customerReports.branchId, branchId), eq(customerReports.userId, sourceUserId)))
        .returning({ id: customerReports.id });
      transferredCounts.customerReports = reportRows.length;

      const notificationRows = await tx
        .update(notifications)
        .set({ recipientUserId: targetUserId })
        .where(and(eq(notifications.branchId, branchId), eq(notifications.recipientUserId, sourceUserId)))
        .returning({ id: notifications.id });
      transferredCounts.notifications = notificationRows.length;

      const reservationAuditRows = await tx
        .update(reservationAuditLogs)
        .set({ customerUserId: targetUserId })
        .where(and(eq(reservationAuditLogs.branchId, branchId), eq(reservationAuditLogs.customerUserId, sourceUserId)))
        .returning({ id: reservationAuditLogs.id });
      transferredCounts.reservationAuditLogs = reservationAuditRows.length;

      const systemEventRows = await tx
        .update(systemEvents)
        .set({ userId: targetUserId })
        .where(and(eq(systemEvents.branchId, branchId), eq(systemEvents.userId, sourceUserId)))
        .returning({ id: systemEvents.id });
      transferredCounts.systemEvents = systemEventRows.length;

      const [movedMembership] = await tx
        .update(memberships)
        .set({
          userId: targetUserId,
          status: "active",
          source: "self_join",
        })
        .where(eq(memberships.id, sourceMembership.id))
        .returning();

      return {
        membershipId: movedMembership?.id ?? null,
        updatedTargetFields: Object.keys(targetUpdates),
        transferredCounts,
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
    const [activeMembershipCountRow] = await db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")));
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

    const purchaseHistoryRows = await db
      .select({
        id: branchFinanceEntries.id,
        concept: branchFinanceEntries.concept,
        amount: branchFinanceEntries.amount,
        entryDate: branchFinanceEntries.entryDate,
        paymentMethod: branchFinanceEntries.paymentMethod,
        notes: branchFinanceEntries.notes,
        source: branchFinanceEntries.source,
        metadata: branchFinanceEntries.metadata,
        createdAt: branchFinanceEntries.createdAt,
      })
      .from(branchFinanceEntries)
      .where(and(
        eq(branchFinanceEntries.branchId, branchId),
        eq(branchFinanceEntries.clientUserId, userId),
        eq(branchFinanceEntries.type, "income"),
        eq(branchFinanceEntries.source, "service_sale"),
        isNull(branchFinanceEntries.deletedAt),
      ))
      .orderBy(desc(branchFinanceEntries.entryDate), desc(branchFinanceEntries.createdAt))
      .limit(12);

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
    const shouldUseGlobalPrivateFallback =
      (crmEntry?.privateProfileInitialized ?? false) !== true &&
      (Number(activeMembershipCountRow?.count) || 0) <= 1;

    return {
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        birthDate: user.birthDate,
        gender: user.gender,
        emergencyContactName: shouldUseGlobalPrivateFallback
          ? user.emergencyContactName
          : (crmEntry?.emergencyContactName ?? null),
        emergencyContactPhone: shouldUseGlobalPrivateFallback
          ? user.emergencyContactPhone
          : (crmEntry?.emergencyContactPhone ?? null),
        medicalNotes: shouldUseGlobalPrivateFallback
          ? user.medicalNotes
          : (crmEntry?.medicalNotes ?? null),
        injuriesNotes: shouldUseGlobalPrivateFallback
          ? user.injuriesNotes
          : (crmEntry?.injuriesNotes ?? null),
        medicalWarnings: shouldUseGlobalPrivateFallback
          ? user.medicalWarnings
          : (crmEntry?.medicalWarnings ?? null),
        parqAccepted: shouldUseGlobalPrivateFallback
          ? user.parqAccepted
          : (crmEntry?.parqAccepted ?? false),
        parqAcceptedDate: shouldUseGlobalPrivateFallback
          ? user.parqAcceptedDate
          : (crmEntry?.parqAcceptedDate ?? null),
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
      purchaseHistory: purchaseHistoryRows.map((row) => ({
        id: row.id,
        concept: row.concept,
        amount: toFinanceAmount(row.amount),
        entryDate: row.entryDate,
        paymentMethod: row.paymentMethod ?? null,
        notes: row.notes ?? null,
        source: row.source ?? null,
        metadata: row.metadata ?? null,
        createdAt: row.createdAt,
      })),
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

  async assignPlanToMembership(
    membershipId: string,
    planId: string,
    classesRemaining: number | null,
    classesTotal: number | null,
    expiresAt: Date | null,
    startDate: Date,
  ): Promise<Membership | undefined> {
    const [m] = await db
      .update(memberships)
      .set({
        planId,
        planNameSnapshot: null,
        classesRemaining,
        classesTotal,
        expiresAt,
        membershipStartDate: startDate,
        membershipEndDate: expiresAt,
        paidAt: startDate,
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
      if ((mem?.classesRemaining ?? 0) > 0) {
        await this.decrementClassesRemaining(mem!.id);
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
    void branchId;
    return 0;

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
      if ((mem?.classesRemaining ?? 0) > 0) {
        await this.decrementClassesRemaining(mem!.id);
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
        userPhone: users.phone,
        authProvider: users.authProvider,
        firebaseUid: users.firebaseUid,
        acceptedTerms: users.acceptedTerms,
        source: memberships.source,
        clientStatus: memberships.clientStatus,
        planId: memberships.planId,
        planNameSnapshot: memberships.planNameSnapshot,
        classesRemaining: memberships.classesRemaining,
        classesTotal: memberships.classesTotal,
        expiresAt: memberships.expiresAt,
        membershipPlanName: membershipPlans.name,
      })
      .from(classBookings)
      .innerJoin(users, eq(classBookings.userId, users.id))
      .leftJoin(
        memberships,
        and(
          eq(memberships.userId, classBookings.userId),
          eq(memberships.branchId, classBookings.branchId),
          eq(memberships.status, "active"),
        ),
      )
      .leftJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
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
    return Array.from(byUser.values())
      .map((row) => {
        const identityControl = getBranchClientIdentityControl(
          {
            email: row.userEmail,
            authProvider: row.authProvider,
            firebaseUid: row.firebaseUid,
            acceptedTerms: row.acceptedTerms,
          },
          { source: row.source },
        );
        const clientOriginLabel =
          identityControl.originType === "app"
            ? "Se unió desde la app"
            : identityControl.originType === "counter"
            ? "Cliente de mostrador"
            : "Agregado manualmente";
        const planName = row.membershipPlanName || row.planNameSnapshot || null;
        const hasActivePlan = Boolean(
          row.planId ||
          row.planNameSnapshot ||
          row.membershipPlanName ||
          row.expiresAt ||
          row.classesRemaining !== null ||
          row.classesTotal !== null,
        );

        return {
          id: row.id,
          userId: row.userId,
          status: row.status,
          createdAt: row.createdAt,
          userName: row.userName,
          userEmail: row.userEmail,
          userPhone: row.userPhone,
          clientOrigin: identityControl.originType,
          clientOriginLabel,
          hasActivePlan,
          planName,
          planStatusLabel: hasActivePlan ? (planName || "Con servicio o plan activo") : "Sin servicio o plan",
          clientStatus: row.clientStatus,
          classesRemaining: row.classesRemaining,
          classesTotal: row.classesTotal,
          expiresAt: row.expiresAt,
        };
      })
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }

  async createBooking(data: InsertClassBooking): Promise<ClassBooking> {
    const [booking] = await db.insert(classBookings).values(data).returning();
    await this.touchBranchClientLastVisit(data.branchId, data.userId);
    return booking;
  }

  async createBookingAtomically(params: {
    classScheduleId: string;
    branchId: string;
    userId: string;
    bookingDate: string;
    source: InsertClassBooking["source"];
    requireActiveSchedule?: boolean;
    excludeNoShowFromCapacity?: boolean;
  }): Promise<{ booking?: ClassBooking; error?: "CLASS_NOT_FOUND" | "CLASS_FULL" | "ALREADY_BOOKED" }> {
    const result = await db.transaction(async (tx) => {
      const scheduleResult = await tx.execute(sql<{
        id: string;
        branchId: string;
        capacity: number;
        isActive: boolean;
      }>`
        SELECT
          id,
          branch_id AS "branchId",
          capacity,
          is_active AS "isActive"
        FROM class_schedules
        WHERE id = ${params.classScheduleId}
        FOR UPDATE
      `);

      const schedule = scheduleResult.rows[0];
      if (!schedule || schedule.branchId !== params.branchId || (params.requireActiveSchedule && !schedule.isActive)) {
        return { error: "CLASS_NOT_FOUND" as const };
      }

      const existingBookings = await tx
        .select({
          id: classBookings.id,
          userId: classBookings.userId,
          status: classBookings.status,
        })
        .from(classBookings)
        .where(and(
          eq(classBookings.classScheduleId, params.classScheduleId),
          eq(classBookings.bookingDate, params.bookingDate),
        ));

      const activeBookings = existingBookings.filter((booking) => {
        if (params.excludeNoShowFromCapacity) {
          return booking.status !== "cancelled" && booking.status !== "no_show";
        }
        return booking.status !== "cancelled";
      });

      if (activeBookings.some((booking) => booking.userId === params.userId)) {
        return { error: "ALREADY_BOOKED" as const };
      }

      if (activeBookings.length >= Number(schedule.capacity || 0)) {
        return { error: "CLASS_FULL" as const };
      }

      const [booking] = await tx
        .insert(classBookings)
        .values({
          classScheduleId: params.classScheduleId,
          branchId: params.branchId,
          userId: params.userId,
          bookingDate: params.bookingDate,
          status: "confirmed",
          source: params.source,
        })
        .returning();

      return { booking };
    });

    if (result.booking) {
      await this.touchBranchClientLastVisit(params.branchId, params.userId);
    }

    return result;
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

  async createReservationAuditLog(data: InsertReservationAuditLog): Promise<ReservationAuditLog> {
    const [log] = await db
      .insert(reservationAuditLogs)
      .values({
        bookingId: data.bookingId,
        branchId: data.branchId,
        customerUserId: data.customerUserId,
        actorUserId: data.actorUserId ?? null,
        actorRole: data.actorRole,
        action: data.action,
        reason: data.reason ?? null,
        source: data.source ?? "system",
        metadata: data.metadata ?? null,
      })
      .returning();

    return log;
  }

  async getReservationAuditLogs(filters?: { branchId?: string; limit?: number }): Promise<ReservationAuditRow[]> {
    const conditions: any[] = [];
    if (filters?.branchId) {
      conditions.push(eq(reservationAuditLogs.branchId, filters.branchId));
    }

    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);

    const results = await db
      .select({
        id: reservationAuditLogs.id,
        bookingId: reservationAuditLogs.bookingId,
        branchId: reservationAuditLogs.branchId,
        customerUserId: reservationAuditLogs.customerUserId,
        actorUserId: reservationAuditLogs.actorUserId,
        actorRole: reservationAuditLogs.actorRole,
        action: reservationAuditLogs.action,
        reason: reservationAuditLogs.reason,
        source: reservationAuditLogs.source,
        metadata: reservationAuditLogs.metadata,
        createdAt: reservationAuditLogs.createdAt,
        customerName: sql<string | null>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${reservationAuditLogs.customerUserId} LIMIT 1)`,
        customerLastName: sql<string | null>`(SELECT ${users.lastName} FROM ${users} WHERE ${users.id} = ${reservationAuditLogs.customerUserId} LIMIT 1)`,
        actorName: sql<string | null>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${reservationAuditLogs.actorUserId} LIMIT 1)`,
        actorEmail: sql<string | null>`(SELECT ${users.email} FROM ${users} WHERE ${users.id} = ${reservationAuditLogs.actorUserId} LIMIT 1)`,
        className: classSchedules.name,
        bookingDate: classBookings.bookingDate,
        bookingStatus: classBookings.status,
      })
      .from(reservationAuditLogs)
      .leftJoin(classBookings, eq(reservationAuditLogs.bookingId, classBookings.id))
      .leftJoin(classSchedules, eq(classBookings.classScheduleId, classSchedules.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reservationAuditLogs.createdAt))
      .limit(limit);

    return results as ReservationAuditRow[];
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

  private mapBranchCommercialProductRow(row: BranchCommercialProduct): BranchCommercialProductRow {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      category: row.category,
      description: row.description ?? null,
      photoUrl: row.photoUrl ?? null,
      sku: row.sku ?? null,
      barcode: row.barcode ?? null,
      costAmount: toFinanceAmount(row.costAmount),
      salePriceAmount: toFinanceAmount(row.salePriceAmount),
      isActive: row.isActive,
      isPublicVisible: row.isPublicVisible,
      usesInventory: row.usesInventory,
      displayOrder: row.displayOrder,
      inventoryQuantityOnHand: null,
      inventoryMinimumStock: null,
      inventoryStatus: row.usesInventory ? "uninitialized" : "not_tracked",
      inventoryUpdatedAt: null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapBranchSalespersonRow(row: BranchSalesperson): BranchSalespersonRow {
    return {
      id: row.id,
      branchId: row.branchId,
      userId: row.userId ?? null,
      name: row.name,
      lastName: row.lastName ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      employeeCode: row.employeeCode ?? null,
      roleLabel: row.roleLabel ?? null,
      monthlyGoalAmount: row.monthlyGoalAmount == null ? null : toFinanceAmount(row.monthlyGoalAmount),
      isActive: row.isActive,
      notes: row.notes ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
    };
  }

  private mapBranchSaleItemRow(row: BranchSaleItem): BranchSaleItemRow {
    return {
      id: row.id,
      saleId: row.saleId,
      branchId: row.branchId,
      itemType: row.itemType,
      commercialProductId: row.commercialProductId ?? null,
      serviceId: row.serviceId ?? null,
      planId: row.planId ?? null,
      nameSnapshot: row.nameSnapshot,
      categorySnapshot: row.categorySnapshot ?? null,
      quantity: row.quantity,
      unitPriceAmount: toFinanceAmount(row.unitPriceAmount),
      discountAmount: toFinanceAmount(row.discountAmount),
      costAmountSnapshot: toFinanceAmount(row.costAmountSnapshot),
      lineTotalAmount: toFinanceAmount(row.lineTotalAmount),
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
    };
  }

  private mapBranchSalePaymentRow(row: BranchSalePayment): BranchSalePaymentRow {
    return {
      id: row.id,
      saleId: row.saleId,
      branchId: row.branchId,
      paymentMethod: row.paymentMethod,
      amount: toFinanceAmount(row.amount),
      reference: row.reference ?? null,
      paidAt: row.paidAt,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
    };
  }

  private mapBranchCommissionRuleRow(row: BranchCommissionRule): BranchCommissionRuleRow {
    return {
      id: row.id,
      branchId: row.branchId,
      salespersonId: row.salespersonId,
      name: row.name,
      ruleType: row.ruleType,
      percentageRate: row.percentageRate == null ? null : Number(row.percentageRate),
      fixedAmount: row.fixedAmount == null ? null : toFinanceAmount(row.fixedAmount),
      commercialProductId: row.commercialProductId ?? null,
      category: row.category ?? null,
      minimumGoalAmount: row.minimumGoalAmount == null ? null : toFinanceAmount(row.minimumGoalAmount),
      bonusAmount: row.bonusAmount == null ? null : toFinanceAmount(row.bonusAmount),
      priority: row.priority,
      isActive: row.isActive,
      validFrom: row.validFrom ?? null,
      validUntil: row.validUntil ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
    };
  }

  private mapBranchCommissionAccrualRow(row: BranchCommissionAccrual): BranchCommissionAccrualRow {
    return {
      id: row.id,
      branchId: row.branchId,
      salespersonId: row.salespersonId,
      saleId: row.saleId ?? null,
      saleItemId: row.saleItemId ?? null,
      commissionRuleId: row.commissionRuleId ?? null,
      accrualType: row.accrualType,
      referenceKey: row.referenceKey,
      periodMonth: row.periodMonth ?? null,
      status: row.status,
      baseAmount: toFinanceAmount(row.baseAmount),
      rateSnapshot: row.rateSnapshot == null ? null : Number(row.rateSnapshot),
      fixedAmountSnapshot: row.fixedAmountSnapshot == null ? null : toFinanceAmount(row.fixedAmountSnapshot),
      commissionAmount: toFinanceAmount(row.commissionAmount),
      salespersonNameSnapshot: row.salespersonNameSnapshot,
      ruleNameSnapshot: row.ruleNameSnapshot ?? null,
      calculationSnapshot: row.calculationSnapshot ?? null,
      accruedAt: row.accruedAt,
      approvedAt: row.approvedAt ?? null,
      paidAmount: toFinanceAmount(row.paidAmount),
      reversedAt: row.reversedAt ?? null,
      reversalReason: row.reversalReason ?? null,
      createdAt: row.createdAt,
    };
  }

  private mapBranchCommissionPaymentAllocationRow(row: BranchCommissionPaymentAllocation): BranchCommissionPaymentAllocationRow {
    return {
      id: row.id,
      branchId: row.branchId,
      commissionPaymentId: row.commissionPaymentId,
      commissionAccrualId: row.commissionAccrualId,
      amountAllocated: toFinanceAmount(row.amountAllocated),
      createdAt: row.createdAt,
    };
  }

  private mapBranchCommissionPaymentRow(
    row: BranchCommissionPayment,
    allocations: BranchCommissionPaymentAllocationRow[] = [],
  ): BranchCommissionPaymentRow {
    return {
      id: row.id,
      branchId: row.branchId,
      salespersonId: row.salespersonId,
      amount: toFinanceAmount(row.amount),
      paymentMethod: row.paymentMethod,
      reference: row.reference ?? null,
      notes: row.notes ?? null,
      periodStart: row.periodStart ?? null,
      periodEnd: row.periodEnd ?? null,
      paidAt: row.paidAt,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      allocations,
    };
  }

  private mapBranchInventoryBalanceRow(
    row: BranchInventoryBalance,
    usesInventory = true,
  ): BranchInventoryBalanceRow {
    const quantityOnHand = row.quantityOnHand;
    const minimumStock = row.minimumStock;
    return {
      id: row.id,
      branchId: row.branchId,
      commercialProductId: row.commercialProductId,
      quantityOnHand,
      minimumStock,
      status: computeInventoryStatus(usesInventory, { quantityOnHand, minimumStock }),
      updatedBy: row.updatedBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapBranchInventoryMovementRow(row: BranchInventoryMovement): BranchInventoryMovementRow {
    return {
      id: row.id,
      branchId: row.branchId,
      commercialProductId: row.commercialProductId,
      movementType: row.movementType,
      quantityDelta: row.quantityDelta,
      quantityBefore: row.quantityBefore,
      quantityAfter: row.quantityAfter,
      unitCostSnapshot: row.unitCostSnapshot == null ? null : toFinanceAmount(row.unitCostSnapshot),
      reason: row.reason,
      notes: row.notes ?? null,
      saleId: row.saleId ?? null,
      saleItemId: row.saleItemId ?? null,
      purchaseId: row.purchaseId ?? null,
      purchaseItemId: row.purchaseItemId ?? null,
      createdBy: row.createdBy ?? null,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
    };
  }

  private mapBranchSupplierRow(row: BranchSupplier): BranchSupplierRow {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      contactName: row.contactName ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      taxId: row.taxId ?? null,
      address: row.address ?? null,
      paymentTerms: row.paymentTerms ?? null,
      notes: row.notes ?? null,
      isActive: row.isActive,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
    };
  }

  private mapBranchPurchaseItemRow(row: BranchPurchaseItem): BranchPurchaseItemRow {
    return {
      id: row.id,
      purchaseId: row.purchaseId,
      branchId: row.branchId,
      commercialProductId: row.commercialProductId ?? null,
      nameSnapshot: row.nameSnapshot,
      skuSnapshot: row.skuSnapshot ?? null,
      quantityOrdered: row.quantityOrdered,
      quantityReceived: row.quantityReceived,
      unitCost: toFinanceAmount(row.unitCost),
      lineTotal: toFinanceAmount(row.lineTotal),
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
    };
  }

  private mapBranchPurchaseRow(row: {
    id: string;
    branchId: string;
    projectId: string | null;
    projectCode: string | null;
    projectName: string | null;
    folio: string;
    supplierId: string | null;
    supplierName: string | null;
    status: string;
    purchaseDate: string | Date;
    expectedDate: string | Date | null;
    receivedAt: Date | null;
    paymentStatus: string;
    paymentMethod: string | null;
    subtotalAmount: unknown;
    discountAmount: unknown;
    taxMode: string | null;
    taxRate: unknown;
    subtotalBeforeTax: unknown;
    taxableSubtotal: unknown;
    taxTotal: unknown;
    grandTotal: unknown;
    totalAmount: unknown;
    paidAmount: unknown;
    reference: string | null;
    notes: string | null;
    createdBy: string | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    totalItems?: number;
    totalUnitsOrdered?: number;
    totalUnitsReceived?: number;
  }): BranchPurchaseRow {
    return {
      id: row.id,
      branchId: row.branchId,
      projectId: row.projectId ?? null,
      projectCode: row.projectCode ?? null,
      projectName: row.projectName ?? null,
      folio: row.folio,
      supplierId: row.supplierId ?? null,
      supplierName: row.supplierName ?? null,
      status: row.status as BranchPurchaseRow["status"],
      purchaseDate: typeof row.purchaseDate === "string" ? row.purchaseDate : row.purchaseDate.toISOString().slice(0, 10),
      expectedDate: row.expectedDate == null
        ? null
        : typeof row.expectedDate === "string"
          ? row.expectedDate
          : row.expectedDate.toISOString().slice(0, 10),
      receivedAt: row.receivedAt ?? null,
      paymentStatus: row.paymentStatus as BranchPurchaseRow["paymentStatus"],
      paymentMethod: row.paymentMethod ?? null,
      subtotalAmount: toFinanceAmount(row.subtotalAmount),
      discountAmount: toFinanceAmount(row.discountAmount),
      taxMode: row.taxMode ?? null,
      taxRate: row.taxRate == null ? null : toFinanceAmount(row.taxRate),
      subtotalBeforeTax: row.subtotalBeforeTax == null ? null : toFinanceAmount(row.subtotalBeforeTax),
      taxableSubtotal: row.taxableSubtotal == null ? null : toFinanceAmount(row.taxableSubtotal),
      taxTotal: row.taxTotal == null ? null : toFinanceAmount(row.taxTotal),
      grandTotal: row.grandTotal == null ? null : toFinanceAmount(row.grandTotal),
      totalAmount: toFinanceAmount(row.totalAmount),
      paidAmount: toFinanceAmount(row.paidAmount),
      reference: row.reference ?? null,
      notes: row.notes ?? null,
      createdBy: row.createdBy ?? null,
      cancelledAt: row.cancelledAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      totalItems: Number(row.totalItems ?? 0),
      totalUnitsOrdered: Number(row.totalUnitsOrdered ?? 0),
      totalUnitsReceived: Number(row.totalUnitsReceived ?? 0),
    };
  }

  private async getLockedBranchInventoryBalance(
    tx: any,
    branchId: string,
    commercialProductId: string,
  ): Promise<BranchInventoryBalance | null> {
    const result = await tx.execute(sql`
      SELECT *
      FROM branch_inventory_balances
      WHERE branch_id = ${branchId}
        AND commercial_product_id = ${commercialProductId}
      FOR UPDATE
    `);

    const row = (result as any)?.rows?.[0] ?? null;
    if (!row) return null;

    return {
      id: row.id,
      branchId: row.branch_id,
      commercialProductId: row.commercial_product_id,
      quantityOnHand: Number(row.quantity_on_hand ?? 0),
      minimumStock: Number(row.minimum_stock ?? 0),
      updatedBy: row.updated_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as BranchInventoryBalance;
  }

  private async getLockedBranchPurchase(
    tx: any,
    branchId: string,
    purchaseId: string,
  ): Promise<BranchPurchase | null> {
    const result = await tx.execute(sql`
      SELECT *
      FROM branch_purchases
      WHERE branch_id = ${branchId}
        AND id = ${purchaseId}
      FOR UPDATE
    `);

    const row = (result as any)?.rows?.[0] ?? null;
    if (!row) return null;

    return {
      id: row.id,
      branchId: row.branch_id,
      projectId: row.project_id ?? null,
      folio: row.folio,
      supplierId: row.supplier_id ?? null,
      status: row.status,
      purchaseDate: row.purchase_date,
      expectedDate: row.expected_date ?? null,
      receivedAt: row.received_at ?? null,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method ?? null,
      subtotalAmount: String(row.subtotal_amount ?? 0),
      discountAmount: String(row.discount_amount ?? 0),
      taxMode: row.tax_mode ?? null,
      taxRate: row.tax_rate == null ? null : String(row.tax_rate),
      subtotalBeforeTax: row.subtotal_before_tax == null ? null : String(row.subtotal_before_tax),
      taxableSubtotal: row.taxable_subtotal == null ? null : String(row.taxable_subtotal),
      taxTotal: row.tax_total == null ? null : String(row.tax_total),
      grandTotal: row.grand_total == null ? null : String(row.grand_total),
      totalAmount: String(row.total_amount ?? 0),
      paidAmount: String(row.paid_amount ?? 0),
      reference: row.reference ?? null,
      notes: row.notes ?? null,
      createdBy: row.created_by ?? null,
      cancelledAt: row.cancelled_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as BranchPurchase;
  }

  private async lockBranchCommissionAccrualIdsTx(
    tx: any,
    branchId: string,
    accrualIds: string[],
  ): Promise<void> {
    if (!accrualIds.length) return;

    const accrualIdList = sql.join(accrualIds.map((accrualId) => sql`${accrualId}`), sql`, `);
    await tx.execute(sql`
      SELECT id
      FROM branch_commission_accruals
      WHERE branch_id = ${branchId}
        AND id IN (${accrualIdList})
      FOR UPDATE
    `);
  }

  private async insertBranchInventoryMovementTx(
    tx: any,
    data: InsertBranchInventoryMovement,
  ): Promise<BranchInventoryMovementRow> {
    const [created] = await tx
      .insert(branchInventoryMovements)
      .values({
        ...data,
        unitCostSnapshot: data.unitCostSnapshot == null ? null : String(toFinanceAmount(data.unitCostSnapshot)),
      } as any)
      .returning();

    return this.mapBranchInventoryMovementRow(created);
  }

  private async getBranchSaleById(branchId: string, saleId: string): Promise<BranchSaleRow | undefined> {
    const [sale] = await db
      .select({
        id: branchSales.id,
        branchId: branchSales.branchId,
        projectId: branchSales.projectId,
        projectCode: branchCommercialProjects.code,
        projectName: branchCommercialProjects.name,
        folio: branchSales.folio,
        clientUserId: branchSales.clientUserId,
        sellerUserId: branchSales.sellerUserId,
        sellerId: branchSales.sellerId,
        sellerNameSnapshot: branchSales.sellerNameSnapshot,
        sellerMetadata: branchSales.sellerMetadata,
        channel: branchSales.channel,
        status: branchSales.status,
        subtotalAmount: branchSales.subtotalAmount,
        discountAmount: branchSales.discountAmount,
        totalAmount: branchSales.totalAmount,
        paidAmount: branchSales.paidAmount,
        taxMode: branchSales.taxMode,
        taxRate: branchSales.taxRate,
        subtotalBeforeTax: branchSales.subtotalBeforeTax,
        taxableSubtotal: branchSales.taxableSubtotal,
        taxTotal: branchSales.taxTotal,
        grandTotal: branchSales.grandTotal,
        notes: branchSales.notes,
        createdBy: branchSales.createdBy,
        cancelledAt: branchSales.cancelledAt,
        cancelledByUserId: branchSales.cancelledByUserId,
        cancellationReason: branchSales.cancellationReason,
        createdAt: branchSales.createdAt,
        updatedAt: branchSales.updatedAt,
        clientName: users.name,
        clientLastName: users.lastName,
        clientEmail: users.email,
      })
      .from(branchSales)
      .leftJoin(branchCommercialProjects, and(
        eq(branchSales.projectId, branchCommercialProjects.id),
        eq(branchSales.branchId, branchCommercialProjects.branchId),
      ))
      .leftJoin(users, eq(branchSales.clientUserId, users.id))
      .where(and(
        eq(branchSales.id, saleId),
        eq(branchSales.branchId, branchId),
      ))
      .limit(1);

    if (!sale) return undefined;

    const [itemRows, paymentRows] = await Promise.all([
      db
        .select()
        .from(branchSaleItems)
        .where(eq(branchSaleItems.saleId, saleId))
        .orderBy(asc(branchSaleItems.createdAt)),
      db
        .select()
        .from(branchSalePayments)
        .where(eq(branchSalePayments.saleId, saleId))
        .orderBy(asc(branchSalePayments.createdAt)),
    ]);

    const clientDisplayName = [sale.clientName, sale.clientLastName].filter(Boolean).join(" ").trim() || null;

    return {
      id: sale.id,
      branchId: sale.branchId,
      projectId: sale.projectId ?? null,
      projectCode: sale.projectCode ?? null,
      projectName: sale.projectName ?? null,
      folio: sale.folio,
      clientUserId: sale.clientUserId ?? null,
      clientDisplayName,
      clientEmail: sale.clientEmail ?? null,
      sellerId: sale.sellerId ?? null,
      sellerUserId: sale.sellerUserId ?? null,
      sellerNameSnapshot: sale.sellerNameSnapshot ?? null,
      sellerMetadata: sale.sellerMetadata ?? null,
      channel: sale.channel,
      status: sale.status,
      subtotalAmount: toFinanceAmount(sale.subtotalAmount),
      discountAmount: toFinanceAmount(sale.discountAmount),
      totalAmount: toFinanceAmount(sale.totalAmount),
      paidAmount: toFinanceAmount(sale.paidAmount),
      taxMode: sale.taxMode ?? null,
      taxRate: sale.taxRate == null ? null : toFinanceAmount(sale.taxRate),
      subtotalBeforeTax: sale.subtotalBeforeTax == null ? null : toFinanceAmount(sale.subtotalBeforeTax),
      taxableSubtotal: sale.taxableSubtotal == null ? null : toFinanceAmount(sale.taxableSubtotal),
      taxTotal: sale.taxTotal == null ? null : toFinanceAmount(sale.taxTotal),
      grandTotal: sale.grandTotal == null ? null : toFinanceAmount(sale.grandTotal),
      notes: sale.notes ?? null,
      createdBy: sale.createdBy ?? null,
      cancelledAt: sale.cancelledAt ?? null,
      cancelledByUserId: sale.cancelledByUserId ?? null,
      cancellationReason: sale.cancellationReason ?? null,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      items: itemRows.map((row) => this.mapBranchSaleItemRow(row)),
      payments: paymentRows.map((row) => this.mapBranchSalePaymentRow(row)),
    };
  }

  private async getBranchSaleByIdempotencyKey(
    branchId: string,
    idempotencyKey: string,
  ): Promise<BranchSaleRow | undefined> {
    const [sale] = await db
      .select({ id: branchSales.id })
      .from(branchSales)
      .where(and(
        eq(branchSales.branchId, branchId),
        eq(branchSales.idempotencyKey, idempotencyKey),
      ))
      .limit(1);

    if (!sale) return undefined;
    return this.getBranchSaleById(branchId, sale.id);
  }

  private async getBranchSaleByCancellationIdempotencyKey(
    branchId: string,
    idempotencyKey: string,
  ): Promise<BranchSaleRow | undefined> {
    const [sale] = await db
      .select({ id: branchSales.id })
      .from(branchSales)
      .where(and(
        eq(branchSales.branchId, branchId),
        eq(branchSales.cancellationIdempotencyKey, idempotencyKey),
      ))
      .limit(1);

    if (!sale) return undefined;
    return this.getBranchSaleById(branchId, sale.id);
  }

  private async getBranchCommissionPaymentByIdempotencyKey(
    branchId: string,
    idempotencyKey: string,
  ): Promise<BranchCommissionPaymentRow | undefined> {
    const [paymentRow] = await db
      .select()
      .from(branchCommissionPayments)
      .where(and(
        eq(branchCommissionPayments.branchId, branchId),
        eq(branchCommissionPayments.idempotencyKey, idempotencyKey),
      ))
      .limit(1);

    if (!paymentRow) return undefined;

    const allocationRows = await db
      .select()
      .from(branchCommissionPaymentAllocations)
      .where(and(
        eq(branchCommissionPaymentAllocations.branchId, branchId),
        eq(branchCommissionPaymentAllocations.commissionPaymentId, paymentRow.id),
      ));

    return this.mapBranchCommissionPaymentRow(
      paymentRow,
      allocationRows.map((row) => this.mapBranchCommissionPaymentAllocationRow(row)),
    );
  }

  private buildBranchSaleFinanceConcept(
    sale: { folio: string },
    items: Array<{ nameSnapshot: string; quantity: number }>,
    sellerNameSnapshot?: string | null,
  ) {
    const summary = items
      .slice(0, 3)
      .map((item) => `${item.quantity} x ${item.nameSnapshot}`)
      .join(", ");
    const suffix = items.length > 3 ? " +" : "";
    const sellerLabel = sellerNameSnapshot ? ` · Vendedor ${sellerNameSnapshot}` : "";
    return summary ? `Venta ${sale.folio} · ${summary}${suffix}${sellerLabel}` : `Venta ${sale.folio}${sellerLabel}`;
  }

  private createEmptyCommercialProjectSummary(): BranchCommercialProjectSummaryRow {
    return {
      linkedSalesCount: 0,
      linkedPurchasesCount: 0,
      linkedDraftPurchasesCount: 0,
      revenueBeforeTax: 0,
      revenueHistoricalWithoutBreakdown: 0,
      taxCollected: 0,
      revenueGrossTotal: 0,
      cashCollectedTotal: 0,
      purchaseCommittedBeforeTax: 0,
      purchaseCommittedHistoricalWithoutBreakdown: 0,
      purchaseReceivedBeforeTax: 0,
      purchaseReceivedHistoricalWithoutBreakdown: 0,
      purchasePaidTotal: 0,
      committedProfitEstimate: 0,
      receivedProfitEstimate: 0,
      cashFlowNet: 0,
      marginPercent: null,
    };
  }

  private finalizeCommercialProjectSummary(summary: BranchCommercialProjectSummaryRow): BranchCommercialProjectSummaryRow {
    const committedProfitEstimate = roundMoney(summary.revenueBeforeTax - summary.purchaseCommittedBeforeTax);
    const receivedProfitEstimate = roundMoney(summary.revenueBeforeTax - summary.purchaseReceivedBeforeTax);
    const cashFlowNet = roundMoney(summary.cashCollectedTotal - summary.purchasePaidTotal);
    const marginPercent = summary.revenueBeforeTax > 0
      ? roundMoney((committedProfitEstimate / summary.revenueBeforeTax) * 100)
      : null;

    return {
      ...summary,
      revenueBeforeTax: roundMoney(summary.revenueBeforeTax),
      revenueHistoricalWithoutBreakdown: roundMoney(summary.revenueHistoricalWithoutBreakdown),
      taxCollected: roundMoney(summary.taxCollected),
      revenueGrossTotal: roundMoney(summary.revenueGrossTotal),
      cashCollectedTotal: roundMoney(summary.cashCollectedTotal),
      purchaseCommittedBeforeTax: roundMoney(summary.purchaseCommittedBeforeTax),
      purchaseCommittedHistoricalWithoutBreakdown: roundMoney(summary.purchaseCommittedHistoricalWithoutBreakdown),
      purchaseReceivedBeforeTax: roundMoney(summary.purchaseReceivedBeforeTax),
      purchaseReceivedHistoricalWithoutBreakdown: roundMoney(summary.purchaseReceivedHistoricalWithoutBreakdown),
      purchasePaidTotal: roundMoney(summary.purchasePaidTotal),
      committedProfitEstimate,
      receivedProfitEstimate,
      cashFlowNet,
      marginPercent,
    };
  }

  private mapBranchCommercialProjectRow(row: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    description: string | null;
    customerUserId: string | null;
    customerName?: string | null;
    customerLastName?: string | null;
    status: string;
    startDate: string | Date;
    expectedEndDate: string | Date | null;
    completedAt: Date | string | null;
    notes: string | null;
    createdByUserId: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    deletedAt: Date | string | null;
  }, summary?: BranchCommercialProjectSummaryRow): BranchCommercialProjectRow {
    const customerDisplayName = [row.customerName, row.customerLastName].filter(Boolean).join(" ").trim() || null;

    return {
      id: row.id,
      branchId: row.branchId,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      customerUserId: row.customerUserId ?? null,
      customerDisplayName,
      status: row.status as BranchCommercialProjectRow["status"],
      startDate: typeof row.startDate === "string" ? row.startDate : row.startDate.toISOString().slice(0, 10),
      expectedEndDate: row.expectedEndDate == null
        ? null
        : typeof row.expectedEndDate === "string"
          ? row.expectedEndDate
          : row.expectedEndDate.toISOString().slice(0, 10),
      completedAt: row.completedAt ?? null,
      notes: row.notes ?? null,
      createdByUserId: row.createdByUserId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
      summary: summary ?? this.createEmptyCommercialProjectSummary(),
    };
  }

  private computeCommercialProjectSummaryFromLists(
    sales: BranchCommercialProjectLinkedSaleRow[],
    purchases: BranchCommercialProjectLinkedPurchaseRow[],
  ): BranchCommercialProjectSummaryRow {
    const summary = this.createEmptyCommercialProjectSummary();
    summary.linkedSalesCount = sales.length;
    summary.linkedPurchasesCount = purchases.filter((purchase) => purchase.status !== "cancelled").length;
    summary.linkedDraftPurchasesCount = purchases.filter((purchase) => purchase.status === "draft").length;

    for (const sale of sales) {
      const isActiveSale = sale.status === "completed" && !sale.cancelledAt;
      if (!isActiveSale) continue;
      const hasBreakdown = hasStoredCommercialTaxBreakdown(sale);
      if (hasBreakdown) {
        summary.revenueBeforeTax += sale.taxableSubtotal ?? sale.totalAmount;
        summary.taxCollected += sale.taxTotal ?? 0;
      } else {
        summary.revenueHistoricalWithoutBreakdown += sale.totalAmount;
      }
      summary.revenueGrossTotal += hasBreakdown ? (sale.grandTotal ?? sale.totalAmount) : sale.totalAmount;
      summary.cashCollectedTotal += sale.paidAmount;
    }

    for (const purchase of purchases) {
      const countsForCommittedCost = purchase.status === "ordered" || purchase.status === "partially_received" || purchase.status === "received";
      const countsForReceivedCost = purchase.status === "partially_received" || purchase.status === "received";
      const countsForCash = purchase.status !== "cancelled";
      const hasBreakdown = hasStoredCommercialTaxBreakdown(purchase);
      if (countsForCommittedCost && !purchase.cancelledAt) {
        if (hasBreakdown) {
          summary.purchaseCommittedBeforeTax += purchase.taxableSubtotal ?? purchase.totalAmount;
        } else {
          summary.purchaseCommittedHistoricalWithoutBreakdown += purchase.totalAmount;
        }
      }
      if (countsForReceivedCost && !purchase.cancelledAt) {
        if (hasBreakdown) {
          summary.purchaseReceivedBeforeTax += purchase.taxableSubtotal ?? purchase.totalAmount;
        } else {
          summary.purchaseReceivedHistoricalWithoutBreakdown += purchase.totalAmount;
        }
      }
      if (countsForCash && !purchase.cancelledAt) {
        summary.purchasePaidTotal += purchase.paidAmount;
      }
    }

    return this.finalizeCommercialProjectSummary(summary);
  }

  private async getBranchCommercialProjectSummaryMap(
    branchId: string,
    projectIds: string[],
  ): Promise<Map<string, BranchCommercialProjectSummaryRow>> {
    const summaryMap = new Map<string, BranchCommercialProjectSummaryRow>();
    if (!projectIds.length) return summaryMap;

    for (const projectId of projectIds) {
      summaryMap.set(projectId, this.createEmptyCommercialProjectSummary());
    }

    const [salesRows, purchaseRows] = await Promise.all([
      db
        .select({
          projectId: branchSales.projectId,
          linkedSalesCount: sql<number>`COUNT(*)`.as("linked_sales_count"),
          revenueBeforeTax: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchSales.status} = 'completed'
              AND ${branchSales.cancelledAt} IS NULL
              AND (
                ${branchSales.taxMode} IS NOT NULL
                OR ${branchSales.subtotalBeforeTax} IS NOT NULL
                OR ${branchSales.taxableSubtotal} IS NOT NULL
                OR ${branchSales.taxTotal} IS NOT NULL
                OR ${branchSales.grandTotal} IS NOT NULL
              )
            THEN COALESCE(${branchSales.taxableSubtotal}, ${branchSales.totalAmount})
            ELSE 0
          END), 0)`.as("revenue_before_tax"),
          revenueHistoricalWithoutBreakdown: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchSales.status} = 'completed'
              AND ${branchSales.cancelledAt} IS NULL
              AND NOT (
                ${branchSales.taxMode} IS NOT NULL
                OR ${branchSales.subtotalBeforeTax} IS NOT NULL
                OR ${branchSales.taxableSubtotal} IS NOT NULL
                OR ${branchSales.taxTotal} IS NOT NULL
                OR ${branchSales.grandTotal} IS NOT NULL
              )
            THEN COALESCE(${branchSales.totalAmount}, 0)
            ELSE 0
          END), 0)`.as("revenue_historical_without_breakdown"),
          taxCollected: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchSales.status} = 'completed'
              AND ${branchSales.cancelledAt} IS NULL
              AND (
                ${branchSales.taxMode} IS NOT NULL
                OR ${branchSales.subtotalBeforeTax} IS NOT NULL
                OR ${branchSales.taxableSubtotal} IS NOT NULL
                OR ${branchSales.taxTotal} IS NOT NULL
                OR ${branchSales.grandTotal} IS NOT NULL
              )
            THEN COALESCE(${branchSales.taxTotal}, 0)
            ELSE 0
          END), 0)`.as("tax_collected"),
          revenueGrossTotal: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchSales.status} = 'completed' AND ${branchSales.cancelledAt} IS NULL
            THEN COALESCE(${branchSales.grandTotal}, ${branchSales.totalAmount})
            ELSE 0
          END), 0)`.as("revenue_gross_total"),
          cashCollectedTotal: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchSales.status} = 'completed' AND ${branchSales.cancelledAt} IS NULL
            THEN COALESCE(${branchSales.paidAmount}, 0)
            ELSE 0
          END), 0)`.as("cash_collected_total"),
        })
        .from(branchSales)
        .where(and(
          eq(branchSales.branchId, branchId),
          inArray(branchSales.projectId, projectIds),
        ))
        .groupBy(branchSales.projectId),
      db
        .select({
          projectId: branchPurchases.projectId,
          linkedPurchasesCount: sql<number>`COUNT(*) FILTER (WHERE ${branchPurchases.status} <> 'cancelled')`.as("linked_purchases_count"),
          linkedDraftPurchasesCount: sql<number>`COUNT(*) FILTER (WHERE ${branchPurchases.status} = 'draft')`.as("linked_draft_purchases_count"),
          purchaseCommittedBeforeTax: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchPurchases.status} IN ('ordered', 'partially_received', 'received')
              AND ${branchPurchases.cancelledAt} IS NULL
              AND (
                ${branchPurchases.taxMode} IS NOT NULL
                OR ${branchPurchases.subtotalBeforeTax} IS NOT NULL
                OR ${branchPurchases.taxableSubtotal} IS NOT NULL
                OR ${branchPurchases.taxTotal} IS NOT NULL
                OR ${branchPurchases.grandTotal} IS NOT NULL
              )
            THEN COALESCE(${branchPurchases.taxableSubtotal}, ${branchPurchases.totalAmount})
            ELSE 0
          END), 0)`.as("purchase_committed_before_tax"),
          purchaseCommittedHistoricalWithoutBreakdown: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchPurchases.status} IN ('ordered', 'partially_received', 'received')
              AND ${branchPurchases.cancelledAt} IS NULL
              AND NOT (
                ${branchPurchases.taxMode} IS NOT NULL
                OR ${branchPurchases.subtotalBeforeTax} IS NOT NULL
                OR ${branchPurchases.taxableSubtotal} IS NOT NULL
                OR ${branchPurchases.taxTotal} IS NOT NULL
                OR ${branchPurchases.grandTotal} IS NOT NULL
              )
            THEN COALESCE(${branchPurchases.totalAmount}, 0)
            ELSE 0
          END), 0)`.as("purchase_committed_historical_without_breakdown"),
          purchaseReceivedBeforeTax: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchPurchases.status} IN ('partially_received', 'received')
              AND ${branchPurchases.cancelledAt} IS NULL
              AND (
                ${branchPurchases.taxMode} IS NOT NULL
                OR ${branchPurchases.subtotalBeforeTax} IS NOT NULL
                OR ${branchPurchases.taxableSubtotal} IS NOT NULL
                OR ${branchPurchases.taxTotal} IS NOT NULL
                OR ${branchPurchases.grandTotal} IS NOT NULL
              )
            THEN COALESCE(${branchPurchases.taxableSubtotal}, ${branchPurchases.totalAmount})
            ELSE 0
          END), 0)`.as("purchase_received_before_tax"),
          purchaseReceivedHistoricalWithoutBreakdown: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchPurchases.status} IN ('partially_received', 'received')
              AND ${branchPurchases.cancelledAt} IS NULL
              AND NOT (
                ${branchPurchases.taxMode} IS NOT NULL
                OR ${branchPurchases.subtotalBeforeTax} IS NOT NULL
                OR ${branchPurchases.taxableSubtotal} IS NOT NULL
                OR ${branchPurchases.taxTotal} IS NOT NULL
                OR ${branchPurchases.grandTotal} IS NOT NULL
              )
            THEN COALESCE(${branchPurchases.totalAmount}, 0)
            ELSE 0
          END), 0)`.as("purchase_received_historical_without_breakdown"),
          purchasePaidTotal: sql<number>`COALESCE(SUM(CASE
            WHEN ${branchPurchases.status} <> 'cancelled' AND ${branchPurchases.cancelledAt} IS NULL
            THEN COALESCE(${branchPurchases.paidAmount}, 0)
            ELSE 0
          END), 0)`.as("purchase_paid_total"),
        })
        .from(branchPurchases)
        .where(and(
          eq(branchPurchases.branchId, branchId),
          inArray(branchPurchases.projectId, projectIds),
        ))
        .groupBy(branchPurchases.projectId),
    ]);

    for (const row of salesRows) {
      if (!row.projectId) continue;
      const current = summaryMap.get(row.projectId) ?? this.createEmptyCommercialProjectSummary();
      summaryMap.set(row.projectId, {
        ...current,
        linkedSalesCount: Number(row.linkedSalesCount ?? 0),
        revenueBeforeTax: toFinanceAmount(row.revenueBeforeTax),
        revenueHistoricalWithoutBreakdown: toFinanceAmount((row as any).revenueHistoricalWithoutBreakdown),
        taxCollected: toFinanceAmount(row.taxCollected),
        revenueGrossTotal: toFinanceAmount(row.revenueGrossTotal),
        cashCollectedTotal: toFinanceAmount(row.cashCollectedTotal),
      });
    }

    for (const row of purchaseRows) {
      if (!row.projectId) continue;
      const current = summaryMap.get(row.projectId) ?? this.createEmptyCommercialProjectSummary();
      summaryMap.set(row.projectId, {
        ...current,
        linkedPurchasesCount: Number(row.linkedPurchasesCount ?? 0),
        linkedDraftPurchasesCount: Number(row.linkedDraftPurchasesCount ?? 0),
        purchaseCommittedBeforeTax: toFinanceAmount((row as any).purchaseCommittedBeforeTax),
        purchaseCommittedHistoricalWithoutBreakdown: toFinanceAmount((row as any).purchaseCommittedHistoricalWithoutBreakdown),
        purchaseReceivedBeforeTax: toFinanceAmount((row as any).purchaseReceivedBeforeTax),
        purchaseReceivedHistoricalWithoutBreakdown: toFinanceAmount((row as any).purchaseReceivedHistoricalWithoutBreakdown),
        purchasePaidTotal: toFinanceAmount(row.purchasePaidTotal),
      });
    }

    summaryMap.forEach((summary, projectId) => {
      summaryMap.set(projectId, this.finalizeCommercialProjectSummary(summary));
    });

    return summaryMap;
  }

  private async getBranchCommercialProjectRowById(
    branchId: string,
    projectId: string,
  ): Promise<BranchCommercialProjectRow | undefined> {
    const [row] = await db
      .select({
        id: branchCommercialProjects.id,
        branchId: branchCommercialProjects.branchId,
        code: branchCommercialProjects.code,
        name: branchCommercialProjects.name,
        description: branchCommercialProjects.description,
        customerUserId: branchCommercialProjects.customerUserId,
        customerName: users.name,
        customerLastName: users.lastName,
        status: branchCommercialProjects.status,
        startDate: branchCommercialProjects.startDate,
        expectedEndDate: branchCommercialProjects.expectedEndDate,
        completedAt: branchCommercialProjects.completedAt,
        notes: branchCommercialProjects.notes,
        createdByUserId: branchCommercialProjects.createdByUserId,
        createdAt: branchCommercialProjects.createdAt,
        updatedAt: branchCommercialProjects.updatedAt,
        deletedAt: branchCommercialProjects.deletedAt,
      })
      .from(branchCommercialProjects)
      .leftJoin(users, eq(branchCommercialProjects.customerUserId, users.id))
      .where(and(
        eq(branchCommercialProjects.branchId, branchId),
        eq(branchCommercialProjects.id, projectId),
        isNull(branchCommercialProjects.deletedAt),
      ))
      .limit(1);

    if (!row) return undefined;

    const summaryMap = await this.getBranchCommercialProjectSummaryMap(branchId, [projectId]);
    return this.mapBranchCommercialProjectRow(row, summaryMap.get(projectId));
  }

  private async getAssignableBranchCommercialProjectTx(
    tx: any,
    branchId: string,
    projectId: string,
  ): Promise<BranchCommercialProject | null> {
    const [project] = await tx
      .select()
      .from(branchCommercialProjects)
      .where(and(
        eq(branchCommercialProjects.id, projectId),
        eq(branchCommercialProjects.branchId, branchId),
        isNull(branchCommercialProjects.deletedAt),
      ))
      .limit(1);

    if (!project) return null;
    if (project.status === "completed" || project.status === "cancelled" || project.status === "archived") {
      throw new Error("BRANCH_COMMERCIAL_PROJECT_NOT_ASSIGNABLE");
    }
    return project;
  }

  private async insertBranchCommercialProjectWithRetryTx(
    tx: any,
    data: Omit<InsertBranchCommercialProject, "code"> & { code?: string | null },
  ) {
    const manualCode = normalizeOptionalTextValue((data as any).code);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const [project] = await tx
          .insert(branchCommercialProjects)
          .values({
            ...data,
            code: manualCode ?? generateBranchCommercialProjectCode(),
          } as any)
          .returning();

        return project;
      } catch (error) {
        const isCodeCollision = isPgUniqueViolationForConstraint(error, BRANCH_COMMERCIAL_PROJECT_CODE_UNIQUE);
        if (manualCode || !isCodeCollision) {
          throw error;
        }
        if (attempt >= 3) {
          throw new Error("BRANCH_COMMERCIAL_PROJECT_CODE_COLLISION");
        }
      }
    }

    throw new Error("BRANCH_COMMERCIAL_PROJECT_CODE_COLLISION");
  }

  private async validateBranchCommercialProjectCustomerTx(
    tx: any,
    branchId: string,
    customerUserId: string | null | undefined,
  ): Promise<string | null> {
    const normalizedCustomerUserId = normalizeOptionalTextValue(customerUserId);
    if (!normalizedCustomerUserId) return null;

    const [membershipRow] = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(
        eq(memberships.branchId, branchId),
        eq(memberships.userId, normalizedCustomerUserId),
      ))
      .limit(1);

    if (membershipRow?.userId) {
      return normalizedCustomerUserId;
    }

    const [crmRow] = await tx
      .select({ userId: branchClientCrm.userId })
      .from(branchClientCrm)
      .where(and(
        eq(branchClientCrm.branchId, branchId),
        eq(branchClientCrm.userId, normalizedCustomerUserId),
      ))
      .limit(1);

    if (crmRow?.userId) {
      return normalizedCustomerUserId;
    }

    throw new Error("BRANCH_COMMERCIAL_PROJECT_CUSTOMER_INVALID");
  }

  async getBranchCommercialProjectOptions(branchId: string): Promise<Array<{ id: string; code: string; name: string; status: string }>> {
    const rows = await db
      .select({
        id: branchCommercialProjects.id,
        code: branchCommercialProjects.code,
        name: branchCommercialProjects.name,
        status: branchCommercialProjects.status,
      })
      .from(branchCommercialProjects)
      .where(and(
        eq(branchCommercialProjects.branchId, branchId),
        isNull(branchCommercialProjects.deletedAt),
        inArray(branchCommercialProjects.status, ["draft", "active"]),
      ))
      .orderBy(desc(branchCommercialProjects.updatedAt), asc(branchCommercialProjects.name));

    return rows;
  }

  async getBranchCommercialProjects(branchId: string, filters?: {
    page?: number | null;
    pageSize?: number | null;
    search?: string | null;
    status?: string | null;
    customerId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    sort?: "updated_desc" | "name_asc" | "name_desc" | "start_date_desc" | "start_date_asc" | null;
    includeArchived?: boolean;
  }): Promise<BranchCommercialProjectListPage> {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const requestedPageSize = Number(filters?.pageSize ?? 25) || 25;
    const pageSize = Math.min(100, Math.max(25, requestedPageSize));
    const offset = (page - 1) * pageSize;
    const search = normalizeOptionalTextValue(filters?.search);
    const status = normalizeOptionalTextValue(filters?.status) ?? "all";
    const customerId = normalizeOptionalTextValue(filters?.customerId);
    const dateFrom = normalizeOptionalTextValue(filters?.dateFrom);
    const dateTo = normalizeOptionalTextValue(filters?.dateTo);
    const sort = filters?.sort ?? "updated_desc";
    const whereClauses: any[] = [
      eq(branchCommercialProjects.branchId, branchId),
      isNull(branchCommercialProjects.deletedAt),
    ];

    if (status && status !== "all") {
      whereClauses.push(eq(branchCommercialProjects.status, status));
    } else if (!filters?.includeArchived) {
      whereClauses.push(sql`${branchCommercialProjects.status} <> 'archived'`);
    }

    if (customerId) {
      whereClauses.push(eq(branchCommercialProjects.customerUserId, customerId));
    }

    if (dateFrom) {
      whereClauses.push(gte(branchCommercialProjects.startDate, dateFrom));
    }

    if (dateTo) {
      whereClauses.push(lte(branchCommercialProjects.startDate, dateTo));
    }

    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push(sql`(
        ${branchCommercialProjects.name} ILIKE ${pattern}
        OR ${branchCommercialProjects.code} ILIKE ${pattern}
        OR COALESCE(${branchCommercialProjects.description}, '') ILIKE ${pattern}
      )`);
    }

    const orderByClauses = (() => {
      switch (sort) {
        case "name_asc":
          return [asc(branchCommercialProjects.name), desc(branchCommercialProjects.updatedAt), asc(branchCommercialProjects.id)];
        case "name_desc":
          return [desc(branchCommercialProjects.name), desc(branchCommercialProjects.updatedAt), asc(branchCommercialProjects.id)];
        case "start_date_asc":
          return [asc(branchCommercialProjects.startDate), asc(branchCommercialProjects.name), asc(branchCommercialProjects.id)];
        case "start_date_desc":
          return [desc(branchCommercialProjects.startDate), desc(branchCommercialProjects.updatedAt), asc(branchCommercialProjects.id)];
        case "updated_desc":
        default:
          return [desc(branchCommercialProjects.updatedAt), asc(branchCommercialProjects.name), asc(branchCommercialProjects.id)];
      }
    })();

    const [totalRows, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(branchCommercialProjects)
        .where(and(...whereClauses)),
      db
        .select({
          id: branchCommercialProjects.id,
          branchId: branchCommercialProjects.branchId,
          code: branchCommercialProjects.code,
          name: branchCommercialProjects.name,
          description: branchCommercialProjects.description,
          customerUserId: branchCommercialProjects.customerUserId,
          customerName: users.name,
          customerLastName: users.lastName,
          status: branchCommercialProjects.status,
          startDate: branchCommercialProjects.startDate,
          expectedEndDate: branchCommercialProjects.expectedEndDate,
          completedAt: branchCommercialProjects.completedAt,
          notes: branchCommercialProjects.notes,
          createdByUserId: branchCommercialProjects.createdByUserId,
          createdAt: branchCommercialProjects.createdAt,
          updatedAt: branchCommercialProjects.updatedAt,
          deletedAt: branchCommercialProjects.deletedAt,
        })
        .from(branchCommercialProjects)
        .leftJoin(users, eq(branchCommercialProjects.customerUserId, users.id))
        .where(and(...whereClauses))
        .orderBy(...orderByClauses)
        .limit(pageSize)
        .offset(offset),
    ]);

    const summaryMap = await this.getBranchCommercialProjectSummaryMap(branchId, rows.map((row) => row.id));
    const total = Number(totalRows[0]?.total ?? 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

    return {
      items: rows.map((row) => this.mapBranchCommercialProjectRow(row, summaryMap.get(row.id))),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async getBranchCommercialProjectLinkableSales(
    branchId: string,
    filters?: {
      page?: number | null;
      pageSize?: number | null;
      search?: string | null;
      dateFrom?: string | null;
      dateTo?: string | null;
    },
  ): Promise<BranchCommercialProjectLinkableSalesPage> {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const requestedPageSize = Number(filters?.pageSize ?? 25) || 25;
    const pageSize = Math.min(100, Math.max(25, requestedPageSize));
    const offset = (page - 1) * pageSize;
    const search = normalizeOptionalTextValue(filters?.search);
    const dateFrom = normalizeOptionalTextValue(filters?.dateFrom);
    const dateTo = normalizeOptionalTextValue(filters?.dateTo);
    const whereClauses: any[] = [
      eq(branchSales.branchId, branchId),
      eq(branchSales.status, "completed"),
      isNull(branchSales.cancelledAt),
      isNull(branchSales.projectId),
    ];

    if (dateFrom) {
      whereClauses.push(sql`${branchSales.createdAt}::date >= ${dateFrom}`);
    }

    if (dateTo) {
      whereClauses.push(sql`${branchSales.createdAt}::date <= ${dateTo}`);
    }

    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push(sql`(
        ${branchSales.folio} ILIKE ${pattern}
        OR COALESCE(${users.name}, '') ILIKE ${pattern}
        OR COALESCE(${users.lastName}, '') ILIKE ${pattern}
        OR COALESCE(${users.email}, '') ILIKE ${pattern}
      )`);
    }

    const [totalRows, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(branchSales)
        .leftJoin(users, eq(branchSales.clientUserId, users.id))
        .where(and(...whereClauses)),
      db
        .select({
          id: branchSales.id,
          folio: branchSales.folio,
          clientUserId: branchSales.clientUserId,
          clientName: users.name,
          clientLastName: users.lastName,
          status: branchSales.status,
          totalAmount: branchSales.totalAmount,
          taxableSubtotal: branchSales.taxableSubtotal,
          taxTotal: branchSales.taxTotal,
          grandTotal: branchSales.grandTotal,
          createdAt: branchSales.createdAt,
        })
        .from(branchSales)
        .leftJoin(users, eq(branchSales.clientUserId, users.id))
        .where(and(...whereClauses))
        .orderBy(desc(branchSales.createdAt), desc(branchSales.id))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(totalRows[0]?.total ?? 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

    return {
      items: rows.map((row) => ({
        id: row.id,
        folio: row.folio,
        clientUserId: row.clientUserId ?? null,
        clientDisplayName: [row.clientName, row.clientLastName].filter(Boolean).join(" ").trim() || null,
        status: row.status,
        totalAmount: toFinanceAmount(row.totalAmount),
        taxableSubtotal: row.taxableSubtotal == null ? null : toFinanceAmount(row.taxableSubtotal),
        taxTotal: row.taxTotal == null ? null : toFinanceAmount(row.taxTotal),
        grandTotal: row.grandTotal == null ? null : toFinanceAmount(row.grandTotal),
        createdAt: row.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async getBranchCommercialProjectLinkablePurchases(
    branchId: string,
    filters?: {
      page?: number | null;
      pageSize?: number | null;
      search?: string | null;
      dateFrom?: string | null;
      dateTo?: string | null;
    },
  ): Promise<BranchCommercialProjectLinkablePurchasesPage> {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const requestedPageSize = Number(filters?.pageSize ?? 25) || 25;
    const pageSize = Math.min(100, Math.max(25, requestedPageSize));
    const offset = (page - 1) * pageSize;
    const search = normalizeOptionalTextValue(filters?.search);
    const dateFrom = normalizeOptionalTextValue(filters?.dateFrom);
    const dateTo = normalizeOptionalTextValue(filters?.dateTo);
    const whereClauses: any[] = [
      eq(branchPurchases.branchId, branchId),
      isNull(branchPurchases.projectId),
      sql`${branchPurchases.status} <> 'cancelled'`,
    ];

    if (dateFrom) {
      whereClauses.push(gte(branchPurchases.purchaseDate, dateFrom));
    }

    if (dateTo) {
      whereClauses.push(lte(branchPurchases.purchaseDate, dateTo));
    }

    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push(sql`(
        ${branchPurchases.folio} ILIKE ${pattern}
        OR COALESCE(${branchSuppliers.name}, '') ILIKE ${pattern}
      )`);
    }

    const [totalRows, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(branchPurchases)
        .leftJoin(branchSuppliers, eq(branchPurchases.supplierId, branchSuppliers.id))
        .where(and(...whereClauses)),
      db
        .select({
          id: branchPurchases.id,
          folio: branchPurchases.folio,
          supplierId: branchPurchases.supplierId,
          supplierName: branchSuppliers.name,
          status: branchPurchases.status,
          totalAmount: branchPurchases.totalAmount,
          taxableSubtotal: branchPurchases.taxableSubtotal,
          taxTotal: branchPurchases.taxTotal,
          grandTotal: branchPurchases.grandTotal,
          purchaseDate: branchPurchases.purchaseDate,
        })
        .from(branchPurchases)
        .leftJoin(branchSuppliers, eq(branchPurchases.supplierId, branchSuppliers.id))
        .where(and(...whereClauses))
        .orderBy(desc(branchPurchases.purchaseDate), desc(branchPurchases.createdAt), desc(branchPurchases.id))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(totalRows[0]?.total ?? 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

    return {
      items: rows.map((row) => ({
        id: row.id,
        folio: row.folio,
        supplierId: row.supplierId ?? null,
        supplierName: row.supplierName ?? null,
        status: row.status,
        totalAmount: toFinanceAmount(row.totalAmount),
        taxableSubtotal: row.taxableSubtotal == null ? null : toFinanceAmount(row.taxableSubtotal),
        taxTotal: row.taxTotal == null ? null : toFinanceAmount(row.taxTotal),
        grandTotal: row.grandTotal == null ? null : toFinanceAmount(row.grandTotal),
        purchaseDate: typeof row.purchaseDate === "string" ? row.purchaseDate : String(row.purchaseDate).slice(0, 10),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async getBranchCommercialProjectById(
    branchId: string,
    projectId: string,
  ): Promise<BranchCommercialProjectDetailRow | undefined> {
    const project = await this.getBranchCommercialProjectRowById(branchId, projectId);
    if (!project) return undefined;

    const [salesRows, purchaseRows] = await Promise.all([
      db
        .select({
          id: branchSales.id,
          folio: branchSales.folio,
          clientUserId: branchSales.clientUserId,
          clientName: users.name,
          clientLastName: users.lastName,
          status: branchSales.status,
          subtotalAmount: branchSales.subtotalAmount,
          discountAmount: branchSales.discountAmount,
          totalAmount: branchSales.totalAmount,
          paidAmount: branchSales.paidAmount,
          taxMode: branchSales.taxMode,
          taxRate: branchSales.taxRate,
          subtotalBeforeTax: branchSales.subtotalBeforeTax,
          taxableSubtotal: branchSales.taxableSubtotal,
          taxTotal: branchSales.taxTotal,
          grandTotal: branchSales.grandTotal,
          createdAt: branchSales.createdAt,
          cancelledAt: branchSales.cancelledAt,
        })
        .from(branchSales)
        .leftJoin(users, eq(branchSales.clientUserId, users.id))
        .where(and(
          eq(branchSales.branchId, branchId),
          eq(branchSales.projectId, projectId),
        ))
        .orderBy(desc(branchSales.createdAt)),
      db
        .select({
          id: branchPurchases.id,
          folio: branchPurchases.folio,
          supplierId: branchPurchases.supplierId,
          supplierName: branchSuppliers.name,
          status: branchPurchases.status,
          purchaseDate: branchPurchases.purchaseDate,
          paymentStatus: branchPurchases.paymentStatus,
          subtotalAmount: branchPurchases.subtotalAmount,
          discountAmount: branchPurchases.discountAmount,
          totalAmount: branchPurchases.totalAmount,
          paidAmount: branchPurchases.paidAmount,
          taxMode: branchPurchases.taxMode,
          taxRate: branchPurchases.taxRate,
          subtotalBeforeTax: branchPurchases.subtotalBeforeTax,
          taxableSubtotal: branchPurchases.taxableSubtotal,
          taxTotal: branchPurchases.taxTotal,
          grandTotal: branchPurchases.grandTotal,
          receivedAt: branchPurchases.receivedAt,
          cancelledAt: branchPurchases.cancelledAt,
          createdAt: branchPurchases.createdAt,
        })
        .from(branchPurchases)
        .leftJoin(branchSuppliers, eq(branchPurchases.supplierId, branchSuppliers.id))
        .where(and(
          eq(branchPurchases.branchId, branchId),
          eq(branchPurchases.projectId, projectId),
        ))
        .orderBy(desc(branchPurchases.purchaseDate), desc(branchPurchases.createdAt)),
    ]);

    const sales = salesRows.map((row) => ({
      id: row.id,
      folio: row.folio,
      clientUserId: row.clientUserId ?? null,
      clientDisplayName: [row.clientName, row.clientLastName].filter(Boolean).join(" ").trim() || null,
      status: row.status,
      subtotalAmount: toFinanceAmount(row.subtotalAmount),
      discountAmount: toFinanceAmount(row.discountAmount),
      totalAmount: toFinanceAmount(row.totalAmount),
      paidAmount: toFinanceAmount(row.paidAmount),
      taxMode: row.taxMode ?? null,
      taxRate: row.taxRate == null ? null : toFinanceAmount(row.taxRate),
      subtotalBeforeTax: row.subtotalBeforeTax == null ? null : toFinanceAmount(row.subtotalBeforeTax),
      taxableSubtotal: row.taxableSubtotal == null ? null : toFinanceAmount(row.taxableSubtotal),
      taxTotal: row.taxTotal == null ? null : toFinanceAmount(row.taxTotal),
      grandTotal: row.grandTotal == null ? null : toFinanceAmount(row.grandTotal),
      createdAt: row.createdAt,
      cancelledAt: row.cancelledAt ?? null,
    }));

    const purchases = purchaseRows.map((row) => ({
      id: row.id,
      folio: row.folio,
      supplierId: row.supplierId ?? null,
      supplierName: row.supplierName ?? null,
      status: row.status,
      purchaseDate: typeof row.purchaseDate === "string" ? row.purchaseDate : String(row.purchaseDate).slice(0, 10),
      paymentStatus: row.paymentStatus,
      subtotalAmount: toFinanceAmount(row.subtotalAmount),
      discountAmount: toFinanceAmount(row.discountAmount),
      totalAmount: toFinanceAmount(row.totalAmount),
      paidAmount: toFinanceAmount(row.paidAmount),
      taxMode: row.taxMode ?? null,
      taxRate: row.taxRate == null ? null : toFinanceAmount(row.taxRate),
      subtotalBeforeTax: row.subtotalBeforeTax == null ? null : toFinanceAmount(row.subtotalBeforeTax),
      taxableSubtotal: row.taxableSubtotal == null ? null : toFinanceAmount(row.taxableSubtotal),
      taxTotal: row.taxTotal == null ? null : toFinanceAmount(row.taxTotal),
      grandTotal: row.grandTotal == null ? null : toFinanceAmount(row.grandTotal),
      receivedAt: row.receivedAt ?? null,
      cancelledAt: row.cancelledAt ?? null,
      createdAt: row.createdAt,
    }));

    return {
      ...project,
      summary: this.computeCommercialProjectSummaryFromLists(sales, purchases),
      sales,
      purchases,
    };
  }

  async createBranchCommercialProject(data: InsertBranchCommercialProject): Promise<BranchCommercialProjectRow> {
    const created = await db.transaction(async (tx) => {
      const customerUserId = await this.validateBranchCommercialProjectCustomerTx(
        tx,
        data.branchId,
        data.customerUserId,
      );

      return this.insertBranchCommercialProjectWithRetryTx(tx, {
        ...data,
        code: normalizeOptionalTextValue(data.code),
        customerUserId,
        description: normalizeOptionalTextValue(data.description),
        notes: normalizeOptionalTextValue(data.notes),
      } as any);
    });

    return (await this.getBranchCommercialProjectRowById(created.branchId, created.id))!;
  }

  async createBranchCommercialProjectFromSale(data: {
    branchId: string;
    saleId: string;
    name?: string | null;
    description?: string | null;
    notes?: string | null;
    expectedEndDate?: string | null;
    createdByUserId?: string | null;
  }): Promise<BranchCommercialProjectDetailRow> {
    const projectId = await db.transaction(async (tx) => {
      const [saleRow] = await tx
        .select({
          id: branchSales.id,
          branchId: branchSales.branchId,
          projectId: branchSales.projectId,
          folio: branchSales.folio,
          clientUserId: branchSales.clientUserId,
          createdAt: branchSales.createdAt,
          clientName: users.name,
          clientLastName: users.lastName,
        })
        .from(branchSales)
        .leftJoin(users, eq(branchSales.clientUserId, users.id))
        .where(and(
          eq(branchSales.id, data.saleId),
          eq(branchSales.branchId, data.branchId),
        ))
        .limit(1);

      if (!saleRow) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_SALE_NOT_FOUND");
      }
      if (saleRow.projectId) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_SALE_ALREADY_LINKED");
      }

      const clientName = [saleRow.clientName, saleRow.clientLastName].filter(Boolean).join(" ").trim();
      const startDate = new Date(saleRow.createdAt).toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE });

      const projectRow = await this.insertBranchCommercialProjectWithRetryTx(tx, {
        branchId: data.branchId,
        code: null,
        name: normalizeOptionalTextValue(data.name) ?? (clientName ? `${saleRow.folio} - ${clientName}` : `Proyecto ${saleRow.folio}`),
        description: normalizeOptionalTextValue(data.description),
        customerUserId: saleRow.clientUserId ?? null,
        status: "active",
        startDate,
        expectedEndDate: normalizeOptionalTextValue(data.expectedEndDate),
        completedAt: null,
        notes: normalizeOptionalTextValue(data.notes),
        createdByUserId: data.createdByUserId ?? null,
      } as any);

      const linkedSale = await tx
        .update(branchSales)
        .set({
          projectId: projectRow.id,
          updatedAt: new Date(),
        } as any)
        .where(and(
          eq(branchSales.id, data.saleId),
          eq(branchSales.branchId, data.branchId),
          isNull(branchSales.projectId),
        ))
        .returning({ id: branchSales.id });

      if (!linkedSale.length) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_SALE_ALREADY_LINKED");
      }

      return projectRow.id;
    });

    return (await this.getBranchCommercialProjectById(data.branchId, projectId))!;
  }

  async updateBranchCommercialProject(
    branchId: string,
    projectId: string,
    data: Partial<InsertBranchCommercialProject>,
  ): Promise<BranchCommercialProjectRow | undefined> {
    const nextStatus = data.status ?? undefined;
    const updated = await db.transaction(async (tx) => {
      const customerUserId = data.customerUserId === undefined
        ? undefined
        : await this.validateBranchCommercialProjectCustomerTx(tx, branchId, data.customerUserId);

      const [project] = await tx
        .update(branchCommercialProjects)
        .set({
          ...data,
          ...(customerUserId !== undefined ? { customerUserId } : {}),
          description: data.description === undefined ? undefined : normalizeOptionalTextValue(data.description),
          notes: data.notes === undefined ? undefined : normalizeOptionalTextValue(data.notes),
          completedAt: nextStatus === undefined
            ? undefined
            : nextStatus === "completed"
              ? new Date()
              : null,
          updatedAt: new Date(),
        } as any)
        .where(and(
          eq(branchCommercialProjects.branchId, branchId),
          eq(branchCommercialProjects.id, projectId),
          isNull(branchCommercialProjects.deletedAt),
        ))
        .returning({ id: branchCommercialProjects.id });

      return project;
    });

    if (!updated) return undefined;
    return this.getBranchCommercialProjectRowById(branchId, updated.id);
  }

  async linkBranchSaleToCommercialProject(
    branchId: string,
    projectId: string,
    saleId: string,
  ): Promise<BranchCommercialProjectDetailRow> {
    await db.transaction(async (tx) => {
      const project = await this.getAssignableBranchCommercialProjectTx(tx, branchId, projectId);
      if (!project) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_NOT_FOUND");
      }

      const [sale] = await tx
        .select({
          id: branchSales.id,
          projectId: branchSales.projectId,
        })
        .from(branchSales)
        .where(and(
          eq(branchSales.id, saleId),
          eq(branchSales.branchId, branchId),
        ))
        .limit(1);

      if (!sale) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_SALE_NOT_FOUND");
      }
      if (sale.projectId && sale.projectId !== projectId) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_SALE_ALREADY_LINKED");
      }
      if (sale.projectId === projectId) {
        return;
      }

      const linkedSale = await tx
        .update(branchSales)
        .set({
          projectId,
          updatedAt: new Date(),
        } as any)
        .where(and(
          eq(branchSales.id, saleId),
          eq(branchSales.branchId, branchId),
          isNull(branchSales.projectId),
        ))
        .returning({ id: branchSales.id });

      if (!linkedSale.length) {
        const [currentSale] = await tx
          .select({ projectId: branchSales.projectId })
          .from(branchSales)
          .where(and(
            eq(branchSales.id, saleId),
            eq(branchSales.branchId, branchId),
          ))
          .limit(1);

        if (!currentSale) {
          throw new Error("BRANCH_COMMERCIAL_PROJECT_SALE_NOT_FOUND");
        }
        if (currentSale.projectId && currentSale.projectId !== projectId) {
          throw new Error("BRANCH_COMMERCIAL_PROJECT_SALE_ALREADY_LINKED");
        }
      }
    });

    return (await this.getBranchCommercialProjectById(branchId, projectId))!;
  }

  async linkBranchPurchaseToCommercialProject(
    branchId: string,
    projectId: string,
    purchaseId: string,
  ): Promise<BranchCommercialProjectDetailRow> {
    await db.transaction(async (tx) => {
      const project = await this.getAssignableBranchCommercialProjectTx(tx, branchId, projectId);
      if (!project) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_NOT_FOUND");
      }

      const [purchase] = await tx
        .select({
          id: branchPurchases.id,
          projectId: branchPurchases.projectId,
        })
        .from(branchPurchases)
        .where(and(
          eq(branchPurchases.id, purchaseId),
          eq(branchPurchases.branchId, branchId),
        ))
        .limit(1);

      if (!purchase) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_PURCHASE_NOT_FOUND");
      }
      if (purchase.projectId && purchase.projectId !== projectId) {
        throw new Error("BRANCH_COMMERCIAL_PROJECT_PURCHASE_ALREADY_LINKED");
      }
      if (purchase.projectId === projectId) {
        return;
      }

      const linkedPurchase = await tx
        .update(branchPurchases)
        .set({
          projectId,
          updatedAt: new Date(),
        } as any)
        .where(and(
          eq(branchPurchases.id, purchaseId),
          eq(branchPurchases.branchId, branchId),
          isNull(branchPurchases.projectId),
        ))
        .returning({ id: branchPurchases.id });

      if (!linkedPurchase.length) {
        const [currentPurchase] = await tx
          .select({ projectId: branchPurchases.projectId })
          .from(branchPurchases)
          .where(and(
            eq(branchPurchases.id, purchaseId),
            eq(branchPurchases.branchId, branchId),
          ))
          .limit(1);

        if (!currentPurchase) {
          throw new Error("BRANCH_COMMERCIAL_PROJECT_PURCHASE_NOT_FOUND");
        }
        if (currentPurchase.projectId && currentPurchase.projectId !== projectId) {
          throw new Error("BRANCH_COMMERCIAL_PROJECT_PURCHASE_ALREADY_LINKED");
        }
      }
    });

    return (await this.getBranchCommercialProjectById(branchId, projectId))!;
  }

  async getBranchCommercialProducts(branchId: string): Promise<BranchCommercialProductRow[]> {
    const rows = await db
      .select()
      .from(branchCommercialProducts)
      .where(and(
        eq(branchCommercialProducts.branchId, branchId),
        isNull(branchCommercialProducts.deletedAt),
      ))
      .orderBy(
        desc(branchCommercialProducts.isActive),
        asc(branchCommercialProducts.displayOrder),
        asc(branchCommercialProducts.name),
      );

    const productIds = rows.map((row) => row.id);
    const balanceRows = productIds.length
      ? await db
          .select()
          .from(branchInventoryBalances)
          .where(and(
            eq(branchInventoryBalances.branchId, branchId),
            inArray(branchInventoryBalances.commercialProductId, productIds),
          ))
      : [];

    const balanceMap = new Map(balanceRows.map((row) => [row.commercialProductId, row]));

    return rows.map((row) => {
      const mapped = this.mapBranchCommercialProductRow(row);
      const balance = balanceMap.get(row.id);
      if (!balance) {
        return mapped;
      }

      return {
        ...mapped,
        inventoryQuantityOnHand: balance.quantityOnHand,
        inventoryMinimumStock: balance.minimumStock,
        inventoryStatus: computeInventoryStatus(row.usesInventory, {
          quantityOnHand: balance.quantityOnHand,
          minimumStock: balance.minimumStock,
        }),
        inventoryUpdatedAt: balance.updatedAt,
      };
    });
  }

  async getBranchCommercialProductsPage(
    branchId: string,
    filters?: {
      page?: number | null;
      pageSize?: number | null;
      search?: string | null;
      status?: "all" | "active" | "inactive" | "archived" | null;
      category?: string | null;
      inventoryMode?: "all" | "inventory" | "no_inventory" | null;
      publicMode?: "all" | "public" | "private" | null;
      sort?: "updated_desc" | "name_asc" | "price_desc" | "price_asc" | "category_asc" | null;
    },
  ): Promise<BranchCommercialProductListPage> {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const requestedPageSize = Number(filters?.pageSize ?? 25) || 25;
    const pageSize = Math.min(100, Math.max(25, requestedPageSize));
    const offset = (page - 1) * pageSize;
    const status = filters?.status ?? "all";
    const category = normalizeOptionalTextValue(filters?.category);
    const search = normalizeOptionalTextValue(filters?.search);
    const inventoryMode = filters?.inventoryMode ?? "all";
    const publicMode = filters?.publicMode ?? "all";
    const sort = filters?.sort ?? "updated_desc";
    const whereClauses: any[] = [eq(branchCommercialProducts.branchId, branchId)];

    if (status === "archived") {
      whereClauses.push(sql`${branchCommercialProducts.deletedAt} IS NOT NULL`);
    } else {
      whereClauses.push(isNull(branchCommercialProducts.deletedAt));
      if (status === "active") {
        whereClauses.push(eq(branchCommercialProducts.isActive, true));
      } else if (status === "inactive") {
        whereClauses.push(eq(branchCommercialProducts.isActive, false));
      }
    }

    if (category && category.toLowerCase() !== "all") {
      whereClauses.push(eq(branchCommercialProducts.category, category));
    }
    if (inventoryMode === "inventory") {
      whereClauses.push(eq(branchCommercialProducts.usesInventory, true));
    } else if (inventoryMode === "no_inventory") {
      whereClauses.push(eq(branchCommercialProducts.usesInventory, false));
    }
    if (publicMode === "public") {
      whereClauses.push(eq(branchCommercialProducts.isPublicVisible, true));
    } else if (publicMode === "private") {
      whereClauses.push(eq(branchCommercialProducts.isPublicVisible, false));
    }
    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push(sql`(
        ${branchCommercialProducts.name} ILIKE ${pattern}
        OR ${branchCommercialProducts.category} ILIKE ${pattern}
        OR COALESCE(${branchCommercialProducts.description}, '') ILIKE ${pattern}
        OR COALESCE(${branchCommercialProducts.sku}, '') ILIKE ${pattern}
        OR COALESCE(${branchCommercialProducts.barcode}, '') ILIKE ${pattern}
      )`);
    }

    const orderByClauses = (() => {
      switch (sort) {
        case "name_asc":
          return [asc(branchCommercialProducts.name), asc(branchCommercialProducts.updatedAt)];
        case "price_desc":
          return [desc(branchCommercialProducts.salePriceAmount), asc(branchCommercialProducts.name)];
        case "price_asc":
          return [asc(branchCommercialProducts.salePriceAmount), asc(branchCommercialProducts.name)];
        case "category_asc":
          return [asc(branchCommercialProducts.category), asc(branchCommercialProducts.name)];
        case "updated_desc":
        default:
          return [desc(branchCommercialProducts.updatedAt), desc(branchCommercialProducts.createdAt)];
      }
    })();

    const [totalRows, rows, categoryRows, summaryRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(branchCommercialProducts)
        .where(and(...whereClauses)),
      db
        .select()
        .from(branchCommercialProducts)
        .where(and(...whereClauses))
        .orderBy(...orderByClauses)
        .limit(pageSize)
        .offset(offset),
      db
        .selectDistinct({ category: branchCommercialProducts.category })
        .from(branchCommercialProducts)
        .where(and(
          eq(branchCommercialProducts.branchId, branchId),
          isNull(branchCommercialProducts.deletedAt),
        ))
        .orderBy(asc(branchCommercialProducts.category)),
      db
        .select({
          total: count(),
          active: sql<number>`COUNT(*) FILTER (WHERE ${branchCommercialProducts.isActive} = true)`.as("active"),
          publicVisible: sql<number>`COUNT(*) FILTER (WHERE ${branchCommercialProducts.isPublicVisible} = true)`.as("public_visible"),
          inventoryReady: sql<number>`COUNT(*) FILTER (WHERE ${branchCommercialProducts.usesInventory} = true)`.as("inventory_ready"),
        })
        .from(branchCommercialProducts)
        .where(and(...whereClauses)),
    ]);

    const productIds = rows.map((row) => row.id);
    const balanceRows = productIds.length
      ? await db
          .select()
          .from(branchInventoryBalances)
          .where(and(
            eq(branchInventoryBalances.branchId, branchId),
            inArray(branchInventoryBalances.commercialProductId, productIds),
          ))
      : [];

    const balanceMap = new Map(balanceRows.map((row) => [row.commercialProductId, row]));
    const total = Number(totalRows[0]?.total ?? 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

    return {
      items: rows.map((row) => {
        const mapped = this.mapBranchCommercialProductRow(row);
        const balance = balanceMap.get(row.id);
        if (!balance) {
          return mapped;
        }

        return {
          ...mapped,
          inventoryQuantityOnHand: balance.quantityOnHand,
          inventoryMinimumStock: balance.minimumStock,
          inventoryStatus: computeInventoryStatus(row.usesInventory, {
            quantityOnHand: balance.quantityOnHand,
            minimumStock: balance.minimumStock,
          }),
          inventoryUpdatedAt: balance.updatedAt,
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      filterOptions: {
        categories: (categoryRows ?? [])
          .map((row) => row.category?.trim())
          .filter((value): value is string => !!value),
      },
      summary: {
        total,
        active: Number(summaryRows[0]?.active ?? 0),
        publicVisible: Number(summaryRows[0]?.publicVisible ?? 0),
        inventoryReady: Number(summaryRows[0]?.inventoryReady ?? 0),
      },
    };
  }

  async getBranchCommercialProductById(branchId: string, productId: string): Promise<BranchCommercialProductRow | undefined> {
    const [row] = await db
      .select()
      .from(branchCommercialProducts)
      .where(and(
        eq(branchCommercialProducts.branchId, branchId),
        eq(branchCommercialProducts.id, productId),
        isNull(branchCommercialProducts.deletedAt),
      ))
      .limit(1);

    return row ? this.mapBranchCommercialProductRow(row) : undefined;
  }

  async getBranchSaleDetail(branchId: string, saleId: string): Promise<BranchSaleRow | undefined> {
    return this.getBranchSaleById(branchId, saleId);
  }

  async cancelBranchSale(data: {
    branchId: string;
    saleId: string;
    reason: string;
    cancelledByUserId: string;
    idempotencyKey: string;
  }): Promise<BranchSaleRow | undefined> {
    const reason = normalizeOptionalTextValue(data.reason);
    const idempotencyKey = normalizeOptionalTextValue(data.idempotencyKey);
    if (!reason || !idempotencyKey) {
      throw new Error("BRANCH_SALE_CANCELLATION_INVALID");
    }

    try {
      const cancellationResult = await db.transaction(async (tx) => {
        const cancellationTimestamp = new Date();
        const [claimedSale] = await tx
          .update(branchSales)
          .set({
            status: "cancelled",
            cancelledAt: cancellationTimestamp,
            cancelledByUserId: data.cancelledByUserId,
            cancellationReason: reason,
            cancellationIdempotencyKey: idempotencyKey,
            updatedAt: cancellationTimestamp,
          } as any)
          .where(and(
            eq(branchSales.id, data.saleId),
            eq(branchSales.branchId, data.branchId),
            eq(branchSales.status, "completed"),
          ))
          .returning({
            id: branchSales.id,
            branchId: branchSales.branchId,
            folio: branchSales.folio,
            clientUserId: branchSales.clientUserId,
            totalAmount: branchSales.totalAmount,
          });

        if (!claimedSale) {
          const [currentSale] = await tx
            .select({
              id: branchSales.id,
              branchId: branchSales.branchId,
              status: branchSales.status,
              cancellationIdempotencyKey: branchSales.cancellationIdempotencyKey,
            })
            .from(branchSales)
            .where(and(
              eq(branchSales.id, data.saleId),
              eq(branchSales.branchId, data.branchId),
            ))
            .limit(1);

          if (!currentSale) {
            return { status: "missing" as const };
          }

          if (currentSale.status === "cancelled") {
            if (currentSale.cancellationIdempotencyKey === idempotencyKey) {
              return { status: "already_cancelled_same_key" as const };
            }
            throw new Error("BRANCH_SALE_ALREADY_CANCELLED");
          }

          throw new Error("BRANCH_SALE_NOT_CANCELLABLE");
        }

        const [paymentRows, inventoryMovementRows, initialAccrualRows] = await Promise.all([
          tx
            .select()
            .from(branchSalePayments)
            .where(eq(branchSalePayments.saleId, claimedSale.id))
            .orderBy(asc(branchSalePayments.createdAt)),
          tx
            .select()
            .from(branchInventoryMovements)
            .where(and(
              eq(branchInventoryMovements.branchId, data.branchId),
              eq(branchInventoryMovements.saleId, claimedSale.id),
              eq(branchInventoryMovements.movementType, "sale"),
            ))
            .orderBy(asc(branchInventoryMovements.createdAt)),
          tx
            .select({
              id: branchCommissionAccruals.id,
              status: branchCommissionAccruals.status,
              paidAmount: branchCommissionAccruals.paidAmount,
            })
            .from(branchCommissionAccruals)
            .where(and(
              eq(branchCommissionAccruals.branchId, data.branchId),
              eq(branchCommissionAccruals.saleId, claimedSale.id),
            ))
            .orderBy(asc(branchCommissionAccruals.accruedAt), asc(branchCommissionAccruals.createdAt)),
        ]);

        const accrualIds = initialAccrualRows.map((row) => row.id);
        await this.lockBranchCommissionAccrualIdsTx(tx, data.branchId, accrualIds);

        const lockedAccrualRows = accrualIds.length > 0
          ? await tx
              .select({
                id: branchCommissionAccruals.id,
                status: branchCommissionAccruals.status,
                paidAmount: branchCommissionAccruals.paidAmount,
              })
              .from(branchCommissionAccruals)
              .where(and(
                eq(branchCommissionAccruals.branchId, data.branchId),
                inArray(branchCommissionAccruals.id, accrualIds),
              ))
          : [];

        const allocationTotals = accrualIds.length > 0
          ? await tx
              .select({
                commissionAccrualId: branchCommissionPaymentAllocations.commissionAccrualId,
                totalAllocated: sql<number>`COALESCE(SUM(${branchCommissionPaymentAllocations.amountAllocated}), 0)`.as("total_allocated"),
              })
              .from(branchCommissionPaymentAllocations)
              .where(and(
                eq(branchCommissionPaymentAllocations.branchId, data.branchId),
                inArray(branchCommissionPaymentAllocations.commissionAccrualId, accrualIds),
              ))
              .groupBy(branchCommissionPaymentAllocations.commissionAccrualId)
          : [];

        const allocationMap = new Map(
          allocationTotals.map((row) => [row.commissionAccrualId, toFinanceAmount(row.totalAllocated)]),
        );

        const hasPaidCommission = lockedAccrualRows.some((row) => {
          const paidAmount = toFinanceAmount(row.paidAmount);
          const allocatedAmount = allocationMap.get(row.id) ?? 0;
          return row.status === "partially_paid"
            || row.status === "paid"
            || paidAmount > 0.0001
            || allocatedAmount > 0.0001;
        });

        if (hasPaidCommission) {
          throw new Error("BRANCH_SALE_COMMISSION_ALREADY_PAID");
        }

        for (const movement of inventoryMovementRows) {
          const quantityToRestore = Math.abs(movement.quantityDelta ?? 0);
          if (quantityToRestore <= 0) continue;

          const [existingBalance] = await tx
            .select()
            .from(branchInventoryBalances)
            .where(and(
              eq(branchInventoryBalances.branchId, data.branchId),
              eq(branchInventoryBalances.commercialProductId, movement.commercialProductId),
            ))
            .limit(1);

          const quantityBefore = existingBalance?.quantityOnHand ?? 0;
          const quantityAfter = quantityBefore + quantityToRestore;
          const minimumStock = existingBalance?.minimumStock ?? 0;

          if (existingBalance) {
            await tx
              .update(branchInventoryBalances)
              .set({
                quantityOnHand: quantityAfter,
                updatedBy: data.cancelledByUserId,
                updatedAt: new Date(),
              } as any)
              .where(eq(branchInventoryBalances.id, existingBalance.id));
          } else {
            await tx.insert(branchInventoryBalances).values({
              branchId: data.branchId,
              commercialProductId: movement.commercialProductId,
              quantityOnHand: quantityAfter,
              minimumStock,
              updatedBy: data.cancelledByUserId,
            } as any);
          }

          await this.insertBranchInventoryMovementTx(tx, {
            branchId: data.branchId,
            commercialProductId: movement.commercialProductId,
            movementType: "sale_cancellation",
            quantityDelta: quantityToRestore,
            quantityBefore,
            quantityAfter,
            unitCostSnapshot: movement.unitCostSnapshot == null ? null : toFinanceAmount(movement.unitCostSnapshot),
            reason: "Reversion automatica por cancelacion de venta",
            notes: reason,
            saleId: claimedSale.id,
            saleItemId: movement.saleItemId ?? null,
            createdBy: data.cancelledByUserId,
            metadata: {
              reversedMovementId: movement.id,
              cancellationReason: reason,
            },
          } as any);
        }

        const paymentMethods = Array.from(new Set(paymentRows.map((payment) => payment.paymentMethod)));
        await tx
          .insert(branchFinanceEntries)
          .values({
            branchId: data.branchId,
            type: "expense",
            category: "producto",
            concept: `Reverso ${claimedSale.folio}`,
            amount: String(toFinanceAmount(claimedSale.totalAmount)),
            paymentMethod: paymentMethods.length === 1 ? paymentMethods[0] : "otro",
            clientUserId: claimedSale.clientUserId ?? null,
            clientName: null,
            notes: reason,
            entryDate: getMxLocalDate(),
            createdBy: data.cancelledByUserId,
            source: "commercial_sale_cancellation",
            sourceId: claimedSale.id,
            metadata: {
              saleId: claimedSale.id,
              folio: claimedSale.folio,
              originalPaymentIds: paymentRows.map((payment) => payment.id),
              originalPaymentMethods: paymentMethods,
              reversalType: "sale_cancellation",
            },
          } as any)
          .onConflictDoNothing();

        const reversedAccruals = await this.reverseCommissionAccrualsForSaleTx(
          tx,
          data.branchId,
          claimedSale.id,
          reason,
        );

        return {
          status: "cancelled" as const,
          saleId: claimedSale.id,
          reversedAccruals,
        };
      });

      if (cancellationResult.status === "missing") {
        return undefined;
      }

      return this.getBranchSaleById(data.branchId, data.saleId);
    } catch (error: any) {
      if (idempotencyKey && isPgUniqueViolation(error)) {
        const existingSale = await this.getBranchSaleByCancellationIdempotencyKey(data.branchId, idempotencyKey);
        if (existingSale?.id === data.saleId) {
          return existingSale;
        }
        throw new Error("BRANCH_SALE_CANCELLATION_KEY_REUSED");
      }
      throw error;
    }
  }

  async getBranchCommercialProductPerformance(
    branchId: string,
    productId: string,
    filters?: { from?: string | null; to?: string | null },
  ): Promise<BranchCommercialProductPerformanceRow | undefined> {
    const product = await this.getBranchCommercialProductById(branchId, productId);
    if (!product) return undefined;

    const appliedFrom = filters?.from ?? `${getMxLocalDate().slice(0, 7)}-01`;
    const appliedTo = filters?.to ?? getMxLocalDate();

    const [summaryRows, saleRows, paymentRows, inventorySummary] = await Promise.all([
      db
        .select({
          salesCount: sql<number>`COUNT(DISTINCT ${branchSales.id})`.as("sales_count"),
          unitsSold: sql<number>`COALESCE(SUM(${branchSaleItems.quantity}), 0)`.as("units_sold"),
          revenueAmount: sql<number>`COALESCE(SUM(${branchSaleItems.lineTotalAmount}), 0)`.as("revenue_amount"),
          costAmountSold: sql<number>`COALESCE(SUM(${branchSaleItems.costAmountSnapshot} * ${branchSaleItems.quantity}), 0)`.as("cost_amount_sold"),
          grossProfitAmount: sql<number>`COALESCE(SUM(${branchSaleItems.lineTotalAmount} - (${branchSaleItems.costAmountSnapshot} * ${branchSaleItems.quantity})), 0)`.as("gross_profit_amount"),
          lastSaleAt: sql<Date | string | null>`MAX(${branchSales.createdAt})`.as("last_sale_at"),
        })
        .from(branchSaleItems)
        .innerJoin(branchSales, eq(branchSales.id, branchSaleItems.saleId))
        .where(and(
          eq(branchSaleItems.branchId, branchId),
          eq(branchSaleItems.commercialProductId, productId),
          eq(branchSales.status, "completed"),
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${appliedFrom}`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) <= ${appliedTo}`,
        ))
        .limit(1),
      db
        .select({
          saleId: branchSales.id,
          folio: branchSales.folio,
          saleDate: branchSales.createdAt,
          clientUserId: branchSales.clientUserId,
          clientDisplayName: sql<string | null>`concat_ws(' ', ${users.name}, coalesce(${users.lastName}, ''))`.as("client_display_name"),
          sellerName: branchSales.sellerNameSnapshot,
          quantitySold: sql<number>`COALESCE(SUM(${branchSaleItems.quantity}), 0)`.as("quantity_sold"),
          revenueAmount: sql<number>`COALESCE(SUM(${branchSaleItems.lineTotalAmount}), 0)`.as("revenue_amount"),
          grossProfitAmount: sql<number>`COALESCE(SUM(${branchSaleItems.lineTotalAmount} - (${branchSaleItems.costAmountSnapshot} * ${branchSaleItems.quantity})), 0)`.as("gross_profit_amount"),
        })
        .from(branchSaleItems)
        .innerJoin(branchSales, eq(branchSales.id, branchSaleItems.saleId))
        .leftJoin(users, eq(branchSales.clientUserId, users.id))
        .where(and(
          eq(branchSaleItems.branchId, branchId),
          eq(branchSaleItems.commercialProductId, productId),
          eq(branchSales.status, "completed"),
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${appliedFrom}`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) <= ${appliedTo}`,
        ))
        .groupBy(
          branchSales.id,
          branchSales.folio,
          branchSales.createdAt,
          branchSales.clientUserId,
          users.name,
          users.lastName,
          branchSales.sellerNameSnapshot,
        )
        .orderBy(desc(branchSales.createdAt))
        .limit(20),
      db
        .select({
          saleId: branchSalePayments.saleId,
          paymentMethod: branchSalePayments.paymentMethod,
        })
        .from(branchSalePayments)
        .innerJoin(branchSales, eq(branchSales.id, branchSalePayments.saleId))
        .where(and(
          eq(branchSalePayments.branchId, branchId),
          eq(branchSales.status, "completed"),
          sql`${branchSalePayments.saleId} IN (
            SELECT DISTINCT ${branchSaleItems.saleId}
            FROM ${branchSaleItems}
            INNER JOIN ${branchSales} AS sales_filter ON sales_filter.id = ${branchSaleItems.saleId}
            WHERE ${branchSaleItems.branchId} = ${branchId}
              AND ${branchSaleItems.commercialProductId} = ${productId}
              AND sales_filter.status = 'completed'
              AND DATE(sales_filter.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${appliedFrom}
              AND DATE(sales_filter.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) <= ${appliedTo}
          )`,
        )),
      this.getBranchCommercialProductInventory(branchId, productId),
    ]);

    const paymentMethodsBySaleId = new Map<string, string[]>();
    for (const row of paymentRows) {
      const current = paymentMethodsBySaleId.get(row.saleId) ?? [];
      if (!current.includes(row.paymentMethod)) {
        current.push(row.paymentMethod);
      }
      paymentMethodsBySaleId.set(row.saleId, current);
    }

    const summaryRow = summaryRows[0];
    const revenueAmount = toFinanceAmount(summaryRow?.revenueAmount);
    const grossProfitAmount = toFinanceAmount(summaryRow?.grossProfitAmount);
    const costAmountSold = toFinanceAmount(summaryRow?.costAmountSold);

    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      from: appliedFrom,
      to: appliedTo,
      salesCount: Number(summaryRow?.salesCount ?? 0),
      unitsSold: Number(summaryRow?.unitsSold ?? 0),
      revenueAmount,
      costAmountSold,
      grossProfitAmount,
      grossMarginPercent: revenueAmount > 0 ? Number(((grossProfitAmount / revenueAmount) * 100).toFixed(2)) : null,
      lastSaleAt: summaryRow?.lastSaleAt ?? null,
      quantityOnHand: inventorySummary.balance?.quantityOnHand ?? null,
      minimumStock: inventorySummary.balance?.minimumStock ?? null,
      inventoryStatus: inventorySummary.status,
      recentSales: saleRows.map((row) => ({
        saleId: row.saleId,
        folio: row.folio,
        saleDate: row.saleDate,
        clientUserId: row.clientUserId ?? null,
        clientDisplayName: row.clientDisplayName?.trim() || null,
        sellerName: row.sellerName ?? null,
        quantitySold: Number(row.quantitySold ?? 0),
        revenueAmount: toFinanceAmount(row.revenueAmount),
        grossProfitAmount: toFinanceAmount(row.grossProfitAmount),
        paymentMethods: paymentMethodsBySaleId.get(row.saleId) ?? [],
      })),
    };
  }

  async getBranchCommercialDashboard(
    branchId: string,
    month?: string | null,
  ): Promise<BranchCommercialDashboardRow> {
    const range = getMonthRangeByKey(month);
    const today = getMxLocalDate();

    const [
      salesSummaryResult,
      itemSummaryResult,
      topProductsResult,
      topCategoriesResult,
      topCustomersResult,
      firstPurchaseCustomersResult,
      inventorySummaryResult,
      commissionSummaryResult,
      purchasesSummaryResult,
      topSuppliersResult,
      topSalespeople,
    ] = await Promise.all([
      db.execute(sql<{
        salesTodayAmount: string | number | null;
        salesMonthAmount: string | number | null;
        ticketCount: string | number | null;
      }>`
        SELECT
          COALESCE(SUM(CASE WHEN DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) = ${today} THEN bs.total_amount ELSE 0 END), 0) AS "salesTodayAmount",
          COALESCE(SUM(bs.total_amount), 0) AS "salesMonthAmount",
          COUNT(*)::int AS "ticketCount"
        FROM branch_sales bs
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}
      `),
      db.execute(sql<{
        productsSoldCount: string | number | null;
        grossProfitAmount: string | number | null;
      }>`
        SELECT
          COALESCE(SUM(bsi.quantity), 0) AS "productsSoldCount",
          COALESCE(SUM(bsi.line_total_amount - (bsi.cost_amount_snapshot * bsi.quantity)), 0) AS "grossProfitAmount"
        FROM branch_sale_items bsi
        INNER JOIN branch_sales bs ON bs.id = bsi.sale_id
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}
      `),
      db.execute(sql<{
        productId: string;
        name: string | null;
        category: string | null;
        unitsSold: string | number | null;
        revenueAmount: string | number | null;
        grossProfitAmount: string | number | null;
        lastSoldAt: Date | string | null;
        usesInventory: boolean | number | null;
        quantityOnHand: string | number | null;
        minimumStock: string | number | null;
      }>`
        SELECT
          bsi.commercial_product_id AS "productId",
          MAX(bsi.name_snapshot) AS "name",
          MAX(NULLIF(bsi.category_snapshot, '')) AS "category",
          COALESCE(SUM(bsi.quantity), 0) AS "unitsSold",
          COALESCE(SUM(bsi.line_total_amount), 0) AS "revenueAmount",
          COALESCE(SUM(bsi.line_total_amount - (bsi.cost_amount_snapshot * bsi.quantity)), 0) AS "grossProfitAmount",
          MAX(bs.created_at) AS "lastSoldAt",
          MAX(CASE WHEN bcp.uses_inventory THEN 1 ELSE 0 END) AS "usesInventory",
          MAX(bib.quantity_on_hand) AS "quantityOnHand",
          MAX(bib.minimum_stock) AS "minimumStock"
        FROM branch_sale_items bsi
        INNER JOIN branch_sales bs ON bs.id = bsi.sale_id
        LEFT JOIN branch_commercial_products bcp
          ON bcp.id = bsi.commercial_product_id
         AND bcp.branch_id = ${branchId}
        LEFT JOIN branch_inventory_balances bib
          ON bib.branch_id = ${branchId}
         AND bib.commercial_product_id = bsi.commercial_product_id
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}
          AND bsi.commercial_product_id IS NOT NULL
        GROUP BY bsi.commercial_product_id
        ORDER BY COALESCE(SUM(bsi.line_total_amount), 0) DESC, MAX(bsi.name_snapshot) ASC
        LIMIT 5
      `),
      db.execute(sql<{
        category: string | null;
        unitsSold: string | number | null;
        revenueAmount: string | number | null;
        grossProfitAmount: string | number | null;
      }>`
        SELECT
          COALESCE(NULLIF(bsi.category_snapshot, ''), 'Sin categoría') AS category,
          COALESCE(SUM(bsi.quantity), 0) AS "unitsSold",
          COALESCE(SUM(bsi.line_total_amount), 0) AS "revenueAmount",
          COALESCE(SUM(bsi.line_total_amount - (bsi.cost_amount_snapshot * bsi.quantity)), 0) AS "grossProfitAmount"
        FROM branch_sale_items bsi
        INNER JOIN branch_sales bs ON bs.id = bsi.sale_id
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}
        GROUP BY COALESCE(NULLIF(bsi.category_snapshot, ''), 'Sin categoría')
        ORDER BY COALESCE(SUM(bsi.line_total_amount), 0) DESC, COALESCE(NULLIF(bsi.category_snapshot, ''), 'Sin categoría') ASC
        LIMIT 5
      `),
      db.execute(sql<{
        clientUserId: string;
        clientName: string | null;
        clientEmail: string | null;
        totalSpentAmount: string | number | null;
        salesCount: string | number | null;
        lastPurchaseAt: Date | string | null;
        firstPurchaseAt: Date | string | null;
      }>`
        SELECT
          bs.client_user_id AS "clientUserId",
          concat_ws(' ', u.name, coalesce(u.last_name, '')) AS "clientName",
          u.email AS "clientEmail",
          COALESCE(SUM(bs.total_amount), 0) AS "totalSpentAmount",
          COUNT(*)::int AS "salesCount",
          MAX(bs.created_at) AS "lastPurchaseAt",
          MIN(bs.created_at) AS "firstPurchaseAt"
        FROM branch_sales bs
        LEFT JOIN users u ON u.id = bs.client_user_id
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND bs.client_user_id IS NOT NULL
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}
        GROUP BY bs.client_user_id, u.name, u.last_name, u.email
        ORDER BY COALESCE(SUM(bs.total_amount), 0) DESC, MAX(bs.created_at) DESC
        LIMIT 5
      `),
      db.execute(sql<{
        clientUserId: string;
        clientName: string | null;
        clientEmail: string | null;
        totalSpentAmount: string | number | null;
        salesCount: string | number | null;
        lastPurchaseAt: Date | string | null;
        firstPurchaseAt: Date | string | null;
      }>`
        WITH customer_first_sales AS (
          SELECT
            bs.client_user_id AS client_user_id,
            MIN(DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE})) AS first_purchase_date
          FROM branch_sales bs
          WHERE bs.branch_id = ${branchId}
            AND bs.status = 'completed'
            AND bs.client_user_id IS NOT NULL
          GROUP BY bs.client_user_id
        )
        SELECT
          bs.client_user_id AS "clientUserId",
          concat_ws(' ', u.name, coalesce(u.last_name, '')) AS "clientName",
          u.email AS "clientEmail",
          COALESCE(SUM(bs.total_amount), 0) AS "totalSpentAmount",
          COUNT(*)::int AS "salesCount",
          MAX(bs.created_at) AS "lastPurchaseAt",
          MIN(bs.created_at) AS "firstPurchaseAt"
        FROM branch_sales bs
        INNER JOIN customer_first_sales cfs
          ON cfs.client_user_id = bs.client_user_id
        LEFT JOIN users u ON u.id = bs.client_user_id
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND bs.client_user_id IS NOT NULL
          AND cfs.first_purchase_date >= ${range.from}
          AND cfs.first_purchase_date < ${range.toExclusive}
        GROUP BY bs.client_user_id, u.name, u.last_name, u.email, cfs.first_purchase_date
        ORDER BY cfs.first_purchase_date DESC, MAX(bs.created_at) DESC
        LIMIT 5
      `),
      db.execute(sql<{
        lowStockCount: string | number | null;
        outOfStockCount: string | number | null;
        uninitializedInventoryCount: string | number | null;
        inventoryEstimatedValue: string | number | null;
      }>`
        SELECT
          COUNT(*) FILTER (WHERE bcp.uses_inventory = true AND bib.id IS NOT NULL AND bib.quantity_on_hand > 0 AND bib.quantity_on_hand <= bib.minimum_stock)::int AS "lowStockCount",
          COUNT(*) FILTER (WHERE bcp.uses_inventory = true AND bib.id IS NOT NULL AND bib.quantity_on_hand <= 0)::int AS "outOfStockCount",
          COUNT(*) FILTER (WHERE bcp.uses_inventory = true AND bib.id IS NULL)::int AS "uninitializedInventoryCount",
          COALESCE(SUM(CASE WHEN bcp.uses_inventory = true AND bib.id IS NOT NULL THEN bcp.cost_amount * bib.quantity_on_hand ELSE 0 END), 0) AS "inventoryEstimatedValue"
        FROM branch_commercial_products bcp
        LEFT JOIN branch_inventory_balances bib
          ON bib.branch_id = bcp.branch_id
         AND bib.commercial_product_id = bcp.id
        WHERE bcp.branch_id = ${branchId}
          AND bcp.deleted_at IS NULL
      `),
      db.execute(sql<{
        generatedCommissionAmount: string | number | null;
        paidCommissionAmount: string | number | null;
        pendingCommissionAmount: string | number | null;
      }>`
        SELECT
          COALESCE(SUM(CASE WHEN bca.reversed_at IS NULL THEN bca.commission_amount ELSE 0 END), 0) AS "generatedCommissionAmount",
          COALESCE(SUM(bca.paid_amount), 0) AS "paidCommissionAmount",
          COALESCE(SUM(CASE WHEN bca.reversed_at IS NULL AND bca.status IN ('accrued', 'approved', 'partially_paid') THEN GREATEST(bca.commission_amount - bca.paid_amount, 0) ELSE 0 END), 0) AS "pendingCommissionAmount"
        FROM branch_commission_accruals bca
        WHERE bca.branch_id = ${branchId}
          AND bca.period_month = ${range.monthKey}
      `),
      db.execute(sql<{
        purchasesReceivedCount: string | number | null;
        totalPurchasedAmount: string | number | null;
      }>`
        SELECT
          COUNT(*) FILTER (WHERE bp.status = 'received' AND DATE(bp.received_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from} AND DATE(bp.received_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive})::int AS "purchasesReceivedCount",
          COALESCE(SUM(CASE WHEN bp.status = 'received' AND DATE(bp.received_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from} AND DATE(bp.received_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive} THEN bp.total_amount ELSE 0 END), 0) AS "totalPurchasedAmount"
        FROM branch_purchases bp
        WHERE bp.branch_id = ${branchId}
          AND bp.status <> 'cancelled'
      `),
      db.execute(sql<{
        supplierId: string | null;
        supplierName: string | null;
        totalPurchasedAmount: string | number | null;
        purchasesCount: string | number | null;
        lastPurchaseAt: Date | string | null;
      }>`
        SELECT
          bp.supplier_id AS "supplierId",
          COALESCE(bs.name, 'Proveedor') AS "supplierName",
          COALESCE(SUM(bp.total_amount), 0) AS "totalPurchasedAmount",
          COUNT(*)::int AS "purchasesCount",
          MAX(bp.received_at) AS "lastPurchaseAt"
        FROM branch_purchases bp
        LEFT JOIN branch_suppliers bs ON bs.id = bp.supplier_id
        WHERE bp.branch_id = ${branchId}
          AND bp.status = 'received'
          AND DATE(bp.received_at AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}
          AND DATE(bp.received_at AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}
        GROUP BY bp.supplier_id, bs.name
        ORDER BY COALESCE(SUM(bp.total_amount), 0) DESC, MAX(bp.received_at) DESC
        LIMIT 5
      `),
      this.getBranchSalespeopleRanking(branchId, range.monthKey),
    ]);

    const salesSummaryRow = (salesSummaryResult.rows?.[0] ?? null) as any;
    const itemSummaryRow = (itemSummaryResult.rows?.[0] ?? null) as any;
    const inventorySummaryRow = (inventorySummaryResult.rows?.[0] ?? null) as any;
    const commissionSummaryRow = (commissionSummaryResult.rows?.[0] ?? null) as any;
    const purchasesSummaryRow = (purchasesSummaryResult.rows?.[0] ?? null) as any;

    const salesMonthAmount = toFinanceAmount(salesSummaryRow?.salesMonthAmount);
    const ticketCount = Number(salesSummaryRow?.ticketCount ?? 0);

    return {
      month: range.monthKey,
      salesTodayAmount: toFinanceAmount(salesSummaryRow?.salesTodayAmount),
      salesMonthAmount,
      ticketCount,
      averageTicketAmount: ticketCount > 0 ? Number((salesMonthAmount / ticketCount).toFixed(2)) : 0,
      productsSoldCount: Number(itemSummaryRow?.productsSoldCount ?? 0),
      grossProfitAmount: toFinanceAmount(itemSummaryRow?.grossProfitAmount),
      topProducts: (topProductsResult.rows ?? []).map((row: any) => ({
        productId: row.productId,
        name: row.name || "Producto",
        category: row.category ?? null,
        unitsSold: Number(row.unitsSold ?? 0),
        revenueAmount: toFinanceAmount(row.revenueAmount),
        grossProfitAmount: toFinanceAmount(row.grossProfitAmount),
        lastSoldAt: row.lastSoldAt ?? null,
        quantityOnHand: row.quantityOnHand == null ? null : Number(row.quantityOnHand),
        minimumStock: row.minimumStock == null ? null : Number(row.minimumStock),
        inventoryStatus: computeInventoryStatus(Number(row.usesInventory ?? 0) > 0, row.quantityOnHand == null ? null : {
          quantityOnHand: Number(row.quantityOnHand),
          minimumStock: Number(row.minimumStock ?? 0),
        }),
      })),
      topCategories: (topCategoriesResult.rows ?? []).map((row: any) => ({
        category: row.category || "Sin categoría",
        unitsSold: Number(row.unitsSold ?? 0),
        revenueAmount: toFinanceAmount(row.revenueAmount),
        grossProfitAmount: toFinanceAmount(row.grossProfitAmount),
      })),
      topSalespeople: topSalespeople.slice(0, 5),
      topCustomers: (topCustomersResult.rows ?? []).map((row: any) => ({
        clientUserId: row.clientUserId,
        clientName: row.clientName?.trim() || "Cliente",
        clientEmail: row.clientEmail ?? null,
        totalSpentAmount: toFinanceAmount(row.totalSpentAmount),
        salesCount: Number(row.salesCount ?? 0),
        lastPurchaseAt: row.lastPurchaseAt ?? null,
        firstPurchaseAt: row.firstPurchaseAt ?? null,
      })),
      firstPurchaseCustomers: (firstPurchaseCustomersResult.rows ?? []).map((row: any) => ({
        clientUserId: row.clientUserId,
        clientName: row.clientName?.trim() || "Cliente",
        clientEmail: row.clientEmail ?? null,
        totalSpentAmount: toFinanceAmount(row.totalSpentAmount),
        salesCount: Number(row.salesCount ?? 0),
        lastPurchaseAt: row.lastPurchaseAt ?? null,
        firstPurchaseAt: row.firstPurchaseAt ?? null,
      })),
      lowStockCount: Number(inventorySummaryRow?.lowStockCount ?? 0),
      outOfStockCount: Number(inventorySummaryRow?.outOfStockCount ?? 0),
      uninitializedInventoryCount: Number(inventorySummaryRow?.uninitializedInventoryCount ?? 0),
      inventoryEstimatedValue: toFinanceAmount(inventorySummaryRow?.inventoryEstimatedValue),
      generatedCommissionAmount: toFinanceAmount(commissionSummaryRow?.generatedCommissionAmount),
      paidCommissionAmount: toFinanceAmount(commissionSummaryRow?.paidCommissionAmount),
      pendingCommissionAmount: toFinanceAmount(commissionSummaryRow?.pendingCommissionAmount),
      purchasesReceivedCount: Number(purchasesSummaryRow?.purchasesReceivedCount ?? 0),
      totalPurchasedAmount: toFinanceAmount(purchasesSummaryRow?.totalPurchasedAmount),
      topSuppliers: (topSuppliersResult.rows ?? []).map((row: any) => ({
        supplierId: row.supplierId ?? null,
        supplierName: row.supplierName || "Proveedor",
        totalPurchasedAmount: toFinanceAmount(row.totalPurchasedAmount),
        purchasesCount: Number(row.purchasesCount ?? 0),
        lastPurchaseAt: row.lastPurchaseAt ?? null,
      })),
    };
  }

  async getBranchCommercialNotificationSignals(branchId: string): Promise<BranchCommercialNotificationSignals> {
    const today = getMxLocalDate();
    const monthRange = getMonthRangeByKey();

    const [inventoryResult, firstPurchaseResult, largeSalesResult, receivedPurchasesResult, ranking] = await Promise.all([
      db.execute(sql<{
        productId: string;
        productName: string | null;
        quantityOnHand: string | number | null;
        minimumStock: string | number | null;
        updatedAt: Date | string | null;
        inventoryState: string;
      }>`
        SELECT
          bcp.id AS "productId",
          bcp.name AS "productName",
          bib.quantity_on_hand AS "quantityOnHand",
          bib.minimum_stock AS "minimumStock",
          bib.updated_at AS "updatedAt",
          CASE
            WHEN bib.id IS NULL THEN 'uninitialized'
            WHEN bib.quantity_on_hand <= 0 THEN 'out_of_stock'
            WHEN bib.quantity_on_hand > 0 AND bib.quantity_on_hand <= bib.minimum_stock THEN 'low_stock'
            ELSE 'available'
          END AS "inventoryState"
        FROM branch_commercial_products bcp
        LEFT JOIN branch_inventory_balances bib
          ON bib.branch_id = bcp.branch_id
         AND bib.commercial_product_id = bcp.id
        WHERE bcp.branch_id = ${branchId}
          AND bcp.deleted_at IS NULL
          AND bcp.is_active = true
          AND bcp.uses_inventory = true
          AND (
            (bib.id IS NOT NULL AND bib.quantity_on_hand <= 0)
            OR (bib.id IS NOT NULL AND bib.quantity_on_hand > 0 AND bib.quantity_on_hand <= bib.minimum_stock)
          )
      `),
      db.execute(sql<{
        clientUserId: string;
        clientName: string | null;
        clientEmail: string | null;
        totalSpentAmount: string | number | null;
        salesCount: string | number | null;
        lastPurchaseAt: Date | string | null;
        firstPurchaseAt: Date | string | null;
      }>`
        WITH customer_first_sales AS (
          SELECT
            bs.client_user_id AS client_user_id,
            MIN(DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE})) AS first_purchase_date
          FROM branch_sales bs
          WHERE bs.branch_id = ${branchId}
            AND bs.status = 'completed'
            AND bs.client_user_id IS NOT NULL
          GROUP BY bs.client_user_id
        )
        SELECT
          bs.client_user_id AS "clientUserId",
          concat_ws(' ', u.name, coalesce(u.last_name, '')) AS "clientName",
          u.email AS "clientEmail",
          COALESCE(SUM(bs.total_amount), 0) AS "totalSpentAmount",
          COUNT(*)::int AS "salesCount",
          MAX(bs.created_at) AS "lastPurchaseAt",
          MIN(bs.created_at) AS "firstPurchaseAt"
        FROM branch_sales bs
        INNER JOIN customer_first_sales cfs
          ON cfs.client_user_id = bs.client_user_id
        LEFT JOIN users u ON u.id = bs.client_user_id
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND bs.client_user_id IS NOT NULL
          AND cfs.first_purchase_date = ${today}
        GROUP BY bs.client_user_id, u.name, u.last_name, u.email
        ORDER BY MAX(bs.created_at) DESC
      `),
      db.execute(sql<{
        saleId: string;
        folio: string;
        totalAmount: string | number | null;
        clientUserId: string | null;
        clientDisplayName: string | null;
        sellerId: string | null;
        sellerName: string | null;
        createdAt: Date | string;
      }>`
        SELECT
          bs.id AS "saleId",
          bs.folio,
          bs.total_amount AS "totalAmount",
          bs.client_user_id AS "clientUserId",
          concat_ws(' ', u.name, coalesce(u.last_name, '')) AS "clientDisplayName",
          bs.seller_id AS "sellerId",
          bs.seller_name_snapshot AS "sellerName",
          bs.created_at AS "createdAt"
        FROM branch_sales bs
        LEFT JOIN users u ON u.id = bs.client_user_id
        WHERE bs.branch_id = ${branchId}
          AND bs.status = 'completed'
          AND DATE(bs.created_at AT TIME ZONE ${BRANCH_TIMEZONE}) = ${today}
          AND bs.total_amount >= ${COMMERCIAL_LARGE_SALE_THRESHOLD}
        ORDER BY bs.total_amount DESC, bs.created_at DESC
      `),
      db.execute(sql<{
        purchaseId: string;
        folio: string;
        supplierId: string | null;
        supplierName: string | null;
        receivedAt: Date | string | null;
        totalAmount: string | number | null;
      }>`
        SELECT
          bp.id AS "purchaseId",
          bp.folio,
          bp.supplier_id AS "supplierId",
          COALESCE(bs.name, 'Proveedor') AS "supplierName",
          bp.received_at AS "receivedAt",
          bp.total_amount AS "totalAmount"
        FROM branch_purchases bp
        LEFT JOIN branch_suppliers bs ON bs.id = bp.supplier_id
        WHERE bp.branch_id = ${branchId}
          AND bp.status = 'received'
          AND DATE(bp.received_at AT TIME ZONE ${BRANCH_TIMEZONE}) = ${today}
        ORDER BY bp.received_at DESC
      `),
      this.getBranchSalespeopleRanking(branchId, monthRange.monthKey),
    ]);

    const lowStockProducts: BranchCommercialNotificationSignals["lowStockProducts"] = [];
    const outOfStockProducts: BranchCommercialNotificationSignals["outOfStockProducts"] = [];

    for (const row of inventoryResult.rows ?? []) {
      const mapped = {
        productId: (row as any).productId,
        productName: (row as any).productName || "Producto",
        quantityOnHand: Number((row as any).quantityOnHand ?? 0),
        minimumStock: Number((row as any).minimumStock ?? 0),
        updatedAt: (row as any).updatedAt ?? new Date(),
      };

      if ((row as any).inventoryState === "out_of_stock") {
        outOfStockProducts.push(mapped);
      } else if ((row as any).inventoryState === "low_stock") {
        lowStockProducts.push(mapped);
      }
    }

    return {
      lowStockProducts,
      outOfStockProducts,
      firstPurchaseCustomers: (firstPurchaseResult.rows ?? []).map((row: any) => ({
        clientUserId: row.clientUserId,
        clientName: row.clientName?.trim() || "Cliente",
        clientEmail: row.clientEmail ?? null,
        totalSpentAmount: toFinanceAmount(row.totalSpentAmount),
        salesCount: Number(row.salesCount ?? 0),
        lastPurchaseAt: row.lastPurchaseAt ?? null,
        firstPurchaseAt: row.firstPurchaseAt ?? null,
      })),
      goalReachedSalespeople: ranking.filter((row) => (row.monthlyGoalAmount ?? 0) > 0 && (row.goalProgressPercent ?? 0) >= 100),
      largeSales: (largeSalesResult.rows ?? []).map((row: any) => ({
        saleId: row.saleId,
        folio: row.folio,
        totalAmount: toFinanceAmount(row.totalAmount),
        clientUserId: row.clientUserId ?? null,
        clientDisplayName: row.clientDisplayName?.trim() || null,
        sellerId: row.sellerId ?? null,
        sellerName: row.sellerName ?? null,
        createdAt: row.createdAt,
      })),
      receivedPurchases: (receivedPurchasesResult.rows ?? []).map((row: any) => ({
        purchaseId: row.purchaseId,
        folio: row.folio,
        supplierId: row.supplierId ?? null,
        supplierName: row.supplierName || "Proveedor",
        receivedAt: row.receivedAt ?? null,
        totalAmount: toFinanceAmount(row.totalAmount),
      })),
      pendingCommissions: ranking.filter((row) => row.pendingCommissionAmount > 0),
    };
  }

  async getBranchCommercialProductInventoryMovements(
    branchId: string,
    productId: string,
    limit = 50,
  ): Promise<BranchInventoryMovementRow[]> {
    const rows = await db
      .select()
      .from(branchInventoryMovements)
      .where(and(
        eq(branchInventoryMovements.branchId, branchId),
        eq(branchInventoryMovements.commercialProductId, productId),
      ))
      .orderBy(desc(branchInventoryMovements.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));

    return rows.map((row) => this.mapBranchInventoryMovementRow(row));
  }

  async getBranchCommercialProductInventory(branchId: string, productId: string): Promise<BranchInventorySummaryRow> {
    const product = await this.getBranchCommercialProductById(branchId, productId);
    if (!product) {
      throw new Error("COMMERCIAL_PRODUCT_NOT_FOUND");
    }

    const [balance, movementCountRow, recentMovements] = await Promise.all([
      db
        .select()
        .from(branchInventoryBalances)
        .where(and(
          eq(branchInventoryBalances.branchId, branchId),
          eq(branchInventoryBalances.commercialProductId, productId),
        ))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ count: sql<number>`COUNT(*)`.as("count") })
        .from(branchInventoryMovements)
        .where(and(
          eq(branchInventoryMovements.branchId, branchId),
          eq(branchInventoryMovements.commercialProductId, productId),
        ))
        .limit(1)
        .then((rows) => rows[0] ?? { count: 0 }),
      this.getBranchCommercialProductInventoryMovements(branchId, productId, 20),
    ]);

    const mappedBalance = balance ? this.mapBranchInventoryBalanceRow(balance, product.usesInventory) : null;

    return {
      productId,
      usesInventory: product.usesInventory,
      balance: mappedBalance,
      status: computeInventoryStatus(product.usesInventory, mappedBalance ? {
        quantityOnHand: mappedBalance.quantityOnHand,
        minimumStock: mappedBalance.minimumStock,
      } : null),
      movementCount: Number(movementCountRow.count) || 0,
      recentMovements,
    };
  }

  async createBranchCommercialProduct(data: InsertBranchCommercialProduct): Promise<BranchCommercialProductRow> {
    const [product] = await db.insert(branchCommercialProducts).values(data).returning();
    return this.mapBranchCommercialProductRow(product);
  }

  async updateBranchCommercialProduct(
    branchId: string,
    productId: string,
    data: Partial<InsertBranchCommercialProduct>,
  ): Promise<BranchCommercialProductRow | undefined> {
    const [product] = await db
      .update(branchCommercialProducts)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(branchCommercialProducts.id, productId),
        eq(branchCommercialProducts.branchId, branchId),
        isNull(branchCommercialProducts.deletedAt),
      ))
      .returning();

    return product ? this.mapBranchCommercialProductRow(product) : undefined;
  }

  async softDeleteBranchCommercialProduct(branchId: string, productId: string): Promise<boolean> {
    const [deleted] = await db
      .update(branchCommercialProducts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(branchCommercialProducts.id, productId),
        eq(branchCommercialProducts.branchId, branchId),
        isNull(branchCommercialProducts.deletedAt),
      ))
      .returning({ id: branchCommercialProducts.id });

    return !!deleted;
  }

  async getBranchSalespeople(
    branchId: string,
    filters?: { isActive?: boolean | null },
  ): Promise<BranchSalespersonRow[]> {
    const whereClauses = [
      eq(branchSalespeople.branchId, branchId),
      isNull(branchSalespeople.deletedAt),
    ];
    if (filters?.isActive !== undefined && filters?.isActive !== null) {
      whereClauses.push(eq(branchSalespeople.isActive, filters.isActive));
    }

    const rows = await db
      .select()
      .from(branchSalespeople)
      .where(and(...whereClauses))
      .orderBy(desc(branchSalespeople.isActive), asc(branchSalespeople.name), asc(branchSalespeople.lastName));

    return rows.map((row) => this.mapBranchSalespersonRow(row));
  }

  async getBranchSalespersonById(branchId: string, salespersonId: string): Promise<BranchSalespersonRow | undefined> {
    const [row] = await db
      .select()
      .from(branchSalespeople)
      .where(and(
        eq(branchSalespeople.branchId, branchId),
        eq(branchSalespeople.id, salespersonId),
        isNull(branchSalespeople.deletedAt),
      ))
      .limit(1);

    return row ? this.mapBranchSalespersonRow(row) : undefined;
  }

  async getBranchSalespeopleRanking(
    branchId: string,
    month?: string | null,
  ): Promise<BranchCommercialDashboardTopSalespersonRow[]> {
    const salespeople = await this.getBranchSalespeople(branchId);
    if (!salespeople.length) return [];

    const range = getMonthRangeByKey(month);

    const [salesRows, itemRows, commissionRows] = await Promise.all([
      db
        .select({
          salespersonId: branchSales.sellerId,
          totalSoldAmount: sql<number>`COALESCE(SUM(${branchSales.totalAmount}), 0)`.as("total_sold_amount"),
          salesCount: sql<number>`COUNT(*)`.as("sales_count"),
          customersCount: sql<number>`COUNT(DISTINCT ${branchSales.clientUserId})`.as("customers_count"),
          lastSaleAt: sql<Date | string | null>`MAX(${branchSales.createdAt})`.as("last_sale_at"),
        })
        .from(branchSales)
        .where(and(
          eq(branchSales.branchId, branchId),
          eq(branchSales.status, "completed"),
          sql`${branchSales.sellerId} IS NOT NULL`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}`,
        ))
        .groupBy(branchSales.sellerId),
      db
        .select({
          salespersonId: branchSales.sellerId,
          productsSoldCount: sql<number>`COALESCE(SUM(${branchSaleItems.quantity}), 0)`.as("products_sold_count"),
        })
        .from(branchSales)
        .innerJoin(branchSaleItems, eq(branchSaleItems.saleId, branchSales.id))
        .where(and(
          eq(branchSales.branchId, branchId),
          eq(branchSales.status, "completed"),
          sql`${branchSales.sellerId} IS NOT NULL`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}`,
        ))
        .groupBy(branchSales.sellerId),
      db
        .select({
          salespersonId: branchCommissionAccruals.salespersonId,
          generatedCommissionAmount: sql<number>`COALESCE(SUM(CASE WHEN ${branchCommissionAccruals.reversedAt} IS NULL THEN ${branchCommissionAccruals.commissionAmount} ELSE 0 END), 0)`.as("generated_commission_amount"),
          paidCommissionAmount: sql<number>`COALESCE(SUM(${branchCommissionAccruals.paidAmount}), 0)`.as("paid_commission_amount"),
          pendingCommissionAmount: sql<number>`COALESCE(SUM(CASE WHEN ${branchCommissionAccruals.reversedAt} IS NULL AND ${branchCommissionAccruals.status} IN ('accrued', 'approved', 'partially_paid') THEN GREATEST(${branchCommissionAccruals.commissionAmount} - ${branchCommissionAccruals.paidAmount}, 0) ELSE 0 END), 0)`.as("pending_commission_amount"),
        })
        .from(branchCommissionAccruals)
        .where(and(
          eq(branchCommissionAccruals.branchId, branchId),
          eq(branchCommissionAccruals.periodMonth, range.monthKey),
        ))
        .groupBy(branchCommissionAccruals.salespersonId),
    ]);

    const salesMap = new Map(
      salesRows
        .filter((row) => typeof row.salespersonId === "string" && row.salespersonId)
        .map((row) => [row.salespersonId as string, row]),
    );
    const itemsMap = new Map(
      itemRows
        .filter((row) => typeof row.salespersonId === "string" && row.salespersonId)
        .map((row) => [row.salespersonId as string, row]),
    );
    const commissionMap = new Map(
      commissionRows.map((row) => [row.salespersonId, row]),
    );

    return salespeople
      .map((salesperson) => {
        const salesRow = salesMap.get(salesperson.id);
        const itemRow = itemsMap.get(salesperson.id);
        const commissionRow = commissionMap.get(salesperson.id);
        const totalSoldAmount = toFinanceAmount(salesRow?.totalSoldAmount);
        const salesCount = Number(salesRow?.salesCount ?? 0);
        const averageTicketAmount = salesCount > 0 ? Number((totalSoldAmount / salesCount).toFixed(2)) : 0;
        const goal = salesperson.monthlyGoalAmount;

        return {
          salespersonId: salesperson.id,
          name: `${salesperson.name}${salesperson.lastName ? ` ${salesperson.lastName}` : ""}`.trim(),
          totalSoldAmount,
          salesCount,
          averageTicketAmount,
          productsSoldCount: Number(itemRow?.productsSoldCount ?? 0),
          customersCount: Number(salesRow?.customersCount ?? 0),
          generatedCommissionAmount: toFinanceAmount(commissionRow?.generatedCommissionAmount),
          paidCommissionAmount: toFinanceAmount(commissionRow?.paidCommissionAmount),
          pendingCommissionAmount: toFinanceAmount(commissionRow?.pendingCommissionAmount),
          monthlyGoalAmount: goal,
          goalProgressPercent: goal && goal > 0 ? Number(Math.min(100, (totalSoldAmount / goal) * 100).toFixed(2)) : null,
          lastSaleAt: salesRow?.lastSaleAt ?? null,
        } satisfies BranchCommercialDashboardTopSalespersonRow;
      })
      .sort((a, b) => {
        if (b.totalSoldAmount !== a.totalSoldAmount) return b.totalSoldAmount - a.totalSoldAmount;
        if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
        return a.name.localeCompare(b.name, "es-MX");
      });
  }

  async createBranchSalesperson(data: InsertBranchSalesperson): Promise<BranchSalespersonRow> {
    const [created] = await db.insert(branchSalespeople).values(data).returning();
    return this.mapBranchSalespersonRow(created);
  }

  async updateBranchSalesperson(
    branchId: string,
    salespersonId: string,
    data: Partial<InsertBranchSalesperson>,
  ): Promise<BranchSalespersonRow | undefined> {
    const [updated] = await db
      .update(branchSalespeople)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(branchSalespeople.branchId, branchId),
        eq(branchSalespeople.id, salespersonId),
        isNull(branchSalespeople.deletedAt),
      ))
      .returning();

    return updated ? this.mapBranchSalespersonRow(updated) : undefined;
  }

  async softDeleteBranchSalesperson(branchId: string, salespersonId: string): Promise<boolean> {
    const [deleted] = await db
      .update(branchSalespeople)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(branchSalespeople.branchId, branchId),
        eq(branchSalespeople.id, salespersonId),
        isNull(branchSalespeople.deletedAt),
      ))
      .returning({ id: branchSalespeople.id });

    return !!deleted;
  }

  async getBranchSalespersonSummary(
    branchId: string,
    salespersonId: string,
    month?: string | null,
  ): Promise<BranchSalespersonSummaryRow | undefined> {
    const salesperson = await this.getBranchSalespersonById(branchId, salespersonId);
    if (!salesperson) return undefined;

    const range = getMonthRangeByKey(month);
    const [summaryRow] = await db
      .select({
        totalSoldAmount: sql<number>`COALESCE(SUM(${branchSales.totalAmount}), 0)`.as("total_sold_amount"),
        salesCount: sql<number>`COUNT(DISTINCT ${branchSales.id})`.as("sales_count"),
        productsSoldCount: sql<number>`COALESCE(SUM(${branchSaleItems.quantity}), 0)`.as("products_sold_count"),
      })
      .from(branchSales)
      .leftJoin(branchSaleItems, eq(branchSaleItems.saleId, branchSales.id))
      .where(and(
        eq(branchSales.branchId, branchId),
        eq(branchSales.sellerId, salespersonId),
        ne(branchSales.status, "cancelled"),
        sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}`,
        sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}`,
      ))
      .limit(1);

    const totalSoldAmount = toFinanceAmount(summaryRow?.totalSoldAmount);
    const salesCount = Number(summaryRow?.salesCount ?? 0);
    const productsSoldCount = Number(summaryRow?.productsSoldCount ?? 0);
    const averageTicketAmount = salesCount > 0 ? Number((totalSoldAmount / salesCount).toFixed(2)) : 0;
    const goal = salesperson.monthlyGoalAmount;

    return {
      salespersonId,
      branchId,
      month: range.monthKey,
      totalSoldAmount,
      salesCount,
      averageTicketAmount,
      productsSoldCount,
      monthlyGoalAmount: goal,
      goalProgressPercent: goal && goal > 0 ? Number(Math.min(100, (totalSoldAmount / goal) * 100).toFixed(2)) : null,
    };
  }

  async getBranchSalespersonSales(
    branchId: string,
    salespersonId: string,
    month?: string | null,
  ): Promise<BranchSaleRow[]> {
    const salesperson = await this.getBranchSalespersonById(branchId, salespersonId);
    if (!salesperson) return [];

    const range = getMonthRangeByKey(month);
    const saleRows = await db
      .select({ id: branchSales.id })
      .from(branchSales)
      .where(and(
        eq(branchSales.branchId, branchId),
        eq(branchSales.sellerId, salespersonId),
        ne(branchSales.status, "cancelled"),
        sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}`,
        sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}`,
      ))
      .orderBy(desc(branchSales.createdAt));

    const sales = await Promise.all(
      saleRows.map((row) => this.getBranchSaleById(branchId, row.id)),
    );

    return sales.filter((row): row is BranchSaleRow => !!row);
  }

  async getBranchCommissionRules(branchId: string, salespersonId: string): Promise<BranchCommissionRuleRow[]> {
    const rows = await db
      .select()
      .from(branchCommissionRules)
      .where(and(
        eq(branchCommissionRules.branchId, branchId),
        eq(branchCommissionRules.salespersonId, salespersonId),
        isNull(branchCommissionRules.deletedAt),
      ))
      .orderBy(desc(branchCommissionRules.isActive), desc(branchCommissionRules.priority), desc(branchCommissionRules.createdAt));

    return rows.map((row) => this.mapBranchCommissionRuleRow(row));
  }

  async getBranchCommissionRuleById(branchId: string, ruleId: string): Promise<BranchCommissionRuleRow | undefined> {
    const [row] = await db
      .select()
      .from(branchCommissionRules)
      .where(and(
        eq(branchCommissionRules.branchId, branchId),
        eq(branchCommissionRules.id, ruleId),
        isNull(branchCommissionRules.deletedAt),
      ))
      .limit(1);

    return row ? this.mapBranchCommissionRuleRow(row) : undefined;
  }

  async createBranchCommissionRule(data: InsertBranchCommissionRule): Promise<BranchCommissionRuleRow> {
    const [created] = await db.insert(branchCommissionRules).values(data).returning();
    return this.mapBranchCommissionRuleRow(created);
  }

  async updateBranchCommissionRule(
    branchId: string,
    ruleId: string,
    data: Partial<InsertBranchCommissionRule>,
  ): Promise<BranchCommissionRuleRow | undefined> {
    const [updated] = await db
      .update(branchCommissionRules)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(branchCommissionRules.branchId, branchId),
        eq(branchCommissionRules.id, ruleId),
        isNull(branchCommissionRules.deletedAt),
      ))
      .returning();

    return updated ? this.mapBranchCommissionRuleRow(updated) : undefined;
  }

  async softDeleteBranchCommissionRule(branchId: string, ruleId: string): Promise<boolean> {
    const [deleted] = await db
      .update(branchCommissionRules)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(branchCommissionRules.branchId, branchId),
        eq(branchCommissionRules.id, ruleId),
        isNull(branchCommissionRules.deletedAt),
      ))
      .returning({ id: branchCommissionRules.id });

    return !!deleted;
  }

  async getBranchSalespersonCommissions(
    branchId: string,
    salespersonId: string,
    month?: string | null,
  ): Promise<BranchCommissionAccrualRow[]> {
    const salesperson = await this.getBranchSalespersonById(branchId, salespersonId);
    if (!salesperson) return [];

    const range = getMonthRangeByKey(month);
    const rows = await db
      .select()
      .from(branchCommissionAccruals)
      .where(and(
        eq(branchCommissionAccruals.branchId, branchId),
        eq(branchCommissionAccruals.salespersonId, salespersonId),
        eq(branchCommissionAccruals.periodMonth, range.monthKey),
      ))
      .orderBy(desc(branchCommissionAccruals.accruedAt), desc(branchCommissionAccruals.createdAt));

    return rows.map((row) => this.mapBranchCommissionAccrualRow(row));
  }

  async getBranchSalespersonCommissionSummary(
    branchId: string,
    salespersonId: string,
    month?: string | null,
  ): Promise<BranchSalespersonCommissionSummaryRow | undefined> {
    const salesSummary = await this.getBranchSalespersonSummary(branchId, salespersonId, month);
    if (!salesSummary) return undefined;

    const [summaryRow] = await db
      .select({
        generatedCommissionAmount: sql<number>`COALESCE(SUM(CASE WHEN ${branchCommissionAccruals.reversedAt} IS NULL THEN ${branchCommissionAccruals.commissionAmount} ELSE 0 END), 0)`.as("generated_commission_amount"),
        approvedCommissionAmount: sql<number>`COALESCE(SUM(CASE WHEN ${branchCommissionAccruals.reversedAt} IS NULL AND ${branchCommissionAccruals.status} IN ('approved', 'partially_paid', 'paid') THEN ${branchCommissionAccruals.commissionAmount} ELSE 0 END), 0)`.as("approved_commission_amount"),
        paidCommissionAmount: sql<number>`COALESCE(SUM(${branchCommissionAccruals.paidAmount}), 0)`.as("paid_commission_amount"),
        pendingCommissionAmount: sql<number>`COALESCE(SUM(CASE WHEN ${branchCommissionAccruals.reversedAt} IS NULL AND ${branchCommissionAccruals.status} IN ('accrued', 'approved', 'partially_paid') THEN GREATEST(${branchCommissionAccruals.commissionAmount} - ${branchCommissionAccruals.paidAmount}, 0) ELSE 0 END), 0)`.as("pending_commission_amount"),
        reversedCommissionAmount: sql<number>`COALESCE(SUM(CASE WHEN ${branchCommissionAccruals.reversedAt} IS NOT NULL OR ${branchCommissionAccruals.status} = 'reversed' THEN ${branchCommissionAccruals.commissionAmount} ELSE 0 END), 0)`.as("reversed_commission_amount"),
        bonusGeneratedAmount: sql<number>`COALESCE(SUM(CASE WHEN ${branchCommissionAccruals.reversedAt} IS NULL AND ${branchCommissionAccruals.accrualType} = 'monthly_bonus' THEN ${branchCommissionAccruals.commissionAmount} ELSE 0 END), 0)`.as("bonus_generated_amount"),
      })
      .from(branchCommissionAccruals)
      .where(and(
        eq(branchCommissionAccruals.branchId, branchId),
        eq(branchCommissionAccruals.salespersonId, salespersonId),
        eq(branchCommissionAccruals.periodMonth, salesSummary.month),
      ))
      .limit(1);

    return {
      ...salesSummary,
      generatedCommissionAmount: toFinanceAmount(summaryRow?.generatedCommissionAmount),
      approvedCommissionAmount: toFinanceAmount(summaryRow?.approvedCommissionAmount),
      paidCommissionAmount: toFinanceAmount(summaryRow?.paidCommissionAmount),
      pendingCommissionAmount: toFinanceAmount(summaryRow?.pendingCommissionAmount),
      reversedCommissionAmount: toFinanceAmount(summaryRow?.reversedCommissionAmount),
      bonusGeneratedAmount: toFinanceAmount(summaryRow?.bonusGeneratedAmount),
    };
  }

  async getBranchSalespersonCommissionPayments(
    branchId: string,
    salespersonId: string,
    month?: string | null,
  ): Promise<BranchCommissionPaymentRow[]> {
    const salesperson = await this.getBranchSalespersonById(branchId, salespersonId);
    if (!salesperson) return [];

    const range = getMonthRangeByKey(month);
    const paymentRows = await db
      .select()
      .from(branchCommissionPayments)
      .where(and(
        eq(branchCommissionPayments.branchId, branchId),
        eq(branchCommissionPayments.salespersonId, salespersonId),
        sql`DATE(${branchCommissionPayments.paidAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${range.from}`,
        sql`DATE(${branchCommissionPayments.paidAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${range.toExclusive}`,
      ))
      .orderBy(desc(branchCommissionPayments.paidAt), desc(branchCommissionPayments.createdAt));

    if (!paymentRows.length) return [];

    const paymentIds = paymentRows.map((row) => row.id);
    const allocationRows = await db
      .select()
      .from(branchCommissionPaymentAllocations)
      .where(and(
        eq(branchCommissionPaymentAllocations.branchId, branchId),
        inArray(branchCommissionPaymentAllocations.commissionPaymentId, paymentIds),
      ));

    const allocationMap = new Map<string, BranchCommissionPaymentAllocationRow[]>();
    allocationRows.forEach((row) => {
      const current = allocationMap.get(row.commissionPaymentId) ?? [];
      current.push(this.mapBranchCommissionPaymentAllocationRow(row));
      allocationMap.set(row.commissionPaymentId, current);
    });

    return paymentRows.map((row) => this.mapBranchCommissionPaymentRow(row, allocationMap.get(row.id) ?? []));
  }

  async getBranchCommissionPaymentById(
    branchId: string,
    paymentId: string,
  ): Promise<BranchCommissionPaymentDetailRow | undefined> {
    const [paymentRow] = await db
      .select()
      .from(branchCommissionPayments)
      .where(and(
        eq(branchCommissionPayments.branchId, branchId),
        eq(branchCommissionPayments.id, paymentId),
      ))
      .limit(1);

    if (!paymentRow) return undefined;

    const [allocationRows, salesperson] = await Promise.all([
      db
        .select()
        .from(branchCommissionPaymentAllocations)
        .where(and(
          eq(branchCommissionPaymentAllocations.branchId, branchId),
          eq(branchCommissionPaymentAllocations.commissionPaymentId, paymentId),
        )),
      this.getBranchSalespersonById(branchId, paymentRow.salespersonId),
    ]);

    const mapped = this.mapBranchCommissionPaymentRow(
      paymentRow,
      allocationRows.map((row) => this.mapBranchCommissionPaymentAllocationRow(row)),
    );

    return {
      ...mapped,
      salespersonName: salesperson
        ? `${salesperson.name}${salesperson.lastName ? ` ${salesperson.lastName}` : ""}`.trim()
        : paymentRow.salespersonId,
      totalAllocatedAmount: Number(
        mapped.allocations?.reduce((sum, allocation) => sum + allocation.amountAllocated, 0).toFixed(2) ?? 0,
      ),
    };
  }

  async createBranchSalespersonCommissionPayment(data: {
    branchId: string;
    salespersonId: string;
    amount: number;
    paymentMethod: string;
    idempotencyKey?: string | null;
    reference?: string | null;
    notes?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    accrualIds?: string[] | null;
    paidAt?: Date | null;
    createdBy?: string | null;
  }): Promise<BranchCommissionPaymentRow> {
    const salesperson = await this.getBranchSalespersonById(data.branchId, data.salespersonId);
    if (!salesperson) {
      throw new Error("BRANCH_SALESPERSON_NOT_FOUND");
    }

    const idempotencyKey = normalizeOptionalTextValue(data.idempotencyKey);
    if (idempotencyKey) {
      const existingPayment = await this.getBranchCommissionPaymentByIdempotencyKey(data.branchId, idempotencyKey);
      if (existingPayment) {
        return existingPayment;
      }
    }

    try {
      const payment = await db.transaction(async (tx) => {
        const whereClauses = [
          eq(branchCommissionAccruals.branchId, data.branchId),
          eq(branchCommissionAccruals.salespersonId, data.salespersonId),
          isNull(branchCommissionAccruals.reversedAt),
          inArray(branchCommissionAccruals.status, ["accrued", "approved", "partially_paid"]),
        ];
        if (data.accrualIds?.length) {
          whereClauses.push(inArray(branchCommissionAccruals.id, data.accrualIds));
        }
        if (data.periodStart) {
          whereClauses.push(sql`DATE(${branchCommissionAccruals.accruedAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${data.periodStart}`);
        }
        if (data.periodEnd) {
          whereClauses.push(sql`DATE(${branchCommissionAccruals.accruedAt} AT TIME ZONE ${BRANCH_TIMEZONE}) <= ${data.periodEnd}`);
        }

        const initialAccrualRows = await tx
          .select({ id: branchCommissionAccruals.id })
          .from(branchCommissionAccruals)
          .where(and(...whereClauses))
          .orderBy(asc(branchCommissionAccruals.accruedAt), asc(branchCommissionAccruals.createdAt));

        const candidateAccrualIds = initialAccrualRows.map((row) => row.id);
        await this.lockBranchCommissionAccrualIdsTx(tx, data.branchId, candidateAccrualIds);

        const accrualRows = candidateAccrualIds.length > 0
          ? await tx
              .select()
              .from(branchCommissionAccruals)
              .where(and(
                eq(branchCommissionAccruals.branchId, data.branchId),
                inArray(branchCommissionAccruals.id, candidateAccrualIds),
                isNull(branchCommissionAccruals.reversedAt),
                inArray(branchCommissionAccruals.status, ["accrued", "approved", "partially_paid"]),
              ))
              .orderBy(asc(branchCommissionAccruals.accruedAt), asc(branchCommissionAccruals.createdAt))
          : [];

        const mappedAccruals = accrualRows
          .map((row) => this.mapBranchCommissionAccrualRow(row))
          .map((row) => ({
            ...row,
            pendingAmount: Math.max(0, Number((row.commissionAmount - row.paidAmount).toFixed(2))),
          }))
          .filter((row) => row.pendingAmount > 0);

        const totalPending = Number(mappedAccruals.reduce((sum, row) => sum + row.pendingAmount, 0).toFixed(2));
        if (totalPending <= 0) {
          throw new Error("BRANCH_COMMISSION_NOTHING_TO_PAY");
        }
        if (Number(data.amount.toFixed(2)) > totalPending + 0.0001) {
          throw new Error("BRANCH_COMMISSION_PAYMENT_EXCEEDS_PENDING");
        }

        let remaining = Number(data.amount.toFixed(2));
        const allocationsToCreate: InsertBranchCommissionPaymentAllocation[] = [];
        const accrualUpdates: Array<{ id: string; nextPaidAmount: number; nextStatus: string }> = [];

        for (const accrual of mappedAccruals) {
          if (remaining <= 0) break;
          const allocated = Number(Math.min(remaining, accrual.pendingAmount).toFixed(2));
          if (allocated <= 0) continue;
          const nextPaidAmount = Number((accrual.paidAmount + allocated).toFixed(2));
          const nextStatus = nextPaidAmount + 0.0001 >= accrual.commissionAmount ? "paid" : "partially_paid";
          accrualUpdates.push({ id: accrual.id, nextPaidAmount, nextStatus });
          allocationsToCreate.push({
            branchId: data.branchId,
            commissionPaymentId: "" as any,
            commissionAccrualId: accrual.id,
            amountAllocated: String(allocated) as any,
          });
          remaining = Number((remaining - allocated).toFixed(2));
        }

        if (remaining > 0.0001) {
          throw new Error("BRANCH_COMMISSION_PAYMENT_ALLOCATION_INCOMPLETE");
        }

        const [paymentRow] = await tx
          .insert(branchCommissionPayments)
          .values({
            branchId: data.branchId,
            salespersonId: data.salespersonId,
            amount: String(toFinanceAmount(data.amount)),
            paymentMethod: data.paymentMethod,
            idempotencyKey,
            reference: normalizeOptionalTextValue(data.reference),
            notes: normalizeOptionalTextValue(data.notes),
            periodStart: data.periodStart ?? null,
            periodEnd: data.periodEnd ?? null,
            paidAt: data.paidAt ?? new Date(),
            createdBy: data.createdBy ?? null,
          } as any)
          .returning();

        if (allocationsToCreate.length > 0) {
          await tx.insert(branchCommissionPaymentAllocations).values(
            allocationsToCreate.map((allocation) => ({
              ...allocation,
              commissionPaymentId: paymentRow.id,
            })) as any,
          );
        }

        for (const update of accrualUpdates) {
          await tx
            .update(branchCommissionAccruals)
            .set({
              paidAmount: String(update.nextPaidAmount),
              status: update.nextStatus,
            } as any)
            .where(and(
              eq(branchCommissionAccruals.id, update.id),
              eq(branchCommissionAccruals.branchId, data.branchId),
            ));
        }

        await tx.insert(branchFinanceEntries).values({
          branchId: data.branchId,
          type: "expense",
          category: "sales_commission",
          concept: `Comision pagada a ${salesperson.name}${salesperson.lastName ? ` ${salesperson.lastName}` : ""}`.trim(),
          amount: String(toFinanceAmount(data.amount)),
          paymentMethod: data.paymentMethod,
          clientUserId: null,
          clientName: null,
          notes: normalizeOptionalTextValue(data.notes),
          entryDate: (data.paidAt ?? new Date()).toLocaleDateString("en-CA", { timeZone: BRANCH_TIMEZONE }),
          source: "sales_commission_payment",
          sourceId: paymentRow.id,
          metadata: {
            commissionPaymentId: paymentRow.id,
            salespersonId: data.salespersonId,
            salespersonName: `${salesperson.name}${salesperson.lastName ? ` ${salesperson.lastName}` : ""}`.trim(),
            periodStart: data.periodStart ?? null,
            periodEnd: data.periodEnd ?? null,
            allocations: allocationsToCreate.map((allocation) => ({
              commissionAccrualId: allocation.commissionAccrualId,
              amountAllocated: Number(allocation.amountAllocated),
            })),
          },
          createdBy: data.createdBy ?? null,
        } as any);

        const createdAllocations = await tx
          .select()
          .from(branchCommissionPaymentAllocations)
          .where(and(
            eq(branchCommissionPaymentAllocations.branchId, data.branchId),
            eq(branchCommissionPaymentAllocations.commissionPaymentId, paymentRow.id),
          ));

        return this.mapBranchCommissionPaymentRow(
          paymentRow,
          createdAllocations.map((row) => this.mapBranchCommissionPaymentAllocationRow(row)),
        );
      });

      return payment;
    } catch (error: any) {
      if (idempotencyKey && isPgUniqueViolation(error)) {
        const existingPayment = await this.getBranchCommissionPaymentByIdempotencyKey(data.branchId, idempotencyKey);
        if (existingPayment) {
          return existingPayment;
        }
      }
      throw error;
    }
  }

  async getBranchSuppliers(branchId: string): Promise<BranchSupplierRow[]> {
    const rows = await db
      .select()
      .from(branchSuppliers)
      .where(and(
        eq(branchSuppliers.branchId, branchId),
        isNull(branchSuppliers.deletedAt),
      ))
      .orderBy(desc(branchSuppliers.isActive), asc(branchSuppliers.name), desc(branchSuppliers.createdAt));

    return rows.map((row) => this.mapBranchSupplierRow(row));
  }

  async getBranchSupplierById(branchId: string, supplierId: string): Promise<BranchSupplierRow | undefined> {
    const [row] = await db
      .select()
      .from(branchSuppliers)
      .where(and(
        eq(branchSuppliers.branchId, branchId),
        eq(branchSuppliers.id, supplierId),
        isNull(branchSuppliers.deletedAt),
      ))
      .limit(1);

    return row ? this.mapBranchSupplierRow(row) : undefined;
  }

  async getBranchSupplierSummary(
    branchId: string,
    supplierId: string,
  ): Promise<BranchSupplierSummaryRow | undefined> {
    const supplier = await this.getBranchSupplierById(branchId, supplierId);
    if (!supplier) return undefined;

    const [summaryResult, topProductsResult, productCountResult] = await Promise.all([
      db.execute(sql<{
        totalPurchasedAmount: string | number | null;
        purchasesCount: string | number | null;
        lastPurchaseAt: Date | string | null;
        receivedPurchasesCount: string | number | null;
        pendingPurchasesCount: string | number | null;
      }>`
        SELECT
          COALESCE(SUM(bp.total_amount), 0) AS "totalPurchasedAmount",
          COUNT(*)::int AS "purchasesCount",
          MAX(COALESCE(bp.received_at, bp.created_at)) AS "lastPurchaseAt",
          COUNT(*) FILTER (WHERE bp.status = 'received')::int AS "receivedPurchasesCount",
          COUNT(*) FILTER (WHERE bp.status IN ('draft', 'ordered', 'partially_received'))::int AS "pendingPurchasesCount"
        FROM branch_purchases bp
        WHERE bp.branch_id = ${branchId}
          AND bp.supplier_id = ${supplierId}
          AND bp.status <> 'cancelled'
      `),
      db.execute(sql<{
        commercialProductId: string | null;
        name: string | null;
        unitsOrdered: string | number | null;
        unitsReceived: string | number | null;
        totalPurchasedAmount: string | number | null;
      }>`
        SELECT
          bpi.commercial_product_id AS "commercialProductId",
          MAX(bpi.name_snapshot) AS "name",
          COALESCE(SUM(bpi.quantity_ordered), 0) AS "unitsOrdered",
          COALESCE(SUM(bpi.quantity_received), 0) AS "unitsReceived",
          COALESCE(SUM(bpi.line_total), 0) AS "totalPurchasedAmount"
        FROM branch_purchase_items bpi
        INNER JOIN branch_purchases bp ON bp.id = bpi.purchase_id
        WHERE bp.branch_id = ${branchId}
          AND bp.supplier_id = ${supplierId}
          AND bp.status <> 'cancelled'
        GROUP BY bpi.commercial_product_id
        ORDER BY COALESCE(SUM(bpi.line_total), 0) DESC, MAX(bpi.name_snapshot) ASC
        LIMIT 5
      `),
      db.execute(sql<{ total: string | number | null }>`
        SELECT
          COUNT(DISTINCT COALESCE(bpi.commercial_product_id::text, bpi.name_snapshot))::int AS total
        FROM branch_purchase_items bpi
        INNER JOIN branch_purchases bp ON bp.id = bpi.purchase_id
        WHERE bp.branch_id = ${branchId}
          AND bp.supplier_id = ${supplierId}
          AND bp.status <> 'cancelled'
      `),
    ]);

    const summaryRow = (summaryResult.rows?.[0] ?? null) as any;
    const totalPurchasedAmount = toFinanceAmount(summaryRow?.totalPurchasedAmount);
    const purchasesCount = Number(summaryRow?.purchasesCount ?? 0);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      totalPurchasedAmount,
      purchasesCount,
      averageTicketAmount: purchasesCount > 0 ? Number((totalPurchasedAmount / purchasesCount).toFixed(2)) : 0,
      lastPurchaseAt: summaryRow?.lastPurchaseAt ?? null,
      productsSuppliedCount: Number((productCountResult.rows?.[0] as any)?.total ?? 0),
      receivedPurchasesCount: Number(summaryRow?.receivedPurchasesCount ?? 0),
      pendingPurchasesCount: Number(summaryRow?.pendingPurchasesCount ?? 0),
      topProducts: (topProductsResult.rows ?? []).map((row: any) => ({
        commercialProductId: row.commercialProductId ?? null,
        name: row.name || "Producto",
        unitsOrdered: Number(row.unitsOrdered ?? 0),
        unitsReceived: Number(row.unitsReceived ?? 0),
        totalPurchasedAmount: toFinanceAmount(row.totalPurchasedAmount),
      })),
    };
  }

  async createBranchSupplier(data: InsertBranchSupplier): Promise<BranchSupplierRow> {
    const [created] = await db.insert(branchSuppliers).values(data).returning();
    return this.mapBranchSupplierRow(created);
  }

  async updateBranchSupplier(
    branchId: string,
    supplierId: string,
    data: Partial<InsertBranchSupplier>,
  ): Promise<BranchSupplierRow | undefined> {
    const [updated] = await db
      .update(branchSuppliers)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(branchSuppliers.branchId, branchId),
        eq(branchSuppliers.id, supplierId),
        isNull(branchSuppliers.deletedAt),
      ))
      .returning();

    return updated ? this.mapBranchSupplierRow(updated) : undefined;
  }

  async softDeleteBranchSupplier(branchId: string, supplierId: string): Promise<boolean> {
    const [deleted] = await db
      .update(branchSuppliers)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(branchSuppliers.branchId, branchId),
        eq(branchSuppliers.id, supplierId),
        isNull(branchSuppliers.deletedAt),
      ))
      .returning({ id: branchSuppliers.id });

    return !!deleted;
  }

  async getBranchPurchases(branchId: string, filters?: {
    status?: string | null;
    supplierId?: string | null;
    from?: string | null;
    to?: string | null;
  }): Promise<BranchPurchaseRow[]> {
    const whereClauses = [eq(branchPurchases.branchId, branchId)];

    if (filters?.status) {
      whereClauses.push(eq(branchPurchases.status, filters.status));
    }
    if (filters?.supplierId) {
      whereClauses.push(eq(branchPurchases.supplierId, filters.supplierId));
    }
    if (filters?.from) {
      whereClauses.push(gte(branchPurchases.purchaseDate, filters.from));
    }
    if (filters?.to) {
      whereClauses.push(lte(branchPurchases.purchaseDate, filters.to));
    }

    const purchaseRows = await db
      .select({
        id: branchPurchases.id,
        branchId: branchPurchases.branchId,
        projectId: branchPurchases.projectId,
        projectCode: branchCommercialProjects.code,
        projectName: branchCommercialProjects.name,
        folio: branchPurchases.folio,
        supplierId: branchPurchases.supplierId,
        supplierName: branchSuppliers.name,
        status: branchPurchases.status,
        purchaseDate: branchPurchases.purchaseDate,
        expectedDate: branchPurchases.expectedDate,
        receivedAt: branchPurchases.receivedAt,
        paymentStatus: branchPurchases.paymentStatus,
        paymentMethod: branchPurchases.paymentMethod,
        subtotalAmount: branchPurchases.subtotalAmount,
        discountAmount: branchPurchases.discountAmount,
        taxMode: branchPurchases.taxMode,
        taxRate: branchPurchases.taxRate,
        subtotalBeforeTax: branchPurchases.subtotalBeforeTax,
        taxableSubtotal: branchPurchases.taxableSubtotal,
        taxTotal: branchPurchases.taxTotal,
        grandTotal: branchPurchases.grandTotal,
        totalAmount: branchPurchases.totalAmount,
        paidAmount: branchPurchases.paidAmount,
        reference: branchPurchases.reference,
        notes: branchPurchases.notes,
        createdBy: branchPurchases.createdBy,
        cancelledAt: branchPurchases.cancelledAt,
        createdAt: branchPurchases.createdAt,
        updatedAt: branchPurchases.updatedAt,
      })
      .from(branchPurchases)
      .leftJoin(branchCommercialProjects, and(
        eq(branchPurchases.projectId, branchCommercialProjects.id),
        eq(branchPurchases.branchId, branchCommercialProjects.branchId),
      ))
      .leftJoin(branchSuppliers, eq(branchPurchases.supplierId, branchSuppliers.id))
      .where(and(...whereClauses))
      .orderBy(desc(branchPurchases.purchaseDate), desc(branchPurchases.createdAt));

    if (!purchaseRows.length) return [];

    const purchaseIds = purchaseRows.map((row) => row.id);
    const itemRows = await db
      .select()
      .from(branchPurchaseItems)
      .where(inArray(branchPurchaseItems.purchaseId, purchaseIds));

    const totalsByPurchaseId = new Map<string, { items: number; ordered: number; received: number }>();
    for (const item of itemRows) {
      const current = totalsByPurchaseId.get(item.purchaseId) ?? { items: 0, ordered: 0, received: 0 };
      current.items += 1;
      current.ordered += Number(item.quantityOrdered ?? 0);
      current.received += Number(item.quantityReceived ?? 0);
      totalsByPurchaseId.set(item.purchaseId, current);
    }

    return purchaseRows.map((row) => {
      const totals = totalsByPurchaseId.get(row.id);
      return this.mapBranchPurchaseRow({
        ...row,
        totalItems: totals?.items ?? 0,
        totalUnitsOrdered: totals?.ordered ?? 0,
        totalUnitsReceived: totals?.received ?? 0,
      });
    });
  }

  async getBranchPurchaseById(branchId: string, purchaseId: string): Promise<BranchPurchaseDetailRow | undefined> {
    const [purchaseRow] = await db
      .select({
        id: branchPurchases.id,
        branchId: branchPurchases.branchId,
        projectId: branchPurchases.projectId,
        projectCode: branchCommercialProjects.code,
        projectName: branchCommercialProjects.name,
        folio: branchPurchases.folio,
        supplierId: branchPurchases.supplierId,
        supplierName: branchSuppliers.name,
        status: branchPurchases.status,
        purchaseDate: branchPurchases.purchaseDate,
        expectedDate: branchPurchases.expectedDate,
        receivedAt: branchPurchases.receivedAt,
        paymentStatus: branchPurchases.paymentStatus,
        paymentMethod: branchPurchases.paymentMethod,
        subtotalAmount: branchPurchases.subtotalAmount,
        discountAmount: branchPurchases.discountAmount,
        taxMode: branchPurchases.taxMode,
        taxRate: branchPurchases.taxRate,
        subtotalBeforeTax: branchPurchases.subtotalBeforeTax,
        taxableSubtotal: branchPurchases.taxableSubtotal,
        taxTotal: branchPurchases.taxTotal,
        grandTotal: branchPurchases.grandTotal,
        totalAmount: branchPurchases.totalAmount,
        paidAmount: branchPurchases.paidAmount,
        reference: branchPurchases.reference,
        notes: branchPurchases.notes,
        createdBy: branchPurchases.createdBy,
        cancelledAt: branchPurchases.cancelledAt,
        createdAt: branchPurchases.createdAt,
        updatedAt: branchPurchases.updatedAt,
      })
      .from(branchPurchases)
      .leftJoin(branchCommercialProjects, and(
        eq(branchPurchases.projectId, branchCommercialProjects.id),
        eq(branchPurchases.branchId, branchCommercialProjects.branchId),
      ))
      .leftJoin(branchSuppliers, eq(branchPurchases.supplierId, branchSuppliers.id))
      .where(and(
        eq(branchPurchases.branchId, branchId),
        eq(branchPurchases.id, purchaseId),
      ))
      .limit(1);

    if (!purchaseRow) return undefined;

    const itemRows = await db
      .select()
      .from(branchPurchaseItems)
      .where(eq(branchPurchaseItems.purchaseId, purchaseId))
      .orderBy(asc(branchPurchaseItems.createdAt));

    const items = itemRows.map((row) => this.mapBranchPurchaseItemRow(row));
    const summary = this.mapBranchPurchaseRow({
      ...purchaseRow,
      totalItems: items.length,
      totalUnitsOrdered: items.reduce((acc, item) => acc + item.quantityOrdered, 0),
      totalUnitsReceived: items.reduce((acc, item) => acc + item.quantityReceived, 0),
    });

    return {
      ...summary,
      items,
    };
  }

  async createBranchPurchase(data: {
    purchase: InsertBranchPurchase;
    items: InsertBranchPurchaseItem[];
  }): Promise<BranchPurchaseDetailRow> {
    if (!data.items.length) {
      throw new Error("BRANCH_PURCHASE_REQUIRES_ITEMS");
    }

    const allowedStatuses = new Set(["draft", "ordered"]);
    const requestedStatus = data.purchase.status?.trim() || "draft";
    if (!allowedStatuses.has(requestedStatus)) {
      throw new Error("BRANCH_PURCHASE_INVALID_STATUS");
    }

    const discountAmount = toFinanceAmount(data.purchase.discountAmount);
    const requestedPaidAmount = toFinanceAmount(data.purchase.paidAmount);

    const created = await db.transaction(async (tx) => {
      let supplierId = data.purchase.supplierId ?? null;
      const projectId = normalizeOptionalTextValue((data.purchase as any).projectId);
      if (supplierId) {
        const [supplier] = await tx
          .select()
          .from(branchSuppliers)
          .where(and(
            eq(branchSuppliers.id, supplierId),
            eq(branchSuppliers.branchId, data.purchase.branchId),
            isNull(branchSuppliers.deletedAt),
          ))
          .limit(1);

        if (!supplier) {
          throw new Error("BRANCH_PURCHASE_SUPPLIER_INVALID");
        }
      }

      if (projectId) {
        const project = await this.getAssignableBranchCommercialProjectTx(tx, data.purchase.branchId, projectId);
        if (!project) {
          throw new Error("BRANCH_PURCHASE_PROJECT_INVALID");
        }
      }

      const requestedProductIds = data.items
        .map((item) => item.commercialProductId)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      const productIds = Array.from(new Set(requestedProductIds));

      if (requestedProductIds.length !== productIds.length) {
        throw new Error("BRANCH_PURCHASE_DUPLICATE_PRODUCTS");
      }

      const productRows = productIds.length > 0
        ? await tx
          .select()
          .from(branchCommercialProducts)
          .where(and(
            eq(branchCommercialProducts.branchId, data.purchase.branchId),
            inArray(branchCommercialProducts.id, productIds),
            isNull(branchCommercialProducts.deletedAt),
          ))
        : [];

      const productMap = new Map(productRows.map((row) => [row.id, row]));

      const normalizedPaymentMethod = typeof data.purchase.paymentMethod === "string" && data.purchase.paymentMethod.trim().length > 0
        ? data.purchase.paymentMethod.trim()
        : null;

      if (!normalizedPaymentMethod && requestedPaidAmount > 0) {
        throw new Error("BRANCH_PURCHASE_PAYMENT_REQUIRES_METHOD");
      }

      const normalizedItems = data.items.map((item) => {
        const productId = item.commercialProductId ?? null;
        if (!productId) {
          throw new Error("BRANCH_PURCHASE_ITEM_PRODUCT_INVALID");
        }

        const product = productMap.get(productId);
        if (!product) {
          throw new Error("BRANCH_PURCHASE_ITEM_PRODUCT_INVALID");
        }

        const quantityOrdered = Number(item.quantityOrdered ?? 0);
        const unitCost = toFinanceAmount(item.unitCost);
        const lineTotal = Number((quantityOrdered * unitCost).toFixed(2));
        const updateReferenceCost = Boolean((item as { updateReferenceCost?: boolean }).updateReferenceCost);

        return {
          product,
          quantityOrdered,
          unitCost,
          lineTotal,
          updateReferenceCost,
        };
      });

      const subtotalAmount = Number(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
      const taxSnapshot = computeCommercialTaxSnapshot({
        subtotalAmount,
        discountAmount,
        taxMode: (((data.purchase as any).taxMode ?? "tax_exempt") as CommercialTaxMode),
        taxRate: toFinanceAmount((data.purchase as any).taxRate ?? 0),
      });
      const totalAmount = taxSnapshot.grandTotal;
      if (taxSnapshot.grandTotal < 0) {
        throw new Error("BRANCH_PURCHASE_TOTAL_NEGATIVE");
      }
      if (requestedPaidAmount > totalAmount) {
        throw new Error("BRANCH_PURCHASE_PAID_EXCEEDS_TOTAL");
      }

      const paymentStatus = requestedPaidAmount <= 0
        ? "unpaid"
        : requestedPaidAmount >= totalAmount
          ? "paid"
          : "partial";

      const [purchaseRow] = await tx
        .insert(branchPurchases)
        .values({
          ...data.purchase,
          projectId,
          supplierId,
          folio: data.purchase.folio?.trim() || generateBranchPurchaseFolio(),
          status: requestedStatus,
          paymentStatus,
          subtotalAmount: subtotalAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          taxMode: taxSnapshot.taxMode,
          taxRate: taxSnapshot.taxRate.toFixed(2),
          subtotalBeforeTax: taxSnapshot.subtotalBeforeTax.toFixed(2),
          taxableSubtotal: taxSnapshot.taxableSubtotal.toFixed(2),
          taxTotal: taxSnapshot.taxTotal.toFixed(2),
          grandTotal: taxSnapshot.grandTotal.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          paidAmount: requestedPaidAmount.toFixed(2),
          paymentMethod: normalizedPaymentMethod,
          reference: data.purchase.reference ?? null,
          notes: data.purchase.notes ?? null,
        } as any)
        .returning({
          id: branchPurchases.id,
          branchId: branchPurchases.branchId,
        });

      await tx.insert(branchPurchaseItems).values(
        normalizedItems.map((item) => ({
          purchaseId: purchaseRow.id,
          branchId: purchaseRow.branchId,
          commercialProductId: item.product.id,
          nameSnapshot: item.product.name,
          skuSnapshot: item.product.sku ?? null,
          quantityOrdered: item.quantityOrdered,
          quantityReceived: 0,
          unitCost: item.unitCost.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
          metadata: {
            category: item.product.category,
            usesInventory: item.product.usesInventory,
            updateReferenceCost: item.updateReferenceCost,
          },
        })) as any,
      );

      for (const item of normalizedItems) {
        if (!item.updateReferenceCost) continue;
        await tx
          .update(branchCommercialProducts)
          .set({
            costAmount: item.unitCost.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(branchCommercialProducts.id, item.product.id));
      }

      return purchaseRow;
    });

    return (await this.getBranchPurchaseById(created.branchId, created.id))!;
  }

  async receiveBranchPurchase(data: {
    branchId: string;
    purchaseId: string;
    receivedBy?: string | null;
    notes?: string | null;
  }): Promise<BranchPurchaseDetailRow> {
    await db.transaction(async (tx) => {
      const lockedPurchase = await this.getLockedBranchPurchase(tx, data.branchId, data.purchaseId);
      if (!lockedPurchase) {
        throw new Error("BRANCH_PURCHASE_NOT_FOUND");
      }
      if (lockedPurchase.status === "cancelled") {
        throw new Error("BRANCH_PURCHASE_CANNOT_RECEIVE_CANCELLED");
      }
      if (lockedPurchase.status === "received") {
        throw new Error("BRANCH_PURCHASE_ALREADY_RECEIVED");
      }

      const itemRows = await tx
        .select()
        .from(branchPurchaseItems)
        .where(eq(branchPurchaseItems.purchaseId, data.purchaseId))
        .orderBy(asc(branchPurchaseItems.createdAt));

      if (!itemRows.length) {
        throw new Error("BRANCH_PURCHASE_REQUIRES_ITEMS");
      }

      for (const item of itemRows) {
        const remainingQuantity = Math.max(0, Number(item.quantityOrdered ?? 0) - Number(item.quantityReceived ?? 0));
        if (remainingQuantity <= 0) {
          continue;
        }

        if (!item.commercialProductId) {
          throw new Error("BRANCH_PURCHASE_ITEM_PRODUCT_INVALID");
        }

        const [product] = await tx
          .select()
          .from(branchCommercialProducts)
          .where(and(
            eq(branchCommercialProducts.id, item.commercialProductId),
            eq(branchCommercialProducts.branchId, data.branchId),
            isNull(branchCommercialProducts.deletedAt),
          ))
          .limit(1);

        if (!product) {
          throw new Error("BRANCH_PURCHASE_ITEM_PRODUCT_INVALID");
        }

        const itemUsesInventory = typeof (item.metadata as { usesInventory?: unknown } | null)?.usesInventory === "boolean"
          ? Boolean((item.metadata as { usesInventory?: boolean }).usesInventory)
          : product.usesInventory;

        if (!itemUsesInventory) {
          await tx
            .update(branchPurchaseItems)
            .set({
              quantityReceived: item.quantityOrdered,
            })
            .where(eq(branchPurchaseItems.id, item.id));
          continue;
        }

        let lockedBalance = await this.getLockedBranchInventoryBalance(tx, data.branchId, item.commercialProductId);
        if (!lockedBalance) {
          await tx.insert(branchInventoryBalances).values({
            branchId: data.branchId,
            commercialProductId: item.commercialProductId,
            quantityOnHand: 0,
            minimumStock: 0,
            updatedBy: data.receivedBy ?? null,
          } as any);

          lockedBalance = await this.getLockedBranchInventoryBalance(tx, data.branchId, item.commercialProductId);
        }

        if (!lockedBalance) {
          throw new Error("INVENTORY_NOT_INITIALIZED");
        }

        const quantityBefore = lockedBalance.quantityOnHand;
        const quantityAfter = quantityBefore + remainingQuantity;

        await tx
          .update(branchInventoryBalances)
          .set({
            quantityOnHand: quantityAfter,
            updatedBy: data.receivedBy ?? null,
            updatedAt: new Date(),
          })
          .where(eq(branchInventoryBalances.id, lockedBalance.id));

        await this.insertBranchInventoryMovementTx(tx, {
          branchId: data.branchId,
          commercialProductId: item.commercialProductId,
          movementType: "purchase",
          quantityDelta: remainingQuantity,
          quantityBefore,
          quantityAfter,
          unitCostSnapshot: toFinanceAmount(item.unitCost),
          reason: `Recepcion de compra ${lockedPurchase.folio}`,
          notes: data.notes ?? null,
          saleId: null,
          saleItemId: null,
          purchaseId: lockedPurchase.id,
          purchaseItemId: item.id,
          createdBy: data.receivedBy ?? null,
          metadata: {
            purchaseFolio: lockedPurchase.folio,
          },
        } as any);

        await tx
          .update(branchPurchaseItems)
          .set({
            quantityReceived: item.quantityOrdered,
          })
          .where(eq(branchPurchaseItems.id, item.id));
      }

      await tx
        .update(branchPurchases)
        .set({
          status: "received",
          receivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(branchPurchases.id, lockedPurchase.id));
    });

    return (await this.getBranchPurchaseById(data.branchId, data.purchaseId))!;
  }

  async cancelBranchPurchase(branchId: string, purchaseId: string): Promise<BranchPurchaseDetailRow | undefined> {
    const updated = await db.transaction(async (tx) => {
      const lockedPurchase = await this.getLockedBranchPurchase(tx, branchId, purchaseId);
      if (!lockedPurchase) {
        throw new Error("BRANCH_PURCHASE_NOT_FOUND");
      }
      if (lockedPurchase.status !== "draft") {
        throw new Error("BRANCH_PURCHASE_CANNOT_CANCEL");
      }

      const [purchase] = await tx
        .update(branchPurchases)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(branchPurchases.id, purchaseId))
        .returning({ id: branchPurchases.id, branchId: branchPurchases.branchId });

      return purchase;
    });

    if (!updated) return undefined;
    return this.getBranchPurchaseById(updated.branchId, updated.id);
  }

  async createBranchCommercialProductInitialInventory(data: {
    branchId: string;
    commercialProductId: string;
    quantity: number;
    minimumStock: number;
    unitCost?: number | null;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow> {
    await db.transaction(async (tx) => {
      const product = await this.getBranchCommercialProductById(data.branchId, data.commercialProductId);
      if (!product) throw new Error("COMMERCIAL_PRODUCT_NOT_FOUND");
      if (!product.usesInventory) throw new Error("COMMERCIAL_PRODUCT_NOT_TRACKED");

      const [existing] = await tx
        .select()
        .from(branchInventoryBalances)
        .where(and(
          eq(branchInventoryBalances.branchId, data.branchId),
          eq(branchInventoryBalances.commercialProductId, data.commercialProductId),
        ))
        .limit(1);

      if (existing) {
        throw new Error("INVENTORY_ALREADY_INITIALIZED");
      }

      await tx.insert(branchInventoryBalances).values({
        branchId: data.branchId,
        commercialProductId: data.commercialProductId,
        quantityOnHand: data.quantity,
        minimumStock: data.minimumStock,
        updatedBy: data.createdBy ?? null,
      } as any);

      await this.insertBranchInventoryMovementTx(tx, {
        branchId: data.branchId,
        commercialProductId: data.commercialProductId,
        movementType: "initial",
        quantityDelta: data.quantity,
        quantityBefore: 0,
        quantityAfter: data.quantity,
        unitCostSnapshot: data.unitCost ?? product.costAmount ?? null,
        reason: "Inventario inicial",
        notes: data.notes ?? null,
        saleId: null,
        saleItemId: null,
        createdBy: data.createdBy ?? null,
        metadata: {
          minimumStock: data.minimumStock,
        },
      } as any);
    });

    return this.getBranchCommercialProductInventory(data.branchId, data.commercialProductId);
  }

  async createBranchCommercialProductInventoryEntry(data: {
    branchId: string;
    commercialProductId: string;
    quantity: number;
    minimumStock?: number | null;
    unitCost?: number | null;
    reason: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow> {
    await db.transaction(async (tx) => {
      const product = await this.getBranchCommercialProductById(data.branchId, data.commercialProductId);
      if (!product) throw new Error("COMMERCIAL_PRODUCT_NOT_FOUND");
      if (!product.usesInventory) throw new Error("COMMERCIAL_PRODUCT_NOT_TRACKED");

      const lockedBalance = await this.getLockedBranchInventoryBalance(tx, data.branchId, data.commercialProductId);
      if (!lockedBalance) throw new Error("INVENTORY_NOT_INITIALIZED");

      const quantityBefore = lockedBalance.quantityOnHand;
      const quantityAfter = quantityBefore + data.quantity;
      const nextMinimumStock = data.minimumStock == null ? lockedBalance.minimumStock : data.minimumStock;

      await tx
        .update(branchInventoryBalances)
        .set({
          quantityOnHand: quantityAfter,
          minimumStock: nextMinimumStock,
          updatedBy: data.createdBy ?? null,
          updatedAt: new Date(),
        })
        .where(eq(branchInventoryBalances.id, lockedBalance.id));

      await this.insertBranchInventoryMovementTx(tx, {
        branchId: data.branchId,
        commercialProductId: data.commercialProductId,
        movementType: "manual_entry",
        quantityDelta: data.quantity,
        quantityBefore,
        quantityAfter,
        unitCostSnapshot: data.unitCost ?? product.costAmount ?? null,
        reason: data.reason,
        notes: data.notes ?? null,
        saleId: null,
        saleItemId: null,
        createdBy: data.createdBy ?? null,
        metadata: {
          minimumStock: nextMinimumStock,
        },
      } as any);
    });

    return this.getBranchCommercialProductInventory(data.branchId, data.commercialProductId);
  }

  async adjustBranchCommercialProductInventory(data: {
    branchId: string;
    commercialProductId: string;
    newQuantity?: number | null;
    quantityDelta?: number | null;
    minimumStock?: number | null;
    unitCost?: number | null;
    reason: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow> {
    await db.transaction(async (tx) => {
      const product = await this.getBranchCommercialProductById(data.branchId, data.commercialProductId);
      if (!product) throw new Error("COMMERCIAL_PRODUCT_NOT_FOUND");
      if (!product.usesInventory) throw new Error("COMMERCIAL_PRODUCT_NOT_TRACKED");

      const lockedBalance = await this.getLockedBranchInventoryBalance(tx, data.branchId, data.commercialProductId);
      if (!lockedBalance) throw new Error("INVENTORY_NOT_INITIALIZED");

      const quantityBefore = lockedBalance.quantityOnHand;
      const delta = data.newQuantity != null
        ? data.newQuantity - quantityBefore
        : Number(data.quantityDelta ?? 0);
      const quantityAfter = data.newQuantity != null
        ? data.newQuantity
        : quantityBefore + delta;

      if (quantityAfter < 0) {
        throw new Error("INVENTORY_NEGATIVE_STOCK");
      }
      if (delta === 0) {
        throw new Error("INVENTORY_NO_CHANGES");
      }

      const nextMinimumStock = data.minimumStock == null ? lockedBalance.minimumStock : data.minimumStock;

      await tx
        .update(branchInventoryBalances)
        .set({
          quantityOnHand: quantityAfter,
          minimumStock: nextMinimumStock,
          updatedBy: data.createdBy ?? null,
          updatedAt: new Date(),
        })
        .where(eq(branchInventoryBalances.id, lockedBalance.id));

      await this.insertBranchInventoryMovementTx(tx, {
        branchId: data.branchId,
        commercialProductId: data.commercialProductId,
        movementType: delta > 0 ? "positive_adjustment" : "negative_adjustment",
        quantityDelta: delta,
        quantityBefore,
        quantityAfter,
        unitCostSnapshot: data.unitCost ?? product.costAmount ?? null,
        reason: data.reason,
        notes: data.notes ?? null,
        saleId: null,
        saleItemId: null,
        createdBy: data.createdBy ?? null,
        metadata: {
          minimumStock: nextMinimumStock,
          mode: data.newQuantity != null ? "set_quantity" : "delta",
        },
      } as any);
    });

    return this.getBranchCommercialProductInventory(data.branchId, data.commercialProductId);
  }

  async createBranchCommercialProductInventoryWaste(data: {
    branchId: string;
    commercialProductId: string;
    quantity: number;
    movementType: "waste" | "damaged";
    reason: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchInventorySummaryRow> {
    await db.transaction(async (tx) => {
      const product = await this.getBranchCommercialProductById(data.branchId, data.commercialProductId);
      if (!product) throw new Error("COMMERCIAL_PRODUCT_NOT_FOUND");
      if (!product.usesInventory) throw new Error("COMMERCIAL_PRODUCT_NOT_TRACKED");

      const lockedBalance = await this.getLockedBranchInventoryBalance(tx, data.branchId, data.commercialProductId);
      if (!lockedBalance) throw new Error("INVENTORY_NOT_INITIALIZED");

      const quantityBefore = lockedBalance.quantityOnHand;
      if (quantityBefore < data.quantity) {
        throw new Error("INVENTORY_INSUFFICIENT_STOCK");
      }

      const quantityAfter = quantityBefore - data.quantity;

      await tx
        .update(branchInventoryBalances)
        .set({
          quantityOnHand: quantityAfter,
          updatedBy: data.createdBy ?? null,
          updatedAt: new Date(),
        })
        .where(eq(branchInventoryBalances.id, lockedBalance.id));

      await this.insertBranchInventoryMovementTx(tx, {
        branchId: data.branchId,
        commercialProductId: data.commercialProductId,
        movementType: data.movementType,
        quantityDelta: -data.quantity,
        quantityBefore,
        quantityAfter,
        unitCostSnapshot: product.costAmount ?? null,
        reason: data.reason,
        notes: data.notes ?? null,
        saleId: null,
        saleItemId: null,
        createdBy: data.createdBy ?? null,
        metadata: null,
      } as any);
    });

    return this.getBranchCommercialProductInventory(data.branchId, data.commercialProductId);
  }

  private async getActiveCommissionRulesForSaleTx(
    tx: any,
    branchId: string,
    salespersonId: string,
    localDate: string,
  ): Promise<BranchCommissionRuleRow[]> {
    const rows = await tx
      .select()
      .from(branchCommissionRules)
      .where(and(
        eq(branchCommissionRules.branchId, branchId),
        eq(branchCommissionRules.salespersonId, salespersonId),
        eq(branchCommissionRules.isActive, true),
        isNull(branchCommissionRules.deletedAt),
      ));

    return rows
      .map((row: BranchCommissionRule) => this.mapBranchCommissionRuleRow(row))
      .filter((row: BranchCommissionRuleRow) => isRuleActiveForDate(row, localDate));
  }

  private chooseBestCommissionRule(
    rules: BranchCommissionRuleRow[],
    saleItem?: { commercialProductId: string | null; categorySnapshot: string | null } | null,
  ): BranchCommissionRuleRow | null {
    if (!rules.length) return null;
    const candidates = rules.filter((rule) => {
      if (!saleItem) {
        return rule.ruleType === "percentage_all_sales" || rule.ruleType === "fixed_per_sale";
      }
      if (rule.ruleType === "percentage_product" || rule.ruleType === "fixed_product") {
        return !!saleItem.commercialProductId && rule.commercialProductId === saleItem.commercialProductId;
      }
      if (rule.ruleType === "percentage_category") {
        return !!saleItem.categorySnapshot && !!rule.category && saleItem.categorySnapshot.trim().toLowerCase() === rule.category.trim().toLowerCase();
      }
      return false;
    });
    if (!candidates.length) return null;

    return [...candidates].sort((a, b) => {
      const specificityDiff = (COMMISSION_RULE_SPECIFICITY[b.ruleType] ?? 0) - (COMMISSION_RULE_SPECIFICITY[a.ruleType] ?? 0);
      if (specificityDiff !== 0) return specificityDiff;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0] ?? null;
  }

  private async createCommissionAccrualsForSaleTx(
    tx: any,
    data: {
      branchId: string;
      saleId: string;
      sellerId: string | null;
      sellerNameSnapshot: string | null;
      totalAmount: number;
      items: BranchSaleItem[];
    },
  ): Promise<void> {
    if (!data.sellerId) return;

    const localDateParts = getMxDateParts(new Date());
    const rules = await this.getActiveCommissionRulesForSaleTx(tx, data.branchId, data.sellerId, localDateParts.date);
    if (!rules.length) return;

    const saleLevelRules = rules.filter((rule) => rule.ruleType === "percentage_all_sales" || rule.ruleType === "fixed_per_sale");
    const itemRules = rules.filter((rule) => rule.ruleType === "percentage_product" || rule.ruleType === "fixed_product" || rule.ruleType === "percentage_category");
    const bonusRules = rules.filter((rule) => rule.ruleType === "bonus_monthly_goal");

    const accrualsToCreate: InsertBranchCommissionAccrual[] = [];
    let uncoveredBaseAmount = 0;
    let hasSpecificRuleApplied = false;

    for (const item of data.items) {
      const bestItemRule = this.chooseBestCommissionRule(itemRules, {
        commercialProductId: item.commercialProductId ?? null,
        categorySnapshot: item.categorySnapshot ?? null,
      });

      const lineTotal = toFinanceAmount(item.lineTotalAmount);
      const quantity = Number(item.quantity ?? 0);

      if (!bestItemRule) {
        uncoveredBaseAmount += lineTotal;
        continue;
      }

      hasSpecificRuleApplied = true;
      let commissionAmount = 0;
      let rateSnapshot: number | null = null;
      let fixedAmountSnapshot: number | null = null;

      if (bestItemRule.ruleType === "percentage_product" || bestItemRule.ruleType === "percentage_category") {
        rateSnapshot = bestItemRule.percentageRate ?? 0;
        commissionAmount = Number((lineTotal * (rateSnapshot / 100)).toFixed(2));
      } else if (bestItemRule.ruleType === "fixed_product") {
        fixedAmountSnapshot = bestItemRule.fixedAmount ?? 0;
        commissionAmount = Number((fixedAmountSnapshot * quantity).toFixed(2));
      }

      accrualsToCreate.push({
        branchId: data.branchId,
        salespersonId: data.sellerId,
        saleId: data.saleId,
        saleItemId: item.id,
        commissionRuleId: bestItemRule.id,
        accrualType: "sale",
        referenceKey: `sale-item:${data.saleId}:${item.id}:rule:${bestItemRule.id}`,
        periodMonth: localDateParts.monthKey,
        status: "approved",
        baseAmount: String(lineTotal) as any,
        rateSnapshot: rateSnapshot == null ? null : String(rateSnapshot) as any,
        fixedAmountSnapshot: fixedAmountSnapshot == null ? null : String(fixedAmountSnapshot) as any,
        commissionAmount: String(commissionAmount) as any,
        salespersonNameSnapshot: data.sellerNameSnapshot || "Vendedor",
        ruleNameSnapshot: bestItemRule.name,
        calculationSnapshot: {
          ruleType: bestItemRule.ruleType,
          quantity,
          lineTotalAmount: lineTotal,
          substitutedGeneralRule: true,
        },
        accruedAt: new Date(),
        approvedAt: new Date(),
        paidAmount: "0" as any,
        reversedAt: null,
        reversalReason: null,
      });
    }

    const bestSaleRule = this.chooseBestCommissionRule(saleLevelRules, null);
    if (bestSaleRule) {
      const generalBaseAmount = bestSaleRule.ruleType === "percentage_all_sales"
        ? Number(uncoveredBaseAmount.toFixed(2))
        : ((uncoveredBaseAmount > 0 || !hasSpecificRuleApplied) ? toFinanceAmount(data.totalAmount) : 0);

      if (generalBaseAmount > 0) {
        let commissionAmount = 0;
        let rateSnapshot: number | null = null;
        let fixedAmountSnapshot: number | null = null;

        if (bestSaleRule.ruleType === "percentage_all_sales") {
          rateSnapshot = bestSaleRule.percentageRate ?? 0;
          commissionAmount = Number((generalBaseAmount * (rateSnapshot / 100)).toFixed(2));
        } else if (bestSaleRule.ruleType === "fixed_per_sale") {
          fixedAmountSnapshot = bestSaleRule.fixedAmount ?? 0;
          commissionAmount = Number(fixedAmountSnapshot.toFixed(2));
        }

        accrualsToCreate.push({
          branchId: data.branchId,
          salespersonId: data.sellerId,
          saleId: data.saleId,
          saleItemId: null,
          commissionRuleId: bestSaleRule.id,
          accrualType: "sale",
          referenceKey: `sale:${data.saleId}:rule:${bestSaleRule.id}`,
          periodMonth: localDateParts.monthKey,
          status: "approved",
          baseAmount: String(generalBaseAmount) as any,
          rateSnapshot: rateSnapshot == null ? null : String(rateSnapshot) as any,
          fixedAmountSnapshot: fixedAmountSnapshot == null ? null : String(fixedAmountSnapshot) as any,
          commissionAmount: String(commissionAmount) as any,
          salespersonNameSnapshot: data.sellerNameSnapshot || "Vendedor",
          ruleNameSnapshot: bestSaleRule.name,
          calculationSnapshot: {
            ruleType: bestSaleRule.ruleType,
            uncoveredBaseAmount,
            totalAmount: toFinanceAmount(data.totalAmount),
            specificRulesApplied: hasSpecificRuleApplied,
          },
          accruedAt: new Date(),
          approvedAt: new Date(),
          paidAmount: "0" as any,
          reversedAt: null,
          reversalReason: null,
        });
      }
    }

    if (bonusRules.length > 0) {
      const [salesMonthRow] = await tx
        .select({
          totalSoldAmount: sql<number>`COALESCE(SUM(${branchSales.totalAmount}), 0)`.as("total_sold_amount"),
        })
        .from(branchSales)
        .where(and(
          eq(branchSales.branchId, data.branchId),
          eq(branchSales.sellerId, data.sellerId),
          ne(branchSales.status, "cancelled"),
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) >= ${localDateParts.monthKey + "-01"}`,
          sql`DATE(${branchSales.createdAt} AT TIME ZONE ${BRANCH_TIMEZONE}) < ${getMonthRangeByKey(localDateParts.monthKey).toExclusive}`,
        ))
        .limit(1);

      const totalSoldAmount = toFinanceAmount(salesMonthRow?.totalSoldAmount);
      for (const bonusRule of bonusRules) {
        if ((bonusRule.minimumGoalAmount ?? 0) <= 0 || (bonusRule.bonusAmount ?? 0) <= 0) continue;
        if (totalSoldAmount + 0.0001 < (bonusRule.minimumGoalAmount ?? 0)) continue;

        accrualsToCreate.push({
          branchId: data.branchId,
          salespersonId: data.sellerId,
          saleId: data.saleId,
          saleItemId: null,
          commissionRuleId: bonusRule.id,
          accrualType: "monthly_bonus",
          referenceKey: `bonus:${bonusRule.id}:${localDateParts.monthKey}`,
          periodMonth: localDateParts.monthKey,
          status: "approved",
          baseAmount: String(totalSoldAmount) as any,
          rateSnapshot: null,
          fixedAmountSnapshot: String(bonusRule.bonusAmount ?? 0) as any,
          commissionAmount: String(bonusRule.bonusAmount ?? 0) as any,
          salespersonNameSnapshot: data.sellerNameSnapshot || "Vendedor",
          ruleNameSnapshot: bonusRule.name,
          calculationSnapshot: {
            ruleType: bonusRule.ruleType,
            month: localDateParts.monthKey,
            minimumGoalAmount: bonusRule.minimumGoalAmount,
            totalSoldAmount,
            triggeredBySaleId: data.saleId,
          },
          accruedAt: new Date(),
          approvedAt: new Date(),
          paidAmount: "0" as any,
          reversedAt: null,
          reversalReason: null,
        });
      }
    }

    if (!accrualsToCreate.length) return;

    await tx
      .insert(branchCommissionAccruals)
      .values(accrualsToCreate as any)
      .onConflictDoNothing({ target: [branchCommissionAccruals.branchId, branchCommissionAccruals.referenceKey] });
  }

  private async reverseCommissionAccrualsForSaleTx(
    tx: any,
    branchId: string,
    saleId: string,
    reason: string,
  ): Promise<number> {
    const result = await tx
      .update(branchCommissionAccruals)
      .set({
        status: "reversed",
        reversedAt: new Date(),
        reversalReason: reason,
      } as any)
      .where(and(
        eq(branchCommissionAccruals.branchId, branchId),
        eq(branchCommissionAccruals.saleId, saleId),
        inArray(branchCommissionAccruals.status, ["accrued", "approved"]),
        isNull(branchCommissionAccruals.reversedAt),
      ))
      .returning({ id: branchCommissionAccruals.id });

    return result.length;
  }

  async createBranchSale(data: {
    sale: InsertBranchSale;
    items: InsertBranchSaleItem[];
    payments: InsertBranchSalePayment[];
    finance?: {
      source: string;
      category?: string | null;
      notes?: string | null;
      entryDate?: string | null;
      metadata?: any;
      clientName?: string | null;
    } | null;
    inventoryAdjustment?: {
      commercialProductId: string;
      quantity: number;
      unitCostSnapshot?: number | null;
      createdBy?: string | null;
      notes?: string | null;
      metadata?: any;
    } | null;
    inventoryAdjustments?: Array<{
      commercialProductId: string;
      quantity: number;
      unitCostSnapshot?: number | null;
      createdBy?: string | null;
      notes?: string | null;
      metadata?: any;
    }> | null;
  }): Promise<BranchSaleRow> {
    if (!data.items.length) {
      throw new Error("BRANCH_SALE_REQUIRES_ITEMS");
    }
    if (!data.payments.length) {
      throw new Error("BRANCH_SALE_REQUIRES_PAYMENTS");
    }
    const idempotencyKey = normalizeOptionalTextValue((data.sale as any).idempotencyKey);
    if (idempotencyKey) {
      const existingSale = await this.getBranchSaleByIdempotencyKey(data.sale.branchId, idempotencyKey);
      if (existingSale) {
        return existingSale;
      }
    }

    const inventoryAdjustments = [
      ...(data.inventoryAdjustments ?? []),
      ...(data.inventoryAdjustment ? [data.inventoryAdjustment] : []),
    ].filter(Boolean) as Array<{
      commercialProductId: string;
      quantity: number;
      unitCostSnapshot?: number | null;
      createdBy?: string | null;
      notes?: string | null;
      metadata?: any;
    }>;

    try {
      const created = await db.transaction(async (tx) => {
        let sellerId = data.sale.sellerId ?? null;
        let sellerUserId = data.sale.sellerUserId ?? null;
        let sellerNameSnapshot = data.sale.sellerNameSnapshot ?? null;
        let sellerMetadata = data.sale.sellerMetadata ?? null;
        const projectId = normalizeOptionalTextValue((data.sale as any).projectId);

        if (projectId) {
          const project = await this.getAssignableBranchCommercialProjectTx(tx, data.sale.branchId, projectId);
          if (!project) {
            throw new Error("BRANCH_SALE_PROJECT_INVALID");
          }
        }

        if (sellerId) {
          const [salesperson] = await tx
            .select()
            .from(branchSalespeople)
            .where(and(
              eq(branchSalespeople.id, sellerId),
              eq(branchSalespeople.branchId, data.sale.branchId),
              isNull(branchSalespeople.deletedAt),
            ))
            .limit(1);

          if (!salesperson) {
            throw new Error("BRANCH_SALESPERSON_INVALID");
          }
          if (!salesperson.isActive) {
            throw new Error("BRANCH_SALESPERSON_INACTIVE");
          }

          sellerUserId = salesperson.userId ?? null;
          sellerNameSnapshot = [salesperson.name, salesperson.lastName].filter(Boolean).join(" ").trim() || salesperson.name;
          sellerMetadata = {
            ...(sellerMetadata && typeof sellerMetadata === "object" ? sellerMetadata : {}),
            employeeCode: salesperson.employeeCode ?? null,
            roleLabel: salesperson.roleLabel ?? null,
          };
        } else {
          sellerId = null;
          sellerUserId = data.sale.sellerUserId ?? null;
          sellerNameSnapshot = data.sale.sellerNameSnapshot ?? null;
          sellerMetadata = data.sale.sellerMetadata ?? null;
        }

        const [saleRow] = await tx
          .insert(branchSales)
          .values({
            ...data.sale,
            idempotencyKey,
            projectId,
            sellerId,
            sellerUserId,
            sellerNameSnapshot,
            sellerMetadata,
            folio: data.sale.folio?.trim() || generateBranchSaleFolio(),
            subtotalAmount: String(toFinanceAmount(data.sale.subtotalAmount)),
            discountAmount: String(toFinanceAmount(data.sale.discountAmount)),
            totalAmount: String(toFinanceAmount(data.sale.totalAmount)),
            paidAmount: String(toFinanceAmount(data.sale.paidAmount)),
            taxRate: (data.sale as any).taxRate == null ? null : String(toFinanceAmount((data.sale as any).taxRate)),
            subtotalBeforeTax: (data.sale as any).subtotalBeforeTax == null ? null : String(toFinanceAmount((data.sale as any).subtotalBeforeTax)),
            taxableSubtotal: (data.sale as any).taxableSubtotal == null ? null : String(toFinanceAmount((data.sale as any).taxableSubtotal)),
            taxTotal: (data.sale as any).taxTotal == null ? null : String(toFinanceAmount((data.sale as any).taxTotal)),
            grandTotal: (data.sale as any).grandTotal == null ? null : String(toFinanceAmount((data.sale as any).grandTotal)),
          } as any)
          .returning({
            id: branchSales.id,
            branchId: branchSales.branchId,
            folio: branchSales.folio,
          });

        const createdItems = await tx.insert(branchSaleItems).values(
          data.items.map((item) => ({
            ...item,
            saleId: saleRow.id,
            branchId: saleRow.branchId,
            unitPriceAmount: String(toFinanceAmount(item.unitPriceAmount)),
            discountAmount: String(toFinanceAmount(item.discountAmount)),
            costAmountSnapshot: String(toFinanceAmount(item.costAmountSnapshot)),
            lineTotalAmount: String(toFinanceAmount(item.lineTotalAmount)),
          })) as any,
        ).returning();

        const paymentRows = await tx.insert(branchSalePayments).values(
          data.payments.map((payment) => ({
            ...payment,
            saleId: saleRow.id,
            branchId: saleRow.branchId,
            amount: String(toFinanceAmount(payment.amount)),
          })) as any,
        ).returning();

        for (const adjustment of inventoryAdjustments) {
          const quantity = adjustment.quantity;
          const inventoryUpdate = await tx.execute(sql`
            UPDATE branch_inventory_balances
            SET
              quantity_on_hand = quantity_on_hand - ${quantity},
              updated_by = ${adjustment.createdBy ?? null},
              updated_at = now()
            WHERE branch_id = ${saleRow.branchId}
              AND commercial_product_id = ${adjustment.commercialProductId}
              AND quantity_on_hand >= ${quantity}
            RETURNING
              id,
              quantity_on_hand + ${quantity} AS quantity_before,
              quantity_on_hand AS quantity_after,
              minimum_stock
          `);

          const updatedBalance = (inventoryUpdate as any)?.rows?.[0] ?? null;
          if (!updatedBalance) {
            const [balanceCheck] = await tx
              .select()
              .from(branchInventoryBalances)
              .where(and(
                eq(branchInventoryBalances.branchId, saleRow.branchId),
                eq(branchInventoryBalances.commercialProductId, adjustment.commercialProductId),
              ))
              .limit(1);

            throw new Error(balanceCheck ? "INVENTORY_INSUFFICIENT_STOCK" : "INVENTORY_NOT_INITIALIZED");
          }

          const linkedSaleItem = createdItems.find((item) => item.commercialProductId === adjustment.commercialProductId) ?? createdItems[0];

          await this.insertBranchInventoryMovementTx(tx, {
            branchId: saleRow.branchId,
            commercialProductId: adjustment.commercialProductId,
            movementType: "sale",
            quantityDelta: -quantity,
            quantityBefore: Number(updatedBalance.quantity_before ?? 0),
            quantityAfter: Number(updatedBalance.quantity_after ?? 0),
            unitCostSnapshot: adjustment.unitCostSnapshot ?? null,
            reason: "Salida automatica por venta",
            notes: adjustment.notes ?? null,
            saleId: saleRow.id,
            saleItemId: linkedSaleItem?.id ?? null,
            createdBy: adjustment.createdBy ?? null,
            metadata: adjustment.metadata ?? null,
          } as any);
        }

        await this.createCommissionAccrualsForSaleTx(tx, {
          branchId: saleRow.branchId,
          saleId: saleRow.id,
          sellerId,
          sellerNameSnapshot,
          totalAmount: toFinanceAmount(data.sale.totalAmount),
          items: createdItems as BranchSaleItem[],
        });

        if (data.finance) {
          const financeConcept = this.buildBranchSaleFinanceConcept(saleRow, createdItems, sellerNameSnapshot);
          const financeEntryDate = data.finance.entryDate ?? getMxLocalDate();
          for (const paymentRow of paymentRows) {
            await tx.insert(branchFinanceEntries).values({
              branchId: saleRow.branchId,
              type: "income",
              category: data.finance.category ?? "producto",
              concept: financeConcept,
              amount: String(toFinanceAmount(paymentRow.amount)),
              paymentMethod: paymentRow.paymentMethod,
              clientUserId: data.sale.clientUserId ?? null,
              clientName: data.finance.clientName ?? null,
              notes: data.finance.notes ?? normalizeOptionalTextValue(data.sale.notes),
              entryDate: financeEntryDate,
              source: data.finance.source,
              sourceId: paymentRow.id,
              metadata: {
                saleId: saleRow.id,
                salePaymentId: paymentRow.id,
                folio: saleRow.folio,
                sellerId,
                sellerUserId,
                sellerNameSnapshot,
                items: createdItems.map((item) => ({
                  saleItemId: item.id,
                  commercialProductId: item.commercialProductId ?? null,
                  name: item.nameSnapshot,
                  category: item.categorySnapshot ?? null,
                  quantity: item.quantity,
                  unitPriceAmount: toFinanceAmount(item.unitPriceAmount),
                  lineTotalAmount: toFinanceAmount(item.lineTotalAmount),
                })),
                ...(data.finance.metadata && typeof data.finance.metadata === "object" ? data.finance.metadata : {}),
              },
              createdBy: data.sale.createdBy ?? null,
            } as any);
          }
        }

        return saleRow;
      });

      return (await this.getBranchSaleById(created.branchId, created.id))!;
    } catch (error: any) {
      if (idempotencyKey && isPgUniqueViolation(error)) {
        const existingSale = await this.getBranchSaleByIdempotencyKey(data.sale.branchId, idempotencyKey);
        if (existingSale) {
          return existingSale;
        }
      }
      throw error;
    }
  }

  async getBranchServices(branchId: string): Promise<BranchServiceRow[]> {
    const services = await db
      .select()
      .from(branchServices)
      .where(and(
        eq(branchServices.branchId, branchId),
        isNull(branchServices.deletedAt),
      ))
      .orderBy(desc(branchServices.isActive), asc(branchServices.displayOrder), asc(branchServices.name));

    const optionRows = await db
      .select()
      .from(branchServiceSaleOptions)
      .where(and(
        eq(branchServiceSaleOptions.branchId, branchId),
        isNull(branchServiceSaleOptions.deletedAt),
      ))
      .orderBy(
        desc(branchServiceSaleOptions.isActive),
        asc(branchServiceSaleOptions.displayOrder),
        asc(branchServiceSaleOptions.name),
      );

    const optionsByServiceId = new Map<string, BranchServiceSaleOptionRow[]>();
    for (const option of optionRows) {
      const mapped = this.mapBranchServiceSaleOptionRow(option);
      const current = optionsByServiceId.get(option.serviceId) || [];
      current.push(mapped);
      optionsByServiceId.set(option.serviceId, current);
    }

    return services.map((service) => ({
      id: service.id,
      branchId: service.branchId,
      name: service.name,
      category: service.category,
      description: service.description ?? null,
      baseDurationMinutes: service.baseDurationMinutes ?? null,
      capacity: service.capacity ?? null,
      requiresAgenda: service.requiresAgenda,
      visibility: (service.visibility === "internal" ? "internal" : "public"),
      isActive: service.isActive,
      displayOrder: service.displayOrder,
      createdBy: service.createdBy ?? null,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      options: optionsByServiceId.get(service.id) || [],
    }));
  }

  async createBranchService(data: InsertBranchService): Promise<BranchServiceRow> {
    const [created] = await db
      .insert(branchServices)
      .values(data)
      .returning({ id: branchServices.id, branchId: branchServices.branchId });

    return (await this.getBranchServiceById(created.branchId, created.id))!;
  }

  async updateBranchService(
    branchId: string,
    serviceId: string,
    data: Partial<InsertBranchService>,
  ): Promise<BranchServiceRow | undefined> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.baseDurationMinutes !== undefined) updateData.baseDurationMinutes = data.baseDurationMinutes;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.requiresAgenda !== undefined) updateData.requiresAgenda = data.requiresAgenda;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
    if (data.createdBy !== undefined) updateData.createdBy = data.createdBy;

    const [updated] = await db
      .update(branchServices)
      .set(updateData)
      .where(and(
        eq(branchServices.id, serviceId),
        eq(branchServices.branchId, branchId),
        isNull(branchServices.deletedAt),
      ))
      .returning({ id: branchServices.id });

    if (!updated) return undefined;
    return this.getBranchServiceById(branchId, updated.id);
  }

  async softDeleteBranchService(branchId: string, serviceId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(branchServices)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          isActive: false,
        })
        .where(and(
          eq(branchServices.id, serviceId),
          eq(branchServices.branchId, branchId),
          isNull(branchServices.deletedAt),
        ))
        .returning({ id: branchServices.id });

      if (!deleted) return false;

      await tx
        .update(branchServiceSaleOptions)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          isActive: false,
        })
        .where(and(
          eq(branchServiceSaleOptions.branchId, branchId),
          eq(branchServiceSaleOptions.serviceId, serviceId),
          isNull(branchServiceSaleOptions.deletedAt),
        ));

      return true;
    });
  }

  async createBranchServiceSaleOption(data: InsertBranchServiceSaleOption): Promise<BranchServiceSaleOptionRow> {
    const [created] = await db
      .insert(branchServiceSaleOptions)
      .values({
        ...data,
        price: String(data.price),
      })
      .returning();

    return this.mapBranchServiceSaleOptionRow(created);
  }

  async updateBranchServiceSaleOption(
    branchId: string,
    optionId: string,
    data: Partial<InsertBranchServiceSaleOption>,
  ): Promise<BranchServiceSaleOptionRow | undefined> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.serviceId !== undefined) updateData.serviceId = data.serviceId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.price !== undefined) updateData.price = String(data.price);
    if (data.includedUses !== undefined) updateData.includedUses = data.includedUses;
    if (data.isUnlimited !== undefined) updateData.isUnlimited = data.isUnlimited;
    if (data.validityDays !== undefined) updateData.validityDays = data.validityDays;
    if (data.requiresRegisteredClient !== undefined) updateData.requiresRegisteredClient = data.requiresRegisteredClient;
    if (data.allowsWalkIn !== undefined) updateData.allowsWalkIn = data.allowsWalkIn;
    if (data.isPosFavorite !== undefined) updateData.isPosFavorite = data.isPosFavorite;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
    if (data.createdBy !== undefined) updateData.createdBy = data.createdBy;

    const [updated] = await db
      .update(branchServiceSaleOptions)
      .set(updateData)
      .where(and(
        eq(branchServiceSaleOptions.id, optionId),
        eq(branchServiceSaleOptions.branchId, branchId),
        isNull(branchServiceSaleOptions.deletedAt),
      ))
      .returning();

    return updated ? this.mapBranchServiceSaleOptionRow(updated) : undefined;
  }

  async softDeleteBranchServiceSaleOption(branchId: string, optionId: string): Promise<boolean> {
    const [updated] = await db
      .update(branchServiceSaleOptions)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        isActive: false,
      })
      .where(and(
        eq(branchServiceSaleOptions.id, optionId),
        eq(branchServiceSaleOptions.branchId, branchId),
        isNull(branchServiceSaleOptions.deletedAt),
      ))
      .returning({ id: branchServiceSaleOptions.id });

    return !!updated;
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

  async updateClient(userId: string, data: { name?: string; email?: string | null; lastName?: string | null; phone?: string | null; birthDate?: string | null; gender?: string | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null; medicalNotes?: string | null; injuriesNotes?: string | null; medicalWarnings?: string | null; parqAccepted?: boolean; parqAcceptedDate?: string | null; avatarUrl?: string | null }): Promise<any> {
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

  async updateBranchClientPrivateProfile(
    branchId: string,
    userId: string,
    data: {
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      medicalNotes?: string | null;
      injuriesNotes?: string | null;
      medicalWarnings?: string | null;
      parqAccepted?: boolean;
      parqAcceptedDate?: string | null;
    },
  ): Promise<any> {
    const crmEntry = await this.upsertBranchClientCrm(branchId, userId, {
      ...data,
      privateProfileInitialized: true,
    });

    return {
      emergencyContactName: crmEntry.emergencyContactName,
      emergencyContactPhone: crmEntry.emergencyContactPhone,
      medicalNotes: crmEntry.medicalNotes,
      injuriesNotes: crmEntry.injuriesNotes,
      medicalWarnings: crmEntry.medicalWarnings,
      parqAccepted: crmEntry.parqAccepted,
      parqAcceptedDate: crmEntry.parqAcceptedDate,
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

  async updateBranchProfile(branchId: string, data: { name?: string | null; description?: string | null; address?: string | null; city?: string | null; googleMapsUrl?: string | null; operatingHours?: any; locations?: any; summaryHours?: string | null; category?: string | null; subcategory?: string | null; searchKeywords?: string | null; latitude?: number | null; longitude?: number | null; whatsappNumber?: string | null }): Promise<any> {
    const setData: any = {};
    if (data.name !== undefined) setData.name = data.name;
    if (data.description !== undefined) setData.description = data.description;
    if (data.address !== undefined) setData.address = data.address;
    if (data.city !== undefined) setData.city = data.city;
    if (data.googleMapsUrl !== undefined) setData.googleMapsUrl = data.googleMapsUrl;
    if (data.operatingHours !== undefined) setData.operatingHours = data.operatingHours;
    if (data.locations !== undefined) setData.locations = data.locations;
    if (data.summaryHours !== undefined) setData.summaryHours = data.summaryHours;
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
      WITH date_context AS (
        SELECT (now() AT TIME ZONE 'America/Mexico_City')::date AS local_today
      )
      SELECT u.id as "userId", u.name, u.last_name as "lastName", u.phone, u.birth_date as "birthDate",
             m.id as "membershipId"
      FROM users u
      INNER JOIN memberships m ON m.user_id = u.id
      CROSS JOIN date_context ctx
      WHERE m.branch_id = ${branchId}
        AND m.status = 'active'
        AND u.birth_date IS NOT NULL
        AND u.birth_date != ''
        AND (
          TO_DATE(u.birth_date, 'YYYY-MM-DD') IS NOT NULL
          AND (
            (EXTRACT(MONTH FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) = EXTRACT(MONTH FROM ctx.local_today)
             AND EXTRACT(DAY FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) >= EXTRACT(DAY FROM ctx.local_today)
             AND EXTRACT(DAY FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) <= EXTRACT(DAY FROM (ctx.local_today + ${daysAhead}::int)))
            OR
            (EXTRACT(MONTH FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) = EXTRACT(MONTH FROM (ctx.local_today + ${daysAhead}::int))
             AND EXTRACT(MONTH FROM ctx.local_today) != EXTRACT(MONTH FROM (ctx.local_today + ${daysAhead}::int))
             AND EXTRACT(DAY FROM TO_DATE(u.birth_date, 'YYYY-MM-DD')) <= EXTRACT(DAY FROM (ctx.local_today + ${daysAhead}::int)))
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
        userId: branchReviews.userId,
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

  async getBranchReviewById(reviewId: string): Promise<BranchReview | undefined> {
    const [review] = await db.select().from(branchReviews).where(eq(branchReviews.id, reviewId)).limit(1);
    return review;
  }

  async updateReviewReply(reviewId: string, adminReply: string | null): Promise<BranchReview | undefined> {
    const [updated] = await db
      .update(branchReviews)
      .set({ adminReply })
      .where(eq(branchReviews.id, reviewId))
      .returning();
    return updated;
  }

  async updateReviewVisibility(reviewId: string, hidden: boolean, reason?: string | null): Promise<BranchReview | undefined> {
    const [updated] = await db
      .update(branchReviews)
      .set({
        isHidden: hidden,
        hiddenReason: hidden ? (reason ?? null) : null,
      })
      .where(eq(branchReviews.id, reviewId))
      .returning();
    return updated;
  }

  async createReviewReport(data: InsertReviewReport): Promise<ReviewReport> {
    const [report] = await db
      .insert(reviewReports)
      .values({
        reviewId: data.reviewId,
        branchId: data.branchId,
        reporterUserId: data.reporterUserId ?? null,
        reportedByRole: data.reportedByRole ?? "CUSTOMER",
        reason: data.reason,
        note: data.note ?? null,
        status: (data.status as any) ?? "pending",
        reviewedByUserId: data.reviewedByUserId ?? null,
        resolutionNote: data.resolutionNote ?? null,
      })
      .returning();
    return report;
  }

  async getReviewReports(filters?: { branchId?: string; status?: string; limit?: number }): Promise<ReviewReportRow[]> {
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(reviewReports.branchId, filters.branchId));
    if (filters?.status) conditions.push(eq(reviewReports.status, filters.status as any));

    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);

    const rows = await db
      .select({
        id: reviewReports.id,
        reviewId: reviewReports.reviewId,
        branchId: reviewReports.branchId,
        reporterUserId: reviewReports.reporterUserId,
        reportedByRole: reviewReports.reportedByRole,
        reason: reviewReports.reason,
        note: reviewReports.note,
        status: reviewReports.status,
        createdAt: reviewReports.createdAt,
        resolvedAt: reviewReports.resolvedAt,
        reviewedByUserId: reviewReports.reviewedByUserId,
        resolutionNote: reviewReports.resolutionNote,
        reviewRating: branchReviews.rating,
        reviewComment: branchReviews.comment,
        branchName: branches.name,
        branchSlug: branches.slug,
        reporterName: sql<string | null>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${reviewReports.reporterUserId} LIMIT 1)`,
        reviewerName: sql<string | null>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${reviewReports.reviewedByUserId} LIMIT 1)`,
        customerName: sql<string | null>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${branchReviews.userId} LIMIT 1)`,
        customerLastName: sql<string | null>`(SELECT ${users.lastName} FROM ${users} WHERE ${users.id} = ${branchReviews.userId} LIMIT 1)`,
        isHidden: branchReviews.isHidden,
        hiddenReason: branchReviews.hiddenReason,
        adminReply: branchReviews.adminReply,
      })
      .from(reviewReports)
      .innerJoin(branchReviews, eq(reviewReports.reviewId, branchReviews.id))
      .innerJoin(branches, eq(reviewReports.branchId, branches.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reviewReports.createdAt))
      .limit(limit);

    return rows as ReviewReportRow[];
  }

  async updateReviewReportStatus(
    reportId: string,
    status: string,
    reviewedByUserId: string,
    resolutionNote?: string | null,
  ): Promise<ReviewReport | undefined> {
    const [updated] = await db
      .update(reviewReports)
      .set({
        status: status as any,
        reviewedByUserId,
        resolvedAt: new Date(),
        resolutionNote: resolutionNote ?? null,
      })
      .where(eq(reviewReports.id, reportId))
      .returning();

    return updated;
  }

  async createReviewModerationLog(data: InsertReviewModerationLog): Promise<ReviewModerationLog> {
    const [log] = await db
      .insert(reviewModerationLogs)
      .values({
        reviewId: data.reviewId,
        action: data.action,
        actorUserId: data.actorUserId ?? null,
        reason: data.reason ?? null,
        metadata: data.metadata ?? null,
      })
      .returning();

    return log;
  }

  async getReviewModerationLogs(limit = 100): Promise<Array<ReviewModerationLog & { branchName?: string | null; reviewComment?: string | null; actorName?: string | null }>> {
    const rows = await db
      .select({
        id: reviewModerationLogs.id,
        reviewId: reviewModerationLogs.reviewId,
        action: reviewModerationLogs.action,
        actorUserId: reviewModerationLogs.actorUserId,
        reason: reviewModerationLogs.reason,
        metadata: reviewModerationLogs.metadata,
        createdAt: reviewModerationLogs.createdAt,
        branchName: branches.name,
        reviewComment: branchReviews.comment,
        actorName: sql<string | null>`(SELECT ${users.name} FROM ${users} WHERE ${users.id} = ${reviewModerationLogs.actorUserId} LIMIT 1)`,
      })
      .from(reviewModerationLogs)
      .innerJoin(branchReviews, eq(reviewModerationLogs.reviewId, branchReviews.id))
      .innerJoin(branches, eq(branchReviews.branchId, branches.id))
      .orderBy(desc(reviewModerationLogs.createdAt))
      .limit(Math.min(Math.max(limit, 1), 500));

    return rows as Array<ReviewModerationLog & { branchName?: string | null; reviewComment?: string | null; actorName?: string | null }>;
  }

  async getBlockedCustomerUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(and(eq(users.role, "CUSTOMER"), eq(users.isBlocked, true)))
      .orderBy(desc(users.blockedAt), desc(users.createdAt));
  }

  async createNotificationJob(data: InsertNotificationJob): Promise<NotificationJob> {
    const [job] = await db
      .insert(notificationJobs)
      .values({
        type: data.type,
        branchId: data.branchId ?? null,
        userId: data.userId ?? null,
        payload: data.payload ?? null,
        scheduledFor: data.scheduledFor,
        status: data.status ?? "pending",
        attempts: data.attempts ?? 0,
        lastError: data.lastError ?? null,
      })
      .returning();
    return job;
  }

  async getNotificationJobs(filters?: { branchId?: string; status?: string; limit?: number }): Promise<NotificationJob[]> {
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(notificationJobs.branchId, filters.branchId));
    if (filters?.status) conditions.push(eq(notificationJobs.status, filters.status));

    return db
      .select()
      .from(notificationJobs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(notificationJobs.scheduledFor), desc(notificationJobs.createdAt))
      .limit(Math.min(Math.max(filters?.limit ?? 100, 1), 500));
  }

  async updateNotificationJob(
    id: string,
    data: Partial<InsertNotificationJob> & { processedAt?: Date | null; attempts?: number; status?: string; lastError?: string | null },
  ): Promise<NotificationJob | undefined> {
    const setData: any = {};
    if (data.type !== undefined) setData.type = data.type;
    if (data.branchId !== undefined) setData.branchId = data.branchId;
    if (data.userId !== undefined) setData.userId = data.userId;
    if (data.payload !== undefined) setData.payload = data.payload;
    if (data.scheduledFor !== undefined) setData.scheduledFor = data.scheduledFor;
    if (data.status !== undefined) setData.status = data.status;
    if (data.attempts !== undefined) setData.attempts = data.attempts;
    if (data.lastError !== undefined) setData.lastError = data.lastError;
    if (data.processedAt !== undefined) setData.processedAt = data.processedAt;

    const [updated] = await db
      .update(notificationJobs)
      .set(setData)
      .where(eq(notificationJobs.id, id))
      .returning();
    return updated;
  }

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const [userStatsRows, branchStatsRows, searchStatsRows, reservationStatsRows, activeBranchRows] = await Promise.all([
      db
        .select({
          total: sql<number>`COUNT(*)`,
        })
        .from(users)
        .where(eq(users.role, "CUSTOMER")),
      db
        .select({
          active: sql<number>`COUNT(*)`,
        })
        .from(branches)
        .where(and(eq(branches.status, "active"), isNull(branches.deletedAt))),
      db
        .select({
          total: sql<number>`COUNT(*)`,
          zeroResults: sql<number>`COUNT(*) FILTER (WHERE ${searchLogs.resultCount} = 0)`,
        })
        .from(searchLogs),
      db
        .select({
          action: reservationAuditLogs.action,
          total: sql<number>`COUNT(*)::int`,
        })
        .from(reservationAuditLogs)
        .groupBy(reservationAuditLogs.action),
      db
        .select({
          branchId: reservationAuditLogs.branchId,
          branchName: branches.name,
          totalReservations: sql<number>`COUNT(*) FILTER (WHERE ${reservationAuditLogs.action} = 'created')::int`,
        })
        .from(reservationAuditLogs)
        .innerJoin(branches, eq(reservationAuditLogs.branchId, branches.id))
        .groupBy(reservationAuditLogs.branchId, branches.name)
        .orderBy(desc(sql`COUNT(*) FILTER (WHERE ${reservationAuditLogs.action} = 'created')::int`))
        .limit(5),
    ]);

    const userStats = userStatsRows[0];
    const branchStats = branchStatsRows[0];
    const searchStats = searchStatsRows[0];

    const reservationStats = {
      created: 0,
      cancelled: 0,
      attended: 0,
      noShow: 0,
    };

    for (const row of reservationStatsRows) {
      const total = Number(row.total) || 0;
      if (row.action === "created") reservationStats.created = total;
      if (row.action === "cancelled") reservationStats.cancelled = total;
      if (row.action === "attended") reservationStats.attended = total;
      if (row.action === "no_show") reservationStats.noShow = total;
    }

    return {
      totalAppUsers: Number(userStats?.total) || 0,
      activeBranches: Number(branchStats?.active) || 0,
      totalSearches: Number(searchStats?.total) || 0,
      zeroResultSearches: Number(searchStats?.zeroResults) || 0,
      reservationStats,
      mostActiveBranches: activeBranchRows.map((row) => ({
        branchId: row.branchId,
        branchName: row.branchName,
        totalReservations: Number(row.totalReservations) || 0,
      })),
    };
  }

  async getBranchDashboardMetrics(branchId: string): Promise<BranchDashboardMetrics> {
    const today = getMxLocalDate();
    const [upcomingRow, reviewRow, promotionRow, auditRows, branchClients] = await Promise.all([
      db
        .select({
          total: sql<number>`COUNT(*)::int`,
        })
        .from(classBookings)
        .where(and(
          eq(classBookings.branchId, branchId),
          eq(classBookings.status, "confirmed"),
          gte(classBookings.bookingDate, today),
        )),
      db
        .select({
          total: sql<number>`COUNT(*)::int`,
        })
        .from(branchReviews)
        .where(and(
          eq(branchReviews.branchId, branchId),
          sql`${branchReviews.createdAt} >= NOW() - INTERVAL '30 days'`,
        )),
      db
        .select({
          total: sql<number>`COUNT(*)::int`,
        })
        .from(promotions)
        .where(and(
          eq(promotions.branchId, branchId),
          eq(promotions.isActive, true),
        )),
      db
        .select({
          action: reservationAuditLogs.action,
          total: sql<number>`COUNT(*)::int`,
        })
        .from(reservationAuditLogs)
        .where(eq(reservationAuditLogs.branchId, branchId))
        .groupBy(reservationAuditLogs.action),
      this.getBranchClients(branchId),
    ]);

    let cancelledBookings = 0;
    let noShowBookings = 0;

    for (const row of auditRows) {
      const total = Number(row.total) || 0;
      if (row.action === "cancelled") cancelledBookings = total;
      if (row.action === "no_show") noShowBookings = total;
    }

    const activeClients = branchClients.filter((client) => ["activo", "vip"].includes(client.crmClientStatus)).length;
    const inactiveClients = branchClients.filter((client) => client.crmClientStatus === "inactivo").length;
    const lowClassesClients = branchClients.filter((client) => {
      const remaining = client.classesRemaining;
      return typeof remaining === "number" && remaining > 0 && remaining <= 3;
    }).length;

    return {
      upcomingBookings: Number(upcomingRow[0]?.total) || 0,
      cancelledBookings,
      noShowBookings,
      activeClients,
      inactiveClients,
      lowClassesClients,
      activePromotions: Number(promotionRow[0]?.total) || 0,
      recentReviews: Number(reviewRow[0]?.total) || 0,
    };
  }

  private mapBranchMonthlyBillingRow(row: any): BranchMonthlyBillingRow {
    const nextPaymentDate = row.nextPaymentDate ?? null;
    return {
      id: row.id ?? null,
      branchId: row.branchId,
      branchName: row.branchName,
      branchSlug: row.branchSlug,
      branchStatus: row.branchStatus,
      monthlyFeeAmount: toFinanceAmount(row.monthlyFeeAmount),
      paymentDay: row.paymentDay === null || row.paymentDay === undefined ? null : Number(row.paymentDay),
      lastPaymentDate: row.lastPaymentDate ?? null,
      nextPaymentDate,
      paymentStatus: resolveMonthlyBillingStatus(row.paymentStatus, nextPaymentDate),
      sellerName: row.sellerName ?? null,
      sellerCommissionAmount: toFinanceAmount(row.sellerCommissionAmount),
      notes: row.notes ?? null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  private async getBranchMonthlyBillingByBranchId(branchId: string): Promise<BranchMonthlyBillingRow | undefined> {
    const [row] = await db
      .select({
        id: branchMonthlyBilling.id,
        branchId: branches.id,
        branchName: branches.name,
        branchSlug: branches.slug,
        branchStatus: branches.status,
        monthlyFeeAmount: branchMonthlyBilling.monthlyFeeAmount,
        paymentDay: branchMonthlyBilling.paymentDay,
        lastPaymentDate: branchMonthlyBilling.lastPaymentDate,
        nextPaymentDate: branchMonthlyBilling.nextPaymentDate,
        paymentStatus: branchMonthlyBilling.paymentStatus,
        sellerName: branchMonthlyBilling.sellerName,
        sellerCommissionAmount: branchMonthlyBilling.sellerCommissionAmount,
        notes: branchMonthlyBilling.notes,
        createdAt: branchMonthlyBilling.createdAt,
        updatedAt: branchMonthlyBilling.updatedAt,
      })
      .from(branches)
      .leftJoin(branchMonthlyBilling, eq(branchMonthlyBilling.branchId, branches.id))
      .where(and(eq(branches.id, branchId), isNull(branches.deletedAt)))
      .limit(1);

    return row ? this.mapBranchMonthlyBillingRow(row) : undefined;
  }

  async getSuperAdminMonthlyBilling(): Promise<BranchMonthlyBillingRow[]> {
    const rows = await db
      .select({
        id: branchMonthlyBilling.id,
        branchId: branches.id,
        branchName: branches.name,
        branchSlug: branches.slug,
        branchStatus: branches.status,
        monthlyFeeAmount: branchMonthlyBilling.monthlyFeeAmount,
        paymentDay: branchMonthlyBilling.paymentDay,
        lastPaymentDate: branchMonthlyBilling.lastPaymentDate,
        nextPaymentDate: branchMonthlyBilling.nextPaymentDate,
        paymentStatus: branchMonthlyBilling.paymentStatus,
        sellerName: branchMonthlyBilling.sellerName,
        sellerCommissionAmount: branchMonthlyBilling.sellerCommissionAmount,
        notes: branchMonthlyBilling.notes,
        createdAt: branchMonthlyBilling.createdAt,
        updatedAt: branchMonthlyBilling.updatedAt,
      })
      .from(branches)
      .leftJoin(branchMonthlyBilling, eq(branchMonthlyBilling.branchId, branches.id))
      .where(isNull(branches.deletedAt))
      .orderBy(
        asc(sql`CASE WHEN ${branches.status} = 'active' THEN 0 WHEN ${branches.status} = 'suspended' THEN 1 ELSE 2 END`),
        asc(branches.name),
      );

    return rows.map((row) => this.mapBranchMonthlyBillingRow(row));
  }

  async upsertBranchMonthlyBilling(
    branchId: string,
    data: {
      monthlyFeeAmount: number;
      paymentDay: number;
      lastPaymentDate?: string | null;
      nextPaymentDate?: string | null;
      paymentStatus?: "pending" | "paid" | "overdue";
      sellerName?: string | null;
      sellerCommissionAmount?: number;
      notes?: string | null;
    },
  ): Promise<BranchMonthlyBillingRow | undefined> {
    const [existing] = await db
      .select()
      .from(branchMonthlyBilling)
      .where(eq(branchMonthlyBilling.branchId, branchId))
      .limit(1);

    const lastPaymentDate =
      data.lastPaymentDate !== undefined
        ? data.lastPaymentDate
        : existing?.lastPaymentDate ?? null;

    const nextPaymentDate =
      data.nextPaymentDate !== undefined
        ? data.nextPaymentDate
        : existing?.nextPaymentDate ?? computeCurrentCyclePaymentDate(data.paymentDay);

    const sellerName =
      data.sellerName !== undefined
        ? data.sellerName
        : existing?.sellerName ?? null;

    const sellerCommissionAmount =
      data.sellerCommissionAmount !== undefined
        ? data.sellerCommissionAmount
        : toFinanceAmount(existing?.sellerCommissionAmount);

    const notes =
      data.notes !== undefined
        ? data.notes
        : existing?.notes ?? null;

    const paymentStatus = resolveMonthlyBillingStatus(
      data.paymentStatus ?? existing?.paymentStatus ?? "pending",
      nextPaymentDate,
    );

    await db
      .insert(branchMonthlyBilling)
      .values({
        branchId,
        monthlyFeeAmount: data.monthlyFeeAmount.toFixed(2),
        paymentDay: data.paymentDay,
        lastPaymentDate,
        nextPaymentDate,
        paymentStatus,
        sellerName,
        sellerCommissionAmount: sellerCommissionAmount.toFixed(2),
        notes,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: branchMonthlyBilling.branchId,
        set: {
          monthlyFeeAmount: data.monthlyFeeAmount.toFixed(2),
          paymentDay: data.paymentDay,
          lastPaymentDate,
          nextPaymentDate,
          paymentStatus,
          sellerName,
          sellerCommissionAmount: sellerCommissionAmount.toFixed(2),
          notes,
          updatedAt: new Date(),
        },
      });

    return this.getBranchMonthlyBillingByBranchId(branchId);
  }

  async markBranchMonthlyBillingPaid(branchId: string, paidDate?: string): Promise<BranchMonthlyBillingRow | undefined> {
    const [existing] = await db
      .select()
      .from(branchMonthlyBilling)
      .where(eq(branchMonthlyBilling.branchId, branchId))
      .limit(1);

    if (!existing) {
      return undefined;
    }

    const effectivePaidDate = paidDate ?? getMxLocalDate();
    const referenceDate = new Date(`${effectivePaidDate}T12:00:00`);
    const nextPaymentDate = computeNextMonthlyPaymentDate(existing.paymentDay, referenceDate);

    await db
      .update(branchMonthlyBilling)
      .set({
        lastPaymentDate: effectivePaidDate,
        nextPaymentDate,
        paymentStatus: "paid",
        updatedAt: new Date(),
      })
      .where(eq(branchMonthlyBilling.branchId, branchId));

    return this.getBranchMonthlyBillingByBranchId(branchId);
  }

  private mapBranchFinanceEntryRow(row: any): BranchFinanceEntryRow {
    const linkedFullName = [row.linkedClientName, row.linkedClientLastName].filter(Boolean).join(" ").trim();
    return {
      id: row.id,
      branchId: row.branchId,
      type: row.type,
      category: row.category ?? null,
      concept: row.concept,
      amount: toFinanceAmount(row.amount),
      paymentMethod: row.paymentMethod ?? null,
      clientUserId: row.clientUserId ?? null,
      clientName: row.clientName ?? null,
      clientDisplayName: linkedFullName || row.clientName || null,
      clientEmail: row.linkedClientEmail ?? null,
      notes: row.notes ?? null,
      entryDate: row.entryDate,
      source: row.source ?? null,
      sourceId: row.sourceId ?? null,
      metadata: row.metadata ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async getBranchFinanceEntryById(branchId: string, entryId: string): Promise<BranchFinanceEntryRow | undefined> {
    const [row] = await db
      .select({
        id: branchFinanceEntries.id,
        branchId: branchFinanceEntries.branchId,
        type: branchFinanceEntries.type,
        category: branchFinanceEntries.category,
        concept: branchFinanceEntries.concept,
        amount: branchFinanceEntries.amount,
        paymentMethod: branchFinanceEntries.paymentMethod,
        clientUserId: branchFinanceEntries.clientUserId,
        clientName: branchFinanceEntries.clientName,
        notes: branchFinanceEntries.notes,
        entryDate: branchFinanceEntries.entryDate,
        source: branchFinanceEntries.source,
        sourceId: branchFinanceEntries.sourceId,
        metadata: branchFinanceEntries.metadata,
        createdBy: branchFinanceEntries.createdBy,
        createdAt: branchFinanceEntries.createdAt,
        updatedAt: branchFinanceEntries.updatedAt,
        linkedClientName: users.name,
        linkedClientLastName: users.lastName,
        linkedClientEmail: users.email,
      })
      .from(branchFinanceEntries)
      .leftJoin(users, eq(branchFinanceEntries.clientUserId, users.id))
      .where(and(
        eq(branchFinanceEntries.branchId, branchId),
        eq(branchFinanceEntries.id, entryId),
        isNull(branchFinanceEntries.deletedAt),
      ))
      .limit(1);

    return row ? this.mapBranchFinanceEntryRow(row) : undefined;
  }

  private async getBranchFinanceEntryBySource(
    branchId: string,
    source: string,
    sourceId: string,
  ): Promise<BranchFinanceEntryRow | undefined> {
    const [row] = await db
      .select({
        id: branchFinanceEntries.id,
        branchId: branchFinanceEntries.branchId,
        type: branchFinanceEntries.type,
        category: branchFinanceEntries.category,
        concept: branchFinanceEntries.concept,
        amount: branchFinanceEntries.amount,
        paymentMethod: branchFinanceEntries.paymentMethod,
        clientUserId: branchFinanceEntries.clientUserId,
        clientName: branchFinanceEntries.clientName,
        notes: branchFinanceEntries.notes,
        entryDate: branchFinanceEntries.entryDate,
        source: branchFinanceEntries.source,
        sourceId: branchFinanceEntries.sourceId,
        metadata: branchFinanceEntries.metadata,
        createdBy: branchFinanceEntries.createdBy,
        createdAt: branchFinanceEntries.createdAt,
        updatedAt: branchFinanceEntries.updatedAt,
        linkedClientName: users.name,
        linkedClientLastName: users.lastName,
        linkedClientEmail: users.email,
      })
      .from(branchFinanceEntries)
      .leftJoin(users, eq(branchFinanceEntries.clientUserId, users.id))
      .where(and(
        eq(branchFinanceEntries.branchId, branchId),
        eq(branchFinanceEntries.source, source),
        eq(branchFinanceEntries.sourceId, sourceId),
        isNull(branchFinanceEntries.deletedAt),
      ))
      .limit(1);

    return row ? this.mapBranchFinanceEntryRow(row) : undefined;
  }

  private mapBranchServiceSaleOptionRow(row: BranchServiceSaleOption): BranchServiceSaleOptionRow {
    return {
      id: row.id,
      branchId: row.branchId,
      serviceId: row.serviceId,
      name: row.name,
      type: row.type,
      price: toFinanceAmount(row.price),
      includedUses: row.includedUses ?? null,
      isUnlimited: row.isUnlimited,
      validityDays: row.validityDays ?? null,
      requiresRegisteredClient: row.requiresRegisteredClient,
      allowsWalkIn: row.allowsWalkIn,
      isPosFavorite: row.isPosFavorite,
      isActive: row.isActive,
      internalNotes: row.internalNotes ?? null,
      displayOrder: row.displayOrder,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async getBranchServiceById(branchId: string, serviceId: string): Promise<BranchServiceRow | undefined> {
    const [service] = await db
      .select()
      .from(branchServices)
      .where(and(
        eq(branchServices.branchId, branchId),
        eq(branchServices.id, serviceId),
        isNull(branchServices.deletedAt),
      ))
      .limit(1);

    if (!service) return undefined;

    const optionRows = await db
      .select()
      .from(branchServiceSaleOptions)
      .where(and(
        eq(branchServiceSaleOptions.branchId, branchId),
        eq(branchServiceSaleOptions.serviceId, serviceId),
        isNull(branchServiceSaleOptions.deletedAt),
      ))
      .orderBy(
        desc(branchServiceSaleOptions.isActive),
        asc(branchServiceSaleOptions.displayOrder),
        asc(branchServiceSaleOptions.name),
      );

    return {
      id: service.id,
      branchId: service.branchId,
      name: service.name,
      category: service.category,
      description: service.description ?? null,
      baseDurationMinutes: service.baseDurationMinutes ?? null,
      capacity: service.capacity ?? null,
      requiresAgenda: service.requiresAgenda,
      visibility: (service.visibility === "internal" ? "internal" : "public"),
      isActive: service.isActive,
      displayOrder: service.displayOrder,
      createdBy: service.createdBy ?? null,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      options: optionRows.map((row) => this.mapBranchServiceSaleOptionRow(row)),
    };
  }

  private mapBranchRecurringExpenseRow(row: BranchRecurringExpense): BranchRecurringExpenseRow {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      category: row.category,
      amount: toFinanceAmount(row.amount),
      frequency: row.frequency,
      paymentDay: row.paymentDay ?? null,
      notes: row.notes ?? null,
      isActive: row.isActive,
      lastRegisteredAt: row.lastRegisteredAt ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapBranchStaffMemberRow(row: BranchStaffMember): BranchStaffMemberRow {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      phone: row.phone ?? null,
      payPerClass: toFinanceAmount(row.payPerClass),
      notes: row.notes ?? null,
      isActive: row.isActive,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async getBranchStaffClassLogById(branchId: string, classLogId: string): Promise<BranchStaffClassLogRow | undefined> {
    const [row] = await db
      .select({
        id: branchStaffClassLogs.id,
        branchId: branchStaffClassLogs.branchId,
        staffId: branchStaffClassLogs.staffId,
        staffName: branchStaffMembers.name,
        classesCount: branchStaffClassLogs.classesCount,
        paymentTotal: branchStaffClassLogs.paymentTotal,
        classDate: branchStaffClassLogs.classDate,
        notes: branchStaffClassLogs.notes,
        financeEntryId: branchStaffClassLogs.financeEntryId,
        paymentMethod: branchFinanceEntries.paymentMethod,
        createdBy: branchStaffClassLogs.createdBy,
        createdAt: branchStaffClassLogs.createdAt,
        updatedAt: branchStaffClassLogs.updatedAt,
      })
      .from(branchStaffClassLogs)
      .innerJoin(branchStaffMembers, eq(branchStaffClassLogs.staffId, branchStaffMembers.id))
      .leftJoin(branchFinanceEntries, eq(branchStaffClassLogs.financeEntryId, branchFinanceEntries.id))
      .where(and(
        eq(branchStaffClassLogs.branchId, branchId),
        eq(branchStaffClassLogs.id, classLogId),
      ))
      .limit(1);

    if (!row) return undefined;

    return {
      id: row.id,
      branchId: row.branchId,
      staffId: row.staffId,
      staffName: row.staffName,
      classesCount: row.classesCount,
      paymentTotal: toFinanceAmount(row.paymentTotal),
      classDate: row.classDate,
      notes: row.notes ?? null,
      financeEntryId: row.financeEntryId ?? null,
      paymentMethod: row.paymentMethod ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getBranchFinanceSummary(branchId: string, filters?: { from?: string; to?: string }): Promise<BranchFinanceSummary> {
    const today = getMxLocalDate();
    const monthRange = getCurrentMonthRange();
    const rangeFrom = filters?.from || monthRange.from;
    const rangeTo = filters?.to || monthRange.to;

    const baseConditions = and(
      eq(branchFinanceEntries.branchId, branchId),
      isNull(branchFinanceEntries.deletedAt),
      gte(branchFinanceEntries.entryDate, rangeFrom),
      lte(branchFinanceEntries.entryDate, rangeTo),
    )!;

    const todayConditions = and(
      eq(branchFinanceEntries.branchId, branchId),
      isNull(branchFinanceEntries.deletedAt),
      eq(branchFinanceEntries.entryDate, today),
    )!;

    const monthConditions = and(
      eq(branchFinanceEntries.branchId, branchId),
      isNull(branchFinanceEntries.deletedAt),
      gte(branchFinanceEntries.entryDate, monthRange.from),
      lte(branchFinanceEntries.entryDate, monthRange.to),
    )!;

    const [summaryRows, todayRows, monthRows, dailyRows, topIncomeRows, topExpenseRows] = await Promise.all([
      db
        .select({
          totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'income' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
          totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'expense' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
        })
        .from(branchFinanceEntries)
        .where(baseConditions),
      db
        .select({
          totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'income' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
          totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'expense' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
        })
        .from(branchFinanceEntries)
        .where(todayConditions),
      db
        .select({
          totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'income' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
          totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'expense' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
        })
        .from(branchFinanceEntries)
        .where(monthConditions),
      db
        .select({
          date: sql<string>`${branchFinanceEntries.entryDate}`.as("date"),
          income: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'income' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
          expense: sql<string>`COALESCE(SUM(CASE WHEN ${branchFinanceEntries.type} = 'expense' THEN ${branchFinanceEntries.amount} ELSE 0 END), 0)`,
        })
        .from(branchFinanceEntries)
        .where(baseConditions)
        .groupBy(branchFinanceEntries.entryDate)
        .orderBy(asc(branchFinanceEntries.entryDate)),
      db
        .select({
          category: sql<string>`COALESCE(NULLIF(${branchFinanceEntries.category}, ''), 'otro')`.as("category"),
          total: sql<string>`COALESCE(SUM(${branchFinanceEntries.amount}), 0)`,
        })
        .from(branchFinanceEntries)
        .where(and(baseConditions, eq(branchFinanceEntries.type, "income"))!)
        .groupBy(sql`COALESCE(NULLIF(${branchFinanceEntries.category}, ''), 'otro')`)
        .orderBy(desc(sql`COALESCE(SUM(${branchFinanceEntries.amount}), 0)`))
        .limit(5),
      db
        .select({
          category: sql<string>`COALESCE(NULLIF(${branchFinanceEntries.category}, ''), 'otro')`.as("category"),
          total: sql<string>`COALESCE(SUM(${branchFinanceEntries.amount}), 0)`,
        })
        .from(branchFinanceEntries)
        .where(and(baseConditions, eq(branchFinanceEntries.type, "expense"))!)
        .groupBy(sql`COALESCE(NULLIF(${branchFinanceEntries.category}, ''), 'otro')`)
        .orderBy(desc(sql`COALESCE(SUM(${branchFinanceEntries.amount}), 0)`))
        .limit(5),
    ]);

    const totalIncome = toFinanceAmount(summaryRows[0]?.totalIncome);
    const totalExpense = toFinanceAmount(summaryRows[0]?.totalExpense);
    const todayIncome = toFinanceAmount(todayRows[0]?.totalIncome);
    const todayExpense = toFinanceAmount(todayRows[0]?.totalExpense);
    const monthIncome = toFinanceAmount(monthRows[0]?.totalIncome);
    const monthExpense = toFinanceAmount(monthRows[0]?.totalExpense);

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      todayIncome,
      todayExpense,
      monthIncome,
      monthExpense,
      dailyBreakdown: dailyRows.map((row) => {
        const income = toFinanceAmount(row.income);
        const expense = toFinanceAmount(row.expense);
        return {
          date: row.date,
          income,
          expense,
          net: income - expense,
        };
      }),
      topIncomeCategories: topIncomeRows.map((row) => ({
        category: row.category || "otro",
        total: toFinanceAmount(row.total),
      })),
      topExpenseCategories: topExpenseRows.map((row) => ({
        category: row.category || "otro",
        total: toFinanceAmount(row.total),
      })),
    };
  }

  async getBranchFinanceEntries(branchId: string, filters?: {
    from?: string;
    to?: string;
    type?: string;
    category?: string;
    clientId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<BranchFinanceEntriesResult> {
    const page = Math.max(filters?.page || 1, 1);
    const limit = Math.min(Math.max(filters?.limit || 50, 1), 200);
    const offset = (page - 1) * limit;
    const conditions: any[] = [
      eq(branchFinanceEntries.branchId, branchId),
      isNull(branchFinanceEntries.deletedAt),
    ];

    if (filters?.from) {
      conditions.push(gte(branchFinanceEntries.entryDate, filters.from));
    }
    if (filters?.to) {
      conditions.push(lte(branchFinanceEntries.entryDate, filters.to));
    }
    if (filters?.type) {
      conditions.push(eq(branchFinanceEntries.type, filters.type));
    }
    if (filters?.category) {
      conditions.push(eq(branchFinanceEntries.category, filters.category));
    }
    if (filters?.clientId) {
      conditions.push(eq(branchFinanceEntries.clientUserId, filters.clientId));
    }

    const normalizedQuery = filters?.q ? normalizeSearchText(filters.q) : "";
    const linkedClientFullName = sql<string>`concat_ws(' ', ${users.name}, coalesce(${users.lastName}, ''))`;

    if (normalizedQuery) {
      const likeQuery = `%${normalizedQuery}%`;
      conditions.push(or(
        sql`${normalizedSearchSqlSafe(branchFinanceEntries.concept)} LIKE ${likeQuery}`,
        sql`${normalizedSearchSqlSafe(branchFinanceEntries.category)} LIKE ${likeQuery}`,
        sql`${normalizedSearchSqlSafe(branchFinanceEntries.clientName)} LIKE ${likeQuery}`,
        sql`${normalizedSearchSqlSafe(branchFinanceEntries.notes)} LIKE ${likeQuery}`,
        sql`${normalizedSearchSqlSafe(linkedClientFullName)} LIKE ${likeQuery}`,
        sql`${normalizedSearchSqlSafe(users.email)} LIKE ${likeQuery}`,
      )!);
    }

    const whereClause = and(...conditions)!;

    const [countRows, rows] = await Promise.all([
      db
        .select({
          total: sql<number>`COUNT(*)::int`,
        })
        .from(branchFinanceEntries)
        .leftJoin(users, eq(branchFinanceEntries.clientUserId, users.id))
        .where(whereClause),
      db
        .select({
          id: branchFinanceEntries.id,
          branchId: branchFinanceEntries.branchId,
          type: branchFinanceEntries.type,
          category: branchFinanceEntries.category,
          concept: branchFinanceEntries.concept,
          amount: branchFinanceEntries.amount,
          paymentMethod: branchFinanceEntries.paymentMethod,
          clientUserId: branchFinanceEntries.clientUserId,
          clientName: branchFinanceEntries.clientName,
          notes: branchFinanceEntries.notes,
          entryDate: branchFinanceEntries.entryDate,
          source: branchFinanceEntries.source,
          sourceId: branchFinanceEntries.sourceId,
          metadata: branchFinanceEntries.metadata,
          createdBy: branchFinanceEntries.createdBy,
          createdAt: branchFinanceEntries.createdAt,
          updatedAt: branchFinanceEntries.updatedAt,
          linkedClientName: users.name,
          linkedClientLastName: users.lastName,
          linkedClientEmail: users.email,
        })
        .from(branchFinanceEntries)
        .leftJoin(users, eq(branchFinanceEntries.clientUserId, users.id))
        .where(whereClause)
        .orderBy(desc(branchFinanceEntries.entryDate), desc(branchFinanceEntries.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countRows[0]?.total) || 0;
    return {
      items: rows.map((row) => this.mapBranchFinanceEntryRow(row)),
      total,
      page,
      limit,
      pageCount: total > 0 ? Math.ceil(total / limit) : 1,
    };
  }

  async listBranchFinanceEntriesForExport(branchId: string, filters?: {
    from?: string;
    to?: string;
    type?: string;
  }): Promise<BranchFinanceEntryRow[]> {
    const conditions: any[] = [
      eq(branchFinanceEntries.branchId, branchId),
      isNull(branchFinanceEntries.deletedAt),
    ];

    if (filters?.from) {
      conditions.push(gte(branchFinanceEntries.entryDate, filters.from));
    }
    if (filters?.to) {
      conditions.push(lte(branchFinanceEntries.entryDate, filters.to));
    }
    if (filters?.type) {
      conditions.push(eq(branchFinanceEntries.type, filters.type));
    }

    const rows = await db
      .select({
        id: branchFinanceEntries.id,
        branchId: branchFinanceEntries.branchId,
        type: branchFinanceEntries.type,
        category: branchFinanceEntries.category,
        concept: branchFinanceEntries.concept,
        amount: branchFinanceEntries.amount,
        paymentMethod: branchFinanceEntries.paymentMethod,
        clientUserId: branchFinanceEntries.clientUserId,
        clientName: branchFinanceEntries.clientName,
        notes: branchFinanceEntries.notes,
        entryDate: branchFinanceEntries.entryDate,
        source: branchFinanceEntries.source,
        sourceId: branchFinanceEntries.sourceId,
        metadata: branchFinanceEntries.metadata,
        createdBy: branchFinanceEntries.createdBy,
        createdAt: branchFinanceEntries.createdAt,
        updatedAt: branchFinanceEntries.updatedAt,
        linkedClientName: users.name,
        linkedClientLastName: users.lastName,
        linkedClientEmail: users.email,
      })
      .from(branchFinanceEntries)
      .leftJoin(users, eq(branchFinanceEntries.clientUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(branchFinanceEntries.entryDate), desc(branchFinanceEntries.createdAt));

    return rows.map((row) => this.mapBranchFinanceEntryRow(row));
  }

  async getBranchFinanceEntry(branchId: string, entryId: string): Promise<BranchFinanceEntryRow | undefined> {
    return this.getBranchFinanceEntryById(branchId, entryId);
  }

  async createBranchFinanceEntry(data: InsertBranchFinanceEntry): Promise<BranchFinanceEntryRow> {
    try {
      const [created] = await db
        .insert(branchFinanceEntries)
        .values({
          ...data,
          amount: String(data.amount),
        })
        .returning({
          id: branchFinanceEntries.id,
          branchId: branchFinanceEntries.branchId,
        });

      return (await this.getBranchFinanceEntryById(created.branchId, created.id))!;
    } catch (error: any) {
      if (isPgUniqueViolation(error) && data.source && data.sourceId) {
        const existing = await this.getBranchFinanceEntryBySource(data.branchId, data.source, data.sourceId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async findBranchFinanceEntryBySource(
    branchId: string,
    source: string,
    sourceId: string,
  ): Promise<BranchFinanceEntryRow | undefined> {
    return this.getBranchFinanceEntryBySource(branchId, source, sourceId);
  }

  async updateBranchFinanceEntry(branchId: string, entryId: string, data: Partial<InsertBranchFinanceEntry>): Promise<BranchFinanceEntryRow | undefined> {
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.type !== undefined) updateData.type = data.type;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.concept !== undefined) updateData.concept = data.concept;
    if (data.amount !== undefined) {
      updateData.amount = String(data.amount);
    }
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.clientUserId !== undefined) updateData.clientUserId = data.clientUserId;
    if (data.clientName !== undefined) updateData.clientName = data.clientName;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.entryDate !== undefined) updateData.entryDate = data.entryDate;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.sourceId !== undefined) updateData.sourceId = data.sourceId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.createdBy !== undefined) updateData.createdBy = data.createdBy;

    const [updated] = await db
      .update(branchFinanceEntries)
      .set(updateData)
      .where(and(
        eq(branchFinanceEntries.id, entryId),
        eq(branchFinanceEntries.branchId, branchId),
        isNull(branchFinanceEntries.deletedAt),
      ))
      .returning({
        id: branchFinanceEntries.id,
      });

    if (!updated) return undefined;
    return this.getBranchFinanceEntryById(branchId, updated.id);
  }

  async softDeleteBranchFinanceEntry(branchId: string, entryId: string): Promise<boolean> {
    const [deleted] = await db
      .update(branchFinanceEntries)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(branchFinanceEntries.id, entryId),
        eq(branchFinanceEntries.branchId, branchId),
        isNull(branchFinanceEntries.deletedAt),
      ))
      .returning({
        id: branchFinanceEntries.id,
      });

    return !!deleted;
  }

  async getBranchRecurringExpenses(branchId: string): Promise<BranchRecurringExpenseRow[]> {
    const rows = await db
      .select()
      .from(branchRecurringExpenses)
      .where(and(
        eq(branchRecurringExpenses.branchId, branchId),
        isNull(branchRecurringExpenses.deletedAt),
      ))
      .orderBy(asc(branchRecurringExpenses.isActive), asc(branchRecurringExpenses.name));

    return rows
      .map((row) => this.mapBranchRecurringExpenseRow(row))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "es-MX"));
  }

  async createBranchRecurringExpense(data: InsertBranchRecurringExpense): Promise<BranchRecurringExpenseRow> {
    const [created] = await db
      .insert(branchRecurringExpenses)
      .values({
        ...data,
        amount: String(data.amount),
      })
      .returning();

    return this.mapBranchRecurringExpenseRow(created);
  }

  async updateBranchRecurringExpense(
    branchId: string,
    recurringExpenseId: string,
    data: Partial<InsertBranchRecurringExpense>,
  ): Promise<BranchRecurringExpenseRow | undefined> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.amount !== undefined) updateData.amount = String(data.amount);
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.paymentDay !== undefined) updateData.paymentDay = data.paymentDay;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.createdBy !== undefined) updateData.createdBy = data.createdBy;

    const [updated] = await db
      .update(branchRecurringExpenses)
      .set(updateData)
      .where(and(
        eq(branchRecurringExpenses.id, recurringExpenseId),
        eq(branchRecurringExpenses.branchId, branchId),
        isNull(branchRecurringExpenses.deletedAt),
      ))
      .returning();

    return updated ? this.mapBranchRecurringExpenseRow(updated) : undefined;
  }

  async softDeleteBranchRecurringExpense(branchId: string, recurringExpenseId: string): Promise<boolean> {
    const [updated] = await db
      .update(branchRecurringExpenses)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        isActive: false,
      })
      .where(and(
        eq(branchRecurringExpenses.id, recurringExpenseId),
        eq(branchRecurringExpenses.branchId, branchId),
        isNull(branchRecurringExpenses.deletedAt),
      ))
      .returning({ id: branchRecurringExpenses.id });

    return !!updated;
  }

  async registerBranchRecurringExpenseInFinance(
    branchId: string,
    recurringExpenseId: string,
    data: { entryDate: string; paymentMethod?: string | null; notes?: string | null; createdBy?: string | null },
  ): Promise<BranchFinanceEntryRow | undefined> {
    const [expense] = await db
      .select()
      .from(branchRecurringExpenses)
      .where(and(
        eq(branchRecurringExpenses.id, recurringExpenseId),
        eq(branchRecurringExpenses.branchId, branchId),
        isNull(branchRecurringExpenses.deletedAt),
      ))
      .limit(1);

    if (!expense) return undefined;

    const sourceId = `${expense.id}:${data.entryDate}`;
    const existing = await this.getBranchFinanceEntryBySource(branchId, "fixed_expense", sourceId);
    if (existing) {
      return existing;
    }

    const financeEntry = await this.createBranchFinanceEntry({
      branchId,
      type: "expense",
      category: mapRecurringCategoryToFinanceCategory(expense.category),
      concept: expense.name,
      amount: toFinanceAmount(expense.amount),
      paymentMethod: data.paymentMethod ?? null,
      clientUserId: null,
      clientName: null,
      notes: data.notes ?? expense.notes ?? null,
      entryDate: data.entryDate,
      source: "fixed_expense",
      sourceId,
      metadata: {
        recurringExpenseId: expense.id,
        frequency: expense.frequency,
        paymentDay: expense.paymentDay ?? null,
      },
      createdBy: data.createdBy ?? null,
    } as any);

    await db
      .update(branchRecurringExpenses)
      .set({
        lastRegisteredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(branchRecurringExpenses.id, expense.id));

    return financeEntry;
  }

  async getBranchStaffMembers(branchId: string): Promise<BranchStaffMemberRow[]> {
    const rows = await db
      .select()
      .from(branchStaffMembers)
      .where(and(
        eq(branchStaffMembers.branchId, branchId),
        isNull(branchStaffMembers.deletedAt),
      ))
      .orderBy(asc(branchStaffMembers.name));

    return rows
      .map((row) => this.mapBranchStaffMemberRow(row))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "es-MX"));
  }

  async createBranchStaffMember(data: InsertBranchStaffMember): Promise<BranchStaffMemberRow> {
    const [created] = await db
      .insert(branchStaffMembers)
      .values({
        ...data,
        payPerClass: String(data.payPerClass),
      })
      .returning();

    return this.mapBranchStaffMemberRow(created);
  }

  async updateBranchStaffMember(
    branchId: string,
    staffId: string,
    data: Partial<InsertBranchStaffMember>,
  ): Promise<BranchStaffMemberRow | undefined> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.payPerClass !== undefined) updateData.payPerClass = String(data.payPerClass);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.createdBy !== undefined) updateData.createdBy = data.createdBy;

    const [updated] = await db
      .update(branchStaffMembers)
      .set(updateData)
      .where(and(
        eq(branchStaffMembers.id, staffId),
        eq(branchStaffMembers.branchId, branchId),
        isNull(branchStaffMembers.deletedAt),
      ))
      .returning();

    return updated ? this.mapBranchStaffMemberRow(updated) : undefined;
  }

  async softDeleteBranchStaffMember(branchId: string, staffId: string): Promise<boolean> {
    const [updated] = await db
      .update(branchStaffMembers)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        isActive: false,
      })
      .where(and(
        eq(branchStaffMembers.id, staffId),
        eq(branchStaffMembers.branchId, branchId),
        isNull(branchStaffMembers.deletedAt),
      ))
      .returning({ id: branchStaffMembers.id });

    return !!updated;
  }

  async getBranchStaffClassLogs(
    branchId: string,
    filters?: { from?: string; to?: string; staffId?: string; limit?: number },
  ): Promise<BranchStaffClassLogRow[]> {
    const conditions: any[] = [eq(branchStaffClassLogs.branchId, branchId)];
    if (filters?.staffId) conditions.push(eq(branchStaffClassLogs.staffId, filters.staffId));
    if (filters?.from) conditions.push(gte(branchStaffClassLogs.classDate, filters.from));
    if (filters?.to) conditions.push(lte(branchStaffClassLogs.classDate, filters.to));

    const rows = await db
      .select({
        id: branchStaffClassLogs.id,
        branchId: branchStaffClassLogs.branchId,
        staffId: branchStaffClassLogs.staffId,
        staffName: branchStaffMembers.name,
        classesCount: branchStaffClassLogs.classesCount,
        paymentTotal: branchStaffClassLogs.paymentTotal,
        classDate: branchStaffClassLogs.classDate,
        notes: branchStaffClassLogs.notes,
        financeEntryId: branchStaffClassLogs.financeEntryId,
        paymentMethod: branchFinanceEntries.paymentMethod,
        createdBy: branchStaffClassLogs.createdBy,
        createdAt: branchStaffClassLogs.createdAt,
        updatedAt: branchStaffClassLogs.updatedAt,
      })
      .from(branchStaffClassLogs)
      .innerJoin(branchStaffMembers, eq(branchStaffClassLogs.staffId, branchStaffMembers.id))
      .leftJoin(branchFinanceEntries, eq(branchStaffClassLogs.financeEntryId, branchFinanceEntries.id))
      .where(and(...conditions))
      .orderBy(desc(branchStaffClassLogs.classDate), desc(branchStaffClassLogs.createdAt))
      .limit(Math.min(filters?.limit || 20, 200));

    return rows.map((row) => ({
      id: row.id,
      branchId: row.branchId,
      staffId: row.staffId,
      staffName: row.staffName,
      classesCount: row.classesCount,
      paymentTotal: toFinanceAmount(row.paymentTotal),
      classDate: row.classDate,
      notes: row.notes ?? null,
      financeEntryId: row.financeEntryId ?? null,
      paymentMethod: row.paymentMethod ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createBranchStaffClassLogAndFinanceEntry(data: {
    branchId: string;
    staffId: string;
    classesCount: number;
    classDate: string;
    paymentMethod?: string | null;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BranchStaffClassLogRow> {
    const [staff] = await db
      .select()
      .from(branchStaffMembers)
      .where(and(
        eq(branchStaffMembers.id, data.staffId),
        eq(branchStaffMembers.branchId, data.branchId),
        isNull(branchStaffMembers.deletedAt),
      ))
      .limit(1);

    if (!staff) {
      throw new Error("PROFESSOR_NOT_FOUND");
    }

    const payPerClass = toFinanceAmount(staff.payPerClass);
    const paymentTotal = Number((payPerClass * data.classesCount).toFixed(2));

    const financeEntry = await this.createBranchFinanceEntry({
      branchId: data.branchId,
      type: "expense",
      category: "profesor",
      concept: `${staff.name} · ${data.classesCount} clase${data.classesCount === 1 ? "" : "s"}`,
      amount: paymentTotal,
      paymentMethod: data.paymentMethod ?? null,
      clientUserId: null,
      clientName: null,
      notes: data.notes ?? null,
      entryDate: data.classDate,
      source: "staff_class_log",
      sourceId: null,
      metadata: {
        staffId: staff.id,
        staffName: staff.name,
        payPerClass,
        classesCount: data.classesCount,
      },
      createdBy: data.createdBy ?? null,
    } as any);

    const [created] = await db
      .insert(branchStaffClassLogs)
      .values({
        branchId: data.branchId,
        staffId: staff.id,
        classesCount: data.classesCount,
        paymentTotal: String(paymentTotal),
        classDate: data.classDate,
        notes: data.notes ?? null,
        financeEntryId: financeEntry.id,
        createdBy: data.createdBy ?? null,
      })
      .returning({ id: branchStaffClassLogs.id });

    await db
      .update(branchFinanceEntries)
      .set({
        sourceId: created.id,
        updatedAt: new Date(),
      })
      .where(eq(branchFinanceEntries.id, financeEntry.id));

    return (await this.getBranchStaffClassLogById(data.branchId, created.id))!;
  }

  async createMembershipFinanceEntry(data: {
    branchId: string;
    membershipId: string;
    userId: string;
    planId: string;
    planName: string;
    amount: number;
    paidAt: Date | string | null | undefined;
    expiresAt?: Date | string | null;
    paymentMethod?: string | null;
    createdBy?: string | null;
    eventType: "assign" | "renew";
  }): Promise<BranchFinanceEntryRow | null> {
    const eventKey = getMembershipFinanceEventKey({
      eventType: data.eventType,
      membershipId: data.membershipId,
      planId: data.planId,
      expiresAt: data.expiresAt,
      paidAt: data.paidAt,
    });

    const existing = await this.getBranchFinanceEntryBySource(data.branchId, `membership_${data.eventType}`, eventKey);
    if (existing) {
      return existing;
    }

    const [user] = await db
      .select({
        name: users.name,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    const clientDisplayName = [user?.name, user?.lastName].filter(Boolean).join(" ").trim() || "Cliente";
    const paidAtDate =
      typeof data.paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.paidAt)
        ? data.paidAt
        : data.paidAt
          ? formatDateOnly(new Date(data.paidAt))
          : getMxLocalDate();

    return this.createBranchFinanceEntry({
      branchId: data.branchId,
      type: "income",
      category: "membresia",
      concept: data.planName,
      amount: data.amount,
      paymentMethod: data.paymentMethod ?? null,
      clientUserId: data.userId,
      clientName: null,
      notes: data.eventType === "renew" ? "Ingreso automático por renovación de membresía" : "Ingreso automático por asignación de membresía",
      entryDate: paidAtDate,
      source: `membership_${data.eventType}`,
      sourceId: eventKey,
      metadata: {
        membershipId: data.membershipId,
        planId: data.planId,
        planName: data.planName,
        eventType: data.eventType,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
        clientDisplayName,
      },
      createdBy: data.createdBy ?? null,
    } as any);
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

    await db.transaction(async (tx) => {
      const reviewRows = await tx
        .select({ id: branchReviews.id })
        .from(branchReviews)
        .where(eq(branchReviews.userId, userId));

      const reviewIds = reviewRows.map((row) => row.id);

      if (reviewIds.length > 0) {
        await tx.delete(reviewModerationLogs).where(inArray(reviewModerationLogs.reviewId, reviewIds));
        await tx.delete(reviewReports).where(inArray(reviewReports.reviewId, reviewIds));
      }

      await tx.delete(reviewReports).where(or(
        eq(reviewReports.reporterUserId, userId),
        eq(reviewReports.reviewedByUserId, userId),
      )!);
      await tx.delete(reviewModerationLogs).where(eq(reviewModerationLogs.actorUserId, userId));
      await tx.delete(notificationJobs).where(eq(notificationJobs.userId, userId));
      await tx.delete(searchLogs).where(eq(searchLogs.userId, userId));
      await tx.delete(auditLogs).where(eq(auditLogs.actorUserId, userId));
      await tx.delete(systemEvents).where(eq(systemEvents.userId, userId));
      await tx.delete(notifications).where(eq(notifications.recipientUserId, userId));
      await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
      await tx.delete(branchReviews).where(eq(branchReviews.userId, userId));
      await tx.delete(customerReports).where(or(
        eq(customerReports.userId, userId),
        eq(customerReports.reportedByUserId, userId),
        eq(customerReports.reviewedByUserId, userId),
      )!);
      await tx.delete(branchCustomerBlocks).where(or(
        eq(branchCustomerBlocks.userId, userId),
        eq(branchCustomerBlocks.blockedByUserId, userId),
      )!);
      await tx.delete(branchClientCrm).where(eq(branchClientCrm.userId, userId));
      await tx.delete(clientNotes).where(or(
        eq(clientNotes.userId, userId),
        eq(clientNotes.createdBy, userId),
      )!);
      await tx.delete(memberships).where(eq(memberships.userId, userId));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });

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
