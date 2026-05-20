import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Plus,
  LogOut,
  Shield,
  Loader2,
  CheckCircle2,
  Users,
  Moon,
  Sun,
  Trash2,
  KeyRound,
  ExternalLink,
  Search,
  Copy,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  ClipboardCheck,
  UserCog,
  History,
  LayoutDashboard,
  UserCheck,
  Send,
  FolderTree,
  Tags,
  Settings2,
  BarChart3,
  PencilLine,
} from "lucide-react";
import {
  createBranchFormSchema,
  type CreateBranchFormData,
  type Branch,
  BRANCH_CATEGORIES,
  BRANCH_SUBCATEGORY_PLACEHOLDERS,
  BRANCH_SEARCH_KEYWORDS_PLACEHOLDER,
  type AuditLog,
} from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NotificationsPanel from "@/components/notifications-panel";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type BranchMetric = { branchId: string; customerCount: number; activeMemberships: number };
type AdminInfo = { id: string; email: string; name: string; createdAt?: string } | null;
type CustomerAppOverview = {
  total: number;
  active: number;
  blocked: number;
  recent: number;
  pendingReports: number;
};
type CustomerAppUser = {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  isBlocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  branchCount: number;
  reviewCount: number;
  lastActivity: string | null;
};
type CustomerAppDetail = {
  user: {
    id: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    createdAt: string;
    isBlocked: boolean;
    blockedAt: string | null;
    blockedReason: string | null;
  };
  stats: {
    branchCount: number;
    reviewCount: number;
    lastActivity: string | null;
  };
  memberships: Array<{
    id: string;
    branchId: string;
    status: string;
    joinedAt: string;
    lastSeenAt: string | null;
    clientStatus: string;
    isFavorite: boolean;
    branchName: string;
    branchSlug: string;
  }>;
  reviews: Array<{
    id: string;
    branchId: string;
    rating: number;
    comment: string | null;
    adminReply: string | null;
    isHidden: boolean;
    hiddenReason: string | null;
    createdAt: string;
    branchName: string;
    branchSlug: string;
  }>;
  reports: Array<{
    id: string;
    branchId: string;
    branchName: string | null;
    branchSlug: string | null;
    reason: string;
    note: string | null;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    reporterName?: string | null;
    reviewerName?: string | null;
  }>;
  localBlocks: Array<{
    id: string;
    branchId: string;
    branchName: string;
    branchSlug: string;
    reason: string | null;
    note: string | null;
    createdAt: string;
    unblockedAt: string | null;
  }>;
};
type SystemEventRow = {
  id: string;
  eventType: string;
  branchId: string | null;
  userId: string | null;
  payload: Record<string, any> | null;
  status: string;
  createdAt: string;
  processedAt: string | null;
  branchName?: string | null;
  userEmail?: string | null;
  userName?: string | null;
};
type CatalogCategoryRow = {
  key: string;
  label: string;
  icon: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};
type CatalogSubcategoryRow = {
  id: string;
  categoryKey: string;
  label: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  categoryLabel?: string | null;
};
type CatalogKeywordRow = {
  id: string;
  categoryKey: string | null;
  subcategoryId: string | null;
  keyword: string;
  normalizedKeyword: string;
  kind: string;
  createdAt: string;
  categoryLabel?: string | null;
  subcategoryLabel?: string | null;
};
type AppSettingRow = {
  key: string;
  valueJson: any;
  scope: string;
  updatedBy: string | null;
  updatedAt: string;
};
type SearchLogRecord = {
  id: string;
  userId: string | null;
  queryRaw: string | null;
  queryNormalized: string | null;
  category: string | null;
  subcategory: string | null;
  lat: number | null;
  lng: number | null;
  zone: string | null;
  resultCount: number;
  selectedBranchId: string | null;
  source: string;
  createdAt: string;
  userEmail?: string | null;
  selectedBranchName?: string | null;
};
type SearchMetricsResponse = {
  topQueries: Array<{ query: string; total: number }>;
  zeroResultQueries: Array<{ query: string; total: number }>;
  topCategories: Array<{ category: string; total: number }>;
};
type PlatformMetricsResponse = {
  totalAppUsers: number;
  activeBranches: number;
  totalSearches: number;
  zeroResultSearches: number;
  reservationStats: {
    created: number;
    cancelled: number;
    attended: number;
    noShow: number;
  };
  mostActiveBranches: Array<{
    branchId: string;
    branchName: string;
    totalReservations: number;
  }>;
};
type ReviewReportRecord = {
  id: string;
  reviewId: string;
  branchId: string;
  reporterUserId: string | null;
  reportedByRole: string;
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  reviewedByUserId: string | null;
  resolutionNote: string | null;
  reviewRating?: number | null;
  reviewComment?: string | null;
  branchName?: string | null;
  branchSlug?: string | null;
  reporterName?: string | null;
  reviewerName?: string | null;
  customerName?: string | null;
  customerLastName?: string | null;
  isHidden?: boolean;
  hiddenReason?: string | null;
  adminReply?: string | null;
};
type ReviewModerationLogRecord = {
  id: string;
  reviewId: string;
  action: string;
  actorUserId: string | null;
  reason: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  branchName?: string | null;
  reviewComment?: string | null;
  actorName?: string | null;
};
type NotificationJobRecord = {
  id: string;
  type: string;
  branchId: string | null;
  userId: string | null;
  payload: Record<string, any> | null;
  scheduledFor: string;
  status: string;
  attempts: number;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
};
type ReservationAuditRecord = {
  id: string;
  bookingId: string;
  branchId: string;
  customerUserId: string;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  reason: string | null;
  source: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  customerName?: string | null;
  customerLastName?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  className?: string | null;
  bookingDate?: string | null;
  bookingStatus?: string | null;
};
type BlockedUserRecord = {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  blockedAt: string | null;
  blockedReason: string | null;
};

const CUSTOMER_REPORT_LABELS: Record<string, string> = {
  comentario_ofensivo: "Comentario ofensivo",
  mal_comportamiento: "Mal comportamiento",
  no_respeto_reglas: "No respeto reglas",
  spam: "Spam",
  otro: "Otro",
};

const CUSTOMER_REPORT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  reviewed: "Revisado",
  dismissed: "Descartado",
  escalated: "Escalado",
};

const SYSTEM_EVENT_LABELS: Record<string, string> = {
  customer_registered: "Cliente registrado",
  booking_created: "Reserva creada",
  booking_cancelled: "Reserva cancelada",
  promotion_created: "Promocion creada",
  review_created: "Reseña creada",
  customer_reported: "Cliente reportado",
  customer_blocked_global: "Bloqueo global",
  customer_blocked_local: "Bloqueo local",
};

function getCategoryLabel(category?: string | null) {
  return BRANCH_CATEGORIES.find((item) => item.value === category)?.label || category || "Sin categoria";
}

function getSubcategoryPlaceholder(category: string) {
  return BRANCH_SUBCATEGORY_PLACEHOLDERS[category] || BRANCH_SUBCATEGORY_PLACEHOLDERS.default;
}

function extractErrorMessage(err: any, fallback: string): string {
  try {
    const msg = err?.message || "";
    const statusMatch = msg.match(/^(\d{3}):\s*/);
    const statusCode = statusMatch ? statusMatch[1] : "";
    const body = statusMatch ? msg.substring(statusMatch[0].length) : msg;

    let message = fallback;

    try {
      const parsed = JSON.parse(body);
      message = parsed.message || fallback;
    } catch {
      if (body.trim()) {
        message = body;
      }
    }

    if (statusCode === "403") {
      return `Acceso denegado (${statusCode}). Tu sesión puede haber expirado. Recarga la página.`;
    }
    if (statusCode === "401") {
      return `No autenticado (${statusCode}). Inicia sesión nuevamente.`;
    }
    if (statusCode && statusCode !== "200") {
      return `${message} (${statusCode})`;
    }
    return message;
  } catch {
    return fallback;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}

function invalidateBranches() {
  queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/branches") });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches/metrics"] });
  queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/superadmin/audit") });
}

function invalidateAppCustomers() {
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/app-customers/overview"] });
  queryClient.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/superadmin/app-customers"),
  });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/system-events"] });
}

function invalidateCatalog() {
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/catalog/categories"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/catalog/subcategories"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/catalog/keywords"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/search-logs"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/search-metrics"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/platform-metrics"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/review-reports"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/review-moderation-logs"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/blocked-users"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/notification-jobs"] });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/reservation-audit"] });
}

function customerFullName(customer: { name: string; lastName?: string | null }) {
  return customer.lastName ? `${customer.name} ${customer.lastName}` : customer.name;
}

function formatShortDate(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDateTime(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function customerReportReasonLabel(reason: string) {
  return CUSTOMER_REPORT_LABELS[reason] || reason;
}

function customerReportStatusLabel(status: string) {
  return CUSTOMER_REPORT_STATUS_LABELS[status] || status;
}

function customerReportStatusBadge(status: string) {
  if (status === "reviewed") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "dismissed") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "escalated") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function systemEventLabel(eventType: string) {
  return SYSTEM_EVENT_LABELS[eventType] || eventType;
}

function reviewReportStatusLabel(status: string) {
  if (status === "reviewed") return "Revisado";
  if (status === "dismissed") return "Descartado";
  return "Pendiente";
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    active: { label: "Activa", variant: "default" },
    suspended: { label: "Suspendida", variant: "secondary" },
    blacklisted: { label: "Bloqueada", variant: "destructive" },
  };
  const c = config[status] || config.active;
  return <Badge variant={c.variant} data-testid={`badge-status-${status}`}>{c.label}</Badge>;
}

