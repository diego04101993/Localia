import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Plus, Wallet } from "lucide-react";
import { apiRequest, fetchJson, queryClient } from "@/lib/queryClient";
import { invalidateBranchFinanceQueries } from "@/lib/branch-dashboard-cache";
import { matchesExpenseProjectQuery, refreshExpenseProjectDetails } from "@/lib/expense-obligation-cache";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { computeExpenseObligationTax, type ExpenseObligationTaxMode } from "@shared/expense-obligation";

type ExpenseRow = {
  id: string;
  projectId: string | null;
  supplierId: string | null;
  beneficiaryNameSnapshot: string;
  concept: string;
  category: string | null;
  documentReference: string | null;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  documentStatus: "draft" | "open" | "cancelled";
  subtotalAmount: string;
  discountAmount: string;
  subtotalBeforeTax: string;
  taxableSubtotal: string;
  taxMode: ExpenseObligationTaxMode;
  taxRate: string;
  taxTotal: string;
  grandTotal: string;
  paidAmount: string;
  pendingAmount: string;
  paymentStatus: "unpaid" | "partial" | "paid";
};

type ExpenseDetail = ExpenseRow & {
  payments: Array<{ id: string; amount: string; paymentMethod: string; entryDate: string; reference: string | null; financeEntryId: string }>;
  paymentPage: number;
  paymentTotal: number;
};

type ExpensePage = { items: ExpenseRow[]; page: number; pageSize: number; total: number };
type SupplierOption = { id: string; name: string; isActive: boolean; deletedAt: string | null };
type ProjectOption = { id: string; code: string; name: string };

type ExpenseForm = {
  projectId: string;
  supplierId: string;
  beneficiaryName: string;
  concept: string;
  category: string;
  documentReference: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  subtotalAmount: string;
  discountAmount: string;
  taxMode: ExpenseObligationTaxMode;
  taxRate: string;
  initialAmount: string;
  initialEntryDate: string;
  paymentMethod: string;
  initialReference: string;
  initialNotes: string;
};

function todayLocal() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function isOverdue(row: ExpenseRow) {
  return row.documentStatus === "open" && Number(row.pendingAmount) > 0 && !!row.dueDate && row.dueDate < todayLocal();
}

function statusLabel(row: ExpenseRow) {
  if (row.documentStatus === "draft") return "Borrador";
  if (row.documentStatus === "cancelled") return "Cancelado";
  if (row.paymentStatus === "paid") return "Pagado";
  return row.paymentStatus === "partial" ? "Pago parcial" : "Sin pagar";
}

function emptyForm(projectId: string | null): ExpenseForm {
  return {
    projectId: projectId ?? "", supplierId: "", beneficiaryName: "", concept: "", category: "",
    documentReference: "", issueDate: todayLocal(), dueDate: "", notes: "",
    subtotalAmount: "", discountAmount: "0.00", taxMode: "tax_exempt", taxRate: "0",
    initialAmount: "", initialEntryDate: todayLocal(), paymentMethod: "efectivo",
    initialReference: "", initialNotes: "",
  };
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "No pudimos completar la operación.";
}

