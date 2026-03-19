import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  Clock,
  Star,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  X,
  ImagePlus,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  Briefcase,
  Save,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { BRANCH_CATEGORIES } from "@shared/schema";
import type { Branch, BranchPhoto, BranchProduct, BranchReview } from "@shared/schema";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch("/api/branch/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.message || "Error al subir archivo");
  }
  const data = await resp.json();
  return data.url;
}

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS_MAP: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
  thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

type DaySchedule = {
  open: boolean;
  from: string;
  to: string;
};

type OperatingHours = Record<string, DaySchedule>;

function getDefaultHours(): OperatingHours {
  const hours: OperatingHours = {};
  DAY_KEYS.forEach((day) => {
    hours[day] = { open: day !== "sunday", from: "06:00", to: "21:00" };
  });
  return hours;
}

function BasicProfileSection() {
  const { toast } = useToast();
  const { user, refetch } = useAuth();
  const branch = user?.branch as Branch | null;

  const [description, setDescription] = useState(branch?.description || "");
  const [category, setCategory] = useState(branch?.category || "box");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/branch/profile", { description, category });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Perfil actualizado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="card-basic-profile">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Información Básica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Categoría</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent>
              {BRANCH_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value} data-testid={`option-category-${cat.value}`}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Descripción</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe tu negocio para los visitantes..."
            rows={4}
            data-testid="input-description"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Esta descripción se mostrará en tu perfil público.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} data-testid="button-save-profile">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}

