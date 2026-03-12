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
import { useToast } from "@/hooks/use-toast";

interface MembershipPlan {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number | null;
  classLimit: number | null;
  cycleMonths: number;
  isActive: boolean;
  createdAt: string;
}

const CYCLE_OPTIONS = [
  { value: "0", label: "Pago por clase", months: 0 },
  { value: "1", label: "Mensual", months: 1 },
  { value: "3", label: "Trimestral", months: 3 },
  { value: "6", label: "Semestral", months: 6 },
  { value: "12", label: "Anual", months: 12 },
  { value: "custom", label: "Personalizado", months: -1 },
] as const;

function getCycleLabel(months: number): string {
  if (months === 0) return "Pago por clase";
  const preset = CYCLE_OPTIONS.find((o) => o.months === months && o.value !== "custom" && o.value !== "0");
  if (preset) return preset.label;
  if (months === 1) return "Mensual";
  return `${months} meses`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
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

  const isDropIn = cycleSelect === "0";

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
  const canSubmit = isValidName && isValidPrice && isValidClasses && isValidDesc && isValidCycle;

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
      toast({ title: isEdit ? "Plan actualizado" : "Plan creado" });
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
      durationDays,
      classLimit,
      cycleMonths,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plan" : "Crear plan"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los detalles del plan" : "Define un nuevo plan de membresía para tus clientes"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Nombre *</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mensual Ilimitado"
              maxLength={60}
              required
              data-testid="input-plan-name"
            />
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
              <Label htmlFor="plan-price">Precio total del ciclo *</Label>
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
              <Label>Ciclo</Label>
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

            {isDropIn ? (
              <div className="sm:col-span-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                <strong>Pago por clase:</strong> cada asignación de este plan otorga 1 clase con vigencia de 1 día. Sin ciclo mensual.
              </div>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="plan-classes">Clases incluidas en todo el ciclo</Label>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="toggle-unlimited"
                      checked={unlimitedClasses}
                      onCheckedChange={(v) => { setUnlimitedClasses(v); if (v) setClassLimitStr(""); }}
                      data-testid="toggle-unlimited-classes"
                    />
                    <Label htmlFor="toggle-unlimited" className="text-[10px] text-muted-foreground cursor-pointer">Ilimitadas</Label>
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">clases</span>
                </div>
                {!unlimitedClasses && classLimitStr && !isValidClasses && (
                  <p className="text-[10px] text-red-500">Entre 1 y 999 clases</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Total de clases que el cliente puede tomar durante todo el ciclo de {cycleMonths >= 1 ? getCycleLabel(cycleMonths).toLowerCase() : "—"}
                </p>
              </div>
            )}
          </div>

          {canSubmit && (
            <div className="rounded-md bg-muted/50 p-3 text-sm" data-testid="plan-summary">
              <p className="font-medium mb-1">Resumen del plan</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Precio: <strong className="text-foreground">${priceValue.toFixed(2)} MXN</strong></span>
                <span>Tipo: <strong className="text-foreground">{isDropIn ? "Pago por clase (1 día)" : getCycleLabel(cycleMonths)}</strong></span>
                {!isDropIn && (
                  <span>Clases por ciclo: <strong className="text-foreground">{unlimitedClasses ? "Ilimitadas" : `${classesValue}`}</strong></span>
                )}
                {!isDropIn && cycleMonths > 1 && (
                  <span>Precio mensual equiv.: <strong className="text-foreground">${(priceValue / cycleMonths).toFixed(2)} MXN</strong></span>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
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

export default function MembresiasTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

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
      toast({ title: "Plan desactivado" });
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
      toast({ title: "Plan reactivado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al reactivar plan", variant: "destructive" });
    },
  });

  const activePlans = (plans || []).filter((p) => p.isActive);
  const inactivePlans = (plans || []).filter((p) => !p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
              <h3 className="font-semibold text-lg mb-1">Sin planes</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Crea tu primer plan de membresía para poder asignarlo a tus clientes.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setShowCreateDialog(true)} data-testid="button-empty-create-plan">
                <Plus className="h-4 w-4 mr-1" />
                Crear plan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePlans.map((plan) => (
              <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h4>
                      <p className="text-xl font-bold text-primary mt-1" data-testid={`text-plan-price-${plan.id}`}>
                        {formatPrice(plan.price)}
                      </p>
                    </div>
                    <Badge variant="default" data-testid={`badge-plan-status-${plan.id}`}>Activo</Badge>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {getCycleLabel(plan.cycleMonths ?? 1)}
                    </span>
                    {(plan.cycleMonths ?? 1) !== 0 && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {plan.classLimit ? `${plan.classLimit} clases/ciclo` : (
                          <span className="flex items-center gap-0.5">
                            <Infinity className="h-3 w-3" /> Ilimitadas
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(plan.cycleMonths ?? 1) === 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid={`badge-dropin-${plan.id}`}>Pago por clase</Badge>
                    )}
                    {!plan.classLimit && (plan.cycleMonths ?? 1) !== 0 && (
                      <Badge variant="secondary" className="text-[10px]" data-testid={`badge-unlimited-${plan.id}`}>Ilimitadas</Badge>
                    )}
                    {(plan.cycleMonths ?? 1) > 1 && (
                      <Badge variant="secondary" className="text-[10px]" data-testid={`badge-cycle-${plan.id}`}>
                        {getCycleLabel(plan.cycleMonths)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPlan(plan)}
                      data-testid={`button-edit-plan-${plan.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
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
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Planes desactivados</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inactivePlans.map((plan) => (
                  <Card key={plan.id} className="opacity-60" data-testid={`card-plan-${plan.id}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h4>
                          <p className="text-lg font-bold mt-1">{formatPrice(plan.price)}</p>
                        </div>
                        <Badge variant="secondary" data-testid={`badge-plan-status-${plan.id}`}>Inactivo</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{getCycleLabel(plan.cycleMonths ?? 1)}</span>
                        <span>{plan.classLimit ? `${plan.classLimit} clases/ciclo` : "Ilimitadas"}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
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
    </div>
  );
}
