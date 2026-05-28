import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Download,
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  branchFinanceExpenseCategories,
  branchFinanceIncomeCategories,
  branchFinancePaymentMethodValues,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

type FinanceEntryType = "income" | "expense";
type RangePreset = "today" | "week" | "month" | "three_months" | "custom";

interface BranchFinanceSummary {
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
  email: string;
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

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  otro: "Otro",
};

const CATEGORY_LABELS: Record<string, string> = {
  membresia: "Membresia",
  paquete: "Paquete",
  servicio: "Servicio",
  producto: "Producto",
  clase: "Clase",
  renta: "Renta",
  productos: "Productos",
  sueldos: "Sueldos",
  mantenimiento: "Mantenimiento",
  publicidad: "Publicidad",
  otro: "Otro",
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

function getTodayDateString() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function getQuickRange(preset: Exclude<RangePreset, "custom">) {
  const today = new Date(`${getTodayDateString()}T12:00:00`);
  const to = today.toLocaleDateString("en-CA");
  const fromDate = new Date(today);

  if (preset === "today") {
    return { from: to, to };
  }

  if (preset === "week") {
    fromDate.setDate(fromDate.getDate() - 6);
    return { from: fromDate.toLocaleDateString("en-CA"), to };
  }

  if (preset === "month") {
    return { from: `${to.slice(0, 7)}-01`, to };
  }

  fromDate.setMonth(fromDate.getMonth() - 3);
  fromDate.setDate(fromDate.getDate() + 1);
  return { from: fromDate.toLocaleDateString("en-CA"), to };
}

function buildSummaryUrl(from: string, to: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
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

function getCategoryLabel(category: string | null) {
  if (!category) return "Sin categoria";
  return CATEGORY_LABELS[category] || category;
}

function getPaymentMethodLabel(paymentMethod: string | null) {
  if (!paymentMethod) return "Sin definir";
  return PAYMENT_LABELS[paymentMethod] || paymentMethod;
}

function invalidateFinanceQueries() {
  queryClient.invalidateQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === "string" &&
      query.queryKey[0].startsWith("/api/branch/finance/"),
  });
}

