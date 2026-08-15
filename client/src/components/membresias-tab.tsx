import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  Hash,
  DollarSign,
  Package,
  Infinity,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateBranchMembershipQueries } from "@/lib/branch-dashboard-cache";
import { useToast } from "@/hooks/use-toast";
import {
  computeMembershipPlanChargeSnapshot,
  type MembershipPlanTaxMode,
  resolveMembershipPlanTaxConfig,
} from "@shared/membership-plan-tax";

interface MembershipPlan {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  price: number;
  taxMode: MembershipPlanTaxMode | null;
  taxRate: string | null;
  durationDays: number | null;
  classLimit: number | null;
  cycleMonths: number;
  isActive: boolean;
  createdAt: string;
}

type PlanTaxSelectValue = MembershipPlanTaxMode | "legacy";

const CYCLE_OPTIONS = [
  { value: "0", label: "Clase suelta / sesión única", months: 0 },
  { value: "1", label: "Mensual", months: 1 },
  { value: "3", label: "Trimestral", months: 3 },
  { value: "6", label: "Semestral", months: 6 },
  { value: "12", label: "Anual", months: 12 },
  { value: "custom", label: "Otro plazo (por meses)", months: -1 },
] as const;

const QUICK_CHARGE_PAYMENT_METHOD_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "otro", label: "Otro" },
] as const;

function getCycleLabel(months: number): string {
  if (months === 0) return "Clase suelta";
  const preset = CYCLE_OPTIONS.find((o) => o.months === months && o.value !== "custom" && o.value !== "0");
  if (preset) return preset.label;
  if (months === 1) return "Mensual";
  return `${months} meses`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

function getPlanTaxErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "La configuración fiscal del plan no es válida";
  switch (error.message) {
    case "TAX_RATE_REQUIRED":
      return "La tasa de IVA es obligatoria";
    case "TAX_RATE_MUST_BE_POSITIVE":
      return "La tasa de IVA debe ser mayor a 0";
    case "INVALID_TAX_RATE_RANGE":
      return "La tasa de IVA debe estar entre 0 y 100";
    case "TAX_RATE_NOT_ALLOWED_FOR_TAX_EXEMPT":
      return "Sin IVA no debe llevar una tasa distinta de 0";
    case "TAX_MODE_REQUIRED":
      return "Selecciona un tratamiento de IVA válido";
    default:
      return "La configuración fiscal del plan no es válida";
  }
}

function formatTaxRateLabel(taxRate: number | null) {
  if (taxRate == null || taxRate <= 0) return "0%";
  return `${taxRate.toFixed(2).replace(/\.00$/, "")}%`;
}

