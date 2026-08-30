import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartPie,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  LockKeyhole,
  Pencil,
  PiggyBank,
  Plus,
  Repeat,
  ReceiptText,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import {
  branchFinanceExpenseCategories,
  branchFinanceIncomeCategories,
  branchFinancePaymentMethodValues,
  branchRecurringExpenseCategoryValues,
  branchRecurringExpenseFrequencyValues,
} from "@shared/schema";
import { isProtectedFinanceSource } from "@shared/finance-source";
import { apiRequest } from "@/lib/queryClient";
import { downloadAuthenticatedFile } from "@/lib/download-file";
import {
  invalidateBranchCommercialQueries,
  invalidateBranchFinanceQueries,
  invalidateBranchRecurringExpenseQueries,
  invalidateBranchStaffFinanceQueries,
  invalidateBranchStaffQueries,
} from "@/lib/branch-dashboard-cache";
import { useToast } from "@/hooks/use-toast";
import { useHorizontalScrollNav } from "@/hooks/use-horizontal-scroll-nav";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";

type FinanceEntryType = "income" | "expense";
type RangePreset = "thirty_days" | "ninety_days" | "six_months" | "twelve_months" | "all" | "custom" | "calendar_month";
type CalendarMonthOffset = 0 | 1 | 2;
type CalendarComparisonSpan = 1 | 2 | 3;

interface BranchFinanceFiscalSnapshot {
  taxMode: "tax_included" | "tax_added" | "tax_exempt";
  taxRate: number;
  baseBeforeTax: number;
  taxTransferred: number;
  totalCharged: number;
}

interface BranchFinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  todayIncome: number;
  todayExpense: number;
  monthIncome: number;
  monthExpense: number;
  incomeBaseBeforeTax: number;
  incomeTransferredTax: number;
  dailyBreakdown: Array<{ date: string; income: number; expense: number; net: number }>;
  topIncomeCategories: Array<{ category: string; total: number }>;
  topExpenseCategories: Array<{ category: string; total: number }>;
}

interface BranchFinanceEntry {
  id: string;
  branchId: string;
  type: FinanceEntryType;
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
  fiscalSnapshot: BranchFinanceFiscalSnapshot | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FinanceEntriesResponse {
  items: BranchFinanceEntry[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

interface BranchClient {
  userId: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

interface FinanceFormState {
  type: FinanceEntryType;
  category: string;
  concept: string;
  amount: string;
  paymentMethod: string;
  clientUserId: string;
  clientName: string;
  notes: string;
  entryDate: string;
}

interface BranchRecurringExpense {
  id: string;
  branchId: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  paymentDay: number | null;
  notes: string | null;
  isActive: boolean;
  lastRegisteredAt: string | null;
}

interface RecurringExpenseFormState {
  name: string;
  category: string;
  amount: string;
  frequency: string;
  paymentDay: string;
  notes: string;
  isActive: boolean;
}

interface BranchStaffMember {
  id: string;
  branchId: string;
  name: string;
  phone: string | null;
  payPerClass: number;
  notes: string | null;
  isActive: boolean;
}

interface StaffFormState {
  name: string;
  phone: string;
  payPerClass: string;
  notes: string;
  isActive: boolean;
}

interface BranchStaffClassLog {
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
}

type CajaFocusRequest = {
  source: "commercial_sale" | "sales_commission_payment";
  sourceId: string;
  nonce: number;
};

interface BranchSaleDetail {
  id: string;
  folio: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  clientEmail: string | null;
  sellerId: string | null;
  sellerNameSnapshot: string | null;
  channel: string;
  status: string;
  taxMode: "tax_included" | "tax_added" | "tax_exempt" | null;
  taxRate: number | null;
  subtotalAmount: number;
  subtotalBeforeTax: number | null;
  discountAmount: number;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    itemType: string;
    nameSnapshot: string;
    categorySnapshot: string | null;
    quantity: number;
    unitPriceAmount: number;
    discountAmount: number;
    costAmountSnapshot: number;
    lineTotalAmount: number;
  }>;
  payments: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    reference: string | null;
    paidAt: string;
  }>;
}

interface BranchCommissionPaymentDetail {
  id: string;
  salespersonId: string;
  salespersonName: string | null;
  amount: number;
  totalAllocatedAmount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
  allocations?: Array<{
    id: string;
    commissionAccrualId: string;
    amountAllocated: number;
    createdAt: string;
  }>;
}

interface StaffClassLogFormState {
  staffId: string;
  classesCount: string;
  classDate: string;
  paymentMethod: string;
  notes: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  otro: "Otro",
};

const CATEGORY_LABELS: Record<string, string> = {
  membresia: "Membresía",
  paquete: "Paquete",
  servicio: "Servicio",
  producto: "Producto",
  clase: "Clase",
  renta: "Renta",
  luz: "Luz",
  agua: "Agua",
  internet: "Internet",
  productos: "Productos",
  insumos: "Insumos",
  sueldos: "Sueldos",
  secretaria: "Secretaria",
  enfermera: "Enfermera",
  limpieza: "Limpieza",
  profesor: "Profesor",
  nomina: "Nómina",
  mantenimiento: "Mantenimiento",
  publicidad: "Publicidad",
  otro: "Otro",
};

function getBranchSaleFiscalSnapshot(sale: BranchSaleDetail) {
  return {
    taxMode: sale.taxMode ?? "tax_exempt",
    taxRate: sale.taxRate ?? 0,
    subtotalBeforeTax: sale.subtotalBeforeTax ?? sale.subtotalAmount,
    taxableSubtotal: sale.taxableSubtotal ?? Math.max(0, sale.totalAmount),
    taxTotal: sale.taxTotal ?? 0,
    grandTotal: sale.grandTotal ?? sale.totalAmount,
  };
}

function getBranchSaleTaxModeLabel(taxMode: BranchSaleDetail["taxMode"]) {
  switch (taxMode) {
    case "tax_included":
      return "Precio incluye IVA";
    case "tax_added":
      return "Agregar IVA al precio";
    case "tax_exempt":
    default:
      return "Sin IVA";
  }
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Mensual",
  weekly: "Semanal",
  biweekly: "Quincenal",
  one_time: "Único",
};

const SOURCE_LABELS: Record<string, string> = {
  fixed_expense: "Gasto fijo",
  membership_assign: "Membresía",
  membership_renew: "Renovación",
  service_sale: "Cobro rápido",
  staff_class_log: "Trabajo registrado",
  commercial_sale: "Venta comercial",
  commercial_sale_cancellation: "Cancelación de venta",
  sales_commission_payment: "Pago de comisión",
  lease_installment_payment: "Mensualidad de arrendamiento",
};

const ALL_CATEGORY_OPTIONS = Array.from(
  new Set([...branchFinanceIncomeCategories, ...branchFinanceExpenseCategories]),
);

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

function getTodayDateString() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function getQuickRange(preset: Exclude<RangePreset, "custom">) {
  if (preset === "all") {
    return { from: "", to: "" };
  }

  if (preset === "thirty_days") {
    return getLastNDaysRange(30);
  }

  if (preset === "ninety_days") {
    return getLastNDaysRange(90);
  }

  const today = new Date(`${getTodayDateString()}T12:00:00`);
  const to = today.toLocaleDateString("en-CA");
  const fromDate = new Date(today);

  if (preset === "six_months") {
    fromDate.setMonth(fromDate.getMonth() - 6);
    fromDate.setDate(fromDate.getDate() + 1);
    return { from: fromDate.toLocaleDateString("en-CA"), to };
  }

  fromDate.setMonth(fromDate.getMonth() - 12);
  fromDate.setDate(fromDate.getDate() + 1);
  return { from: fromDate.toLocaleDateString("en-CA"), to };
}

function getLastNDaysRange(days: number) {
  const today = new Date(`${getTodayDateString()}T12:00:00`);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  return {
    from: fromDate.toLocaleDateString("en-CA"),
    to: today.toLocaleDateString("en-CA"),
  };
}

function getCurrentMonthRange() {
  const today = getTodayDateString();
  return {
    from: `${today.slice(0, 7)}-01`,
    to: today,
  };
}

function getPreviousMonthRange() {
  const today = new Date(`${getTodayDateString()}T12:00:00`);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    from: previousMonthStart.toLocaleDateString("en-CA"),
    to: previousMonthEnd.toLocaleDateString("en-CA"),
  };
}

function getCalendarMonthRange(offset: CalendarMonthOffset, span: CalendarComparisonSpan) {
  const today = new Date(`${getTodayDateString()}T12:00:00`);
  const endMonthDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
  const startMonthDate = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth() - (span - 1), 1);
  const endDate = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth() + 1, 0);
  return {
    from: startMonthDate.toLocaleDateString("en-CA"),
    to: endDate.toLocaleDateString("en-CA"),
  };
}

function buildSummaryUrl(from: string, to: string, typeFilter?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
  return `/api/branch/finance/summary?${params.toString()}`;
}

function buildEntriesUrl(filters: {
  from: string;
  to: string;
  typeFilter: string;
  categoryFilter: string;
  clientFilter: string;
  search: string;
  page: number;
  limit: number;
}) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.typeFilter && filters.typeFilter !== "all") params.set("type", filters.typeFilter);
  if (filters.categoryFilter && filters.categoryFilter !== "all") params.set("category", filters.categoryFilter);
  if (filters.clientFilter && filters.clientFilter !== "all") params.set("clientId", filters.clientFilter);
  if (filters.search.trim()) params.set("q", filters.search.trim());
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));
  return `/api/branch/finance/entries?${params.toString()}`;
}

