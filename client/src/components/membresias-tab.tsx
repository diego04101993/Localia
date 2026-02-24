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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    const price = Math.round(parseFloat(priceStr || "0") * 100);
    const durationDays = durationStr ? parseInt(durationStr) : null;
    const classLimit = classLimitStr ? parseInt(classLimitStr) : null;

    if (price < 0 || isNaN(price)) {
      toast({ title: "Error", description: "El precio debe ser un número válido", variant: "destructive" });
      return;
    }

    mutation.mutate({ name, description: description || undefined, price, durationDays, classLimit });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
              required
              data-testid="input-plan-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-description">Descripción</Label>
            <Textarea
              id="plan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del plan (opcional)"
              className="min-h-[60px]"
              data-testid="input-plan-description"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="plan-price">Precio (MXN) *</Label>
              <Input
                id="plan-price"
                type="number"
                step="0.01"
                min="0"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="999.00"
                required
                data-testid="input-plan-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-duration">Días</Label>
              <Input
                id="plan-duration"
                type="number"
                min="1"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="30"
                data-testid="input-plan-duration"
              />
              <p className="text-[10px] text-muted-foreground">Vacío = sin límite</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-classes">Clases</Label>
              <Input
                id="plan-classes"
                type="number"
                min="1"
                value={classLimitStr}
                onChange={(e) => setClassLimitStr(e.target.value)}
                placeholder="10"
                data-testid="input-plan-classes"
              />
              <p className="text-[10px] text-muted-foreground">Vacío = ilimitadas</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-plan">
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !name || !priceStr} data-testid="button-submit-plan">
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
                      {plan.durationDays ? `${plan.durationDays} días` : "Sin límite"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {plan.classLimit ? `${plan.classLimit} clases` : "Ilimitadas"}
                    </span>
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
                        <span>{plan.durationDays ? `${plan.durationDays} días` : "Sin límite"}</span>
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
        <PlanFormDialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)} editPlan={editingPlan} />
      )}
    </div>
  );
}
