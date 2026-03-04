import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2,
  LogOut,
  Users,
  CalendarDays,
  LayoutDashboard,
  Moon,
  Sun,
  AlertTriangle,
  X,
  CreditCard,
  Calendar,
  FileText,
  Monitor,
  Clock,
  TrendingUp,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  ShieldOff,
  Bell,
  UserX,
  ChevronDown,
  ChevronUp,
  Megaphone,
  Trash2,
  Send,
  ImagePlus,
  Loader2,
  MessageCircle,
  Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import ClientesTab from "@/components/clientes-tab";
import MembresiasTab from "@/components/membresias-tab";
import ReservasTab from "@/components/reservas-tab";
import ContenidoTab from "@/components/contenido-tab";
import TvModeTab from "@/components/tv-mode-tab";

const DASHBOARD_TABS = [
  { value: "resumen", label: "Resumen", icon: LayoutDashboard },
  { value: "clientes", label: "Clientes", icon: Users },
  { value: "membresias", label: "Membresías", icon: CreditCard },
  { value: "reservas", label: "Reservas", icon: Calendar },
  { value: "contenido", label: "Contenido", icon: FileText },
  { value: "tv", label: "TV Mode", icon: Monitor },
] as const;

type TabValue = typeof DASHBOARD_TABS[number]["value"];

function StatusBadge({ status, testId = "badge-branch-status" }: { status: string; testId?: string }) {
  if (status === "active") {
    return (
      <Badge variant="default" className="bg-green-600" data-testid={testId}>
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Activa
      </Badge>
    );
  }
  if (status === "suspended") {
    return (
      <Badge variant="default" className="bg-orange-500" data-testid={testId}>
        <PauseCircle className="h-3 w-3 mr-1" />
        Suspendida
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" data-testid={testId}>
      <ShieldOff className="h-3 w-3 mr-1" />
      Bloqueada
    </Badge>
  );
}

interface ReservationStats {
  todayCount: number;
  nextBooking: { className: string; startTime: string; bookingDate: string } | null;
}

interface AlertsData {
  expiringMemberships: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    membershipId: string;
    planName: string | null;
    expiresAt: string;
    classesRemaining: number | null;
    classesTotal: number | null;
  }>;
  expiredMemberships?: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    membershipId: string;
    planName: string | null;
    expiresAt: string;
    classesRemaining: number | null;
    paidAt: string | null;
  }>;
  inactiveClients: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    membershipId: string;
    joinedAt: string;
    lastSeenAt: string | null;
    planName: string | null;
    lastAttendance: string | null;
  }>;
  clientsWithoutClasses?: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    membershipId: string;
    planName: string | null;
    classesRemaining: number | null;
    classesTotal: number | null;
    expiresAt: string | null;
  }>;
}

function normalizePhoneMX(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("52")) return digits;
  if (digits.length === 10) return "52" + digits;
  return digits;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizePhoneMX(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

type WhatsAppTemplates = Record<string, string>;

function WhatsAppButton({ phone, template, vars, testId }: { phone: string | null; template: string; vars: Record<string, string>; testId: string }) {
  if (!phone) return null;
  const message = renderTemplate(template, vars);
  const url = buildWhatsAppUrl(phone, message);
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 px-2 text-[10px] text-green-600 border-green-200 hover:bg-green-50"
      onClick={() => window.open(url, "_blank")}
      data-testid={testId}
    >
      <MessageCircle className="h-3 w-3 mr-0.5" />
      WA
    </Button>
  );
}

