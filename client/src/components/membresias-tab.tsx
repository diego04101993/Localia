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
  isActive: boolean;
  createdAt: string;
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

  const [name, setName] = useState(editPlan?.name || "");
  const [description, setDescription] = useState(editPlan?.description || "");
  const [priceStr, setPriceStr] = useState(editPlan ? (editPlan.price / 100).toString() : "");
  const [durationStr, setDurationStr] = useState(editPlan?.durationDays?.toString() || "");
  const [classLimitStr, setClassLimitStr] = useState(editPlan?.classLimit?.toString() || "");
  const [unlimitedClasses, setUnlimitedClasses] = useState(editPlan ? !editPlan.classLimit : false);
  const [noExpiry, setNoExpiry] = useState(editPlan ? !editPlan.durationDays : false);

  const priceValue = parseFloat(priceStr || "0");
  const daysValue = parseInt(durationStr || "0");
  const classesValue = parseInt(classLimitStr || "0");

  const isValidPrice = !isNaN(priceValue) && priceValue > 0;
  const isValidDays = noExpiry || (daysValue >= 1 && daysValue <= 3650);
  const isValidClasses = unlimitedClasses || (classesValue >= 1 && classesValue <= 999);
  const isValidName = name.trim().length > 0 && name.length <= 60;
  const isValidDesc = description.length <= 200;
  const canSubmit = isValidName && isValidPrice && isValidDays && isValidClasses && isValidDesc;

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
    const durationDays = noExpiry ? null : daysValue;
    const classLimit = unlimitedClasses ? null : classesValue;

    mutation.mutate({ name: name.trim(), description: description.trim() || undefined, price, durationDays, classLimit });
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
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-duration">Vigencia</Label>
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="toggle-no-expiry"
                    checked={noExpiry}
                    onCheckedChange={(v) => { setNoExpiry(v); if (v) setDurationStr(""); }}
                    data-testid="toggle-no-expiry"
                  />
                  <Label htmlFor="toggle-no-expiry" className="text-[10px] text-muted-foreground cursor-pointer">Sin vencimiento</Label>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="plan-duration"
                  type="number"
                  min="1"
                  max="3650"
                  value={durationStr}
                  onChange={(e) => setDurationStr(e.target.value)}
                  placeholder="30"
                  disabled={noExpiry}
                  className="pr-12"
                  data-testid="input-plan-duration"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">días</span>
              </div>
              {!noExpiry && durationStr && !isValidDays && (
                <p className="text-[10px] text-red-500">Entre 1 y 3650 días</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-classes">Clases incluidas</Label>
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
            </div>
          </div>

          {canSubmit && (
            <div className="rounded-md bg-muted/50 p-3 text-sm" data-testid="plan-summary">
              <p className="font-medium mb-1">Resumen del plan</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Precio: <strong className="text-foreground">${priceValue.toFixed(2)} MXN</strong></span>
                <span>Vigencia: <strong className="text-foreground">{noExpiry ? "Sin vencimiento" : `${daysValue} días`}</strong></span>
                <span>Clases: <strong className="text-foreground">{unlimitedClasses ? "Ilimitadas" : `${classesValue} clases`}</strong></span>
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
                      {plan.durationDays ? `${plan.durationDays} días` : (
                        <span className="flex items-center gap-0.5">
                          <Infinity className="h-3 w-3" /> Sin vencimiento
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {plan.classLimit ? `${plan.classLimit} clases` : (
                        <span className="flex items-center gap-0.5">
                          <Infinity className="h-3 w-3" /> Ilimitadas
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!plan.classLimit && (
                      <Badge variant="secondary" className="text-[10px]" data-testid={`badge-unlimited-${plan.id}`}>Ilimitadas</Badge>
                    )}
                    {!plan.durationDays && (
                      <Badge variant="secondary" className="text-[10px]" data-testid={`badge-no-expiry-${plan.id}`}>Sin vencimiento</Badge>
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
                        <span>{plan.durationDays ? `${plan.durationDays} días` : "Sin vencimiento"}</span>
                        <span>{plan.classLimit ? `${plan.classLimit} clases` : "Ilimitadas"}</span>
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
