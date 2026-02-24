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
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
    email: string;
    phone: string | null;
    membershipId: string;
    planName: string | null;
    expiresAt: string;
    classesRemaining: number | null;
  }>;
  inactiveClients: Array<{
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    membershipId: string;
    joinedAt: string;
    lastSeenAt: string | null;
    planName: string | null;
    lastAttendance: string | null;
  }>;
}

function AlertsSection({ alerts, isLoading }: { alerts: AlertsData | undefined; isLoading: boolean }) {
  const [expiringExpanded, setExpiringExpanded] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);

  const expiringCount = alerts?.expiringMemberships?.length ?? 0;
  const inactiveCount = alerts?.inactiveClients?.length ?? 0;

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

  if (expiringCount === 0 && inactiveCount === 0) {
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
                        <p className="text-xs text-muted-foreground truncate">{m.planName || "Sin plan"}</p>
                      </div>
                      <Badge
                        variant={days <= 2 ? "destructive" : "default"}
                        className={days <= 2 ? "" : "bg-orange-500"}
                      >
                        {days <= 0 ? "Hoy" : days === 1 ? "1 día" : `${days} días`}
                      </Badge>
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
                      <Badge variant="destructive">
                        {days} días
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function AnnouncementsSection({ branchId }: { branchId: string }) {
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();

  const { data: announcements, isLoading } = useQuery<any[]>({
    queryKey: ["/api/branch/announcements"],
  });

  const createMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/branch/announcements", { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/announcements"] });
      setNewMessage("");
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
            onClick={() => createMutation.mutate(newMessage.trim())}
            data-testid="button-create-announcement"
          >
            <Send className="h-4 w-4 mr-1" />
            Publicar
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : activeAnnouncements.length > 0 ? (
          <div className="space-y-2">
            {activeAnnouncements.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                data-testid={`announcement-${a.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-sm truncate" data-testid={`text-announcement-${a.id}`}>{a.message}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-red-500 hover:text-red-700"
                  onClick={() => deleteMutation.mutate(a.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-announcement-${a.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic" data-testid="text-no-announcements">
            Sin anuncios activos
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResumenTab({ branchStats, branchStatus, branchSlug, branchId, isLoading, reservationStats, reservationLoading, alerts, alertsLoading }: {
  branchStats: { activeMemberships: number; uniqueActiveCustomers: number } | undefined;
  branchStatus: string;
  branchSlug: string;
  branchId: string;
  isLoading: boolean;
  reservationStats: ReservationStats | undefined;
  reservationLoading: boolean;
  alerts: AlertsData | undefined;
  alertsLoading: boolean;
}) {
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

      <AlertsSection alerts={alerts} isLoading={alertsLoading} />

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

  const { data: branchStats, isLoading: statsLoading } = useQuery<{ activeMemberships: number; uniqueActiveCustomers: number }>({
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
              isLoading={statsLoading}
              reservationStats={reservationStats}
              reservationLoading={reservationLoading}
              alerts={alerts}
              alertsLoading={alertsLoading}
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
