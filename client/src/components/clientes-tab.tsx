import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Plus,
  Link2,
  Search,
  ClipboardCheck,
  StickyNote,
  Mail,
  Phone,
  Calendar,
  Copy,
  Check,
  Loader2,
  Package,
  Hash,
  XCircle,
  Download,
  FileText,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Heart,
  Shield,
  Camera,
  ImageOff,
  MessageCircle,
  DollarSign,
  KeyRound,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateBranchClientQueries, invalidateBranchMembershipQueries } from "@/lib/branch-dashboard-cache";
import { downloadAuthenticatedFile } from "@/lib/download-file";
import { useStableOperationKey } from "@/lib/stable-operation-key";
import { useToast } from "@/hooks/use-toast";
import {
  computeMembershipPlanChargeSnapshot,
  type MembershipPlanTaxMode,
} from "@shared/membership-plan-tax";

type ClientIdentityControl = {
  originType: "manual" | "counter" | "app";
  canEditIdentity: boolean;
  reason: string;
};

type ResolvedClientIdentityControl = ClientIdentityControl | {
  originType: "unknown";
  canEditIdentity: true;
  reason: string;
};

interface BranchClient {
  userId: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  membershipId: string;
  membershipStatus: string;
  joinedAt: string;
  lastSeenAt: string | null;
  source: string;
  isFavorite: boolean;
  lastAttendance: string | null;
  planId: string | null;
  planNameSnapshot: string | null;
  planName: string | null;
  planStatus: "active" | "expired" | "deleted" | null;
  cycleMonths: number | null;
  classesRemaining: number | null;
  classesTotal: number | null;
  expiresAt: string | null;
  paidAt: string | null;
  avatarUrl: string | null;
  clientStatus: string;
  hasDebt: boolean;
  debtAmount: number;
  crmClientStatus: string;
  crmManualStatus: string | null;
  lastVisit: string | null;
  tags: string | null;
  isLocallyBlocked: boolean;
  localBlockedAt: string | null;
  localBlockReason: string | null;
  reportCount: number;
  individualPurchaseCount: number;
  lastIndividualPurchaseAt: string | null;
  identityControl: ClientIdentityControl | null;
}

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  taxMode: MembershipPlanTaxMode | null;
  taxRate: string | null;
  durationDays: number | null;
  classLimit: number | null;
  cycleMonths: number;
  leaseEnabled: boolean;
  defaultLeaseTermMonths: number | null;
  defaultLeasedItemDescription: string | null;
  isActive: boolean;
}

interface ClientProfile {
  user: {
    id: string;
    name: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    gender: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    medicalNotes: string | null;
    injuriesNotes: string | null;
    medicalWarnings: string | null;
    parqAccepted: boolean;
    parqAcceptedDate: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  membership: {
    id: string;
    status: string;
    clientStatus: string;
    hasDebt: boolean;
    debtAmount: number;
    joinedAt: string;
    lastSeenAt: string | null;
    source: string;
    planId: string | null;
    classesRemaining: number | null;
    classesTotal: number | null;
    expiresAt: string | null;
    paidAt: string | null;
    planName: string | null;
  };
  planStatus: "active" | "expired" | "deleted" | null;
  planNameSnapshot: string | null;
  plan: {
    id: string;
    name: string;
    price: number;
    taxMode: MembershipPlanTaxMode | null;
    taxRate: string | null;
    durationDays: number | null;
    classLimit: number | null;
    cycleMonths: number;
    leaseEnabled: boolean;
    defaultLeaseTermMonths: number | null;
    defaultLeasedItemDescription: string | null;
  } | null;
  planChargeSnapshot: {
    chargeEventId: string;
    eventType: "assign" | "renew";
    chargedAt: string;
    planNameSnapshot: string;
    basePriceCents: number;
    taxMode: MembershipPlanTaxMode | null;
    taxRate: number | null;
    subtotalBeforeTaxCents: number | null;
    taxableSubtotalCents: number | null;
    taxTotalCents: number | null;
    finalTotalCents: number;
  } | null;
  leaseContracts: {
    id: string;
    planId: string | null;
    contractStartDate: string;
    contractEndDate: string;
    contractTermMonths: number;
    preWebcoolPaidInstallments: number;
    webcoolPaidInstallments: number;
    totalPaidInstallments: number;
    pendingInstallments: number;
    elapsedCalendarMonths: number;
    remainingCalendarMonths: number;
    paymentProgressPercent: number;
    derivedStatus: "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED";
    isOpenForLifecycleGuards: boolean;
    leasedItemDescription: string;
    notes: string | null;
    capturedPriceCents: number;
    taxModeSnapshot: MembershipPlanTaxMode | null;
    taxRateSnapshot: number | null;
    monthlySubtotalBeforeTaxCents: number | null;
    monthlyTaxableSubtotalCents: number | null;
    monthlyTaxTotalCents: number | null;
    monthlyFinalTotalCents: number;
    currencyCode: string;
    operationalCoverageStartDate: string | null;
    operationalCoverageEndDate: string | null;
    hasOperationalCoverage: boolean;
    operationalCoverageCurrent: boolean;
    completedAt: string | null;
    cancelledAt: string | null;
  }[];
  openLeaseContracts: {
    id: string;
    planId: string | null;
    contractStartDate: string;
    contractEndDate: string;
    contractTermMonths: number;
    preWebcoolPaidInstallments: number;
    webcoolPaidInstallments: number;
    totalPaidInstallments: number;
    pendingInstallments: number;
    elapsedCalendarMonths: number;
    remainingCalendarMonths: number;
    paymentProgressPercent: number;
    derivedStatus: "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED";
    isOpenForLifecycleGuards: boolean;
    leasedItemDescription: string;
    notes: string | null;
    capturedPriceCents: number;
    taxModeSnapshot: MembershipPlanTaxMode | null;
    taxRateSnapshot: number | null;
    monthlySubtotalBeforeTaxCents: number | null;
    monthlyTaxableSubtotalCents: number | null;
    monthlyTaxTotalCents: number | null;
    monthlyFinalTotalCents: number;
    currencyCode: string;
    operationalCoverageStartDate: string | null;
    operationalCoverageEndDate: string | null;
    hasOperationalCoverage: boolean;
    operationalCoverageCurrent: boolean;
    completedAt: string | null;
    cancelledAt: string | null;
  }[];
  activeLeaseContractsCount: number;
  notes: { id: string; content: string; createdAt: string; createdByName: string }[];
  recentAttendances: { id: string; checkedInAt: string }[];
  purchaseHistory: {
    id: string;
    concept: string;
    amount: number;
    entryDate: string;
    paymentMethod: string | null;
    notes: string | null;
    source: string | null;
    metadata: any;
    createdAt: string;
  }[];
  totalAttendances: number;
  nextBooking: { bookingDate: string; className: string; startTime: string } | null;
  crm: {
    clientStatus: string;
    manualStatus: string | null;
    lastVisit: string | null;
    tags: string | null;
  };
  moderation: {
    localBlock: {
      id: string;
      reason: string | null;
      note: string | null;
      createdAt: string;
    } | null;
    reports: {
      id: string;
      reason: string;
      note: string | null;
      status: string;
      createdAt: string;
      reviewedAt: string | null;
      reporterName: string | null;
      reviewerName: string | null;
      branchName: string | null;
    }[];
  };
  identityControl: ClientIdentityControl | null;
  accessStatus: "NO_ACCESS" | "LOCAL_ACCESS" | "EXTERNAL_PROVIDER" | "DISABLED" | "LEGACY_UNVERIFIED";
  accessProvider: "email" | "google" | "apple" | null;
  canBranchManageAccess: boolean;
  canCreateLocalAccess: boolean;
  canVerifyLegacyLocalAccess: boolean;
  canResetLocalPassword: boolean;
  canResetLocalPasswordReason: string | null;
  accessEmail: string | null;
  accessReason: string | null;
}

type ClientAccessCredentialResult = {
  email: string;
  temporaryPassword: string;
  sessionsInvalidated: number;
  mustChangePasswordOnLogin: boolean;
  message?: string;
  accessStatus?: "LOCAL_ACCESS";
};

type ClientCommercialHistoryFilter = "all" | "products" | "services" | "current_month";

interface ClientCommercialHistoryItem {
  saleId: string;
  folio: string;
  saleDate: string;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  sellerId: string | null;
  sellerName: string | null;
  channel: string;
  notes: string | null;
  items: Array<{
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
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    saleId: string;
    branchId: string;
    paymentMethod: string;
    amount: number;
    reference: string | null;
    paidAt: string;
    createdBy: string | null;
    createdAt: string;
  }>;
}

interface ClientCommercialHistoryResponse {
  summary: {
    totalSpentAmount: number;
    salesCount: number;
    averageTicketAmount: number;
    lastPurchaseAt: string | null;
    currentMonthAmount: number;
  };
  items: ClientCommercialHistoryItem[];
  total: number;
  page: number;
  limit: number;
  filter: ClientCommercialHistoryFilter;
}

interface AlertsData {
  expiringMemberships: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    membershipId: string;
    planName: string | null;
    expiresAt: string;
    classesRemaining: number | null;
    classesTotal: number | null;
  }>;
  expiredMemberships: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    membershipId: string;
    planName: string | null;
    expiresAt: string;
    classesRemaining: number | null;
    paidAt: string | null;
  }>;
  inactiveClients: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    membershipId: string;
    joinedAt: string;
    lastSeenAt: string | null;
    planName: string | null;
    lastAttendance: string | null;
  }>;
  clientsWithoutClasses: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    membershipId: string;
    planName: string | null;
    classesRemaining: number | null;
    classesTotal: number | null;
    expiresAt: string | null;
  }>;
  upcomingBirthdays: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    phone: string | null;
    birthDate: string;
    membershipId: string;
  }>;
}

type ClientFilterKey = "with_plan" | "without_plan" | "individual_purchases" | "app_joined" | "expiring" | "expired" | "all";

type ClientFocusRequest = {
  userId: string;
  nonce: number;
};

