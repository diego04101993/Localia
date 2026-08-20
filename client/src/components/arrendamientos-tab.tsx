import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  CreditCard,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import { downloadAuthenticatedFileRequest } from "@/lib/download-file";
import { invalidateBranchFinanceQueries } from "@/lib/branch-dashboard-cache";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  leaseQuoteDownPaymentTypeValues,
  leaseQuoteTermPresets,
  type LeaseQuotePreview,
  type LeaseQuoteDownPaymentType,
  type LeaseQuoteRequest,
} from "@shared/lease-quote";

export type LeaseContractFocusRequest = {
  leaseContractId: string;
  clientUserId?: string | null;
  nonce: number;
};

type LeaseContractStatus = "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED";
type LeaseFilter = "all" | LeaseContractStatus;
type LeaseQuoteTaxMode = "tax_exempt" | "tax_included" | "tax_added";

type LeaseContractSummary = {
  id: string;
  branchId: string;
  membershipId: string | null;
  planId: string | null;
  clientUserId: string | null;
  clientName: string | null;
  clientLastName: string | null;
  clientDisplayName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  planName: string | null;
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
  derivedStatus: LeaseContractStatus;
  isOpenForLifecycleGuards: boolean;
  leasedItemDescription: string;
  notes: string | null;
  capturedPriceCents: number;
  assetValueCents: number | null;
  assetSubtotalBeforeTaxCents: number | null;
  assetTaxableSubtotalCents: number | null;
  assetTaxTotalCents: number | null;
  assetFinalTotalCents: number | null;
  downPaymentType: LeaseQuoteDownPaymentType | null;
  downPaymentRate: number | null;
  downPaymentInputCents: number | null;
  downPaymentSubtotalBeforeTaxCents: number | null;
  downPaymentTaxableSubtotalCents: number | null;
  downPaymentTaxTotalCents: number | null;
  downPaymentFinalTotalCents: number | null;
  financedPrincipalBeforeTaxCents: number | null;
  financialSurchargeRate: number | null;
  financialSurchargeTotalCents: number | null;
  financedSubtotalBeforeTaxCents: number | null;
  financedTaxableSubtotalCents: number | null;
  financedTaxTotalCents: number | null;
  financedFinalTotalCents: number | null;
  contractFinalTotalCents: number | null;
  taxModeSnapshot: LeaseQuoteTaxMode | null;
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
  nextDueDate: string | null;
  nextPendingInstallment: {
    id: string;
    installmentNumber: number;
    dueDate: string;
    subtotalBeforeTaxCents: number;
    taxTotalCents: number;
    finalTotalCents: number;
  } | null;
  pendingContractBalanceCents: number;
  totalPaidInstallmentAmountCents: number | null;
  hasInstallmentSchedule: boolean;
  hasFinancialHistory: boolean;
  canEditFinancialTerms: boolean;
  canEditAdministrativeDetails: boolean;
  canDelete: boolean;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  installments?: BranchLeaseInstallmentSummary[];
};

type BranchClientOption = {
  userId: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  membershipId: string;
  membershipStatus: string;
  clientStatus: string;
  source: string;
};