function AlertsSection({ alerts, isLoading, onViewClient, branchName, whatsappTemplates }: { alerts: AlertsData | undefined; isLoading: boolean; onViewClient: (userId: string) => void; branchName: string; whatsappTemplates: WhatsAppTemplates }) {
  const { toast } = useToast();
  const [expiredExpanded, setExpiredExpanded] = useState(true);
  const [expiringExpanded, setExpiringExpanded] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [noClassesExpanded, setNoClassesExpanded] = useState(false);

  const renewMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const resp = await apiRequest("POST", `/api/branch/memberships/${membershipId}/renew`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      toast({ title: "Membresía renovada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al renovar", variant: "destructive" });
    },
  });

  const expiredCount = alerts?.expiredMemberships?.length ?? 0;
  const expiringCount = alerts?.expiringMemberships?.length ?? 0;
  const inactiveCount = alerts?.inactiveClients?.length ?? 0;
  const noClassesCount = alerts?.clientsWithoutClasses?.length ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (expiredCount === 0 && expiringCount === 0 && inactiveCount === 0 && noClassesCount === 0) {
    return null;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "---";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function daysUntil(dateStr: string) {
    const now = new Date();
    const target = new Date(dateStr);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function daysSince(dateStr: string | null, fallback: string) {
    const d = new Date(dateStr || fallback);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {expiredCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>Planes vencidos</span>
                <Badge variant="destructive" data-testid="badge-expired-count">
                  {expiredCount}
                </Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpiredExpanded(!expiredExpanded)}
                data-testid="button-toggle-expired"
              >
                {expiredExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {expiredExpanded && (
            <CardContent className="p-4 pt-0">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts?.expiredMemberships?.map((m) => (
                  <div
                    key={m.membershipId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 flex-wrap"
                    data-testid={`alert-expired-${m.userId}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.name} {m.lastName || ""}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.planName || "Sin plan"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Venció {formatDate(m.expiresAt)}</p>
                        {m.classesRemaining !== null && (
                          <p className="text-[10px] text-muted-foreground">{m.classesRemaining} clases restantes</p>
                        )}
                      </div>
                      <WhatsAppButton
                        phone={m.phone}
                        template={whatsappTemplates.expired_membership || ""}
                        vars={{ firstName: m.name, fullName: `${m.name} ${m.lastName || ""}`.trim(), branchName, expiresAt: formatDate(m.expiresAt), classesRemaining: String(m.classesRemaining ?? 0), classesTotal: "0" }}
                        testId={`button-wa-expired-${m.userId}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => onViewClient(m.userId)}
                        data-testid={`button-view-expired-${m.userId}`}
                      >
                        Ver cliente
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => renewMutation.mutate(m.membershipId)}
                        disabled={renewMutation.isPending}
                        data-testid={`button-renew-expired-${m.userId}`}
                      >
                        {renewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Renovar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {expiringCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-orange-500" />
                <span>Membresías por vencer</span>
                <Badge variant="default" className="bg-orange-500" data-testid="badge-expiring-count">
                  {expiringCount}
                </Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpiringExpanded(!expiringExpanded)}
                data-testid="button-toggle-expiring"
              >
                {expiringExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {expiringExpanded && (
            <CardContent className="p-4 pt-0">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts?.expiringMemberships.map((m) => {
                  const days = daysUntil(m.expiresAt);
                  return (
                    <div
                      key={m.membershipId}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 flex-wrap"
                      data-testid={`alert-expiring-${m.userId}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.planName || "Sin plan"}
                          {m.classesRemaining !== null ? ` · ${m.classesRemaining} clases` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{formatDate(m.expiresAt)}</span>
                        <WhatsAppButton
                          phone={m.phone}
                          template={whatsappTemplates.expiring_membership || ""}
                          vars={{ firstName: m.name, fullName: `${m.name} ${m.lastName || ""}`.trim(), branchName, expiresAt: formatDate(m.expiresAt), classesRemaining: String(m.classesRemaining ?? 0), classesTotal: String(m.classesTotal ?? 0) }}
                          testId={`button-wa-expiring-${m.userId}`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onViewClient(m.userId)}
                          data-testid={`button-view-expiring-${m.userId}`}
                        >
                          Ver cliente
                        </Button>
                        <Badge
                          variant={days <= 2 ? "destructive" : "default"}
                          className={days <= 2 ? "" : "bg-orange-500"}
                        >
                          {days <= 0 ? "Hoy" : days === 1 ? "1 día" : `${days} días`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {inactiveCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500" />
                <span>Clientes inactivos (+30 días)</span>
                <Badge variant="destructive" data-testid="badge-inactive-count">
                  {inactiveCount}
                </Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setInactiveExpanded(!inactiveExpanded)}
                data-testid="button-toggle-inactive"
              >
                {inactiveExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {inactiveExpanded && (
            <CardContent className="p-4 pt-0">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts?.inactiveClients.map((c) => {
                  const days = daysSince(c.lastAttendance, c.joinedAt);
                  return (
                    <div
                      key={c.membershipId}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 flex-wrap"
                      data-testid={`alert-inactive-${c.userId}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Última actividad: {formatDate(c.lastAttendance || c.joinedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onViewClient(c.userId)}
                          data-testid={`button-view-inactive-${c.userId}`}
                        >
                          Ver cliente
                        </Button>
                        <Badge variant="destructive">
                          {days} días
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {noClassesCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-500" />
                <span>Sin clases disponibles</span>
                <Badge variant="default" className="bg-purple-500" data-testid="badge-no-classes-count">
                  {noClassesCount}
                </Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setNoClassesExpanded(!noClassesExpanded)}
                data-testid="button-toggle-no-classes"
              >
                {noClassesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {noClassesExpanded && (
            <CardContent className="p-4 pt-0">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts?.clientsWithoutClasses?.map((c) => (
                  <div
                    key={c.membershipId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 flex-wrap"
                    data-testid={`alert-no-classes-${c.userId}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.planName || "Sin plan"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.expiresAt && (
                        <span className="text-[10px] text-muted-foreground">Vence {formatDate(c.expiresAt)}</span>
                      )}
                      <WhatsAppButton
                        phone={c.phone}
                        template={whatsappTemplates.no_classes || ""}
                        vars={{ firstName: c.name, fullName: `${c.name} ${c.lastName || ""}`.trim(), branchName, expiresAt: formatDate(c.expiresAt), classesRemaining: "0", classesTotal: String(c.classesTotal ?? 0) }}
                        testId={`button-wa-no-classes-${c.userId}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => onViewClient(c.userId)}
                        data-testid={`button-view-no-classes-${c.userId}`}
                      >
                        Ver cliente
                      </Button>
                      <Badge variant="destructive">0/{c.classesTotal ?? "?"} clases</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

const TEMPLATE_LABELS: Record<string, string> = {
  expired_membership: "Plan vencido",
  expiring_membership: "Membresía por vencer",
  no_classes: "Sin clases disponibles",
};

const TEMPLATE_SAMPLE_VARS: Record<string, string> = {
  firstName: "María",
  fullName: "María López",
  branchName: "Mi Estudio",
  expiresAt: "05 mar 2026",
  classesRemaining: "3",
  classesTotal: "12",
};

function WhatsAppTemplatesSection({ branchName }: { branchName: string }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const { data: templates, isLoading } = useQuery<WhatsAppTemplates>({
    queryKey: ["/api/branch/whatsapp-templates"],
  });

  const [drafts, setDrafts] = useState<WhatsAppTemplates>({});
  const [initialized, setInitialized] = useState(false);

  if (templates && !initialized) {
    setDrafts(templates);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: WhatsAppTemplates) => {
      const resp = await apiRequest("PATCH", "/api/branch/whatsapp-templates", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/whatsapp-templates"] });
      toast({ title: "Plantillas guardadas" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudieron guardar", variant: "destructive" });
    },
  });

  const sampleVars = { ...TEMPLATE_SAMPLE_VARS, branchName };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-600" />
            <span>Plantillas WhatsApp</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid="button-toggle-wa-templates"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="p-4 pt-0 space-y-4">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Variables disponibles: {"{firstName}"}, {"{fullName}"}, {"{branchName}"}, {"{expiresAt}"}, {"{classesRemaining}"}, {"{classesTotal}"}
              </p>
              {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm font-medium">{label}</Label>
                  <Textarea
                    value={drafts[key] || ""}
                    onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                    rows={2}
                    className="text-sm"
                    data-testid={`textarea-wa-template-${key}`}
                  />
                  {drafts[key] && (
                    <p className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/30" data-testid={`preview-wa-template-${key}`}>
                      {renderTemplate(drafts[key], sampleVars)}
                    </p>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(drafts)}
                disabled={saveMutation.isPending}
                data-testid="button-save-wa-templates"
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Guardar plantillas
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AnnouncementsSection({ branchId }: { branchId: string }) {
  const [newMessage, setNewMessage] = useState("");
  const [announcementImageUrl, setAnnouncementImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: announcements, isLoading } = useQuery<any[]>({
    queryKey: ["/api/branch/announcements"],
  });

  async function handleImageUpload(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast({ title: "Solo JPG, PNG o WebP", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Máximo 2MB", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/branch/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Error al subir imagen");
      const data = await res.json();
      setAnnouncementImageUrl(data.url);
    } catch {
      toast({ title: "Error al subir imagen", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: async ({ message, imageUrl }: { message: string; imageUrl: string | null }) => {
      const res = await apiRequest("POST", "/api/branch/announcements", { message, imageUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/announcements"] });
      setNewMessage("");
      setAnnouncementImageUrl(null);
      toast({ title: "Anuncio publicado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/announcements"] });
      toast({ title: "Anuncio eliminado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const activeAnnouncements = announcements?.filter((a: any) => a.isActive) || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Anuncio rápido
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-xs text-muted-foreground">
          Se muestra como banner en tu página pública. Solo 1 activo a la vez.
        </p>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Ej: Hoy clase especial a las 7pm..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              maxLength={500}
              data-testid="input-announcement-message"
            />
            <Button
              size="sm"
              disabled={!newMessage.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ message: newMessage.trim(), imageUrl: announcementImageUrl })}
              data-testid="button-create-announcement"
            >
              <Send className="h-4 w-4 mr-1" />
              Publicar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                data-testid="input-announcement-image"
              />
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {uploadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                {announcementImageUrl ? "Cambiar imagen" : "Adjuntar imagen"}
              </span>
            </label>
            {announcementImageUrl && (
              <div className="flex items-center gap-2">
                <img src={announcementImageUrl} alt="Preview" className="h-8 w-8 rounded object-cover" />
                <button
                  type="button"
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => setAnnouncementImageUrl(null)}
                  data-testid="button-remove-announcement-image"
                >
                  Quitar
                </button>
              </div>
            )}
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : activeAnnouncements.length > 0 ? (
          <div className="space-y-2">
            {activeAnnouncements.map((a: any) => (
              <div
                key={a.id}
                className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 overflow-hidden"
                data-testid={`announcement-${a.id}`}
              >
                {a.imageUrl && (
                  <img src={a.imageUrl} alt="Anuncio" className="w-full max-h-40 object-cover" data-testid={`img-announcement-${a.id}`} />
                )}
                <div className="p-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Megaphone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Activo · {timeAgo(a.createdAt)}</span>
                    </div>
                    <span className="text-sm" data-testid={`text-announcement-${a.id}`}>{a.message}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-red-500 hover:text-red-700"
                    onClick={() => setDeleteId(a.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-announcement-${a.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic" data-testid="text-no-announcements">
            Sin anuncios activos
          </p>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar anuncio?</AlertDialogTitle>
            <AlertDialogDescription>
              El anuncio dejará de mostrarse en tu página pública.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-announcement">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
              data-testid="button-confirm-delete-announcement"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ResumenTab({ branchStats, branchStatus, branchSlug, branchId, branchName, isLoading, reservationStats, reservationLoading, alerts, alertsLoading, onViewClient }: {
  branchStats: { activeMemberships: number; uniqueActiveCustomers: number; totalCustomers: number } | undefined;
  branchStatus: string;
  branchSlug: string;
  branchId: string;
  branchName: string;
  isLoading: boolean;
  reservationStats: ReservationStats | undefined;
  reservationLoading: boolean;
  alerts: AlertsData | undefined;
  alertsLoading: boolean;
  onViewClient: (userId: string) => void;
}) {
  const { data: whatsappTemplates } = useQuery<WhatsAppTemplates>({
    queryKey: ["/api/branch/whatsapp-templates"],
  });

  const statusConfig: Record<string, { label: string; description: string; color: string }> = {
    active: { label: "Activa", description: "Tu sucursal está operando normalmente.", color: "text-green-600 dark:text-green-400" },
    suspended: { label: "Suspendida", description: "Pago pendiente. Tus clientes no pueden acceder.", color: "text-orange-500 dark:text-orange-400" },
    blacklisted: { label: "Bloqueada", description: "Sucursal bloqueada. Contacta al administrador.", color: "text-red-500 dark:text-red-400" },
  };

  const currentStatus = statusConfig[branchStatus] || statusConfig.active;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-clients-count">
                  {branchStats?.uniqueActiveCustomers ?? 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Clientes activos</p>
              {branchStats && branchStats.totalCustomers > branchStats.uniqueActiveCustomers && (
                <p className="text-[10px] text-muted-foreground" data-testid="text-clients-total">{branchStats.totalCustomers} totales</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-green-500/10">
              <CreditCard className="h-5 w-5 text-green-500" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-memberships-count">
                  {branchStats?.activeMemberships ?? 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Membresías activas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-blue-500/10">
              <CalendarDays className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              {reservationLoading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-reservations-today">
                  {reservationStats?.todayCount ?? 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Reservas de hoy</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-purple-500/10">
              <Clock className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              {reservationLoading ? (
                <Skeleton className="h-5 w-24 mb-1" />
              ) : reservationStats?.nextBooking ? (
                <p className="text-sm font-semibold" data-testid="text-next-reservation">
                  {reservationStats.nextBooking.className} {reservationStats.nextBooking.startTime}
                </p>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground" data-testid="text-next-reservation">
                  Sin reservas
                </p>
              )}
              <p className="text-xs text-muted-foreground">Próxima reserva</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertsSection alerts={alerts} isLoading={alertsLoading} branchName={branchName} whatsappTemplates={whatsappTemplates || {}} onViewClient={onViewClient} />

      <WhatsAppTemplatesSection branchName={branchName} />

      <AnnouncementsSection branchId={branchId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Estado de la sucursal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-3">
              <StatusBadge status={branchStatus} testId="badge-summary-status" />
              <p className={`text-sm ${currentStatus.color}`} data-testid="text-status-description">
                {currentStatus.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Perfil público
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" data-testid="text-branch-slug-dashboard">
                  /app/{branchSlug}
                </p>
                <p className="text-xs text-muted-foreground">URL visible para tus clientes</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/app/${branchSlug}`, "_blank")}
                data-testid="button-view-public-page"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Ver
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { user, logout, refetch } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabValue>("resumen");

  const branchName = user?.branch?.name ?? "Tu Sucursal";
  const branchSlug = user?.branch?.slug ?? "";
  const branchStatus = user?.branch?.status ?? "active";
  const isImpersonating = !!(user as any)?.impersonating;
  const impersonatedBranchName = (user as any)?.impersonatedBranchName;

  const { data: branchStats, isLoading: statsLoading } = useQuery<{ activeMemberships: number; uniqueActiveCustomers: number; totalCustomers: number }>({
    queryKey: ["/api/branch/stats"],
    enabled: !!user?.branchId,
  });

  const { data: reservationStats, isLoading: reservationLoading } = useQuery<ReservationStats>({
    queryKey: ["/api/branch/reservations/stats"],
    enabled: !!user?.branchId,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<AlertsData>({
    queryKey: ["/api/branch/alerts"],
    enabled: !!user?.branchId,
  });

  const endImpersonateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/superadmin/impersonate/end");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Modo soporte finalizado" });
      setTimeout(() => {
        refetch();
        setLocation("/superadmin");
      }, 300);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo salir del modo soporte", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {branchStatus === "suspended" && (
        <div className="sticky top-0 z-[60] bg-orange-500 dark:bg-orange-600 text-white px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium" data-testid="text-suspended-banner">
              Pago pendiente — Tu sucursal está suspendida. Contacta al administrador para reactivarla.
            </span>
          </div>
        </div>
      )}

      {isImpersonating && (
        <div className="sticky top-0 z-[60] bg-amber-500 dark:bg-amber-600 text-white px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium" data-testid="text-impersonation-banner">
                Modo soporte: {impersonatedBranchName || branchName}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/20 border-white/40 text-white"
              onClick={() => endImpersonateMutation.mutate()}
              disabled={endImpersonateMutation.isPending}
              data-testid="button-end-impersonate"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Salir de soporte
            </Button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ top: (branchStatus === "suspended" && isImpersonating) ? '80px' : (branchStatus === "suspended" || isImpersonating) ? '40px' : undefined }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 p-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight" data-testid="text-dashboard-title">
                {branchName}
              </h1>
              <p className="text-xs text-muted-foreground">Panel de administración</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={branchStatus} />
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-dashboard">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {!isImpersonating && (
              <Button variant="ghost" onClick={logout} data-testid="button-logout-dashboard">
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <div className="overflow-x-auto -mx-4 px-4 pb-1">
            <TabsList className="w-full sm:w-auto" data-testid="tabs-dashboard-nav">
              {DASHBOARD_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 text-xs sm:text-sm"
                  data-testid={`tab-${tab.value}`}
                >
                  <tab.icon className="h-3.5 w-3.5 hidden sm:block" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="resumen" className="mt-4">
            <ResumenTab
              branchStats={branchStats}
              branchStatus={branchStatus}
              branchSlug={branchSlug}
              branchId={user?.branchId || ""}
              branchName={branchName}
              isLoading={statsLoading}
              reservationStats={reservationStats}
              reservationLoading={reservationLoading}
              alerts={alerts}
              alertsLoading={alertsLoading}
              onViewClient={() => setActiveTab("clientes")}
            />
          </TabsContent>

          <TabsContent value="clientes" className="mt-4">
            <ClientesTab />
          </TabsContent>

          <TabsContent value="membresias" className="mt-4">
            <MembresiasTab />
          </TabsContent>

          <TabsContent value="reservas" className="mt-4">
            <ReservasTab />
          </TabsContent>

          <TabsContent value="contenido" className="mt-4">
            <ContenidoTab />
          </TabsContent>

          <TabsContent value="tv" className="mt-4">
            <TvModeTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