function GallerySection() {
  const { toast } = useToast();
  const { data: photos, isLoading } = useQuery<BranchPhoto[]>({
    queryKey: ["/api/branch/photos"],
  });
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const facilityPhotos = (photos || [])
    .filter((p) => p.type === "facility")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/photos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
      toast({ title: "Foto eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", "/api/branch/photos/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      await apiRequest("POST", "/api/branch/photos", { type: "facility", url });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
      toast({ title: "Foto agregada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const movePhoto = (index: number, direction: "up" | "down") => {
    const ids = facilityPhotos.map((p) => p.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" data-testid="skeleton-gallery" />;

  return (
    <Card data-testid="card-gallery">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ImagePlus className="h-4 w-4" />
            Galería
            <Badge variant="secondary" className="text-xs" data-testid="badge-gallery-count">
              {facilityPhotos.length}/5
            </Badge>
          </CardTitle>
          {facilityPhotos.length < 5 && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
                data-testid="input-gallery-upload"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                data-testid="button-add-gallery-photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Agregar
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {facilityPhotos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-gallery">
            No hay fotos en la galería. Sube hasta 5 fotos de tus instalaciones.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {facilityPhotos.map((photo, idx) => (
              <div key={photo.id} className="relative group" data-testid={`gallery-photo-${photo.id}`}>
                <img
                  src={photo.url}
                  alt={`Galería ${idx + 1}`}
                  className="h-28 w-full rounded-md object-cover border"
                />
                <div className="absolute top-1 right-1 flex gap-1 invisible group-hover:visible">
                  {idx > 0 && (
                    <Button size="icon" variant="secondary" onClick={() => movePhoto(idx, "up")} data-testid={`button-gallery-up-${photo.id}`}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                  )}
                  {idx < facilityPhotos.length - 1 && (
                    <Button size="icon" variant="secondary" onClick={() => movePhoto(idx, "down")} data-testid={`button-gallery-down-${photo.id}`}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(photo.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-gallery-delete-${photo.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type LocEntry = { name: string; address: string; googleMapsUrl: string };

function LocationSection() {
  const { toast } = useToast();
  const { user, refetch } = useAuth();
  const branch = user?.branch as Branch | null;

  const initLocations = (): LocEntry[] => {
    const saved = (branch as any)?.locations as LocEntry[] | null;
    if (saved && saved.length > 0) return saved;
    return [{ name: "", address: branch?.address || "", googleMapsUrl: (branch as any)?.googleMapsUrl || "" }];
  };

  const [locations, setLocations] = useState<LocEntry[]>(initLocations);
  const [latitude, setLatitude] = useState<string>((branch as any)?.latitude?.toString() || "");
  const [longitude, setLongitude] = useState<string>((branch as any)?.longitude?.toString() || "");
  const [coordError, setCoordError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const update = (idx: number, field: keyof LocEntry, value: string) => {
    setLocations((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addSecond = () => {
    if (locations.length < 2) setLocations((prev) => [...prev, { name: "", address: "", googleMapsUrl: "" }]);
  };

  const removeSecond = () => setLocations((prev) => prev.slice(0, 1));

  const handleSave = async () => {
    setCoordError("");
    const lat = latitude.trim() ? parseFloat(latitude) : null;
    const lng = longitude.trim() ? parseFloat(longitude) : null;
    if (latitude.trim() && (isNaN(lat!) || lat! < -90 || lat! > 90)) {
      setCoordError("Latitud inválida. Debe ser un número entre -90 y 90.");
      return;
    }
    if (longitude.trim() && (isNaN(lng!) || lng! < -180 || lng! > 180)) {
      setCoordError("Longitud inválida. Debe ser un número entre -180 y 180.");
      return;
    }
    setSaving(true);
    try {
      const locs = locations.filter((l) => l.address.trim() || l.googleMapsUrl.trim());
      await apiRequest("PATCH", "/api/branch/profile", {
        locations: locs,
        address: locs[0]?.address || "",
        googleMapsUrl: locs[0]?.googleMapsUrl || "",
        latitude: lat,
        longitude: lng,
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Ubicación actualizada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="card-location">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Ubicaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {locations.map((loc, idx) => (
          <div key={idx} className="space-y-3">
            {idx > 0 && <div className="border-t pt-1" />}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">
                {idx === 0 ? "Ubicación principal" : "Segunda ubicación"}
              </span>
              {idx === 1 && (
                <button
                  onClick={removeSecond}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  data-testid="button-remove-location-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div>
              <Label>Nombre (opcional)</Label>
              <Input
                value={loc.name}
                onChange={(e) => update(idx, "name", e.target.value)}
                placeholder={idx === 0 ? "Ej. Sucursal Norte" : "Ej. Sucursal Sur"}
                data-testid={`input-location-name-${idx}`}
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={loc.address}
                onChange={(e) => update(idx, "address", e.target.value)}
                placeholder="Av. Ejemplo 123, Col. Centro, Ciudad"
                data-testid={idx === 0 ? "input-address" : `input-address-${idx}`}
              />
            </div>
            <div>
              <Label>URL de Google Maps</Label>
              <Input
                value={loc.googleMapsUrl}
                onChange={(e) => update(idx, "googleMapsUrl", e.target.value)}
                placeholder="https://maps.google.com/..."
                data-testid={idx === 0 ? "input-google-maps-url" : `input-google-maps-url-${idx}`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pega el enlace de tu ubicación en Google Maps.
              </p>
            </div>
            {loc.googleMapsUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(loc.googleMapsUrl, "_blank")}
                data-testid={idx === 0 ? "button-preview-maps" : `button-preview-maps-${idx}`}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver en Google Maps
              </Button>
            )}
          </div>
        ))}
        {locations.length < 2 && (
          <Button
            variant="outline"
            size="sm"
            onClick={addSecond}
            className="w-full"
            data-testid="button-add-location"
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar segunda ubicación
          </Button>
        )}

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Coordenadas (para búsqueda por cercanía)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitud</Label>
              <Input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Ej. 20.6736"
                inputMode="decimal"
                data-testid="input-latitude"
              />
            </div>
            <div>
              <Label>Longitud</Label>
              <Input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Ej. -103.3441"
                inputMode="decimal"
                data-testid="input-longitude"
              />
            </div>
          </div>
          {coordError && (
            <p className="text-xs text-destructive" data-testid="text-coord-error">{coordError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Tip: abre Google Maps, haz clic derecho en tu ubicación y copia las coordenadas que aparecen.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} data-testid="button-save-location">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}

function HoursSection() {
  const { toast } = useToast();
  const { user, refetch } = useAuth();
  const branch = user?.branch as Branch | null;

  const savedHours = (branch as any)?.operatingHours as OperatingHours | null;
  const [hours, setHours] = useState<OperatingHours>(savedHours || getDefaultHours());
  const [saving, setSaving] = useState(false);

  const updateDay = (day: string, field: keyof DaySchedule, value: string | boolean) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/branch/profile", { operatingHours: hours });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Horarios actualizados" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="card-hours">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Horarios de Operación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {DAY_KEYS.map((day) => {
          const dayData = hours[day] || { open: false, from: "06:00", to: "21:00" };
          return (
            <div
              key={day}
              className="flex items-center gap-3 flex-wrap"
              data-testid={`hours-row-${day}`}
            >
              <div className="w-24 flex items-center gap-2">
                <Switch
                  checked={dayData.open}
                  onCheckedChange={(val) => updateDay(day, "open", val)}
                  data-testid={`switch-day-${day}`}
                />
                <span className="text-sm font-medium">{(DAY_LABELS_MAP[day] || day).slice(0, 3)}</span>
              </div>
              {dayData.open ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={dayData.from}
                    onChange={(e) => updateDay(day, "from", e.target.value)}
                    className="w-28"
                    data-testid={`input-from-${day}`}
                  />
                  <span className="text-sm text-muted-foreground">a</span>
                  <Input
                    type="time"
                    value={dayData.to}
                    onChange={(e) => updateDay(day, "to", e.target.value)}
                    className="w-28"
                    data-testid={`input-to-${day}`}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground" data-testid={`text-closed-${day}`}>
                  Cerrado
                </span>
              )}
            </div>
          );
        })}
        <Button onClick={handleSave} disabled={saving} className="mt-2" data-testid="button-save-hours">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar Horarios
        </Button>
      </CardContent>
    </Card>
  );
}

function ServicesProductsSection() {
  const { toast } = useToast();
  const { data: products, isLoading } = useQuery<BranchProduct[]>({
    queryKey: ["/api/branch/products"],
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchProduct | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productType, setProductType] = useState<string>("product");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sortedProducts = (products || []).sort((a, b) => a.displayOrder - b.displayOrder);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/branch/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
      toast({ title: "Elemento creado" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/branch/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
      toast({ title: "Elemento actualizado" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
      toast({ title: "Elemento eliminado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", "/api/branch/products/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setProductType("product");
    setDurationMinutes("");
  };

  const openCreate = () => {
    closeDialog();
    setDialogOpen(true);
  };

  const openEdit = (product: BranchProduct) => {
    setEditing(product);
    setName(product.name);
    setDescription(product.description || "");
    setPrice((product.price / 100).toFixed(2));
    setImageUrl(product.imageUrl || "");
    setProductType(product.type || "product");
    setDurationMinutes(product.durationMinutes ? String(product.durationMinutes) : "");
    setDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      setImageUrl(url);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = () => {
    const priceInCents = Math.round(parseFloat(price) * 100);
    const data: any = {
      name,
      price: priceInCents,
      type: productType,
    };
    if (description) data.description = description;
    if (imageUrl) data.imageUrl = imageUrl;
    if (productType === "service" && durationMinutes) {
      data.durationMinutes = parseInt(durationMinutes);
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const moveProduct = (index: number, direction: "up" | "down") => {
    const ids = sortedProducts.map((p) => p.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" data-testid="skeleton-services" />;

  return (
    <Card data-testid="card-services-products">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Servicios y Productos
            {sortedProducts.length > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-services-count">
                {sortedProducts.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openCreate} data-testid="button-create-service">
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-services">
            No hay servicios ni productos. Agrega los servicios que ofreces.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedProducts.map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border flex-wrap"
                data-testid={`service-item-${product.id}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-10 w-10 rounded-md object-cover border shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                      {product.type === "service" ? (
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate" data-testid={`text-service-name-${product.id}`}>
                        {product.name}
                      </span>
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-type-${product.id}`}>
                        {product.type === "service" ? "Servicio" : "Producto"}
                      </Badge>
                      {product.type === "service" && product.durationMinutes && (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-duration-${product.id}`}>
                          {product.durationMinutes} min
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid={`text-service-price-${product.id}`}>
                      ${(product.price / 100).toFixed(2)} MXN
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {idx > 0 && (
                    <Button size="icon" variant="ghost" onClick={() => moveProduct(idx, "up")} data-testid={`button-up-service-${product.id}`}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                  )}
                  {idx < sortedProducts.length - 1 && (
                    <Button size="icon" variant="ghost" onClick={() => moveProduct(idx, "down")} data-testid={`button-down-service-${product.id}`}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(product)} data-testid={`button-edit-service-${product.id}`}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(product.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-service-${product.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent data-testid="dialog-service">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nuevo"} Servicio / Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Producto</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del servicio o producto"
                data-testid="input-service-name"
              />
            </div>
            <div>
              <Label>Precio (MXN)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                data-testid="input-service-price"
              />
            </div>
            {productType === "service" && (
              <div>
                <Label>Duración (minutos)</Label>
                <Input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="60"
                  min="1"
                  data-testid="input-service-duration"
                />
              </div>
            )}
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción breve"
                rows={2}
                data-testid="input-service-description"
              />
            </div>
            <div>
              <Label>Imagen (opcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={() => inputRef.current?.click()}
                  data-testid="button-upload-service-image"
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  Subir imagen
                </Button>
                {imageUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setImageUrl("")} data-testid="button-remove-service-image">
                    <X className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                )}
              </div>
              {imageUrl && (
                <img src={imageUrl} alt="Preview" className="mt-2 w-full max-h-32 object-cover rounded-md" data-testid="preview-service-image" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-service">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || !price || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-service"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface ReviewsResponse {
  reviews: (BranchReview & { userName?: string })[];
  averageRating: number;
  totalReviews: number;
}

function ReviewsSummarySection() {
  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["/api/branch/reviews"],
  });

  if (isLoading) return <Skeleton className="h-32 w-full" data-testid="skeleton-reviews" />;

  const reviews = data?.reviews || [];
  const avgRating = data?.averageRating || 0;
  const totalReviews = data?.totalReviews || 0;

  return (
    <Card data-testid="card-reviews-summary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4" />
          Reseñas
          {totalReviews > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-reviews-count">
              {totalReviews}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalReviews === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-reviews">
            Aún no tienes reseñas. Tus clientes podrán dejar reseñas desde tu perfil público.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3" data-testid="reviews-average">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${star <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <span className="text-lg font-semibold" data-testid="text-avg-rating">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                ({totalReviews} {totalReviews === 1 ? "reseña" : "reseñas"})
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {reviews.slice(0, 5).map((review) => (
                <div
                  key={review.id}
                  className="p-3 rounded-md border space-y-1"
                  data-testid={`review-item-${review.id}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3 w-3 ${star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm" data-testid={`text-review-comment-${review.id}`}>
                      {review.comment}
                    </p>
                  )}
                  {review.adminReply && (
                    <div className="pl-3 border-l-2 border-primary/30 mt-1">
                      <p className="text-xs text-muted-foreground">Tu respuesta:</p>
                      <p className="text-sm" data-testid={`text-review-reply-${review.id}`}>
                        {review.adminReply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PerfilPublicoTab() {
  return (
    <div className="space-y-4" data-testid="perfil-publico-tab">
      <BasicProfileSection />
      <GallerySection />
      <LocationSection />
      <HoursSection />
      <ServicesProductsSection />
      <ReviewsSummarySection />
    </div>
  );
}
