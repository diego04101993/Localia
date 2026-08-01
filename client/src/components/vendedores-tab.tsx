import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Loader2,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateBranchCommercialQueries, invalidateBranchFinanceQueries } from "@/lib/branch-dashboard-cache";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Salesperson = {
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
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type SalespersonSummary = {
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
};

type Sale = {
  id: string;
  branchId: string;
  folio: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  clientEmail: string | null;
  sellerId: string | null;
  sellerUserId: string | null;
  sellerNameSnapshot: string | null;
  channel: string;
  status: string;
  totalAmount: number;
  createdAt: string;
};

type CommissionRuleType =
  | "percentage_all_sales"
  | "fixed_per_sale"
  | "percentage_product"
  | "fixed_product"
  | "percentage_category"
  | "bonus_monthly_goal";

type CommissionAccrualStatus =
  | "accrued"
  | "approved"
  | "partially_paid"
  | "paid"
  | "reversed";

type CommissionAccrualType = "sale" | "monthly_bonus";

type CommissionRule = {
  id: string;
  branchId: string;
  salespersonId: string;
  name: string;
  ruleType: CommissionRuleType;
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
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type CommissionAccrual = {
  id: string;
  branchId: string;
  salespersonId: string;
  saleId: string | null;
  saleItemId: string | null;
  commissionRuleId: string | null;
  accrualType: CommissionAccrualType;
  referenceKey: string;
  periodMonth: string | null;
  status: CommissionAccrualStatus;
  baseAmount: number;
  rateSnapshot: number | null;
  fixedAmountSnapshot: number | null;
  commissionAmount: number;
  salespersonNameSnapshot: string;
  ruleNameSnapshot: string | null;
  calculationSnapshot: any;
  accruedAt: string;
  approvedAt: string | null;
  paidAmount: number;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
};

type CommissionPaymentAllocation = {
  id: string;
  branchId: string;
  commissionPaymentId: string;
  commissionAccrualId: string;
  amountAllocated: number;
  createdAt: string;
};

type CommissionPayment = {
  id: string;
  branchId: string;
  salespersonId: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
  createdBy: string | null;
  createdAt: string;
  allocations?: CommissionPaymentAllocation[];
};

type SalespersonFocusRequest = {
  salespersonId: string;
  nonce: number;
};

type SalespersonRankingRow = {
  salespersonId: string;
  name: string;
  salesCount: number;
  totalSoldAmount: number;
  averageTicketAmount: number;
  productsSoldCount: number;
  generatedCommissionAmount: number;
  paidCommissionAmount: number;
  pendingCommissionAmount: number;
  monthlyGoalAmount: number | null;
  goalProgressPercent: number | null;
};

type CommercialProduct = {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
};

type SalespersonFormState = {
  userId: string;
  name: string;
  lastName: string;
  phone: string;
  email: string;
  employeeCode: string;
  roleLabel: string;
  monthlyGoalAmount: string;
  notes: string;
  isActive: boolean;
};

type CommissionRuleFormState = {
  name: string;
  ruleType: CommissionRuleType;
  percentageRate: string;
  fixedAmount: string;
  commercialProductId: string;
  category: string;
  minimumGoalAmount: string;
  bonusAmount: string;
  priority: string;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
};

type CommissionPaymentFormState = {
  amount: string;
  paymentMethod: string;
  reference: string;
  notes: string;
  periodStart: string;
  periodEnd: string;
};

type DetailTab = "summary" | "sales" | "rules" | "commissions" | "payments";

const NO_PRODUCT_VALUE = "__none__";

const RULE_TYPE_OPTIONS: Array<{ value: CommissionRuleType; label: string; description: string }> = [
  {
    value: "percentage_all_sales",
    label: "Porcentaje general",
    description: "Aplica un porcentaje sobre la venta cuando no exista una regla mas especifica.",
  },
  {
    value: "fixed_per_sale",
    label: "Monto fijo por venta",
    description: "Aplica un monto fijo por cada venta atribuida al vendedor.",
  },
  {
    value: "percentage_product",
    label: "Porcentaje por producto",
    description: "Sobrescribe la regla general para un producto comercial especifico.",
  },
  {
    value: "fixed_product",
    label: "Monto fijo por producto",
    description: "Aplica un monto fijo por unidad vendida de un producto especifico.",
  },
  {
    value: "percentage_category",
    label: "Porcentaje por categoria",
    description: "Aplica un porcentaje para una categoria comercial puntual.",
  },
  {
    value: "bonus_monthly_goal",
    label: "Bono por meta mensual",
    description: "Genera un bono unico cuando el vendedor supera la meta configurada del mes.",
  },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

function getCurrentMonth() {
  const now = new Date();
  const mx = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  return `${mx.getFullYear()}-${String(mx.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonth() {
  const now = new Date();
  const mx = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  mx.setMonth(mx.getMonth() - 1);
  return `${mx.getFullYear()}-${String(mx.getMonth() + 1).padStart(2, "0")}`;
}

function createInitialFormState(): SalespersonFormState {
  return {
    userId: "",
    name: "",
    lastName: "",
    phone: "",
    email: "",
    employeeCode: "",
    roleLabel: "",
    monthlyGoalAmount: "",
    notes: "",
    isActive: true,
  };
}

function createInitialRuleFormState(): CommissionRuleFormState {
  return {
    name: "",
    ruleType: "percentage_all_sales",
    percentageRate: "",
    fixedAmount: "",
    commercialProductId: NO_PRODUCT_VALUE,
    category: "",
    minimumGoalAmount: "",
    bonusAmount: "",
    priority: "0",
    isActive: true,
    validFrom: "",
    validUntil: "",
  };
}

function createInitialPaymentFormState(): CommissionPaymentFormState {
  return {
    amount: "",
    paymentMethod: "transferencia",
    reference: "",
    notes: "",
    periodStart: "",
    periodEnd: "",
  };
}

function formatCurrencyMx(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fullName(person: Pick<Salesperson, "name" | "lastName">) {
  return [person.name, person.lastName].filter(Boolean).join(" ").trim();
}

function salespeopleQueryKey(status: string) {
  return status === "all" ? ["/api/branch/salespeople"] : [`/api/branch/salespeople?status=${status}`];
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getRuleTypeLabel(ruleType: CommissionRuleType) {
  return RULE_TYPE_OPTIONS.find((option) => option.value === ruleType)?.label ?? ruleType;
}

function getRuleTypeDescription(ruleType: CommissionRuleType) {
  return RULE_TYPE_OPTIONS.find((option) => option.value === ruleType)?.description ?? "";
}

function getCommissionStatusLabel(status: CommissionAccrualStatus) {
  switch (status) {
    case "accrued":
      return "Devengada";
    case "approved":
      return "Aprobada";
    case "partially_paid":
      return "Pago parcial";
    case "paid":
      return "Pagada";
    case "reversed":
      return "Revertida";
    default:
      return status;
  }
}

function getCommissionStatusVariant(status: CommissionAccrualStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default";
    case "partially_paid":
      return "secondary";
    case "reversed":
      return "destructive";
    case "approved":
      return "outline";
    case "accrued":
    default:
      return "outline";
  }
}

function getPendingCommissionAmount(accrual: CommissionAccrual) {
  return Math.max(0, Number((accrual.commissionAmount - accrual.paidAmount).toFixed(2)));
}

function summarizeRuleTarget(rule: CommissionRule, productMap: Map<string, CommercialProduct>) {
  if (rule.ruleType === "percentage_product" || rule.ruleType === "fixed_product") {
    const product = rule.commercialProductId ? productMap.get(rule.commercialProductId) : null;
    return product ? product.name : "Producto vinculado";
  }
  if (rule.ruleType === "percentage_category") {
    return rule.category || "Categoria configurada";
  }
  if (rule.ruleType === "bonus_monthly_goal") {
    return rule.minimumGoalAmount != null
      ? `Meta ${formatCurrencyMx(rule.minimumGoalAmount)}`
      : "Meta mensual de venta";
  }
  return "Venta general";
}

function summarizeRuleValue(rule: CommissionRule) {
  if (rule.ruleType === "percentage_all_sales" || rule.ruleType === "percentage_product" || rule.ruleType === "percentage_category") {
    return rule.percentageRate != null ? `${rule.percentageRate}%` : "Sin porcentaje";
  }
  if (rule.ruleType === "fixed_per_sale" || rule.ruleType === "fixed_product") {
    return rule.fixedAmount != null ? formatCurrencyMx(rule.fixedAmount) : "Sin monto";
  }
  if (rule.ruleType === "bonus_monthly_goal") {
    return rule.bonusAmount != null ? formatCurrencyMx(rule.bonusAmount) : "Sin bono";
  }
  return "Sin valor";
}

export default function VendedoresTab({ focusRequest }: { focusRequest?: SalespersonFocusRequest | null } = {}) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Salesperson | null>(null);
  const [form, setForm] = useState<SalespersonFormState>(createInitialFormState());
  const [deleteTarget, setDeleteTarget] = useState<Salesperson | null>(null);

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [ruleForm, setRuleForm] = useState<CommissionRuleFormState>(createInitialRuleFormState());
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<CommissionRule | null>(null);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<CommissionPaymentFormState>(createInitialPaymentFormState());
  const [paymentRequestId, setPaymentRequestId] = useState(() => crypto.randomUUID());

  const listKey = salespeopleQueryKey(statusFilter);
  const listQuery = useQuery<Salesperson[]>({ queryKey: listKey });
  const rankingQuery = useQuery<SalespersonRankingRow[]>({
    queryKey: [`/api/branch/salespeople/ranking?month=${month}`],
  });

  const salespeople = listQuery.data ?? [];
  const filteredSalespeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return salespeople;
    return salespeople.filter((person) =>
      [person.name, person.lastName, person.email, person.phone, person.employeeCode, person.roleLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [salespeople, search]);

  useEffect(() => {
    if (!filteredSalespeople.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredSalespeople.some((item) => item.id === selectedId)) {
      setSelectedId(filteredSalespeople[0].id);
    }
  }, [filteredSalespeople, selectedId]);

  useEffect(() => {
    if (!focusRequest?.salespersonId) return;
    setSelectedId(focusRequest.salespersonId);
    setDetailTab("summary");
  }, [focusRequest]);

  const selectedSalesperson = useMemo(
    () => filteredSalespeople.find((item) => item.id === selectedId) ?? salespeople.find((item) => item.id === selectedId) ?? null,
    [filteredSalespeople, salespeople, selectedId],
  );

  const summaryQuery = useQuery<SalespersonSummary>({
    queryKey: selectedId ? [`/api/branch/salespeople/${selectedId}/summary?month=${month}`] : ["/api/branch/salespeople/summary/idle"],
    enabled: !!selectedId,
  });

  const salesQuery = useQuery<Sale[]>({
    queryKey: selectedId ? [`/api/branch/salespeople/${selectedId}/sales?month=${month}`] : ["/api/branch/salespeople/sales/idle"],
    enabled: !!selectedId,
  });

  const rulesQuery = useQuery<CommissionRule[]>({
    queryKey: selectedId ? [`/api/branch/salespeople/${selectedId}/commission-rules`] : ["/api/branch/salespeople/commission-rules/idle"],
    enabled: !!selectedId,
  });

  const commissionsQuery = useQuery<CommissionAccrual[]>({
    queryKey: selectedId ? [`/api/branch/salespeople/${selectedId}/commissions?month=${month}`] : ["/api/branch/salespeople/commissions/idle"],
    enabled: !!selectedId,
  });

  const paymentsQuery = useQuery<CommissionPayment[]>({
    queryKey: selectedId ? [`/api/branch/salespeople/${selectedId}/commission-payments?month=${month}`] : ["/api/branch/salespeople/commission-payments/idle"],
    enabled: !!selectedId,
  });

  const productsQuery = useQuery<CommercialProduct[]>({
    queryKey: ["/api/branch/commercial-products"],
    enabled: !!selectedId,
  });

  const commercialProducts = productsQuery.data ?? [];
  const commercialProductMap = useMemo(
    () => new Map(commercialProducts.map((product) => [product.id, product])),
    [commercialProducts],
  );

  const commissionTotals = useMemo(() => {
    const payments = paymentsQuery.data ?? [];
    return payments.reduce(
      (accumulator, payment) => {
        accumulator.totalPaid += payment.amount;
        accumulator.totalAllocations += (payment.allocations ?? []).reduce((sum, allocation) => sum + allocation.amountAllocated, 0);
        return accumulator;
      },
      { totalPaid: 0, totalAllocations: 0 },
    );
  }, [paymentsQuery.data]);

  const invalidateSalespeople = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey)
        && typeof query.queryKey[0] === "string"
        && query.queryKey[0].startsWith("/api/branch/salespeople"),
    });
  };

  const invalidateSalespersonDetails = async (salespersonId: string | null) => {
    if (!salespersonId) return;
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey)
        && typeof query.queryKey[0] === "string"
        && query.queryKey[0].startsWith(`/api/branch/salespeople/${salespersonId}/`),
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: SalespersonFormState) => {
      const body = {
        userId: payload.userId || null,
        name: payload.name,
        lastName: payload.lastName || null,
        phone: payload.phone || null,
        email: payload.email || null,
        employeeCode: payload.employeeCode || null,
        roleLabel: payload.roleLabel || null,
        monthlyGoalAmount: payload.monthlyGoalAmount ? Number(payload.monthlyGoalAmount) : null,
        notes: payload.notes || null,
        isActive: payload.isActive,
      };
      const response = editing
        ? await apiRequest("PATCH", `/api/branch/salespeople/${editing.id}`, body)
        : await apiRequest("POST", "/api/branch/salespeople", body);
      return response.json() as Promise<Salesperson>;
    },
    onSuccess: async (saved) => {
      await invalidateSalespeople();
      setDialogOpen(false);
      setEditing(null);
      setForm(createInitialFormState());
      setSelectedId(saved.id);
      toast({ title: editing ? "Vendedor actualizado" : "Vendedor creado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo guardar el vendedor"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/salespeople/${id}`);
    },
    onSuccess: async () => {
      await invalidateSalespeople();
      setDeleteTarget(null);
      toast({ title: "Vendedor eliminado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo eliminar el vendedor"),
        variant: "destructive",
      });
    },
  });

  const ruleSaveMutation = useMutation({
    mutationFn: async (payload: CommissionRuleFormState) => {
      if (!selectedId && !editingRule) {
        throw new Error("Selecciona un vendedor antes de guardar una regla");
      }

      const body = {
        name: payload.name.trim(),
        ruleType: payload.ruleType,
        percentageRate: parseOptionalNumber(payload.percentageRate) ?? null,
        fixedAmount: parseOptionalNumber(payload.fixedAmount) ?? null,
        commercialProductId: payload.commercialProductId === NO_PRODUCT_VALUE ? null : payload.commercialProductId || null,
        category: payload.category.trim() || null,
        minimumGoalAmount: parseOptionalNumber(payload.minimumGoalAmount) ?? null,
        bonusAmount: parseOptionalNumber(payload.bonusAmount) ?? null,
        priority: parseOptionalInteger(payload.priority) ?? 0,
        isActive: payload.isActive,
        validFrom: payload.validFrom || null,
        validUntil: payload.validUntil || null,
      };

      const response = editingRule
        ? await apiRequest("PATCH", `/api/branch/commission-rules/${editingRule.id}`, body)
        : await apiRequest("POST", `/api/branch/salespeople/${selectedId}/commission-rules`, body);

      return response.json() as Promise<CommissionRule>;
    },
    onSuccess: async () => {
      await invalidateSalespersonDetails(selectedId);
      setRuleDialogOpen(false);
      setEditingRule(null);
      setRuleForm(createInitialRuleFormState());
      toast({ title: editingRule ? "Regla actualizada" : "Regla creada" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo guardar la regla de comision"),
        variant: "destructive",
      });
    },
  });

  const ruleToggleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/branch/commission-rules/${ruleId}`, { isActive });
      return response.json() as Promise<CommissionRule>;
    },
    onSuccess: async (_, variables) => {
      await invalidateSalespersonDetails(selectedId);
      toast({ title: variables.isActive ? "Regla activada" : "Regla inactivada" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo cambiar el estado de la regla"),
        variant: "destructive",
      });
    },
  });

  const ruleDeleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiRequest("DELETE", `/api/branch/commission-rules/${ruleId}`);
    },
    onSuccess: async () => {
      await invalidateSalespersonDetails(selectedId);
      setDeleteRuleTarget(null);
      toast({ title: "Regla eliminada" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo eliminar la regla"),
        variant: "destructive",
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (payload: CommissionPaymentFormState) => {
      if (!selectedId) {
        throw new Error("Selecciona un vendedor antes de registrar un pago");
      }

      const amount = Number.parseFloat(payload.amount);
      const body = {
        amount,
        paymentMethod: payload.paymentMethod,
        idempotencyKey: paymentRequestId,
        reference: payload.reference.trim() || null,
        notes: payload.notes.trim() || null,
        periodStart: payload.periodStart || null,
        periodEnd: payload.periodEnd || null,
      };

      const response = await apiRequest("POST", `/api/branch/salespeople/${selectedId}/commission-payments`, body);
      return response.json() as Promise<CommissionPayment>;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateSalespersonDetails(selectedId),
        invalidateBranchFinanceQueries(),
        invalidateBranchCommercialQueries({ salespersonId: selectedId }),
      ]);
      setPaymentDialogOpen(false);
      setPaymentForm(createInitialPaymentFormState());
      setPaymentRequestId(crypto.randomUUID());
      toast({ title: "Pago registrado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo registrar el pago"),
        variant: "destructive",
      });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(createInitialFormState());
    setDialogOpen(true);
  };

  const openEdit = (person: Salesperson) => {
    setEditing(person);
    setForm({
      userId: person.userId ?? "",
      name: person.name,
      lastName: person.lastName ?? "",
      phone: person.phone ?? "",
      email: person.email ?? "",
      employeeCode: person.employeeCode ?? "",
      roleLabel: person.roleLabel ?? "",
      monthlyGoalAmount: person.monthlyGoalAmount == null ? "" : String(person.monthlyGoalAmount),
      notes: person.notes ?? "",
      isActive: person.isActive,
    });
    setDialogOpen(true);
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm(createInitialRuleFormState());
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule: CommissionRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      ruleType: rule.ruleType,
      percentageRate: rule.percentageRate == null ? "" : String(rule.percentageRate),
      fixedAmount: rule.fixedAmount == null ? "" : String(rule.fixedAmount),
      commercialProductId: rule.commercialProductId ?? NO_PRODUCT_VALUE,
      category: rule.category ?? "",
      minimumGoalAmount: rule.minimumGoalAmount == null ? "" : String(rule.minimumGoalAmount),
      bonusAmount: rule.bonusAmount == null ? "" : String(rule.bonusAmount),
      priority: String(rule.priority ?? 0),
      isActive: rule.isActive,
      validFrom: rule.validFrom ? String(rule.validFrom).slice(0, 10) : "",
      validUntil: rule.validUntil ? String(rule.validUntil).slice(0, 10) : "",
    });
    setRuleDialogOpen(true);
  };

  const selectedRuleType = ruleForm.ruleType;
  const ruleRequiresPercentage =
    selectedRuleType === "percentage_all_sales"
    || selectedRuleType === "percentage_product"
    || selectedRuleType === "percentage_category";
  const ruleRequiresFixed =
    selectedRuleType === "fixed_per_sale"
    || selectedRuleType === "fixed_product";
  const ruleRequiresProduct =
    selectedRuleType === "percentage_product"
    || selectedRuleType === "fixed_product";
  const ruleRequiresCategory = selectedRuleType === "percentage_category";
  const ruleRequiresBonusGoal = selectedRuleType === "bonus_monthly_goal";

  return (
    <div className="space-y-4" data-testid="tab-vendedores">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Nucleo comercial</p>
            <h2 className="text-2xl font-semibold tracking-tight">Vendedores</h2>
            <p className="text-sm text-muted-foreground">
              Atribuye ventas, calcula comisiones sobre branch_sales y registra pagos sin mezclar este modulo con Caja ni profesores.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo vendedor
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vendedores visibles</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{salespeople.length}</span>
              <Badge variant="outline">Sucursal</Badge>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Con meta mensual</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{salespeople.filter((item) => (item.monthlyGoalAmount ?? 0) > 0).length}</span>
              <Badge variant="secondary">Preparado</Badge>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mes consultado</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-2xl font-semibold">{month}</span>
              <Badge variant="outline">Metricas</Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ranking mensual</CardTitle>
          <CardDescription>
            Vista rápida de ventas, ticket promedio y comisión pendiente del mes {month}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rankingQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : !(rankingQuery.data ?? []).length ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium">Sin ranking disponible todavía</p>
              <p className="mt-1 text-sm text-muted-foreground">Cuando haya ventas atribuidas, aquí verás a los vendedores con mejor rendimiento.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(rankingQuery.data ?? []).slice(0, 4).map((person, index) => (
                <button
                  key={person.salespersonId}
                  type="button"
                  onClick={() => {
                    setSelectedId(person.salespersonId);
                    setDetailTab("summary");
                  }}
                  className={`rounded-2xl border p-4 text-left transition-colors ${selectedId === person.salespersonId ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20 hover:bg-muted/40"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{person.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Lugar #{index + 1}</p>
                    </div>
                    <Badge variant="outline">{person.salesCount}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p>Vendido: <span className="font-medium text-foreground">{formatCurrencyMx(person.totalSoldAmount)}</span></p>
                    <p>Ticket: <span className="font-medium text-foreground">{formatCurrencyMx(person.averageTicketAmount)}</span></p>
                    <p>Pendiente: <span className="font-medium text-foreground">{formatCurrencyMx(person.pendingCommissionAmount)}</span></p>
                    <p>Productos: <span className="font-medium text-foreground">{person.productsSoldCount}</span></p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-border/60">
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Equipo comercial</CardTitle>
              <CardDescription>Listado independiente por sucursal. No interfiere con profesores ni con usuarios de acceso.</CardDescription>
            </div>
            <div className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar vendedor" className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {listQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : filteredSalespeople.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                <p className="text-sm font-medium">Aún no hay vendedores</p>
                <p className="mt-1 text-sm text-muted-foreground">Puedes crear vendedores con o sin usuario vinculado.</p>
              </div>
            ) : (
              filteredSalespeople.map((person) => {
                const active = selectedId === person.id;
                return (
                  <div
                    key={person.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(person.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(person.id);
                      }
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20 hover:bg-muted/40"}`}
                    data-testid={`salesperson-card-${person.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{fullName(person)}</p>
                        <p className="truncate text-sm text-muted-foreground">{person.roleLabel || "Sin rol comercial"}</p>
                      </div>
                      <Badge variant={person.isActive ? "default" : "secondary"}>
                        {person.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                      <p className="truncate">{person.phone || "Sin teléfono"}</p>
                      <p className="truncate">{person.email || "Sin correo"}</p>
                      <p className="truncate">{person.employeeCode || "Sin código interno"}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(person);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(person);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>{selectedSalesperson ? fullName(selectedSalesperson) : "Selecciona un vendedor"}</CardTitle>
                  <CardDescription>
                    {selectedSalesperson
                      ? `Resumen comercial y de comisiones para ${month}.`
                      : "Elige un vendedor de la lista para ver ventas, reglas, devengos y pagos."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={month === getCurrentMonth() ? "default" : "outline"} onClick={() => setMonth(getCurrentMonth())}>Mes actual</Button>
                  <Button variant={month === getPreviousMonth() ? "default" : "outline"} onClick={() => setMonth(getPreviousMonth())}>Mes anterior</Button>
                  <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-[180px]" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as DetailTab)} className="space-y-4">
                <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-muted/40 p-1">
                  <TabsTrigger value="summary">Resumen</TabsTrigger>
                  <TabsTrigger value="sales">Ventas</TabsTrigger>
                  <TabsTrigger value="rules">Reglas de comision</TabsTrigger>
                  <TabsTrigger value="commissions">Comisiones</TabsTrigger>
                  <TabsTrigger value="payments">Pagos</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  {!selectedId ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Selecciona un vendedor para ver su resumen mensual.
                    </div>
                  ) : summaryQuery.isLoading ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : summaryQuery.data ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total vendido</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.totalSoldAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ventas</p>
                            <p className="mt-2 text-2xl font-semibold">{summaryQuery.data.salesCount}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ticket promedio</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.averageTicketAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Productos vendidos</p>
                            <p className="mt-2 text-2xl font-semibold">{summaryQuery.data.productsSoldCount}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Comisión generada</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.generatedCommissionAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aprobada</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.approvedCommissionAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pagada</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.paidCommissionAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pendiente</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.pendingCommissionAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Revertida</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.reversedCommissionAmount)}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-border/60">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bono del mes</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.bonusGeneratedAmount)}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1.4fr_minmax(0,1fr)]">
                        <Card className="border-border/60">
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-primary" />
                                <p className="font-medium">Meta mensual de venta</p>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {summaryQuery.data.monthlyGoalAmount != null
                                  ? `${formatCurrencyMx(summaryQuery.data.totalSoldAmount)} / ${formatCurrencyMx(summaryQuery.data.monthlyGoalAmount)}`
                                  : "Sin meta configurada"}
                              </p>
                            </div>
                            <Progress value={summaryQuery.data.goalProgressPercent ?? 0} />
                            <p className="text-xs text-muted-foreground">
                              {summaryQuery.data.goalProgressPercent != null
                                ? `${summaryQuery.data.goalProgressPercent}% de avance del mes`
                                : "Configura una meta monetaria para empezar a medir avance."}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="border-border/60">
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-center gap-2">
                              <BadgeDollarSign className="h-4 w-4 text-primary" />
                              <p className="font-medium">Prioridad de calculo</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Producto o categoria sustituyen la regla general. El bono mensual se calcula aparte y queda guardado con snapshot historico.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">General</Badge>
                              <Badge variant="outline">Producto/Categoria</Badge>
                              <Badge variant="secondary">Bono mensual</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  ) : null}
                </TabsContent>

                <TabsContent value="sales" className="space-y-4">
                  {!selectedId ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Selecciona un vendedor para ver sus ventas.
                    </div>
                  ) : salesQuery.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full rounded-2xl" />
                      <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                  ) : (salesQuery.data ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm font-medium">Sin ventas atribuidas en este periodo</p>
                      <p className="mt-1 text-sm text-muted-foreground">Las ventas nuevas desde Productos pueden asignarse opcionalmente a este vendedor.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {(salesQuery.data ?? []).map((sale) => (
                          <Card key={sale.id} className="border-border/60">
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">{sale.folio}</p>
                                  <p className="truncate text-sm text-muted-foreground">{sale.clientDisplayName || "Venta sin cliente"}</p>
                                </div>
                                <Badge variant="outline">{sale.status}</Badge>
                              </div>
                              <div className="grid gap-1 text-sm text-muted-foreground">
                                <p>{formatDateTime(sale.createdAt)}</p>
                                <p>{sale.sellerNameSnapshot || "Sin snapshot"}</p>
                              </div>
                              <p className="text-lg font-semibold">{formatCurrencyMx(sale.totalAmount)}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Folio</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Vendedor</TableHead>
                              <TableHead>Canal</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(salesQuery.data ?? []).map((sale) => (
                              <TableRow key={sale.id}>
                                <TableCell className="font-medium">{sale.folio}</TableCell>
                                <TableCell>{sale.clientDisplayName || "Venta sin cliente"}</TableCell>
                                <TableCell>{sale.sellerNameSnapshot || "Sin vendedor"}</TableCell>
                                <TableCell>{sale.channel}</TableCell>
                                <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                                <TableCell>{formatCurrencyMx(sale.totalAmount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="rules" className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Reglas activas e historicas</p>
                      <p className="text-sm text-muted-foreground">Las reglas nuevas no recalculan ventas viejas. Cada comision guarda el snapshot con el que se genero.</p>
                    </div>
                    <Button onClick={openCreateRule} disabled={!selectedId}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva regla
                    </Button>
                  </div>

                  {!selectedId ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Selecciona un vendedor para administrar sus reglas de comision.
                    </div>
                  ) : rulesQuery.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full rounded-2xl" />
                      <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                  ) : (rulesQuery.data ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm font-medium">Aún no hay reglas configuradas</p>
                      <p className="mt-1 text-sm text-muted-foreground">Puedes empezar con un porcentaje general y luego agregar reglas por producto, categoria o bono.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {(rulesQuery.data ?? []).map((rule) => (
                          <Card key={rule.id} className="border-border/60">
                            <CardContent className="space-y-3 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">{rule.name}</p>
                                  <p className="text-sm text-muted-foreground">{getRuleTypeLabel(rule.ruleType)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Activa" : "Inactiva"}</Badge>
                                  <Badge variant="outline">Prioridad {rule.priority}</Badge>
                                </div>
                              </div>
                              <div className="grid gap-1 text-sm text-muted-foreground">
                                <p>{summarizeRuleValue(rule)}</p>
                                <p>{summarizeRuleTarget(rule, commercialProductMap)}</p>
                                <p>{rule.validFrom || rule.validUntil ? `${formatDateOnly(rule.validFrom)} - ${formatDateOnly(rule.validUntil)}` : "Sin vigencia limitada"}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => openEditRule(rule)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => ruleToggleMutation.mutate({ ruleId: rule.id, isActive: !rule.isActive })}
                                  disabled={ruleToggleMutation.isPending}
                                >
                                  {rule.isActive ? "Inactivar" : "Activar"}
                                </Button>
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteRuleTarget(rule)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Regla</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Alcance</TableHead>
                              <TableHead>Vigencia</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(rulesQuery.data ?? []).map((rule) => (
                              <TableRow key={rule.id}>
                                <TableCell className="font-medium">{rule.name}</TableCell>
                                <TableCell>{getRuleTypeLabel(rule.ruleType)}</TableCell>
                                <TableCell>{summarizeRuleValue(rule)}</TableCell>
                                <TableCell>{summarizeRuleTarget(rule, commercialProductMap)}</TableCell>
                                <TableCell>
                                  {rule.validFrom || rule.validUntil
                                    ? `${formatDateOnly(rule.validFrom)} - ${formatDateOnly(rule.validUntil)}`
                                    : "Sin vigencia limitada"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Activa" : "Inactiva"}</Badge>
                                    <Badge variant="outline">P{rule.priority}</Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openEditRule(rule)}>Editar</Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => ruleToggleMutation.mutate({ ruleId: rule.id, isActive: !rule.isActive })}
                                      disabled={ruleToggleMutation.isPending}
                                    >
                                      {rule.isActive ? "Inactivar" : "Activar"}
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteRuleTarget(rule)}>Eliminar</Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="commissions" className="space-y-4">
                  {!selectedId ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Selecciona un vendedor para ver sus comisiones devengadas.
                    </div>
                  ) : commissionsQuery.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full rounded-2xl" />
                      <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                  ) : (commissionsQuery.data ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm font-medium">Sin comisiones en este periodo</p>
                      <p className="mt-1 text-sm text-muted-foreground">Solo se calculan sobre ventas nuevas de branch_sales con vendedor asignado y regla activa aplicable.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {(commissionsQuery.data ?? []).map((accrual) => (
                          <Card key={accrual.id} className="border-border/60">
                            <CardContent className="space-y-3 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">{accrual.ruleNameSnapshot || (accrual.accrualType === "monthly_bonus" ? "Bono mensual" : "Comisión de venta")}</p>
                                  <p className="text-sm text-muted-foreground">{formatDateTime(accrual.accruedAt)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant={getCommissionStatusVariant(accrual.status)}>{getCommissionStatusLabel(accrual.status)}</Badge>
                                  <Badge variant="outline">{accrual.accrualType === "monthly_bonus" ? "Bono" : "Venta"}</Badge>
                                </div>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Base</p>
                                  <p className="font-medium">{formatCurrencyMx(accrual.baseAmount)}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Comisión</p>
                                  <p className="font-medium">{formatCurrencyMx(accrual.commissionAmount)}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pendiente</p>
                                  <p className="font-medium">{formatCurrencyMx(getPendingCommissionAmount(accrual))}</p>
                                </div>
                              </div>
                              <div className="grid gap-1 text-sm text-muted-foreground">
                                <p>Pagado: {formatCurrencyMx(accrual.paidAmount)}</p>
                                <p>{accrual.saleId ? `Venta ligada: ${accrual.saleId.slice(0, 8)}...` : "Sin venta ligada"}</p>
                                {accrual.reversalReason ? <p>Reversion: {accrual.reversalReason}</p> : null}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Regla</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Base</TableHead>
                              <TableHead>Comisión</TableHead>
                              <TableHead>Pagado</TableHead>
                              <TableHead>Pendiente</TableHead>
                              <TableHead>Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(commissionsQuery.data ?? []).map((accrual) => (
                              <TableRow key={accrual.id}>
                                <TableCell>{formatDateTime(accrual.accruedAt)}</TableCell>
                                <TableCell>{accrual.ruleNameSnapshot || "Regla no disponible"}</TableCell>
                                <TableCell>{accrual.accrualType === "monthly_bonus" ? "Bono" : "Venta"}</TableCell>
                                <TableCell>{formatCurrencyMx(accrual.baseAmount)}</TableCell>
                                <TableCell>{formatCurrencyMx(accrual.commissionAmount)}</TableCell>
                                <TableCell>{formatCurrencyMx(accrual.paidAmount)}</TableCell>
                                <TableCell>{formatCurrencyMx(getPendingCommissionAmount(accrual))}</TableCell>
                                <TableCell>
                                  <Badge variant={getCommissionStatusVariant(accrual.status)}>{getCommissionStatusLabel(accrual.status)}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Pagos registrados</p>
                      <p className="text-sm text-muted-foreground">En esta fase solo se registran en el ledger de comisiones. No se duplican automaticamente en Caja.</p>
                    </div>
                    <Button onClick={() => setPaymentDialogOpen(true)} disabled={!selectedId}>
                      <Plus className="mr-2 h-4 w-4" />
                      Registrar pago
                    </Button>
                  </div>

                  {selectedId && summaryQuery.data ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <Card className="border-border/60">
                        <CardContent className="p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pagado en el mes</p>
                          <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.paidCommissionAmount)}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/60">
                        <CardContent className="p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pendiente</p>
                          <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(summaryQuery.data.pendingCommissionAmount)}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/60">
                        <CardContent className="p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pagos registrados</p>
                          <p className="mt-2 text-2xl font-semibold">{formatCurrencyMx(commissionTotals.totalPaid)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Asignado a comisiones: {formatCurrencyMx(commissionTotals.totalAllocations)}</p>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}

                  {!selectedId ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Selecciona un vendedor para registrar y consultar pagos.
                    </div>
                  ) : paymentsQuery.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full rounded-2xl" />
                      <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                  ) : (paymentsQuery.data ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm font-medium">Aún no hay pagos registrados</p>
                      <p className="mt-1 text-sm text-muted-foreground">Cuando registres un pago se asignara primero a las comisiones pendientes mas antiguas del periodo filtrado.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {(paymentsQuery.data ?? []).map((payment) => (
                          <Card key={payment.id} className="border-border/60">
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">{formatCurrencyMx(payment.amount)}</p>
                                  <p className="text-sm text-muted-foreground">{formatDateTime(payment.paidAt)}</p>
                                </div>
                                <Badge variant="outline">{payment.paymentMethod}</Badge>
                              </div>
                              <div className="grid gap-1 text-sm text-muted-foreground">
                                <p>Asignaciones: {(payment.allocations ?? []).length}</p>
                                <p>{payment.reference || "Sin referencia"}</p>
                                <p>
                                  {payment.periodStart || payment.periodEnd
                                    ? `${formatDateOnly(payment.periodStart)} - ${formatDateOnly(payment.periodEnd)}`
                                    : "Sin periodo acotado"}
                                </p>
                                {payment.notes ? <p>{payment.notes}</p> : null}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Método</TableHead>
                              <TableHead>Referencia</TableHead>
                              <TableHead>Periodo</TableHead>
                              <TableHead>Asignaciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(paymentsQuery.data ?? []).map((payment) => (
                              <TableRow key={payment.id}>
                                <TableCell>{formatDateTime(payment.paidAt)}</TableCell>
                                <TableCell>{formatCurrencyMx(payment.amount)}</TableCell>
                                <TableCell>{payment.paymentMethod}</TableCell>
                                <TableCell>{payment.reference || "Sin referencia"}</TableCell>
                                <TableCell>
                                  {payment.periodStart || payment.periodEnd
                                    ? `${formatDateOnly(payment.periodStart)} - ${formatDateOnly(payment.periodEnd)}`
                                    : "Sin periodo acotado"}
                                </TableCell>
                                <TableCell>{(payment.allocations ?? []).length}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm(createInitialFormState());
          }
        }}
      >
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar vendedor" : "Nuevo vendedor"}</DialogTitle>
            <DialogDescription>Puede ser independiente, sin login, o vincularse a un usuario de sucursal mas adelante.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Correo (opcional)</Label>
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Código interno (opcional)</Label>
                <Input value={form.employeeCode} onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rol comercial</Label>
                <Input value={form.roleLabel} onChange={(event) => setForm((current) => ({ ...current, roleLabel: event.target.value }))} placeholder="Ej. Asesor comercial, ventas mostrador, ejecutivo" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meta mensual de venta</Label>
              <Input type="number" min="0" step="0.01" value={form.monthlyGoalAmount} onChange={(event) => setForm((current) => ({ ...current, monthlyGoalAmount: event.target.value }))} placeholder="Ej. 20,000" />
              <p className="text-xs text-muted-foreground">Monto total que se espera que el vendedor alcance durante el mes. $ MXN</p>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Vendedor activo</p>
                <p className="text-xs text-muted-foreground">Si lo inactivas ya no aparecerá para nuevas ventas.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Guardar cambios" : "Crear vendedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ruleDialogOpen}
        onOpenChange={(open) => {
          setRuleDialogOpen(open);
          if (!open) {
            setEditingRule(null);
            setRuleForm(createInitialRuleFormState());
          }
        }}
      >
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar regla de comision" : "Nueva regla de comision"}</DialogTitle>
            <DialogDescription>{getRuleTypeDescription(selectedRuleType)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre de la regla</Label>
                <Input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. 5% general, Bono meta julio" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={ruleForm.ruleType} onValueChange={(value: CommissionRuleType) => setRuleForm((current) => ({ ...current, ruleType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(ruleRequiresPercentage || ruleRequiresFixed) ? (
              <div className="grid gap-3 md:grid-cols-2">
                {ruleRequiresPercentage ? (
                  <div className="space-y-2">
                    <Label>Porcentaje</Label>
                    <Input type="number" min="0" step="0.0001" value={ruleForm.percentageRate} onChange={(event) => setRuleForm((current) => ({ ...current, percentageRate: event.target.value }))} placeholder="Ej. 5" />
                  </div>
                ) : null}
                {ruleRequiresFixed ? (
                  <div className="space-y-2">
                    <Label>Monto fijo</Label>
                    <Input type="number" min="0" step="0.01" value={ruleForm.fixedAmount} onChange={(event) => setRuleForm((current) => ({ ...current, fixedAmount: event.target.value }))} placeholder="Ej. 50" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {ruleRequiresProduct ? (
              <div className="space-y-2">
                <Label>Producto comercial</Label>
                <Select value={ruleForm.commercialProductId} onValueChange={(value) => setRuleForm((current) => ({ ...current, commercialProductId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PRODUCT_VALUE}>Seleccionar despues</SelectItem>
                    {commercialProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} · {product.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {ruleRequiresCategory ? (
              <div className="space-y-2">
                <Label>Categoria comercial</Label>
                <Input value={ruleForm.category} onChange={(event) => setRuleForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ej. seguros, llantas, accesorios" />
              </div>
            ) : null}

            {ruleRequiresBonusGoal ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Meta minima del mes</Label>
                  <Input type="number" min="0" step="0.01" value={ruleForm.minimumGoalAmount} onChange={(event) => setRuleForm((current) => ({ ...current, minimumGoalAmount: event.target.value }))} placeholder="Ej. 100000" />
                </div>
                <div className="space-y-2">
                  <Label>Bono al cumplirla</Label>
                  <Input type="number" min="0" step="0.01" value={ruleForm.bonusAmount} onChange={(event) => setRuleForm((current) => ({ ...current, bonusAmount: event.target.value }))} placeholder="Ej. 2000" />
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Input type="number" min="0" step="1" value={ruleForm.priority} onChange={(event) => setRuleForm((current) => ({ ...current, priority: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vigente desde</Label>
                <Input type="date" value={ruleForm.validFrom} onChange={(event) => setRuleForm((current) => ({ ...current, validFrom: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vigente hasta</Label>
                <Input type="date" value={ruleForm.validUntil} onChange={(event) => setRuleForm((current) => ({ ...current, validUntil: event.target.value }))} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Regla activa</p>
                <p className="text-xs text-muted-foreground">Si la desactivas, deja de generar comisiones nuevas pero conserva el historial ya devengado.</p>
              </div>
              <Switch checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => ruleSaveMutation.mutate(ruleForm)} disabled={!ruleForm.name.trim() || ruleSaveMutation.isPending}>
              {ruleSaveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingRule ? "Guardar cambios" : "Crear regla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (open) {
            setPaymentRequestId(crypto.randomUUID());
          }
          if (!open) {
            setPaymentForm(createInitialPaymentFormState());
            setPaymentRequestId(crypto.randomUUID());
          }
        }}
      >
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar pago de comision</DialogTitle>
            <DialogDescription>El sistema lo asigna a las comisiones pendientes mas antiguas del vendedor dentro del rango indicado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Monto a pagar</Label>
                <Input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={paymentForm.paymentMethod} onValueChange={(value) => setPaymentForm((current) => ({ ...current, paymentMethod: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Periodo desde</Label>
                <Input type="date" value={paymentForm.periodStart} onChange={(event) => setPaymentForm((current) => ({ ...current, periodStart: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Periodo hasta</Label>
                <Input type="date" value={paymentForm.periodEnd} onChange={(event) => setPaymentForm((current) => ({ ...current, periodEnd: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Ej. transferencia 3421" />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea rows={4} value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => paymentMutation.mutate(paymentForm)}
              disabled={!paymentForm.amount.trim() || paymentMutation.isPending}
            >
              {paymentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar vendedor</AlertDialogTitle>
            <AlertDialogDescription>
              Se ocultara del modulo y ya no podra atribuir nuevas ventas. El historial conserva su snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteRuleTarget} onOpenChange={(open) => !open && setDeleteRuleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar regla</AlertDialogTitle>
            <AlertDialogDescription>
              La regla dejara de aparecer para nuevas ventas, pero las comisiones historicas conservaran el snapshot ya devengado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRuleTarget && ruleDeleteMutation.mutate(deleteRuleTarget.id)}>
              {ruleDeleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