export default function CajaTab() {
  const { toast } = useToast();
  const [rangePreset, setRangePreset] = useState<RangePreset>("month");
  const [from, setFrom] = useState(getQuickRange("month").from);
  const [to, setTo] = useState(getQuickRange("month").to);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clientSearch, setClientSearch] = useState("");
  const [form, setForm] = useState<FinanceFormState>(createInitialFormState());
  const [editingEntry, setEditingEntry] = useState<BranchFinanceEntry | null>(null);

  const summaryUrl = buildSummaryUrl(from, to);
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

  const { data: summary, isLoading: summaryLoading } = useQuery<BranchFinanceSummary>({
    queryKey: [summaryUrl],
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery<FinanceEntriesResponse>({
    queryKey: [entriesUrl],
  });

  const { data: clients = [] } = useQuery<BranchClient[]>({
    queryKey: ["/api/branch/clients"],
  });

  useEffect(() => {
    setPage(1);
  }, [from, to, typeFilter, categoryFilter, clientFilter, search]);

  const filteredClients = clients.filter((client) => {
    const fullName = [client.name, client.lastName].filter(Boolean).join(" ").trim().toLowerCase();
    const needle = clientSearch.trim().toLowerCase();
    if (!needle) return true;
    return (
      fullName.includes(needle) ||
      client.email.toLowerCase().includes(needle) ||
      (client.phone || "").toLowerCase().includes(needle)
    );
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Captura un monto valido");
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
    onSuccess: () => {
      invalidateFinanceQueries();
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
    onSuccess: () => {
      invalidateFinanceQueries();
      toast({ title: "Movimiento eliminado" });
      if (editingEntry) {
        setEditingEntry(null);
        setForm(createInitialFormState());
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

  function handleQuickRangeChange(preset: Exclude<RangePreset, "custom">) {
    const range = getQuickRange(preset);
    setRangePreset(preset);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingEntry(null);
    setForm(createInitialFormState());
    setClientSearch("");
  }

  function handleExport() {
    const link = document.createElement("a");
    link.href = buildExportUrl(from, to, typeFilter);
    link.download = "caja.csv";
    link.click();
  }

  const pageCount = entriesData?.pageCount || 1;
  const pageLabel = entriesData?.total ? `${entriesData.total} movimientos` : "Sin movimientos";

  return (
    <div className="space-y-6">
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
        {summaryLoading ? (
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
                  <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(summary?.todayIncome || 0)}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-emerald-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Gastos hoy</p>
                  <p className="text-2xl font-semibold text-rose-600">{formatCurrency(summary?.todayExpense || 0)}</p>
                </div>
                <ArrowDownRight className="h-8 w-8 text-rose-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Ganancia hoy</p>
                  <p className="text-2xl font-semibold">{formatCurrency((summary?.todayIncome || 0) - (summary?.todayExpense || 0))}</p>
                </div>
                <PiggyBank className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Ganancia del mes</p>
                  <p className="text-2xl font-semibold">{formatCurrency((summary?.monthIncome || 0) - (summary?.monthExpense || 0))}</p>
                </div>
                <Wallet className="h-8 w-8 text-amber-500" />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            Resumen y filtros
          </CardTitle>
          <CardDescription>Filtra los movimientos para analizar periodos concretos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={rangePreset === "today" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("today")}>Hoy</Button>
            <Button variant={rangePreset === "week" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("week")}>Esta semana</Button>
            <Button variant={rangePreset === "month" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("month")}>Este mes</Button>
            <Button variant={rangePreset === "three_months" ? "default" : "outline"} size="sm" onClick={() => handleQuickRangeChange("three_months")}>Ultimos 3 meses</Button>
            <Button variant={rangePreset === "custom" ? "default" : "outline"} size="sm" onClick={() => setRangePreset("custom")}>Rango personalizado</Button>
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
              <Label>Categoria</Label>
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

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ingresos del rango</p>
                <p className="mt-2 text-xl font-semibold text-emerald-600">{formatCurrency(summary?.totalIncome || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gastos del rango</p>
                <p className="mt-2 text-xl font-semibold text-rose-600">{formatCurrency(summary?.totalExpense || 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ganancia del rango</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(summary?.netProfit || 0)}</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            {editingEntry ? "Editar movimiento" : "Nuevo movimiento"}
          </CardTitle>
          <CardDescription>
            Registra ingresos y gastos manuales. Puedes ligarlos a un cliente o capturar el nombre manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label>Categoria</Label>
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
              <Label>Metodo de pago</Label>
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
                        {[client.name, client.lastName].filter(Boolean).join(" ")} - {client.email}
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

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.concept.trim() || !form.amount}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
              {editingEntry ? "Guardar cambios" : "Registrar movimiento"}
            </Button>
            {editingEntry ? (
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancelar edicion
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.7fr,1fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Movimientos</CardTitle>
                <CardDescription>{pageLabel}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
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
                <p className="font-medium">Aun no hay movimientos para este rango</p>
                <p className="mt-1 text-sm text-muted-foreground">Registra un ingreso o gasto para empezar a usar tu caja.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesData.items.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDateLabel(entry.entryDate)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.type === "income" ? "default" : "destructive"} className={entry.type === "income" ? "bg-emerald-600" : ""}>
                            {entry.type === "income" ? "Ingreso" : "Gasto"}
                          </Badge>
                        </TableCell>
                        <TableCell>{getCategoryLabel(entry.category)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.concept}</p>
                            {entry.notes ? <p className="text-xs text-muted-foreground">{entry.notes}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{entry.clientDisplayName || "Sin cliente"}</p>
                            {entry.clientEmail ? <p className="text-xs text-muted-foreground">{entry.clientEmail}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>{getPaymentMethodLabel(entry.paymentMethod)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.amount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditEntry(entry)}>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Pagina {entriesData.page} de {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>
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
              <CardTitle className="text-base">Total por dia</CardTitle>
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
              <CardTitle className="text-base">Categorias top</CardTitle>
              <CardDescription>Las categorias que mas mueven tu caja.</CardDescription>
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
    </div>
  );
}
