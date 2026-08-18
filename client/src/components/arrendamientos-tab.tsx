import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  FileText,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type LeaseContractFocusRequest = {
  leaseContractId: string;
  clientUserId?: string | null;
  nonce: number;
};

type LeaseContractStatus = "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED";
type LeaseFilter = "all" | LeaseContractStatus;

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
  taxModeSnapshot: "tax_exempt" | "tax_included" | "tax_added" | null;
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
  createdAt: string;
  updatedAt: string;
};

const LEASE_CONTRACTS_QUERY_KEY = ["/api/branch/lease-contracts"];

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
}: {
  leaseContractId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQueryKey = leaseContractId ? [`/api/branch/lease-contracts/${leaseContractId}`] : [];
  const { data, isLoading, error } = useQuery<LeaseContractSummary>({
    queryKey: detailQueryKey,
    enabled: open && !!leaseContractId,
  });

  const breakdown = data ? getMonthlyBreakdown(data) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalle del arrendamiento</DialogTitle>
          <DialogDescription>
            Consulta el contrato, el avance de mensualidades y el snapshot fiscal sin modificar caja ni pagos.
          </DialogDescription>
        </DialogHeader>

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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cliente</p><p className="mt-1 font-medium break-words">{data.clientDisplayName}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bien</p><p className="mt-1 font-medium break-words">{data.leasedItemDescription}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Inicio</p><p className="mt-1 font-medium">{formatDate(data.contractStartDate)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fin</p><p className="mt-1 font-medium">{formatDate(data.contractEndDate)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Plazo</p><p className="mt-1 font-medium">{data.contractTermMonths} meses</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{breakdown?.monthlyLabel ?? "Mensualidad pactada"}</p><p className="mt-1 font-medium">{formatCurrencyMxFromCents(data.capturedPriceCents)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{breakdown?.subtotalLabel ?? "Subtotal"}</p><p className="mt-1 font-medium">{breakdown?.subtotalValue ?? "—"}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">IVA</p><p className="mt-1 font-medium">{breakdown?.taxValue ?? "—"}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total mensual</p><p className="mt-1 font-medium">{breakdown?.totalValue ?? formatCurrencyMxFromCents(data.monthlyFinalTotalCents)}</p></CardContent></Card>
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

export default function ArrendamientosTab({ focusRequest }: { focusRequest?: LeaseContractFocusRequest | null } = {}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaseFilter>("all");
  const [detailLeaseId, setDetailLeaseId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: contracts = [], isLoading, error } = useQuery<LeaseContractSummary[]>({
    queryKey: LEASE_CONTRACTS_QUERY_KEY,
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-2xl border bg-card/70 p-4 shadow-sm md:rounded-3xl md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">Solo lectura</Badge>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">Arrendamientos</h3>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Consulta contratos existentes, avance de mensualidades y snapshot fiscal contractual sin crear pagos ni modificar Caja.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Se muestran únicamente contratos de la sucursal actual.
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
                          <p className="text-muted-foreground">Inicio</p>
                          <p className="mt-1 font-medium">{formatDate(contract.contractStartDate)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Fin</p>
                          <p className="mt-1 font-medium">{formatDate(contract.contractEndDate)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Mensualidad</p>
                          <p className="mt-1 font-medium">{formatCurrencyMxFromCents(contract.monthlyFinalTotalCents)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Pagadas</p>
                          <p className="mt-1 font-medium">{contract.totalPaidInstallments}/{contract.contractTermMonths}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Pendientes</p>
                          <p className="mt-1 font-medium">{contract.pendingInstallments}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2">
                          <p className="text-muted-foreground">Meses restantes</p>
                          <p className="mt-1 font-medium">{contract.remainingCalendarMonths}</p>
                        </div>
                      </div>

                      <Button variant="outline" className="w-full" onClick={() => openDetail(contract.id)} data-testid={`button-open-lease-${contract.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver arrendamiento
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Bien / equipo</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fin contractual</TableHead>
                      <TableHead>Mensualidad pactada</TableHead>
                      <TableHead>Pagadas X/Y</TableHead>
                      <TableHead>Pendientes</TableHead>
                      <TableHead>Meses restantes</TableHead>
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
                        <TableCell>{formatDate(contract.contractStartDate)}</TableCell>
                        <TableCell>{formatDate(contract.contractEndDate)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatCurrencyMxFromCents(contract.monthlyFinalTotalCents)}</p>
                            {getMonthlyBreakdown(contract).hint ? (
                              <p className="text-xs text-muted-foreground">{getMonthlyBreakdown(contract).hint}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{contract.totalPaidInstallments}/{contract.contractTermMonths}</TableCell>
                        <TableCell>{contract.pendingInstallments}</TableCell>
                        <TableCell>{contract.remainingCalendarMonths}</TableCell>
                        <TableCell>
                          <Badge variant={getLeaseStatusBadgeVariant(contract.derivedStatus)}>
                            {getLeaseStatusLabel(contract.derivedStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openDetail(contract.id)} data-testid={`button-open-lease-${contract.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </Button>
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

      <LeaseDetailDialog
        leaseContractId={detailLeaseId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailLeaseId(null);
          }
        }}
      />
    </div>
  );
}