type BranchLeaseInstallmentSummary = {
  id: string;
  branchId: string;
  leaseContractId: string;
  installmentNumber: number;
  dueDate: string;
  subtotalBeforeTaxCents: number;
  taxableSubtotalCents: number;
  taxTotalCents: number;
  finalTotalCents: number;
  currencyCode: string;
  paymentSource: "webcool" | "external" | null;
  paidAt: string | null;
  paymentMethod: string | null;
  financeEntryId: string | null;
  chargeEventId: string | null;
  recordedByUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeaseQuotePreviewResponse = {
  client: {
    userId: string;
    displayName: string;
    email: string | null;
    phone: string | null;
  };
  quote: LeaseQuotePreview;
  leasedItemDescription: string;
  notes: string | null;
};

type CreateLeaseContractResponse = {
  leaseContractId: string;
  leaseContract: LeaseContractSummary | null;
};

type UpdateLeaseContractResponse = {
  leaseContract: LeaseContractSummary;
};

type LeaseInstallmentPaymentResponse = {
  leaseContractId: string;
  installmentId: string;
  chargeEventId: string;
  financeEntryId: string;
  idempotentReplay: boolean;
  completedAt: string | null;
  leaseContract: LeaseContractSummary;
};

type LeasePaymentTarget = {
  contract: LeaseContractSummary;
  installment: Pick<
    BranchLeaseInstallmentSummary,
    "id" | "installmentNumber" | "dueDate" | "subtotalBeforeTaxCents" | "taxTotalCents" | "finalTotalCents"
  >;
};

type LeaseQuoteFormState = {
  clientUserId: string;
  leasedItemDescription: string;
  startDate: string;
  termPreset: string;
  customTermMonths: string;
  capturedAssetValue: string;
  downPaymentEnabled: boolean;
  downPaymentType: LeaseQuoteDownPaymentType;
  downPaymentAmount: string;
  downPaymentRate: string;
  surchargeRate: string;
  taxMode: LeaseQuoteTaxMode;
  taxRate: string;
  notes: string;
};

const LEASE_CONTRACTS_QUERY_KEY = ["/api/branch/lease-contracts"];
const LEASE_CLIENTS_QUERY_KEY = ["/api/branch/clients"];
const LEASE_PAYMENT_METHODS = [
  ["efectivo", "Efectivo"],
  ["tarjeta", "Tarjeta"],
  ["transferencia", "Transferencia"],
  ["mercado_pago", "Mercado Pago"],
  ["otro", "Otro"],
] as const;

function formatCurrencyMxFromCents(amountCents: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format((amountCents ?? 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStoredPaymentDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTaxRateLabel(rate: number | null) {
  if (rate == null || rate <= 0) return "0%";
  return `${rate.toFixed(2).replace(/\.00$/, "")}%`;
}

function getLeaseStatusLabel(status: LeaseContractStatus) {
  if (status === "COMPLETED") return "Completado";
  if (status === "EXPIRED") return "Vencido";
  if (status === "CANCELLED") return "Cancelado";
  return "Activo";
}

function getLeaseStatusBadgeVariant(status: LeaseContractStatus) {
  if (status === "COMPLETED") return "secondary" as const;
  if (status === "EXPIRED" || status === "CANCELLED") return "destructive" as const;
  return "default" as const;
}

function getLeaseDeletionProtectionMessage(contract: LeaseContractSummary) {
  if (!contract.hasInstallmentSchedule) {
    return "Contrato con historial legacy protegido.";
  }
  if (contract.hasFinancialHistory) {
    return "Este arrendamiento tiene pagos registrados y no puede eliminarse. Debe cancelarse conservando su historial.";
  }
  if (contract.derivedStatus === "CANCELLED") {
    return "Este arrendamiento está cancelado y conserva su historial.";
  }
  return null;
}

function getLeaseQuoteTaxModeLabel(taxMode: LeaseQuoteTaxMode, taxRate: number) {
  if (taxMode === "tax_exempt") {
    return "Sin IVA";
  }

  const rateLabel = formatTaxRateLabel(taxRate);
  return taxMode === "tax_included" ? `IVA incluido ${rateLabel}` : `+ IVA ${rateLabel}`;
}

function getMonthlyBreakdown(contract: LeaseContractSummary) {
  const subtotal = contract.monthlySubtotalBeforeTaxCents;
  const tax = contract.monthlyTaxTotalCents;

  if (contract.taxModeSnapshot === "tax_added") {
    return {
      monthlyLabel: "Mensualidad pactada",
      subtotalLabel: "Subtotal",
      subtotalValue: formatCurrencyMxFromCents(subtotal ?? contract.capturedPriceCents),
      taxValue: formatCurrencyMxFromCents(tax ?? 0),
      totalValue: formatCurrencyMxFromCents(contract.monthlyFinalTotalCents),
      hint: `IVA ${formatTaxRateLabel(contract.taxRateSnapshot)}`,
    };
  }

  if (contract.taxModeSnapshot === "tax_included") {
    return {
      monthlyLabel: "Mensualidad pactada",
      subtotalLabel: "Subtotal",
      subtotalValue: subtotal == null ? "—" : formatCurrencyMxFromCents(subtotal),
      taxValue: tax == null ? "—" : `${formatCurrencyMxFromCents(tax)} incluido`,
      totalValue: formatCurrencyMxFromCents(contract.monthlyFinalTotalCents),
      hint: `IVA ${formatTaxRateLabel(contract.taxRateSnapshot)} incluido`,
    };
  }

  if (contract.taxModeSnapshot === "tax_exempt") {
    return {
      monthlyLabel: "Mensualidad pactada",
      subtotalLabel: "Subtotal",
      subtotalValue: subtotal == null ? formatCurrencyMxFromCents(contract.monthlyFinalTotalCents) : formatCurrencyMxFromCents(subtotal),
      taxValue: "Sin IVA",
      totalValue: formatCurrencyMxFromCents(contract.monthlyFinalTotalCents),
      hint: "Sin IVA",
    };
  }

  return {
    monthlyLabel: "Mensualidad pactada",
    subtotalLabel: "Subtotal",
    subtotalValue: "—",
    taxValue: "—",
    totalValue: formatCurrencyMxFromCents(contract.monthlyFinalTotalCents),
    hint: null,
  };
}

function getTodayMxIsoDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function formatClientDisplayName(client: BranchClientOption) {
  const fullName = [client.name, client.lastName].filter(Boolean).join(" ").trim();
  return fullName || client.email || client.phone || "Cliente";
}

function formatCurrencyInputLabel(value: string) {
  const cents = parseMoneyInputToCents(value);
  return cents == null ? null : formatCurrencyMxFromCents(cents);
}

function parseMoneyInputToCents(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  const [wholePart, decimalPart = ""] = normalized.split(".");
  const whole = Number.parseInt(wholePart, 10);
  if (!Number.isFinite(whole)) return null;
  const decimals = Number.parseInt(decimalPart.padEnd(2, "0").slice(0, 2), 10);
  if (!Number.isFinite(decimals)) return null;
  return whole * 100 + decimals;
}

function parsePositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseRateNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function createInitialQuoteFormState(): LeaseQuoteFormState {
  return {
    clientUserId: "",
    leasedItemDescription: "",
    startDate: getTodayMxIsoDate(),
    termPreset: String(leaseQuoteTermPresets[1]),
    customTermMonths: "",
    capturedAssetValue: "",
    downPaymentEnabled: false,
    downPaymentType: leaseQuoteDownPaymentTypeValues[0],
    downPaymentAmount: "",
    downPaymentRate: "",
    surchargeRate: "",
    taxMode: "tax_exempt",
    taxRate: "16",
    notes: "",
  };
}

function formatCentsForInput(amountCents: number | null | undefined) {
  return amountCents == null ? "" : (amountCents / 100).toFixed(2);
}

function createQuoteFormStateFromContract(contract: LeaseContractSummary): LeaseQuoteFormState {
  const termPreset = leaseQuoteTermPresets.includes(contract.contractTermMonths as (typeof leaseQuoteTermPresets)[number])
    ? String(contract.contractTermMonths)
    : "custom";
  const taxMode = contract.taxModeSnapshot ?? "tax_exempt";

  return {
    clientUserId: contract.clientUserId ?? "",
    leasedItemDescription: contract.leasedItemDescription,
    startDate: contract.contractStartDate,
    termPreset,
    customTermMonths: termPreset === "custom" ? String(contract.contractTermMonths) : "",
    capturedAssetValue: formatCentsForInput(contract.assetValueCents ?? contract.capturedPriceCents),
    downPaymentEnabled: contract.downPaymentType !== null,
    downPaymentType: contract.downPaymentType ?? leaseQuoteDownPaymentTypeValues[0],
    downPaymentAmount: contract.downPaymentType === "amount"
      ? formatCentsForInput(contract.downPaymentInputCents)
      : "",
    downPaymentRate: contract.downPaymentType === "percentage" && contract.downPaymentRate != null
      ? String(contract.downPaymentRate)
      : "",
    surchargeRate: contract.financialSurchargeRate == null ? "0" : String(contract.financialSurchargeRate),
    taxMode,
    taxRate: taxMode === "tax_exempt" ? "0" : String(contract.taxRateSnapshot ?? 0),
    notes: contract.notes ?? "",
  };
}

function getLeaseCollectionBadge(contract: LeaseContractSummary) {
  if (!contract.hasInstallmentSchedule || !contract.nextPendingInstallment) {
    return null;
  }

  const today = getTodayMxIsoDate();
  const dueDate = contract.nextPendingInstallment.dueDate;
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const dueDateMs = Date.parse(`${dueDate}T00:00:00Z`);
  if (!Number.isFinite(todayMs) || !Number.isFinite(dueDateMs)) {
    return null;
  }

  const daysUntilDue = Math.round((dueDateMs - todayMs) / 86_400_000);
  if (daysUntilDue < 0) {
    return { label: "Vencida", variant: "destructive" as const };
  }
  if (daysUntilDue === 0) {
    return { label: "Vence hoy", variant: "destructive" as const };
  }
  if (daysUntilDue === 3) {
    return { label: "Vence en 3 días", variant: "secondary" as const };
  }
  if (daysUntilDue > 0 && daysUntilDue < 3) {
    return { label: "Vence pronto", variant: "secondary" as const };
  }
  return null;
}

function resolveTermMonths(form: LeaseQuoteFormState): number | null {
  if (form.termPreset !== "custom") {
    return parsePositiveInteger(form.termPreset);
  }
  return parsePositiveInteger(form.customTermMonths);
}

function buildQuotePayload(form: LeaseQuoteFormState): LeaseQuoteRequest | null {
  const termMonths = resolveTermMonths(form);
  const capturedAssetValueCents = parseMoneyInputToCents(form.capturedAssetValue);
  const surchargeRate = parseRateNumber(form.surchargeRate);
  const taxRate = form.taxMode === "tax_exempt" ? 0 : parseRateNumber(form.taxRate);
  const downPaymentAmountCents = form.downPaymentEnabled && form.downPaymentType === "amount"
    ? parseMoneyInputToCents(form.downPaymentAmount)
    : null;
  const downPaymentRate = form.downPaymentEnabled && form.downPaymentType === "percentage"
    ? parseRateNumber(form.downPaymentRate)
    : null;

  if (
    !form.clientUserId
    || !form.leasedItemDescription.trim()
    || !form.startDate
    || termMonths == null
    || capturedAssetValueCents == null
    || surchargeRate == null
    || taxRate == null
    || (form.downPaymentEnabled && form.downPaymentType === "amount" && downPaymentAmountCents == null)
    || (form.downPaymentEnabled && form.downPaymentType === "percentage" && downPaymentRate == null)
  ) {
    return null;
  }

  return {
    clientUserId: form.clientUserId,
    leasedItemDescription: form.leasedItemDescription.trim(),
    startDate: form.startDate,
    termMonths,
    capturedAssetValueCents,
    surchargeRate,
    downPaymentEnabled: form.downPaymentEnabled,
    downPaymentType: form.downPaymentEnabled ? form.downPaymentType : null,
    downPaymentAmountCents: form.downPaymentEnabled && form.downPaymentType === "amount" ? downPaymentAmountCents : null,
    downPaymentRate: form.downPaymentEnabled && form.downPaymentType === "percentage" ? downPaymentRate : null,
    taxMode: form.taxMode,
    taxRate,
    notes: form.notes.trim() ? form.notes.trim() : null,
  };
}

function getInstallmentStatusLabel(installment: BranchLeaseInstallmentSummary) {
  if (installment.paymentSource === "webcool") {
    return "Pagada en WebCool";
  }
  if (installment.paymentSource === "external") {
    return "Pagada externa";
  }
  return installment.dueDate < getTodayMxIsoDate() ? "Vencida" : "Pendiente";
}

function getPaymentMethodLabel(paymentMethod: string | null | undefined) {
  return LEASE_PAYMENT_METHODS.find(([value]) => value === paymentMethod)?.[1] ?? "Método no disponible";
}

function ContractSummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

function LeaseDetailDialog({
  leaseContractId,
  open,
  onOpenChange,
  onRegisterPayment,
  onEdit,
  onDelete,
}: {
  leaseContractId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegisterPayment: (target: LeasePaymentTarget) => void;
  onEdit: (contract: LeaseContractSummary) => void;
  onDelete: (contract: LeaseContractSummary) => void;
}) {
  const detailQueryKey = leaseContractId ? [`/api/branch/lease-contracts/${leaseContractId}`] : [];
  const { data, isLoading, error } = useQuery<LeaseContractSummary>({
    queryKey: detailQueryKey,
    enabled: open && !!leaseContractId,
  });

  const breakdown = data ? getMonthlyBreakdown(data) : null;
  const assetValueForDisplay = data?.assetValueCents ?? data?.capturedPriceCents ?? 0;
  const contractFinalForDisplay = data?.contractFinalTotalCents ?? null;
  const nextPendingInstallment = data?.derivedStatus !== "CANCELLED"
    ? data?.installments
      ?.filter((installment) => installment.paymentSource === null)
      .sort((left, right) => (
        left.dueDate.localeCompare(right.dueDate)
        || left.installmentNumber - right.installmentNumber
      ))[0] ?? null
    : null;
  const deletionProtectionMessage = data ? getLeaseDeletionProtectionMessage(data) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:w-[calc(100vw-3rem)] sm:max-w-[min(96vw,1440px)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <DialogHeader>
            <DialogTitle>Detalle del arrendamiento</DialogTitle>
            <DialogDescription>
              Consulta el contrato, el avance de mensualidades y el snapshot fiscal de cada pago.
            </DialogDescription>
          </DialogHeader>

          {data ? (
            <div className="flex flex-wrap gap-2">
              {data.canEditAdministrativeDetails ? (
                <Button variant="outline" size="sm" onClick={() => onEdit(data)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              ) : null}
              {data.canDelete ? (
                <Button variant="outline" size="sm" onClick={() => onDelete(data)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              ) : deletionProtectionMessage ? (
                <span title={deletionProtectionMessage} className="inline-flex cursor-not-allowed">
                  <Button variant="outline" size="sm" disabled>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {data?.hasInstallmentSchedule && nextPendingInstallment ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => onRegisterPayment({ contract: data, installment: nextPendingInstallment })}
              data-testid={`button-register-next-lease-payment-${nextPendingInstallment.id}`}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Registrar próximo pago
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            No pudimos cargar el detalle del arrendamiento.
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Cliente</p>
                  <h3 className="mt-1 break-words text-lg font-semibold">{data.clientDisplayName}</h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{data.leasedItemDescription}</p>
                </div>
                <Badge variant={getLeaseStatusBadgeVariant(data.derivedStatus)} className="self-start">
                  {getLeaseStatusLabel(data.derivedStatus)}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pagadas</p>
                  <p className="mt-1 text-lg font-semibold">{data.totalPaidInstallments}/{data.contractTermMonths}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pendientes</p>
                  <p className="mt-1 text-lg font-semibold">{data.pendingInstallments}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progreso</p>
                  <p className="mt-1 text-lg font-semibold">{data.paymentProgressPercent}%</p>
                </div>
              </div>
            </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cliente</p><p className="mt-1 font-medium break-words">{data.clientDisplayName}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bien</p><p className="mt-1 font-medium break-words">{data.leasedItemDescription}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Inicio</p><p className="mt-1 font-medium">{formatDate(data.contractStartDate)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fin</p><p className="mt-1 font-medium">{formatDate(data.contractEndDate)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Plazo</p><p className="mt-1 font-medium">{data.contractTermMonths} meses</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor del bien</p><p className="mt-1 font-medium">{formatCurrencyMxFromCents(assetValueForDisplay)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Enganche</p><p className="mt-1 font-medium">{data.downPaymentFinalTotalCents ? formatCurrencyMxFromCents(data.downPaymentFinalTotalCents) : "Sin enganche"}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Capital financiado</p><p className="mt-1 font-medium">{data.financedPrincipalBeforeTaxCents != null ? formatCurrencyMxFromCents(data.financedPrincipalBeforeTaxCents) : "—"}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Interés / recargo total</p><p className="mt-1 font-medium">{data.financialSurchargeRate != null ? formatTaxRateLabel(data.financialSurchargeRate) : "—"}</p><p className="text-xs text-muted-foreground">{data.financialSurchargeTotalCents != null ? formatCurrencyMxFromCents(data.financialSurchargeTotalCents) : ""}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{breakdown?.subtotalLabel ?? "Subtotal"}</p><p className="mt-1 font-medium">{breakdown?.subtotalValue ?? "—"}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">IVA</p><p className="mt-1 font-medium">{breakdown?.taxValue ?? "—"}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total mensual</p><p className="mt-1 font-medium">{breakdown?.totalValue ?? formatCurrencyMxFromCents(data.monthlyFinalTotalCents)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total contractual</p><p className="mt-1 font-medium">{contractFinalForDisplay != null ? formatCurrencyMxFromCents(contractFinalForDisplay) : "—"}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total pagado</p><p className="mt-1 font-medium">{data.totalPaidInstallmentAmountCents == null ? "—" : formatCurrencyMxFromCents(data.totalPaidInstallmentAmountCents)}</p><p className="text-xs text-muted-foreground">Solo mensualidades</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo pendiente</p><p className="mt-1 font-medium">{data.hasInstallmentSchedule ? formatCurrencyMxFromCents(data.pendingContractBalanceCents) : "—"}</p><p className="text-xs text-muted-foreground">Solo mensualidades</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Próximo vencimiento</p><p className="mt-1 font-medium">{formatDate(data.nextDueDate)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pagadas antes de WebCool</p><p className="mt-1 font-medium">{data.preWebcoolPaidInstallments}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pagadas en WebCool</p><p className="mt-1 font-medium">{data.webcoolPaidInstallments}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total pagadas</p><p className="mt-1 font-medium">{data.totalPaidInstallments}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="mt-1 font-medium">{data.pendingInstallments}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Meses transcurridos</p><p className="mt-1 font-medium">{data.elapsedCalendarMonths}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Meses restantes</p><p className="mt-1 font-medium">{data.remainingCalendarMonths}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Estado</p><p className="mt-1 font-medium">{getLeaseStatusLabel(data.derivedStatus)}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notas y trazabilidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Notas:</span> {data.notes?.trim() ? data.notes : "Sin notas registradas"}</p>
                <p><span className="font-medium text-foreground">Cobertura operativa actual:</span> {data.hasOperationalCoverage && data.operationalCoverageStartDate && data.operationalCoverageEndDate ? `${formatDate(data.operationalCoverageStartDate)} al ${formatDate(data.operationalCoverageEndDate)}` : "Sin cobertura operativa"}</p>
                <p><span className="font-medium text-foreground">Creado:</span> {formatDateTime(data.createdAt)}</p>
                {data.completedAt ? <p><span className="font-medium text-foreground">Completado:</span> {formatDateTime(data.completedAt)}</p> : null}
                {data.cancelledAt ? <p><span className="font-medium text-foreground">Cancelado:</span> {formatDateTime(data.cancelledAt)}</p> : null}
                {breakdown?.hint ? <p>{breakdown.hint}</p> : null}
              </CardContent>
            </Card>

            {data.installments?.length ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Mensualidades del contrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="max-h-[min(56dvh,680px)] overflow-x-auto overflow-y-auto rounded-xl border">
                    <Table className="min-w-[860px] lg:min-w-0">
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Vencimiento</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="text-right">IVA</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.installments.map((installment) => (
                          <TableRow key={installment.id}>
                            <TableCell>{installment.installmentNumber}/{data.contractTermMonths}</TableCell>
                            <TableCell>{formatDate(installment.dueDate)}</TableCell>
                            <TableCell>{getInstallmentStatusLabel(installment)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyMxFromCents(installment.subtotalBeforeTaxCents)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyMxFromCents(installment.taxTotalCents)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrencyMxFromCents(installment.finalTotalCents)}</TableCell>
                            <TableCell>
                              {installment.paymentSource ? (
                                <div className="min-w-[130px] text-sm">
                                  <p>{formatStoredPaymentDate(installment.paidAt)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {installment.paymentSource === "webcool"
                                      ? getPaymentMethodLabel(installment.paymentMethod)
                                      : "Registro externo"}
                                  </p>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {installment.paymentSource === null && data.derivedStatus !== "CANCELLED" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onRegisterPayment({ contract: data, installment })}
                                  data-testid={`button-register-lease-payment-${installment.id}`}
                                >
                                  Registrar pago
                                </Button>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Historial legacy</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Este contrato usa historial legacy. Su corrida debe adoptarse antes de registrar nuevos pagos.
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            No encontramos este arrendamiento en la sucursal actual.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LeasePaymentDialog({
  target,
  onOpenChange,
}: {
  target: LeasePaymentTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<(typeof LEASE_PAYMENT_METHODS)[number][0]>("efectivo");
  const [paidAt, setPaidAt] = useState(getTodayMxIsoDate());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!target) return;
    setPaymentMethod("efectivo");
    setPaidAt(getTodayMxIsoDate());
    setNotes("");
  }, [target?.installment.id]);

  const paymentMutation = useMutation({
    mutationFn: async (request: {
      leaseContractId: string;
      installmentId: string;
      paymentMethod: string;
      paidAt: string;
      notes: string | null;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/branch/lease-contracts/${request.leaseContractId}/installments/${request.installmentId}/pay`,
        {
          paymentMethod: request.paymentMethod,
          paidAt: request.paidAt,
          notes: request.notes,
        },
      );
      return response.json() as Promise<LeaseInstallmentPaymentResponse>;
    },
  });

  async function handleRegisterPayment() {
    if (!target || !paidAt) return;

    try {
      const result = await paymentMutation.mutateAsync({
        leaseContractId: target.contract.id,
        installmentId: target.installment.id,
        paymentMethod,
        paidAt,
        notes: notes.trim() || null,
      });
      queryClient.setQueryData(
        [`/api/branch/lease-contracts/${target.contract.id}`],
        result.leaseContract,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LEASE_CONTRACTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: [`/api/branch/lease-contracts/${target.contract.id}`] }),
        invalidateBranchFinanceQueries(),
      ]);

      toast({
        title: result.idempotentReplay ? "Pago ya registrado" : "Pago registrado",
        description: result.idempotentReplay
          ? "Esta mensualidad ya contaba con un pago en WebCool; no se generó un cobro duplicado."
          : "La mensualidad, Caja y el avance contractual se actualizaron correctamente.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "No pudimos registrar el pago",
        description: error?.message || "Intenta nuevamente. No se registró ningún cobro.",
        variant: "destructive",
      });
    }
  }

  if (!target) return null;

  const { contract, installment } = target;
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago de mensualidad</DialogTitle>
          <DialogDescription>
            El monto está congelado por el contrato y no puede editarse manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Cliente</p><p className="mt-1 font-medium">{contract.clientDisplayName}</p></div>
              <div><p className="text-xs text-muted-foreground">Bien</p><p className="mt-1 font-medium">{contract.leasedItemDescription}</p></div>
              <div><p className="text-xs text-muted-foreground">Mensualidad</p><p className="mt-1 font-medium">{installment.installmentNumber} de {contract.contractTermMonths}</p></div>
              <div><p className="text-xs text-muted-foreground">Vencimiento</p><p className="mt-1 font-medium">{formatDate(installment.dueDate)}</p></div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Subtotal</p><p className="mt-1 font-medium">{formatCurrencyMxFromCents(installment.subtotalBeforeTaxCents)}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">IVA</p><p className="mt-1 font-medium">{formatCurrencyMxFromCents(installment.taxTotalCents)}</p></div>
            <div className="rounded-xl border bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 font-semibold">{formatCurrencyMxFromCents(installment.finalTotalCents)}</p></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lease-payment-method">Método de pago</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)} disabled={paymentMutation.isPending}>
                <SelectTrigger id="lease-payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEASE_PAYMENT_METHODS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lease-payment-date">Fecha de pago</Label>
              <Input id="lease-payment-date" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} disabled={paymentMutation.isPending} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lease-payment-notes">Notas opcionales</Label>
            <Textarea id="lease-payment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} disabled={paymentMutation.isPending} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paymentMutation.isPending}>Cancelar</Button>
          <Button onClick={handleRegisterPayment} disabled={paymentMutation.isPending || !paidAt} data-testid={`button-confirm-lease-payment-${installment.id}`}>
            {paymentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaseQuoteDialog({
  open,
  onOpenChange,
  editContract = null,
  onLeaseSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editContract?: LeaseContractSummary | null;
  onLeaseSaved?: (leaseContractId: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LeaseQuoteFormState>(createInitialQuoteFormState);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [preview, setPreview] = useState<LeaseQuotePreviewResponse | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const isEditMode = editContract !== null;
  const isAdministrativeOnly = editContract !== null && !editContract.canEditFinancialTerms;

  const { data: clients = [], isLoading: isClientsLoading } = useQuery<BranchClientOption[]>({
    queryKey: LEASE_CLIENTS_QUERY_KEY,
    enabled: open,
  });

  useEffect(() => {
    if (open && editContract) {
      setForm(createQuoteFormStateFromContract(editContract));
      setPreview(null);
      setPreviewFingerprint(null);
      setClientPickerOpen(false);
      setIsDownloadingPdf(false);
      return;
    }

    if (!open) {
      setForm(createInitialQuoteFormState());
      setPreview(null);
      setPreviewFingerprint(null);
      setClientPickerOpen(false);
      setIsDownloadingPdf(false);
    }
  }, [open, editContract?.id]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.userId === form.clientUserId) ?? null,
    [clients, form.clientUserId],
  );

  const payload = useMemo(() => buildQuotePayload(form), [form]);
  const payloadFingerprint = useMemo(
    () => (payload ? JSON.stringify(payload) : null),
    [payload],
  );
  const previewIsStale = !!preview && !!payloadFingerprint && previewFingerprint !== payloadFingerprint;

  const previewMutation = useMutation({
    mutationFn: async (request: LeaseQuoteRequest) => {
      const response = await apiRequest("POST", "/api/branch/lease-quotes/preview", request);
      return response.json() as Promise<LeaseQuotePreviewResponse>;
    },
    onSuccess: (data, variables) => {
      setPreview(data);
      setPreviewFingerprint(JSON.stringify(variables));
    },
    onError: (error: any) => {
      toast({
        title: "No pudimos calcular la corrida",
        description: error?.message || "Revisa los datos e intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  const createLeaseMutation = useMutation({
    mutationFn: async (request: LeaseQuoteRequest) => {
      const response = await apiRequest("POST", "/api/branch/lease-contracts", request);
      return response.json() as Promise<CreateLeaseContractResponse>;
    },
  });

  const updateLeaseMutation = useMutation({
    mutationFn: async (request: LeaseQuoteRequest | { leasedItemDescription: string; notes: string | null }) => {
      if (!editContract) {
        throw new Error("LEASE_CONTRACT_NOT_FOUND");
      }
      const response = await apiRequest("PATCH", `/api/branch/lease-contracts/${editContract.id}`, request);
      return response.json() as Promise<UpdateLeaseContractResponse>;
    },
  });

  async function handleGeneratePreview() {
    if (!payload) {
      toast({
        title: "Completa los datos",
        description: "Selecciona un cliente e ingresa bien, fecha, plazo, valor, recargo e IVA.",
        variant: "destructive",
      });
      return;
    }

    await previewMutation.mutateAsync(payload);
  }

  async function handleDownloadPdf() {
    if (!payload) {
      toast({
        title: "Completa los datos",
        description: "Primero genera una vista previa válida.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDownloadingPdf(true);
      await downloadAuthenticatedFileRequest(
        "POST",
        "/api/branch/lease-quotes/preview.pdf",
        "corrida-arrendamiento.pdf",
        payload,
      );
    } catch (error: any) {
      toast({
        title: "No pudimos descargar el PDF",
        description: error?.message || "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  async function handleCreateLeaseContract() {
    if (!payload || !preview || previewIsStale) {
      toast({
        title: "Actualiza la corrida",
        description: "Genera una vista previa vigente antes de crear el arrendamiento.",
        variant: "destructive",
      });
      return;
    }

    try {
      const created = await createLeaseMutation.mutateAsync(payload);
      if (created.leaseContract) {
        queryClient.setQueryData(
          [`/api/branch/lease-contracts/${created.leaseContractId}`],
          created.leaseContract,
        );
      }
      await queryClient.invalidateQueries({ queryKey: LEASE_CONTRACTS_QUERY_KEY });

      toast({
        title: "Arrendamiento creado",
        description: preview.quote.downPaymentFinalTotalCents > 0
          ? "El contrato y sus mensualidades quedaron registrados. El enganche solo quedó pactado; todavía no entra a Caja."
          : "El contrato y sus mensualidades quedaron registrados correctamente.",
      });

      onOpenChange(false);
      onLeaseSaved?.(created.leaseContractId);
    } catch (error: any) {
      toast({
        title: "No pudimos crear el arrendamiento",
        description: error?.message || "Intenta nuevamente.",
        variant: "destructive",
      });
    }
  }

  async function handleUpdateLeaseContract() {
    if (!editContract) {
      return;
    }

    const request = isAdministrativeOnly
      ? {
        leasedItemDescription: form.leasedItemDescription.trim(),
        notes: form.notes.trim() || null,
      }
      : payload;
    if (!request || (!isAdministrativeOnly && (!preview || previewIsStale))) {
      toast({
        title: "Actualiza la corrida",
        description: "Genera una vista previa vigente antes de guardar los cambios financieros.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updated = await updateLeaseMutation.mutateAsync(request);
      queryClient.setQueryData(
        [`/api/branch/lease-contracts/${editContract.id}`],
        updated.leaseContract,
      );
      await queryClient.invalidateQueries({ queryKey: LEASE_CONTRACTS_QUERY_KEY });
      toast({
        title: "Arrendamiento actualizado",
        description: isAdministrativeOnly
          ? "Se actualizaron únicamente los datos administrativos; el historial financiero permanece intacto."
          : "La corrida sin pagos se regeneró correctamente.",
      });
      onOpenChange(false);
      onLeaseSaved?.(editContract.id);
    } catch (error: any) {
      toast({
        title: "No pudimos actualizar el arrendamiento",
        description: error?.message || "Intenta nuevamente. No se modificó el contrato.",
        variant: "destructive",
      });
    }
  }

  const taxModeExplanation =
    form.taxMode === "tax_included"
      ? "El valor capturado ya incluye IVA. El recargo se calcula sobre la base antes de IVA."
      : form.taxMode === "tax_added"
        ? "El valor capturado es antes de IVA. El IVA se agrega al subtotal financiado."
        : "El valor capturado no genera IVA.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar arrendamiento" : "Nueva corrida y arrendamiento"}</DialogTitle>
          <DialogDescription>
            {isAdministrativeOnly
              ? "Este contrato ya tiene historial financiero. Solo pueden cambiarse la descripción administrativa y las notas."
              : isEditMode
                ? "Puedes ajustar la corrida porque todavía no tiene pagos registrados. Al guardar, se regeneran únicamente sus mensualidades pendientes."
                : "Calcula la corrida, revisa el PDF y, si te convence, crea el contrato independiente con sus mensualidades reales. En esta fase el enganche queda pactado, pero no se registra como cobrado en Caja."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="space-y-4">
            {isAdministrativeOnly ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                Cliente, fechas, plazo, valor, IVA, recargo y enganche están congelados para preservar los pagos registrados.
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientPickerOpen}
                    className="w-full justify-between"
                    disabled={isAdministrativeOnly}
                    data-testid="button-lease-quote-client"
                  >
                    <span className="truncate text-left">
                      {selectedClient ? formatClientDisplayName(selectedClient) : "Buscar cliente..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por nombre, email o teléfono..." />
                    <CommandList>
                      <CommandEmpty>
                        {isClientsLoading ? "Cargando clientes..." : "No encontramos clientes con ese criterio."}
                      </CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => {
                          const itemValue = [
                            formatClientDisplayName(client),
                            client.email,
                            client.phone,
                          ]
                            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                            .join(" ");

                          return (
                            <CommandItem
                              key={client.userId}
                              value={itemValue}
                              onSelect={() => {
                                setForm((current) => ({ ...current, clientUserId: client.userId }));
                                setClientPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.clientUserId === client.userId ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{formatClientDisplayName(client)}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[client.email, client.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                                </p>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lease-item-description">Bien / equipo</Label>
              <Input
                id="lease-item-description"
                value={form.leasedItemDescription}
                onChange={(event) => setForm((current) => ({ ...current, leasedItemDescription: event.target.value }))}
                placeholder="Ej. Mazda 3 Hatchback"
                data-testid="input-lease-quote-item"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lease-start-date">Fecha de inicio</Label>
              <Input
                id="lease-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                disabled={isAdministrativeOnly}
                data-testid="input-lease-quote-start-date"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plazo</Label>
                <Select
                  value={form.termPreset}
                  onValueChange={(value) => setForm((current) => ({ ...current, termPreset: value }))}
                  disabled={isAdministrativeOnly}
                >
                  <SelectTrigger data-testid="select-lease-quote-term">
                    <SelectValue placeholder="Selecciona el plazo" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaseQuoteTermPresets.map((preset) => (
                      <SelectItem key={preset} value={String(preset)}>
                        {preset} meses
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.termPreset === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor="lease-custom-term">Meses personalizados</Label>
                  <Input
                    id="lease-custom-term"
                    type="number"
                    min={1}
                    value={form.customTermMonths}
                    onChange={(event) => setForm((current) => ({ ...current, customTermMonths: event.target.value }))}
                    disabled={isAdministrativeOnly}
                    placeholder="Ej. 60"
                    data-testid="input-lease-quote-custom-term"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lease-asset-value">Valor del bien</Label>
              <Input
                id="lease-asset-value"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.capturedAssetValue}
                onChange={(event) => setForm((current) => ({ ...current, capturedAssetValue: event.target.value }))}
                disabled={isAdministrativeOnly}
                placeholder="100000.00"
                data-testid="input-lease-quote-asset-value"
              />
              {formatCurrencyInputLabel(form.capturedAssetValue) ? (
                <p className="text-xs text-muted-foreground">
                  {formatCurrencyInputLabel(form.capturedAssetValue)}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="lease-down-payment-enabled" className="text-sm font-medium">
                    ¿El cliente dará enganche?
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    El enganche reduce primero el capital financiado. En esta fase se guarda como pactado, pero no se registra como pagado.
                  </p>
                </div>
                <Switch
                  id="lease-down-payment-enabled"
                  checked={form.downPaymentEnabled}
                  onCheckedChange={(checked) => setForm((current) => ({
                    ...current,
                    downPaymentEnabled: checked,
                    downPaymentAmount: checked ? current.downPaymentAmount : "",
                    downPaymentRate: checked ? current.downPaymentRate : "",
                  }))}
                  disabled={isAdministrativeOnly}
                  data-testid="switch-lease-quote-down-payment-enabled"
                />
              </div>

              {form.downPaymentEnabled ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de enganche</Label>
                    <Select
                      value={form.downPaymentType}
                      onValueChange={(value) => setForm((current) => ({
                        ...current,
                        downPaymentType: value as LeaseQuoteDownPaymentType,
                        downPaymentAmount: value === "amount" ? current.downPaymentAmount : "",
                        downPaymentRate: value === "percentage" ? current.downPaymentRate : "",
                      }))}
                      disabled={isAdministrativeOnly}
                    >
                      <SelectTrigger data-testid="select-lease-quote-down-payment-type">
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">Monto</SelectItem>
                        <SelectItem value="percentage">Porcentaje</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.downPaymentType === "amount" ? (
                    <div className="space-y-2">
                      <Label htmlFor="lease-down-payment-amount">Monto del enganche</Label>
                      <Input
                        id="lease-down-payment-amount"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={form.downPaymentAmount}
                        onChange={(event) => setForm((current) => ({ ...current, downPaymentAmount: event.target.value }))}
                        disabled={isAdministrativeOnly}
                        placeholder="100000.00"
                        data-testid="input-lease-quote-down-payment-amount"
                      />
                      {formatCurrencyInputLabel(form.downPaymentAmount) ? (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrencyInputLabel(form.downPaymentAmount)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="lease-down-payment-rate">Porcentaje del enganche</Label>
                      <Input
                        id="lease-down-payment-rate"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        inputMode="decimal"
                        value={form.downPaymentRate}
                        onChange={(event) => setForm((current) => ({ ...current, downPaymentRate: event.target.value }))}
                        disabled={isAdministrativeOnly}
                        placeholder="20"
                        data-testid="input-lease-quote-down-payment-rate"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ejemplo: 20% significa que el capital financiado se calcula sobre el 80% restante.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lease-surcharge-rate">Interés / recargo total</Label>
              <Input
                id="lease-surcharge-rate"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.surchargeRate}
                onChange={(event) => setForm((current) => ({ ...current, surchargeRate: event.target.value }))}
                disabled={isAdministrativeOnly}
                placeholder="20"
                data-testid="input-lease-quote-surcharge-rate"
              />
              <p className="text-xs text-muted-foreground">
                Porcentaje total aplicado al monto que será financiado. No representa una tasa anual.
              </p>
              <p className="text-xs text-muted-foreground">
                Ejemplo: valor del bien {formatCurrencyMxFromCents(10_000_000)} · recargo total 20% = {formatCurrencyMxFromCents(2_000_000)}.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tratamiento IVA</Label>
                <Select
                  value={form.taxMode}
                  onValueChange={(value) => setForm((current) => ({ ...current, taxMode: value as LeaseQuoteTaxMode }))}
                  disabled={isAdministrativeOnly}
                >
                  <SelectTrigger data-testid="select-lease-quote-tax-mode">
                    <SelectValue placeholder="Selecciona IVA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tax_exempt">Sin IVA</SelectItem>
                    <SelectItem value="tax_included">IVA incluido</SelectItem>
                    <SelectItem value="tax_added">+ IVA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lease-tax-rate">Tasa IVA</Label>
                <Input
                  id="lease-tax-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.taxMode === "tax_exempt" ? "0" : form.taxRate}
                  onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))}
                  disabled={isAdministrativeOnly || form.taxMode === "tax_exempt"}
                  placeholder="16"
                  data-testid="input-lease-quote-tax-rate"
                />
              </div>
            </div>

            <p className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {taxModeExplanation}
            </p>

            <div className="space-y-2">
              <Label htmlFor="lease-quote-notes">Notas</Label>
              <Textarea
                id="lease-quote-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Observaciones internas para esta propuesta"
                rows={3}
                data-testid="textarea-lease-quote-notes"
              />
            </div>
          </div>

          <div className="space-y-4">
            {isAdministrativeOnly ? (
              <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <h4 className="mt-3 text-base font-semibold">Historial financiero protegido</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  La corrida, sus mensualidades y sus pagos permanecen congelados. Puedes actualizar solo la descripción administrativa del bien y las notas.
                </p>
              </div>
            ) : preview ? (
              <>
                <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Cliente</p>
                      <h3 className="mt-1 text-xl font-semibold">{preview.client.displayName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{preview.leasedItemDescription}</p>
                    </div>
                    <Badge variant="secondary">Vista previa contractual</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <ContractSummaryCard title="Valor del bien" value={formatCurrencyMxFromCents(preview.quote.capturedAssetValueCents)} description={preview.quote.taxMode === "tax_included" ? "Monto capturado con IVA incluido" : "Monto capturado para la corrida"} />
                  <ContractSummaryCard title="Enganche" value={preview.quote.downPaymentFinalTotalCents > 0 ? formatCurrencyMxFromCents(preview.quote.downPaymentFinalTotalCents) : "Sin enganche"} description={preview.quote.downPaymentType === "percentage" && preview.quote.downPaymentRate != null ? `${formatTaxRateLabel(preview.quote.downPaymentRate)} sobre el valor del bien` : preview.quote.downPaymentType === "amount" ? "Monto pactado al inicio" : "No reduce el saldo financiado"} />
                  <ContractSummaryCard title="Capital financiado" value={formatCurrencyMxFromCents(preview.quote.financedPrincipalBeforeTaxCents)} description="Base antes del interés / recargo" />
                  <ContractSummaryCard title="Interés / recargo total" value={formatTaxRateLabel(preview.quote.surchargeRate)} description={`Monto del recargo: ${formatCurrencyMxFromCents(preview.quote.surchargeTotalCents)}`} />
                  <ContractSummaryCard title="Subtotal financiado" value={formatCurrencyMxFromCents(preview.quote.financedSubtotalBeforeTaxCents)} />
                  <ContractSummaryCard title="IVA financiado" value={formatCurrencyMxFromCents(preview.quote.contractTaxTotalCents)} description={getLeaseQuoteTaxModeLabel(preview.quote.taxMode, preview.quote.taxRate)} />
                  <ContractSummaryCard title="Total financiado" value={formatCurrencyMxFromCents(preview.quote.financedFinalTotalCents)} description={`${preview.quote.termMonths} mensualidades`} />
                  <ContractSummaryCard title="Total contractual" value={formatCurrencyMxFromCents(preview.quote.contractFinalTotalCents)} description="Total financiado + enganche pactado" />
                  <ContractSummaryCard title="Mensualidad aproximada" value={formatCurrencyMxFromCents(preview.quote.approximateInstallmentFinalTotalCents)} description={preview.quote.hasAdjustedFinalInstallment ? `Última mensualidad: ${formatCurrencyMxFromCents(preview.quote.finalInstallmentFinalTotalCents)}` : "Todas las mensualidades cuadran igual"} />
                </div>

                <Card className="border-border/70 shadow-sm">
                  <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Base antes de IVA</p>
                      <p className="mt-1 font-semibold">{formatCurrencyMxFromCents(preview.quote.assetSubtotalBeforeTaxCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">IVA del valor capturado</p>
                      <p className="mt-1 font-semibold">{formatCurrencyMxFromCents(preview.quote.assetTaxCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Enganche</p>
                      <p className="mt-1 font-semibold">{preview.quote.downPaymentFinalTotalCents > 0 ? formatCurrencyMxFromCents(preview.quote.downPaymentFinalTotalCents) : "Sin enganche"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Capital financiado</p>
                      <p className="mt-1 font-semibold">{formatCurrencyMxFromCents(preview.quote.financedPrincipalBeforeTaxCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Plazo</p>
                      <p className="mt-1 font-semibold">{preview.quote.termMonths} meses</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Inicio</p>
                      <p className="mt-1 font-semibold">{formatDate(preview.quote.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fin contractual</p>
                      <p className="mt-1 font-semibold">{formatDate(preview.quote.contractEndDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tratamiento IVA</p>
                      <p className="mt-1 font-semibold">{getLeaseQuoteTaxModeLabel(preview.quote.taxMode, preview.quote.taxRate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total financiado</p>
                      <p className="mt-1 font-semibold">{formatCurrencyMxFromCents(preview.quote.financedFinalTotalCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total contractual</p>
                      <p className="mt-1 font-semibold">{formatCurrencyMxFromCents(preview.quote.contractFinalTotalCents)}</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                  El contrato se creará con sus mensualidades reales. El enganche, si existe, queda guardado como pactado y todavía no genera un ingreso en Caja ni cuenta como mensualidad pagada.
                </div>

                {preview.quote.hasAdjustedFinalInstallment ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    Las mensualidades son de {formatCurrencyMxFromCents(preview.quote.approximateInstallmentFinalTotalCents)}; la última puede ajustarse por centavos para cuadrar el total exacto.
                  </div>
                ) : null}

                {previewIsStale ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                    Cambiaste datos después de la última vista previa. Vuelve a generarla antes de descargar el PDF.
                  </div>
                ) : null}

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Tabla de corrida</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="max-h-[420px] overflow-auto rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Vencimiento</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                            <TableHead className="text-right">IVA</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.quote.installmentRows.map((row) => (
                            <TableRow key={`${row.installmentNumber}-${row.dueDate}`}>
                              <TableCell>{row.installmentNumber}/{preview.quote.termMonths}</TableCell>
                              <TableCell>{formatDate(row.dueDate)}</TableCell>
                              <TableCell className="text-right">{formatCurrencyMxFromCents(row.subtotalBeforeTaxCents)}</TableCell>
                              <TableCell className="text-right">{formatCurrencyMxFromCents(row.taxTotalCents)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrencyMxFromCents(row.finalTotalCents)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <h4 className="mt-3 text-base font-semibold">Genera la vista previa</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selecciona el cliente y completa los datos para revisar el resumen, la tabla mensual, descargar el PDF y crear el arrendamiento independiente.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {isAdministrativeOnly
              ? "Los cambios administrativos no modifican pagos, Caja ni mensualidades existentes."
              : isEditMode
                ? "Guardar reemplaza solo la corrida sin pagos dentro de una única transacción."
                : "Al crear el arrendamiento se guardan el contrato y sus mensualidades reales. El enganche sigue sin registrarse como cobrado en Caja en esta fase."}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-lease-quote">
              Cerrar
            </Button>
            {!isAdministrativeOnly ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={!preview || previewIsStale || isDownloadingPdf}
                  data-testid="button-download-lease-quote-pdf"
                >
                  {isDownloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Descargar PDF
                </Button>
                <Button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={!payload || previewMutation.isPending}
                  data-testid="button-generate-lease-quote-preview"
                >
                  {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  {preview && previewIsStale ? "Actualizar vista previa" : "Generar vista previa"}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              onClick={isEditMode ? handleUpdateLeaseContract : handleCreateLeaseContract}
              disabled={isEditMode
                ? updateLeaseMutation.isPending || (!isAdministrativeOnly && (!preview || previewIsStale || previewMutation.isPending))
                : !preview || previewIsStale || createLeaseMutation.isPending || previewMutation.isPending}
              data-testid={isEditMode ? "button-save-lease-contract" : "button-create-lease-contract"}
            >
              {(isEditMode ? updateLeaseMutation.isPending : createLeaseMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditMode ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {isEditMode ? "Guardar cambios" : "Crear arrendamiento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ArrendamientosTab({ focusRequest }: { focusRequest?: LeaseContractFocusRequest | null } = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaseFilter>("all");
  const [detailLeaseId, setDetailLeaseId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [editContract, setEditContract] = useState<LeaseContractSummary | null>(null);
  const [deleteContract, setDeleteContract] = useState<LeaseContractSummary | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<LeasePaymentTarget | null>(null);

  const { data: contracts = [], isLoading, error } = useQuery<LeaseContractSummary[]>({
    queryKey: LEASE_CONTRACTS_QUERY_KEY,
  });

  const deleteLeaseMutation = useMutation({
    mutationFn: async (leaseContractId: string) => {
      await apiRequest("DELETE", `/api/branch/lease-contracts/${leaseContractId}`);
    },
  });

  useEffect(() => {
    if (!focusRequest?.leaseContractId) {
      return;
    }

    setDetailLeaseId(focusRequest.leaseContractId);
    setDetailOpen(true);
  }, [focusRequest?.nonce, focusRequest?.leaseContractId]);

  const filteredContracts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (statusFilter !== "all" && contract.derivedStatus !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        contract.clientDisplayName,
        contract.clientEmail,
        contract.clientPhone,
        contract.leasedItemDescription,
        contract.planName,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [contracts, search, statusFilter]);

  const summary = useMemo(() => {
    const openContracts = contracts.filter((contract) => contract.isOpenForLifecycleGuards);
    const completedContracts = contracts.filter((contract) => contract.derivedStatus === "COMPLETED");
    const expiredContracts = contracts.filter((contract) => contract.derivedStatus === "EXPIRED" && contract.pendingInstallments > 0);
    const cancelledContracts = contracts.filter((contract) => contract.derivedStatus === "CANCELLED");
    const totalMonthlyOpenAmountCents = openContracts.reduce((sum, contract) => sum + (contract.monthlyFinalTotalCents || 0), 0);

    return {
      openContracts: openContracts.length,
      completedContracts: completedContracts.length,
      expiredContracts: expiredContracts.length,
      cancelledContracts: cancelledContracts.length,
      totalMonthlyOpenAmountCents,
    };
  }, [contracts]);

  function openDetail(leaseContractId: string) {
    setDetailLeaseId(leaseContractId);
    setDetailOpen(true);
  }

  function openNextPayment(contract: LeaseContractSummary) {
    if (!contract.hasInstallmentSchedule || !contract.nextPendingInstallment || contract.derivedStatus === "CANCELLED") {
      return;
    }
    setPaymentTarget({
      contract,
      installment: contract.nextPendingInstallment,
    });
  }

  function openEdit(contract: LeaseContractSummary) {
    setDetailOpen(false);
    setDetailLeaseId(null);
    setEditContract(contract);
  }

  function openDelete(contract: LeaseContractSummary) {
    setDetailOpen(false);
    setDetailLeaseId(null);
    setDeleteContract(contract);
  }

  async function handleDeleteLeaseContract() {
    if (!deleteContract) {
      return;
    }

    try {
      await deleteLeaseMutation.mutateAsync(deleteContract.id);
      await queryClient.invalidateQueries({ queryKey: LEASE_CONTRACTS_QUERY_KEY });
      queryClient.removeQueries({ queryKey: [`/api/branch/lease-contracts/${deleteContract.id}`] });
      toast({
        title: "Arrendamiento eliminado",
        description: "No tenía pagos ni movimientos financieros registrados.",
      });
      setDeleteContract(null);
    } catch (error: any) {
      toast({
        title: "No pudimos eliminar el arrendamiento",
        description: error?.message || "El contrato conserva su historial y no se eliminó nada.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-2xl border bg-card/70 p-4 shadow-sm md:rounded-3xl md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">Contratos independientes</Badge>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">Arrendamientos</h3>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Consulta contratos existentes, prepara corridas nuevas y crea arrendamientos independientes sin generar ingresos futuros en Caja.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Se muestran únicamente contratos de la sucursal actual.
            </div>
            <Button onClick={() => setQuoteDialogOpen(true)} data-testid="button-open-new-lease-quote">
              <Plus className="mr-2 h-4 w-4" />
              Nueva corrida
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ContractSummaryCard title="Contratos abiertos" value={String(summary.openContracts)} description="Activos o vencidos sin cierre manual" />
        <ContractSummaryCard title="Completados" value={String(summary.completedContracts)} />
        <ContractSummaryCard title="Vencidos con pagos pendientes" value={String(summary.expiredContracts)} />
        <ContractSummaryCard title="Cancelados" value={String(summary.cancelledContracts)} />
        <ContractSummaryCard title="Total mensual pactado" value={formatCurrencyMxFromCents(summary.totalMonthlyOpenAmountCents)} description="Solo contratos abiertos" />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label htmlFor="lease-search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="lease-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cliente o bien / equipo"
                  className="pl-9"
                  data-testid="input-lease-search"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as LeaseFilter)}>
                <SelectTrigger data-testid="select-lease-status">
                  <SelectValue placeholder="Filtrar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Activos</SelectItem>
                  <SelectItem value="EXPIRED">Vencidos</SelectItem>
                  <SelectItem value="COMPLETED">Completados</SelectItem>
                  <SelectItem value="CANCELLED">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              No pudimos cargar los arrendamientos de esta sucursal.
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-6 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h4 className="mt-3 text-base font-semibold">Sin arrendamientos para esta vista</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajusta la búsqueda o el filtro de estado para revisar otros contratos.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredContracts.map((contract) => (
                  <Card key={contract.id} className="border-border/70 shadow-sm" data-testid={`lease-card-${contract.id}`}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-semibold">{contract.clientDisplayName}</p>
                          <p className="mt-1 break-words text-sm text-muted-foreground">{contract.leasedItemDescription}</p>
                        </div>
                        <Badge variant={getLeaseStatusBadgeVariant(contract.derivedStatus)} className="shrink-0">
                          {getLeaseStatusLabel(contract.derivedStatus)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Mensualidad</p>
                          <p className="mt-1 font-medium">{formatCurrencyMxFromCents(contract.monthlyFinalTotalCents)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Pagadas</p>
                          <p className="mt-1 font-medium">{contract.totalPaidInstallments}/{contract.contractTermMonths}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Total pagado</p>
                          <p className="mt-1 font-medium">{contract.hasInstallmentSchedule ? formatCurrencyMxFromCents(contract.totalPaidInstallmentAmountCents) : "—"}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Saldo pendiente</p>
                          <p className="mt-1 font-medium">{contract.hasInstallmentSchedule ? formatCurrencyMxFromCents(contract.pendingContractBalanceCents) : "—"}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Próximo pago</p>
                          <p className="mt-1 font-medium">{contract.nextPendingInstallment ? `${formatDate(contract.nextPendingInstallment.dueDate)} · ${formatCurrencyMxFromCents(contract.nextPendingInstallment.finalTotalCents)}` : "—"}</p>
                        </div>
                      </div>

                      {getLeaseCollectionBadge(contract) ? (
                        <Badge variant={getLeaseCollectionBadge(contract)!.variant} className="w-fit">
                          {getLeaseCollectionBadge(contract)!.label}
                        </Badge>
                      ) : null}

                      {contract.hasInstallmentSchedule ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button variant="outline" className="w-full" onClick={() => openDetail(contract.id)} data-testid={`button-open-lease-${contract.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </Button>
                          {contract.nextPendingInstallment && contract.derivedStatus !== "CANCELLED" ? (
                            <Button className="w-full" onClick={() => openNextPayment(contract)} data-testid={`button-register-next-lease-payment-${contract.id}`}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              Registrar pago
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                          <p>Contrato con historial legacy protegido. Aún no se pueden registrar pagos desde esta tabla.</p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => openDetail(contract.id)} data-testid={`button-open-lease-${contract.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </Button>
                        </div>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        {contract.canEditAdministrativeDetails ? (
                          <Button variant="outline" size="sm" onClick={() => openEdit(contract)} data-testid={`button-edit-lease-${contract.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                        ) : null}
                        {contract.canDelete ? (
                          <Button variant="outline" size="sm" onClick={() => openDelete(contract)} data-testid={`button-delete-lease-${contract.id}`}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </Button>
                        ) : getLeaseDeletionProtectionMessage(contract) ? (
                          <span title={getLeaseDeletionProtectionMessage(contract) ?? undefined} className="inline-flex cursor-not-allowed">
                            <Button variant="outline" size="sm" disabled>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </Button>
                          </span>
                        ) : null}
                      </div>
                      {getLeaseDeletionProtectionMessage(contract) ? (
                        <p className="text-xs text-muted-foreground">{getLeaseDeletionProtectionMessage(contract)}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[1320px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Bien / equipo</TableHead>
                      <TableHead>Mensualidad</TableHead>
                      <TableHead>Pagadas X/Y</TableHead>
                      <TableHead>Total pagado</TableHead>
                      <TableHead>Saldo pendiente</TableHead>
                      <TableHead>Próximo pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow key={contract.id} data-testid={`lease-row-${contract.id}`}>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <p className="font-medium">{contract.clientDisplayName}</p>
                            {contract.clientEmail ? <p className="text-xs text-muted-foreground">{contract.clientEmail}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <p className="break-words">{contract.leasedItemDescription}</p>
                            {contract.planName ? <p className="text-xs text-muted-foreground">{contract.planName}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatCurrencyMxFromCents(contract.monthlyFinalTotalCents)}</p>
                            {getMonthlyBreakdown(contract).hint ? (
                              <p className="text-xs text-muted-foreground">{getMonthlyBreakdown(contract).hint}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{contract.totalPaidInstallments}/{contract.contractTermMonths}</TableCell>
                        <TableCell>{contract.hasInstallmentSchedule ? formatCurrencyMxFromCents(contract.totalPaidInstallmentAmountCents) : "—"}</TableCell>
                        <TableCell>{contract.hasInstallmentSchedule ? formatCurrencyMxFromCents(contract.pendingContractBalanceCents) : "—"}</TableCell>
                        <TableCell>
                          {contract.nextPendingInstallment ? (
                            <div className="min-w-[150px]">
                              <p>{formatDate(contract.nextPendingInstallment.dueDate)}</p>
                              <p className="text-xs text-muted-foreground">
                                {contract.nextPendingInstallment.installmentNumber}/{contract.contractTermMonths} · {formatCurrencyMxFromCents(contract.nextPendingInstallment.finalTotalCents)}
                              </p>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-[110px] flex-col items-start gap-1">
                            <Badge variant={getLeaseStatusBadgeVariant(contract.derivedStatus)}>
                              {getLeaseStatusLabel(contract.derivedStatus)}
                            </Badge>
                            {getLeaseCollectionBadge(contract) ? (
                              <Badge variant={getLeaseCollectionBadge(contract)!.variant} className="text-[10px]">
                                {getLeaseCollectionBadge(contract)!.label}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex min-w-[410px] flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openDetail(contract.id)} data-testid={`button-open-lease-${contract.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver
                            </Button>
                            {contract.nextPendingInstallment && contract.derivedStatus !== "CANCELLED" ? (
                              <Button size="sm" onClick={() => openNextPayment(contract)} data-testid={`button-register-next-lease-payment-${contract.id}`}>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Registrar pago
                              </Button>
                            ) : null}
                            {contract.canEditAdministrativeDetails ? (
                              <Button variant="outline" size="sm" onClick={() => openEdit(contract)} data-testid={`button-edit-lease-${contract.id}`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </Button>
                            ) : null}
                            {contract.canDelete ? (
                              <Button variant="outline" size="sm" onClick={() => openDelete(contract)} data-testid={`button-delete-lease-${contract.id}`}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </Button>
                            ) : getLeaseDeletionProtectionMessage(contract) ? (
                              <span title={getLeaseDeletionProtectionMessage(contract) ?? undefined} className="inline-flex cursor-not-allowed">
                                <Button variant="outline" size="sm" disabled>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </Button>
                              </span>
                            ) : null}
                            {!contract.hasInstallmentSchedule ? (
                              <span className="self-center text-xs text-muted-foreground">Contrato con historial legacy protegido.</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                {filteredContracts.length} contrato{filteredContracts.length === 1 ? "" : "s"} en la vista actual.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <LeaseQuoteDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onLeaseSaved={(leaseContractId) => {
          setDetailLeaseId(leaseContractId);
          setDetailOpen(true);
        }}
      />

      <LeaseQuoteDialog
        open={!!editContract}
        onOpenChange={(open) => {
          if (!open) {
            setEditContract(null);
          }
        }}
        editContract={editContract}
        onLeaseSaved={(leaseContractId) => {
          setEditContract(null);
          setDetailLeaseId(leaseContractId);
          setDetailOpen(true);
        }}
      />

      <LeaseDetailDialog
        leaseContractId={detailLeaseId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailLeaseId(null);
          }
        }}
        onRegisterPayment={setPaymentTarget}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <LeasePaymentDialog
        target={paymentTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentTarget(null);
          }
        }}
      />

      <AlertDialog open={!!deleteContract} onOpenChange={(open) => {
        if (!open) {
          setDeleteContract(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar arrendamiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este arrendamiento no tiene pagos registrados. Se eliminará definitivamente. No se eliminará el cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteContract ? (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{deleteContract.leasedItemDescription}</p>
              <p className="mt-1 text-muted-foreground">{deleteContract.clientDisplayName}</p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLeaseMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLeaseContract}
              disabled={deleteLeaseMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLeaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