function buildExportUrl(from: string, to: string, typeFilter: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
  return `/api/branch/finance/export.csv?${params.toString()}`;
}

function buildExportPdfUrl(from: string, to: string, typeFilter: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
  return `/api/branch/finance/export.pdf?${params.toString()}`;
}

function scrollSectionIntoView(ref: RefObject<HTMLDivElement | null>) {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function getFormCategories(type: FinanceEntryType) {
  return type === "income" ? branchFinanceIncomeCategories : branchFinanceExpenseCategories;
}

function createInitialFormState(): FinanceFormState {
  return {
    type: "income",
    category: "membresia",
    concept: "",
    amount: "",
    paymentMethod: "efectivo",
    clientUserId: "",
    clientName: "",
    notes: "",
    entryDate: getTodayDateString(),
  };
}

function createInitialRecurringExpenseFormState(): RecurringExpenseFormState {
  return {
    name: "",
    category: "renta",
    amount: "",
    frequency: "monthly",
    paymentDay: "",
    notes: "",
    isActive: true,
  };
}

function createInitialStaffFormState(): StaffFormState {
  return {
    name: "",
    phone: "",
    payPerClass: "",
    notes: "",
    isActive: true,
  };
}

function createInitialStaffClassLogFormState(): StaffClassLogFormState {
  return {
    staffId: "",
    classesCount: "",
    classDate: getTodayDateString(),
    paymentMethod: "efectivo",
    notes: "",
  };
}

function getCategoryLabel(category: string | null) {
  if (!category) return "Sin categoría";
  return CATEGORY_LABELS[category] || category;
}

function getPaymentMethodLabel(paymentMethod: string | null) {
  if (!paymentMethod) return "Sin definir";
  return PAYMENT_LABELS[paymentMethod] || paymentMethod;
}

function getFrequencyLabel(value: string) {
  return FREQUENCY_LABELS[value] || value;
}

function getFinanceSourceLabel(source: string | null) {
  if (!source) return "Manual";
  return SOURCE_LABELS[source] || source;
}

function getFinanceEntryContextLine(entry: BranchFinanceEntry) {
  if (entry.source === "commercial_sale") {
    const folio = entry.metadata?.folio ? `Folio ${entry.metadata.folio}` : null;
    const seller = entry.metadata?.sellerNameSnapshot ? `Vendedor ${entry.metadata.sellerNameSnapshot}` : null;
    return [folio, seller].filter(Boolean).join(" · ") || null;
  }

  if (entry.source === "sales_commission_payment") {
    return entry.metadata?.salespersonName ? `Comisión a ${entry.metadata.salespersonName}` : null;
  }

  return null;
}

function getSaleEntryTargetId(entry: BranchFinanceEntry) {
  if (entry.source !== "commercial_sale") return null;
  const metadataSaleId =
    typeof entry.metadata?.saleId === "string" && entry.metadata.saleId.trim().length > 0
      ? entry.metadata.saleId.trim()
      : null;
  return metadataSaleId || entry.sourceId || null;
}

function canOpenFinanceEntryOrigin(entry: BranchFinanceEntry) {
  return !!getSaleEntryTargetId(entry)
    || (entry.source === "sales_commission_payment" && !!entry.sourceId);
}

function getFinanceEntryPrimaryConcept(entry: BranchFinanceEntry) {
  if (entry.source === "commercial_sale" && Array.isArray(entry.metadata?.items) && entry.metadata.items.length > 0) {
    const items = entry.metadata.items
      .filter((item: any) => item && typeof item.name === "string")
      .map((item: any) => ({
        name: String(item.name).trim(),
        quantity: Number(item.quantity || 0),
      }))
      .filter((item: { name: string; quantity: number }) => item.name.length > 0);

    if (items.length > 0) {
      const [firstItem, ...restItems] = items;
      const quantityLabel = Number.isFinite(firstItem.quantity) && firstItem.quantity > 0 ? `${firstItem.quantity} × ` : "";
      return `${quantityLabel}${firstItem.name}${restItems.length ? ` +${restItems.length} más` : ""}`;
    }
  }

  return entry.concept;
}

function getFinanceEntrySecondaryConcept(entry: BranchFinanceEntry) {
  if (entry.source === "commercial_sale") {
    const folio = entry.metadata?.folio ? `Folio ${entry.metadata.folio}` : null;
    return ["Venta comercial", folio].filter(Boolean).join(" · ");
  }

  return getFinanceEntryContextLine(entry);
}

function getFinanceEntryFiscalCaption(entry: BranchFinanceEntry) {
  const snapshot = entry.fiscalSnapshot;
  if (!snapshot) return null;

  const baseLabel = `Base ${formatCurrency(snapshot.baseBeforeTax)}`;
  if (snapshot.taxMode === "tax_exempt" || Math.abs(snapshot.taxTransferred) < 0.005) {
    return `${baseLabel} · Sin IVA`;
  }

  return `${baseLabel} · IVA ${formatCurrency(snapshot.taxTransferred)}`;
}

function getExpenseBucketLabel(category: string) {
  switch (category) {
    case "renta":
      return "Renta";
    case "sueldos":
      return "Sueldos";
    case "mantenimiento":
      return "Servicios";
    case "publicidad":
      return "Marketing";
    default:
      return "Otros";
  }
}

export default function CajaTab({ focusRequest }: { focusRequest?: CajaFocusRequest | null } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rangePreset, setRangePreset] = useState<RangePreset>("ninety_days");
  const [calendarMonthOffset, setCalendarMonthOffset] = useState<CalendarMonthOffset>(0);
  const [calendarComparisonSpan, setCalendarComparisonSpan] = useState<CalendarComparisonSpan>(1);
  const [from, setFrom] = useState(getQuickRange("ninety_days").from);
  const [to, setTo] = useState(getQuickRange("ninety_days").to);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clientSearch, setClientSearch] = useState("");
  const [form, setForm] = useState<FinanceFormState>(createInitialFormState());
  const [editingEntry, setEditingEntry] = useState<BranchFinanceEntry | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<number | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalEditing, setGoalEditing] = useState(false);
  const [recurringExpenseForm, setRecurringExpenseForm] = useState<RecurringExpenseFormState>(createInitialRecurringExpenseFormState());
  const [editingRecurringExpense, setEditingRecurringExpense] = useState<BranchRecurringExpense | null>(null);
  const [staffForm, setStaffForm] = useState<StaffFormState>(createInitialStaffFormState());
  const [editingStaffMember, setEditingStaffMember] = useState<BranchStaffMember | null>(null);
  const [staffClassLogForm, setStaffClassLogForm] = useState<StaffClassLogFormState>(createInitialStaffClassLogFormState());
  const [saleDetailId, setSaleDetailId] = useState<string | null>(null);
  const [commissionPaymentDetailId, setCommissionPaymentDetailId] = useState<string | null>(null);
  const [saleCancellationReason, setSaleCancellationReason] = useState("");
  const [saleCancellationRequestId, setSaleCancellationRequestId] = useState(() => crypto.randomUUID());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const recurringExpenseFormRef = useRef<HTMLDivElement | null>(null);
  const staffFormRef = useRef<HTMLDivElement | null>(null);
  const financeFormRef = useRef<HTMLDivElement | null>(null);
  const entriesTableScroll = useHorizontalScrollNav();

  const overviewSummaryUrl = buildSummaryUrl(from, to);
  const summaryUrl = buildSummaryUrl(from, to, typeFilter);
  const entriesUrl = buildEntriesUrl({
    from,
    to,
    typeFilter,
    categoryFilter,
    clientFilter,
    search,
    page,
    limit: 20,
  });
  const last30Range = getLastNDaysRange(30);
  const currentMonthRange = getCurrentMonthRange();
  const previousMonthRange = getPreviousMonthRange();
  const financeGoalStorageKey = user?.branchId
    ? `webcool:caja:goal:${user.branchId}:${currentMonthRange.from.slice(0, 7)}`
    : null;

  const { data: overviewSummary, isLoading: overviewSummaryLoading } = useQuery<BranchFinanceSummary>({
    queryKey: [overviewSummaryUrl],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<BranchFinanceSummary>({
    queryKey: [summaryUrl],
  });

  const { data: last30Summary, isLoading: last30Loading } = useQuery<BranchFinanceSummary>({
    queryKey: [buildSummaryUrl(last30Range.from, last30Range.to)],
  });

  const { data: currentMonthSummary } = useQuery<BranchFinanceSummary>({
    queryKey: [buildSummaryUrl(currentMonthRange.from, currentMonthRange.to)],
  });

  const { data: previousMonthSummary } = useQuery<BranchFinanceSummary>({
    queryKey: [buildSummaryUrl(previousMonthRange.from, previousMonthRange.to)],
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery<FinanceEntriesResponse>({
    queryKey: [entriesUrl],
  });

  const { data: clients = [] } = useQuery<BranchClient[]>({
    queryKey: ["/api/branch/clients"],
  });

  const { data: recurringExpenses = [], isLoading: recurringExpensesLoading } = useQuery<BranchRecurringExpense[]>({
    queryKey: ["/api/branch/finance/fixed-expenses"],
  });

  const { data: staffMembers = [], isLoading: staffMembersLoading } = useQuery<BranchStaffMember[]>({
    queryKey: ["/api/branch/finance/staff"],
  });

  const { data: staffClassLogs = [], isLoading: staffClassLogsLoading } = useQuery<BranchStaffClassLog[]>({
    queryKey: ["/api/branch/finance/staff/class-logs?limit=8"],
  });

  const {
    data: saleDetail,
    isLoading: saleDetailLoading,
    isError: saleDetailIsError,
    error: saleDetailError,
    refetch: refetchSaleDetail,
  } = useQuery<BranchSaleDetail>({
    queryKey: saleDetailId ? [`/api/branch/sales/${saleDetailId}`] : ["/api/branch/sales/detail/idle"],
    enabled: !!saleDetailId,
  });
  const saleFiscalSnapshot = saleDetail ? getBranchSaleFiscalSnapshot(saleDetail) : null;

  useEffect(() => {
    setSaleCancellationReason("");
    setSaleCancellationRequestId(crypto.randomUUID());
  }, [saleDetailId]);

  const cancelSaleMutation = useMutation({
    mutationFn: async () => {
      if (!saleDetailId) {
        throw new Error("Selecciona una venta primero");
      }
      const reason = saleCancellationReason.trim();
      if (reason.length < 3) {
        throw new Error("Escribe un motivo claro para cancelar la venta");
      }

      const response = await apiRequest("POST", `/api/branch/sales/${saleDetailId}/cancel`, {
        reason,
        idempotencyKey: saleCancellationRequestId,
      });

      return response.json() as Promise<BranchSaleDetail>;
    },
    onSuccess: async (sale) => {
      await Promise.all([
        invalidateBranchFinanceQueries(),
        invalidateBranchCommercialQueries({
          clientId: sale.clientUserId ?? null,
          saleId: sale.id,
          salespersonId: sale.sellerId ?? null,
        }),
        refetchSaleDetail(),
      ]);
      setSaleCancellationReason("");
      setSaleCancellationRequestId(crypto.randomUUID());
      toast({
        title: "Venta cancelada",
        description: `${sale.folio} ya quedo marcada como cancelada y se genero el reverso automatico.`,
      });
    },
    onError: (error) => {
      toast({
        title: "No se pudo cancelar la venta",
        description: error instanceof Error ? error.message : "Intenta nuevamente en unos segundos.",
        variant: "destructive",
      });
    },
  });

  const { data: commissionPaymentDetail, isLoading: commissionPaymentDetailLoading } = useQuery<BranchCommissionPaymentDetail>({
    queryKey: commissionPaymentDetailId ? [`/api/branch/commission-payments/${commissionPaymentDetailId}`] : ["/api/branch/commission-payments/detail/idle"],
    enabled: !!commissionPaymentDetailId,
  });

  useEffect(() => {
    setPage(1);
  }, [from, to, typeFilter, categoryFilter, clientFilter, search]);

  useEffect(() => {
    if (!financeGoalStorageKey || typeof window === "undefined") return;
    const rawValue = window.localStorage.getItem(financeGoalStorageKey);
    if (!rawValue) {
      setMonthlyGoal(null);
      setGoalDraft("");
      return;
    }

    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      setMonthlyGoal(parsed);
      setGoalDraft(parsed.toString());
    } else {
      setMonthlyGoal(null);
      setGoalDraft("");
    }
  }, [financeGoalStorageKey]);

  useEffect(() => {
    if (!focusRequest?.sourceId) return;
    if (focusRequest.source === "commercial_sale") {
      setSaleDetailId(focusRequest.sourceId);
      setCommissionPaymentDetailId(null);
      return;
    }

    if (focusRequest.source === "sales_commission_payment") {
      setCommissionPaymentDetailId(focusRequest.sourceId);
      setSaleDetailId(null);
    }
  }, [focusRequest]);

  const filteredClients = clients.filter((client) => {
    const fullName = [client.name, client.lastName].filter(Boolean).join(" ").trim().toLowerCase();
    const needle = clientSearch.trim().toLowerCase();
    if (!needle) return true;
    return (
      fullName.includes(needle) ||
      (client.email || "").toLowerCase().includes(needle) ||
      (client.phone || "").toLowerCase().includes(needle)
    );
  });

  const activeStaffMembers = staffMembers.filter((member) => member.isActive);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Captura un monto válido");
      }

      const payload = {
        type: form.type,
        category: form.category || null,
        concept: form.concept.trim(),
        amount,
        paymentMethod: form.paymentMethod || null,
        clientUserId: form.clientUserId || null,
        clientName: form.clientUserId ? null : (form.clientName.trim() || null),
        notes: form.notes.trim() || null,
        entryDate: form.entryDate,
      };

      if (editingEntry) {
        const response = await apiRequest("PATCH", `/api/branch/finance/entries/${editingEntry.id}`, payload);
        return response.json();
      }

      const response = await apiRequest("POST", "/api/branch/finance/entries", payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateBranchFinanceQueries();
      toast({ title: editingEntry ? "Movimiento actualizado" : "Movimiento registrado" });
      setEditingEntry(null);
      setForm(createInitialFormState());
      setClientSearch("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el movimiento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await apiRequest("DELETE", `/api/branch/finance/entries/${entryId}`);
    },
    onSuccess: async (_data, entryId) => {
      await invalidateBranchFinanceQueries();
      toast({ title: "Movimiento eliminado" });
      if (editingEntry?.id === entryId) {
        setEditingEntry(null);
        setForm(createInitialFormState());
        setClientSearch("");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el movimiento",
        variant: "destructive",
      });
    },
  });

  const recurringExpenseMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(recurringExpenseForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Captura un monto válido para el gasto fijo");
      }

      const payload = {
        name: recurringExpenseForm.name.trim(),
        category: recurringExpenseForm.category,
        amount,
        frequency: recurringExpenseForm.frequency,
        paymentDay: recurringExpenseForm.paymentDay ? Number(recurringExpenseForm.paymentDay) : null,
        notes: recurringExpenseForm.notes.trim() || null,
        isActive: recurringExpenseForm.isActive,
      };

      if (editingRecurringExpense) {
        const response = await apiRequest("PATCH", `/api/branch/finance/fixed-expenses/${editingRecurringExpense.id}`, payload);
        return response.json();
      }

      const response = await apiRequest("POST", "/api/branch/finance/fixed-expenses", payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateBranchRecurringExpenseQueries();
      toast({ title: editingRecurringExpense ? "Gasto fijo actualizado" : "Gasto fijo creado" });
      setEditingRecurringExpense(null);
      setRecurringExpenseForm(createInitialRecurringExpenseFormState());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el gasto fijo",
        variant: "destructive",
      });
    },
  });

  const recurringExpenseDeleteMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await apiRequest("DELETE", `/api/branch/finance/fixed-expenses/${expenseId}`);
    },
    onSuccess: async (_data, expenseId) => {
      await invalidateBranchRecurringExpenseQueries();
      toast({ title: "Gasto fijo eliminado" });
      if (editingRecurringExpense?.id === expenseId) {
        setEditingRecurringExpense(null);
        setRecurringExpenseForm(createInitialRecurringExpenseFormState());
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el gasto fijo",
        variant: "destructive",
      });
    },
  });

  const recurringExpenseRegisterMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const response = await apiRequest("POST", `/api/branch/finance/fixed-expenses/${expenseId}/register-expense`, {
        entryDate: getTodayDateString(),
        paymentMethod: null,
      });
      return response.json();
    },
    onSuccess: async () => {
      await invalidateBranchRecurringExpenseQueries();
      toast({ title: "Gasto fijo registrado en Caja" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar el gasto fijo en Caja",
        variant: "destructive",
      });
    },
  });

  const staffMutation = useMutation({
    mutationFn: async () => {
      const payPerClass = Number(staffForm.payPerClass);
      if (!Number.isFinite(payPerClass) || payPerClass <= 0) {
        throw new Error("Captura un pago por clase válido");
      }

      const payload = {
        name: staffForm.name.trim(),
        phone: staffForm.phone.trim() || null,
        payPerClass,
        notes: staffForm.notes.trim() || null,
        isActive: staffForm.isActive,
      };

      if (editingStaffMember) {
        const response = await apiRequest("PATCH", `/api/branch/finance/staff/${editingStaffMember.id}`, payload);
        return response.json();
      }

      const response = await apiRequest("POST", "/api/branch/finance/staff", payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateBranchStaffQueries();
      toast({ title: editingStaffMember ? "Profesor o empleado actualizado" : "Profesor o empleado creado" });
      setEditingStaffMember(null);
      setStaffForm(createInitialStaffFormState());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el profesor o empleado",
        variant: "destructive",
      });
    },
  });

  const staffDeleteMutation = useMutation({
    mutationFn: async (staffId: string) => {
      await apiRequest("DELETE", `/api/branch/finance/staff/${staffId}`);
    },
    onSuccess: async (_data, staffId) => {
      await invalidateBranchStaffQueries();
      toast({ title: "Profesor o empleado eliminado" });
      if (editingStaffMember?.id === staffId) {
        setEditingStaffMember(null);
        setStaffForm(createInitialStaffFormState());
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el profesor o empleado",
        variant: "destructive",
      });
    },
  });

  const staffClassLogMutation = useMutation({
    mutationFn: async () => {
      const classesCount = Number(staffClassLogForm.classesCount);
      if (!Number.isFinite(classesCount) || classesCount <= 0) {
        throw new Error("Captura un número de clases válido");
      }

      const response = await apiRequest("POST", "/api/branch/finance/staff/class-logs", {
        staffId: staffClassLogForm.staffId,
        classesCount,
        classDate: staffClassLogForm.classDate,
        paymentMethod: staffClassLogForm.paymentMethod || null,
        notes: staffClassLogForm.notes.trim() || null,
      });
      return response.json();
    },
    onSuccess: async () => {
      await invalidateBranchStaffFinanceQueries();
      toast({ title: "Clases registradas en Caja" });
      setStaffClassLogForm(createInitialStaffClassLogFormState());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar la clase impartida",
        variant: "destructive",
      });
    },
  });

  function handleQuickRangeChange(preset: Exclude<RangePreset, "custom" | "calendar_month">) {
    const range = getQuickRange(preset);
    setRangePreset(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  function applyCalendarMonthRange(offset: CalendarMonthOffset, span: CalendarComparisonSpan) {
    const range = getCalendarMonthRange(offset, span);
    setCalendarMonthOffset(offset);
    setCalendarComparisonSpan(span);
    setRangePreset("calendar_month");
    setFrom(range.from);
    setTo(range.to);
  }

  function handleFormTypeChange(nextType: FinanceEntryType) {
    const nextCategories = getFormCategories(nextType);
    setForm((current) => ({
      ...current,
      type: nextType,
      category: nextCategories.includes(current.category as any) ? current.category : nextCategories[0],
    }));
  }

  function handleEditEntry(entry: BranchFinanceEntry) {
    if (isProtectedFinanceSource(entry.source)) {
      toast({
        title: "Movimiento automático",
        description: "Este movimiento se administra desde su origen y no puede editarse manualmente.",
        variant: "destructive",
      });
      return;
    }

    setEditingEntry(entry);
    setForm({
      type: entry.type,
      category: entry.category || (entry.type === "income" ? "membresia" : "renta"),
      concept: entry.concept,
      amount: entry.amount.toFixed(2),
      paymentMethod: entry.paymentMethod || "efectivo",
      clientUserId: entry.clientUserId || "",
      clientName: entry.clientUserId ? "" : (entry.clientName || ""),
      notes: entry.notes || "",
      entryDate: entry.entryDate,
    });
    setClientSearch(entry.clientDisplayName || "");
    scrollSectionIntoView(financeFormRef);
  }

  function handleOpenEntryDetail(entry: BranchFinanceEntry) {
    const saleTargetId = getSaleEntryTargetId(entry);
    if (saleTargetId) {
      setCommissionPaymentDetailId(null);
      setSaleDetailId(saleTargetId);
      return;
    }

    if (entry.source === "sales_commission_payment" && entry.sourceId) {
      setSaleDetailId(null);
      setCommissionPaymentDetailId(entry.sourceId);
      return;
    }

    toast({
      title: "Detalle no disponible",
      description: "Este movimiento no tiene un origen automático navegable.",
      variant: "destructive",
    });
  }

  function handleCancelEdit() {
    setEditingEntry(null);
    setForm(createInitialFormState());
    setClientSearch("");
  }

  function handleEditRecurringExpense(expense: BranchRecurringExpense) {
    setEditingRecurringExpense(expense);
    setRecurringExpenseForm({
      name: expense.name,
      category: expense.category,
      amount: expense.amount.toFixed(2),
      frequency: expense.frequency,
      paymentDay: expense.paymentDay ? String(expense.paymentDay) : "",
      notes: expense.notes || "",
      isActive: expense.isActive,
    });
    scrollSectionIntoView(recurringExpenseFormRef);
  }

  function handleCancelRecurringExpenseEdit() {
    setEditingRecurringExpense(null);
    setRecurringExpenseForm(createInitialRecurringExpenseFormState());
  }

  function handleEditStaffMember(member: BranchStaffMember) {
    setEditingStaffMember(member);
    setStaffForm({
      name: member.name,
      phone: member.phone || "",
      payPerClass: member.payPerClass.toFixed(2),
      notes: member.notes || "",
      isActive: member.isActive,
    });
    scrollSectionIntoView(staffFormRef);
  }

  function handleCancelStaffEdit() {
    setEditingStaffMember(null);
    setStaffForm(createInitialStaffFormState());
  }

  function handleExport() {
    const link = document.createElement("a");
    link.href = buildExportUrl(from, to, typeFilter);
    link.download = "caja.csv";
    link.click();
  }

  async function handleExportPdf() {
    try {
      setIsExportingPdf(true);
      await downloadAuthenticatedFile(buildExportPdfUrl(from, to, typeFilter), "caja.pdf");
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

  function handleSaveGoal() {
    const numericGoal = Number(goalDraft);
    if (!financeGoalStorageKey) {
      toast({
        title: "No se pudo guardar la meta",
        description: "No encontramos la sucursal activa para guardar esta configuración.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(numericGoal) || numericGoal <= 0) {
      toast({
        title: "Meta inválida",
        description: "Captura una meta mensual válida mayor a cero.",
        variant: "destructive",
      });
      return;
    }

    window.localStorage.setItem(financeGoalStorageKey, String(numericGoal));
    setMonthlyGoal(numericGoal);
    setGoalEditing(false);
    toast({ title: "Meta mensual guardada" });
  }

  const pageCount = entriesData?.pageCount || 1;
  const pageLabel = entriesData?.total ? `${entriesData.total} movimientos` : "Sin movimientos";
  const last30ChartData = useMemo(
    () =>
      (last30Summary?.dailyBreakdown || []).map((item) => ({
        ...item,
        shortDate: new Date(`${item.date}T12:00:00`).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "short",
        }),
      })),
    [last30Summary],
  );
  const hasLast30Data = last30ChartData.some((item) => item.income > 0 || item.expense > 0);
  const financeChartConfig = {
    income: { label: "Ingresos", color: "#16a34a" },
    expense: { label: "Gastos", color: "#dc2626" },
  } as const;

  const expenseDistribution = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of summary?.topExpenseCategories || []) {
      const bucket = getExpenseBucketLabel(item.category);
      totals.set(bucket, (totals.get(bucket) || 0) + Number(item.total || 0));
    }

    const donutColors: Record<string, string> = {
      Renta: "#2563eb",
      Sueldos: "#7c3aed",
      Servicios: "#0f766e",
      Marketing: "#ea580c",
      Otros: "#64748b",
    };

    return Array.from(totals.entries()).map(([label, total]) => ({
      label,
      total,
      fill: donutColors[label] || "#64748b",
    }));
  }, [summary]);

  const totalExpenseDistribution = expenseDistribution.reduce((acc, item) => acc + item.total, 0);
  const currentMonthNet = (currentMonthSummary?.monthIncome || 0) - (currentMonthSummary?.monthExpense || 0);
  const previousMonthNet = (previousMonthSummary?.monthIncome || 0) - (previousMonthSummary?.monthExpense || 0);
  const monthVariation = previousMonthNet === 0
    ? null
    : ((currentMonthNet - previousMonthNet) / Math.abs(previousMonthNet)) * 100;
  const goalProgress = monthlyGoal ? Math.min(100, ((currentMonthSummary?.monthIncome || 0) / monthlyGoal) * 100) : 0;
  const selectedStaffForLog = activeStaffMembers.find((member) => member.id === staffClassLogForm.staffId) || null;
  const staffLogPreviewTotal = selectedStaffForLog
    ? Number(staffClassLogForm.classesCount || 0) * selectedStaffForLog.payPerClass
    : 0;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Caja</h3>
          <p className="text-sm text-muted-foreground">
            Control simple de ingresos, gastos y ganancias de tu sucursal.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          Esto no sustituye contabilidad fiscal
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewSummaryLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <Skeleton className="mb-3 h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Ingresos hoy</p>
                  <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(overviewSummary?.todayIncome || 0)}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-emerald-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Gastos hoy</p>
                  <p className="text-2xl font-semibold text-rose-600">{formatCurrency(overviewSummary?.todayExpense || 0)}</p>
                </div>
                <ArrowDownRight className="h-8 w-8 text-rose-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Ganancia hoy</p>
                  <p className="text-2xl font-semibold">{formatCurrency((overviewSummary?.todayIncome || 0) - (overviewSummary?.todayExpense || 0))}</p>
                </div>
                <PiggyBank className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Ganancia del mes</p>
                  <p className="text-2xl font-semibold">{formatCurrency((overviewSummary?.monthIncome || 0) - (overviewSummary?.monthExpense || 0))}</p>
                </div>
                <Wallet className="h-8 w-8 text-amber-500" />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-emerald-600" />
              Ingresos vs Gastos
            </CardTitle>
            <CardDescription>Últimos 30 días de movimientos registrados en Caja.</CardDescription>
          </CardHeader>
          <CardContent>
            {last30Loading ? (
              <Skeleton className="h-[240px] w-full rounded-2xl" />
            ) : hasLast30Data ? (
              <ChartContainer config={financeChartConfig} className="h-[240px] w-full">
                <LineChart data={last30ChartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="shortDate" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={(value: number) => `$${Math.round(value).toLocaleString("es-MX")}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-[160px] items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-medium text-foreground">{formatCurrency(Number(value) || 0)}</span>
                          </div>
                        )}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.shortDate || ""}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="var(--color-income)"
                    strokeWidth={2.6}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    stroke="var(--color-expense)"
                    strokeWidth={2.6}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center dark:border-slate-800 dark:bg-slate-900/30">
                <PiggyBank className="mb-3 h-9 w-9 text-slate-400" />
                <p className="text-sm font-medium text-foreground">Todavía no hay suficientes movimientos</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Registra ingresos o gastos y aquí verás la tendencia de tu negocio en los últimos 30 días.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Meta mensual</CardTitle>
              <CardDescription>Referencia simple para seguir tu objetivo comercial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goalDraft}
                    onChange={(event) => setGoalDraft(event.target.value)}
                    placeholder="Ej. 50000"
                    className="max-w-[180px]"
                  />
                  <Button size="sm" onClick={handleSaveGoal}>Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setGoalEditing(false);
                    setGoalDraft(monthlyGoal ? String(monthlyGoal) : "");
                  }}>
                    Cancelar
                  </Button>
                </div>
              ) : monthlyGoal ? (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold text-foreground">
                        {formatCurrency(currentMonthSummary?.monthIncome || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        de {formatCurrency(monthlyGoal)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setGoalEditing(true)}>
                      Editar meta
                    </Button>
                  </div>
                  <Progress value={goalProgress} className="h-2.5" />
                  <p className="text-xs text-muted-foreground">
                    {goalProgress >= 100 ? "Meta alcanzada o superada este mes." : `${goalProgress.toFixed(0)}% de avance mensual.`}
                  </p>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                  <p className="text-sm font-medium text-foreground">Aún no tienes una meta mensual</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Define una meta simple para comparar lo que ya ingresó este mes.
                  </p>
                  <Button size="sm" className="mt-3" onClick={() => setGoalEditing(true)}>
                    Definir meta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
            <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Comparativo mensual</CardTitle>
                <CardDescription>Comparación simple de ganancia neta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mes anterior</span>
                  <span className="font-medium">{formatCurrency(previousMonthNet)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mes actual</span>
                  <span className="font-medium">{formatCurrency(currentMonthNet)}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Variación</span>
                    <span className={`text-sm font-semibold ${
                      monthVariation == null
                        ? "text-slate-600 dark:text-slate-300"
                        : monthVariation >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {monthVariation == null ? "Sin base comparativa" : `${monthVariation >= 0 ? "+" : ""}${monthVariation.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChartPie className="h-4 w-4 text-rose-600" />
                  Distribución de gastos
                </CardTitle>
                <CardDescription>Cómo se reparten tus egresos en el rango filtrado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {totalExpenseDistribution > 0 ? (
                  <>
                    <ChartContainer
                      config={{
                        renta: { label: "Renta", color: "#2563eb" },
                        sueldos: { label: "Sueldos", color: "#7c3aed" },
                        servicios: { label: "Servicios", color: "#0f766e" },
                        marketing: { label: "Marketing", color: "#ea580c" },
                        otros: { label: "Otros", color: "#64748b" },
                      }}
                      className="mx-auto h-[220px] w-full max-w-[260px]"
                    >
                      <PieChart>
                        <Pie
                          data={expenseDistribution}
                          dataKey="total"
                          nameKey="label"
                          innerRadius={56}
                          outerRadius={84}
                          paddingAngle={2}
                        >
                          {expenseDistribution.map((entry) => (
                            <Cell key={entry.label} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name) => (
                                <div className="flex min-w-[150px] items-center justify-between gap-4">
                                  <span className="text-muted-foreground">{name}</span>
                                  <span className="font-medium text-foreground">{formatCurrency(Number(value) || 0)}</span>
                                </div>
                              )}
                            />
                          }
                        />
                      </PieChart>
                    </ChartContainer>
                    <div className="grid gap-2">
                      {expenseDistribution.map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/40">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                            <span>{item.label}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center dark:border-slate-800 dark:bg-slate-900/30">
                    <ChartPie className="mb-3 h-9 w-9 text-slate-400" />
                    <p className="text-sm font-medium text-foreground">Aún no hay gastos para distribuir</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cuando registres egresos, aquí verás en qué se está yendo tu dinero.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            Resumen y filtros
          </CardTitle>
          <CardDescription>Por defecto se muestran los últimos 90 días. Puedes cambiar el rango sin borrar historial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Mes calendario</p>
                  <p className="text-xs text-muted-foreground">Revisa el mes actual, el anterior o hace 2 meses con opción de comparar hasta 3 meses acumulados.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={rangePreset === "calendar_month" && calendarMonthOffset === 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyCalendarMonthRange(0, calendarComparisonSpan)}
                  >
                    Mes actual
                  </Button>
                  <Button
                    variant={rangePreset === "calendar_month" && calendarMonthOffset === 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyCalendarMonthRange(1, calendarComparisonSpan)}
                  >
                    Mes anterior
                  </Button>
                  <Button
                    variant={rangePreset === "calendar_month" && calendarMonthOffset === 2 ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyCalendarMonthRange(2, calendarComparisonSpan)}
                  >
                    Hace 2 meses
                  </Button>
                </div>
              </div>

              <div className="w-full max-w-[220px] space-y-2">
                <Label>Comparar periodo</Label>
                <Select
                  value={String(calendarComparisonSpan)}
                  onValueChange={(value) => applyCalendarMonthRange(calendarMonthOffset, Number(value) as CalendarComparisonSpan)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 mes</SelectItem>
                    <SelectItem value="2">2 meses</SelectItem>
                    <SelectItem value="3">3 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <Button className="w-full justify-center md:w-auto" variant={rangePreset === "thirty_days" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("thirty_days")}>Últimos 30 días</Button>
            <Button className="w-full justify-center md:w-auto" variant={rangePreset === "ninety_days" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("ninety_days")}>Últimos 90 días</Button>
            <Button className="w-full justify-center md:w-auto" variant={rangePreset === "six_months" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("six_months")}>Últimos 6 meses</Button>
            <Button className="w-full justify-center md:w-auto" variant={rangePreset === "twelve_months" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("twelve_months")}>Últimos 12 meses</Button>
            <Button className="w-full justify-center md:w-auto" variant={rangePreset === "all" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("all")}>Todo</Button>
            <Button className="w-full justify-center md:w-auto" variant={rangePreset === "custom" ? "default" : "outline"} size="sm" onClick={() => setRangePreset("custom")}>Personalizado</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={from}
                onChange={(event) => {
                  setRangePreset("custom");
                  setFrom(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={to}
                onChange={(event) => {
                  setRangePreset("custom");
                  setTo(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Ingresos</SelectItem>
                  <SelectItem value="expense">Gastos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {ALL_CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category} value={category}>{getCategoryLabel(category)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.userId} value={client.userId}>
                      {[client.name, client.lastName].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Concepto, cliente, nota..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ingresos cobrados</p>
                <p className="mt-2 text-xl font-semibold text-emerald-600">{formatCurrency(summary?.totalIncome || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Base antes de IVA</p>
                <p className="mt-2 text-xl font-semibold text-sky-700">{formatCurrency(summary?.incomeBaseBeforeTax || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">IVA trasladado</p>
                <p className="mt-2 text-xl font-semibold text-amber-700">{formatCurrency(summary?.incomeTransferredTax || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Egresos</p>
                <p className="mt-2 text-xl font-semibold text-rose-600">{formatCurrency(summary?.totalExpense || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(summary?.netProfit || 0)}</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">
            La base y el IVA solo se suman cuando el movimiento conserva un snapshot fiscal persistido de esa misma operación.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card ref={recurringExpenseFormRef} className={`scroll-mt-28 ${editingRecurringExpense ? "ring-1 ring-primary/20 shadow-md" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat className="h-4 w-4 text-primary" />
              {editingRecurringExpense ? "Editando gasto fijo" : "Gastos fijos"}
            </CardTitle>
            <CardDescription>
              Registra renta, servicios, nómina e insumos recurrentes y conviértelos en gasto real dentro de Caja cuando corresponda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Nombre</Label>
                <Input
                  value={recurringExpenseForm.name}
                  onChange={(event) => setRecurringExpenseForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ej. Renta del local"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={recurringExpenseForm.category}
                  onValueChange={(value) => setRecurringExpenseForm((current) => ({ ...current, category: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branchRecurringExpenseCategoryValues.map((category) => (
                      <SelectItem key={category} value={category}>{getCategoryLabel(category)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={recurringExpenseForm.amount}
                  onChange={(event) => setRecurringExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <Select
                  value={recurringExpenseForm.frequency}
                  onValueChange={(value) => setRecurringExpenseForm((current) => ({ ...current, frequency: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branchRecurringExpenseFrequencyValues.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>{getFrequencyLabel(frequency)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Día de pago opcional</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringExpenseForm.paymentDay}
                  onChange={(event) => setRecurringExpenseForm((current) => ({ ...current, paymentDay: event.target.value }))}
                  placeholder="Ej. 5"
                />
              </div>
              <div className="space-y-2">
                <Label>Estatus</Label>
                <Select
                  value={recurringExpenseForm.isActive ? "active" : "inactive"}
                  onValueChange={(value) => setRecurringExpenseForm((current) => ({ ...current, isActive: value === "active" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notas</Label>
                <Textarea
                  rows={2}
                  value={recurringExpenseForm.notes}
                  onChange={(event) => setRecurringExpenseForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              <Button
                className="w-full justify-center md:w-auto"
                onClick={() => recurringExpenseMutation.mutate()}
                disabled={recurringExpenseMutation.isPending || !recurringExpenseForm.name.trim() || !recurringExpenseForm.amount}
              >
                {recurringExpenseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingRecurringExpense ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingRecurringExpense ? "Guardar cambios" : "Crear gasto fijo"}
              </Button>
              {editingRecurringExpense ? (
                <Button className="w-full justify-center md:w-auto" variant="outline" onClick={handleCancelRecurringExpenseEdit}>
                  Cancelar edición
                </Button>
              ) : null}
            </div>
            {editingRecurringExpense ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                Editando: <span className="font-medium">{editingRecurringExpense.name}</span>
              </div>
            ) : null}

            <div className="space-y-3">
              {recurringExpensesLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
              ) : recurringExpenses.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Aún no tienes gastos fijos registrados.
                </div>
              ) : (
                recurringExpenses.map((expense) => (
                  <div key={expense.id} className={`rounded-xl border p-4 transition-colors ${editingRecurringExpense?.id === expense.id ? "border-primary/40 bg-primary/5" : ""}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{expense.name}</p>
                          <Badge variant={expense.isActive ? "default" : "secondary"}>
                            {expense.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                          <Badge variant="outline">{getFrequencyLabel(expense.frequency)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getCategoryLabel(expense.category)} · {formatCurrency(expense.amount)}
                          {expense.paymentDay ? ` · Día ${expense.paymentDay}` : ""}
                        </p>
                        {expense.notes ? <p className="text-sm text-muted-foreground">{expense.notes}</p> : null}
                      </div>
                      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                        <Button
                          className="w-full justify-center md:w-auto"
                          size="sm"
                          variant="outline"
                          onClick={() => recurringExpenseRegisterMutation.mutate(expense.id)}
                          disabled={recurringExpenseRegisterMutation.isPending}
                        >
                          Registrar en Caja
                        </Button>
                        <Button className="w-full justify-center md:w-auto" size="sm" variant="outline" onClick={() => handleEditRecurringExpense(expense)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          className="w-full justify-center text-rose-600 md:w-auto"
                          size="sm"
                          variant="outline"
                          onClick={() => recurringExpenseDeleteMutation.mutate(expense.id)}
                          disabled={recurringExpenseDeleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card ref={staffFormRef} className={`scroll-mt-28 ${editingStaffMember ? "ring-1 ring-primary/20 shadow-md" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              {editingStaffMember ? "Editando colaborador" : "Colaboradores"}
            </CardTitle>
            <CardDescription>
              Configura una tarifa por unidad y registra automáticamente el gasto correspondiente en Caja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={staffForm.name}
                  onChange={(event) => setStaffForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono / WhatsApp</Label>
                <Input
                  value={staffForm.phone}
                  onChange={(event) => setStaffForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label>Pago por unidad</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={staffForm.payPerClass}
                  onChange={(event) => setStaffForm((current) => ({ ...current, payPerClass: event.target.value }))}
                  placeholder="150.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Estatus</Label>
                <Select
                  value={staffForm.isActive ? "active" : "inactive"}
                  onValueChange={(value) => setStaffForm((current) => ({ ...current, isActive: value === "active" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notas</Label>
                <Textarea
                  rows={2}
                  value={staffForm.notes}
                  onChange={(event) => setStaffForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              <Button
                className="w-full justify-center md:w-auto"
                onClick={() => staffMutation.mutate()}
                disabled={staffMutation.isPending || !staffForm.name.trim() || !staffForm.payPerClass}
              >
                {staffMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingStaffMember ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingStaffMember ? "Guardar cambios" : "Crear colaborador"}
              </Button>
              {editingStaffMember ? (
                <Button className="w-full justify-center md:w-auto" variant="outline" onClick={handleCancelStaffEdit}>
                  Cancelar edición
                </Button>
              ) : null}
            </div>
            {editingStaffMember ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                Editando: <span className="font-medium">{editingStaffMember.name}</span>
              </div>
            ) : null}

            <div className="space-y-3">
              {staffMembersLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
              ) : staffMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Aún no tienes colaboradores registrados.
                </div>
              ) : (
                staffMembers.map((member) => (
                  <div key={member.id} className={`rounded-xl border p-4 transition-colors ${editingStaffMember?.id === member.id ? "border-primary/40 bg-primary/5" : ""}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{member.name}</p>
                          <Badge variant={member.isActive ? "default" : "secondary"}>
                            {member.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Tarifa por unidad: {formatCurrency(member.payPerClass)}
                          {member.phone ? ` · ${member.phone}` : ""}
                        </p>
                        {member.notes ? <p className="text-sm text-muted-foreground">{member.notes}</p> : null}
                      </div>
                      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                        <Button className="w-full justify-center md:w-auto" size="sm" variant="outline" onClick={() => handleEditStaffMember(member)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          className="w-full justify-center text-rose-600 md:w-auto"
                          size="sm"
                          variant="outline"
                          onClick={() => staffDeleteMutation.mutate(member.id)}
                          disabled={staffDeleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-dashed p-4">
              <div className="mb-3">
                <p className="font-medium">Registrar trabajo realizado</p>
                <p className="text-sm text-muted-foreground">
                  Registra clases, horas, días, servicios u otras unidades trabajadas y lo guarda como gasto automático en Caja.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <Select
                    value={staffClassLogForm.staffId}
                    onValueChange={(value) => setStaffClassLogForm((current) => ({ ...current, staffId: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona colaborador" /></SelectTrigger>
                    <SelectContent>
                      {activeStaffMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} · {formatCurrency(member.payPerClass)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={staffClassLogForm.classesCount}
                    onChange={(event) => setStaffClassLogForm((current) => ({ ...current, classesCount: event.target.value }))}
                    placeholder="Ej. 8"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={staffClassLogForm.classDate}
                    onChange={(event) => setStaffClassLogForm((current) => ({ ...current, classDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <Select
                    value={staffClassLogForm.paymentMethod}
                    onValueChange={(value) => setStaffClassLogForm((current) => ({ ...current, paymentMethod: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {branchFinancePaymentMethodValues.map((method) => (
                        <SelectItem key={method} value={method}>{getPaymentMethodLabel(method)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notas</Label>
                  <Textarea
                    rows={2}
                    value={staffClassLogForm.notes}
                    onChange={(event) => setStaffClassLogForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  Total estimado: <span className="font-medium text-foreground">{formatCurrency(staffLogPreviewTotal)}</span>
                </p>
                <Button
                  className="w-full justify-center md:w-auto"
                  onClick={() => staffClassLogMutation.mutate()}
                  disabled={staffClassLogMutation.isPending || !staffClassLogForm.staffId || !staffClassLogForm.classesCount}
                >
                  {staffClassLogMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                  Registrar trabajo
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Últimos registros</p>
                {staffClassLogsLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)
                ) : staffClassLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no has registrado trabajo realizado.</p>
                ) : (
                  staffClassLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{log.staffName}</p>
                        <p className="text-muted-foreground">
                          Cantidad: {log.classesCount} · {formatDateLabel(log.classDate)}
                          {log.paymentMethod ? ` · ${getPaymentMethodLabel(log.paymentMethod)}` : ""}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(log.paymentTotal)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card ref={financeFormRef} className={`scroll-mt-28 ${editingEntry ? "ring-1 ring-primary/20 shadow-md" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            {editingEntry ? "Editar movimiento" : "Nuevo movimiento"}
          </CardTitle>
          <CardDescription>
            {editingEntry
              ? editingEntry.source
                ? `Editando movimiento ${getFinanceSourceLabel(editingEntry.source).toLowerCase()}. Se actualizará este registro, no se creará uno nuevo.`
                : "Editando movimiento manual. Guarda cambios o cancela para volver al modo de registro."
              : "Registra ingresos y gastos manuales. Puedes ligarlos a un cliente o capturar el nombre manualmente."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingEntry ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
              <Badge variant="outline">Editando movimiento</Badge>
              <span>{editingEntry.concept}</span>
              {editingEntry.source ? (
                <Badge variant="secondary">{getFinanceSourceLabel(editingEntry.source)}</Badge>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(value) => handleFormTypeChange(value as FinanceEntryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getFormCategories(form.type).map((category) => (
                    <SelectItem key={category} value={category}>{getCategoryLabel(category)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Concepto</Label>
              <Input
                value={form.concept}
                onChange={(event) => setForm((current) => ({ ...current, concept: event.target.value }))}
                placeholder="Ej. Paquete mensual 8 clases"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(value) => setForm((current) => ({ ...current, paymentMethod: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branchFinancePaymentMethodValues.map((method) => (
                    <SelectItem key={method} value={method}>{getPaymentMethodLabel(method)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Cliente existente opcional</Label>
                {form.clientUserId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((current) => ({ ...current, clientUserId: "" }))}
                  >
                    Quitar cliente
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 lg:grid-cols-[220px,1fr]">
                <Input
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Buscar cliente..."
                />
                <Select
                  value={form.clientUserId || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      clientUserId: value === "none" ? "" : value,
                      clientName: value === "none" ? current.clientName : "",
                    }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cliente ligado</SelectItem>
                    {filteredClients.slice(0, 100).map((client) => (
                    <SelectItem key={client.userId} value={client.userId}>
                        {[client.name, client.lastName].filter(Boolean).join(" ")} - {client.email || "Sin correo"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!form.clientUserId ? (
              <div className="space-y-2 lg:col-span-2">
                <Label>Nombre cliente manual</Label>
                <Input
                  value={form.clientName}
                  onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                  placeholder="Ej. Cliente mostrador"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.entryDate}
                onChange={(event) => setForm((current) => ({ ...current, entryDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Observaciones opcionales"
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <Button
              className="w-full justify-center md:w-auto"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.concept.trim() || !form.amount}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
              {editingEntry ? "Guardar cambios" : "Registrar movimiento"}
            </Button>
            {editingEntry ? (
              <Button className="w-full justify-center md:w-auto" variant="outline" onClick={handleCancelEdit}>
                Cancelar edición
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-1 2xl:grid-cols-[minmax(0,2.1fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Movimientos</CardTitle>
                <CardDescription>{pageLabel}</CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                <Button className="w-full justify-center md:w-auto" variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
                <Button
                  className="w-full justify-center md:w-auto"
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                >
                  {isExportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Exportar PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {entriesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : !entriesData?.items.length ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="font-medium">Aún no hay movimientos para este rango</p>
                <p className="mt-1 text-sm text-muted-foreground">Registra un ingreso o gasto para empezar a usar tu caja.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {entriesData.items.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-xl border p-3 ${editingEntry?.id === entry.id ? "border-primary/40 bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{formatDateLabel(entry.entryDate)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="break-words text-sm font-medium">{getFinanceEntryPrimaryConcept(entry)}</p>
                            <Badge variant={entry.type === "income" ? "default" : "destructive"} className={entry.type === "income" ? "bg-emerald-600" : ""}>
                              {entry.type === "income" ? "Ingreso" : "Gasto"}
                            </Badge>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">{formatCurrency(entry.amount)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{getCategoryLabel(entry.category)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {getFinanceSourceLabel(entry.source)}
                        </Badge>
                        {isProtectedFinanceSource(entry.source) ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[10px]"
                            title="Este movimiento fue generado automáticamente y debe corregirse desde su operación de origen."
                          >
                            <LockKeyhole className="h-3 w-3" />
                            Automático
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="break-words text-muted-foreground">
                          Cliente: {entry.clientDisplayName || "Sin cliente"}
                        </p>
                        {entry.clientEmail ? <p className="break-all text-xs text-muted-foreground">{entry.clientEmail}</p> : null}
                        {getFinanceEntryFiscalCaption(entry) ? <p className="break-words text-xs text-muted-foreground">{getFinanceEntryFiscalCaption(entry)}</p> : null}
                        <p className="text-muted-foreground">Método: {getPaymentMethodLabel(entry.paymentMethod)}</p>
                        {getFinanceEntrySecondaryConcept(entry) ? <p className="break-words text-xs text-muted-foreground">{getFinanceEntrySecondaryConcept(entry)}</p> : null}
                        {entry.notes ? <p className="break-words text-xs text-muted-foreground">{entry.notes}</p> : null}
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {isProtectedFinanceSource(entry.source) ? (
                          <>
                            {canOpenFinanceEntryOrigin(entry) ? (
                              <Button
                                className="w-full justify-center"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEntryDetail(entry)}
                              >
                                <ReceiptText className="mr-2 h-3.5 w-3.5" />
                                Ver detalle
                              </Button>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              Movimiento automático. No puede editarse ni eliminarse desde Caja.
                            </p>
                          </>
                        ) : (
                          <>
                            <Button
                              className="w-full justify-center"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditEntry(entry)}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              className="w-full justify-center text-rose-600"
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(entry.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Eliminar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative hidden md:block">
                {entriesTableScroll.isOverflowing ? (
                  <div className="sticky top-0 z-20 mb-3 flex items-center gap-3 rounded-xl border border-border/70 bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                    <span className="text-xs text-muted-foreground">Desliza para ver más columnas</span>
                    <div ref={entriesTableScroll.mirrorScrollRef} className="h-4 flex-1 overflow-x-auto rounded-full border border-border/60 bg-muted/40">
                      <div style={{ width: entriesTableScroll.contentWidth, height: 1 }} />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => entriesTableScroll.scrollByDirection("left")}
                      disabled={!entriesTableScroll.canScrollLeft}
                      title="Ver columnas anteriores"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => entriesTableScroll.scrollByDirection("right")}
                      disabled={!entriesTableScroll.canScrollRight}
                      title="Ver más columnas"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                {entriesTableScroll.isOverflowing ? (
                  <>
                    <div className={`pointer-events-none absolute bottom-0 left-0 top-12 z-10 w-10 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity ${entriesTableScroll.canScrollLeft ? "opacity-100" : "opacity-0"}`} />
                    <div className={`pointer-events-none absolute bottom-0 right-0 top-12 z-10 w-10 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity ${entriesTableScroll.canScrollRight ? "opacity-100" : "opacity-0"}`} />
                  </>
                ) : null}
                <div ref={entriesTableScroll.containerRef} className="overflow-x-auto rounded-xl">
                <table className="w-full min-w-[1340px] caption-bottom text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-[16] w-[120px] bg-background shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)]">Fecha</TableHead>
                      <TableHead className="sticky left-[120px] z-[16] w-[110px] bg-background">Tipo</TableHead>
                      <TableHead className="sticky left-[230px] z-[16] w-[140px] bg-background">Categoría</TableHead>
                      <TableHead className="sticky left-[370px] z-[16] min-w-[320px] bg-background shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)]">Concepto</TableHead>
                      <TableHead className="min-w-[220px]">Cliente</TableHead>
                      <TableHead className="w-[140px]">Método</TableHead>
                      <TableHead className="w-[140px] text-right">Monto</TableHead>
                      <TableHead className="sticky right-0 z-[16] w-[150px] bg-background text-right shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.18)]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesData.items.map((entry) => (
                      <TableRow key={entry.id} className={`group ${editingEntry?.id === entry.id ? "bg-primary/5" : ""}`}>
                        <TableCell className={`sticky left-0 z-[14] w-[120px] align-top text-sm shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)] ${editingEntry?.id === entry.id ? "bg-primary/5" : "bg-background group-hover:bg-muted/50"}`}>{formatDateLabel(entry.entryDate)}</TableCell>
                        <TableCell className={`sticky left-[120px] z-[14] w-[110px] align-top ${editingEntry?.id === entry.id ? "bg-primary/5" : "bg-background group-hover:bg-muted/50"}`}>
                          <Badge variant={entry.type === "income" ? "default" : "destructive"} className={entry.type === "income" ? "bg-emerald-600" : ""}>
                            {entry.type === "income" ? "Ingreso" : "Gasto"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`sticky left-[230px] z-[14] w-[140px] align-top text-sm ${editingEntry?.id === entry.id ? "bg-primary/5" : "bg-background group-hover:bg-muted/50"}`}>{getCategoryLabel(entry.category)}</TableCell>
                        <TableCell className={`sticky left-[370px] z-[14] min-w-[320px] align-top shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)] ${editingEntry?.id === entry.id ? "bg-primary/5" : "bg-background group-hover:bg-muted/50"}`}>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="min-w-0 break-words font-medium">{getFinanceEntryPrimaryConcept(entry)}</p>
                              <Badge variant="outline" className="text-[10px]">
                                {getFinanceSourceLabel(entry.source)}
                              </Badge>
                              {isProtectedFinanceSource(entry.source) ? (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-[10px]"
                                  title="Este movimiento fue generado automáticamente y no puede editarse ni eliminarse desde Caja."
                                >
                                  <LockKeyhole className="h-3 w-3" />
                                  Automático
                                </Badge>
                              ) : null}
                            </div>
                            {getFinanceEntrySecondaryConcept(entry) ? (
                              <p className="break-words text-xs text-muted-foreground">{getFinanceEntrySecondaryConcept(entry)}</p>
                            ) : null}
                            {entry.notes ? <p className="line-clamp-2 break-words text-xs text-muted-foreground">{entry.notes}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="min-w-0">
                            <p className="break-words">{entry.clientDisplayName || "Sin cliente"}</p>
                            {entry.clientEmail ? <p className="break-all text-xs text-muted-foreground">{entry.clientEmail}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-sm">{getPaymentMethodLabel(entry.paymentMethod)}</TableCell>
                        <TableCell className="align-top text-right">
                          <div className="space-y-1">
                            <p className="font-medium">{formatCurrency(entry.amount)}</p>
                            {getFinanceEntryFiscalCaption(entry) ? <p className="text-xs text-muted-foreground">{getFinanceEntryFiscalCaption(entry)}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className={`sticky right-0 z-[14] align-top shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.18)] ${editingEntry?.id === entry.id ? "bg-primary/5" : "bg-background group-hover:bg-muted/50"}`}>
                          <div className="flex justify-end gap-2">
                            {isProtectedFinanceSource(entry.source) ? (
                              canOpenFinanceEntryOrigin(entry) ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEntryDetail(entry)}
                                  title="Abrir operación de origen"
                                >
                                  <ReceiptText className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <LockKeyhole
                                  className="h-4 w-4 text-muted-foreground"
                                  aria-label="Movimiento automático sin edición manual"
                                />
                              )
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditEntry(entry)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-rose-600"
                                  onClick={() => deleteMutation.mutate(entry.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
                </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Página {entriesData.page} de {pageCount}
                  </p>
                  <div className="flex w-full gap-2 md:w-auto">
                    <Button className="flex-1 md:flex-none" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                      Anterior
                    </Button>
                    <Button className="flex-1 md:flex-none" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total por día</CardTitle>
              <CardDescription>Comparativo diario del rango elegido.</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
                </div>
              ) : !summary?.dailyBreakdown.length ? (
                <p className="text-sm text-muted-foreground">Sin movimientos para mostrar.</p>
              ) : (
                <div className="space-y-2">
                  {summary.dailyBreakdown.slice(-8).reverse().map((item) => (
                    <div key={item.date} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{formatDateLabel(item.date)}</p>
                        <p className="text-sm font-semibold">{formatCurrency(item.net)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Ingresos: {formatCurrency(item.income)}</span>
                        <span>Gastos: {formatCurrency(item.expense)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Categorías top</CardTitle>
              <CardDescription>Las categorías que más mueven tu caja.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div>
                <p className="mb-2 text-sm font-medium text-emerald-600">Ingresos</p>
                <div className="space-y-2">
                  {(summary?.topIncomeCategories.length ? summary.topIncomeCategories : []).map((item) => (
                    <div key={`income-${item.category}`} className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">
                      <span>{getCategoryLabel(item.category)}</span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                  {!summary?.topIncomeCategories.length ? (
                    <p className="text-sm text-muted-foreground">Sin ingresos en el rango.</p>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-rose-600">Gastos</p>
                <div className="space-y-2">
                  {(summary?.topExpenseCategories.length ? summary.topExpenseCategories : []).map((item) => (
                    <div key={`expense-${item.category}`} className="flex items-center justify-between rounded-md bg-rose-50 px-3 py-2 text-sm dark:bg-rose-950/30">
                      <span>{getCategoryLabel(item.category)}</span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                  {!summary?.topExpenseCategories.length ? (
                    <p className="text-sm text-muted-foreground">Sin gastos en el rango.</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!saleDetailId} onOpenChange={(open) => !open && setSaleDetailId(null)}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de venta comercial</DialogTitle>
            <DialogDescription>Movimiento automático enlazado a branch_sales y a Caja en modo solo lectura.</DialogDescription>
          </DialogHeader>
          {saleDetailLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : saleDetailIsError || !saleDetail ? (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50/80 p-4 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100">
                <p className="font-medium">No pudimos cargar esta venta.</p>
                <p className="mt-1 break-words">
                  {saleDetailError instanceof Error && saleDetailError.message.trim()
                    ? saleDetailError.message.replace(/^\d+:\s*/, "")
                    : "Intenta nuevamente para recuperar el detalle enlazado desde Caja."}
                </p>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => void refetchSaleDetail()}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="min-w-0 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Folio</p><p className="mt-2 break-words text-lg font-semibold">{saleDetail.folio}</p></CardContent></Card>
                <Card><CardContent className="min-w-0 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cliente</p><p className="mt-2 break-words text-lg font-semibold">{saleDetail.clientDisplayName || "Mostrador"}</p></CardContent></Card>
                <Card><CardContent className="min-w-0 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Vendedor</p><p className="mt-2 break-words text-lg font-semibold">{saleDetail.sellerNameSnapshot || "Sin vendedor"}</p></CardContent></Card>
                <Card><CardContent className="min-w-0 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Canal</p><p className="mt-2 break-words text-lg font-semibold">{saleDetail.channel}</p></CardContent></Card>
              </div>

              <Card>
                <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div><p className="text-sm text-muted-foreground">Creada</p><p className="font-medium">{formatDateTimeLabel(saleDetail.createdAt)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Modo fiscal</p><p className="font-medium">{getBranchSaleTaxModeLabel(saleFiscalSnapshot?.taxMode ?? "tax_exempt")}</p></div>
                  <div><p className="text-sm text-muted-foreground">Tasa</p><p className="font-medium">{`${(saleFiscalSnapshot?.taxRate ?? 0).toFixed(2).replace(/\.00$/, "")}%`}</p></div>
                  <div><p className="text-sm text-muted-foreground">Total cobrado</p><p className="font-medium">{formatCurrency(saleFiscalSnapshot?.grandTotal ?? saleDetail.totalAmount)}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
                  <div><p className="text-sm text-muted-foreground">Subtotal</p><p className="font-medium">{formatCurrency(saleFiscalSnapshot?.subtotalBeforeTax ?? saleDetail.subtotalAmount)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Descuento</p><p className="font-medium">{formatCurrency(saleDetail.discountAmount)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Base gravable</p><p className="font-medium">{formatCurrency(saleFiscalSnapshot?.taxableSubtotal ?? saleDetail.totalAmount)}</p></div>
                  <div><p className="text-sm text-muted-foreground">IVA</p><p className="font-medium">{formatCurrency(saleFiscalSnapshot?.taxTotal ?? 0)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Pagado</p><p className="font-medium">{formatCurrency(saleDetail.paidAmount)}</p></div>
                </CardContent>
              </Card>

              {saleDetail.status === "cancelled" ? (
                <Card className="border-amber-300 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Venta cancelada</CardTitle>
                    <CardDescription>La venta conserva su historial y ya no participa en los indicadores comerciales activos.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm md:grid-cols-3">
                    <div><p className="text-muted-foreground">Fecha</p><p className="font-medium">{saleDetail.cancelledAt ? formatDateTimeLabel(saleDetail.cancelledAt) : "Sin fecha"}</p></div>
                    <div><p className="text-muted-foreground">Motivo</p><p className="font-medium break-words">{saleDetail.cancellationReason || "Sin motivo registrado"}</p></div>
                    <div><p className="text-muted-foreground">Estado</p><p className="font-medium capitalize">{saleDetail.status}</p></div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Cancelar venta</CardTitle>
                    <CardDescription>
                      Esta accion genera un reverso en Caja, devuelve inventario si aplica y anula las comisiones ligadas sin borrar el historial.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-destructive/20 bg-background/80 p-3 text-sm text-muted-foreground">
                      <ul className="space-y-1">
                        <li>• La venta quedara marcada como cancelada.</li>
                        <li>• Caja recibira un movimiento compensatorio unico.</li>
                        <li>• Las existencias y comisiones se revertiran cuando existan.</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale-cancellation-reason">Motivo obligatorio</Label>
                      <Textarea
                        id="sale-cancellation-reason"
                        rows={3}
                        value={saleCancellationReason}
                        onChange={(event) => setSaleCancellationReason(event.target.value)}
                        placeholder="Explica por que se cancela esta venta"
                        data-testid="input-sale-cancellation-reason"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        onClick={() => cancelSaleMutation.mutate()}
                        disabled={cancelSaleMutation.isPending || saleCancellationReason.trim().length < 3}
                        data-testid="button-cancel-branch-sale"
                      >
                        {cancelSaleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Cancelar venta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Renglones vendidos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {saleDetail.items.map((item) => (
                    <div key={item.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium">{item.nameSnapshot}</p>
                          <p className="text-sm text-muted-foreground">{item.categorySnapshot || "Sin categoría"}</p>
                        </div>
                        <Badge variant="outline">{item.quantity} pza(s)</Badge>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                        <p>Unitario: {formatCurrency(item.unitPriceAmount)}</p>
                        <p>Descuento: {formatCurrency(item.discountAmount)}</p>
                        <p className="font-medium text-foreground">Total: {formatCurrency(item.lineTotalAmount)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pagos registrados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {saleDetail.payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="font-medium">{getPaymentMethodLabel(payment.paymentMethod)}</p>
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                        <p className="break-words">Fecha: {formatDateTimeLabel(payment.paidAt)}</p>
                        <p className="break-words">Referencia: {payment.reference || "Sin referencia"}</p>
                      </div>
                    </div>
                  ))}
                  {saleDetail.notes ? <p className="text-sm text-muted-foreground">Nota: {saleDetail.notes}</p> : null}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!commissionPaymentDetailId} onOpenChange={(open) => !open && setCommissionPaymentDetailId(null)}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de comisión pagada</DialogTitle>
            <DialogDescription>Movimiento automático enlazado a pagos de comisión y a Caja en modo solo lectura.</DialogDescription>
          </DialogHeader>
          {commissionPaymentDetailLoading || !commissionPaymentDetail ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 md:grid-cols-2">
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Vendedor</p><p className="mt-2 text-lg font-semibold">{commissionPaymentDetail.salespersonName || "Sin vendedor"}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Monto</p><p className="mt-2 text-lg font-semibold">{formatCurrency(commissionPaymentDetail.amount)}</p></CardContent></Card>
              </div>

              <Card>
                <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                  <div><p className="text-sm text-muted-foreground">Pagado el</p><p className="font-medium">{formatDateTimeLabel(commissionPaymentDetail.paidAt)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Método</p><p className="font-medium">{getPaymentMethodLabel(commissionPaymentDetail.paymentMethod)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Periodo</p><p className="font-medium">{commissionPaymentDetail.periodStart || commissionPaymentDetail.periodEnd ? `${commissionPaymentDetail.periodStart || "—"} al ${commissionPaymentDetail.periodEnd || "—"}` : "Sin periodo acotado"}</p></div>
                  <div><p className="text-sm text-muted-foreground">Asignado a comisiones</p><p className="font-medium">{formatCurrency(commissionPaymentDetail.totalAllocatedAmount)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Referencia</p><p className="font-medium">{commissionPaymentDetail.reference || "Sin referencia"}</p></div>
                  <div><p className="text-sm text-muted-foreground">Nota</p><p className="font-medium">{commissionPaymentDetail.notes || "Sin nota"}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Asignaciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {commissionPaymentDetail.allocations?.length ? commissionPaymentDetail.allocations.map((allocation) => (
                    <div key={allocation.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="font-medium">Comisión {allocation.commissionAccrualId.slice(0, 8)}...</p>
                        <p className="font-semibold">{formatCurrency(allocation.amountAllocated)}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Asignada {formatDateTimeLabel(allocation.createdAt)}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No hay asignaciones visibles para este pago.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