type LeaseContractNavigationTarget = {
  leaseContractId: string;
  clientUserId?: string | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const stableDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? parseIsoDateToStableDate(dateStr)
      : new Date(dateStr);
  if (!stableDate || Number.isNaN(stableDate.getTime())) return "—";
  return stableDate.toLocaleDateString("es-MX", {
    timeZone: MEXICO_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} meses`;
}

function isBirthdayToday(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const today = new Date();
  const [, monthStr, dayStr] = birthDate.split("-");
  return parseInt(monthStr) === today.getMonth() + 1 && parseInt(dayStr) === today.getDate();
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function genderLabel(g: string | null): string {
  if (g === "M") return "Masculino";
  if (g === "F") return "Femenino";
  if (g === "NE") return "No especifica";
  return "";
}

function displayName(name: string, lastName: string | null): string {
  return lastName ? `${name} ${lastName}` : name;
}

function isCrmPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith("@crm.webcool.local");
}

function displayClientEmail(email: string | null | undefined): string {
  if (!email) return "Sin correo registrado";
  return isCrmPlaceholderEmail(email) ? "Sin correo registrado" : email;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
    return parsed?.message || fallback;
  } catch {
    return error.message || fallback;
  }
}

function normalizeOptionalTextInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalEmailInput(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function formatCurrencyMx(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function formatTaxRateLabel(taxRate: number | null) {
  if (taxRate == null || taxRate <= 0) return "0%";
  return `${taxRate.toFixed(2).replace(/\.00$/, "")}%`;
}

function getMembershipPlanChargeSnapshot(plan: Pick<MembershipPlan, "price" | "taxMode" | "taxRate">) {
  try {
    return computeMembershipPlanChargeSnapshot({
      priceCents: plan.price,
      taxMode: plan.taxMode,
      taxRate: plan.taxRate,
    });
  } catch {
    return null;
  }
}

function getMembershipPlanChargeLabel(plan: Pick<MembershipPlan, "price" | "taxMode" | "taxRate">) {
  const snapshot = getMembershipPlanChargeSnapshot(plan);
  if (!snapshot || snapshot.isLegacy || !snapshot.taxMode) return null;

  if (snapshot.taxMode === "tax_added") {
    return `+ IVA ${formatTaxRateLabel(snapshot.taxRate)} · Total ${formatCurrencyMx(snapshot.finalTotalCents / 100)}`;
  }

  if (snapshot.taxMode === "tax_included") {
    return `IVA incluido ${formatTaxRateLabel(snapshot.taxRate)}`;
  }

  return "Sin IVA";
}

type ClientLeaseContractSummary = ClientProfile["leaseContracts"][number];

function getLeaseContractPriceDisplay(leaseContract: ClientLeaseContractSummary) {
  if (leaseContract.taxModeSnapshot === "tax_added") {
    return {
      title: "Total mensual",
      amountCents: leaseContract.monthlyFinalTotalCents,
      detailLines: [
        `Precio base ${formatCurrencyMx(leaseContract.capturedPriceCents / 100)}`,
        `IVA ${formatTaxRateLabel(leaseContract.taxRateSnapshot)} ${formatCurrencyMx((leaseContract.monthlyTaxTotalCents ?? 0) / 100)}`,
      ],
    };
  }

  if (leaseContract.taxModeSnapshot === "tax_included") {
    return {
      title: "Precio final",
      amountCents: leaseContract.monthlyFinalTotalCents,
      detailLines: [
        `IVA ${formatTaxRateLabel(leaseContract.taxRateSnapshot)} incluido ${formatCurrencyMx((leaseContract.monthlyTaxTotalCents ?? 0) / 100)}`,
      ],
    };
  }

  if (leaseContract.taxModeSnapshot === "tax_exempt") {
    return {
      title: "Precio",
      amountCents: leaseContract.monthlyFinalTotalCents,
      detailLines: ["Sin IVA"],
    };
  }

  return {
    title: "Precio",
    amountCents: leaseContract.monthlyFinalTotalCents,
    detailLines: [],
  };
}

function getClientPlanPriceDisplay(profile: Pick<ClientProfile, "plan" | "planChargeSnapshot">) {
  const snapshot = profile.planChargeSnapshot;

  if (snapshot) {
    if (snapshot.taxMode === "tax_added") {
      return {
        title: "Total con IVA",
        amountCents: snapshot.finalTotalCents,
        detailLines: [
          `Precio base ${formatCurrencyMx(snapshot.basePriceCents / 100)}`,
          `IVA ${formatTaxRateLabel(snapshot.taxRate)} ${formatCurrencyMx((snapshot.taxTotalCents ?? 0) / 100)}`,
        ],
      };
    }

    if (snapshot.taxMode === "tax_included") {
      return {
        title: "Precio final",
        amountCents: snapshot.finalTotalCents,
        detailLines: [
          `IVA ${formatTaxRateLabel(snapshot.taxRate)} incluido ${formatCurrencyMx((snapshot.taxTotalCents ?? 0) / 100)}`,
        ],
      };
    }

    if (snapshot.taxMode === "tax_exempt") {
      return {
        title: "Precio",
        amountCents: snapshot.finalTotalCents,
        detailLines: ["Sin IVA"],
      };
    }

    return {
      title: "Precio",
      amountCents: snapshot.finalTotalCents,
      detailLines: [],
    };
  }

  return {
    title: "Precio",
    amountCents: profile.plan?.price ?? 0,
    detailLines: [],
  };
}

function cycleLabel(cycleMonths: number | null | undefined): string {
  if (cycleMonths === 0) return "Servicio individual";
  if (!cycleMonths || cycleMonths === 1) return "Plan mensual";
  if (cycleMonths === 3) return "Plan trimestral";
  if (cycleMonths === 6) return "Plan semestral";
  if (cycleMonths === 12) return "Anualidad";
  return `${cycleMonths} meses`;
}

function leaseDerivedStatusLabel(status: ClientLeaseContractSummary["derivedStatus"]) {
  if (status === "COMPLETED") return "COMPLETADO";
  if (status === "EXPIRED") return "VENCIDO";
  if (status === "CANCELLED") return "CANCELADO";
  return "ACTIVO";
}

function leaseDerivedStatusBadgeVariant(status: ClientLeaseContractSummary["derivedStatus"]) {
  if (status === "EXPIRED" || status === "CANCELLED") return "destructive" as const;
  if (status === "COMPLETED") return "secondary" as const;
  return "default" as const;
}

function usageSummaryLabel(classLimit: number | null, cycleMonths: number | null | undefined): string {
  if (cycleMonths === 0) return "1 uso";
  if (classLimit === null || classLimit === undefined) return "Uso ilimitado";
  return `${classLimit} usos`;
}

function clientStatusLabel(s: string): string {
  if (s === "active") return "Activo";
  if (s === "inactive") return "Inactivo";
  if (s === "frozen") return "Congelado";
  return s;
}

function clientStatusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "inactive") return "secondary";
  if (s === "frozen") return "outline";
  return "secondary";
}

function crmStatusLabel(status: string): string {
  if (status === "nuevo") return "Nuevo";
  if (status === "activo") return "Activo";
  if (status === "inactivo") return "Inactivo";
  if (status === "vip") return "VIP";
  return status;
}

function crmStatusBadgeClass(status: string): string {
  if (status === "activo") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "inactivo") return "border-red-200 bg-red-50 text-red-700";
  if (status === "vip") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const REPORT_REASON_OPTIONS = [
  { value: "comentario_ofensivo", label: "Comentario ofensivo" },
  { value: "mal_comportamiento", label: "Mal comportamiento" },
  { value: "no_respeto_reglas", label: "No respeto reglas" },
  { value: "spam", label: "Spam" },
  { value: "otro", label: "Otro" },
] as const;

const FINANCE_PAYMENT_METHOD_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "otro", label: "Otro" },
] as const;

const MEXICO_TIME_ZONE = "America/Mexico_City";

function getMxTodayIsoDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: MEXICO_TIME_ZONE });
}

function parseIsoDateToStableDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function addCalendarMonthsStable(date: Date, months: number): Date {
  if (months === 0) {
    return new Date(date.getTime());
  }
  const result = new Date(date.getTime());
  const dayOfMonth = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() !== dayOfMonth) {
    result.setUTCDate(0);
  }
  return result;
}

function calculatePlanExpirationPreview(
  plan: Pick<MembershipPlan, "cycleMonths" | "durationDays"> | null | undefined,
  startDate: string,
): Date | null {
  if (!plan) return null;
  const parsed = parseIsoDateToStableDate(startDate);
  if (!parsed) return null;

  if ((plan.cycleMonths ?? 1) === 0) {
    const result = new Date(parsed.getTime());
    result.setUTCDate(result.getUTCDate() + Math.max(plan.durationDays ?? 1, 1));
    return result;
  }

  return addCalendarMonthsStable(parsed, plan.cycleMonths ?? 1);
}

function formatCalendarPreview(date: Date | null) {
  if (!date) return "Sin fecha de vencimiento";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: MEXICO_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function reportReasonLabel(reason: string): string {
  return REPORT_REASON_OPTIONS.find((option) => option.value === reason)?.label || reason;
}

function reportStatusLabel(status: string): string {
  if (status === "pending") return "Pendiente";
  if (status === "reviewed") return "Revisado";
  if (status === "dismissed") return "Descartado";
  if (status === "escalated") return "Escalado";
  return status;
}

function reportStatusBadgeClass(status: string): string {
  if (status === "reviewed") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "dismissed") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "escalated") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function normalizePhoneMX(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("52")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return "52" + digits.slice(1);
  if (digits.length === 10) return "52" + digits;
  return digits;
}

function openWaLink(phone: string | null | undefined, message: string) {
  const normalized = phone ? normalizePhoneMX(phone) : "";
  if (!normalized || !message.trim()) return;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank");
}

function hasActiveServiceOrPlan(client: Pick<BranchClient, "planStatus">) {
  return client.planStatus === "active";
}

function hasIndividualPurchases(client: Pick<BranchClient, "individualPurchaseCount">) {
  return (client.individualPurchaseCount || 0) > 0;
}

const missingIdentityControlWarnings = new Set<string>();

function warnMissingIdentityControl(context: string, clientId: string | null) {
  if (!import.meta.env.DEV) return;
  const warningKey = `${context}:${clientId ?? "unknown"}`;
  if (missingIdentityControlWarnings.has(warningKey)) return;
  missingIdentityControlWarnings.add(warningKey);
  console.warn("[clientes-tab] identityControl no disponible", { context, clientId });
}

function resolveClientIdentityControl(
  identityControl: ClientIdentityControl | null | undefined,
  options: { context: string; clientId: string | null },
): ResolvedClientIdentityControl {
  if (identityControl) {
    return identityControl;
  }

  warnMissingIdentityControl(options.context, options.clientId);
  return {
    originType: "unknown",
    canEditIdentity: true,
    reason: "Origen no disponible. Puedes editar la identidad mientras validamos este cliente.",
  };
}

function clientOriginLabel(
  identityControl: ClientIdentityControl | null | undefined,
  clientId: string | null,
  context = "client-list",
) {
  const resolved = resolveClientIdentityControl(identityControl, { context, clientId });
  if (resolved.originType === "manual") return "Agregado manualmente";
  if (resolved.originType === "counter") return "Cliente de mostrador";
  if (resolved.originType === "app") return "Se unió desde la app";
  return "Origen no disponible";
}

function isAppJoinedClient(client: Pick<BranchClient, "identityControl" | "userId">) {
  return resolveClientIdentityControl(client.identityControl, {
    context: "client-filter",
    clientId: client.userId,
  }).originType === "app";
}

function getPlanTimingLabel(client: Pick<BranchClient, "planStatus" | "expiresAt">) {
  if (!client.expiresAt) return "Sin fecha de vencimiento";

  const now = new Date();
  const target = new Date(client.expiresAt);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (client.planStatus === "expired" || diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    if (daysAgo === 0) return "Venció hoy";
    if (daysAgo === 1) return "Venció hace 1 día";
    return `Venció hace ${daysAgo} días`;
  }

  if (diffDays === 0) return "Vence hoy";
  if (diffDays === 1) return "Vence en 1 día";
  return `Vence en ${diffDays} días`;
}

function getUsageLabel(client: Pick<BranchClient, "classesRemaining" | "classesTotal" | "planName">) {
  if (!client.planName) return "Sin usos activos";
  if (client.classesRemaining === null && client.classesTotal === null) return "Uso ilimitado";
  if (client.classesRemaining !== null && client.classesTotal !== null) {
    return `${client.classesRemaining}/${client.classesTotal} usos`;
  }
  if (client.classesRemaining !== null) return `${client.classesRemaining} usos`;
  return "Sin dato de usos";
}

function getClientCommercialLabel(client: Pick<BranchClient, "planName" | "planStatus" | "individualPurchaseCount">) {
  if (client.planName) return client.planName;
  if (client.individualPurchaseCount > 0) return "Compra individual";
  return "Sin servicio o plan";
}

function getCommercialHistoryFilterLabel(filter: ClientCommercialHistoryFilter) {
  if (filter === "products") return "Productos";
  if (filter === "services") return "Servicios y planes";
  if (filter === "current_month") return "Mes actual";
  return "Todo";
}

function getSaleChannelLabel(channel: string | null | undefined) {
  if (!channel) return "Canal no especificado";
  if (channel === "pos") return "Cobrar";
  return channel.replace(/_/g, " ");
}

function getSalePaymentMethodLabel(paymentMethod: string | null | undefined) {
  if (!paymentMethod) return "Pago no especificado";
  return (
    FINANCE_PAYMENT_METHOD_OPTIONS.find((option) => option.value === paymentMethod)?.label ??
    paymentMethod.replace(/_/g, " ")
  );
}

function getCommercialItemKindLabel(items: ClientCommercialHistoryItem["items"]) {
  const hasProducts = items.some((item) => item.itemType === "commercial_product");
  const hasServices = items.some((item) => item.itemType !== "commercial_product");
  if (hasProducts && hasServices) return "Mixta";
  if (hasProducts) return "Productos";
  if (hasServices) return "Servicios y planes";
  return "Venta comercial";
}

function getLastActivityLabel(client: Pick<BranchClient, "lastVisit" | "lastIndividualPurchaseAt">) {
  if (client.lastVisit) return timeAgo(client.lastVisit);
  if (client.lastIndividualPurchaseAt) return `Compra ${formatDate(client.lastIndividualPurchaseAt)}`;
  return "Sin actividad reciente";
}

function alertSectionLabel(sectionKey: string) {
  if (sectionKey === "app") return "Nuevos desde la app";
  if (sectionKey === "expiring") return "Planes por vencer";
  if (sectionKey === "expired") return "Planes vencidos sin renovación";
  if (sectionKey === "birthdays") return "Cumpleaños próximos";
  if (sectionKey === "inactive") return "Clientes inactivos";
  if (sectionKey === "no_classes") return "Sin usos disponibles";
  return "Alertas";
}

function buildAlertMessage(kind: "app" | "birthday" | "inactive" | "expiring" | "expired" | "no_classes", params: {
  firstName: string;
  branchName: string;
  planName: string | null;
  expiresAt: string | null;
}): string {
  if (kind === "birthday") {
    return `Hola ${params.firstName}, en ${params.branchName} te queremos desear un feliz cumpleaños. ¡Te esperamos pronto!`;
  }
  if (kind === "inactive") {
    return `Hola ${params.firstName}, hace tiempo que no te vemos en ${params.branchName}. Si quieres volver, te ayudamos con tu siguiente visita.`;
  }
  if (kind === "expiring") {
    return `Hola ${params.firstName}, tu ${params.planName || "servicio o plan"} en ${params.branchName} está por vencer${params.expiresAt ? ` (${params.expiresAt})` : ""}.`;
  }
  if (kind === "no_classes") {
    return `Hola ${params.firstName}, ya no tienes usos disponibles en ${params.branchName}. Si quieres, te ayudamos a elegir tu siguiente servicio o plan.`;
  }
  return `Hola ${params.firstName}, gracias por unirte desde la app a ${params.branchName}. Estamos listos para ayudarte cuando quieras reservar.`;
}

function buildClientAlertMessage(kind: "app" | "birthday" | "inactive" | "expiring" | "expired" | "no_classes", params: {
  firstName: string;
  branchName: string;
  planName: string | null;
  expiresAt: string | null;
}): string {
  if (kind === "birthday") {
    return `Hola ${params.firstName}, en ${params.branchName} te queremos desear un feliz cumpleaños. ¡Te esperamos pronto!`;
  }
  if (kind === "inactive") {
    return `Hola ${params.firstName}, hace tiempo que no te vemos en ${params.branchName}. Si quieres volver, te ayudamos con tu siguiente visita.`;
  }
  if (kind === "expiring") {
    return `Hola ${params.firstName}, tu ${params.planName || "servicio o plan"} en ${params.branchName} está por vencer${params.expiresAt ? ` (${params.expiresAt})` : ""}.`;
  }
  if (kind === "expired") {
    return `Hola ${params.firstName}, tu ${params.planName || "servicio o plan"} en ${params.branchName} ya venció${params.expiresAt ? ` (${params.expiresAt})` : ""}. Si quieres, te ayudamos a reactivarlo.`;
  }
  if (kind === "no_classes") {
    return `Hola ${params.firstName}, ya no tienes usos disponibles en ${params.branchName}. Si quieres, te ayudamos a elegir tu siguiente servicio o plan.`;
  }
  return `Hola ${params.firstName}, gracias por unirte desde la app a ${params.branchName}. Estamos listos para ayudarte cuando quieras reservar.`;
}

type WaModalTarget = {
  name: string;
  lastName: string | null;
  phone: string | null;
  expiresAt: string | null;
  classesRemaining: number | null;
  classesTotal: number | null;
  planName: string | null;
};

type DuplicateClientCandidate = {
  userId: string;
  membershipId: string;
  membershipStatus: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  source: string;
  identityControl: ClientIdentityControl | null;
};

type CreateClientDuplicateState = {
  code: "DUPLICATE_CLIENT" | "POSSIBLE_DUPLICATE_CLIENT" | "AMBIGUOUS_DUPLICATE";
  duplicateType: string;
  message: string;
  candidate: DuplicateClientCandidate | null;
  candidates: DuplicateClientCandidate[];
  candidateCount: number;
  canReuseExisting: boolean;
  canCreateAnyway: boolean;
};

const TEMPLATE_LABELS: Record<string, string> = {
  expired_membership: "Servicio o plan vencido",
  expiring_membership: "Servicio o plan por vencer",
  no_classes: "Sin usos disponibles",
  birthday_greeting: "Feliz cumpleaños",
  plan_renewal: "Renovaste tu servicio o plan",
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function WhatsAppModal({ target, branchName, onClose }: {
  target: WaModalTarget | null;
  branchName: string;
  onClose: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState("expired_membership");
  const [message, setMessage] = useState("");

  const { data: templates } = useQuery<Record<string, string>>({
    queryKey: ["/api/branch/whatsapp-templates"],
    enabled: !!target,
  });

  const vars = useMemo<Record<string, string>>(() => {
    if (!target) return {} as Record<string, string>;
    return {
      firstName: target.name,
      fullName: displayName(target.name, target.lastName),
      branchName,
      expiresAt: target.expiresAt ? formatDate(target.expiresAt) : "",
      classesRemaining: target.classesRemaining?.toString() ?? "",
      classesTotal: target.classesTotal?.toString() ?? "",
      planName: target.planName ?? "",
    };
  }, [target, branchName]);

  useEffect(() => {
    if (templates && templates[selectedTemplate]) {
      setMessage(fillTemplate(templates[selectedTemplate], vars));
    }
  }, [selectedTemplate, templates, vars]);

  const phone = target?.phone ? normalizePhoneMX(target.phone) : null;
  const waLink = phone && message.trim()
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-whatsapp">
        <DialogHeader>
          <DialogTitle>Enviar WhatsApp</DialogTitle>
          <DialogDescription>
            {target ? `Para: ${displayName(target.name, target.lastName)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {!target?.phone ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="text-wa-no-phone">
            Este cliente no tiene número de teléfono registrado. Edita su perfil para agregarlo.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span data-testid="text-wa-phone">{target?.phone ?? ""}</span>
            </div>
            <div>
              <Label>Plantilla</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="mt-1" data-testid="select-wa-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} data-testid={`option-wa-${key}`}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensaje (puedes editarlo antes de enviar)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="mt-1 text-sm"
                data-testid="textarea-wa-message"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-wa-cancel">Cancelar</Button>
          {waLink && (
            <Button
              onClick={() => window.open(waLink, "_blank")}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-wa-open"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Abrir WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getInitials(name: string, lastName: string | null): string {
  const first = name.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return last ? `${first}${last}` : first;
}

function ClientAvatar({ avatarUrl, name, lastName, size = "md" }: { avatarUrl: string | null; name: string; lastName: string | null; size: "sm" | "md" | "lg" }) {
  const sizeClasses = size === "sm" ? "w-8 h-8 text-xs" : size === "md" ? "w-10 h-10 text-sm" : "h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName(name, lastName)}
        className={`${sizeClasses} rounded-full object-cover shrink-0`}
        data-testid="client-avatar-image"
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-primary/10 flex items-center justify-center shrink-0`} data-testid="client-avatar-initials">
      <span className="font-semibold text-primary">{getInitials(name, lastName)}</span>
    </div>
  );
}

function AvatarUploadSection({ clientId, avatarUrl, name, lastName }: { clientId: string; avatarUrl: string | null; name: string; lastName: string | null }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Formato no válido", description: "Solo jpg, png o webp", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`/api/branch/clients/${clientId}/avatar`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Error al subir");
      }
      await invalidateBranchClientQueries(clientId);
      toast({ title: "Foto actualizada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const removeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/branch/clients/${clientId}/avatar`);
    },
    onSuccess: async () => {
      await invalidateBranchClientQueries(clientId);
      toast({ title: "Foto eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <ClientAvatar avatarUrl={avatarUrl} name={name} lastName={lastName} size="lg" />
      <div className="min-w-0 flex flex-col gap-1">
        <label className="cursor-pointer" data-testid="client-avatar-upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} disabled={uploading} />
          <span className="inline-flex items-center gap-1 break-words text-[11px] text-primary hover:underline sm:text-xs">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            {avatarUrl ? "Cambiar foto" : "Subir foto"}
          </span>
        </label>
        {avatarUrl && (
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="inline-flex items-center gap-1 break-words text-[11px] text-red-500 hover:underline sm:text-xs"
            data-testid="client-avatar-remove"
          >
            <ImageOff className="h-3 w-3" />
            Eliminar foto
          </button>
        )}
      </div>
    </div>
  );
}

function CreateClientDialog({
  open,
  onOpenChange,
  onOpenExisting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenExisting: (userId: string) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [duplicateState, setDuplicateState] = useState<CreateClientDuplicateState | null>(null);
  const [showCreateWithoutAccessConfirm, setShowCreateWithoutAccessConfirm] = useState(false);
  const [continueWithoutAppAccess, setContinueWithoutAppAccess] = useState(false);

  function buildCreatePayload(overrides: Record<string, unknown> = {}) {
    const normalizedEmail = normalizeOptionalEmailInput(email);
    const normalizedPhone = normalizeOptionalTextInput(phone);
    const data: any = { name: name.trim(), ...overrides };
    if (normalizedEmail) data.email = normalizedEmail;
    if (normalizedPhone) data.phone = normalizedPhone;
    if (lastName.trim()) data.lastName = lastName.trim();
    if (birthDate) data.birthDate = birthDate;
    if (gender) data.gender = gender;
    if (emergencyContactName.trim()) data.emergencyContactName = emergencyContactName.trim();
    if (emergencyContactPhone.trim()) data.emergencyContactPhone = emergencyContactPhone.trim();
    if (medicalNotes.trim()) data.medicalNotes = medicalNotes.trim();
    if (!normalizedEmail && continueWithoutAppAccess) {
      data.continueWithoutAppAccess = true;
    }
    return data;
  }

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const resp = await fetch("/api/branch/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const rawText = await resp.text();
      let payload: any = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!resp.ok) {
        const error: any = new Error(payload.message || rawText || "Error al crear cliente");
        error.status = resp.status;
        if (payload && typeof payload === "object") {
          Object.assign(error, payload);
        }
        throw error;
      }

      return payload ?? {};
    },
    onSuccess: async (data: any) => {
      setDuplicateState(null);
      setContinueWithoutAppAccess(false);
      await invalidateBranchMembershipQueries(data?.userId ?? null);
      if (data.password) {
        setCreatedPassword(data.password);
        toast({ title: "Cliente creado" });
      } else if (data.reusedExisting && data.userId) {
        toast({ title: data.message || "Cliente existente actualizado" });
        resetAndClose();
        onOpenExisting(data.userId);
      } else {
        toast({ title: data.message || "Cliente agregado" });
        resetAndClose();
      }
    },
    onError: (err: any) => {
      if (
        err.status === 409 &&
        (err.code === "DUPLICATE_CLIENT" || err.code === "POSSIBLE_DUPLICATE_CLIENT" || err.code === "AMBIGUOUS_DUPLICATE")
      ) {
        setDuplicateState({
          code: err.code,
          duplicateType: err.duplicateType,
          message: err.message || "Encontramos un posible duplicado",
          candidate: err.candidate || null,
          candidates: Array.isArray(err.candidates) ? err.candidates : undefined,
          candidateCount: err.candidateCount,
          canReuseExisting: err.canReuseExisting,
          canCreateAnyway: err.canCreateAnyway,
        });
        return;
      }
      if (err.code === "APP_ACCESS_CONFIRMATION_REQUIRED") {
        setShowCreateWithoutAccessConfirm(true);
        return;
      }
      toast({ title: "Error", description: err.message || "Error al crear cliente", variant: "destructive" });
    },
  });

  function resetAndClose() {
    setName(""); setLastName(""); setEmail(""); setPhone("");
    setShowMore(false); setBirthDate(""); setGender("");
    setEmergencyContactName(""); setEmergencyContactPhone("");
    setMedicalNotes(""); setCreatedPassword(null); setDuplicateState(null); setShowCreateWithoutAccessConfirm(false); setContinueWithoutAppAccess(false);
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizeOptionalEmailInput(email)) {
      setContinueWithoutAppAccess(false);
      setShowCreateWithoutAccessConfirm(true);
      return;
    }
    createMutation.mutate(buildCreatePayload());
  }

  function handleConfirmCreateWithoutAccess() {
    setContinueWithoutAppAccess(true);
    setShowCreateWithoutAccessConfirm(false);
    createMutation.mutate(buildCreatePayload());
  }

  function handleOpenExistingCandidate() {
    if (!duplicateState?.candidate?.userId) return;
    const candidateUserId = duplicateState.candidate.userId;
    resetAndClose();
    onOpenExisting(candidateUserId);
  }

  function handleOpenSpecificCandidate(userId: string) {
    resetAndClose();
    onOpenExisting(userId);
  }

  function handleReuseExistingCandidate() {
    if (!duplicateState?.candidate?.userId) return;
    createMutation.mutate(
      buildCreatePayload({ reuseExistingClientId: duplicateState.candidate.userId }),
    );
  }

  function handleCreateAnyway() {
    createMutation.mutate(buildCreatePayload({ confirmPotentialDuplicate: true }));
  }

  const duplicateCandidateName = duplicateState?.candidate
    ? displayName(duplicateState.candidate.name, duplicateState.candidate.lastName)
    : "";
  const duplicateDialogTitle =
    duplicateState?.code === "AMBIGUOUS_DUPLICATE"
      ? "Hay varios clientes con el mismo teléfono"
      : duplicateState?.duplicateType === "phone" && duplicateCandidateName
        ? `Este teléfono ya pertenece a ${duplicateCandidateName}`
      : duplicateState?.code === "DUPLICATE_CLIENT"
        ? "Este cliente ya parece estar registrado"
      : "Encontramos datos similares";

  const phoneLooksLikeEmail = !normalizeOptionalEmailInput(email) && looksLikeEmail(phone);

  if (createdPassword) {
    const clientName = [name, lastName].filter(Boolean).join(" ");
    const accessText = `Hola ${name}, aquí están tus datos de acceso para ${((user?.branch as any)?.name ?? "el estudio")}:\n\nUsuario (email): ${email}\nContraseña: ${createdPassword}`;
    const waPhone = phone ? normalizePhoneMX(phone) : null;
    return (
      <Dialog open={open} onOpenChange={() => resetAndClose()}>
        <DialogContent data-testid="dialog-credentials">
          <DialogHeader>
            <DialogTitle>Cliente creado</DialogTitle>
            <DialogDescription>Comparte las credenciales de acceso con {clientName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-md p-3 space-y-2 text-sm font-mono" data-testid="box-credentials">
              <p><span className="font-sans font-medium">Usuario (email):</span> {email}</p>
              <p><span className="font-sans font-medium">Contraseña:</span> {createdPassword}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(accessText);
                toast({ title: "Copiado al portapapeles" });
              }}
              data-testid="button-copy-credentials"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar acceso completo
            </Button>
            {waPhone && (
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(accessText)}`, "_blank")}
                data-testid="button-wa-credentials"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar acceso por WhatsApp
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose} data-testid="button-close-credentials">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            resetAndClose();
            return;
          }
          onOpenChange(nextOpen);
        }}
      >
      <DialogContent className="z-[130] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear cliente</DialogTitle>
          <DialogDescription>Agrega un nuevo cliente a tu sucursal</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="client-name">Nombre *</Label>
              <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required data-testid="input-client-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-lastname">Apellidos</Label>
              <Input id="client-lastname" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellidos" data-testid="input-client-lastname" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">Correo electrónico (opcional)</Label>
            <Input id="client-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" data-testid="input-client-email" />
            <p className="text-xs text-muted-foreground">Puedes registrarlo solo con nombre y teléfono.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone">Teléfono (opcional)</Label>
            <Input id="client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55 1234 5678" data-testid="input-client-phone" />
          </div>

          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setShowMore(!showMore)} data-testid="button-toggle-more-fields">
            {showMore ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {showMore ? "Menos datos" : "Más datos"}
          </Button>

          {showMore && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="client-birthdate">Fecha de nacimiento</Label>
                  <Input id="client-birthdate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} data-testid="input-client-birthdate" />
                </div>
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger data-testid="select-client-gender">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                      <SelectItem value="NE">No especifica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="client-emergency-name">Contacto de emergencia</Label>
                  <Input id="client-emergency-name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Nombre" data-testid="input-client-emergency-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-emergency-phone">Tel. emergencia</Label>
                  <Input id="client-emergency-phone" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="55 1234 5678" data-testid="input-client-emergency-phone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-medical">Notas médicas (privado)</Label>
                <Textarea id="client-medical" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Alergias, condiciones, etc." className="min-h-[60px] text-sm" data-testid="input-client-medical" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} data-testid="button-cancel-create-client">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()} data-testid="button-submit-client">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>

      <AlertDialog
        open={showCreateWithoutAccessConfirm}
        onOpenChange={setShowCreateWithoutAccessConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear cliente sin acceso a la app</AlertDialogTitle>
            <AlertDialogDescription>
              Este cliente podra administrarse normalmente en WebCool, pero no tendra usuario ni contrasena para ingresar a la app porque no tiene correo electronico.
              {phoneLooksLikeEmail ? " Parece que escribiste un correo en el campo telefono. Revisa los datos antes de continuar." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-create-without-access">
              Regresar y agregar correo
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCreateWithoutAccess}
              disabled={createMutation.isPending}
              data-testid="button-confirm-create-without-access"
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continuar sin acceso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!duplicateState}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDuplicateState(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{duplicateDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateState?.message ?? ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {duplicateState?.candidate && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
              <div className="font-medium">{duplicateCandidateName}</div>
              <div className="text-muted-foreground">{duplicateState.candidate.phone || "Sin telefono registrado"}</div>
              <div className="text-muted-foreground">{displayClientEmail(duplicateState.candidate.email)}</div>
              <div className="text-muted-foreground">
                {duplicateState.candidate.birthDate ? `Cumpleanos: ${formatDate(duplicateState.candidate.birthDate)}` : "Sin cumpleanos registrado"}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline">
                  {clientOriginLabel(
                    duplicateState.candidate.identityControl,
                    duplicateState.candidate.userId,
                    "duplicate-single",
                  )}
                </Badge>
                <Badge variant="secondary">
                  {duplicateState.candidate.membershipStatus === "left" ? "Cliente inactivo" : "Cliente activo"}
                </Badge>
                {duplicateState?.candidateCount && duplicateState.candidateCount > 1 && (
                  <Badge variant="destructive">{duplicateState.candidateCount} coincidencias fuertes</Badge>
                )}
              </div>
            </div>
          )}

          {duplicateState?.code === "AMBIGUOUS_DUPLICATE" && !!duplicateState.candidates?.length && (
            <div className="space-y-2">
              {duplicateState.candidates.map((candidate) => (
                <div key={candidate.userId} className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{displayName(candidate.name, candidate.lastName)}</div>
                      <div className="text-muted-foreground">{candidate.phone || "Sin telefono registrado"}</div>
                      <div className="text-muted-foreground">{displayClientEmail(candidate.email)}</div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline">
                          {clientOriginLabel(candidate.identityControl, candidate.userId, "duplicate-multiple")}
                        </Badge>
                        <Badge variant="secondary">
                          {candidate.membershipStatus === "left" ? "Cliente inactivo" : "Cliente activo"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSpecificCandidate(candidate.userId)}
                    >
                      Abrir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={() => setDuplicateState(null)}
              data-testid="button-cancel-duplicate-client"
            >
              Cancelar
            </AlertDialogCancel>
            {duplicateState?.candidate?.userId && duplicateState.code !== "AMBIGUOUS_DUPLICATE" && (
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenExistingCandidate}
                data-testid="button-open-existing-client"
              >
                Abrir cliente existente
              </Button>
            )}
            {duplicateState?.code === "DUPLICATE_CLIENT" && duplicateState.duplicateType !== "phone" && duplicateState.canReuseExisting && (
              <AlertDialogAction
                onClick={handleReuseExistingCandidate}
                disabled={createMutation.isPending}
                data-testid="button-reuse-existing-client"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Completar datos faltantes
              </AlertDialogAction>
            )}
            {duplicateState?.code === "DUPLICATE_CLIENT" && duplicateState.duplicateType === "phone" && duplicateState.canCreateAnyway && (
              <AlertDialogAction
                onClick={handleCreateAnyway}
                disabled={createMutation.isPending}
                data-testid="button-create-client-phone-anyway"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear de todas formas
              </AlertDialogAction>
            )}
            {duplicateState?.code === "POSSIBLE_DUPLICATE_CLIENT" && duplicateState.canCreateAnyway && (
              <AlertDialogAction
                onClick={handleCreateAnyway}
                disabled={createMutation.isPending}
                data-testid="button-create-client-anyway"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear de todas formas
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditClientDialog({ clientId, open, onOpenChange }: { clientId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [injuriesNotes, setInjuriesNotes] = useState("");
  const [medicalWarnings, setMedicalWarnings] = useState("");
  const [parqAccepted, setParqAccepted] = useState(false);
  const [crmClientStatus, setCrmClientStatus] = useState("auto");
  const [crmTags, setCrmTags] = useState("");

  function resetForm() {
    setName("");
    setEmail("");
    setLastName("");
    setPhone("");
    setBirthDate("");
    setGender("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
    setMedicalNotes("");
    setInjuriesNotes("");
    setMedicalWarnings("");
    setParqAccepted(false);
    setCrmClientStatus("auto");
    setCrmTags("");
  }

  const { data: profile } = useQuery<ClientProfile>({
    queryKey: ["/api/branch/clients", clientId],
    enabled: open && !!clientId,
  });

  useEffect(() => {
    if (!open || !clientId) {
      resetForm();
      return;
    }

    if (!profile || profile.user.id !== clientId) {
      return;
    }

    setName(profile.user.name || "");
    setEmail(profile.user.email || "");
    setLastName(profile.user.lastName || "");
    setPhone(profile.user.phone || "");
    setBirthDate(profile.user.birthDate || "");
    setGender(profile.user.gender || "");
    setEmergencyContactName(profile.user.emergencyContactName || "");
    setEmergencyContactPhone(profile.user.emergencyContactPhone || "");
    setMedicalNotes(profile.user.medicalNotes || "");
    setInjuriesNotes(profile.user.injuriesNotes || "");
    setMedicalWarnings(profile.user.medicalWarnings || "");
    setParqAccepted(profile.user.parqAccepted || false);
    setCrmClientStatus(profile.crm.manualStatus || "auto");
    setCrmTags(profile.crm.tags || "");
  }, [open, clientId, profile]);

  const isProfileReady = !!profile && profile.user.id === clientId;
  const resolvedIdentityControl = resolveClientIdentityControl(profile?.identityControl ?? null, {
    context: "edit-client-dialog",
    clientId,
  });
  const canEditIdentity = resolvedIdentityControl.canEditIdentity;
  const identityManagedReason = resolvedIdentityControl.reason;

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const requestJson = async (url: string, body: unknown) => {
        const resp = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const rawText = await resp.text();
        let payload: any = null;
        try {
          payload = rawText ? JSON.parse(rawText) : null;
        } catch {
          payload = null;
        }

        if (!resp.ok) {
          const error: any = new Error(payload.message || rawText || "Error al actualizar");
          error.status = resp.status;
          if (payload && typeof payload === "object") {
            Object.assign(error, payload);
          }
          throw error;
        }

        return payload ?? {};
      };

      const clientResp = await requestJson(`/api/branch/clients/${clientId}`, data.client);
      const crmResp = await requestJson(`/api/branch/client/${clientId}`, data.crm);
      return {
        client: clientResp,
        crm: crmResp,
      };
    },
    onSuccess: async () => {
      await invalidateBranchMembershipQueries(clientId);
      toast({ title: "Cliente actualizado" });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al actualizar", variant: "destructive" });
    },
  });

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const identityPayload = canEditIdentity
      ? {
          name: name.trim() || undefined,
          email: normalizeOptionalEmailInput(email),
          lastName: lastName || null,
          phone: phone || null,
          birthDate: birthDate || null,
          gender: gender || null,
        }
      : {};

    editMutation.mutate({
      client: {
        ...identityPayload,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        medicalNotes: medicalNotes || null,
        injuriesNotes: injuriesNotes || null,
        medicalWarnings: medicalWarnings || null,
        parqAccepted,
        parqAcceptedDate: parqAccepted ? (profile?.user.parqAcceptedDate || new Date().toISOString().split("T")[0]) : null,
      },
      crm: {
        clientStatus: crmClientStatus === "auto" ? null : crmClientStatus,
        tags: crmTags || null,
        },
      });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Modifica los datos del cliente</DialogDescription>
        </DialogHeader>
        {!isProfileReady ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={!canEditIdentity}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Apellidos</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={!canEditIdentity}
                  data-testid="input-edit-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{canEditIdentity ? "Correo electrónico (opcional)" : "Correo de acceso"}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!canEditIdentity}
                disabled={!canEditIdentity}
                data-testid="input-edit-email"
              />
              <p className="text-xs text-muted-foreground">
                {canEditIdentity
                  ? "Puedes agregar, actualizar o quitar el correo porque este cliente fue creado desde tu sucursal."
                  : identityManagedReason}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!canEditIdentity}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">CRM</p>
                  <p className="text-xs text-muted-foreground">
                    Última visita detectada: {profile.crm.lastVisit ? formatDateTime(profile.crm.lastVisit) : "Nunca"}
                  </p>
                </div>
                <Badge variant="outline" className={crmStatusBadgeClass(profile.crm.clientStatus)} data-testid="badge-edit-crm-status">
                  {crmStatusLabel(profile.crm.clientStatus)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Estado CRM</Label>
                  <Select value={crmClientStatus} onValueChange={setCrmClientStatus}>
                    <SelectTrigger data-testid="select-edit-crm-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatico</SelectItem>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Etiquetas</Label>
                  <Input
                    value={crmTags}
                    onChange={(e) => setCrmTags(e.target.value)}
                    placeholder="vip, seguimiento, rehab"
                    data-testid="input-edit-crm-tags"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={!canEditIdentity}
                    data-testid="input-edit-birthdate"
                  />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                  <Select value={gender} onValueChange={setGender} disabled={!canEditIdentity}>
                  <SelectTrigger data-testid="select-edit-gender">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="NE">No especifica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contacto de emergencia</Label>
                <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Nombre" data-testid="input-edit-emergency-name" />
              </div>
              <div className="space-y-2">
                <Label>Tel. emergencia</Label>
                <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="55 1234 5678" data-testid="input-edit-emergency-phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas médicas (privado)</Label>
              <Textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Alergias, condiciones, etc." className="min-h-[60px] text-sm" data-testid="input-edit-medical" />
            </div>
            <div className="space-y-2">
              <Label>Lesiones / limitaciones</Label>
              <Textarea value={injuriesNotes} onChange={(e) => setInjuriesNotes(e.target.value)} placeholder="Rodilla derecha operada, espalda baja sensible, etc." className="min-h-[60px] text-sm" data-testid="input-edit-injuries" />
            </div>
            <div className="space-y-2">
              <Label>Advertencias médicas</Label>
              <Textarea value={medicalWarnings} onChange={(e) => setMedicalWarnings(e.target.value)} placeholder="Hipertensión, asma, toma medicamento X, etc." className="min-h-[60px] text-sm" data-testid="input-edit-warnings" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="parq-accepted"
                checked={parqAccepted}
                onChange={(e) => setParqAccepted(e.target.checked)}
                className="rounded"
                data-testid="input-edit-parq"
              />
              <Label htmlFor="parq-accepted" className="cursor-pointer text-sm">
                PAR-Q firmado / aceptado
              </Label>
              {parqAccepted && profile.user.parqAcceptedDate && (
                <span className="text-xs text-muted-foreground">({profile.user.parqAcceptedDate})</span>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel-edit">Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending || !name} data-testid="button-save-edit">
                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InviteLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: linkData } = useQuery<{ inviteUrl: string; slug: string }>({
    queryKey: ["/api/branch/invite-link"],
    enabled: open,
  });

  function copyLink() {
    if (linkData?.inviteUrl) {
      navigator.clipboard.writeText(linkData.inviteUrl);
      setCopied(true);
      toast({ title: "Link copiado" });
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar cliente</DialogTitle>
          <DialogDescription>Comparte este link para que los clientes se registren y se unan a tu sucursal</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {linkData ? (
            <div className="flex gap-2">
              <Input value={linkData.inviteUrl} readOnly className="font-mono text-sm" data-testid="input-invite-url" />
              <Button variant="outline" onClick={copyLink} data-testid="button-copy-invite">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          <p className="text-xs text-muted-foreground">
            Cuando un cliente visite este link y se registre, quedará asociado a tu sucursal automáticamente.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} data-testid="button-close-invite">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientDebtSection({ clientId, hasDebt, debtAmount }: { clientId: string; hasDebt: boolean; debtAmount: number }) {
  const { toast } = useToast();
  const [localHasDebt, setLocalHasDebt] = useState(hasDebt);
  const [localAmount, setLocalAmount] = useState(String(debtAmount / 100));

  useEffect(() => {
    setLocalHasDebt(hasDebt);
    setLocalAmount(String(debtAmount / 100));
  }, [hasDebt, debtAmount]);

  const debtMutation = useMutation({
    mutationFn: async (data: { hasDebt: boolean; debtAmount: number }) => {
      const resp = await apiRequest("PATCH", `/api/branch/clients/${clientId}/debt`, data);
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchClientQueries(clientId);
      toast({ title: "Adeudo actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function saveDebt() {
    const cents = Math.round(parseFloat(localAmount || "0") * 100);
    debtMutation.mutate({ hasDebt: localHasDebt, debtAmount: cents });
  }

  return (
    <div className="max-w-full rounded-md bg-muted/50 p-2.5 space-y-2 sm:p-3">
      <h4 className="text-sm font-medium flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5" />
        Adeudo
      </h4>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={localHasDebt}
            onChange={(e) => setLocalHasDebt(e.target.checked)}
            className="rounded"
            data-testid="client-debt-toggle"
          />
          Tiene adeudo
        </label>
        {localHasDebt && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={localAmount}
              onChange={(e) => setLocalAmount(e.target.value)}
              className="h-9 w-full min-w-0 text-sm sm:h-7 sm:w-24"
              placeholder="0.00"
              data-testid="client-debt-amount"
            />
            <span className="text-xs text-muted-foreground">MXN</span>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full text-xs sm:h-7 sm:w-auto"
          onClick={saveDebt}
          disabled={debtMutation.isPending}
          data-testid="client-debt-save"
        >
          {debtMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function ClientStatusSelector({ clientId, currentStatus }: { clientId: string; currentStatus: string }) {
  const { toast } = useToast();

  const statusMutation = useMutation({
    mutationFn: async (clientStatus: string) => {
      const resp = await apiRequest("PATCH", `/api/branch/clients/${clientId}/status`, { clientStatus });
      return resp.json();
    },
    onSuccess: async (_data, newStatus) => {
      await invalidateBranchMembershipQueries(clientId);
      toast({ title: `Status actualizado a ${clientStatusLabel(newStatus)}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={clientStatusVariant(currentStatus)} className="text-[11px] sm:text-xs" data-testid="badge-client-status">
        {clientStatusLabel(currentStatus)}
      </Badge>
      <Select
        value={currentStatus}
        onValueChange={(val) => statusMutation.mutate(val)}
        disabled={statusMutation.isPending}
      >
        <SelectTrigger className="h-9 w-[132px] max-w-full text-xs sm:h-7 sm:w-[140px]" data-testid="client-status-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Activo</SelectItem>
          <SelectItem value="inactive">Inactivo</SelectItem>
          <SelectItem value="frozen">Congelado</SelectItem>
        </SelectContent>
      </Select>
      {statusMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      {currentStatus === "inactive" && (
        <span className="w-full text-[11px] text-orange-500 sm:w-auto sm:text-xs">No puede reservar</span>
      )}
      {currentStatus === "frozen" && (
        <span className="w-full text-[11px] text-blue-500 sm:w-auto sm:text-xs">Sin asistencia ni reservas</span>
      )}
    </div>
  );
}

function ClientProfileDialog({ clientId, open, onOpenChange, onEdit, onDelete, onWhatsApp, onOpenLeaseContract }: {
  clientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onWhatsApp: (target: WaModalTarget) => void;
  onOpenLeaseContract?: (target: LeaseContractNavigationTarget) => void;
}) {
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showPlanSelect, setShowPlanSelect] = useState(false);
  const [assignmentStartDate, setAssignmentStartDate] = useState(getMxTodayIsoDate());
  const [selectedAssignPlanId, setSelectedAssignPlanId] = useState("");
  const [membershipPaymentMethod, setMembershipPaymentMethod] =
    useState<(typeof FINANCE_PAYMENT_METHOD_OPTIONS)[number]["value"]>("efectivo");
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASON_OPTIONS)[number]["value"]>("mal_comportamiento");
  const [reportNote, setReportNote] = useState("");
  const [blockLocally, setBlockLocally] = useState(false);
  const [commercialHistoryFilter, setCommercialHistoryFilter] = useState<ClientCommercialHistoryFilter>("all");
  const [commercialHistoryPage, setCommercialHistoryPage] = useState(1);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessConfirmationOpen, setAccessConfirmationOpen] = useState(false);
  const [pendingAccessAction, setPendingAccessAction] = useState<"create" | "verifyLegacy" | "reset" | null>(null);
  const [accessCredentialResult, setAccessCredentialResult] = useState<ClientAccessCredentialResult | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { data: profile, isLoading } = useQuery<ClientProfile>({
    queryKey: ["/api/branch/clients", clientId],
    enabled: open && !!clientId,
  });
  const commercialHistoryQuery = useQuery<ClientCommercialHistoryResponse>({
    queryKey: [
      `/api/branch/clients/${clientId}/commercial-history?filter=${commercialHistoryFilter}&page=${commercialHistoryPage}&limit=10`,
    ],
    enabled: open && !!clientId,
    placeholderData: (previous) => previous,
  });

  function applyLocalAccessSuccessToCache(payload: ClientAccessCredentialResult) {
    if (!clientId) return;
    queryClient.setQueryData<ClientProfile>(["/api/branch/clients", clientId], (current) => {
      if (!current) return current;
      return {
        ...current,
        accessStatus: "LOCAL_ACCESS",
        accessProvider: "email",
        accessEmail: payload.email,
        canBranchManageAccess: true,
        canCreateLocalAccess: false,
        canVerifyLegacyLocalAccess: false,
        canResetLocalPassword: true,
        canResetLocalPasswordReason: "Si olvido su contrasena, puedes generar una nueva temporal. La anterior dejara de funcionar.",
        accessReason: "Si olvido su contrasena, puedes generar una nueva temporal. La anterior dejara de funcionar.",
      };
    });
  }

  function logClientAccess(
    stage:
      | "create-button-click"
      | "verify-button-click"
      | "reset-button-click"
      | "confirmation-open"
      | "confirmation-submit"
      | "mutation-start"
      | "mutation-success"
      | "mutation-error"
      | "mutation-settled",
    action: "create" | "verifyLegacy" | "reset",
    extra?: Record<string, unknown>,
  ) {
    if (!import.meta.env.DEV) return;
    console.log(`[client-access] ${stage}`, {
      clientId,
      action,
      ...extra,
    });
  }

  useEffect(() => {
    if (!open) {
      setReportReason("mal_comportamiento");
      setReportNote("");
      setBlockLocally(false);
      setShowAllNotes(false);
      setShowPlanSelect(false);
      setAssignmentStartDate(getMxTodayIsoDate());
      setSelectedAssignPlanId("");
      setMembershipPaymentMethod("efectivo");
      setCommercialHistoryFilter("all");
      setCommercialHistoryPage(1);
      setAccessDialogOpen(false);
      setAccessConfirmationOpen(false);
      setPendingAccessAction(null);
      setAccessCredentialResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCommercialHistoryFilter("all");
    setCommercialHistoryPage(1);
    setAssignmentStartDate(getMxTodayIsoDate());
    setSelectedAssignPlanId("");
    setAccessDialogOpen(false);
    setAccessConfirmationOpen(false);
    setPendingAccessAction(null);
    setAccessCredentialResult(null);
  }, [open, clientId]);

  useEffect(() => {
    if (!open) return;

    const resetScroll = () => {
      const node = scrollContainerRef.current;
      if (!node) return;
      node.scrollTop = 0;
      node.scrollLeft = 0;
    };

    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    const timeoutId = window.setTimeout(resetScroll, 80);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [open, clientId, profile?.user.id]);

  useEffect(() => {
    if (!open) return;

    document.body.setAttribute("data-client-profile-open", "true");

    return () => {
      document.body.removeAttribute("data-client-profile-open");
    };
  }, [open]);

  const { data: plans } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/branch/plans"],
    enabled: open && showPlanSelect,
  });

  const noteMutation = useMutation({
    mutationFn: async (content: string) => {
      const resp = await apiRequest("POST", `/api/branch/clients/${clientId}/notes`, { content });
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchClientQueries(clientId);
      setNoteContent("");
      toast({ title: "Nota agregada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al crear nota", variant: "destructive" });
    },
  });

  const attendanceMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/branch/clients/${clientId}/attendance`);
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchMembershipQueries(clientId);
      toast({ title: "Asistencia registrada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al registrar asistencia", variant: "destructive" });
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: async ({
      planId,
      paymentMethod,
      startDate,
      idempotencyKey,
    }: {
      planId: string;
      paymentMethod: string;
      startDate: string;
      idempotencyKey: string;
    }) => {
      const resp = await apiRequest("POST", `/api/branch/memberships/${profile!.membership.id}/assign-plan`, {
        planId,
        paymentMethod,
        startDate,
        idempotencyKey,
      });
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchMembershipQueries(clientId);
      setShowPlanSelect(false);
      setAssignmentStartDate(getMxTodayIsoDate());
      setSelectedAssignPlanId("");
      toast({ title: "Servicio o plan asignado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al asignar servicio o plan", variant: "destructive" });
    },
  });

  const removePlanMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("DELETE", `/api/branch/memberships/${profile!.membership.id}/plan`);
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchMembershipQueries(clientId);
      toast({ title: "Servicio o plan removido" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al quitar servicio o plan", variant: "destructive" });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async ({ idempotencyKey }: { idempotencyKey: string }) => {
      const resp = await apiRequest("POST", `/api/branch/memberships/${profile!.membership.id}/renew`, {
        paymentMethod: membershipPaymentMethod,
        idempotencyKey,
      });
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchMembershipQueries(clientId);
      toast({ title: "Servicio o plan renovado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al renovar servicio o plan", variant: "destructive" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (payload: { reason: string; note: string | null; blockLocally: boolean }) => {
      const resp = await apiRequest("POST", `/api/branch/client/${clientId}/report`, payload);
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchClientQueries(clientId);
      setReportNote("");
      setBlockLocally(false);
      toast({ title: "Incidencia enviada a Super Admin" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al reportar cliente", variant: "destructive" });
    },
  });

  const localBlockMutation = useMutation({
    mutationFn: async (payload: { reason: string | null; note: string | null }) => {
      const resp = await apiRequest("POST", `/api/branch/client/${clientId}/local-block`, payload);
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchClientQueries(clientId);
      toast({ title: "Cliente bloqueado en esta sucursal" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al bloquear cliente", variant: "destructive" });
    },
  });

  const localUnblockMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("DELETE", `/api/branch/client/${clientId}/local-block`);
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchClientQueries(clientId);
      toast({ title: "Bloqueo local removido" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al desbloquear cliente", variant: "destructive" });
    },
  });

  const createClientAccessMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/branch/clients/${clientId}/create-local-access`);
      return (await resp.json()) as ClientAccessCredentialResult;
    },
  });

  const assignPlanOperation = useStableOperationKey();
  const renewPlanOperation = useStableOperationKey();

  const resetClientAccessMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/branch/clients/${clientId}/reset-password`);
      return (await resp.json()) as ClientAccessCredentialResult;
    },
  });

  const verifyLegacyClientAccessMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/branch/clients/${clientId}/verify-legacy-local-access`);
      return (await resp.json()) as ClientAccessCredentialResult;
    },
  });

  const activePlans = (plans || []).filter(p => p.isActive);
  const assignablePlans = activePlans.filter((plan) => !plan.leaseEnabled);
  const todayAssignmentDate = getMxTodayIsoDate();
  const selectedAssignPlan = assignablePlans.find((plan) => plan.id === selectedAssignPlanId) ?? null;
  const assignPlanPreviewExpiresAt = calculatePlanExpirationPreview(selectedAssignPlan, assignmentStartDate);
  const activePlanChargeSnapshot = profile?.plan ? getMembershipPlanChargeSnapshot(profile.plan) : null;
  const activePlanPriceDisplay = profile ? getClientPlanPriceDisplay(profile) : null;
  const openLeaseContracts = profile?.openLeaseContracts ?? [];
  const activeLeaseContractsCount = profile?.activeLeaseContractsCount ?? openLeaseContracts.length;
  const activePlanExpirationLabel = profile?.membership.expiresAt
    ? formatDate(profile.membership.expiresAt)
    : "—";
  const isLeaseManagedRenewBlocked = !!profile?.plan?.leaseEnabled;
  const leaseRenewGuardMessage = "Este arrendamiento utiliza condiciones contractuales. La renovación se gestiona desde el contrato.";
  const isHistoricalAssignment = assignmentStartDate < todayAssignmentDate;
  const age = profile ? calcAge(profile.user.birthDate) : null;
  const commercialHistory = commercialHistoryQuery.data;
  const commercialHistoryData: ClientCommercialHistoryResponse = commercialHistory ?? {
    summary: {
      totalSpentAmount: 0,
      salesCount: 0,
      averageTicketAmount: 0,
      lastPurchaseAt: null,
      currentMonthAmount: 0,
    },
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    filter: commercialHistoryFilter,
  };
  const commercialHistoryPageCount = commercialHistory
    ? Math.max(1, Math.ceil(commercialHistory.total / commercialHistory.limit))
    : 1;
  const resolvedIdentityControl = resolveClientIdentityControl(profile?.identityControl ?? null, {
    context: "client-profile",
    clientId,
  });
  const showClientAccessSection = !!profile;
  const canBranchManageClientAccess = !!profile?.canBranchManageAccess;
  const accessStatus = profile?.accessStatus ?? "NO_ACCESS";
  const accessProvider = profile?.accessProvider ?? null;
  const normalizedAccessEmail = profile?.accessEmail ?? null;
  const canCreateClientAccess = !!profile?.canCreateLocalAccess;
  const canVerifyLegacyClientAccess = !!profile?.canVerifyLegacyLocalAccess;
  const canResetClientAccess = !!profile?.canResetLocalPassword;
  const canCopyAccessUser =
    canBranchManageClientAccess
    && !!normalizedAccessEmail
    && (accessStatus !== "LEGACY_UNVERIFIED" || canVerifyLegacyClientAccess);
  const accessProviderLabel =
    accessStatus === "LEGACY_UNVERIFIED"
      ? "Correo historico"
      : accessProvider === "google"
      ? "Google"
      : accessProvider === "apple"
        ? "Apple"
        : accessProvider === "email"
          ? "Correo y contrasena"
          : "Sin acceso";
  const accessStatusLabel =
    accessStatus === "LOCAL_ACCESS"
      ? "Acceso activo"
      : accessStatus === "EXTERNAL_PROVIDER"
        ? "Proveedor externo"
        : accessStatus === "DISABLED"
          ? "Acceso deshabilitado"
          : accessStatus === "LEGACY_UNVERIFIED"
            ? "Acceso historico por verificar"
            : "Sin acceso";
  const accessHelperText =
    canBranchManageClientAccess
      ? (
        profile?.accessReason ||
        profile?.canResetLocalPasswordReason ||
        "Consulta y administra el acceso de este cliente a la app desde aqui."
      )
      : "El acceso de este cliente es administrado por su propia cuenta.";
  const accessPrimaryActionLabel = !canBranchManageClientAccess
    ? null
    : canCreateClientAccess
      ? "Crear acceso a la app"
      : canVerifyLegacyClientAccess
        ? "Verificar y restablecer acceso"
      : canResetClientAccess
        ? "Restablecer contrasena"
        : null;
  const isAccessMutationPending =
    createClientAccessMutation.isPending
    || verifyLegacyClientAccessMutation.isPending
    || resetClientAccessMutation.isPending;

  useEffect(() => {
    assignPlanOperation.reset();
    renewPlanOperation.reset();
  }, [open, clientId, assignPlanOperation, renewPlanOperation]);

  useEffect(() => {
    if (!showPlanSelect) {
      assignPlanOperation.reset();
    }
  }, [showPlanSelect, assignPlanOperation]);

  async function handleAssignPlanSubmit() {
    if (!selectedAssignPlan || !profile?.membership.id || !assignmentStartDate) {
      return;
    }

    const fingerprint = JSON.stringify({
      membershipId: profile.membership.id,
      planId: selectedAssignPlan.id,
      paymentMethod: membershipPaymentMethod,
      startDate: assignmentStartDate,
    });

    const attempt = assignPlanOperation.begin(fingerprint);
    if (!attempt.allowed) {
      return;
    }

    try {
      await assignPlanMutation.mutateAsync({
        planId: selectedAssignPlan.id,
        paymentMethod: membershipPaymentMethod,
        startDate: assignmentStartDate,
        idempotencyKey: attempt.key,
      });
      assignPlanOperation.markSuccess(fingerprint);
    } catch {
      assignPlanOperation.markError(fingerprint);
    }
  }

  async function handleRenewPlanSubmit() {
    if (!profile?.membership.id) {
      return;
    }

    const fingerprint = JSON.stringify({
      membershipId: profile.membership.id,
      paymentMethod: membershipPaymentMethod,
    });

    const attempt = renewPlanOperation.begin(fingerprint);
    if (!attempt.allowed) {
      return;
    }

    try {
      await renewMutation.mutateAsync({
        idempotencyKey: attempt.key,
      });
      renewPlanOperation.markSuccess(fingerprint);
    } catch {
      renewPlanOperation.markError(fingerprint);
    }
  }

  function handleCopyAccessUser() {
    if (!normalizedAccessEmail) return;
    navigator.clipboard.writeText(normalizedAccessEmail);
    toast({ title: "Usuario copiado" });
  }

  function handleCopyTemporaryAccess() {
    if (!accessCredentialResult) return;
    const tempAccessText = `Usuario (email): ${accessCredentialResult.email}\nContrasena temporal: ${accessCredentialResult.temporaryPassword}`;
    navigator.clipboard.writeText(tempAccessText);
    toast({ title: "Acceso copiado" });
  }

  function handleShareTemporaryAccess() {
    if (!profile?.user.phone || !accessCredentialResult) return;
    const shareMessage = `Hola ${profile!.user.name}, estos son tus datos de acceso:\n\nUsuario: ${accessCredentialResult.email}\nContrasena temporal: ${accessCredentialResult.temporaryPassword}\n\nPor seguridad, te recomendamos cambiar tu contrasena al ingresar.`;
    openWaLink(profile.user.phone, shareMessage);
  }

  function openAccessConfirmation(action: "create" | "verifyLegacy" | "reset") {
    if (action === "create" && !canCreateClientAccess) return;
    if (action === "verifyLegacy" && !canVerifyLegacyClientAccess) return;
    if (action === "reset" && !canResetClientAccess) return;
    logClientAccess(
      action === "create"
        ? "create-button-click"
        : action === "verifyLegacy"
          ? "verify-button-click"
          : "reset-button-click",
      action,
    );
    setPendingAccessAction(action);
    setAccessConfirmationOpen(true);
    logClientAccess("confirmation-open", action);
  }

  function handleCreateClientAccess() {
    openAccessConfirmation("create");
  }

  function handleResetClientAccess() {
    openAccessConfirmation("reset");
  }

  function handleVerifyLegacyClientAccess() {
    openAccessConfirmation("verifyLegacy");
  }

  async function handleConfirmClientAccessAction() {
    const action = pendingAccessAction;
    if (!action) return;

    logClientAccess("confirmation-submit", action);

    try {
      logClientAccess("mutation-start", action);
      const payload = action === "create"
        ? await createClientAccessMutation.mutateAsync()
        : action === "verifyLegacy"
          ? await verifyLegacyClientAccessMutation.mutateAsync()
          : await resetClientAccessMutation.mutateAsync();

      setAccessCredentialResult(payload);
      applyLocalAccessSuccessToCache(payload);
      setAccessConfirmationOpen(false);
      setAccessDialogOpen(true);
      void invalidateBranchClientQueries(clientId);

      logClientAccess("mutation-success", action, {
        sessionsInvalidated: payload.sessionsInvalidated,
      });

      toast({
        title:
          action === "create"
            ? "Acceso creado correctamente"
            : action === "verifyLegacy"
              ? "Acceso historico verificado"
              : "Contrasena temporal generada",
      });
    } catch (err: any) {
      logClientAccess("mutation-error", action, {
        error: err instanceof Error ? err.message : String(err ?? "unknown"),
      });
      setAccessConfirmationOpen(false);
      setAccessDialogOpen(false);
      setAccessCredentialResult(null);
      setPendingAccessAction(null);
      toast({
        title: "Error",
        description: getApiErrorMessage(
          err,
          action === "create"
            ? "No se pudo crear el acceso a la app"
            : action === "verifyLegacy"
              ? "No se pudo verificar y restablecer el acceso"
              : "No se pudo restablecer la contrasena",
        ),
        variant: "destructive",
      });
    } finally {
      setAccessConfirmationOpen(false);
      logClientAccess("mutation-settled", action);
    }
  }

  const renderAssignPlanPicker = () => (
    <div className="space-y-3">
      {assignablePlans.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay servicios o planes activos. Crea uno en la pestaña Servicios y planes.</p>
      ) : (
        <div className="space-y-2">
          {assignablePlans.map((plan) => {
            const previewExpiresAt = calculatePlanExpirationPreview(plan, assignmentStartDate);
            const isSelected = selectedAssignPlanId === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedAssignPlanId(plan.id)}
                className={`w-full rounded-md border bg-background p-2 text-left text-sm transition-colors ${
                  isSelected ? "border-primary ring-1 ring-primary/30" : "hover:bg-muted/50"
                }`}
                data-testid={`button-select-plan-${plan.id}`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="break-words font-medium">{plan.name}</span>
                  <span className="text-xs text-muted-foreground">${(plan.price / 100).toFixed(2)} MXN</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {cycleLabel(plan.cycleMonths)} · {usageSummaryLabel(plan.classLimit, plan.cycleMonths)}
                </div>
                {getMembershipPlanChargeLabel(plan) ? (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {getMembershipPlanChargeLabel(plan)}
                  </div>
                ) : null}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {`Inicia ${formatDate(assignmentStartDate)} · ${previewExpiresAt ? `Vence ${formatCalendarPreview(previewExpiresAt)}` : "Sin fecha de vencimiento"}`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedAssignPlan ? (
        <div className="rounded-md border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Plan seleccionado</p>
          <p className="mt-1 text-muted-foreground">{selectedAssignPlan.name}</p>
          {getMembershipPlanChargeLabel(selectedAssignPlan) ? (
            <p className="mt-1 text-muted-foreground">{getMembershipPlanChargeLabel(selectedAssignPlan)}</p>
          ) : null}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Fecha de inicio</p>
              <p className="font-medium">{formatDate(assignmentStartDate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha de vencimiento</p>
              <p className="font-medium">{assignPlanPreviewExpiresAt ? formatCalendarPreview(assignPlanPreviewExpiresAt) : "Sin fecha de vencimiento"}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label className="text-xs">Fecha de inicio</Label>
        <Input
          type="date"
          value={assignmentStartDate}
          max={todayAssignmentDate}
          onChange={(event) => setAssignmentStartDate(event.target.value || todayAssignmentDate)}
          className="h-9 text-xs sm:h-8"
          data-testid="input-assign-plan-start-date"
        />
        <p className="text-[11px] text-muted-foreground">
          Usa una fecha anterior si el cliente ya había pagado antes de comenzar a usar WebCool.
        </p>
      </div>

      {isHistoricalAssignment ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Se registrará la membresía con fecha histórica. También se registrará el ingreso en Caja con esa fecha.
        </div>
      ) : null}

      <div className="space-y-1">
        <Label className="text-xs">Método de pago</Label>
        <Select value={membershipPaymentMethod} onValueChange={(value) => setMembershipPaymentMethod(value as (typeof FINANCE_PAYMENT_METHOD_OPTIONS)[number]["value"])}>
          <SelectTrigger className="h-9 text-xs sm:h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FINANCE_PAYMENT_METHOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="default"
          size="sm"
          className="h-10 sm:h-9"
          disabled={
            !selectedAssignPlan
            || assignPlanMutation.isPending
            || !assignmentStartDate
          }
          onClick={() => {
            void handleAssignPlanSubmit();
          }}
          data-testid="button-confirm-assign-plan"
        >
          {assignPlanMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Package className="mr-1 h-3.5 w-3.5" />}
          Asignar servicio o plan
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 sm:h-9"
          onClick={() => {
            setShowPlanSelect(false);
            setSelectedAssignPlanId("");
            setAssignmentStartDate(todayAssignmentDate);
          }}
          data-testid="button-cancel-assign-plan"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[90] h-[100dvh] max-h-[100dvh] w-screen max-w-none gap-0 overflow-hidden border-0 p-0 shadow-2xl sm:p-0 md:max-h-[90vh] md:h-auto md:w-full md:max-w-lg md:gap-4 md:overflow-y-auto md:border md:p-6 md:shadow-lg">
        <div className="flex h-full min-h-0 max-w-full min-w-0 flex-col overflow-hidden">
        <DialogHeader className="hidden shrink-0 border-b bg-background/95 px-4 pb-3 pr-14 pt-[calc(env(safe-area-inset-top)+1rem)] text-left backdrop-blur md:flex md:border-b-0 md:bg-transparent md:px-0 md:pb-0 md:pr-0 md:pt-0">
          <DialogTitle>Perfil del cliente</DialogTitle>
          <DialogDescription>Información detallada y acciones</DialogDescription>
        </DialogHeader>

        <div
          key={`client-profile-scroll-${clientId ?? "none"}`}
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] md:px-0 md:py-0 md:pb-0"
        >
          {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          ) : profile ? (
          <div className="max-w-full min-w-0 space-y-3 md:space-y-4">
            <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.35rem)] pr-14 backdrop-blur md:static md:mx-0 md:border-b-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:pr-0">
              <div className="grid grid-cols-[auto,minmax(0,1fr)] items-start gap-3 md:block md:space-y-4">
                <AvatarUploadSection
                  clientId={profile.user.id}
                  avatarUrl={profile.user.avatarUrl}
                  name={profile.user.name}
                  lastName={profile.user.lastName}
                />

                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-tight sm:text-lg" data-testid="text-profile-name">
                    {displayName(profile.user.name, profile.user.lastName)}
                  </h3>
                  <div className="mt-1 flex min-w-0 items-start gap-2 text-xs text-muted-foreground sm:text-sm">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-all" data-testid="text-profile-email">{displayClientEmail(profile.user.email)}</span>
                  </div>
                  {profile.user.phone && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="break-all" data-testid="text-profile-phone">{profile.user.phone}</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] text-green-600 hover:text-green-700 hover:underline sm:text-xs"
                        data-testid="client-whatsapp"
                        onClick={(e) => {
                          e.stopPropagation();
                          onWhatsApp?.({
                            name: profile.user.name,
                            lastName: profile.user.lastName,
                            phone: profile.user.phone,
                            expiresAt: profile.membership.expiresAt ?? null,
                            classesRemaining: profile.membership.classesRemaining ?? null,
                            classesTotal: profile.membership.classesTotal ?? null,
                            planName: profile.plan?.name ?? profile.planNameSnapshot ?? null,
                          });
                        }}
                      >
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 hover:underline sm:text-xs"
                        data-testid="client-copy-phone"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(profile.user.phone!);
                          toast({ title: "Teléfono copiado" });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        Copiar
                      </button>
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:mt-1 sm:text-sm">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Desde {formatDate(profile.user.createdAt)}
                    </span>
                    {profile.user.birthDate && (
                      <span data-testid="text-profile-age">
                        {age !== null ? `${age} años` : ""} ({profile.user.birthDate})
                      </span>
                    )}
                    {profile.user.gender && (
                      <span data-testid="text-profile-gender">{genderLabel(profile.user.gender)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <ClientStatusSelector
              clientId={profile.user.id}
              currentStatus={profile.membership.clientStatus || "active"}
            />

            <div className="flex min-w-0 items-center gap-2">
              <span className="break-words text-xs text-muted-foreground">
                Cliente desde {formatDate(profile.membership.joinedAt)} · {clientOriginLabel(profile.identityControl, profile.user.id, "client-profile")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button size="sm" variant="outline" className="h-10 w-full sm:h-9" onClick={() => { onOpenChange(false); onEdit(profile.user.id); }} data-testid="button-profile-edit">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button
                size="sm"
                className="h-10 w-full sm:h-9"
                onClick={() => attendanceMutation.mutate()}
                disabled={attendanceMutation.isPending || profile.membership.status !== "active" || profile.membership.clientStatus === "frozen"}
                data-testid="button-register-attendance"
              >
                {attendanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardCheck className="h-4 w-4 mr-1" />}
                Registrar asistencia
              </Button>
              <Button size="sm" variant="destructive" className="col-span-2 h-10 w-full sm:col-span-1 sm:h-9" onClick={() => { onOpenChange(false); onDelete(profile.user.id, displayName(profile.user.name, profile.user.lastName)); }} data-testid="button-profile-delete">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
              </Button>
            </div>

            <div className="max-w-full rounded-md bg-muted/50 p-2.5 space-y-2.5 sm:p-3 sm:space-y-3" data-testid="client-summary-pro">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Resumen
              </h4>
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Servicio o plan activo
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="w-full rounded-md bg-background p-2 text-center">
                  <div className="text-base font-bold sm:text-lg" data-testid="text-total-attendances">{profile.totalAttendances}</div>
                  <div className="text-[10px] text-muted-foreground">Asistencias</div>
                </div>
                <div className="w-full rounded-md bg-background p-2 text-center">
                  <div className="text-base font-bold sm:text-lg" data-testid="text-classes-remaining-summary">
                    {profile.membership.classesRemaining !== null ? profile.membership.classesRemaining : "∞"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Usos disponibles</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Última asistencia</span>
                  <span className="break-words font-medium sm:text-right" data-testid="text-last-attendance">
                    {profile.recentAttendances.length > 0 ? formatDateTime(profile.recentAttendances[0].checkedInAt) : "Nunca"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Próxima reserva</span>
                  <span className="break-words font-medium sm:text-right" data-testid="text-next-booking">
                    {profile.nextBooking
                      ? `${profile.nextBooking.className} · ${formatDate(profile.nextBooking.bookingDate)} ${profile.nextBooking.startTime}`
                      : "Sin reservas"}
                  </span>
                </div>
              </div>
              {profile.recentAttendances.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  <p className="text-[10px] font-medium text-muted-foreground">Últimas 5 asistencias:</p>
                  {profile.recentAttendances.slice(0, 5).map((att) => (
                    <div key={att.id} className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-green-500" />
                      <span className="break-words">{formatDateTime(att.checkedInAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ClientDebtSection
              clientId={profile.user.id}
              hasDebt={profile.membership.hasDebt}
              debtAmount={profile.membership.debtAmount}
            />

            <div className="max-w-full rounded-md bg-muted/50 p-2.5 space-y-2.5 sm:p-3 sm:space-y-3" data-testid="client-moderation-section">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Incidencias
                  </h4>
                  <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                    Reporta comportamiento problemático al Super Admin y, si hace falta, bloquea solo esta sucursal.
                  </p>
                </div>
                {profile.moderation.localBlock ? (
                  <Badge variant="outline" className="self-start whitespace-normal border-red-200 bg-red-50 text-left text-red-700" data-testid="badge-profile-local-block">
                    Bloqueado local
                  </Badge>
                ) : (
                  <Badge variant="outline" className="self-start whitespace-normal border-slate-200 bg-slate-100 text-left text-slate-700">
                    Sin bloqueo local
                  </Badge>
                )}
              </div>

              {profile.moderation.localBlock && (
                <div className="rounded-md border border-red-200 bg-red-50/80 p-3 text-sm space-y-1" data-testid="card-profile-local-block">
                  <p className="font-medium text-red-700">Este cliente no puede interactuar con esta sucursal.</p>
                  <p className="text-red-700/80">
                    {profile.moderation.localBlock.reason ? reportReasonLabel(profile.moderation.localBlock.reason) : "Sin motivo especificado"}
                  </p>
                  {profile.moderation.localBlock.note && (
                    <p className="text-red-700/80">{profile.moderation.localBlock.note}</p>
                  )}
                  <p className="text-xs text-red-700/70">
                    Desde {formatDateTime(profile.moderation.localBlock.createdAt)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Select value={reportReason} onValueChange={(value) => setReportReason(value as (typeof REPORT_REASON_OPTIONS)[number]["value"])}>
                    <SelectTrigger data-testid="select-report-reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_REASON_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Acciones</Label>
                  <div className="rounded-md border p-2.5 space-y-2 sm:p-3">
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={blockLocally}
                        onChange={(e) => setBlockLocally(e.target.checked)}
                        className="rounded"
                        data-testid="checkbox-report-block-locally"
                      />
                      Bloquear tambien en esta sucursal
                    </label>
                    {!profile.moderation.localBlock ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 w-full sm:h-9"
                        onClick={() => localBlockMutation.mutate({ reason: reportReason, note: reportNote.trim() || null })}
                        disabled={localBlockMutation.isPending}
                        data-testid="button-local-block"
                      >
                        {localBlockMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Shield className="h-3.5 w-3.5 mr-1" />}
                        Bloquear en esta sucursal
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 w-full sm:h-9"
                        onClick={() => localUnblockMutation.mutate()}
                        disabled={localUnblockMutation.isPending}
                        data-testid="button-local-unblock"
                      >
                        {localUnblockMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Shield className="h-3.5 w-3.5 mr-1" />}
                        Desbloquear sucursal
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nota / descripcion</Label>
                <Textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Describe la incidencia para que soporte la revise."
                  className="min-h-[64px] text-sm sm:min-h-[72px]"
                  data-testid="textarea-report-note"
                />
              </div>

              <div className="flex justify-stretch sm:justify-end">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => reportMutation.mutate({ reason: reportReason, note: reportNote.trim() || null, blockLocally })}
                  disabled={reportMutation.isPending}
                  data-testid="button-report-client"
                >
                  {reportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                  Reportar a Super Admin
                </Button>
              </div>

              <div className="space-y-2" data-testid="client-report-history">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Historial de incidencias ({profile.moderation.reports.length})
                  </p>
                </div>
                {profile.moderation.reports.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sin incidencias registradas.</p>
                ) : (
                  profile.moderation.reports.slice(0, 5).map((report) => (
                    <div key={report.id} className="max-w-full rounded-md border p-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={reportStatusBadgeClass(report.status)}>
                          {reportStatusLabel(report.status)}
                        </Badge>
                        <Badge variant="secondary">{reportReasonLabel(report.reason)}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTime(report.createdAt)}
                        </span>
                      </div>
                      {report.note && <p className="break-words text-sm">{report.note}</p>}
                      <p className="break-words text-[11px] text-muted-foreground">
                        {report.reporterName ? `Reportado por ${report.reporterName}` : "Reportado por admin"}
                        {report.reviewedAt && report.reviewerName ? ` · Revisado por ${report.reviewerName}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="max-w-full rounded-md bg-muted/50 p-2.5 space-y-2 sm:p-3">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Servicio o plan activo
              </h4>
              {profile.plan ? (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-medium" data-testid="text-profile-plan">{profile.plan.name}</span>
                      <Badge
                        variant={profile.planStatus === "expired" ? "destructive" : "default"}
                        className="text-[10px]"
                        data-testid="badge-plan-status"
                      >
                        {profile.planStatus === "expired" ? "Vencido" : "Activo"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-10 w-full px-2 text-xs sm:h-6 sm:w-auto" onClick={() => removePlanMutation.mutate()} disabled={removePlanMutation.isPending} data-testid="button-remove-plan">
                      <XCircle className="h-3 w-3 mr-1" /> Quitar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">Forma de venta</div>
                      <div className="font-medium" data-testid="text-billing-cycle">{cycleLabel(profile.plan.cycleMonths)}</div>
                    </div>
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">{activePlanPriceDisplay?.title || "Precio"}</div>
                      <div className="font-medium" data-testid="text-plan-price">
                        {formatCurrencyMx((activePlanPriceDisplay?.amountCents ?? 0) / 100)}
                      </div>
                      {activePlanPriceDisplay?.detailLines.map((line) => (
                        <div key={line} className="text-[11px] text-muted-foreground">
                          {line}
                        </div>
                      ))}
                    </div>
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">Pagado el</div>
                      <div className="font-medium" data-testid="text-paid-at">
                        {profile.membership.paidAt ? formatDate(profile.membership.paidAt) : "—"}
                      </div>
                    </div>
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">Vence el</div>
                      <div className={`font-medium ${profile.planStatus === "expired" ? "text-red-500" : ""}`} data-testid="text-plan-expires">
                        {activePlanExpirationLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {profile.membership.classesRemaining !== null && profile.membership.classesTotal !== null ? (
                      <span className="flex flex-wrap items-center gap-1" data-testid="text-classes-remaining">
                        <Hash className="h-3 w-3" />
                        {profile.membership.classesRemaining}/{profile.membership.classesTotal} usos restantes
                      </span>
                    ) : profile.membership.classesRemaining !== null ? (
                      <span className="flex flex-wrap items-center gap-1" data-testid="text-classes-remaining">
                        <Hash className="h-3 w-3" />
                        {profile.membership.classesRemaining} usos restantes
                      </span>
                    ) : (
                      <span>Uso ilimitado</span>
                    )}
                  </div>

                  {profile.planStatus === "expired" && (
                    isLeaseManagedRenewBlocked ? (
                      <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                        {leaseRenewGuardMessage}
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Método de pago</Label>
                          <Select value={membershipPaymentMethod} onValueChange={(value) => setMembershipPaymentMethod(value as (typeof FINANCE_PAYMENT_METHOD_OPTIONS)[number]["value"])}>
                          <SelectTrigger className="h-9 text-xs sm:h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FINANCE_PAYMENT_METHOD_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {activePlanChargeSnapshot && !activePlanChargeSnapshot.isLegacy ? (
                          <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground" data-testid="renew-tax-preview">
                            <p className="font-medium text-foreground">Resumen del cobro</p>
                            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {activePlanChargeSnapshot.taxMode === "tax_added" ? (
                                <>
                                  <span>Precio base: <strong className="text-foreground">{formatCurrencyMx(activePlanChargeSnapshot.basePriceCents / 100)}</strong></span>
                                  <span>IVA {formatTaxRateLabel(activePlanChargeSnapshot.taxRate)}: <strong className="text-foreground">{formatCurrencyMx((activePlanChargeSnapshot.taxTotalCents ?? 0) / 100)}</strong></span>
                                  <span className="sm:col-span-2">Total a cobrar: <strong className="text-foreground">{formatCurrencyMx(activePlanChargeSnapshot.finalTotalCents / 100)}</strong></span>
                                </>
                              ) : activePlanChargeSnapshot.taxMode === "tax_included" ? (
                                <>
                                  <span>Precio final: <strong className="text-foreground">{formatCurrencyMx(activePlanChargeSnapshot.finalTotalCents / 100)}</strong></span>
                                  <span>Subtotal: <strong className="text-foreground">{formatCurrencyMx((activePlanChargeSnapshot.subtotalBeforeTaxCents ?? 0) / 100)}</strong></span>
                                  <span className="sm:col-span-2">IVA incluido {formatTaxRateLabel(activePlanChargeSnapshot.taxRate)}: <strong className="text-foreground">{formatCurrencyMx((activePlanChargeSnapshot.taxTotalCents ?? 0) / 100)}</strong></span>
                                </>
                              ) : (
                                <span className="sm:col-span-2">Sin IVA: <strong className="text-foreground">{formatCurrencyMx(activePlanChargeSnapshot.finalTotalCents / 100)}</strong></span>
                              )}
                            </div>
                          </div>
                        ) : null}
                        <Button
                          size="sm"
                          className="h-10 w-full sm:h-9"
                          onClick={() => {
                            void handleRenewPlanSubmit();
                          }}
                          disabled={renewMutation.isPending}
                          data-testid="button-renew-plan"
                        >
                          {renewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
                          Renovar vigencia
                        </Button>
                      </div>
                    )
                  )}
                </div>
              ) : profile.planStatus === "deleted" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="whitespace-normal border-orange-400 text-orange-600 text-[10px]" data-testid="badge-plan-deleted">
                      Servicio o plan eliminado
                    </Badge>
                    {profile.planNameSnapshot && (
                      <span className="break-words text-xs text-muted-foreground line-through" data-testid="text-deleted-plan-name">{profile.planNameSnapshot}</span>
                    )}
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-2">
                    <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-1.5" data-testid="text-deleted-plan-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Lo que compraba este cliente ya no está disponible. Asigna un nuevo servicio o plan para continuar.
                    </p>
                  </div>
                  {profile.membership.paidAt && (
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <div className="bg-background rounded-md p-2">
                        <div className="text-muted-foreground mb-0.5">Pagado el</div>
                        <div className="font-medium">{formatDate(profile.membership.paidAt)}</div>
                      </div>
                      <div className="bg-background rounded-md p-2">
                        <div className="text-muted-foreground mb-0.5">Vencía el</div>
                        <div className="font-medium">{profile.membership.expiresAt ? formatDate(profile.membership.expiresAt) : "—"}</div>
                      </div>
                    </div>
                  )}
                  {!showPlanSelect ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-10 w-full bg-orange-600 hover:bg-orange-700 sm:h-9"
                      onClick={() => {
                        setAssignmentStartDate(todayAssignmentDate);
                        setSelectedAssignPlanId("");
                        setShowPlanSelect(true);
                      }}
                      data-testid="button-assign-new-plan"
                    >
                      <Package className="h-3.5 w-3.5 mr-1" /> Asignar servicio o plan
                    </Button>
                  ) : (
                    renderAssignPlanPicker()
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground" data-testid="text-no-plan">Sin servicio o plan asignado</p>
                  {!showPlanSelect ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 sm:h-9"
                      onClick={() => {
                        setAssignmentStartDate(todayAssignmentDate);
                        setSelectedAssignPlanId("");
                        setShowPlanSelect(true);
                      }}
                      data-testid="button-assign-plan"
                    >
                      <Package className="h-3.5 w-3.5 mr-1" /> Asignar servicio o plan
                    </Button>
                  ) : (
                    renderAssignPlanPicker()
                  )}
                </div>
              )}
            </div>

            {openLeaseContracts.length > 0 ? (
              <div className="max-w-full rounded-md bg-muted/50 p-2.5 space-y-3 sm:p-3" data-testid="client-lease-contract">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Arrendamientos activos: {activeLeaseContractsCount}
                    </p>
                    <h4 className="mt-1 text-sm font-medium flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      Arrendamientos
                    </h4>
                  </div>
                </div>

                <div className="space-y-2">
                  {openLeaseContracts.map((leaseContract) => {
                    const leasePriceDisplay = getLeaseContractPriceDisplay(leaseContract);
                    return (
                      <div
                        key={leaseContract.id}
                        className="rounded-md border border-border/70 bg-background p-3"
                        data-testid={`client-lease-contract-${leaseContract.id}`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium">{leaseContract.leasedItemDescription}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {leaseContract.totalPaidInstallments}/{leaseContract.contractTermMonths} mensualidades pagadas
                            </p>
                            {leaseContract.notes ? (
                              <p className="mt-1 break-words text-[11px] text-muted-foreground">{leaseContract.notes}</p>
                            ) : null}
                          </div>
                          <Badge
                            variant={leaseDerivedStatusBadgeVariant(leaseContract.derivedStatus)}
                            className="self-start text-[10px]"
                            data-testid={`badge-lease-status-${leaseContract.id}`}
                          >
                            {leaseDerivedStatusLabel(leaseContract.derivedStatus)}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-muted-foreground mb-0.5">Inicio real</div>
                            <div className="font-medium">{formatDate(leaseContract.contractStartDate)}</div>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-muted-foreground mb-0.5">Final contractual</div>
                            <div className="font-medium">{formatDate(leaseContract.contractEndDate)}</div>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-muted-foreground mb-0.5">Precio mensual</div>
                            <div className="font-medium">{formatCurrencyMx(leasePriceDisplay.amountCents / 100)}</div>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-muted-foreground mb-0.5">Estado</div>
                            <div className="font-medium">{leaseDerivedStatusLabel(leaseContract.derivedStatus)}</div>
                          </div>
                        </div>

                        {onOpenLeaseContract ? (
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9"
                              onClick={() => {
                                onOpenChange(false);
                                onOpenLeaseContract({
                                  leaseContractId: leaseContract.id,
                                  clientUserId: profile.user.id,
                                });
                              }}
                              data-testid={`button-open-lease-contract-${leaseContract.id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Ver arrendamiento
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="max-w-full rounded-md bg-muted/50 p-2.5 space-y-2 sm:p-3">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Salud y emergencia
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={profile.user.parqAccepted ? "default" : "outline"}
                  className={`text-[10px] ${profile.user.parqAccepted ? "bg-green-600" : ""}`}
                  data-testid="badge-parq"
                >
                  PAR-Q {profile.user.parqAccepted ? "✓" : "pendiente"}
                </Badge>
                {profile.user.parqAccepted && profile.user.parqAcceptedDate && (
                  <span className="break-words text-[10px] text-muted-foreground">Firmado: {profile.user.parqAcceptedDate}</span>
                )}
              </div>
              {(profile.user.emergencyContactName || profile.user.emergencyContactPhone) && (
                <div className="break-words text-xs text-muted-foreground">
                  <span className="font-medium">Contacto emergencia:</span> {profile.user.emergencyContactName || ""} {profile.user.emergencyContactPhone ? `(${profile.user.emergencyContactPhone})` : ""}
                </div>
              )}
              {profile.user.medicalNotes && (
                <div className="break-words text-xs text-muted-foreground" data-testid="text-medical-notes">
                  <span className="font-medium">Notas médicas:</span> {profile.user.medicalNotes}
                </div>
              )}
              {profile.user.injuriesNotes && (
                <div className="break-words text-xs text-muted-foreground" data-testid="text-injuries-notes">
                  <span className="font-medium">Lesiones:</span> {profile.user.injuriesNotes}
                </div>
              )}
              {profile.user.medicalWarnings && (
                <div className="break-words text-xs text-muted-foreground" data-testid="text-medical-warnings">
                  <span className="font-medium">Advertencias:</span> {profile.user.medicalWarnings}
                </div>
              )}
              {!profile.user.emergencyContactName && !profile.user.emergencyContactPhone && !profile.user.medicalNotes && !profile.user.injuriesNotes && !profile.user.medicalWarnings && !profile.user.parqAccepted && (
                <p className="text-xs text-muted-foreground italic">Sin datos de salud registrados</p>
              )}
            </div>

            {showClientAccessSection && (
              <div className="space-y-2">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Acceso del cliente
                  </h4>
                  {canBranchManageClientAccess ? (
                    <div className="max-w-full rounded-md bg-muted p-2.5 text-sm space-y-1 sm:p-3">
                      <p className="break-all"><span className="font-medium">Estado:</span> {accessStatusLabel}</p>
                      <p className="break-all"><span className="font-medium">Proveedor:</span> {accessProviderLabel}</p>
                      <p className="break-all"><span className="font-medium">Usuario/email actual:</span> {displayClientEmail(normalizedAccessEmail)}</p>
                      <p className="break-words text-xs text-muted-foreground">{accessHelperText}</p>
                    </div>
                  ) : (
                    <div className="max-w-full rounded-md bg-muted p-2.5 text-sm sm:p-3">
                      <p className="break-words text-xs text-muted-foreground sm:text-sm">{accessHelperText}</p>
                    </div>
                  )}
                </div>
                {canBranchManageClientAccess && (canCopyAccessUser || accessPrimaryActionLabel) && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {canCopyAccessUser && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 sm:h-9"
                        onClick={handleCopyAccessUser}
                        data-testid="button-copy-client-access-user"
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copiar usuario
                      </Button>
                    )}
                    {accessPrimaryActionLabel && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-10 sm:h-9"
                        onClick={() => openAccessConfirmation(
                          canCreateClientAccess
                            ? "create"
                            : canVerifyLegacyClientAccess
                              ? "verifyLegacy"
                              : "reset",
                        )}
                        data-testid="button-open-client-access"
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5" />
                        {accessPrimaryActionLabel}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {profile.purchaseHistory && profile.purchaseHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Compras individuales recientes
                </h4>
                <div className="space-y-2">
                  {profile.purchaseHistory.map((purchase) => (
                    <div key={purchase.id} className="max-w-full rounded-md border bg-muted/30 p-2.5 sm:p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">{purchase.concept}</p>
                          <p className="break-words text-xs text-muted-foreground">
                            {formatDate(purchase.entryDate)} · {purchase.paymentMethod ? purchase.paymentMethod.replace(/_/g, " ") : "Método no especificado"}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600">
                          ${(purchase.amount || 0).toFixed(2)} MXN
                        </span>
                      </div>
                      {purchase.notes && (
                        <p className="mt-2 break-words text-xs text-muted-foreground">{purchase.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 rounded-md bg-muted/50 p-2.5 sm:p-3" data-testid="client-commercial-history">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Actividad comercial
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Historial de ventas comerciales completadas sin mezclar Caja ni compras individuales antiguas.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 w-full sm:w-auto"
                  onClick={() => {
                    setCommercialHistoryFilter("all");
                    setCommercialHistoryPage(1);
                  }}
                >
                  Historial completo
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <div className="rounded-md bg-background p-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total gastado</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrencyMx(commercialHistoryData.summary.totalSpentAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Ventas</p>
                  <p className="mt-1 text-sm font-semibold">{commercialHistoryData.summary.salesCount ?? 0}</p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Ticket promedio</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrencyMx(commercialHistoryData.summary.averageTicketAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Compras del mes</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrencyMx(commercialHistoryData.summary.currentMonthAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Última compra</p>
                  <p className="mt-1 text-sm font-semibold">
                    {commercialHistoryData.summary.lastPurchaseAt ? formatDate(commercialHistoryData.summary.lastPurchaseAt) : "Sin ventas"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "products", "services", "current_month"] as ClientCommercialHistoryFilter[]).map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    size="sm"
                    variant={commercialHistoryFilter === filter ? "default" : "outline"}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => {
                      setCommercialHistoryFilter(filter);
                      setCommercialHistoryPage(1);
                    }}
                  >
                    {getCommercialHistoryFilterLabel(filter)}
                  </Button>
                ))}
              </div>

              {commercialHistoryQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              ) : !commercialHistory || commercialHistory.items.length === 0 ? (
                <div className="rounded-md border border-dashed bg-background/70 p-4 text-center">
                  <p className="text-sm font-medium">Sin ventas comerciales todavía</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cuando este cliente compre productos o servicios desde Cobrar, aquí verás el detalle.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {commercialHistoryData.items.map((sale) => {
                    const paymentLine = sale.payments.length > 0
                      ? sale.payments.map((payment) => `${getSalePaymentMethodLabel(payment.paymentMethod)} ${formatCurrencyMx(payment.amount)}`).join(" · ")
                      : "Sin pagos registrados";
                    const totalUnits = sale.items.reduce((sum, item) => sum + item.quantity, 0);
                    const typeLabel = getCommercialItemKindLabel(sale.items);

                    return (
                      <div key={sale.saleId} className="rounded-md border bg-background/80 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{sale.folio}</p>
                              <Badge variant="secondary">{typeLabel}</Badge>
                            </div>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              {formatDateTime(sale.saleDate)} · {getSaleChannelLabel(sale.channel)}
                            </p>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              {sale.sellerName ? `Atendió ${sale.sellerName}` : "Sin vendedor"} · {paymentLine}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-semibold text-emerald-600">{formatCurrencyMx(sale.totalAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {totalUnits} unidades · Desc. {formatCurrencyMx(sale.discountAmount)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {sale.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="break-words text-sm font-medium">
                                  {item.quantity} × {item.nameSnapshot}
                                </p>
                                <p className="break-words text-xs text-muted-foreground">
                                  {item.categorySnapshot || "Sin categoría"} · {item.itemType === "commercial_product" ? "Producto" : "Servicio o plan"}
                                </p>
                              </div>
                              <div className="text-sm font-medium">
                                {formatCurrencyMx(item.lineTotalAmount)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            Pagado {formatCurrencyMx(sale.paidAmount)}
                          </span>
                          {sale.notes ? <span className="break-words">Nota: {sale.notes}</span> : null}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Página {commercialHistoryData.page} de {commercialHistoryPageCount} · {commercialHistoryData.total} venta{commercialHistoryData.total === 1 ? "" : "s"} en {getCommercialHistoryFilterLabel(commercialHistoryData.filter).toLowerCase()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => setCommercialHistoryPage((current) => Math.max(1, current - 1))}
                        disabled={commercialHistoryData.page <= 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => setCommercialHistoryPage((current) => current + 1)}
                        disabled={commercialHistoryData.page >= commercialHistoryPageCount}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                Notas internas ({profile.notes.length})
              </h4>
              <div className="mb-2.5 flex flex-col gap-2 sm:mb-3 sm:flex-row">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Agregar nota interna..."
                  className="min-h-[44px] text-sm sm:min-h-[50px]"
                  data-testid="client-note-add"
                />
                <Button
                  size="sm"
                  className="h-10 w-full shrink-0 self-stretch sm:h-9 sm:w-auto sm:self-end"
                  onClick={() => noteContent.trim() && noteMutation.mutate(noteContent.trim())}
                  disabled={noteMutation.isPending || !noteContent.trim()}
                  data-testid="button-add-note"
                >
                  {noteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="space-y-0" data-testid="client-notes-list">
                {profile.notes.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sin notas registradas</p>
                )}
                {(showAllNotes ? profile.notes : profile.notes.slice(0, 10)).map((note, idx) => (
                  <div key={note.id} className="relative pl-4 pb-3" data-testid={`note-${note.id}`}>
                    <div className="absolute left-[5px] top-[6px] w-1.5 h-1.5 rounded-full bg-primary" />
                    {idx < (showAllNotes ? profile.notes.length : Math.min(profile.notes.length, 10)) - 1 && (
                      <div className="absolute left-[7px] top-[14px] bottom-0 w-px bg-border" />
                    )}
                    <div className="mb-0.5 break-words text-[10px] text-muted-foreground">
                      {formatDateTime(note.createdAt)} — {note.createdByName || "Admin"}
                    </div>
                    <p className="break-words text-sm leading-snug">{note.content}</p>
                  </div>
                ))}
                {profile.notes.length > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs w-full"
                    onClick={() => setShowAllNotes(!showAllNotes)}
                    data-testid="button-show-all-notes"
                  >
                    {showAllNotes ? "Mostrar menos" : `Ver todas (${profile.notes.length})`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se encontró el perfil del cliente.</p>
        )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog
      open={accessConfirmationOpen}
      onOpenChange={(nextOpen) => {
        if (isAccessMutationPending) return;
        setAccessConfirmationOpen(nextOpen);
        if (!nextOpen) {
          setPendingAccessAction(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingAccessAction === "create"
              ? "Crear acceso a la app"
              : pendingAccessAction === "verifyLegacy"
                ? "Verificar y restablecer acceso"
              : "Restablecer contrasena"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingAccessAction === "create"
              ? "Se generara una contrasena temporal para este cliente. La contrasena se mostrara una sola vez y deberas compartirla de forma segura."
              : pendingAccessAction === "verifyLegacy"
                ? "Esta es una cuenta historica. Al continuar, WebCool confirmara que esta sucursal administra su acceso y generara una nueva contrasena temporal. La contrasena anterior dejara de funcionar."
              : "Se generara una nueva contrasena temporal. La contrasena anterior dejara de funcionar."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isAccessMutationPending}
            data-testid="button-cancel-client-access-confirmation"
          >
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            onClick={() => {
              void handleConfirmClientAccessAction();
            }}
            disabled={isAccessMutationPending}
            data-testid="button-confirm-client-access-action"
          >
            {isAccessMutationPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {pendingAccessAction === "create"
              ? "Confirmar y crear acceso"
              : pendingAccessAction === "verifyLegacy"
                ? "Confirmar verificacion"
                : "Confirmar y restablecer"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Dialog
      open={accessDialogOpen}
      onOpenChange={(nextOpen) => {
        setAccessDialogOpen(nextOpen);
        if (!nextOpen) {
          setPendingAccessAction(null);
          setAccessCredentialResult(null);
        }
      }}
    >
      <DialogContent className="z-[130] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pendingAccessAction === "create"
              ? "Acceso creado correctamente"
              : pendingAccessAction === "verifyLegacy"
                ? "Acceso historico verificado"
              : "Contrasena temporal generada"}
          </DialogTitle>
          <DialogDescription>
            Consulta el usuario actual y genera una nueva contraseña temporal solo cuando sea necesario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="break-all">
              <span className="font-medium">Estado:</span> {accessStatusLabel}
            </p>
            <p className="break-all">
              <span className="font-medium">Proveedor:</span> {accessProviderLabel}
            </p>
            <p className="break-all">
              <span className="font-medium">Usuario/email actual:</span> {displayClientEmail(normalizedAccessEmail)}
            </p>
            <p className="mt-2 break-words text-xs text-muted-foreground">{accessHelperText}</p>
          </div>

          {!accessCredentialResult && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyAccessUser}
              disabled={!canCopyAccessUser}
              data-testid="button-copy-client-access-user-dialog"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar usuario
            </Button>
            {canCreateClientAccess ? (
              <Button
                type="button"
                onClick={handleCreateClientAccess}
                disabled={isAccessMutationPending}
                data-testid="button-create-client-access"
              >
                {isAccessMutationPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Crear acceso a la app
              </Button>
            ) : null}
            {canVerifyLegacyClientAccess ? (
              <Button
                type="button"
                onClick={handleVerifyLegacyClientAccess}
                disabled={isAccessMutationPending}
                data-testid="button-verify-legacy-client-access"
              >
                {isAccessMutationPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Verificar y restablecer acceso
              </Button>
            ) : null}
            {canResetClientAccess ? (
            <Button
              type="button"
              onClick={handleResetClientAccess}
              disabled={isAccessMutationPending}
              data-testid="button-reset-client-password"
            >
              {isAccessMutationPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Restablecer contraseña
            </Button>
            ) : null}
          </div>
          )}

          {accessCredentialResult && (
            <div className="space-y-3">
              <div className="rounded-md border bg-background p-3 font-mono text-sm" data-testid="box-client-reset-access">
                <p><span className="font-sans font-medium">Usuario (email):</span> {accessCredentialResult.email}</p>
                <p><span className="font-sans font-medium">Contrasena temporal:</span> {accessCredentialResult.temporaryPassword}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta contrasena se muestra solo ahora. Las sesiones anteriores del cliente dejaron de ser validas.
                {accessCredentialResult.mustChangePasswordOnLogin ? " El cliente debera cambiarla al iniciar sesion." : ""}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyTemporaryAccess}
                  data-testid="button-copy-client-reset-access"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar acceso
                </Button>
                <Button
                  type="button"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={handleShareTemporaryAccess}
                  disabled={!profile?.user.phone}
                  data-testid="button-share-client-reset-access"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar acceso por WhatsApp
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAccessDialogOpen(false);
              setAccessCredentialResult(null);
            }}
            data-testid="button-close-client-access"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function AlertMiniRow({
  title,
  subtitle,
  phone,
  onView,
  onWhatsApp,
}: {
  title: string;
  subtitle: string;
  phone: string | null | undefined;
  onView: () => void;
  onWhatsApp: () => void;
}) {
  return (
    <div className="flex max-w-full min-w-0 flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{title}</p>
        <p className="break-words text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:items-center">
        <Button variant="outline" size="sm" className="h-8 w-full rounded-xl px-3 text-xs md:w-auto" onClick={onView}>
          Ver cliente
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full rounded-xl px-3 text-xs text-green-600 hover:text-green-700 md:w-auto"
          onClick={onWhatsApp}
          disabled={!phone}
        >
          <MessageCircle className="mr-1 h-3.5 w-3.5" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}

function ClientAlertsHub({
  branchName,
  alerts,
  loading,
  recentAppClients,
  onViewClient,
}: {
  branchName: string;
  alerts: AlertsData | undefined;
  loading: boolean;
  recentAppClients: BranchClient[];
  onViewClient: (userId: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const alertsData: AlertsData = alerts ?? {
    expiringMemberships: [],
    expiredMemberships: [],
    inactiveClients: [],
    clientsWithoutClasses: [],
    upcomingBirthdays: [],
  };

  const sections = [
    {
      key: "app",
      title: "🆕 Nuevos desde la app",
      description: "Clientes recientes que llegaron por auto-registro o invitación.",
      count: recentAppClients.length,
      items: recentAppClients.map((client) => ({
        id: client.userId,
        title: displayName(client.name, client.lastName),
        subtitle: `Alta ${formatDate(client.joinedAt)} · ${clientOriginLabel(client.identityControl, client.userId, "alerts-app")}`,
        phone: client.phone,
        onView: () => onViewClient(client.userId),
        onWhatsApp: () => openWaLink(client.phone, buildClientAlertMessage("app", { firstName: client.name, branchName, planName: null, expiresAt: null })),
      })),
    },
    {
      key: "expiring",
      title: "⚠️ Planes por vencer",
      description: "Conviene escribirles antes de que pierdan continuidad.",
      count: alertsData.expiringMemberships.length || 0,
      items: alertsData.expiringMemberships.map((item) => ({
        id: item.membershipId,
        title: displayName(item.name, item.lastName),
        subtitle: `${item.planName || "Sin plan"} · Vence ${formatDate(item.expiresAt)}`,
        phone: item.phone,
        onView: () => onViewClient(item.userId),
        onWhatsApp: () => openWaLink(item.phone, buildClientAlertMessage("expiring", {
          firstName: item.name,
          branchName,
          planName: item.planName,
          expiresAt: formatDate(item.expiresAt),
        })),
      })),
    },
    {
      key: "expired",
      title: "Planes vencidos sin renovación",
      description: "Clientes que ya vencieron y pueden reactivarse con seguimiento.",
      count: alertsData.expiredMemberships.length || 0,
      items: alertsData.expiredMemberships.map((item) => ({
        id: item.membershipId,
        title: displayName(item.name, item.lastName),
        subtitle: `${item.planName || "Sin plan"} · Venció ${formatDate(item.expiresAt)}`,
        phone: item.phone,
        onView: () => onViewClient(item.userId),
        onWhatsApp: () => openWaLink(item.phone, buildClientAlertMessage("expired", {
          firstName: item.name,
          branchName,
          planName: item.planName,
          expiresAt: formatDate(item.expiresAt),
        })),
      })),
    },
    {
      key: "birthdays",
      title: "Próximos cumpleaños",
      description: "Ideal para reactivar con un mensaje simple y personal.",
      count: alertsData.upcomingBirthdays.length || 0,
      items: alertsData.upcomingBirthdays.map((item) => ({
        id: item.membershipId,
        title: displayName(item.name, item.lastName),
        subtitle: `Cumple ${formatDate(item.birthDate)}`,
        phone: item.phone,
        onView: () => onViewClient(item.userId),
        onWhatsApp: () => openWaLink(item.phone, buildClientAlertMessage("birthday", { firstName: item.name, branchName, planName: null, expiresAt: null })),
      })),
    },
    {
      key: "inactive",
      title: "😴 Clientes inactivos",
      description: "No han vuelto en un periodo largo y vale la pena retomarlos.",
      count: alertsData.inactiveClients.length || 0,
      items: alertsData.inactiveClients.map((item) => ({
        id: item.membershipId,
        title: displayName(item.name, item.lastName),
        subtitle: `Última actividad ${formatDate(item.lastAttendance || item.joinedAt)}`,
        phone: item.phone,
        onView: () => onViewClient(item.userId),
        onWhatsApp: () => openWaLink(item.phone, buildClientAlertMessage("inactive", { firstName: item.name, branchName, planName: null, expiresAt: null })),
      })),
    },
    {
      key: "no_classes",
      title: "🎟 Sin usos disponibles",
      description: "Clientes que ya consumieron sus usos y están listos para continuar.",
      count: alertsData.clientsWithoutClasses.length || 0,
      items: alertsData.clientsWithoutClasses.map((item) => ({
        id: item.membershipId,
        title: displayName(item.name, item.lastName),
        subtitle: `${item.planName || "Sin plan"} · 0/${item.classesTotal ?? ""} usos`,
        phone: item.phone,
        onView: () => onViewClient(item.userId),
        onWhatsApp: () => openWaLink(item.phone, buildClientAlertMessage("no_classes", { firstName: item.name, branchName, planName: null, expiresAt: null })),
      })),
    },
  ].filter((section) => section.count > 0);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Clientes PRO</p>
            <h3 className="text-lg font-semibold">Alertas y seguimiento</h3>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Revisa altas recientes, cumpleaños, vencimientos e inactividad sin salir de Clientes.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">Sin alertas relevantes por ahora</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando entren clientes nuevos, próximos vencimientos o cumpleaños, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {sections.map((section) => {
              const expanded = expandedSections[section.key] ?? false;
              const visibleItems = expanded ? section.items : section.items.slice(0, 3);

              return (
                <div key={section.key} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-background text-muted-foreground">
                          {section.key === "app" && <UserPlus className="h-4 w-4" />}
                          {section.key === "expiring" && <AlertTriangle className="h-4 w-4" />}
                          {section.key === "expired" && <XCircle className="h-4 w-4" />}
                          {section.key === "birthdays" && <Calendar className="h-4 w-4" />}
                          {section.key === "inactive" && <Heart className="h-4 w-4" />}
                          {section.key === "no_classes" && <Hash className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold">{alertSectionLabel(section.key)}</h4>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{section.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{section.count}</Badge>
                      {section.count > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-xl px-3 text-xs"
                          onClick={() =>
                            setExpandedSections((current) => ({
                              ...current,
                              [section.key]: !expanded,
                            }))
                          }
                        >
                          {expanded ? "Ver menos" : "Ver todos"}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {visibleItems.map((item) => (
                      <AlertMiniRow
                        key={`${section.key}-${item.id}`}
                        title={item.title}
                        subtitle={item.subtitle}
                        phone={item.phone}
                        onView={item.onView}
                        onWhatsApp={item.onWhatsApp}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClientesTab({
  focusRequest,
  onOpenLeaseContract,
}: {
  focusRequest?: ClientFocusRequest | null;
  onOpenLeaseContract?: (target: LeaseContractNavigationTarget) => void;
} = {}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const branchName = ((user?.branch as any)?.name ?? "");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ClientFilterKey>("with_plan");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [waTarget, setWaTarget] = useState<WaModalTarget | null>(null);

  const { data: clients = [], isLoading } = useQuery<BranchClient[]>({
    queryKey: ["/api/branch/clients"],
  });
  const { data: alerts = {
    expiringMemberships: [],
    expiredMemberships: [],
    inactiveClients: [],
    clientsWithoutClasses: [],
    upcomingBirthdays: [],
  }, isLoading: alertsLoading } = useQuery<AlertsData>({
    queryKey: ["/api/branch/alerts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/branch/clients/${clientId}`);
    },
    onSuccess: async (_data, deletedClientId) => {
      await invalidateBranchMembershipQueries(deletedClientId);
      toast({ title: "Cliente eliminado" });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al eliminar", variant: "destructive" });
    },
  });

  const expiringIds = useMemo(
    () => new Set((alerts.expiringMemberships || []).map((item) => item.userId)),
    [alerts],
  );
  const expiredIds = useMemo(
    () => new Set((alerts.expiredMemberships || []).map((item) => item.userId)),
    [alerts],
  );
  const recentAppClients = useMemo(() => {
    const now = Date.now();
    return clients
      .filter((client) => isAppJoinedClient(client))
      .filter((client) => now - new Date(client.joinedAt).getTime() <= 14 * 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
  }, [clients]);

  const baseClients = useMemo(() => clients, [clients]);
  const clientsByFilter = useMemo(() => {
    return baseClients.filter((client) => {
      if (activeFilter === "with_plan") return hasActiveServiceOrPlan(client);
      if (activeFilter === "without_plan") return !hasActiveServiceOrPlan(client);
      if (activeFilter === "individual_purchases") return hasIndividualPurchases(client);
      if (activeFilter === "app_joined") return isAppJoinedClient(client);
      if (activeFilter === "expiring") return expiringIds.has(client.userId);
      if (activeFilter === "expired") return expiredIds.has(client.userId);
      return true;
    });
  }, [activeFilter, baseClients, expiringIds, expiredIds]);

  const filteredClients = useMemo(() => {
    return clientsByFilter.filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const full = displayName(c.name, c.lastName).toLowerCase();
      const tagText = (c.tags || "").toLowerCase();
      const crmStatusText = crmStatusLabel(c.crmClientStatus).toLowerCase();
      return (
        full.includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        tagText.includes(q) ||
        crmStatusText.includes(q)
      );
    });
  }, [clientsByFilter, search]);

  const filterOptions: Array<{ key: ClientFilterKey; label: string; count: number }> = [
    { key: "with_plan", label: "Con servicio o plan", count: baseClients.filter((client) => hasActiveServiceOrPlan(client)).length },
    { key: "without_plan", label: "Sin servicio o plan", count: baseClients.filter((client) => !hasActiveServiceOrPlan(client)).length },
    { key: "individual_purchases", label: "Compras individuales", count: baseClients.filter((client) => hasIndividualPurchases(client)).length },
    { key: "app_joined", label: "Nuevos desde la app", count: baseClients.filter((client) => isAppJoinedClient(client)).length },
    { key: "expiring", label: "Por vencer", count: expiringIds.size },
    { key: "expired", label: "Vencidos", count: expiredIds.size },
    { key: "all", label: "Todos", count: baseClients.length },
  ];

  function openProfile(userId: string) {
    setSelectedClientId(userId);
    setShowProfileDialog(true);
  }

  useEffect(() => {
    if (!focusRequest?.userId) {
      return;
    }

    openProfile(focusRequest.userId);
  }, [focusRequest?.nonce, focusRequest?.userId]);

  function openEdit(userId: string) {
    setEditClientId(userId);
    setShowEditDialog(true);
  }

  function openDelete(userId: string, name: string) {
    setDeleteTarget({ id: userId, name });
  }

  async function handleExportClientsPdf() {
    try {
      setIsExportingPdf(true);
      await downloadAuthenticatedFile("/api/branch/clients/export.pdf", "clientes.pdf");
    } catch (error) {
      toast({
        title: "No se pudo exportar el PDF",
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      <ClientAlertsHub
        branchName={branchName}
        alerts={alerts}
        loading={alertsLoading}
        recentAppClients={recentAppClients}
        onViewClient={openProfile}
      />

      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Lo que pasa con tus clientes</p>
              <h3 className="text-lg font-semibold">Todos tus clientes en un solo lugar</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Filtra por actividad comercial, origen o vencimiento para dar seguimiento sin perder contexto.
              </p>
            </div>
            <div className="-mx-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
              <div className="flex w-max gap-2 lg:w-auto lg:flex-wrap">
                {filterOptions.map((filter) => (
                  <Button
                    key={filter.key}
                    variant={activeFilter === filter.key ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => setActiveFilter(filter.key)}
                    data-testid={`button-client-filter-${filter.key}`}
                  >
                    {filter.label}
                    <Badge
                      variant={activeFilter === filter.key ? "secondary" : "outline"}
                      className="ml-2 rounded-full px-1.5 py-0 text-[10px]"
                    >
                      {filter.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono..."
            className="pl-9"
            data-testid="input-search-clients"
          />
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center md:w-auto"
            onClick={() => {
              const link = document.createElement("a");
              link.href = "/api/branch/clients/export";
              link.download = "clientes.csv";
              link.click();
            }}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center md:w-auto"
            onClick={handleExportClientsPdf}
            disabled={isExportingPdf}
          >
            {isExportingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-center md:w-auto" onClick={() => setShowInviteDialog(true)} data-testid="button-invite-client">
            <Link2 className="h-4 w-4 mr-1" />
            Invitar
          </Button>
          <Button size="sm" className="w-full justify-center md:w-auto" onClick={() => setShowCreateDialog(true)} data-testid="button-create-client">
            <UserPlus className="h-4 w-4 mr-1" />
            Crear cliente
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="text-center py-12" data-testid="empty-clients">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">
                {search ? "Sin resultados" : "Sin clientes"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {search
                  ? `No se encontraron clientes con "${search}"`
                  : "Agrega tu primer cliente o comparte el link de invitación."}
              </p>
              {!search && (
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)} data-testid="button-empty-invite">
                    <Link2 className="h-4 w-4 mr-1" />
                    Invitar
                  </Button>
                  <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-empty-create">
                    <UserPlus className="h-4 w-4 mr-1" />
                    Crear cliente
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filteredClients.map((client) => {
            const clientTags = parseTags(client.tags);
            return (
              <Card
              key={client.userId}
              className="cursor-pointer border-border/70 transition-colors hover:bg-muted/40"
              onClick={() => openProfile(client.userId)}
              data-testid={`card-client-${client.userId}`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <ClientAvatar avatarUrl={client.avatarUrl} name={client.name} lastName={client.lastName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate" data-testid={`text-client-name-${client.userId}`}>
                        {displayName(client.name, client.lastName)}
                      </p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {clientOriginLabel(client.identityControl, client.userId, "client-card")}
                      </Badge>
                      <Badge
                        variant={clientStatusVariant(client.clientStatus)}
                        className="text-[10px] px-1.5 py-0"
                        data-testid={`badge-client-status-${client.userId}`}
                      >
                        {clientStatusLabel(client.clientStatus)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${crmStatusBadgeClass(client.crmClientStatus)}`}
                        data-testid={`badge-client-crm-status-${client.userId}`}
                      >
                        CRM {crmStatusLabel(client.crmClientStatus)}
                      </Badge>
                      {client.isLocallyBlocked && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-red-200 bg-red-50 text-red-700"
                          data-testid={`badge-client-local-block-${client.userId}`}
                        >
                          Bloqueado local
                        </Badge>
                      )}
                      {isBirthdayToday(client.birthDate) && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[10px] text-pink-700 font-medium bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 dark:hover:bg-pink-950/60 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800 transition-colors"
                          onClick={() => openProfile(client.userId)}
                          data-testid={`badge-birthday-${client.userId}`}
                        >
                          🎂 Hoy cumple
                        </button>
                      )}
                      {client.hasDebt && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 font-medium" data-testid={`badge-debt-${client.userId}`}>
                          <DollarSign className="h-3 w-3" />
                          Adeudo
                        </span>
                      )}
                      {client.individualPurchaseCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
                          data-testid={`badge-individual-purchases-${client.userId}`}
                        >
                          {client.individualPurchaseCount} compra{client.individualPurchaseCount === 1 ? "" : "s"} individual{client.individualPurchaseCount === 1 ? "" : "es"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-col gap-1 text-xs text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-2">
                      <span className="break-all">{displayClientEmail(client.email)}</span>
                      {client.phone && <span className="break-all">{client.phone}</span>}
                      <span>Cliente desde {formatDate(client.joinedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {client.planName ? (
                        <>
                          <Badge
                            variant={client.planStatus === "expired" ? "destructive" : client.planStatus === "deleted" ? "outline" : "outline"}
                            className={`text-[10px] px-1.5 py-0 ${client.planStatus === "deleted" ? "border-orange-400 text-orange-600" : ""}`}
                            data-testid={`badge-plan-${client.userId}`}
                          >
                            {client.planStatus === "deleted" ? "Servicio o plan eliminado" : getClientCommercialLabel(client)}
                          </Badge>
                          {client.planStatus !== "deleted" && (
                            <>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid={`badge-cycle-${client.userId}`}>
                                {cycleLabel(client.cycleMonths)}
                              </Badge>
                              {client.classesRemaining !== null && client.classesTotal !== null ? (
                                <span className="text-[10px] text-muted-foreground" data-testid={`text-classes-${client.userId}`}>
                                  {client.classesRemaining}/{client.classesTotal} usos
                                </span>
                              ) : client.classesRemaining === null && client.classesTotal === null ? (
                                <span className="text-[10px] text-muted-foreground">Uso ilimitado</span>
                              ) : null}
                              {client.expiresAt && (
                                <span className={`text-[10px] ${client.planStatus === "expired" ? "text-red-500 font-medium" : "text-muted-foreground"}`} data-testid={`text-expires-${client.userId}`}>
                                  {getPlanTimingLabel(client)}
                                </span>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground" data-testid={`text-no-plan-${client.userId}`}>Sin servicio o plan activo</span>
                      )}
                      {client.lastIndividualPurchaseAt && (
                        <span className="text-[10px] text-muted-foreground" data-testid={`text-last-purchase-${client.userId}`}>
                          Última compra {formatDate(client.lastIndividualPurchaseAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground md:hidden">
                      Última visita: {getLastActivityLabel(client)}
                    </div>
                    {clientTags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {clientTags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`badge-client-tag-${client.userId}`}>
                            #{tag}
                          </Badge>
                        ))}
                        {clientTags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{clientTags.length - 3} mas</span>
                        )}
                      </div>
                    )}
                    {client.reportCount > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1" data-testid={`text-client-report-count-${client.userId}`}>
                        {client.reportCount} incidencia{client.reportCount === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full rounded-xl px-3 text-xs md:w-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProfile(client.userId);
                      }}
                    >
                      Ver cliente
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full rounded-xl px-3 text-xs text-green-600 hover:text-green-700 md:w-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWaTarget({ name: client.name, lastName: client.lastName, phone: client.phone, expiresAt: client.expiresAt, classesRemaining: client.classesRemaining, classesTotal: client.classesTotal, planName: client.planName });
                      }}
                      data-testid={`button-wa-client-${client.userId}`}
                    >
                      <MessageCircle className="mr-1 h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden h-8 rounded-xl px-3 text-xs md:inline-flex"
                      onClick={(e) => { e.stopPropagation(); openEdit(client.userId); }}
                      data-testid={`button-edit-client-${client.userId}`}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden h-8 rounded-xl px-3 text-xs text-red-500 hover:text-red-700 md:inline-flex"
                      onClick={(e) => { e.stopPropagation(); openDelete(client.userId, displayName(client.name, client.lastName)); }}
                      data-testid={`button-delete-client-${client.userId}`}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-full rounded-xl px-3 text-xs md:hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
                          Más
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(client.userId);
                          }}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(client.userId, displayName(client.name, client.lastName));
                          }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="hidden xl:flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      Ultima visita: {getLastActivityLabel(client)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Desde {formatDate(client.joinedAt)}
                    </span>
                  </div>
                </div>
              </CardContent>
              </Card>
            );
          })}
          <p className="text-xs text-muted-foreground text-center pt-2" data-testid="text-clients-total">
            {filteredClients.length} cliente{filteredClients.length !== 1 ? "s" : ""} en la vista actual
          </p>
        </div>
      )}

      <CreateClientDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onOpenExisting={openProfile} />
      <InviteLinkDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} />
      <EditClientDialog key={editClientId} clientId={editClientId} open={showEditDialog} onOpenChange={setShowEditDialog} />
      <ClientProfileDialog
        clientId={selectedClientId}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onEdit={openEdit}
        onDelete={openDelete}
        onWhatsApp={setWaTarget}
        onOpenLeaseContract={onOpenLeaseContract}
      />
      <WhatsAppModal target={waTarget} branchName={branchName} onClose={() => setWaTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará el servicio o plan de <strong>{deleteTarget?.name ?? ""}</strong>. El cliente dejará de aparecer en la lista. Esta acción se puede revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