function DeleteBranchDialog({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/superadmin/branches/${branch.id}`);
    },
    onSuccess: () => {
      toast({ title: "Sucursal eliminada" });
      invalidateBranches();
      setOpen(false);
      setConfirmSlug("");
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmSlug(""); }}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-delete-${branch.id}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar sucursal</TooltipContent>
          </Tooltip>
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar sucursal</DialogTitle>
          <DialogDescription>
            Esto ocultará la sucursal y bloqueará el acceso. Los datos no se borrarán permanentemente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm">
            Para confirmar, escribe el slug: <strong>{branch.slug}</strong>
          </p>
          <Input
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={branch.slug}
            data-testid="input-confirm-slug"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-delete">Cancelar</Button>
          <Button
            variant="destructive"
            disabled={confirmSlug !== branch.slug || mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="button-confirm-delete"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditBranchDialog({
  branch,
  adminEmail,
}: {
  branch: Branch;
  adminEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(branch.name);
  const [slug, setSlug] = useState(branch.slug);
  const [status, setStatus] = useState(branch.status);
  const [category, setCategory] = useState(branch.category || "box");
  const [subcategory, setSubcategory] = useState(branch.subcategory || "");
  const [searchKeywords, setSearchKeywords] = useState(branch.searchKeywords || "");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setName(branch.name);
      setSlug(branch.slug);
      setStatus(branch.status);
      setCategory(branch.category || "box");
      setSubcategory(branch.subcategory || "");
      setSearchKeywords(branch.searchKeywords || "");
    }
  }, [
    open,
    branch.name,
    branch.slug,
    branch.status,
    branch.category,
    branch.subcategory,
    branch.searchKeywords,
  ]);

  const { data: categories = [] } = useQuery<CatalogCategoryRow[]>({
    queryKey: ["/api/superadmin/catalog/categories"],
    queryFn: () => fetchJson("/api/superadmin/catalog/categories"),
    enabled: open,
  });

  const { data: subcategories = [] } = useQuery<CatalogSubcategoryRow[]>({
    queryKey: ["/api/superadmin/catalog/subcategories"],
    queryFn: () => fetchJson("/api/superadmin/catalog/subcategories"),
    enabled: open,
  });

  const availableSubcategories = subcategories.filter((item) => item.categoryKey === category);

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("PATCH", `/api/superadmin/branches/${branch.id}`, {
        name: name.trim(),
        slug: slug.trim(),
        status,
        category,
        subcategory: subcategory.trim() || null,
        searchKeywords: searchKeywords.trim() || null,
      });
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Sucursal actualizada" });
      invalidateBranches();
      setOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: extractErrorMessage(err, "No se pudo actualizar la sucursal"),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-edit-branch-${branch.id}`}>
                <PencilLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar sucursal</TooltipContent>
          </Tooltip>
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar sucursal</DialogTitle>
          <DialogDescription>
            Actualiza los datos visibles y de catálogo sin afectar los contratos actuales de la app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la sucursal"
                data-testid="input-edit-branch-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="mi-sucursal"
                data-testid="input-edit-branch-slug"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setSubcategory("");
                }}
              >
                <SelectTrigger data-testid="select-edit-branch-category">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subcategoría</Label>
              <Select value={subcategory || "none"} onValueChange={(value) => setSubcategory(value === "none" ? "" : value)}>
                <SelectTrigger data-testid="select-edit-branch-subcategory">
                  <SelectValue placeholder="Subcategoría opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin subcategoría</SelectItem>
                  {subcategory &&
                    !availableSubcategories.some((item) => item.label === subcategory) && (
                      <SelectItem value={subcategory}>
                        {subcategory}
                      </SelectItem>
                    )}
                  {availableSubcategories.map((item) => (
                    <SelectItem key={item.id} value={item.label}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si el catálogo tiene especialidades para esta categoría, se muestran aquí automáticamente.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label>Palabras clave de búsqueda</Label>
              <Textarea
                value={searchKeywords}
                onChange={(e) => setSearchKeywords(e.target.value)}
                placeholder={BRANCH_SEARCH_KEYWORDS_PLACEHOLDER}
                rows={3}
                data-testid="textarea-edit-branch-keywords"
              />
              <p className="text-xs text-muted-foreground">
                Ayudan a que la app encuentre la sucursal aunque el usuario escriba distinto. Sepáralas por comas.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as Branch["status"])}
              >
                <SelectTrigger data-testid="select-edit-branch-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="suspended">Suspendida</SelectItem>
                  <SelectItem value="blacklisted">Bloqueada</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Admin actual</p>
                <p>{adminEmail || "Sin admin asignado"}</p>
                <p className="mt-1">La gestión de correo y admin sigue disponible en el botón dedicado de admin.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-edit-branch">
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !name.trim() ||
              !slug.trim() ||
              !category.trim()
            }
            data-testid="button-save-edit-branch"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ branch, hasAdmin }: { branch: Branch; hasAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string; name: string } | null>(null);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/superadmin/branches/${branch.id}/reset-admin-password`);
      return resp.json();
    },
    onSuccess: (data) => {
      setResult(data);
      invalidateBranches();
      toast({ title: "Contraseña reseteada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No hay admin para esta sucursal"), variant: "destructive" });
    },
  });

  const r = result;
  function copyAll() {
    if (!r) return;
    navigator.clipboard.writeText(`Email: ${r.email}\nContraseña: ${r.password}`);
    toast({ title: "Copiado al portapapeles" });
  }

  function downloadTxt() {
    if (!r) return;
    const origin = window.location.origin;
    const text = [
      `Reset de contraseña - ${branch.name}`,
      `==================================`,
      `Login: ${origin}/`,
      `Email: ${r.email}`,
      `Nueva contraseña: ${r.password}`,
      `==================================`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reset-${branch.slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResult(null); }}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" disabled={hasAdmin === false} data-testid={`button-reset-pw-${branch.id}`}>
                <KeyRound className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{hasAdmin === false ? "Primero crea o asigna un admin" : "Reset contraseña admin"}</TooltipContent>
          </Tooltip>
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset contraseña admin</DialogTitle>
          <DialogDescription>
            Se generará una nueva contraseña segura para el administrador de {branch.name}.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3 py-2">
            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
              <p><strong>Email:</strong> {result.email}</p>
              <p><strong>Nueva contraseña:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{result.password}</code></p>
            </div>
            <div className="flex gap-2">
              <Button onClick={copyAll} className="flex-1" data-testid="button-copy-reset">
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button variant="outline" onClick={downloadTxt} className="flex-1" data-testid="button-download-reset">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-reset">Cancelar</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-confirm-reset">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generar nueva contraseña
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminDialog({ branch, onAdminChanged }: { branch: Branch; onAdminChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string | null; reassigned?: boolean } | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const { toast } = useToast();

  const { data: admin, isLoading: loadingAdmin } = useQuery<AdminInfo>({
    queryKey: ["/api/superadmin/branches", branch.id, "admin"],
    queryFn: async () => {
      const resp = await fetch(`/api/superadmin/branches/${branch.id}/admin`, { credentials: "include" });
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string }) => {
      const resp = await apiRequest("PATCH", `/api/superadmin/branches/${branch.id}/admin`, data);
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Admin actualizado" });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches", branch.id, "admin"] });
      invalidateBranches();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "Error al actualizar"), variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; password?: string; reassign?: boolean }) => {
      const resp = await apiRequest("POST", `/api/superadmin/branches/${branch.id}/admin`, data);
      return resp.json();
    },
    onSuccess: (result) => {
      setCreatedCreds({ email: result.admin.email, password: result.password, reassigned: result.reassigned });
      setShowReassign(false);
      toast({ title: result.reassigned ? "Admin reasignado" : "Admin creado" });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches", branch.id, "admin"] });
      invalidateBranches();
      onAdminChanged?.();
    },
    onError: (err: any) => {
      const errorMsg = extractErrorMessage(err, "Error al crear admin");
      if (errorMsg.includes("reasignar")) {
        setShowReassign(true);
        toast({ title: "Usuario existente", description: errorMsg, variant: "default" });
      } else {
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
      }
    },
  });

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEditName("");
      setEditEmail("");
      setNewAdminEmail("");
      setNewAdminName("");
      setNewAdminPassword("");
      setCreatedCreds(null);
      setShowReassign(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    handleOpen(isOpen);
    if (isOpen && admin) {
      setEditName(admin.name);
      setEditEmail(admin.email);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-admin-${branch.id}`}>
                <UserCog className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gestionar admin</TooltipContent>
          </Tooltip>
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admin de {branch.name}</DialogTitle>
          <DialogDescription>Gestiona el administrador de esta sucursal.</DialogDescription>
        </DialogHeader>

        {loadingAdmin ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : createdCreds ? (
          <div className="space-y-3 py-2">
            {createdCreds.reassigned ? (
              <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
                <p className="font-semibold text-green-600">Usuario reasignado como admin</p>
                <p><strong>Email:</strong> {createdCreds.email}</p>
                <p className="text-xs text-muted-foreground">El usuario conserva su contraseña actual.</p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
                  <p><strong>Email:</strong> {createdCreds.email}</p>
                  <p><strong>Contraseña:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{createdCreds.password}</code></p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${createdCreds.email}\nContraseña: ${createdCreds.password}`);
                    toast({ title: "Copiado" });
                  }}
                  data-testid="button-copy-new-admin"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar credenciales
                </Button>
              </>
            )}
          </div>
        ) : admin ? (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
                data-testid="input-edit-admin-name"
              />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="mt-1"
                data-testid="input-edit-admin-email"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-admin-edit">Cancelar</Button>
              <Button
                disabled={updateMutation.isPending || (editName === admin.name && editEmail === admin.email)}
                onClick={() => updateMutation.mutate({ name: editName, email: editEmail })}
                data-testid="button-save-admin"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">No hay admin asignado. Crea uno nuevo o asigna un usuario existente:</p>
            <div>
              <Label className="text-sm">Nombre</Label>
              <Input
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Juan Pérez"
                className="mt-1"
                data-testid="input-new-admin-name"
              />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input
                type="email"
                value={newAdminEmail}
                onChange={(e) => { setNewAdminEmail(e.target.value); setShowReassign(false); }}
                placeholder="admin@sucursal.com"
                className="mt-1"
                data-testid="input-new-admin-email"
              />
            </div>
            {!showReassign && (
              <div>
                <Label className="text-sm">Contraseña</Label>
                <div className="flex gap-1 mt-1">
                  <div className="relative flex-1">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      placeholder="Dejar vacío para autogenerar"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      data-testid="input-new-admin-password"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-0 top-0"
                      onClick={() => setShowNewPw(!showNewPw)}
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
                      let pw = "";
                      for (let i = 0; i < 14; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
                      setNewAdminPassword(pw);
                      setShowNewPw(true);
                    }}
                    data-testid="button-generate-new-admin-pw"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-create-admin">Cancelar</Button>
              {showReassign ? (
                <Button
                  disabled={createMutation.isPending || !newAdminEmail}
                  onClick={() => createMutation.mutate({ email: newAdminEmail, name: newAdminName || `Admin ${branch.name}`, reassign: true })}
                  data-testid="button-reassign-admin"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Reasignar como admin
                </Button>
              ) : (
                <Button
                  disabled={createMutation.isPending || !newAdminEmail}
                  onClick={() => createMutation.mutate({ email: newAdminEmail, name: newAdminName || `Admin ${branch.name}`, password: newAdminPassword || undefined })}
                  data-testid="button-create-admin"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Crear admin
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImpersonateButton({ branch, hasAdmin }: { branch: Branch; hasAdmin?: boolean }) {
  const { toast } = useToast();
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/superadmin/impersonate", { branchId: branch.id });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: `Modo soporte: ${branch.name}` });
      setTimeout(() => {
        refetch();
        setLocation("/dashboard");
      }, 300);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se puede iniciar modo soporte"), variant: "destructive" });
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || hasAdmin === false}
          data-testid={`button-impersonate-${branch.id}`}
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hasAdmin === false ? "Primero crea o asigna un admin" : "Entrar como admin"}</TooltipContent>
    </Tooltip>
  );
}

function ResendWelcomeButton({ branch, hasAdmin }: { branch: Branch; hasAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: pkg, isLoading, isError, error } = useQuery<{
    branchName: string;
    branchSlug: string;
    adminEmail: string | null;
    adminName: string | null;
    hasAdmin: boolean;
  }>({
    queryKey: ["/api/superadmin/branches", branch.id, "welcome-package"],
    queryFn: async () => {
      const resp = await fetch(`/api/superadmin/branches/${branch.id}/welcome-package`, { credentials: "include" });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`${resp.status}: ${text || resp.statusText}`);
      }
      return resp.json();
    },
    enabled: open,
    retry: false,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function getLinks(slug: string) {
    return {
      publicUrl: `${origin}/app/${slug}`,
      marketplace: `${origin}/explore`,
      favorites: `${origin}/favorites`,
      login: `${origin}/`,
      dashboard: `${origin}/dashboard`,
    };
  }

  function copyWelcome() {
    if (!pkg) return;
    const links = getLinks(pkg.branchSlug);
    const lines = [
      `Paquete de bienvenida - ${pkg.branchName}`,
      ``,
      `URLs importantes:`,
      `  Página pública (para clientes): ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login (admin): ${links.login}`,
      `  Dashboard (requiere login): ${links.dashboard}`,
    ];
    if (pkg.adminEmail) {
      lines.push(``, `Admin:`, `  Email: ${pkg.adminEmail}`);
      if (pkg.adminName) lines.push(`  Nombre: ${pkg.adminName}`);
      lines.push(`  (Contraseña no incluida — usa "Reset contraseña" si necesitas regenerarla)`);
    } else {
      lines.push(``, `AVISO: No hay admin asignado aún.`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Paquete de bienvenida copiado" });
  }

  function downloadTxt() {
    if (!pkg) return;
    const links = getLinks(pkg.branchSlug);
    const lines = [
      `Paquete de bienvenida - ${pkg.branchName}`,
      `==================================`,
      ``,
      `URLs importantes:`,
      `  Página pública: ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login: ${links.login}`,
      `  Dashboard: ${links.dashboard}`,
    ];
    if (pkg.adminEmail) {
      lines.push(``, `Admin:`, `  Email: ${pkg.adminEmail}`);
      if (pkg.adminName) lines.push(`  Nombre: ${pkg.adminName}`);
      lines.push(`  (Contraseña no incluida)`);
    } else {
      lines.push(``, `Sin admin asignado.`);
    }
    lines.push(``, `==================================`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bienvenida-${pkg.branchSlug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-resend-welcome-${branch.id}`}>
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reenviar paquete de bienvenida</TooltipContent>
          </Tooltip>
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paquete de bienvenida</DialogTitle>
          <DialogDescription>URLs y datos de la sucursal. Puedes copiar o descargar.</DialogDescription>
        </DialogHeader>
        {isError ? (
          <div className="py-4 text-center space-y-2">
            <p className="text-sm text-destructive font-medium">No se pudo cargar el paquete de bienvenida</p>
            <p className="text-xs text-muted-foreground">
              {extractErrorMessage(error, "Error desconocido")}
            </p>
          </div>
        ) : isLoading || !pkg ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
              <p className="font-semibold">{pkg.branchName}</p>
              <div className="space-y-1 pt-1">
                <p><strong>URL pública:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).publicUrl}</code></p>
                <p><strong>Marketplace:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).marketplace}</code></p>
                <p><strong>Favoritos:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).favorites}</code></p>
                <p><strong>Login:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).login}</code></p>
                <p><strong>Dashboard:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).dashboard}</code></p>
              </div>
              {pkg.adminEmail ? (
                <div className="border-t pt-2 mt-2 space-y-1">
                  <p><strong>Email admin:</strong> {pkg.adminEmail}</p>
                  {pkg.adminName && <p><strong>Nombre:</strong> {pkg.adminName}</p>}
                  <p className="text-xs text-muted-foreground">La contraseña no se muestra. Usa "Reset contraseña" si necesitas regenerarla.</p>
                </div>
              ) : (
                <div className="border-t pt-2 mt-2">
                  <p className="text-amber-500 text-sm">No hay admin asignado a esta sucursal.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={copyWelcome} className="flex-1" data-testid="button-copy-resend-welcome">
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button variant="outline" onClick={downloadTxt} className="flex-1" data-testid="button-download-resend-welcome">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialsModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: { branchName: string; branchSlug: string; adminEmail: string; adminPassword: string } | null;
}) {
  const { toast } = useToast();
  if (!data) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const d = data;

  const links = {
    publicUrl: `${origin}/app/${d.branchSlug}`,
    marketplace: `${origin}/explore`,
    favorites: `${origin}/favorites`,
    login: `${origin}/`,
    dashboard: `${origin}/dashboard`,
  };

  function copyWelcome() {
    const text = [
      `Paquete de bienvenida - ${d.branchName}`,
      ``,
      `URLs importantes:`,
      `  Página pública (para clientes): ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login (admin): ${links.login}`,
      `  Dashboard (requiere login): ${links.dashboard}`,
      ``,
      `Credenciales del administrador:`,
      `  Email: ${d.adminEmail}`,
      `  Contraseña: ${d.adminPassword}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Paquete de bienvenida copiado" });
  }

  function downloadTxt() {
    const text = [
      `Paquete de bienvenida - ${d.branchName}`,
      `==================================`,
      ``,
      `URLs importantes:`,
      `  Página pública: ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login: ${links.login}`,
      `  Dashboard: ${links.dashboard}`,
      ``,
      `Credenciales del administrador:`,
      `  Email: ${d.adminEmail}`,
      `  Contraseña: ${d.adminPassword}`,
      ``,
      `==================================`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bienvenida-${d.branchSlug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sucursal creada exitosamente</DialogTitle>
          <DialogDescription>Guarda esta información antes de cerrar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
            <p className="font-semibold">{d.branchName}</p>
            <div className="space-y-1 pt-1">
              <p><strong>URL pública:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.publicUrl}</code></p>
              <p><strong>Marketplace:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.marketplace}</code></p>
              <p><strong>Favoritos:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.favorites}</code></p>
              <p><strong>Login (admin):</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.login}</code></p>
              <p><strong>Dashboard:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.dashboard}</code></p>
            </div>
            <div className="border-t pt-2 mt-2 space-y-1">
              <p><strong>Email admin:</strong> {d.adminEmail}</p>
              <p><strong>Contraseña:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{d.adminPassword}</code></p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={copyWelcome} className="flex-1" data-testid="button-copy-welcome">
              <Copy className="h-4 w-4 mr-2" />
              Copiar paquete de bienvenida
            </Button>
            <Button variant="outline" onClick={downloadTxt} className="flex-1" data-testid="button-download-credentials">
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateBranchDialog() {
  const [open, setOpen] = useState(false);
  const [createAdmin, setCreateAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [category, setCategory] = useState("box");
  const [credentials, setCredentials] = useState<{
    branchName: string;
    branchSlug: string;
    adminEmail: string;
    adminPassword: string;
  } | null>(null);
  const { toast } = useToast();

  const form = useForm<CreateBranchFormData>({
    resolver: zodResolver(createBranchFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      category: "box",
      subcategory: "",
      searchKeywords: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateBranchFormData) => {
      const body: any = {
        name: data.name,
        slug: data.slug,
        category,
        subcategory: data.subcategory?.trim() || undefined,
        searchKeywords: data.searchKeywords?.trim() || undefined,
        createAdmin,
      };
      if (createAdmin) {
        body.adminEmail = adminEmail;
        body.adminPassword = adminPassword;
        body.adminName = adminName || `Admin ${data.name}`;
      }
      const resp = await apiRequest("POST", "/api/branches", body);
      return resp.json();
    },
    onSuccess: (result) => {
      invalidateBranches();
      if (result.admin) {
        setCredentials({
          branchName: result.branch.name,
          branchSlug: result.branch.slug,
          adminEmail: result.admin.email,
          adminPassword: result.admin.password,
        });
      } else {
        toast({ title: "Sucursal creada" });
      }
      form.reset({
        name: "",
        slug: "",
        category: "box",
        subcategory: "",
        searchKeywords: "",
      });
      setAdminEmail("");
      setAdminPassword("");
      setAdminName("");
      setCreateAdmin(false);
      setCategory("box");
      setOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("409")
          ? "Ese slug o correo ya existe"
          : "No se pudo crear la sucursal",
        variant: "destructive",
      });
    },
  });

  function handleNameChange(name: string) {
    form.setValue("name", name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    form.setValue("slug", slug);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="button-create-branch">
            <Plus className="h-4 w-4 mr-2" />
            Nueva sucursal
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear nueva sucursal</DialogTitle>
            <DialogDescription>Completa los datos de la nueva sucursal.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Box Central"
                        data-testid="input-branch-name"
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="box-central" data-testid="input-branch-slug" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label className="text-sm font-medium">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCH_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                control={form.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategoria o especialidad</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={getSubcategoryPlaceholder(category)}
                        data-testid="input-branch-subcategory"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Opcional. Ayuda a identificar mejor el tipo de servicio del negocio.
                    </p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="searchKeywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Palabras clave de busqueda</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={BRANCH_SEARCH_KEYWORDS_PLACEHOLDER}
                        data-testid="input-branch-search-keywords"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Opcional. Separa las palabras con comas para mejorar la busqueda.
                    </p>
                  </FormItem>
                )}
              />

              <div className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Crear administrador</Label>
                  <Switch
                    checked={createAdmin}
                    onCheckedChange={setCreateAdmin}
                    data-testid="switch-create-admin"
                  />
                </div>

                {createAdmin && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <Label className="text-sm">Nombre del admin</Label>
                      <Input
                        placeholder="Juan Pérez"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="mt-1"
                        data-testid="input-admin-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Email del admin</Label>
                      <Input
                        type="email"
                        placeholder="admin@sucursal.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="mt-1"
                        data-testid="input-admin-email"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Contraseña</Label>
                      <div className="flex gap-1 mt-1">
                        <div className="relative flex-1">
                          <Input
                            type={showPw ? "text" : "password"}
                            placeholder="Dejar vacío para autogenerar"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            data-testid="input-admin-password"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-0 top-0"
                            onClick={() => setShowPw(!showPw)}
                          >
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
                            let pw = "";
                            for (let i = 0; i < 14; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
                            setAdminPassword(pw);
                            setShowPw(true);
                          }}
                          data-testid="button-generate-password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-branch">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending || (createAdmin && !adminEmail)}
                  data-testid="button-submit-branch"
                >
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <CredentialsModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        data={credentials}
      />
    </>
  );
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_BRANCH: "Crear sucursal",
  UPDATE_STATUS: "Cambiar estado",
  DELETE_BRANCH: "Eliminar sucursal",
  RESET_ADMIN_PASSWORD: "Reset contraseña",
  UPDATE_ADMIN: "Editar admin",
  REASSIGN_ADMIN: "Reasignar admin",
  CREATE_ADMIN: "Crear admin",
  IMPERSONATE_START: "Iniciar soporte",
  IMPERSONATE_END: "Fin soporte",
};

function AuditLogPanel() {
  const { data: logs, isLoading } = useQuery<(AuditLog & { actorEmail?: string | null })[]>({
    queryKey: ["/api/superadmin/audit"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-start">
            <Skeleton className="w-8 h-8 rounded-md" />
            <div className="space-y-1 flex-1"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No hay actividad registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {logs.map((log) => {
        const meta = (log.metadata || {}) as Record<string, any>;
        let detail = "";
        if (meta.branchName) detail = meta.branchName;
        if (meta.oldStatus && meta.newStatus) detail = `${meta.oldStatus} → ${meta.newStatus}`;
        if (meta.adminEmail) detail = meta.adminEmail;
        if (meta.newEmail) detail = `${meta.oldEmail} → ${meta.newEmail}`;

        return (
          <div key={log.id} className="flex gap-3 items-start p-2 rounded-md hover-elevate" data-testid={`audit-log-${log.id}`}>
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0">
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{ACTION_LABELS[log.action] || log.action}</Badge>
                {detail && <span className="text-xs text-muted-foreground truncate">{detail}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {log.actorEmail} &middot;{" "}
                {new Date(log.createdAt).toLocaleString("es-MX", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SystemEventsPanel() {
  const { data: events, isLoading } = useQuery<SystemEventRow[]>({
    queryKey: ["/api/superadmin/system-events"],
    queryFn: async () => {
      const resp = await fetch("/api/superadmin/system-events?limit=30", { credentials: "include" });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      return resp.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-start">
            <Skeleton className="w-8 h-8 rounded-md" />
            <div className="space-y-1 flex-1"><Skeleton className="h-4 w-44" /><Skeleton className="h-3 w-32" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No hay eventos del sistema todavia</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[420px] overflow-y-auto">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3 items-start p-2 rounded-md hover-elevate" data-testid={`system-event-${event.id}`}>
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0">
            <History className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{systemEventLabel(event.eventType)}</Badge>
              <Badge variant={event.status === "processed" ? "default" : "outline"} className="text-xs">
                {event.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(event.branchName || "Global")} &middot; {(event.userEmail || event.userName || "Sin usuario")}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatShortDateTime(event.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatJsonTextarea(value: any) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

const FRIENDLY_CATALOG_SETTINGS: Record<string, {
  title: string;
  description: string;
  fieldLabel: string;
  min?: number;
  step?: number;
}> = {
  "search.default_radius_km": {
    title: "Radio default",
    description: "Cuando alguien usa “Cerca de mí”, se buscarán negocios dentro de este radio inicial.",
    fieldLabel: "Kilómetros por defecto",
    min: 1,
    step: 1,
  },
  "search.max_radius_km": {
    title: "Radio máximo",
    description: "Evita búsquedas demasiado grandes y lentas al limitar el alcance máximo.",
    fieldLabel: "Kilómetros máximos",
    min: 1,
    step: 1,
  },
  "search.suggestions_limit": {
    title: "Límite de sugerencias",
    description: "Cantidad máxima de sugerencias visibles mientras la persona escribe en el buscador.",
    fieldLabel: "Número de sugerencias",
    min: 1,
    step: 1,
  },
};

function getSettingNumericValue(item: AppSettingRow): string {
  const raw = item.valueJson;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (raw && typeof raw === "object") {
    if (typeof raw.km === "number" && Number.isFinite(raw.km)) {
      return String(raw.km);
    }
    if (typeof raw.value === "number" && Number.isFinite(raw.value)) {
      return String(raw.value);
    }
  }
  return "";
}

function buildNumericSettingPayload(item: AppSettingRow, numericValue: number) {
  const raw = item.valueJson;
  if (typeof raw === "number") {
    return numericValue;
  }
  if (raw && typeof raw === "object") {
    if ("km" in raw) {
      return { ...raw, km: numericValue };
    }
    if ("value" in raw) {
      return { ...raw, value: numericValue };
    }
    return { ...raw, value: numericValue };
  }
  return { value: numericValue };
}

function EmptyCatalogState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ExecutiveMetricCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: number;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function CatalogCategoryEditor({ item }: { item: CatalogCategoryRow }) {
  const { toast } = useToast();
  const [label, setLabel] = useState(item.label);
  const [icon, setIcon] = useState(item.icon || "");
  const [displayOrder, setDisplayOrder] = useState(String(item.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(item.isActive);

  useEffect(() => {
    setLabel(item.label);
    setIcon(item.icon || "");
    setDisplayOrder(String(item.displayOrder ?? 0));
    setIsActive(item.isActive);
  }, [item.key, item.label, item.icon, item.displayOrder, item.isActive]);

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("PATCH", `/api/superadmin/catalog/categories/${encodeURIComponent(item.key)}`, {
        label,
        icon: icon.trim() || null,
        displayOrder: Number(displayOrder || 0),
        isActive,
      });
      return resp.json();
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Categoría actualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar la categoría"), variant: "destructive" });
    },
  });

  return (
    <div className="rounded-2xl border bg-background/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wide">
              {item.key}
            </Badge>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Edita la etiqueta visible, el icono y el orden del catálogo global.</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-xs text-muted-foreground">Visible</span>
          </div>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_120px]">
        <div className="space-y-2">
          <Label>Etiqueta</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Doctor / Clínica" />
        </div>
        <div className="space-y-2">
          <Label>Ícono</Label>
          <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="stethoscope" />
        </div>
        <div className="space-y-2">
          <Label>Orden</Label>
          <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder="0" />
        </div>
      </div>
    </div>
  );
}

function CatalogSubcategoryEditor({
  item,
  categories,
}: {
  item: CatalogSubcategoryRow;
  categories: CatalogCategoryRow[];
}) {
  const { toast } = useToast();
  const [label, setLabel] = useState(item.label);
  const [categoryKey, setCategoryKey] = useState(item.categoryKey);
  const [displayOrder, setDisplayOrder] = useState(String(item.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(item.isActive);

  useEffect(() => {
    setLabel(item.label);
    setCategoryKey(item.categoryKey);
    setDisplayOrder(String(item.displayOrder ?? 0));
    setIsActive(item.isActive);
  }, [item.id, item.label, item.categoryKey, item.displayOrder, item.isActive]);

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("PATCH", `/api/superadmin/catalog/subcategories/${item.id}`, {
        categoryKey,
        label,
        displayOrder: Number(displayOrder || 0),
        isActive,
      });
      return resp.json();
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Subcategoría actualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar la subcategoría"), variant: "destructive" });
    },
  });

  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1.1fr_1fr_120px_120px_auto]">
      <Select value={categoryKey} onValueChange={setCategoryKey}>
        <SelectTrigger>
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.key} value={category.key}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Subcategoría" />
      <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder="Orden" />
      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <span className="text-xs text-muted-foreground">Activa</span>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

function CatalogSettingEditor({ item }: { item: AppSettingRow }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(formatJsonTextarea(item.valueJson));

  useEffect(() => {
    setDraft(formatJsonTextarea(item.valueJson));
  }, [item.key, item.updatedAt, item.valueJson]);

  const mutation = useMutation({
    mutationFn: async () => {
      let parsed: any;
      try {
        parsed = JSON.parse(draft);
      } catch {
        throw new Error("El JSON no es válido");
      }
      const resp = await apiRequest("PATCH", `/api/superadmin/settings/${encodeURIComponent(item.key)}`, {
        valueJson: parsed,
        scope: item.scope,
      });
      return resp.json();
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Setting actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo guardar el setting"), variant: "destructive" });
    },
  });

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{item.key}</p>
          <p className="text-xs text-muted-foreground">Scope: {item.scope} · Actualizado {formatShortDateTime(item.updatedAt)}</p>
        </div>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        className="font-mono text-xs"
      />
    </div>
  );
}

function CatalogPanel() {
  const { toast } = useToast();
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState("0");

  const [newSubcategoryCategoryKey, setNewSubcategoryCategoryKey] = useState("");
  const [newSubcategoryLabel, setNewSubcategoryLabel] = useState("");
  const [newSubcategoryOrder, setNewSubcategoryOrder] = useState("0");

  const [newKeywordCategoryKey, setNewKeywordCategoryKey] = useState("");
  const [newKeywordSubcategoryId, setNewKeywordSubcategoryId] = useState("");
  const [newKeywordValue, setNewKeywordValue] = useState("");

  const { data: categories, isLoading: categoriesLoading } = useQuery<CatalogCategoryRow[]>({
    queryKey: ["/api/superadmin/catalog/categories"],
    queryFn: () => fetchJson("/api/superadmin/catalog/categories"),
  });

  const { data: subcategories, isLoading: subcategoriesLoading } = useQuery<CatalogSubcategoryRow[]>({
    queryKey: ["/api/superadmin/catalog/subcategories"],
    queryFn: () => fetchJson("/api/superadmin/catalog/subcategories"),
  });

  const { data: keywords, isLoading: keywordsLoading } = useQuery<CatalogKeywordRow[]>({
    queryKey: ["/api/superadmin/catalog/keywords"],
    queryFn: () => fetchJson("/api/superadmin/catalog/keywords"),
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<AppSettingRow[]>({
    queryKey: ["/api/superadmin/settings"],
    queryFn: () => fetchJson("/api/superadmin/settings"),
  });

  const { data: metrics } = useQuery<SearchMetricsResponse>({
    queryKey: ["/api/superadmin/search-metrics"],
    queryFn: () => fetchJson("/api/superadmin/search-metrics?limit=8"),
  });

  const { data: platformMetrics } = useQuery<PlatformMetricsResponse>({
    queryKey: ["/api/superadmin/platform-metrics"],
    queryFn: () => fetchJson("/api/superadmin/platform-metrics"),
  });

  const { data: searchLogs } = useQuery<SearchLogRecord[]>({
    queryKey: ["/api/superadmin/search-logs"],
    queryFn: () => fetchJson("/api/superadmin/search-logs?limit=20"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/superadmin/catalog/categories", {
        key: newCategoryKey.trim(),
        label: newCategoryLabel.trim(),
        icon: newCategoryIcon.trim() || null,
        displayOrder: Number(newCategoryOrder || 0),
      });
      return resp.json();
    },
    onSuccess: () => {
      setNewCategoryKey("");
      setNewCategoryLabel("");
      setNewCategoryIcon("");
      setNewCategoryOrder("0");
      invalidateCatalog();
      toast({ title: "Categoría creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo crear la categoría"), variant: "destructive" });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/superadmin/catalog/subcategories", {
        categoryKey: newSubcategoryCategoryKey,
        label: newSubcategoryLabel.trim(),
        displayOrder: Number(newSubcategoryOrder || 0),
      });
      return resp.json();
    },
    onSuccess: () => {
      setNewSubcategoryLabel("");
      setNewSubcategoryOrder("0");
      invalidateCatalog();
      toast({ title: "Subcategoría creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo crear la subcategoría"), variant: "destructive" });
    },
  });

  const createKeywordMutation = useMutation({
    mutationFn: async () => {
      const resolvedCategoryKey =
        newKeywordCategoryKey ||
        subcategories?.find((subcategory) => subcategory.id === newKeywordSubcategoryId)?.categoryKey ||
        null;

      const resp = await apiRequest("POST", "/api/superadmin/catalog/keywords", {
        categoryKey: resolvedCategoryKey,
        subcategoryId: newKeywordSubcategoryId || null,
        keyword: newKeywordValue.trim(),
        kind: "alias",
      });
      return resp.json();
    },
    onSuccess: () => {
      setNewKeywordValue("");
      setNewKeywordSubcategoryId("");
      invalidateCatalog();
      toast({ title: "Keyword creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo crear la keyword"), variant: "destructive" });
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      await apiRequest("DELETE", `/api/superadmin/catalog/keywords/${keywordId}`);
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Keyword eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo eliminar la keyword"), variant: "destructive" });
    },
  });

  const availableSubcategories = (subcategories || []).filter((subcategory) =>
    newKeywordCategoryKey ? subcategory.categoryKey === newKeywordCategoryKey : true,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Categorías</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Input value={newCategoryKey} onChange={(e) => setNewCategoryKey(e.target.value)} placeholder="Clave" />
              <Input value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)} placeholder="Etiqueta" />
              <Input value={newCategoryIcon} onChange={(e) => setNewCategoryIcon(e.target.value)} placeholder="Icono" />
              <div className="flex gap-2">
                <Input type="number" value={newCategoryOrder} onChange={(e) => setNewCategoryOrder(e.target.value)} placeholder="Orden" />
                <Button
                  onClick={() => createCategoryMutation.mutate()}
                  disabled={createCategoryMutation.isPending || !newCategoryKey.trim() || !newCategoryLabel.trim()}
                >
                  {createCategoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="h-4 w-4 mr-2" />
                  Crear
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {categoriesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                (categories || []).map((item) => <CatalogCategoryEditor key={item.key} item={item} />)
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Subcategorías</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Select value={newSubcategoryCategoryKey} onValueChange={setNewSubcategoryCategoryKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {(categories || []).map((category) => (
                    <SelectItem key={category.key} value={category.key}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={newSubcategoryLabel} onChange={(e) => setNewSubcategoryLabel(e.target.value)} placeholder="Subcategoría" />
              <Input type="number" value={newSubcategoryOrder} onChange={(e) => setNewSubcategoryOrder(e.target.value)} placeholder="Orden" />
              <Button
                onClick={() => createSubcategoryMutation.mutate()}
                disabled={createSubcategoryMutation.isPending || !newSubcategoryCategoryKey || !newSubcategoryLabel.trim()}
              >
                {createSubcategoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="h-4 w-4 mr-2" />
                Crear
              </Button>
            </div>
            <div className="space-y-3">
              {subcategoriesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                (subcategories || []).map((item) => (
                  <CatalogSubcategoryEditor key={item.id} item={item} categories={categories || []} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Keywords</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                value={newKeywordCategoryKey || "all"}
                onValueChange={(value) => {
                  const next = value === "all" ? "" : value;
                  setNewKeywordCategoryKey(next);
                  if (newKeywordSubcategoryId) {
                    const current = subcategories?.find((subcategory) => subcategory.id === newKeywordSubcategoryId);
                    if (current && next && current.categoryKey !== next) {
                      setNewKeywordSubcategoryId("");
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoría opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(categories || []).map((category) => (
                    <SelectItem key={category.key} value={category.key}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newKeywordSubcategoryId || "none"} onValueChange={(value) => setNewKeywordSubcategoryId(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Subcategoría opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin subcategoría</SelectItem>
                  {availableSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={newKeywordValue} onChange={(e) => setNewKeywordValue(e.target.value)} placeholder="Ej. nutriologo" />
              <Button
                onClick={() => createKeywordMutation.mutate()}
                disabled={createKeywordMutation.isPending || !newKeywordValue.trim() || (!newKeywordCategoryKey && !newKeywordSubcategoryId)}
              >
                {createKeywordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="h-4 w-4 mr-2" />
                Crear
              </Button>
            </div>
            <div className="space-y-2">
              {keywordsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                (keywords || []).map((keyword) => (
                  <div key={keyword.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{keyword.keyword}</Badge>
                        <Badge variant="outline">{keyword.kind}</Badge>
                        {keyword.categoryLabel && <Badge variant="outline">{keyword.categoryLabel}</Badge>}
                        {keyword.subcategoryLabel && <Badge variant="outline">{keyword.subcategoryLabel}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Normalizado: {keyword.normalizedKeyword} · {formatShortDate(keyword.createdAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteKeywordMutation.mutate(keyword.id)}
                      disabled={deleteKeywordMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Settings básicos</h2>
            </div>
            <div className="space-y-3">
              {settingsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                (settings || []).map((setting) => (
                  <CatalogSettingEditor key={setting.key} item={setting} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Métricas de búsqueda</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-3">Términos más buscados</p>
              <div className="space-y-2">
                {(metrics?.topQueries || []).length > 0 ? (
                  metrics?.topQueries.map((item) => (
                    <div key={item.query} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{item.query}</span>
                      <Badge variant="secondary">{item.total}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-3">Búsquedas sin resultados</p>
              <div className="space-y-2">
                {(metrics?.zeroResultQueries || []).length > 0 ? (
                  metrics?.zeroResultQueries.map((item) => (
                    <div key={item.query} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{item.query}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.total}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => setNewKeywordValue(item.query)}>
                          Usar como keyword
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-3">Categorías más buscadas</p>
              <div className="space-y-2">
                {(metrics?.topCategories || []).length > 0 ? (
                  metrics?.topCategories.map((item) => (
                    <div key={item.category} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{getCategoryLabel(item.category)}</span>
                      <Badge>{item.total}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Usuarios app</p>
              <p className="text-xl font-semibold">{platformMetrics?.totalAppUsers ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sucursales activas</p>
              <p className="text-xl font-semibold">{platformMetrics?.activeBranches ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Búsquedas</p>
              <p className="text-xl font-semibold">{platformMetrics?.totalSearches ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sin resultados</p>
              <p className="text-xl font-semibold">{platformMetrics?.zeroResultSearches ?? 0}</p>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-3">Últimas búsquedas</p>
            <div className="space-y-2">
              {(searchLogs || []).length > 0 ? (
                searchLogs?.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {log.queryRaw || log.category || log.subcategory || "Búsqueda sin texto"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.source} · {log.resultCount} resultado(s) · {log.userEmail || "Anónimo"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{formatShortDateTime(log.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay búsquedas registradas.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CatalogSubcategoryCardEditor({
  item,
  categories,
}: {
  item: CatalogSubcategoryRow;
  categories: CatalogCategoryRow[];
}) {
  const { toast } = useToast();
  const [label, setLabel] = useState(item.label);
  const [categoryKey, setCategoryKey] = useState(item.categoryKey);
  const [displayOrder, setDisplayOrder] = useState(String(item.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(item.isActive);

  useEffect(() => {
    setLabel(item.label);
    setCategoryKey(item.categoryKey);
    setDisplayOrder(String(item.displayOrder ?? 0));
    setIsActive(item.isActive);
  }, [item.id, item.label, item.categoryKey, item.displayOrder, item.isActive]);

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("PATCH", `/api/superadmin/catalog/subcategories/${item.id}`, {
        categoryKey,
        label,
        displayOrder: Number(displayOrder || 0),
        isActive,
      });
      return resp.json();
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Subcategoría actualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar la subcategoría"), variant: "destructive" });
    },
  });

  return (
    <div className="rounded-2xl border bg-background/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {item.categoryLabel && <Badge variant="outline">{item.categoryLabel}</Badge>}
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Organiza especialidades y controla el orden en que aparecen para búsqueda.</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-xs text-muted-foreground">Visible</span>
          </div>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.25fr)_120px]">
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={categoryKey} onValueChange={setCategoryKey}>
            <SelectTrigger>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.key} value={category.key}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Subcategoría</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nutriólogo" />
        </div>
        <div className="space-y-2">
          <Label>Orden</Label>
          <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder="0" />
        </div>
      </div>
    </div>
  );
}

function CatalogSettingFriendlyEditor({ item }: { item: AppSettingRow }) {
  const { toast } = useToast();
  const copy = FRIENDLY_CATALOG_SETTINGS[item.key];
  const [draft, setDraft] = useState(getSettingNumericValue(item));

  useEffect(() => {
    setDraft(getSettingNumericValue(item));
  }, [item.key, item.updatedAt, item.valueJson]);

  const mutation = useMutation({
    mutationFn: async () => {
      const numericValue = Number(draft);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        throw new Error("Ingresa un número válido mayor a cero");
      }

      const resp = await apiRequest("PATCH", `/api/superadmin/settings/${encodeURIComponent(item.key)}`, {
        valueJson: buildNumericSettingPayload(item, numericValue),
        scope: item.scope,
      });
      return resp.json();
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Configuración guardada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo guardar la configuración"), variant: "destructive" });
    },
  });

  if (!copy) {
    return <CatalogSettingEditor item={item} />;
  }

  return (
    <div className="rounded-2xl border bg-background/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{copy.title}</p>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
          <p className="text-xs text-muted-foreground">Actualizado {formatShortDateTime(item.updatedAt)}</p>
        </div>
        <Badge variant="outline">{item.scope}</Badge>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label>{copy.fieldLabel}</Label>
          <Input
            type="number"
            min={copy.min}
            step={copy.step ?? 1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0"
          />
        </div>
        <Button className="sm:min-w-[150px]" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar cambio
        </Button>
      </div>
    </div>
  );
}

function CatalogExecutivePanel() {
  const { toast } = useToast();
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState("0");

  const [newSubcategoryCategoryKey, setNewSubcategoryCategoryKey] = useState("");
  const [newSubcategoryLabel, setNewSubcategoryLabel] = useState("");
  const [newSubcategoryOrder, setNewSubcategoryOrder] = useState("0");

  const [newKeywordCategoryKey, setNewKeywordCategoryKey] = useState("");
  const [newKeywordSubcategoryId, setNewKeywordSubcategoryId] = useState("");
  const [newKeywordValue, setNewKeywordValue] = useState("");

  const { data: categories, isLoading: categoriesLoading } = useQuery<CatalogCategoryRow[]>({
    queryKey: ["/api/superadmin/catalog/categories"],
    queryFn: () => fetchJson("/api/superadmin/catalog/categories"),
  });

  const { data: subcategories, isLoading: subcategoriesLoading } = useQuery<CatalogSubcategoryRow[]>({
    queryKey: ["/api/superadmin/catalog/subcategories"],
    queryFn: () => fetchJson("/api/superadmin/catalog/subcategories"),
  });

  const { data: keywords, isLoading: keywordsLoading } = useQuery<CatalogKeywordRow[]>({
    queryKey: ["/api/superadmin/catalog/keywords"],
    queryFn: () => fetchJson("/api/superadmin/catalog/keywords"),
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<AppSettingRow[]>({
    queryKey: ["/api/superadmin/settings"],
    queryFn: () => fetchJson("/api/superadmin/settings"),
  });

  const { data: metrics } = useQuery<SearchMetricsResponse>({
    queryKey: ["/api/superadmin/search-metrics"],
    queryFn: () => fetchJson("/api/superadmin/search-metrics?limit=8"),
  });

  const { data: platformMetrics } = useQuery<PlatformMetricsResponse>({
    queryKey: ["/api/superadmin/platform-metrics"],
    queryFn: () => fetchJson("/api/superadmin/platform-metrics"),
  });

  const { data: searchLogs } = useQuery<SearchLogRecord[]>({
    queryKey: ["/api/superadmin/search-logs"],
    queryFn: () => fetchJson("/api/superadmin/search-logs?limit=20"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/superadmin/catalog/categories", {
        key: newCategoryKey.trim(),
        label: newCategoryLabel.trim(),
        icon: newCategoryIcon.trim() || null,
        displayOrder: Number(newCategoryOrder || 0),
      });
      return resp.json();
    },
    onSuccess: () => {
      setNewCategoryKey("");
      setNewCategoryLabel("");
      setNewCategoryIcon("");
      setNewCategoryOrder("0");
      invalidateCatalog();
      toast({ title: "Categoría creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo crear la categoría"), variant: "destructive" });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/superadmin/catalog/subcategories", {
        categoryKey: newSubcategoryCategoryKey,
        label: newSubcategoryLabel.trim(),
        displayOrder: Number(newSubcategoryOrder || 0),
      });
      return resp.json();
    },
    onSuccess: () => {
      setNewSubcategoryLabel("");
      setNewSubcategoryOrder("0");
      invalidateCatalog();
      toast({ title: "Subcategoría creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo crear la subcategoría"), variant: "destructive" });
    },
  });

  const createKeywordMutation = useMutation({
    mutationFn: async () => {
      const resolvedCategoryKey =
        newKeywordCategoryKey ||
        subcategories?.find((subcategory) => subcategory.id === newKeywordSubcategoryId)?.categoryKey ||
        null;

      const resp = await apiRequest("POST", "/api/superadmin/catalog/keywords", {
        categoryKey: resolvedCategoryKey,
        subcategoryId: newKeywordSubcategoryId || null,
        keyword: newKeywordValue.trim(),
        kind: "alias",
      });
      return resp.json();
    },
    onSuccess: () => {
      setNewKeywordValue("");
      setNewKeywordSubcategoryId("");
      invalidateCatalog();
      toast({ title: "Keyword creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo crear la keyword"), variant: "destructive" });
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      await apiRequest("DELETE", `/api/superadmin/catalog/keywords/${keywordId}`);
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Keyword eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo eliminar la keyword"), variant: "destructive" });
    },
  });

  const categoriesList = categories || [];
  const subcategoriesList = subcategories || [];
  const keywordsList = keywords || [];
  const availableSubcategories = subcategoriesList.filter((subcategory) =>
    newKeywordCategoryKey ? subcategory.categoryKey === newKeywordCategoryKey : true,
  );
  const categoryGroups = categoriesList.map((category) => ({
    category,
    items: subcategoriesList.filter((subcategory) => subcategory.categoryKey === category.key),
  }));
  const friendlySettingKeys = Object.keys(FRIENDLY_CATALOG_SETTINGS);
  const friendlySettings = (settings || []).filter((item) => friendlySettingKeys.includes(item.key));
  const advancedSettings = (settings || []).filter((item) => !friendlySettingKeys.includes(item.key));

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                <CardTitle className="text-2xl">Catálogo</CardTitle>
              </div>
              <CardDescription className="max-w-3xl">
                Administra categorías, subcategorías, keywords y parámetros de búsqueda desde un panel más claro para operación diaria.
              </CardDescription>
            </div>
            <Badge variant="outline" className="self-start px-3 py-1 text-xs">
              Solo UI · misma lógica
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ExecutiveMetricCard
            title="Búsquedas totales"
            value={platformMetrics?.totalSearches ?? 0}
            helper="Actividad acumulada en app y web."
            icon={Search}
          />
          <ExecutiveMetricCard
            title="Sin resultados"
            value={platformMetrics?.zeroResultSearches ?? 0}
            helper="Consultas que hoy no encuentran oferta."
            icon={BarChart3}
          />
          <ExecutiveMetricCard
            title="Usuarios app"
            value={platformMetrics?.totalAppUsers ?? 0}
            helper="Clientes finales registrados."
            icon={Users}
          />
          <ExecutiveMetricCard
            title="Sucursales activas"
            value={platformMetrics?.activeBranches ?? 0}
            helper="Negocios visibles actualmente."
            icon={Building2}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Categorías</CardTitle>
              <CardDescription>Organiza el catálogo principal que usa Super Admin y sirve como base para búsqueda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-medium">Crear categoría</p>
                    <p className="text-sm text-muted-foreground">Usa una clave corta, una etiqueta visible y el orden deseado.</p>
                  </div>
                  <Badge variant="secondary">{categoriesList.length} registradas</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_120px_auto]">
                  <div className="space-y-2">
                    <Label>Clave</Label>
                    <Input value={newCategoryKey} onChange={(e) => setNewCategoryKey(e.target.value)} placeholder="doctor" />
                  </div>
                  <div className="space-y-2">
                    <Label>Etiqueta</Label>
                    <Input value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)} placeholder="Doctor / Clínica" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ícono</Label>
                    <Input value={newCategoryIcon} onChange={(e) => setNewCategoryIcon(e.target.value)} placeholder="stethoscope" />
                  </div>
                  <div className="space-y-2">
                    <Label>Orden</Label>
                    <Input type="number" value={newCategoryOrder} onChange={(e) => setNewCategoryOrder(e.target.value)} placeholder="0" />
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="w-full xl:w-auto"
                      onClick={() => createCategoryMutation.mutate()}
                      disabled={createCategoryMutation.isPending || !newCategoryKey.trim() || !newCategoryLabel.trim()}
                    >
                      {createCategoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Plus className="mr-2 h-4 w-4" />
                      Crear categoría
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {categoriesLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : categoriesList.length > 0 ? (
                  categoriesList.map((item) => <CatalogCategoryEditor key={item.key} item={item} />)
                ) : (
                  <EmptyCatalogState
                    title="Todavía no hay categorías"
                    description="Crea la primera categoría para empezar a ordenar el catálogo global."
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Subcategorías</CardTitle>
              <CardDescription>Las subcategorías son especialidades visibles para los usuarios y ayudan a que el catálogo sea más preciso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border bg-muted/20 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">Crear subcategoría</p>
                    <p className="text-sm text-muted-foreground">Elige la categoría padre, escribe la especialidad y define su orden visual.</p>
                  </div>
                  <Badge variant="secondary">{subcategoriesList.length} registradas</Badge>
                </div>

                <div className="mt-4 rounded-xl border bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ejemplos rápidos</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">Doctor → Ginecólogo</Badge>
                    <Badge variant="outline">Gym → Natación</Badge>
                    <Badge variant="outline">Estética → Uñas</Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.45fr)_110px_auto]">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={newSubcategoryCategoryKey} onValueChange={setNewSubcategoryCategoryKey}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesList.map((category) => (
                          <SelectItem key={category.key} value={category.key}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subcategoría</Label>
                    <Input
                      className="h-11"
                      value={newSubcategoryLabel}
                      onChange={(e) => setNewSubcategoryLabel(e.target.value)}
                      placeholder="Nutriólogo, Uñas, Arquitecto..."
                    />
                  </div>
                  <div className="space-y-2 lg:max-w-[110px]">
                    <Label>Orden</Label>
                    <Input className="h-11" type="number" value={newSubcategoryOrder} onChange={(e) => setNewSubcategoryOrder(e.target.value)} placeholder="0" />
                  </div>
                  <div className="flex items-end lg:justify-end">
                    <Button
                      className="h-11 w-full lg:min-w-[180px]"
                      onClick={() => createSubcategoryMutation.mutate()}
                      disabled={createSubcategoryMutation.isPending || !newSubcategoryCategoryKey || !newSubcategoryLabel.trim()}
                    >
                      {createSubcategoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Plus className="mr-2 h-4 w-4" />
                      Crear subcategoría
                    </Button>
                  </div>
                </div>
              </div>

              {subcategoriesLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : categoryGroups.some((group) => group.items.length > 0) ? (
                <div className="space-y-4">
                  {categoryGroups.map(({ category, items }) => {
                    if (items.length === 0) return null;
                    return (
                      <div key={category.key} className="rounded-2xl border bg-card/60 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/15 px-4 py-3">
                          <div>
                            <p className="font-medium">{category.label}</p>
                            <p className="text-sm text-muted-foreground">Especialidades visibles ligadas a esta categoría.</p>
                          </div>
                          <Badge variant="outline">{items.length}</Badge>
                        </div>
                        <div className="space-y-3">
                          {items.map((item) => (
                            <CatalogSubcategoryCardEditor key={item.id} item={item} categories={categoriesList} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyCatalogState
                  title="Sin subcategorías todavía"
                  description="Cuando agregues subcategorías, aparecerán agrupadas por categoría para revisarlas más rápido."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Keywords de búsqueda</CardTitle>
              <CardDescription>Las keywords ayudan al buscador a encontrar negocios aunque la persona escriba distinto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border bg-muted/20 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">Crear keyword</p>
                    <p className="text-sm text-muted-foreground">Relaciona palabras con categorías o subcategorías para mejorar sugerencias y búsqueda libre.</p>
                  </div>
                  <Badge variant="secondary">{keywordsList.length} keywords</Badge>
                </div>

                <div className="mt-4 rounded-xl border bg-background/70 p-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subcategoría visible</p>
                      <Badge className="w-fit" variant="secondary">Nutriólogo</Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Keywords internas del buscador</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">nutrición</Badge>
                        <Badge variant="outline">dieta</Badge>
                        <Badge variant="outline">bajar de peso</Badge>
                        <Badge variant="outline">nutriologo</Badge>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    No son visibles públicamente. Solo ayudan a que el buscador encuentre mejor cada negocio.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select
                      value={newKeywordCategoryKey || "all"}
                      onValueChange={(value) => {
                        const next = value === "all" ? "" : value;
                        setNewKeywordCategoryKey(next);
                        if (newKeywordSubcategoryId) {
                          const current = subcategoriesList.find((subcategory) => subcategory.id === newKeywordSubcategoryId);
                          if (current && next && current.categoryKey !== next) {
                            setNewKeywordSubcategoryId("");
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Categoría opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categoriesList.map((category) => (
                          <SelectItem key={category.key} value={category.key}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subcategoría</Label>
                    <Select value={newKeywordSubcategoryId || "none"} onValueChange={(value) => setNewKeywordSubcategoryId(value === "none" ? "" : value)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Subcategoría opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin subcategoría</SelectItem>
                        {availableSubcategories.map((subcategory) => (
                          <SelectItem key={subcategory.id} value={subcategory.id}>
                            {subcategory.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Keyword</Label>
                    <div className="flex flex-col gap-3 lg:flex-row">
                      <Input
                        className="h-11"
                        value={newKeywordValue}
                        onChange={(e) => setNewKeywordValue(e.target.value)}
                        placeholder="Ej. nutriólogo, fisioterapia, natación..."
                      />
                      <Button
                        className="h-11 lg:min-w-[180px]"
                        onClick={() => createKeywordMutation.mutate()}
                        disabled={createKeywordMutation.isPending || !newKeywordValue.trim() || (!newKeywordCategoryKey && !newKeywordSubcategoryId)}
                      >
                        {createKeywordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Plus className="mr-2 h-4 w-4" />
                        Crear keyword
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {keywordsLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : keywordsList.length > 0 ? (
                <div className="space-y-3">
                  {keywordsList.map((keyword) => (
                    <div key={keyword.id} className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-sm">{keyword.keyword}</Badge>
                            <Badge variant="outline">Interna</Badge>
                            {keyword.categoryLabel && <Badge variant="outline">{keyword.categoryLabel}</Badge>}
                            {keyword.subcategoryLabel && <Badge variant="outline">{keyword.subcategoryLabel}</Badge>}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Normalizado: {keyword.normalizedKeyword} · Alta {formatShortDate(keyword.createdAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteKeywordMutation.mutate(keyword.id)}
                          disabled={deleteKeywordMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyCatalogState
                  title="Sin keywords registradas"
                  description="Agrega sinónimos y frases útiles para mejorar los resultados del buscador."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Settings de búsqueda</CardTitle>
              <CardDescription>Controla el alcance y comportamiento del buscador con explicaciones claras para personas no técnicas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <>
                  <div className="space-y-3">
                    {friendlySettings.map((setting) => (
                      <CatalogSettingFriendlyEditor key={setting.key} item={setting} />
                    ))}
                  </div>
                  {advancedSettings.length > 0 && (
                    <Accordion type="single" collapsible className="rounded-2xl border border-dashed px-4">
                      <AccordionItem value="advanced-settings" className="border-b-0">
                        <AccordionTrigger className="py-4 text-left hover:no-underline">
                          <div className="space-y-1">
                            <p className="font-medium">Configuración avanzada</p>
                            <p className="text-sm font-normal text-muted-foreground">Solo modificar si sabes lo que haces.</p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          <div className="rounded-xl border bg-muted/20 p-4">
                            <p className="text-sm font-medium">Radios por categoría</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Permite radios distintos por categoría. Úsalo si una vertical necesita un alcance diferente.
                            </p>
                            <div className="mt-3 rounded-lg bg-background/80 p-3 font-mono text-xs text-muted-foreground">
                              {`{\n  "doctor": 25,\n  "gym": 15\n}`}
                            </div>
                          </div>
                          <div className="space-y-3">
                            {advancedSettings.map((setting) => (
                              <CatalogSettingEditor key={setting.key} item={setting} />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Métricas de búsqueda</CardTitle>
          <CardDescription>Vista ejecutiva para detectar demanda, huecos de catálogo y comportamiento reciente del buscador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Términos más buscados</p>
                  <p className="text-sm text-muted-foreground">Lo que más están intentando encontrar tus usuarios.</p>
                </div>
                <Badge variant="secondary">{metrics?.topQueries.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {(metrics?.topQueries || []).length > 0 ? (
                  metrics?.topQueries.map((item, index) => (
                    <div key={item.query} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 text-sm">
                      <span className="truncate">{index + 1}. {item.query}</span>
                      <Badge variant="secondary">{item.total}</Badge>
                    </div>
                  ))
                ) : (
                  <EmptyCatalogState
                    title="Sin datos todavía"
                    description="Aquí aparecerán los términos con más tracción conforme se registren búsquedas."
                  />
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Búsquedas sin resultados</p>
                  <p className="text-sm text-muted-foreground">Oportunidades para crear nuevas keywords o mejorar catálogo.</p>
                </div>
                <Badge variant="outline">{metrics?.zeroResultQueries.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {(metrics?.zeroResultQueries || []).length > 0 ? (
                  metrics?.zeroResultQueries.map((item) => (
                    <div key={item.query} className="rounded-xl bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{item.query}</span>
                        <Badge variant="outline">{item.total}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 px-0 text-primary hover:bg-transparent"
                        onClick={() => setNewKeywordValue(item.query)}
                      >
                        Usar como keyword
                      </Button>
                    </div>
                  ))
                ) : (
                  <EmptyCatalogState
                    title="Sin pendientes"
                    description="Aún no hay búsquedas fallidas registradas."
                  />
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Categorías más buscadas</p>
                  <p className="text-sm text-muted-foreground">Ayuda a priorizar qué verticales necesitan más detalle.</p>
                </div>
                <Badge>{metrics?.topCategories.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {(metrics?.topCategories || []).length > 0 ? (
                  metrics?.topCategories.map((item, index) => (
                    <div key={item.category} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 text-sm">
                      <span className="truncate">{index + 1}. {getCategoryLabel(item.category)}</span>
                      <Badge>{item.total}</Badge>
                    </div>
                  ))
                ) : (
                  <EmptyCatalogState
                    title="Sin categorías destacadas"
                    description="Todavía no hay suficiente volumen para mostrar tendencias por categoría."
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/70 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Últimas búsquedas</p>
                <p className="text-sm text-muted-foreground">Rastreo reciente para validar qué se buscó, desde dónde y cuántos resultados devolvió.</p>
              </div>
              <Badge variant="outline">{searchLogs?.length ?? 0}</Badge>
            </div>
            {(searchLogs || []).length > 0 ? (
              <ScrollArea className="h-[320px] pr-4">
                <div className="space-y-3">
                  {searchLogs?.map((log) => (
                    <div key={log.id} className="rounded-2xl border bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">
                              {log.queryRaw || log.category || log.subcategory || "Búsqueda sin texto"}
                            </p>
                            {log.resultCount === 0 ? (
                              <Badge variant="outline">Sin resultados</Badge>
                            ) : (
                              <Badge variant="secondary">{log.resultCount} resultado(s)</Badge>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {log.source} · {log.userEmail || "Anónimo"}
                            {log.zone ? ` · Zona: ${log.zone}` : ""}
                            {log.selectedBranchName ? ` · Seleccionó: ${log.selectedBranchName}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">{formatShortDateTime(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <EmptyCatalogState
                title="Todavía no hay búsquedas registradas"
                description="Cuando entren búsquedas con texto o categoría, aparecerán aquí para análisis."
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformMetricsPanel() {
  const { data, isLoading } = useQuery<PlatformMetricsResponse>({
    queryKey: ["/api/superadmin/platform-metrics"],
    queryFn: () => fetchJson("/api/superadmin/platform-metrics"),
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Métricas generales</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Usuarios app</p><p className="text-xl font-semibold">{data?.totalAppUsers ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Sucursales activas</p><p className="text-xl font-semibold">{data?.activeBranches ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Búsquedas</p><p className="text-xl font-semibold">{data?.totalSearches ?? 0}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Sin resultados</p><p className="text-xl font-semibold">{data?.zeroResultSearches ?? 0}</p></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-3">Auditoría de reservas</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-muted p-2">Creadas: <span className="font-semibold">{data?.reservationStats.created ?? 0}</span></div>
              <div className="rounded-md bg-muted p-2">Canceladas: <span className="font-semibold">{data?.reservationStats.cancelled ?? 0}</span></div>
              <div className="rounded-md bg-muted p-2">Asistidas: <span className="font-semibold">{data?.reservationStats.attended ?? 0}</span></div>
              <div className="rounded-md bg-muted p-2">No show: <span className="font-semibold">{data?.reservationStats.noShow ?? 0}</span></div>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-3">Sucursales más activas</p>
            <div className="space-y-2">
              {(data?.mostActiveBranches || []).length > 0 ? data?.mostActiveBranches.map((branch) => (
                <div key={branch.branchId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{branch.branchName}</span>
                  <Badge>{branch.totalReservations}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewModerationPanel() {
  const { toast } = useToast();
  const { data: reports, isLoading: reportsLoading } = useQuery<ReviewReportRecord[]>({
    queryKey: ["/api/superadmin/review-reports"],
    queryFn: () => fetchJson("/api/superadmin/review-reports?limit=30"),
  });
  const { data: logs } = useQuery<ReviewModerationLogRecord[]>({
    queryKey: ["/api/superadmin/review-moderation-logs"],
    queryFn: () => fetchJson("/api/superadmin/review-moderation-logs?limit=30"),
  });
  const { data: blockedUsers } = useQuery<BlockedUserRecord[]>({
    queryKey: ["/api/superadmin/blocked-users"],
    queryFn: () => fetchJson("/api/superadmin/blocked-users"),
  });

  const reportStatusMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/superadmin/review-reports/${reportId}/status`, { status });
      return resp.json();
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Reporte actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar el reporte"), variant: "destructive" });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ reviewId, hidden }: { reviewId: string; hidden: boolean }) => {
      const resp = await apiRequest("PATCH", `/api/superadmin/reviews/${reviewId}/visibility`, { hidden });
      return resp.json();
    },
    onSuccess: () => {
      invalidateCatalog();
      toast({ title: "Visibilidad actualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar la reseña"), variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Moderación</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-3">Reseñas reportadas</p>
              {reportsLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : (reports || []).length > 0 ? (
                <div className="space-y-3">
                  {reports?.map((report) => (
                    <div key={report.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{report.branchName || "Sucursal"}</Badge>
                          <Badge variant={report.status === "pending" ? "secondary" : "default"}>{reviewReportStatusLabel(report.status)}</Badge>
                          {typeof report.reviewRating === "number" && <Badge>{report.reviewRating}/5</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatShortDateTime(report.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium">{report.customerName || "Cliente"} · {report.reason}</p>
                      {report.reviewComment && <p className="text-sm text-muted-foreground">{report.reviewComment}</p>}
                      {report.note && <p className="text-xs text-muted-foreground">Nota: {report.note}</p>}
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => reportStatusMutation.mutate({ reportId: report.id, status: "reviewed" })}>Marcar revisado</Button>
                        <Button size="sm" variant="outline" onClick={() => reportStatusMutation.mutate({ reportId: report.id, status: "dismissed" })}>Descartar</Button>
                        <Button size="sm" variant={report.isHidden ? "secondary" : "destructive"} onClick={() => visibilityMutation.mutate({ reviewId: report.reviewId, hidden: !report.isHidden })}>
                          {report.isHidden ? "Mostrar reseña" : "Ocultar reseña"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin reseñas reportadas por ahora.</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-3">Historial de decisiones</p>
              <div className="space-y-2">
                {(logs || []).length > 0 ? logs?.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-3 text-sm border-b pb-2 last:border-b-0">
                    <div className="min-w-0">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.branchName || "Sucursal"} · {log.actorName || "Sistema"}</p>
                      {log.reviewComment && <p className="text-xs text-muted-foreground truncate">{log.reviewComment}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatShortDateTime(log.createdAt)}</span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Sin decisiones registradas.</p>}
              </div>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-3">Usuarios bloqueados</p>
            <div className="space-y-2">
              {(blockedUsers || []).length > 0 ? blockedUsers?.map((user) => (
                <div key={user.id} className="rounded-md bg-muted p-2">
                  <p className="text-sm font-medium">{customerFullName(user)}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.blockedReason || "Sin motivo"} · {formatShortDate(user.blockedAt)}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No hay usuarios bloqueados.</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReservationAuditPanel() {
  const { data, isLoading } = useQuery<ReservationAuditRecord[]>({
    queryKey: ["/api/superadmin/reservation-audit"],
    queryFn: () => fetchJson("/api/superadmin/reservation-audit?limit=40"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Auditoría de reservas</h2>
        </div>
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (data || []).length > 0 ? (
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {data?.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{item.className || "Clase"} · {item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.customerName || "Cliente"} · {item.actorRole} · {item.source}</p>
                  <p className="text-xs text-muted-foreground">{item.bookingDate || "Sin fecha"} {item.reason ? `· ${item.reason}` : ""}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatShortDateTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin movimientos de reservas todavía.</p>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationJobsPanel() {
  const { data, isLoading } = useQuery<NotificationJobRecord[]>({
    queryKey: ["/api/superadmin/notification-jobs"],
    queryFn: () => fetchJson("/api/superadmin/notification-jobs?limit=40"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Jobs internos</h2>
        </div>
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (data || []).length > 0 ? (
          <div className="space-y-2">
            {data?.map((job) => (
              <div key={job.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{job.type}</p>
                  <p className="text-xs text-muted-foreground">Estado: {job.status} · Intentos: {job.attempts}</p>
                  <p className="text-xs text-muted-foreground">Programado: {formatShortDateTime(job.scheduledFor)}</p>
                </div>
                {job.lastError ? <Badge variant="destructive">Con error</Badge> : <Badge variant="secondary">{job.status}</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin jobs creados por ahora.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AppCustomerDetailDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [blockReason, setBlockReason] = useState("");
  const [hideReviewsOnBlock, setHideReviewsOnBlock] = useState(true);

  const { data: detail, isLoading } = useQuery<CustomerAppDetail>({
    queryKey: ["/api/superadmin/app-customers", userId, "detail"],
    enabled: open && !!userId,
    queryFn: async () => {
      const resp = await fetch(`/api/superadmin/app-customers/${userId}`, { credentials: "include" });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      return resp.json();
    },
  });

  useEffect(() => {
    if (detail?.user) {
      setBlockReason(detail.user.blockedReason || "");
    }
    if (!open) {
      setHideReviewsOnBlock(true);
    }
  }, [detail, open]);

  const reportStatusMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/superadmin/customer-reports/${reportId}/status`, { status });
      return resp.json();
    },
    onSuccess: () => {
      invalidateAppCustomers();
      toast({ title: "Reporte actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar el reporte"), variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!detail) return null;
      const resp = await apiRequest("PATCH", `/api/superadmin/app-customers/${detail.user.id}/block`, {
        isBlocked: !detail.user.isBlocked,
        reason: blockReason || null,
        hideReviews: hideReviewsOnBlock,
      });
      return resp.json();
    },
    onSuccess: (_data) => {
      invalidateAppCustomers();
      toast({ title: detail?.user.isBlocked ? "Usuario desbloqueado" : "Usuario bloqueado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar el bloqueo"), variant: "destructive" });
    },
  });

  const hideReviewsMutation = useMutation({
    mutationFn: async (hidden: boolean) => {
      if (!detail) return null;
      const resp = await apiRequest("POST", `/api/superadmin/app-customers/${detail.user.id}/hide-reviews`, {
        hidden,
        reason: blockReason || null,
      });
      return resp.json();
    },
    onSuccess: (_data, hidden) => {
      invalidateAppCustomers();
      toast({ title: hidden ? "Reseñas ocultadas" : "Reseñas restauradas" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se pudo actualizar la visibilidad"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!detail) return null;
      await apiRequest("DELETE", `/api/superadmin/app-customers/${detail.user.id}`);
    },
    onSuccess: () => {
      invalidateAppCustomers();
      toast({ title: "Usuario eliminado" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "No se puede eliminar", description: extractErrorMessage(err, "Solo se eliminan usuarios de prueba seguros"), variant: "destructive" });
    },
  });

  const hasHiddenReviews = detail?.reviews.some((review) => review.isHidden) ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cliente App</DialogTitle>
          <DialogDescription>Moderación, membresías, reseñas y reportes del usuario final.</DialogDescription>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold">{customerFullName(detail.user)}</h3>
                <p className="text-sm text-muted-foreground">{detail.user.email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                  <span>{detail.user.phone || "Sin teléfono"}</span>
                  <span>Alta {formatShortDate(detail.user.createdAt)}</span>
                  <span>Última actividad {formatShortDateTime(detail.stats.lastActivity)}</span>
                </div>
              </div>
              <Badge variant={detail.user.isBlocked ? "destructive" : "default"}>
                {detail.user.isBlocked ? "Bloqueado" : "Activo"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-3"><p className="text-2xl font-bold">{detail.stats.branchCount}</p><p className="text-xs text-muted-foreground">Sucursales</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-2xl font-bold">{detail.stats.reviewCount}</p><p className="text-xs text-muted-foreground">Reseñas</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-2xl font-bold">{detail.reports.length}</p><p className="text-xs text-muted-foreground">Reportes</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-2xl font-bold">{detail.localBlocks.filter((block) => !block.unblockedAt).length}</p><p className="text-xs text-muted-foreground">Bloqueos locales</p></CardContent></Card>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-medium">Control global</h4>
                  <p className="text-xs text-muted-foreground">Bloquea la cuenta en toda la app sin afectar admins ni contratos móviles.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={detail.user.isBlocked ? "outline" : "destructive"}
                    onClick={() => blockMutation.mutate()}
                    disabled={blockMutation.isPending}
                    data-testid="button-toggle-global-block"
                  >
                    {blockMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {detail.user.isBlocked ? "Desbloquear usuario" : "Bloquear usuario"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => hideReviewsMutation.mutate(!hasHiddenReviews)}
                    disabled={hideReviewsMutation.isPending || detail.reviews.length === 0}
                    data-testid="button-toggle-hide-reviews"
                  >
                    {hideReviewsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {hasHiddenReviews ? "Restaurar reseñas" : "Ocultar reseñas"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-safe-customer"
                  >
                    {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Eliminar usuario de prueba
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <Textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Motivo visible para soporte y moderación"
                  className="min-h-[84px]"
                  data-testid="textarea-global-block-reason"
                />
                <div className="flex items-center gap-2">
                  <Switch checked={hideReviewsOnBlock} onCheckedChange={setHideReviewsOnBlock} data-testid="switch-hide-reviews-on-block" />
                  <Label className="text-xs text-muted-foreground">Ocultar reseñas al bloquear</Label>
                </div>
              </div>
              {detail.user.blockedReason && (
                <p className="text-xs text-muted-foreground">
                  Motivo actual: {detail.user.blockedReason}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-medium">Sucursales donde participa</h4>
                  {detail.memberships.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin membresías registradas.</p>
                  ) : (
                    detail.memberships.map((membership) => (
                      <div key={membership.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{membership.branchName}</p>
                            <p className="text-xs text-muted-foreground">/{membership.branchSlug}</p>
                          </div>
                          <Badge variant={membership.status === "active" ? "default" : "secondary"}>
                            {membership.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Alta {formatShortDate(membership.joinedAt)} · Cliente {membership.clientStatus}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-medium">Bloqueos por sucursal</h4>
                  {detail.localBlocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin bloqueos locales.</p>
                  ) : (
                    detail.localBlocks.map((block) => (
                      <div key={block.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{block.branchName}</p>
                          <Badge variant={block.unblockedAt ? "secondary" : "destructive"}>
                            {block.unblockedAt ? "Levantado" : "Activo"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {block.reason ? customerReportReasonLabel(block.reason) : "Sin motivo"} · {formatShortDateTime(block.createdAt)}
                        </p>
                        {block.note && <p className="text-sm mt-1">{block.note}</p>}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">Reseñas</h4>
                {detail.reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin reseñas registradas.</p>
                ) : (
                  detail.reviews.map((review) => (
                    <div key={review.id} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{review.branchName}</Badge>
                          <Badge variant="outline">{review.rating}/5</Badge>
                          {review.isHidden && <Badge variant="destructive">Oculta</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatShortDateTime(review.createdAt)}</span>
                      </div>
                      {review.comment && <p className="text-sm">{review.comment}</p>}
                      {review.hiddenReason && <p className="text-xs text-muted-foreground">Motivo: {review.hiddenReason}</p>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">Reportes recibidos</h4>
                {detail.reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin reportes.</p>
                ) : (
                  detail.reports.map((report) => (
                    <div key={report.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={customerReportStatusBadge(report.status)}>
                            {customerReportStatusLabel(report.status)}
                          </Badge>
                          <Badge variant="secondary">{customerReportReasonLabel(report.reason)}</Badge>
                          {report.branchName && <Badge variant="outline">{report.branchName}</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatShortDateTime(report.createdAt)}</span>
                      </div>
                      {report.note && <p className="text-sm">{report.note}</p>}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          {report.reporterName ? `Reportado por ${report.reporterName}` : "Reportado por sucursal"}
                          {report.reviewedAt && report.reviewerName ? ` · Revisado por ${report.reviewerName}` : ""}
                        </p>
                        <Select
                          value={report.status}
                          onValueChange={(status) => reportStatusMutation.mutate({ reportId: report.id, status })}
                        >
                          <SelectTrigger className="w-[170px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="reviewed">Revisado</SelectItem>
                            <SelectItem value="dismissed">Descartado</SelectItem>
                            <SelectItem value="escalated">Escalado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AppCustomersPanel() {
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: overview } = useQuery<CustomerAppOverview>({
    queryKey: ["/api/superadmin/app-customers/overview"],
  });

  const { data: customers, isLoading } = useQuery<CustomerAppUser[]>({
    queryKey: ["/api/superadmin/app-customers", search],
    queryFn: async () => {
      const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const resp = await fetch(`/api/superadmin/app-customers${query}`, { credentials: "include" });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      return resp.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{overview?.total ?? 0}</p><p className="text-xs text-muted-foreground">Total usuarios</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{overview?.active ?? 0}</p><p className="text-xs text-muted-foreground">Activos</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{overview?.blocked ?? 0}</p><p className="text-xs text-muted-foreground">Bloqueados</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{overview?.pendingReports ?? 0}</p><p className="text-xs text-muted-foreground">Reportes pendientes</p></CardContent></Card>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Clientes App</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, email o teléfono"
            className="pl-9 w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-app-customers"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-64" /></CardContent></Card>
          ))}
        </div>
      ) : customers && customers.length > 0 ? (
        <div className="space-y-3">
          {customers.map((customer) => (
            <Card
              key={customer.id}
              className="cursor-pointer hover-elevate"
              onClick={() => { setSelectedCustomerId(customer.id); setDetailOpen(true); }}
              data-testid={`card-app-customer-${customer.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{customerFullName(customer)}</h3>
                      <Badge variant={customer.isBlocked ? "destructive" : "default"}>
                        {customer.isBlocked ? "Bloqueado" : "Activo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{customer.phone || "Sin teléfono"}</span>
                      <span>Alta {formatShortDate(customer.createdAt)}</span>
                      <span>{customer.branchCount} sucursales</span>
                      <span>{customer.reviewCount} reseñas</span>
                      <span>Última actividad {formatShortDateTime(customer.lastActivity)}</span>
                    </div>
                    {customer.blockedReason && (
                      <p className="text-xs text-muted-foreground mt-2">Motivo de bloqueo: {customer.blockedReason}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm">Ver detalle</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">Sin resultados</h3>
            <p className="text-sm text-muted-foreground">No se encontraron usuarios app con esa búsqueda.</p>
          </CardContent>
        </Card>
      )}

      <AppCustomerDetailDialog
        userId={selectedCustomerId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

function BranchCard({
  branch,
  metrics,
  onStatusChange,
}: {
  branch: Branch;
  metrics?: BranchMetric;
  onStatusChange: (id: string, status: string) => void;
}) {
  const isDeleted = !!branch.deletedAt;

  const { data: adminData, refetch: refetchAdmin } = useQuery<AdminInfo>({
    queryKey: ["/api/superadmin/branches", branch.id, "admin"],
    queryFn: async () => {
      const resp = await fetch(`/api/superadmin/branches/${branch.id}/admin`, { credentials: "include" });
      if (!resp.ok) return null;
      return resp.json();
    },
  });
  const hasAdmin = adminData !== undefined ? !!adminData : undefined;

  return (
    <Card
      className={isDeleted ? "opacity-50" : ""}
      data-testid={`card-branch-${branch.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate" data-testid={`text-branch-name-${branch.id}`}>
                {branch.name}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid={`text-branch-slug-${branch.id}`}>
                /{branch.slug}
              </p>
              <p className="text-xs text-muted-foreground" data-testid={`text-branch-category-${branch.id}`}>
                {getCategoryLabel(branch.category)}
                {branch.subcategory ? ` · ${branch.subcategory}` : ""}
              </p>
              <p className="text-xs text-muted-foreground" data-testid={`text-admin-email-${branch.id}`}>
                {adminData ? (
                  <span className="text-green-600 dark:text-green-400">Admin: {adminData.email}</span>
                ) : adminData === null ? (
                  <span className="text-amber-500">Sin admin asignado</span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={branch.status} />
            {isDeleted && <Badge variant="destructive">Eliminada</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="text-center p-2 bg-muted/50 rounded-md">
            <p className="text-lg font-bold" data-testid={`text-customers-${branch.id}`}>
              {metrics?.customerCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Clientes (activos)</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-md">
            <p className="text-lg font-bold" data-testid={`text-memberships-${branch.id}`}>
              {metrics?.activeMemberships ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Membresías activas</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {new Date(branch.createdAt).toLocaleDateString("es-MX", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          {!isDeleted && (
            <Select
              value={branch.status}
              onValueChange={(val) => onStatusChange(branch.id, val)}
            >
              <SelectTrigger className="w-[160px]" data-testid={`select-status-${branch.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activa — Todo funciona</SelectItem>
                <SelectItem value="suspended">Suspendida — Admin ve banner "Pago pendiente"</SelectItem>
                <SelectItem value="blacklisted">Bloqueada — No permite acceso</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {!isDeleted && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  asChild
                  data-testid={`button-open-app-${branch.id}`}
                >
                  <a href={`/app/${branch.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir app pública</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  asChild
                  data-testid={`button-open-dashboard-${branch.id}`}
                >
                  <a href="/dashboard" target="_blank" rel="noopener noreferrer">
                    <LayoutDashboard className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dashboard (requiere login)</TooltipContent>
            </Tooltip>
            <EditBranchDialog branch={branch} adminEmail={adminData?.email || null} />
            <ImpersonateButton branch={branch} hasAdmin={hasAdmin} />
            <AdminDialog branch={branch} onAdminChanged={() => refetchAdmin()} />
            <ResetPasswordDialog branch={branch} hasAdmin={hasAdmin} />
            <ResendWelcomeButton branch={branch} hasAdmin={hasAdmin} />
            <DeleteBranchDialog branch={branch} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  const branchesUrl = showDeleted ? "/api/branches?include_deleted=true" : "/api/branches";
  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: [branchesUrl],
  });

  const { data: metrics } = useQuery<BranchMetric[]>({
    queryKey: ["/api/superadmin/branches/metrics"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/branches/${id}/status`, { status });
      return resp.json();
    },
    onSuccess: () => {
      invalidateBranches();
      toast({ title: "Estado actualizado" });
    },
    onError: async (err: any, variables) => {
      const errorMsg = extractErrorMessage(err, "No se pudo actualizar el estado");
      const is5xx = err?.message?.startsWith("5");
      if (is5xx) {
        toast({ title: "Reintentando...", description: "Error de servidor, reintentando..." });
        try {
          await apiRequest("PATCH", `/api/branches/${variables.id}/status`, { status: variables.status });
          invalidateBranches();
          toast({ title: "Estado actualizado (reintento exitoso)" });
          return;
        } catch {
          // retry failed, fall through to error toast
        }
      }
      invalidateBranches();
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    },
  });

  const metricsMap = new Map<string, BranchMetric>();
  metrics?.forEach((m) => metricsMap.set(m.branchId, m));

  const filteredBranches = branches?.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      (b.city && b.city.toLowerCase().includes(q)) ||
      (b.subcategory && b.subcategory.toLowerCase().includes(q)) ||
      (b.searchKeywords && b.searchKeywords.toLowerCase().includes(q))
    );
  });

  const activeBranches = branches?.filter((b) => b.status === "active" && !b.deletedAt).length ?? 0;
  const totalBranches = branches?.filter((b) => !b.deletedAt).length ?? 0;
  const totalCustomers = metrics?.reduce((acc, m) => acc + m.customerCount, 0) ?? 0;
  const totalActiveMemberships = metrics?.reduce((acc, m) => acc + m.activeMemberships, 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 p-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight" data-testid="text-superadmin-title">
                Super Admin
              </h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-branches">{totalBranches}</p>
                <p className="text-xs text-muted-foreground">Sucursales</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-branches">{activeBranches}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-customers">{totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Clientes (activos)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-purple-500/10">
                <ClipboardCheck className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-memberships">{totalActiveMemberships}</p>
                <p className="text-xs text-muted-foreground">Membresías activas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <NotificationsPanel
          title="Notificaciones internas"
          limit={5}
          emptyMessage="Sin notificaciones nuevas para Super Admin."
          testIdPrefix="superadmin-notifications"
        />

        <Tabs defaultValue="branches" className="w-full">
          <TabsList data-testid="tabs-superadmin">
            <TabsTrigger value="branches" data-testid="tab-branches">Sucursales</TabsTrigger>
            <TabsTrigger value="catalog" data-testid="tab-catalog">Catalogo</TabsTrigger>
            <TabsTrigger value="app-customers" data-testid="tab-app-customers">Clientes App</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Actividad</TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4 mt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold">Sucursales</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar..."
                    className="pl-9 w-48"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-branches"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={showDeleted}
                    onCheckedChange={setShowDeleted}
                    data-testid="switch-show-deleted"
                  />
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Ver eliminadas</Label>
                </div>
                <CreateBranchDialog />
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-md" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredBranches && filteredBranches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBranches.map((branch) => (
                  <BranchCard
                    key={branch.id}
                    branch={branch}
                    metrics={metricsMap.get(branch.id)}
                    onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-1">
                    {searchQuery ? "Sin resultados" : "Sin sucursales"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "No se encontraron sucursales con esa búsqueda"
                      : "Crea tu primera sucursal para comenzar"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="app-customers" className="mt-4">
            <AppCustomersPanel />
          </TabsContent>

          <TabsContent value="catalog" className="mt-4">
            <CatalogExecutivePanel />
          </TabsContent>

          <TabsContent value="activity" className="mt-4 space-y-4">
            <PlatformMetricsPanel />
            <ReviewModerationPanel />
            <ReservationAuditPanel />
            <NotificationJobsPanel />
            <Card>
              <CardContent className="p-4">
                <h2 className="font-semibold text-lg mb-4" data-testid="text-activity-title">Actividad reciente</h2>
                <AuditLogPanel />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h2 className="font-semibold text-lg mb-4">Eventos del sistema</h2>
                <SystemEventsPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
