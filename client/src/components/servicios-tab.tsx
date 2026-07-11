import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type ServiceVisibility = "public" | "internal";
type SaleOptionType = "individual" | "prueba" | "paquete" | "membresia" | "day_pass" | "gift_card" | "especial";

type BranchServiceSaleOption = {
  id: string;
  branchId: string;
  serviceId: string;
  name: string;
  type: SaleOptionType;
  price: number;
  includedUses: number | null;
  isUnlimited: boolean;
  validityDays: number | null;
  requiresRegisteredClient: boolean;
  allowsWalkIn: boolean;
  isPosFavorite: boolean;
  isActive: boolean;
  internalNotes: string | null;
  displayOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type BranchService = {
  id: string;
  branchId: string;
  name: string;
  category: string;
  description: string | null;
  baseDurationMinutes: number | null;
  capacity: number | null;
  requiresAgenda: boolean;
  visibility: ServiceVisibility;
  isActive: boolean;
  displayOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  options: BranchServiceSaleOption[];
};

type ServiceFormState = {
  name: string;
  category: string;
  description: string;
  baseDurationMinutes: string;
  capacity: string;
  requiresAgenda: boolean;
  visibility: ServiceVisibility;
  isActive: boolean;
  displayOrder: string;
};

type SaleOptionFormState = {
  name: string;
  type: SaleOptionType;
  price: string;
  includedUses: string;
  isUnlimited: boolean;
  validityDays: string;
  requiresRegisteredClient: boolean;
  allowsWalkIn: boolean;
  isPosFavorite: boolean;
  isActive: boolean;
  internalNotes: string;
  displayOrder: string;
};

const SALE_OPTION_LABELS: Record<SaleOptionType, string> = {
  individual: "Individual",
  prueba: "Prueba",
  paquete: "Paquete",
  membresia: "Membresia",
  day_pass: "Day Pass",
  gift_card: "Gift Card",
  especial: "Especial",
};

function createInitialServiceFormState(): ServiceFormState {
  return {
    name: "",
    category: "",
    description: "",
    baseDurationMinutes: "",
    capacity: "",
    requiresAgenda: false,
    visibility: "public",
    isActive: true,
    displayOrder: "",
  };
}

function createInitialSaleOptionFormState(): SaleOptionFormState {
  return {
    name: "",
    type: "individual",
    price: "",
    includedUses: "1",
    isUnlimited: false,
    validityDays: "",
    requiresRegisteredClient: false,
    allowsWalkIn: true,
    isPosFavorite: false,
    isActive: true,
    internalNotes: "",
    displayOrder: "",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export default function ServiciosTab() {
  const { toast } = useToast();
  const { data: services = [], isLoading } = useQuery<BranchService[]>({
    queryKey: ["/api/branch/services"],
  });

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<BranchService | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(createInitialServiceFormState());
  const [saleOptionDialogOpen, setSaleOptionDialogOpen] = useState(false);
  const [editingSaleOption, setEditingSaleOption] = useState<BranchServiceSaleOption | null>(null);
  const [saleOptionForm, setSaleOptionForm] = useState<SaleOptionFormState>(createInitialSaleOptionFormState());
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "service"; id: string; label: string } | { kind: "option"; id: string; label: string } | null
  >(null);

  useEffect(() => {
    if (!services.length) {
      setSelectedServiceId(null);
      return;
    }

    if (!selectedServiceId || !services.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const invalidateServices = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/branch/services"] });
  };

  const createServiceMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await apiRequest("POST", "/api/branch/services", payload);
      return response.json();
    },
    onSuccess: async (created: BranchService) => {
      await invalidateServices();
      setSelectedServiceId(created.id);
      setServiceDialogOpen(false);
      setEditingService(null);
      setServiceForm(createInitialServiceFormState());
      toast({ title: "Servicio creado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo crear el servicio", variant: "destructive" });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/branch/services/${id}`, payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateServices();
      setServiceDialogOpen(false);
      setEditingService(null);
      setServiceForm(createInitialServiceFormState());
      toast({ title: "Servicio actualizado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el servicio", variant: "destructive" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      await apiRequest("DELETE", `/api/branch/services/${serviceId}`);
    },
    onSuccess: async () => {
      await invalidateServices();
      setDeleteTarget(null);
      toast({ title: "Servicio eliminado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo eliminar el servicio", variant: "destructive" });
    },
  });

  const createSaleOptionMutation = useMutation({
    mutationFn: async ({ serviceId, payload }: { serviceId: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/branch/services/${serviceId}/options`, payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateServices();
      setSaleOptionDialogOpen(false);
      setEditingSaleOption(null);
      setSaleOptionForm(createInitialSaleOptionFormState());
      toast({ title: "Opcion de venta creada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo crear la opcion de venta", variant: "destructive" });
    },
  });

  const updateSaleOptionMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/branch/service-options/${id}`, payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateServices();
      setSaleOptionDialogOpen(false);
      setEditingSaleOption(null);
      setSaleOptionForm(createInitialSaleOptionFormState());
      toast({ title: "Opcion de venta actualizada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar la opcion de venta", variant: "destructive" });
    },
  });

  const deleteSaleOptionMutation = useMutation({
    mutationFn: async (optionId: string) => {
      await apiRequest("DELETE", `/api/branch/service-options/${optionId}`);
    },
    onSuccess: async () => {
      await invalidateServices();
      setDeleteTarget(null);
      toast({ title: "Opcion de venta eliminada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo eliminar la opcion de venta", variant: "destructive" });
    },
  });

  function openCreateService() {
    setEditingService(null);
    setServiceForm(createInitialServiceFormState());
    setServiceDialogOpen(true);
  }

  function openEditService(service: BranchService) {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      category: service.category,
      description: service.description || "",
      baseDurationMinutes: service.baseDurationMinutes ? String(service.baseDurationMinutes) : "",
      capacity: service.capacity ? String(service.capacity) : "",
      requiresAgenda: service.requiresAgenda,
      visibility: service.visibility,
      isActive: service.isActive,
      displayOrder: String(service.displayOrder),
    });
    setServiceDialogOpen(true);
  }

  function openCreateSaleOption() {
    if (!selectedService) return;
    setEditingSaleOption(null);
    setSaleOptionForm({
      ...createInitialSaleOptionFormState(),
      displayOrder: String(selectedService.options.length),
    });
    setSaleOptionDialogOpen(true);
  }

  function openEditSaleOption(option: BranchServiceSaleOption) {
    setEditingSaleOption(option);
    setSaleOptionForm({
      name: option.name,
      type: option.type,
      price: option.price.toFixed(2),
      includedUses: option.includedUses ? String(option.includedUses) : "1",
      isUnlimited: option.isUnlimited,
      validityDays: option.validityDays ? String(option.validityDays) : "",
      requiresRegisteredClient: option.requiresRegisteredClient,
      allowsWalkIn: option.allowsWalkIn,
      isPosFavorite: option.isPosFavorite,
      isActive: option.isActive,
      internalNotes: option.internalNotes || "",
      displayOrder: String(option.displayOrder),
    });
    setSaleOptionDialogOpen(true);
  }

  function handleSubmitService() {
    const payload: Record<string, unknown> = {
      name: serviceForm.name.trim(),
      category: serviceForm.category.trim(),
      description: serviceForm.description.trim() || null,
      baseDurationMinutes: serviceForm.baseDurationMinutes ? Number(serviceForm.baseDurationMinutes) : null,
      capacity: serviceForm.capacity ? Number(serviceForm.capacity) : null,
      requiresAgenda: serviceForm.requiresAgenda,
      visibility: serviceForm.visibility,
      isActive: serviceForm.isActive,
      displayOrder: serviceForm.displayOrder ? Number(serviceForm.displayOrder) : 0,
    };

    if (editingService) {
      updateServiceMutation.mutate({ id: editingService.id, payload });
      return;
    }

    createServiceMutation.mutate(payload);
  }

  function handleSubmitSaleOption() {
    if (!selectedService) return;

    const normalizedType = saleOptionForm.type;
    const requiresRegisteredClient = normalizedType === "membresia" ? true : saleOptionForm.requiresRegisteredClient;
    const allowsWalkIn = normalizedType === "membresia" ? false : saleOptionForm.allowsWalkIn;

    const payload: Record<string, unknown> = {
      name: saleOptionForm.name.trim(),
      type: normalizedType,
      price: Number(saleOptionForm.price),
      includedUses: saleOptionForm.isUnlimited ? null : (saleOptionForm.includedUses ? Number(saleOptionForm.includedUses) : null),
      isUnlimited: saleOptionForm.isUnlimited,
      validityDays: saleOptionForm.validityDays ? Number(saleOptionForm.validityDays) : null,
      requiresRegisteredClient,
      allowsWalkIn,
      isPosFavorite: saleOptionForm.isPosFavorite,
      isActive: saleOptionForm.isActive,
      internalNotes: saleOptionForm.internalNotes.trim() || null,
      displayOrder: saleOptionForm.displayOrder ? Number(saleOptionForm.displayOrder) : 0,
    };

    if (editingSaleOption) {
      updateSaleOptionMutation.mutate({ id: editingSaleOption.id, payload });
      return;
    }

    createSaleOptionMutation.mutate({ serviceId: selectedService.id, payload });
  }

  const activeOptionCount = selectedService?.options.filter((option) => option.isActive).length || 0;
  const favoriteOptionCount = selectedService?.options.filter((option) => option.isPosFavorite).length || 0;

  return (
    <div className="space-y-5">
      <Card className="border-border/70">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Servicios
            </CardTitle>
            <CardDescription>
              Define lo que hace tu negocio y crea las opciones de venta sin tocar todavia Cobrar, Agenda o Caja.
            </CardDescription>
          </div>
          <Button onClick={openCreateService} data-testid="button-create-branch-service">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo servicio
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Catalogo base</CardTitle>
                <CardDescription>{services.length} servicio{services.length === 1 ? "" : "s"} configurados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : services.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium">Aun no tienes servicios</p>
                <p className="mt-1 text-sm text-muted-foreground">Crea primero el servicio base y despues sus opciones de venta.</p>
                <Button className="mt-4" variant="outline" onClick={openCreateService}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primer servicio
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((service) => {
                  const isSelected = service.id === selectedServiceId;
                  return (
                    <div
                      key={service.id}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30"
                      }`}
                      onClick={() => setSelectedServiceId(service.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedServiceId(service.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      data-testid={`service-card-${service.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">{service.name}</h3>
                            <Badge variant="secondary" className="text-[11px]">{service.category}</Badge>
                            <Badge variant={service.isActive ? "outline" : "destructive"} className="text-[11px]">
                              {service.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              {service.visibility === "public" ? "Publico" : "Interno"}
                            </Badge>
                          </div>
                          {service.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                              <Ticket className="h-3 w-3" />
                              {service.options.length} opcion{service.options.length === 1 ? "" : "es"}
                            </span>
                            {service.requiresAgenda && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                                <CalendarClock className="h-3 w-3" />
                                Requiere agenda
                              </span>
                            )}
                            {service.baseDurationMinutes ? (
                              <span className="rounded-full bg-muted px-2.5 py-1">{service.baseDurationMinutes} min base</span>
                            ) : null}
                            {service.capacity ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                                <Users className="h-3 w-3" />
                                Capacidad {service.capacity}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              updateServiceMutation.mutate({
                                id: service.id,
                                payload: { isActive: !service.isActive },
                              });
                            }}
                            data-testid={`button-toggle-service-${service.id}`}
                          >
                            {service.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditService(service);
                            }}
                            data-testid={`button-edit-service-${service.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget({ kind: "service", id: service.id, label: service.name });
                            }}
                            data-testid={`button-delete-service-${service.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {selectedService ? `Opciones de venta · ${selectedService.name}` : "Opciones de venta"}
                </CardTitle>
                <CardDescription>
                  {selectedService
                    ? "Aqui defines como se comercializa el servicio."
                    : "Selecciona un servicio para administrar sus opciones."}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={openCreateSaleOption}
                disabled={!selectedService}
                data-testid="button-create-service-option"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva opcion
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedService ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium">Elige un servicio</p>
                <p className="mt-1 text-sm text-muted-foreground">Asi podras crear opciones como individual, paquete o membresia.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Opciones</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedService.options.length}</p>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Activas</p>
                    <p className="mt-2 text-2xl font-semibold">{activeOptionCount}</p>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Favoritas POS</p>
                    <p className="mt-2 text-2xl font-semibold">{favoriteOptionCount}</p>
                  </div>
                </div>

                {selectedService.options.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center">
                    <p className="text-sm font-medium">Todavia no hay opciones de venta</p>
                    <p className="mt-1 text-sm text-muted-foreground">Agrega una individual, prueba, paquete o membresia dentro de este servicio.</p>
                    <Button className="mt-4" variant="outline" onClick={openCreateSaleOption}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear opcion
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedService.options.map((option) => (
                      <div key={option.id} className="rounded-2xl border p-4" data-testid={`service-option-${option.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold">{option.name}</h4>
                              <Badge variant="secondary" className="text-[11px]">
                                {SALE_OPTION_LABELS[option.type]}
                              </Badge>
                              <Badge variant={option.isActive ? "outline" : "destructive"} className="text-[11px]">
                                {option.isActive ? "Activa" : "Inactiva"}
                              </Badge>
                              {option.isPosFavorite && (
                                <Badge className="text-[11px]">
                                  <BadgeCheck className="mr-1 h-3 w-3" />
                                  Favorita POS
                                </Badge>
                              )}
                            </div>
                            <p className="mt-2 text-base font-semibold">{formatCurrency(option.price)}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted px-2.5 py-1">
                                {option.isUnlimited ? "Usos ilimitados" : `${option.includedUses ?? 0} uso(s)`}
                              </span>
                              {option.validityDays ? (
                                <span className="rounded-full bg-muted px-2.5 py-1">Vigencia {option.validityDays} dias</span>
                              ) : null}
                              <span className="rounded-full bg-muted px-2.5 py-1">
                                {option.requiresRegisteredClient ? "Cliente registrado" : "Cliente opcional"}
                              </span>
                              <span className="rounded-full bg-muted px-2.5 py-1">
                                {option.allowsWalkIn ? "Permite mostrador" : "Sin mostrador"}
                              </span>
                            </div>
                            {option.internalNotes && (
                              <p className="mt-3 text-sm text-muted-foreground">{option.internalNotes}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                updateSaleOptionMutation.mutate({
                                  id: option.id,
                                  payload: { isActive: !option.isActive },
                                })
                              }
                              data-testid={`button-toggle-option-${option.id}`}
                            >
                              {option.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditSaleOption(option)}
                              data-testid={`button-edit-option-${option.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeleteTarget({ kind: "option", id: option.id, label: option.name })}
                              data-testid={`button-delete-option-${option.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
            <DialogDescription>
              Define el servicio base. Las opciones de venta se configuran despues dentro del servicio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={serviceForm.name}
                onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Pilates, Yoga, Masaje..."
                data-testid="input-service-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                value={serviceForm.category}
                onChange={(event) => setServiceForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="Bienestar, Salud, Estetica..."
                data-testid="input-service-category"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripcion</Label>
              <Textarea
                value={serviceForm.description}
                onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Que recibe el cliente en este servicio"
                rows={3}
                data-testid="input-service-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Duracion base (min)</Label>
              <Input
                type="number"
                min="1"
                value={serviceForm.baseDurationMinutes}
                onChange={(event) => setServiceForm((current) => ({ ...current, baseDurationMinutes: event.target.value }))}
                placeholder="60"
                data-testid="input-service-duration"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacidad</Label>
              <Input
                type="number"
                min="1"
                value={serviceForm.capacity}
                onChange={(event) => setServiceForm((current) => ({ ...current, capacity: event.target.value }))}
                placeholder="1, 8, 20..."
                data-testid="input-service-capacity"
              />
            </div>
            <div className="space-y-2">
              <Label>Visibilidad</Label>
              <Select
                value={serviceForm.visibility}
                onValueChange={(value: ServiceVisibility) => setServiceForm((current) => ({ ...current, visibility: value }))}
              >
                <SelectTrigger data-testid="select-service-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Publico</SelectItem>
                  <SelectItem value="internal">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                min="0"
                value={serviceForm.displayOrder}
                onChange={(event) => setServiceForm((current) => ({ ...current, displayOrder: event.target.value }))}
                placeholder="0"
                data-testid="input-service-order"
              />
            </div>
            <div className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Requiere agenda</p>
                  <p className="text-xs text-muted-foreground">Activalo si este servicio necesita reserva o cita.</p>
                </div>
                <Switch
                  checked={serviceForm.requiresAgenda}
                  onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, requiresAgenda: checked }))}
                  data-testid="switch-service-requires-agenda"
                />
              </div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Activo</p>
                  <p className="text-xs text-muted-foreground">Puedes desactivarlo sin perder su configuracion.</p>
                </div>
                <Switch
                  checked={serviceForm.isActive}
                  onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, isActive: checked }))}
                  data-testid="switch-service-active"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitService}
              disabled={!serviceForm.name.trim() || !serviceForm.category.trim() || createServiceMutation.isPending || updateServiceMutation.isPending}
              data-testid="button-save-service"
            >
              {(createServiceMutation.isPending || updateServiceMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingService ? "Guardar cambios" : "Crear servicio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saleOptionDialogOpen} onOpenChange={setSaleOptionDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSaleOption ? "Editar opcion de venta" : "Nueva opcion de venta"}</DialogTitle>
            <DialogDescription>
              {selectedService ? `Configura como se comercializa ${selectedService.name}.` : "Configura la opcion de venta del servicio."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={saleOptionForm.name}
                onChange={(event) => setSaleOptionForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Clase individual, Mensual, Paquete 8..."
                data-testid="input-service-option-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={saleOptionForm.type}
                onValueChange={(value: SaleOptionType) =>
                  setSaleOptionForm((current) => ({
                    ...current,
                    type: value,
                    requiresRegisteredClient: value === "membresia" ? true : current.requiresRegisteredClient,
                    allowsWalkIn: value === "membresia" ? false : current.allowsWalkIn,
                  }))
                }
              >
                <SelectTrigger data-testid="select-service-option-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SALE_OPTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Precio (MXN)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={saleOptionForm.price}
                onChange={(event) => setSaleOptionForm((current) => ({ ...current, price: event.target.value }))}
                placeholder="0.00"
                data-testid="input-service-option-price"
              />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                min="0"
                value={saleOptionForm.displayOrder}
                onChange={(event) => setSaleOptionForm((current) => ({ ...current, displayOrder: event.target.value }))}
                placeholder="0"
                data-testid="input-service-option-order"
              />
            </div>
            <div className="space-y-2">
              <Label>Usos incluidos</Label>
              <Input
                type="number"
                min="1"
                value={saleOptionForm.isUnlimited ? "" : saleOptionForm.includedUses}
                onChange={(event) => setSaleOptionForm((current) => ({ ...current, includedUses: event.target.value }))}
                placeholder={saleOptionForm.isUnlimited ? "Ilimitado" : "1"}
                disabled={saleOptionForm.isUnlimited}
                data-testid="input-service-option-included-uses"
              />
            </div>
            <div className="space-y-2">
              <Label>Vigencia (dias)</Label>
              <Input
                type="number"
                min="1"
                value={saleOptionForm.validityDays}
                onChange={(event) => setSaleOptionForm((current) => ({ ...current, validityDays: event.target.value }))}
                placeholder="30, 90, 365..."
                data-testid="input-service-option-validity-days"
              />
            </div>
            <div className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Usos ilimitados</p>
                  <p className="text-xs text-muted-foreground">Ideal para membresias o accesos sin tope.</p>
                </div>
                <Switch
                  checked={saleOptionForm.isUnlimited}
                  onCheckedChange={(checked) => setSaleOptionForm((current) => ({ ...current, isUnlimited: checked }))}
                  data-testid="switch-service-option-unlimited"
                />
              </div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Cliente registrado</p>
                  <p className="text-xs text-muted-foreground">Obligatorio para membresias y paquetes vinculados a una persona.</p>
                </div>
                <Switch
                  checked={saleOptionForm.type === "membresia" ? true : saleOptionForm.requiresRegisteredClient}
                  onCheckedChange={(checked) => setSaleOptionForm((current) => ({ ...current, requiresRegisteredClient: checked }))}
                  disabled={saleOptionForm.type === "membresia"}
                  data-testid="switch-service-option-client-required"
                />
              </div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Permite mostrador</p>
                  <p className="text-xs text-muted-foreground">Activalo si puede venderse sin cliente registrado.</p>
                </div>
                <Switch
                  checked={saleOptionForm.type === "membresia" ? false : saleOptionForm.allowsWalkIn}
                  onCheckedChange={(checked) => setSaleOptionForm((current) => ({ ...current, allowsWalkIn: checked }))}
                  disabled={saleOptionForm.type === "membresia"}
                  data-testid="switch-service-option-walkin"
                />
              </div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Favorita en POS</p>
                  <p className="text-xs text-muted-foreground">La dejaremos lista para Cobrar en una siguiente fase.</p>
                </div>
                <Switch
                  checked={saleOptionForm.isPosFavorite}
                  onCheckedChange={(checked) => setSaleOptionForm((current) => ({ ...current, isPosFavorite: checked }))}
                  data-testid="switch-service-option-favorite"
                />
              </div>
            </div>
            <div className="rounded-2xl border p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Activa</p>
                  <p className="text-xs text-muted-foreground">Puedes desactivarla sin eliminar el servicio base.</p>
                </div>
                <Switch
                  checked={saleOptionForm.isActive}
                  onCheckedChange={(checked) => setSaleOptionForm((current) => ({ ...current, isActive: checked }))}
                  data-testid="switch-service-option-active"
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notas internas</Label>
              <Textarea
                value={saleOptionForm.internalNotes}
                onChange={(event) => setSaleOptionForm((current) => ({ ...current, internalNotes: event.target.value }))}
                placeholder="Reglas internas o contexto para el equipo"
                rows={3}
                data-testid="textarea-service-option-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleOptionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitSaleOption}
              disabled={!saleOptionForm.name.trim() || !saleOptionForm.price || createSaleOptionMutation.isPending || updateSaleOptionMutation.isPending}
              data-testid="button-save-service-option"
            >
              {(createSaleOptionMutation.isPending || updateSaleOptionMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSaleOption ? "Guardar cambios" : "Crear opcion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "service" ? "Eliminar servicio" : "Eliminar opcion de venta"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "service"
                ? `Se ocultara "${deleteTarget.label}" junto con sus opciones.`
                : `Se ocultara la opcion "${deleteTarget?.label}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.kind === "service") {
                  deleteServiceMutation.mutate(deleteTarget.id);
                  return;
                }
                deleteSaleOptionMutation.mutate(deleteTarget.id);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