export default function GastosCuentasPanel({
  open: controlledOpen,
  onOpenChange,
  initialProjectId = null,
  initialProjectName = null,
  showTrigger = false,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialProjectId?: string | null;
  initialProjectName?: string | null;
  showTrigger?: boolean;
}) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [mode, setMode] = useState<"list" | "form" | "detail">("list");
  const [formPurpose, setFormPurpose] = useState<"paid" | "payable" | "draft" | "edit">("payable");
  const [hasInitialPayment, setHasInitialPayment] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(() => emptyForm(initialProjectId));
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentEntryDate, setPaymentEntryDate] = useState(() => todayLocal());
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectChoice, setProjectChoice] = useState("");
  const [page, setPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialProjectId && mode === "list") setForm((previous) => ({ ...previous, projectId: initialProjectId }));
  }, [initialProjectId, mode, open]);

  const listUrl = `/api/branch/expense-obligations?page=${page}&pageSize=25${initialProjectId ? `&projectId=${encodeURIComponent(initialProjectId)}` : ""}`;
  const detailUrl = selectedId ? `/api/branch/expense-obligations/${selectedId}?paymentPage=${paymentPage}` : "";
  const listQuery = useQuery<ExpensePage>({
    queryKey: [listUrl], enabled: open,
    queryFn: async ({ signal }) => (await fetchJson<ExpensePage>(listUrl, { signal }))!,
  });
  const detailQuery = useQuery<ExpenseDetail>({
    queryKey: [detailUrl], enabled: open && !!selectedId,
    queryFn: async ({ signal }) => (await fetchJson<ExpenseDetail>(detailUrl, { signal }))!,
  });
  const suppliersQuery = useQuery<SupplierOption[]>({
    queryKey: ["/api/branch/suppliers"], enabled: open && mode === "form",
    queryFn: async ({ signal }) => (await fetchJson<SupplierOption[]>("/api/branch/suppliers", { signal }))!,
  });
  const projectsQuery = useQuery<ProjectOption[]>({
    queryKey: ["/api/branch/commercial-projects/options"], enabled: open && (mode === "form" || mode === "detail"),
    queryFn: async ({ signal }) => (await fetchJson<ProjectOption[]>("/api/branch/commercial-projects/options", { signal }))!,
  });

  function projectLabel(projectId: string | null) {
    if (!projectId) return "Sin proyecto";
    if (projectId === initialProjectId && initialProjectName) return initialProjectName;
    const project = projectsQuery.data?.find((option) => option.id === projectId);
    return project ? `${project.code} · ${project.name}` : "Proyecto vinculado";
  }

  useEffect(() => {
    if (detailQuery.data) setProjectChoice(detailQuery.data.projectId ?? "");
  }, [detailQuery.data?.id, detailQuery.data?.projectId]);

  const preview = (() => {
    try {
      if (!form.subtotalAmount) return null;
      return computeExpenseObligationTax({
        subtotalAmount: form.subtotalAmount, discountAmount: form.discountAmount,
        taxMode: form.taxMode, taxRate: form.taxRate,
      });
    } catch { return null; }
  })();
  const previewPaidNow = formPurpose === "paid" ? preview?.grandTotal ?? "0" : formPurpose === "payable" && hasInitialPayment ? form.initialAmount || "0" : "0";
  const previewPending = preview && Number.isFinite(Number(previewPaidNow))
    ? Math.max(0, Number(preview.grandTotal) - Number(previewPaidNow)) : null;

  async function synchronize(projectIds: readonly (string | null | undefined)[]) {
    await Promise.all([
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/branch/expense-obligations") }),
      invalidateBranchFinanceQueries(),
      queryClient.invalidateQueries({ predicate: (query) => matchesExpenseProjectQuery(query.queryKey, projectIds) }),
    ]);
    await refreshExpenseProjectDetails(queryClient, projectIds);
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: { url: string; method: string; body: unknown }) => {
      const response = await apiRequest(payload.method, payload.url, payload.body);
      return response.json() as Promise<{ document?: ExpenseDetail } & ExpenseDetail>;
    },
  });

  function beginForm(purpose: "paid" | "payable" | "draft", row?: ExpenseRow) {
    setError(null);
    setFormPurpose(row ? "edit" : purpose);
    setForm(row ? {
      projectId: row.projectId ?? "", supplierId: row.supplierId ?? "",
      beneficiaryName: row.supplierId ? "" : row.beneficiaryNameSnapshot,
      concept: row.concept, category: row.category ?? "", documentReference: row.documentReference ?? "",
      issueDate: row.issueDate, dueDate: row.dueDate ?? "", notes: row.notes ?? "",
      subtotalAmount: row.subtotalAmount, discountAmount: row.discountAmount,
      taxMode: row.taxMode, taxRate: row.taxRate, initialAmount: "", initialEntryDate: todayLocal(), paymentMethod: "efectivo",
      initialReference: "", initialNotes: "",
    } : emptyForm(initialProjectId));
    setHasInitialPayment(false);
    if (!row) setOperationKey(crypto.randomUUID());
    setMode("form");
  }

  async function save() {
    if (saveMutation.isPending) return;
    setError(null);
    if (!preview) { setError("Revisa el importe, descuento e IVA antes de guardar."); return; }
    const document = {
      projectId: form.projectId || null, supplierId: form.supplierId || null,
      beneficiaryName: form.supplierId ? null : form.beneficiaryName,
      concept: form.concept, category: form.category || null,
      documentReference: form.documentReference || null,
      issueDate: form.issueDate, dueDate: form.dueDate || null, notes: form.notes || null,
      documentStatus: formPurpose === "draft" ? "draft" : formPurpose === "edit" ? detailQuery.data?.documentStatus ?? "open" : "open",
      subtotalAmount: form.subtotalAmount, discountAmount: form.discountAmount,
      taxMode: form.taxMode, taxRate: form.taxRate,
    };
    if (formPurpose === "edit" && !selectedId) { setError("Selecciona un documento para editar."); return; }
    const initialAmount = formPurpose === "paid" ? preview.grandTotal : formPurpose === "payable" && hasInitialPayment ? form.initialAmount : "";
    if (formPurpose === "payable" && hasInitialPayment && (!initialAmount || Number(initialAmount) <= 0)) {
      setError("Captura el monto del abono inicial o elige No.");
      return;
    }
    const initialPayment = formPurpose === "edit" || formPurpose === "draft" || !initialAmount || Number(initialAmount) <= 0 ? null : {
      amount: initialAmount, paymentMethod: form.paymentMethod,
      entryDate: form.initialEntryDate, reference: form.initialReference || null, notes: form.initialNotes || null,
    };
    try {
      const result = await saveMutation.mutateAsync(formPurpose === "edit" ? {
        method: "PATCH", url: `/api/branch/expense-obligations/${selectedId}`, body: document,
      } : {
        method: "POST", url: "/api/branch/expense-obligations",
        body: { operationKey, document, initialPayment },
      });
      const saved = "document" in result && result.document ? result.document : result;
      await synchronize([detailQuery.data?.projectId, saved.projectId]);
      setSelectedId(saved.id);
      setPaymentPage(1);
      setMode("detail");
      toast({ title: formPurpose === "edit" ? "Documento actualizado" : "Documento guardado" });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function pay() {
    if (!selectedId || saveMutation.isPending) return;
    setError(null);
    try {
      await saveMutation.mutateAsync({
        method: "POST", url: `/api/branch/expense-obligations/${selectedId}/pay`,
        body: { operationKey: paymentKey, amount: paymentAmount, paymentMethod, entryDate: paymentEntryDate },
      });
      await synchronize([detailQuery.data?.projectId]);
      setPaymentKey(crypto.randomUUID());
      setPaymentAmount("");
      setPaymentEntryDate(todayLocal());
      toast({ title: "Pago registrado en Caja" });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function transition(action: "confirm" | "cancel") {
    if (!selectedId || saveMutation.isPending) return;
    if (action === "cancel" && !window.confirm("Este documento sin pagos quedará cancelado y conservará su historial. ¿Continuar?")) return;
    setError(null);
    try {
      await saveMutation.mutateAsync({ method: "POST", url: `/api/branch/expense-obligations/${selectedId}/${action}`, body: {} });
      await synchronize([detailQuery.data?.projectId]);
      toast({ title: action === "confirm" ? "Obligación confirmada" : "Documento cancelado" });
    } catch (failure) { setError(errorMessage(failure)); }
  }

  async function reassignProject() {
    if (!selectedId || saveMutation.isPending) return;
    setError(null);
    try {
      await saveMutation.mutateAsync({
        method: "POST", url: `/api/branch/expense-obligations/${selectedId}/reassign-project`,
        body: { projectId: projectChoice || null },
      });
      await synchronize([detailQuery.data?.projectId, projectChoice || null]);
      toast({ title: "Proyecto reasignado" });
    } catch (failure) { setError(errorMessage(failure)); }
  }

  function close(nextOpen: boolean) {
    if (saveMutation.isPending) return;
    setOpen(nextOpen);
    if (!nextOpen) { setMode("list"); setSelectedId(null); setError(null); }
  }

  return (
    <>
      {showTrigger && <Button variant="outline" onClick={() => setOpen(true)}><FileText className="mr-2 h-4 w-4" />Gastos y cuentas por pagar</Button>}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 py-4">
            <DialogTitle>Gastos y cuentas por pagar</DialogTitle>
            <DialogDescription>Registra lo que debes y separa los pagos reales de la deuda.</DialogDescription>
            {initialProjectId && <p className="text-sm font-medium">Proyecto: {initialProjectName || "Proyecto seleccionado"}</p>}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {mode === "list" && <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="h-auto flex-col items-start gap-1 p-4 text-left" onClick={() => beginForm("paid")}><span className="flex items-center gap-2"><Wallet className="h-4 w-4" />Registrar gasto pagado</span><span className="text-xs font-normal opacity-85">Ya pagaste el total.</span></Button>
                <Button variant="outline" className="h-auto flex-col items-start gap-1 p-4 text-left" onClick={() => beginForm("payable")}><span className="flex items-center gap-2"><Plus className="h-4 w-4" />Registrar cuenta por pagar</span><span className="text-xs font-normal text-muted-foreground">Debes todo o una parte.</span></Button>
              </div>
              <div>
                <Button variant="ghost" onClick={() => beginForm("draft")}>Guardar borrador</Button>
              </div>
              {listQuery.isLoading ? <p>Cargando documentos...</p> : listQuery.isError ? <p>No pudimos cargar los documentos. Reintenta.</p> : !listQuery.data?.items.length ? <p className="text-sm text-muted-foreground">Todavía no hay documentos de gasto registrados.</p> : (
                <div className="divide-y rounded-lg border">
                  {listQuery.data.items.map((row) => <button key={row.id} type="button" onClick={() => { setSelectedId(row.id); setPaymentPage(1); setMode("detail"); }} className="w-full space-y-3 p-4 text-left hover:bg-muted/40">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{row.beneficiaryNameSnapshot}</p><p className="text-sm text-muted-foreground">{row.concept}</p><p className="text-xs text-muted-foreground">Proyecto: {projectLabel(row.projectId)}</p></div><div className="flex gap-1"><Badge variant="outline">{statusLabel(row)}</Badge>{isOverdue(row) && <Badge variant="destructive">Vencido</Badge>}</div></div>
                    <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6"><span>Base<br /><strong>{formatMoney(row.taxableSubtotal)}</strong></span><span>IVA<br /><strong>{formatMoney(row.taxTotal)}</strong></span><span>Total<br /><strong>{formatMoney(row.grandTotal)}</strong></span><span>Pagado<br /><strong>{formatMoney(row.paidAmount)}</strong></span><span>Pendiente<br /><strong>{formatMoney(row.pendingAmount)}</strong></span><span>Vencimiento<br /><strong>{row.dueDate || "Sin fecha"}</strong></span></div>
                  </button>)}
                </div>
              )}
              <div className="flex items-center justify-end gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-sm">Página {page}</span><Button variant="outline" disabled={!listQuery.data || page * 25 >= listQuery.data.total} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
            </div>}
            {mode === "form" && <div className="space-y-4">
              <div><h3 className="text-lg font-semibold">{formPurpose === "paid" ? "Registrar gasto pagado" : formPurpose === "payable" ? "Registrar cuenta por pagar" : formPurpose === "draft" ? "Guardar borrador" : "Corregir documento"}</h3><p className="text-sm text-muted-foreground">{formPurpose === "paid" ? "El total se registrará como salida de dinero en Caja." : formPurpose === "payable" ? "Registra cuánto debes. Si no haces un pago ahora, todavía no habrá salida de dinero en Caja." : formPurpose === "draft" ? "No afecta todavía tus gastos ni cuentas por pagar." : "Solo puedes corregir documentos sin pagos."}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Proveedor</Label><Select value={form.supplierId || "none"} onValueChange={(value) => setForm({ ...form, supplierId: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger><SelectContent><SelectItem value="none">Beneficiario manual</SelectItem>{suppliersQuery.data?.filter((supplier) => supplier.isActive && !supplier.deletedAt).map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>¿A quién le vas a pagar?</Label><Input value={form.beneficiaryName} disabled={!!form.supplierId} placeholder={form.supplierId ? "Se conservará el nombre del proveedor" : "Nombre de quien recibe"} onChange={(event) => setForm({ ...form, beneficiaryName: event.target.value })} /></div>
                <div><Label>Concepto</Label><Input value={form.concept} onChange={(event) => setForm({ ...form, concept: event.target.value })} /></div>
                <div><Label>Categoría</Label><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></div>
                <div><Label>Proyecto opcional</Label><Select value={form.projectId || "none"} disabled={formPurpose === "edit"} onValueChange={(value) => setForm({ ...form, projectId: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger><SelectContent><SelectItem value="none">Sin proyecto</SelectItem>{projectsQuery.data?.map((project) => <SelectItem key={project.id} value={project.id}>{project.code} · {project.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Referencia de documento</Label><Input value={form.documentReference} onChange={(event) => setForm({ ...form, documentReference: event.target.value })} /></div>
                <div><Label>Fecha del documento</Label><Input type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></div>
                <div><Label>Vencimiento opcional</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div>
                <div><Label>{form.taxMode === "tax_included" ? "Importe con IVA incluido" : "Importe sin IVA"}</Label><Input type="number" min="0" step="0.01" value={form.subtotalAmount} onChange={(event) => setForm({ ...form, subtotalAmount: event.target.value })} /></div>
                <div><Label>Descuento</Label><Input type="number" min="0" step="0.01" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} /></div>
                <div><Label>IVA</Label><Select value={form.taxMode} onValueChange={(value) => setForm({ ...form, taxMode: value as ExpenseObligationTaxMode, taxRate: value === "tax_exempt" ? "0" : "16" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tax_exempt">Sin IVA</SelectItem><SelectItem value="tax_included">IVA incluido</SelectItem><SelectItem value="tax_added">Se agregará IVA</SelectItem></SelectContent></Select></div>
                <div><Label>Tasa de IVA (%)</Label><Input type="number" min="0" max="100" step="0.0001" value={form.taxRate} disabled={form.taxMode === "tax_exempt"} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></div>
              </div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <p className="mb-3 font-semibold">Resumen del documento</p>
                {preview ? <div className="space-y-2">
                  <div className="flex justify-between gap-3"><span>Importe sin IVA</span><strong>{formatMoney(preview.subtotalBeforeTax)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Descuento capturado</span><strong>{formatMoney(preview.discountAmount)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Base después del descuento</span><strong>{formatMoney(preview.taxableSubtotal)}</strong></div>
                  <div className="flex justify-between gap-3"><span>IVA {Number(preview.taxRate)}%</span><strong>{formatMoney(preview.taxTotal)}</strong></div>
                  <div className="flex justify-between gap-3 border-t pt-3 text-lg font-bold"><span>TOTAL A PAGAR</span><span>{formatMoney(preview.grandTotal)}</span></div>
                  <div className="flex justify-between gap-3 pt-2"><span>Pagado ahora</span><strong>{Number.isFinite(Number(previewPaidNow)) ? formatMoney(previewPaidNow) : "—"}</strong></div>
                  <div className="flex justify-between gap-3 text-base font-semibold"><span>PENDIENTE</span><span>{previewPending == null ? "—" : formatMoney(previewPending)}</span></div>
                  <p className="text-xs text-muted-foreground">{form.taxMode === "tax_included" ? "El total capturado ya incluye IVA. Si hay descuento, el importe capturado también incluye IVA." : form.taxMode === "tax_added" ? "El IVA se agregará al importe." : "No se registrará IVA en este documento."}</p>
                </div> : <p className="text-muted-foreground">Captura un importe y tasa válidos para ver el desglose.</p>}
                {formPurpose === "draft" && <p className="mt-3 rounded-md bg-background p-2">No afecta todavía tus gastos ni cuentas por pagar.</p>}
              </div>
              {formPurpose === "payable" && <div className="space-y-3 rounded-lg border p-4"><p className="font-medium">¿Ya pagaste una parte?</p><div className="flex gap-2"><Button type="button" variant={!hasInitialPayment ? "default" : "outline"} aria-pressed={!hasInitialPayment} onClick={() => setHasInitialPayment(false)}>No</Button><Button type="button" variant={hasInitialPayment ? "default" : "outline"} aria-pressed={hasInitialPayment} onClick={() => setHasInitialPayment(true)}>Sí</Button></div></div>}
              {(formPurpose === "paid" || formPurpose === "payable" && hasInitialPayment) && <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Este pago sí se registrará como salida de dinero en Caja.</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {formPurpose === "payable" && <div><Label>Monto pagado ahora</Label><Input type="number" min="0" step="0.01" value={form.initialAmount} onChange={(event) => setForm({ ...form, initialAmount: event.target.value })} /></div>}
                  <div><Label>Fecha del pago</Label><Input type="date" value={form.initialEntryDate} onChange={(event) => setForm({ ...form, initialEntryDate: event.target.value })} /></div>
                  <div><Label>Método de pago</Label><Select value={form.paymentMethod} onValueChange={(value) => setForm({ ...form, paymentMethod: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["efectivo", "tarjeta", "transferencia", "mercado_pago", "otro"].map((method) => <SelectItem key={method} value={method}>{method.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Referencia del pago</Label><Input value={form.initialReference} onChange={(event) => setForm({ ...form, initialReference: event.target.value })} /></div>
                </div>
                <div><Label>Notas del pago</Label><Textarea value={form.initialNotes} onChange={(event) => setForm({ ...form, initialNotes: event.target.value })} /></div>
              </div>}
            </div>}
            {mode === "detail" && <div className="space-y-5">
              {detailQuery.isLoading ? <p>Cargando documento...</p> : !detailQuery.data ? <p>No pudimos cargar el documento.</p> : <>
                <div className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">A quién se le debe</p><h4 className="text-lg font-semibold">{detailQuery.data.beneficiaryNameSnapshot}</h4><p>{detailQuery.data.concept}</p></div><div className="flex gap-1"><Badge variant="outline">{statusLabel(detailQuery.data)}</Badge>{isOverdue(detailQuery.data) && <Badge variant="destructive">Vencido</Badge>}</div></div><div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p>Proyecto: {projectLabel(detailQuery.data.projectId)}</p><p>Referencia: {detailQuery.data.documentReference || "Sin referencia"}</p><p>Fecha: {detailQuery.data.issueDate}</p><p>Vencimiento: {detailQuery.data.dueDate || "Sin fecha"}</p></div></div>
                <div className="rounded-lg border p-4"><h5 className="mb-3 font-medium">Desglose</h5><div className="grid gap-3 text-sm sm:grid-cols-3"><div>Base después del descuento<br /><strong>{formatMoney(detailQuery.data.taxableSubtotal)}</strong></div><div>IVA documental<br /><strong>{formatMoney(detailQuery.data.taxTotal)}</strong></div><div>Total<br /><strong>{formatMoney(detailQuery.data.grandTotal)}</strong></div></div></div>
                <div className="rounded-lg border bg-muted/30 p-4"><h5 className="mb-3 font-medium">Resumen</h5><div className="grid gap-3 text-sm sm:grid-cols-3"><div>Total<br /><strong>{formatMoney(detailQuery.data.grandTotal)}</strong></div><div>Pagado<br /><strong>{formatMoney(detailQuery.data.paidAmount)}</strong></div><div>Pendiente<br /><strong>{formatMoney(detailQuery.data.pendingAmount)}</strong></div></div></div>
                <p className="text-sm text-muted-foreground">Una factura o referencia capturada no significa que su CFDI haya sido validado.</p>
                <div className="flex flex-wrap gap-2">{detailQuery.data.documentStatus === "draft" && <Button disabled={saveMutation.isPending} onClick={() => transition("confirm")}>Confirmar obligación</Button>}{detailQuery.data.documentStatus !== "cancelled" && detailQuery.data.paymentStatus === "unpaid" && <><Button variant="outline" disabled={saveMutation.isPending} onClick={() => beginForm("payable", detailQuery.data)}>Corregir documento</Button><Button variant="destructive" disabled={saveMutation.isPending} onClick={() => transition("cancel")}>Cancelar sin pagos</Button></>}</div>
                {detailQuery.data.documentStatus !== "cancelled" && detailQuery.data.paymentStatus === "unpaid" && <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3"><div className="min-w-[220px] flex-1"><Label>Reasignar proyecto</Label><Select value={projectChoice || "none"} onValueChange={(value) => setProjectChoice(value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin proyecto</SelectItem>{projectsQuery.data?.map((project) => <SelectItem key={project.id} value={project.id}>{project.code} · {project.name}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" disabled={saveMutation.isPending || projectChoice === (detailQuery.data.projectId ?? "")} onClick={reassignProject}>Reasignar</Button></div>}
                {detailQuery.data.documentStatus === "open" && detailQuery.data.paymentStatus !== "paid" && <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"><div><Label>Nuevo pago</Label><Input type="number" min="0" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></div><div><Label>Fecha del pago</Label><Input type="date" value={paymentEntryDate} onChange={(event) => setPaymentEntryDate(event.target.value)} /></div><div><Label>Método</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["efectivo", "tarjeta", "transferencia", "mercado_pago", "otro"].map((method) => <SelectItem key={method} value={method}>{method.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><Button className="self-end" disabled={saveMutation.isPending || !paymentAmount} onClick={pay}>Registrar pago</Button></div>}
                <div><h5 className="mb-2 font-medium">Pagos registrados</h5>{detailQuery.data.payments.length ? <div className="divide-y rounded-lg border">{detailQuery.data.payments.map((payment) => <div key={payment.id} className="grid gap-2 p-3 text-sm sm:grid-cols-4"><span>Fecha<br /><strong>{payment.entryDate}</strong></span><span>Método<br /><strong>{payment.paymentMethod.replace("_", " ")}</strong></span><span>Monto<br /><strong>{formatMoney(payment.amount)}</strong></span><span>Referencia<br /><strong>{payment.reference || "Sin referencia"}</strong></span></div>)}</div> : <p className="text-sm text-muted-foreground">No hay dinero pagado todavía.</p>}{detailQuery.data.paymentTotal > 25 && <div className="mt-2 flex gap-2"><Button variant="outline" disabled={paymentPage <= 1} onClick={() => setPaymentPage(paymentPage - 1)}>Anterior</Button><Button variant="outline" disabled={paymentPage * 25 >= detailQuery.data.paymentTotal} onClick={() => setPaymentPage(paymentPage + 1)}>Siguiente</Button></div>}</div>
              </>}
            </div>}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-5 py-3">
            <Button variant="outline" disabled={saveMutation.isPending} onClick={() => mode === "list" ? close(false) : setMode(mode === "form" && selectedId ? "detail" : "list")}>{mode === "list" ? "Cerrar" : "Volver"}</Button>
            {mode === "form" && <Button disabled={saveMutation.isPending || !preview} onClick={save}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{formPurpose === "edit" ? "Guardar cambios" : formPurpose === "draft" ? "Guardar borrador" : "Registrar documento"}</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