function getPlanChargeSnapshot(plan: Pick<MembershipPlan, "price" | "taxMode" | "taxRate">) {
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

function getPlanTaxDisplayLine(plan: Pick<MembershipPlan, "price" | "taxMode" | "taxRate">) {
  const snapshot = getPlanChargeSnapshot(plan);
  if (!snapshot || snapshot.isLegacy || !snapshot.taxMode) return null;

  if (snapshot.taxMode === "tax_added") {
    return `+ IVA ${formatTaxRateLabel(snapshot.taxRate)} · Total ${formatPrice(snapshot.finalTotalCents)}`;
  }

  if (snapshot.taxMode === "tax_included") {
    return `IVA incluido ${formatTaxRateLabel(snapshot.taxRate)}`;
  }

  return "Sin IVA";
}

function PlanFormDialog({
  open,
  onOpenChange,
  editPlan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editPlan?: MembershipPlan | null;
}) {
  const { toast } = useToast();
  const isEdit = !!editPlan;

  const editCycleMonths = editPlan?.cycleMonths ?? 1;
  const isPresetCycle = [0, 1, 3, 6, 12].includes(editCycleMonths);
  const initialCycleSelect = isPresetCycle ? String(editCycleMonths) : "custom";

  const [name, setName] = useState(editPlan?.name || "");
  const [description, setDescription] = useState(editPlan?.description || "");
  const [priceStr, setPriceStr] = useState(editPlan ? (editPlan.price / 100).toString() : "");
  const [classLimitStr, setClassLimitStr] = useState(editPlan?.classLimit?.toString() || "");
  const [unlimitedClasses, setUnlimitedClasses] = useState(editPlan ? !editPlan.classLimit : false);
  const [cycleSelect, setCycleSelect] = useState(initialCycleSelect);
  const [customMonthsStr, setCustomMonthsStr] = useState(
    !isPresetCycle && editCycleMonths > 0 ? String(editCycleMonths) : ""
  );
  const [taxModeSelection, setTaxModeSelection] = useState<PlanTaxSelectValue>(() => {
    if (editPlan?.taxMode) return editPlan.taxMode;
    return isEdit ? "legacy" : "tax_exempt";
  });
  const [taxRateStr, setTaxRateStr] = useState(() => {
    if (editPlan?.taxMode && editPlan.taxRate != null) {
      const parsed = Number.parseFloat(editPlan.taxRate);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed.toFixed(2).replace(/\.00$/, "");
      }
    }
    return "16";
  });

  const isDropIn = cycleSelect === "0";
  const isLegacyTaxConfig = taxModeSelection === "legacy";
  const activeTaxMode = isLegacyTaxConfig ? null : taxModeSelection;

  const cycleMonths =
    cycleSelect === "custom"
      ? parseInt(customMonthsStr || "1")
      : parseInt(cycleSelect || "1");

  const priceValue = parseFloat(priceStr || "0");
  const classesValue = parseInt(classLimitStr || "0");

  const isValidPrice = !isNaN(priceValue) && priceValue > 0;
  const isValidClasses = isDropIn || unlimitedClasses || (classesValue >= 1 && classesValue <= 999);
  const isValidName = name.trim().length > 0 && name.length <= 60;
  const isValidDesc = description.length <= 200;
  const isValidCycle = isDropIn || (cycleMonths >= 1 && cycleMonths <= 36);
  let resolvedTaxConfig: ReturnType<typeof resolveMembershipPlanTaxConfig> | null = null;
  let taxConfigError: string | null = null;

  try {
    resolvedTaxConfig = resolveMembershipPlanTaxConfig({
      taxMode: activeTaxMode,
      taxRate: activeTaxMode === "tax_exempt" ? 0 : taxRateStr,
    });
  } catch (error) {
    taxConfigError = getPlanTaxErrorMessage(error);
  }

  const previewPriceCents = Math.max(0, Math.round((Number.isFinite(priceValue) ? priceValue : 0) * 100));
  const taxPreview = resolvedTaxConfig
    ? computeMembershipPlanChargeSnapshot({
        priceCents: previewPriceCents,
        taxMode: resolvedTaxConfig.taxMode,
        taxRate: resolvedTaxConfig.taxRate,
      })
    : null;

  const canSubmit = isValidName && isValidPrice && isValidClasses && isValidDesc && isValidCycle && !taxConfigError;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const resp = await apiRequest("PATCH", `/api/branch/plans/${editPlan!.id}`, data);
        return resp.json();
      } else {
        const resp = await apiRequest("POST", "/api/branch/plans", data);
        return resp.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/plans"] });
      toast({ title: isEdit ? "Servicio o plan actualizado" : "Servicio o plan creado" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al guardar plan", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const price = Math.round(priceValue * 100);
    const durationDays = isDropIn ? 1 : cycleMonths * 30;
    const classLimit = isDropIn ? 1 : unlimitedClasses ? null : classesValue;

    mutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      price,
      taxMode: resolvedTaxConfig?.taxMode ?? null,
      taxRate: resolvedTaxConfig?.taxRate ?? null,
      durationDays,
      classLimit,
      cycleMonths,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-md:overflow-y-auto max-md:px-4 max-md:pb-[calc(env(safe-area-inset-bottom)+1rem)] max-md:pt-[calc(env(safe-area-inset-top)+1rem)]">
        <DialogHeader className="pr-10">
          <DialogTitle>{isEdit ? "Editar servicio o plan" : "Crear servicio o plan"}</DialogTitle>
          <DialogDescription className="hidden">
            {isEdit ? "Modifica los detalles del plan" : "Define un nuevo plan de membresía para tus clientes"}
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Actualiza cómo lo vendes sin cambiar la lógica actual de tus clientes."
              : "Crea una clase suelta, paquete o plan con el nombre que entiende tu cliente."}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Nombre comercial *</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Masaje 60 min, Consulta inicial, Mensual ilimitado"
              maxLength={60}
              required
              data-testid="input-plan-name"
            />
            <p className="text-[10px] text-muted-foreground">
              Usa el nombre tal como lo reconoce tu cliente o tu equipo.
            </p>
            <p className="text-[10px] text-muted-foreground text-right">{name.length}/60</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-description">Descripción</Label>
            <Textarea
              id="plan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del plan (opcional)"
              className="min-h-[50px]"
              maxLength={200}
              data-testid="input-plan-description"
            />
            <p className="text-[10px] text-muted-foreground text-right">{description.length}/200</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-price">Precio *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">MXN $</span>
                <Input
                  id="plan-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="999.00"
                  className="pl-14"
                  required
                  data-testid="input-plan-price"
                />
              </div>
              {priceStr && !isValidPrice && (
                <p className="text-[10px] text-red-500">El precio debe ser mayor a 0</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Cómo se cobra</Label>
              <Select
                value={cycleSelect}
                onValueChange={(val) => {
                  setCycleSelect(val);
                  if (val !== "custom") setCustomMonthsStr("");
                }}
              >
                <SelectTrigger data-testid="select-cycle">
                  <SelectValue placeholder="Selecciona ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {CYCLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} data-testid={`option-cycle-${opt.value}`}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cycleSelect === "custom" && (
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    max="36"
                    value={customMonthsStr}
                    onChange={(e) => setCustomMonthsStr(e.target.value)}
                    placeholder="Número de meses"
                    className="pr-16"
                    data-testid="input-custom-months"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">meses</span>
                </div>
              )}
              {cycleSelect === "custom" && customMonthsStr && !isValidCycle && (
                <p className="text-[10px] text-red-500">Entre 1 y 36 meses</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Tratamiento de IVA</Label>
              <Select value={taxModeSelection} onValueChange={(value) => setTaxModeSelection(value as PlanTaxSelectValue)}>
                <SelectTrigger data-testid="select-plan-tax-mode">
                  <SelectValue placeholder="Selecciona un tratamiento de IVA" />
                </SelectTrigger>
                <SelectContent>
                  {isEdit && editPlan?.taxMode == null ? (
                    <SelectItem value="legacy">Sin configuración fiscal (actual)</SelectItem>
                  ) : null}
                  <SelectItem value="tax_exempt">Sin IVA</SelectItem>
                  <SelectItem value="tax_included">IVA incluido en el precio</SelectItem>
                  <SelectItem value="tax_added">Agregar IVA al precio</SelectItem>
                </SelectContent>
              </Select>
              {isLegacyTaxConfig ? (
                <p className="text-[10px] text-muted-foreground">
                  Este plan seguirá cobrando exactamente como hoy hasta que elijas un tratamiento fiscal.
                </p>
              ) : null}
              {!isLegacyTaxConfig && activeTaxMode !== "tax_exempt" ? (
                <div className="space-y-2">
                  <Label htmlFor="plan-tax-rate">Tasa de IVA</Label>
                  <div className="relative max-w-xs">
                    <Input
                      id="plan-tax-rate"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      value={taxRateStr}
                      onChange={(e) => setTaxRateStr(e.target.value)}
                      placeholder="16"
                      className="pr-12"
                      data-testid="input-plan-tax-rate"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              ) : null}
              {taxConfigError ? (
                <p className="text-[10px] text-red-500">{taxConfigError}</p>
              ) : null}
            </div>

            {isDropIn ? (
              <div className="sm:col-span-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                <strong>Pago por clase:</strong> cada asignación de este plan otorga 1 clase con vigencia de 1 día. Sin ciclo mensual.
              </div>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="plan-classes">Usos incluidos durante la vigencia</Label>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="toggle-unlimited"
                      checked={unlimitedClasses}
                      onCheckedChange={(v) => { setUnlimitedClasses(v); if (v) setClassLimitStr(""); }}
                      data-testid="toggle-unlimited-classes"
                    />
                    <Label htmlFor="toggle-unlimited" className="text-[10px] text-muted-foreground cursor-pointer">Ilimitado</Label>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    id="plan-classes"
                    type="number"
                    min="1"
                    max="999"
                    value={classLimitStr}
                    onChange={(e) => setClassLimitStr(e.target.value)}
                    placeholder="12"
                    disabled={unlimitedClasses}
                    className="pr-16"
                    data-testid="input-plan-classes"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">usos</span>
                </div>
                {!unlimitedClasses && classLimitStr && !isValidClasses && (
                  <p className="text-[10px] text-red-500">Entre 1 y 999 usos</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Total de clases que el cliente puede tomar durante todo el ciclo de {cycleMonths >= 1 ? getCycleLabel(cycleMonths).toLowerCase() : "—"}
                </p>
              </div>
            )}
          </div>

          {canSubmit && (
            <div className="rounded-md bg-muted/50 p-3 text-sm" data-testid="plan-summary">
              <p className="font-medium mb-1">Resumen de venta</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Precio: <strong className="text-foreground">${priceValue.toFixed(2)} MXN</strong></span>
                <span>Tipo: <strong className="text-foreground">{isDropIn ? "Pago por clase (1 día)" : getCycleLabel(cycleMonths)}</strong></span>
                {!isDropIn && (
                  <span>Usos incluidos: <strong className="text-foreground">{unlimitedClasses ? "Ilimitado" : `${classesValue}`}</strong></span>
                )}
                {!isDropIn && cycleMonths > 1 && (
                  <span>Equivalente mensual: <strong className="text-foreground">${(priceValue / cycleMonths).toFixed(2)} MXN</strong></span>
                )}
              </div>
              {taxPreview && !taxPreview.isLegacy ? (
                <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {taxPreview.taxMode === "tax_included" ? (
                    <>
                      <span>Precio final: <strong className="text-foreground">{formatPrice(taxPreview.finalTotalCents)}</strong></span>
                      <span>Subtotal: <strong className="text-foreground">{formatPrice(taxPreview.subtotalBeforeTaxCents ?? 0)}</strong></span>
                      <span>IVA incluido {formatTaxRateLabel(taxPreview.taxRate)}: <strong className="text-foreground">{formatPrice(taxPreview.taxTotalCents ?? 0)}</strong></span>
                      <span>Total al cobrar: <strong className="text-foreground">{formatPrice(taxPreview.finalTotalCents)}</strong></span>
                    </>
                  ) : taxPreview.taxMode === "tax_added" ? (
                    <>
                      <span>Precio base: <strong className="text-foreground">{formatPrice(taxPreview.basePriceCents)}</strong></span>
                      <span>IVA {formatTaxRateLabel(taxPreview.taxRate)}: <strong className="text-foreground">{formatPrice(taxPreview.taxTotalCents ?? 0)}</strong></span>
                      <span>Total al cobrar: <strong className="text-foreground">{formatPrice(taxPreview.finalTotalCents)}</strong></span>
                    </>
                  ) : (
                    <span>Sin IVA: <strong className="text-foreground">{formatPrice(taxPreview.finalTotalCents)}</strong></span>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 border-t pt-4 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-4 max-md:bg-background/95 max-md:px-4 max-md:pb-[calc(env(safe-area-inset-bottom)+0.5rem)] max-md:backdrop-blur">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-plan">
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !canSubmit} data-testid="button-submit-plan">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickChargeDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: MembershipPlan | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof QUICK_CHARGE_PAYMENT_METHOD_OPTIONS)[number]["value"]>("efectivo");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const resetForm = () => {
    setCustomerName("");
    setWhatsapp("");
    setPaymentMethod("efectivo");
    setNote("");
    setRequestId(crypto.randomUUID());
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!plan) throw new Error("No hay servicio seleccionado");
      const response = await apiRequest("POST", `/api/branch/plans/${plan.id}/quick-charge`, {
        customerName: customerName.trim(),
        whatsapp: whatsapp.trim() || null,
        paymentMethod,
        note: note.trim() || null,
        entryDate: new Date().toLocaleDateString("en-CA"),
        requestId,
      });
      return response.json();
    },
    onSuccess: async (data: any) => {
      await invalidateBranchMembershipQueries(data?.client?.userId ?? null);
      toast({
        title: data?.duplicate
          ? "Cobro ya registrado"
          : data?.client?.action === "created"
            ? "Cobro registrado y cliente creado"
            : "Cobro registrado",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar el cobro rápido",
        variant: "destructive",
      });
    },
  });

  const chargeSnapshot = plan ? getPlanChargeSnapshot(plan) : null;
  const chargeTotalCents = chargeSnapshot?.finalTotalCents ?? plan?.price ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg max-md:overflow-y-auto max-md:px-4 max-md:pb-[calc(env(safe-area-inset-bottom)+1rem)] max-md:pt-[calc(env(safe-area-inset-top)+1rem)]">
        <DialogHeader className="pr-10">
          <DialogTitle>Cobrar servicio individual</DialogTitle>
          <DialogDescription className="hidden">
            Registra un cobro rápido sin crear ni renovar una membresía.
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            Esta venta registra ingreso en Caja y la guarda en el historial del cliente sin tocar membresías.
          </p>
        </DialogHeader>

        {plan && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Servicio</p>
                  <h4 className="mt-1 text-base font-semibold">{plan.name}</h4>
                </div>
                <Badge variant="secondary">Clase suelta / sesión única</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {chargeSnapshot && !chargeSnapshot.isLegacy && chargeSnapshot.taxMode === "tax_added"
                      ? "Total a cobrar"
                      : chargeSnapshot && !chargeSnapshot.isLegacy && chargeSnapshot.taxMode === "tax_included"
                        ? "Precio final"
                        : "Precio"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">{formatPrice(chargeTotalCents)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fecha</p>
                  <p className="mt-1 text-sm font-medium">
                    {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              {chargeSnapshot ? (
                chargeSnapshot.isLegacy ? (
                  <div className="mt-3 rounded-xl border border-dashed border-muted-foreground/30 bg-background/80 p-3 text-xs text-muted-foreground">
                    Sin configuraciÃ³n fiscal: este cobro rÃ¡pido usarÃ¡ exactamente el precio actual del plan.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 rounded-xl border bg-background/80 p-3 text-xs text-muted-foreground sm:grid-cols-2">
                    {chargeSnapshot.taxMode === "tax_added" ? (
                      <>
                        <span>Precio base: <strong className="text-foreground">{formatPrice(chargeSnapshot.basePriceCents)}</strong></span>
                        <span>IVA {formatTaxRateLabel(chargeSnapshot.taxRate)}: <strong className="text-foreground">{formatPrice(chargeSnapshot.taxTotalCents ?? 0)}</strong></span>
                        <span className="sm:col-span-2">Total a cobrar: <strong className="text-foreground">{formatPrice(chargeSnapshot.finalTotalCents)}</strong></span>
                      </>
                    ) : chargeSnapshot.taxMode === "tax_included" ? (
                      <>
                        <span>Precio final: <strong className="text-foreground">{formatPrice(chargeSnapshot.finalTotalCents)}</strong></span>
                        <span>Subtotal: <strong className="text-foreground">{formatPrice(chargeSnapshot.subtotalBeforeTaxCents ?? 0)}</strong></span>
                        <span className="sm:col-span-2">IVA incluido {formatTaxRateLabel(chargeSnapshot.taxRate)}: <strong className="text-foreground">{formatPrice(chargeSnapshot.taxTotalCents ?? 0)}</strong></span>
                      </>
                    ) : (
                      <span className="sm:col-span-2">Sin IVA: <strong className="text-foreground">{formatPrice(chargeSnapshot.finalTotalCents)}</strong></span>
                    )}
                  </div>
                )
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-charge-customer-name">Nombre del cliente *</Label>
              <Input
                id="quick-charge-customer-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Ej. María López"
                data-testid="input-quick-charge-customer-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-charge-whatsapp">WhatsApp</Label>
              <Input
                id="quick-charge-whatsapp"
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                placeholder="55 1234 5678"
                data-testid="input-quick-charge-whatsapp"
              />
              <p className="text-xs text-muted-foreground">
                Si el número ya existe en esta sucursal, reutilizaremos ese cliente. Nunca se une solo por nombre.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as (typeof QUICK_CHARGE_PAYMENT_METHOD_OPTIONS)[number]["value"])}
              >
                <SelectTrigger data-testid="select-quick-charge-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUICK_CHARGE_PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-charge-note">Nota</Label>
              <Textarea
                id="quick-charge-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Opcional: referencia de la venta o comentario breve"
                className="min-h-[72px]"
                data-testid="input-quick-charge-note"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t pt-4 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-4 max-md:bg-background/95 max-md:px-4 max-md:pb-[calc(env(safe-area-inset-bottom)+0.5rem)] max-md:backdrop-blur">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-quick-charge">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !customerName.trim() || !plan}
            data-testid="button-submit-quick-charge"
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Cobrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MembresiasTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [quickChargePlan, setQuickChargePlan] = useState<MembershipPlan | null>(null);

  const { data: plans, isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/branch/plans"],
  });

  const deactivateMutation = useMutation({
    mutationFn: async (planId: string) => {
      const resp = await apiRequest("DELETE", `/api/branch/plans/${planId}`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/plans"] });
      toast({ title: "Servicio o plan desactivado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al desactivar plan", variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (planId: string) => {
      const resp = await apiRequest("PATCH", `/api/branch/plans/${planId}`, { isActive: true });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/plans"] });
      toast({ title: "Servicio o plan reactivado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al reactivar plan", variant: "destructive" });
    },
  });

  const activePlans = (plans || []).filter((p) => p.isActive);
  const inactivePlans = (plans || []).filter((p) => !p.isActive);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-2xl border bg-card/70 p-4 shadow-sm md:rounded-3xl md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">Lo que vendes</Badge>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold" data-testid="text-offerings-title">Lo que vendes</h3>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Crea desde una clase suelta o consulta hasta un paquete o plan mensual. Usa el nombre que entiende tu cliente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Clase suelta</Badge>
              <Badge variant="outline">Paquete de sesiones</Badge>
              <Badge variant="outline">Plan mensual</Badge>
              <Badge variant="outline">Anualidad</Badge>
              <Badge variant="secondary">Próximamente: promoción</Badge>
            </div>
          </div>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowCreateDialog(true)} data-testid="button-create-offering">
            <Plus className="h-4 w-4 mr-1" />
            Crear servicio o plan
          </Button>
        </div>
      </div>

      <div className="hidden">
        <div>
          <h3 className="font-semibold text-lg" data-testid="text-plans-title">Planes de membresía</h3>
          <p className="text-sm text-muted-foreground">Crea paquetes y asígnalos a tus clientes desde su perfil</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-create-plan">
          <Plus className="h-4 w-4 mr-1" />
          Crear plan
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activePlans.length === 0 && inactivePlans.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="text-center py-12" data-testid="empty-plans">
              <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">Aún no has creado lo que vendes</h3>
              <p className="hidden text-sm text-muted-foreground max-w-md mx-auto">
                Crea tu primer plan de membresía para poder asignarlo a tus clientes.
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Empieza con una clase suelta, un paquete o un plan mensual. Después podrás asignarlo a tus clientes desde su perfil.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setShowCreateDialog(true)} data-testid="button-empty-create-plan">
                <Plus className="h-4 w-4 mr-1" />
                Crear servicio o plan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePlans.map((plan) => (
              <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                <CardContent className="min-w-0 p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="break-words font-semibold" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h4>
                      <p className="text-xl font-bold text-primary mt-1" data-testid={`text-plan-price-${plan.id}`}>
                        {formatPrice(plan.price)}
                      </p>
                      {getPlanTaxDisplayLine(plan) ? (
                        <p className="mt-1 text-xs text-muted-foreground">{getPlanTaxDisplayLine(plan)}</p>
                      ) : null}
                    </div>
                    <Badge variant="default" data-testid={`badge-plan-status-${plan.id}`}>Disponible</Badge>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {getCycleLabel(plan.cycleMonths ?? 1)}
                    </span>
                    {(plan.cycleMonths ?? 1) !== 0 && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {plan.classLimit ? `${plan.classLimit} usos incluidos` : (
                          <span className="flex items-center gap-0.5">
                            <Infinity className="h-3 w-3" /> Ilimitado
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(plan.cycleMonths ?? 1) === 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid={`badge-dropin-${plan.id}`}>Clase suelta</Badge>
                    )}
                    {!plan.classLimit && (plan.cycleMonths ?? 1) !== 0 && (
                      <Badge variant="secondary" className="text-[10px]" data-testid={`badge-unlimited-${plan.id}`}>Ilimitado</Badge>
                    )}
                    {(plan.cycleMonths ?? 1) > 1 && (
                      <Badge variant="secondary" className="text-[10px]" data-testid={`badge-cycle-${plan.id}`}>
                        {getCycleLabel(plan.cycleMonths)}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:flex-wrap sm:items-center">
                    {(plan.cycleMonths ?? 1) === 0 && plan.isActive && (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setQuickChargePlan(plan)}
                        data-testid={`button-quick-charge-plan-${plan.id}`}
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1" />
                        Cobrar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setEditingPlan(plan)}
                      data-testid={`button-edit-plan-${plan.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${(plan.cycleMonths ?? 1) === 0 ? "col-span-2" : ""} w-full sm:w-auto`}
                      onClick={() => deactivateMutation.mutate(plan.id)}
                      disabled={deactivateMutation.isPending}
                      data-testid={`button-deactivate-plan-${plan.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Desactivar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {inactivePlans.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Desactivados</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inactivePlans.map((plan) => (
                  <Card key={plan.id} className="opacity-60" data-testid={`card-plan-${plan.id}`}>
                    <CardContent className="min-w-0 p-4 space-y-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="break-words font-semibold" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h4>
                          <p className="text-lg font-bold mt-1">{formatPrice(plan.price)}</p>
                          {getPlanTaxDisplayLine(plan) ? (
                            <p className="mt-1 text-xs text-muted-foreground">{getPlanTaxDisplayLine(plan)}</p>
                          ) : null}
                        </div>
                        <Badge variant="secondary" data-testid={`badge-plan-status-${plan.id}`}>Desactivado</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{getCycleLabel(plan.cycleMonths ?? 1)}</span>
                        <span>{plan.classLimit ? `${plan.classLimit} usos incluidos` : "Ilimitado"}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => reactivateMutation.mutate(plan.id)}
                        disabled={reactivateMutation.isPending}
                        data-testid={`button-reactivate-plan-${plan.id}`}
                      >
                        Reactivar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showCreateDialog && (
        <PlanFormDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      )}
      {editingPlan && (
        <PlanFormDialog key={editingPlan.id} open={!!editingPlan} onOpenChange={() => setEditingPlan(null)} editPlan={editingPlan} />
      )}
      <QuickChargeDialog plan={quickChargePlan} open={!!quickChargePlan} onOpenChange={(open) => !open && setQuickChargePlan(null)} />
    </div>
  );
}
