import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2,
  BarChart3,
  LogOut,
  Users,
  CalendarDays,
  LayoutDashboard,
  Moon,
  Sun,
  AlertTriangle,
  X,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Monitor,
  Clock,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
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
  Cake,
  Gift,
  Tag,
  Plus,
  Globe,
  Eye,
  EyeOff,
  Sparkles,
  Wallet,
  Settings2,
  UserCircle,
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateBranchMembershipQueries } from "@/lib/branch-dashboard-cache";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import ClientesTab from "@/components/clientes-tab";
import MembresiasTab from "@/components/membresias-tab";
import ReservasTab from "@/components/reservas-tab";
import ContenidoTab from "@/components/contenido-tab";
import TvModeTab from "@/components/tv-mode-tab";
import PerfilPublicoTab from "@/components/perfil-publico-tab";
import NotificationsPanel, { type NotificationItem } from "@/components/notifications-panel";
import CajaTab from "@/components/caja-tab";

const DASHBOARD_TABS = [
  { value: "resumen", label: "Resumen", icon: LayoutDashboard },
  { value: "clientes", label: "Clientes", icon: Users },
  { value: "membresias", label: "Membresías", icon: CreditCard },
  { value: "caja", label: "Caja", icon: DollarSign },
  { value: "reservas", label: "Reservas", icon: Calendar },
  { value: "contenido", label: "Contenido", icon: FileText },
  { value: "perfil", label: "Perfil Público", icon: Building2 },
  { value: "configuracion", label: "Configuración", icon: Settings2 },
  { value: "promociones", label: "Promociones", icon: Tag },
  { value: "tv", label: "TV Mode", icon: Monitor },
] as const;

type TabValue = typeof DASHBOARD_TABS[number]["value"];

type BranchClientSummary = {
  userId: string;
  planStatus: "active" | "expired" | "deleted" | null;
  individualPurchaseCount?: number;
};

type ReservationNotificationTarget = {
  bookingId?: string | null;
  clientUserId?: string | null;
  classScheduleId: string;
  bookingDate: string;
  nonce: number;
};

type ClientNotificationTarget = {
  userId: string;
  nonce: number;
};

const DASHBOARD_NAV_TABS = DASHBOARD_TABS.map((tab) => {
    if (tab.value === "membresias") {
      return { ...tab, label: "Servicios y planes" };
    }

    if (tab.value === "perfil") {
      return { ...tab, label: "Perfil Público" };
    }

    if (tab.value === "configuracion") {
      return { ...tab, label: "Configuración" };
    }

    return tab;
  });

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

interface BranchDashboardMetrics {
  upcomingBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  activeClients: number;
  inactiveClients: number;
  lowClassesClients: number;
  activePromotions: number;
  recentReviews: number;
}

interface BranchFinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  todayIncome: number;
  todayExpense: number;
  monthIncome: number;
  monthExpense: number;
  dailyBreakdown: Array<{
    date: string;
    income: number;
    expense: number;
    net: number;
  }>;
  topIncomeCategories: Array<{ category: string; total: number }>;
  topExpenseCategories: Array<{ category: string; total: number }>;
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
  upcomingBirthdays?: Array<{
    userId: string;
    name: string;
    lastName: string | null;
    phone: string | null;
    birthDate: string;
    membershipId: string;
  }>;
}

function normalizePhoneMX(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("52")) return digits;
  if (digits.length === 10) return "52" + digits;
  return digits;
}

function isBirthdayToday(birthDate: string): boolean {
  if (!birthDate) return false;
  const today = new Date();
  const [, monthStr, dayStr] = birthDate.split("-");
  return parseInt(monthStr) === today.getMonth() + 1 && parseInt(dayStr) === today.getDate();
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizePhoneMX(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrencyMx(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

function getIsoDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatCategoryLabel(value: string | null | undefined) {
  if (!value) return "Sin categoría";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type WhatsAppTemplates = Record<string, string>;

function WhatsAppButton({ phone, template, vars, testId, label }: { phone: string | null; template: string; vars: Record<string, string>; testId: string; label?: string }) {
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
      {label || "WA"}
    </Button>
  );
}

function TodayBirthdaysSection({ alerts, branchName, whatsappTemplates, onViewClient }: { alerts: AlertsData | undefined; branchName: string; whatsappTemplates: WhatsAppTemplates; onViewClient: (userId: string) => void }) {
  const todayBirthdays = (alerts?.upcomingBirthdays || []).filter((b) => isBirthdayToday(b.birthDate));
  const hasBirthdays = todayBirthdays.length > 0;

  return (
    <Card className={hasBirthdays ? "border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/20" : ""} data-testid="card-today-birthdays">
      <CardHeader className="pb-2">
        <CardTitle className={`text-base flex items-center gap-2 ${hasBirthdays ? "text-pink-700 dark:text-pink-400" : ""}`}>
          <Cake className="h-4 w-4" />
          🎉 Cumpleaños de hoy
          {hasBirthdays && (
            <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-pink-500 text-white text-[11px] font-bold">{todayBirthdays.length}</span>
          )}
        </CardTitle>
        {hasBirthdays && (
          <p className="text-xs text-muted-foreground">Sugerencia: ofrécele una promoción o beneficio especial 🎁</p>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!hasBirthdays ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-birthdays-today">No hay cumpleaños hoy</p>
        ) : (
          <div className="space-y-2">
            {todayBirthdays.map((b) => {
              const firstName = b.name.split(" ")[0];
              const fullName = [b.name, b.lastName].filter(Boolean).join(" ");
              const template = whatsappTemplates.birthday_greeting || "Hola {firstName}, todo el equipo de {branchName} te desea un feliz cumpleaños. ¡Te esperamos pronto!";
              return (
                <div key={b.userId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-card border border-pink-100 dark:border-pink-900" data-testid={`birthday-today-${b.userId}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎂</span>
                    <p className="text-sm font-medium" data-testid={`text-birthday-name-${b.userId}`}>{fullName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <WhatsAppButton
                      phone={b.phone}
                      template={template}
                      vars={{ firstName, fullName, branchName }}
                      testId={`button-wa-birthday-today-${b.userId}`}
                      label="Enviar felicitación"
                    />
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                      onClick={() => onViewClient(b.userId)}
                      data-testid={`button-view-birthday-today-${b.userId}`}
                    >
                      Ver perfil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsSection({ alerts, isLoading, onViewClient, branchName, whatsappTemplates }: { alerts: AlertsData | undefined; isLoading: boolean; onViewClient: (userId: string) => void; branchName: string; whatsappTemplates: WhatsAppTemplates }) {
  const { toast } = useToast();
  const [expiredExpanded, setExpiredExpanded] = useState(true);
  const [expiringExpanded, setExpiringExpanded] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [noClassesExpanded, setNoClassesExpanded] = useState(false);
  const [birthdayExpanded, setBirthdayExpanded] = useState(true);

  const renewMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const resp = await apiRequest("POST", `/api/branch/memberships/${membershipId}/renew`);
      return resp.json();
    },
    onSuccess: async () => {
      await invalidateBranchMembershipQueries();
      toast({ title: "Membresía renovada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al renovar", variant: "destructive" });
    },
  });

  const expiredCount = alerts?.expiredMemberships?.length || 0;
  const expiringCount = alerts?.expiringMemberships?.length || 0;
  const inactiveCount = alerts?.inactiveClients?.length || 0;
  const noClassesCount = alerts?.clientsWithoutClasses?.length || 0;
  const birthdayCount = alerts?.upcomingBirthdays?.length || 0;

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

  if (expiredCount === 0 && expiringCount === 0 && inactiveCount === 0 && noClassesCount === 0 && birthdayCount === 0) {
    return null;
  }

  function calculateAge(birthDateStr: string): number | null {
    try {
      const bd = new Date(birthDateStr);
      const now = new Date();
      let age = now.getFullYear() - bd.getFullYear();
      const monthDiff = now.getMonth() - bd.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < bd.getDate())) {
        age--;
      }
      return age + 1;
    } catch { return null; }
  }

  function formatBirthday(birthDateStr: string): string {
    try {
      const bd = new Date(birthDateStr + "T12:00:00");
      const now = new Date();
      const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      const diff = Math.ceil((thisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 0) return "Hoy";
      if (diff === 1) return "Mañana";
      return bd.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
    } catch { return birthDateStr; }
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-pink-500" />
              <span>Cumpleaños próximos</span>
              {birthdayCount > 0 && (
                <Badge variant="default" className="bg-pink-500" data-testid="badge-birthday-count">
                  {birthdayCount}
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setBirthdayExpanded(!birthdayExpanded)}
              data-testid="button-toggle-birthdays"
            >
              {birthdayExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {birthdayExpanded && (
          <CardContent className="p-4 pt-0">
            {birthdayCount === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-birthdays">Sin cumpleaños próximos</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts?.upcomingBirthdays?.map((b) => {
                  const age = calculateAge(b.birthDate);
                  const dayLabel = formatBirthday(b.birthDate);
                  return (
                    <div
                      key={b.userId}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 flex-wrap"
                      data-testid={`alert-birthday-${b.userId}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          <Gift className="h-3 w-3 inline mr-1 text-pink-500" />
                          {b.name} {b.lastName || ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dayLabel}
                          {age !== null ? ` · Cumple ${age} años` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <WhatsAppButton
                          phone={b.phone}
                          template={whatsappTemplates.birthday_greeting || "Hola {firstName}, todo el equipo de {branchName} te desea un feliz cumpleaños. ¡Te esperamos pronto!"}
                          vars={{ firstName: b.name, fullName: `${b.name} ${b.lastName || ""}`.trim(), branchName }}
                          testId={`button-wa-birthday-${b.userId}`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onViewClient(b.userId)}
                          data-testid={`button-view-birthday-${b.userId}`}
                        >
                          Ver cliente
                        </Button>
                        <Badge variant="default" className="bg-pink-500">
                          {dayLabel}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
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
  birthday_greeting: "Cumpleaños",
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
      <CardContent className="space-y-2.5 p-4 pt-0">
        <p className="text-xs text-muted-foreground">
          Se muestra como banner en tu página pública. Solo 1 activo a la vez.
        </p>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Ej: Hoy clase especial a las 7pm"
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
              Guardar
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
                <img src={announcementImageUrl} alt="Preview" className="h-7 w-7 rounded object-cover" />
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
                  <img src={a.imageUrl} alt="Anuncio" className="w-full max-h-24 object-cover" data-testid={`img-announcement-${a.id}`} />
                )}
                <div className="p-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Megaphone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Activo · {timeAgo(a.createdAt)}</span>
                    </div>
                    <span className="line-clamp-2 text-sm" data-testid={`text-announcement-${a.id}`}>{a.message}</span>
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

function ResumenTab({ branchStats, branchStatus, branchSlug, branchId, branchName, isLoading, reservationStats, reservationLoading, dashboardMetrics, alerts, alertsLoading, onViewClient }: {
  branchStats: { activeMemberships: number; uniqueActiveCustomers: number; totalCustomers: number } | undefined;
  branchStatus: string;
  branchSlug: string;
  branchId: string;
  branchName: string;
  isLoading: boolean;
  reservationStats: ReservationStats | undefined;
  reservationLoading: boolean;
  dashboardMetrics: BranchDashboardMetrics | undefined;
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
              <p className="text-xs text-muted-foreground">Clientes con membresía</p>
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Próximas reservas</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.upcomingBookings ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cancelaciones</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.cancelledBookings ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">No show</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.noShowBookings ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clases por agotarse</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.lowClassesClients ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clientes recurrentes</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.activeClients ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clientes inactivos (CRM)</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.inactiveClients ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Promociones activas</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.activePromotions ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reseñas recientes</p>
            <p className="text-xl font-semibold">{dashboardMetrics?.recentReviews ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <NotificationsPanel
        title="Notificaciones de la sucursal"
        limit={5}
        emptyMessage="Sin notificaciones recientes para tu sucursal."
        testIdPrefix="branch-notifications"
      />
      <TodayBirthdaysSection alerts={alerts} branchName={branchName} whatsappTemplates={whatsappTemplates || {}} onViewClient={onViewClient} />

      <AlertsSection alerts={alerts} isLoading={alertsLoading} branchName={branchName} whatsappTemplates={whatsappTemplates || {}} onViewClient={onViewClient} />

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

      <WhatsAppConfigCard />
    </div>
  );
}

function ResumenTabPremium({ branchStats, branchStatus, branchSlug, branchId, branchName, isLoading, reservationStats, reservationLoading, dashboardMetrics, alerts, alertsLoading, onViewClient }: {
  branchStats: { activeMemberships: number; uniqueActiveCustomers: number; totalCustomers: number } | undefined;
  branchStatus: string;
  branchSlug: string;
  branchId: string;
  branchName: string;
  isLoading: boolean;
  reservationStats: ReservationStats | undefined;
  reservationLoading: boolean;
  dashboardMetrics: BranchDashboardMetrics | undefined;
  alerts: AlertsData | undefined;
  alertsLoading: boolean;
  onViewClient: (userId: string) => void;
}) {
  const { data: whatsappTemplates } = useQuery<WhatsAppTemplates>({
    queryKey: ["/api/branch/whatsapp-templates"],
  });
  const financeFrom = getIsoDateDaysAgo(29);
  const financeTo = getIsoDateDaysAgo(0);
  const { data: financeSummary, isLoading: financeLoading } = useQuery<BranchFinanceSummary>({
    queryKey: ["/api/branch/finance/summary", "overview", financeFrom, financeTo],
    queryFn: async () => {
      const res = await fetch(`/api/branch/finance/summary?from=${financeFrom}&to=${financeTo}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar el resumen financiero");
      }
      return res.json();
    },
    staleTime: 60_000,
  });

  const statusConfig: Record<string, { label: string; description: string; accent: string; surface: string }> = {
    active: {
      label: "Activa",
      description: "Tu sucursal está operando con normalidad y lista para recibir clientes.",
      accent: "text-emerald-600 dark:text-emerald-400",
      surface: "bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-800/60",
    },
    suspended: {
      label: "Suspendida",
      description: "Hay una restricción temporal. Conviene revisarla cuanto antes.",
      accent: "text-amber-600 dark:text-amber-400",
      surface: "bg-amber-500/10 border-amber-200/70 dark:border-amber-800/60",
    },
    blacklisted: {
      label: "Bloqueada",
      description: "La sucursal necesita atención administrativa antes de volver a operar.",
      accent: "text-rose-600 dark:text-rose-400",
      surface: "bg-rose-500/10 border-rose-200/70 dark:border-rose-800/60",
    },
  };

  const currentStatus = statusConfig[branchStatus] || statusConfig.active;
  const monthIncome = financeSummary?.monthIncome ?? 0;
  const monthExpense = financeSummary?.monthExpense ?? 0;
  const monthNet = monthIncome - monthExpense;
  const chartData = (financeSummary?.dailyBreakdown || []).map((item) => ({
    ...item,
    shortDate: formatShortDate(item.date),
  }));
  const hasChartData = chartData.some((item) => item.income > 0 || item.expense > 0 || item.net !== 0);

  const financeChartConfig = {
    income: { label: "Ingresos", color: "#22c55e" },
    expense: { label: "Gastos", color: "#f97316" },
    net: { label: "Ganancia", color: "#2563eb" },
  } as const;

  const topOverviewCards = [
    {
      title: "Clientes con membresía",
      value: branchStats?.uniqueActiveCustomers ?? 0,
      helper: branchStats && branchStats.totalCustomers > branchStats.uniqueActiveCustomers
        ? `${branchStats.totalCustomers} clientes registrados`
        : "Clientes con membresía activa hoy",
      icon: Users,
      tint: "from-sky-500/15 via-sky-500/5 to-transparent",
      iconClassName: "text-sky-600 dark:text-sky-400",
      valueTestId: "text-clients-count",
    },
    {
      title: "Membresías activas",
      value: branchStats?.activeMemberships ?? 0,
      helper: "Planes activos cobrando valor al negocio",
      icon: CreditCard,
      tint: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      valueTestId: "text-memberships-count",
    },
    {
      title: "Reservas de hoy",
      value: reservationStats?.todayCount ?? 0,
      helper: "Citas o clases confirmadas para hoy",
      icon: CalendarDays,
      tint: "from-violet-500/15 via-violet-500/5 to-transparent",
      iconClassName: "text-violet-600 dark:text-violet-400",
      valueTestId: "text-reservations-today",
    },
    {
      title: "Ingresos del mes",
      value: formatCurrencyMx(monthIncome),
      helper: "Cobros registrados en Caja",
      icon: ArrowUpRight,
      tint: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      valueTestId: "text-income-month-overview",
    },
  ];

  const commercialHighlights = [
    {
      title: "Clientes recurrentes",
      value: dashboardMetrics?.activeClients ?? 0,
      helper: "Activos o VIP en tu CRM",
      icon: Sparkles,
      accent: "text-fuchsia-600 dark:text-fuchsia-400",
    },
    {
      title: "Promociones activas",
      value: dashboardMetrics?.activePromotions ?? 0,
      helper: "Campañas visibles hoy",
      icon: Tag,
      accent: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Reseñas recientes",
      value: dashboardMetrics?.recentReviews ?? 0,
      helper: "Últimos 30 días",
      icon: MessageCircle,
      accent: "text-cyan-600 dark:text-cyan-400",
    },
    {
      title: "Clases por agotarse",
      value: dashboardMetrics?.lowClassesClients ?? 0,
      helper: "Clientes listos para renovar",
      icon: Gift,
      accent: "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-14 top-8 h-36 w-36 rounded-full bg-sky-400/15 blur-3xl" />
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
        </div>

        <div className="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1.45fr)_380px]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={branchStatus} testId="badge-summary-status" />
              <Badge variant="outline" className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${currentStatus.surface} ${currentStatus.accent}`}>
                Vista ejecutiva
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Resumen comercial</p>
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Tu sucursal, clientes y agenda en una sola vista.
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground" data-testid="text-status-description">
                  {currentStatus.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {topOverviewCards.map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-2xl border border-white/70 bg-gradient-to-br ${item.tint} p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{item.title}</p>
                        {isLoading || reservationLoading ? (
                          <Skeleton className="mt-3 h-8 w-20 rounded-lg" />
                        ) : (
                          <p className="mt-3 text-3xl font-semibold tracking-tight" data-testid={item.valueTestId}>
                            {item.value}
                          </p>
                        )}
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 shadow-sm dark:bg-slate-950/60">
                        <item.icon className={`h-5 w-5 ${item.iconClassName}`} />
                      </div>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="border-white/70 bg-white/85 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-violet-500" />
                  Próxima reserva
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reservationLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ) : reservationStats?.nextBooking ? (
                  <div className="space-y-1">
                    <p className="text-xl font-semibold leading-tight" data-testid="text-next-reservation">
                      {reservationStats.nextBooking.className}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {reservationStats.nextBooking.startTime} · {formatShortDate(reservationStats.nextBooking.bookingDate)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground" data-testid="text-next-reservation">Sin reservas próximas</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Cuando entren nuevas citas o clases, aparecerán aquí.</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-sky-50 p-3 dark:bg-sky-950/30">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Próximas</p>
                    <p className="mt-2 text-xl font-semibold">{dashboardMetrics?.upcomingBookings ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/30">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Canceladas</p>
                    <p className="mt-2 text-xl font-semibold">{dashboardMetrics?.cancelledBookings ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/30">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">No show</p>
                    <p className="mt-2 text-xl font-semibold">{dashboardMetrics?.noShowBookings ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/85 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-sky-500" />
                  Perfil público
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ruta visible</p>
                  <p className="mt-2 text-base font-semibold" data-testid="text-branch-slug-dashboard">
                    /app/{branchSlug}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Comparte este enlace con tus clientes para reservas y contenido.</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-between rounded-2xl border-border/70 bg-background/80"
                  onClick={() => window.open(`/app/${branchSlug}`, "_blank")}
                  data-testid="button-view-public-page"
                >
                  Ver perfil público
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Ingresos del mes</p>
                {financeLoading ? <Skeleton className="mt-3 h-8 w-32" /> : <p className="mt-3 text-3xl font-semibold">{formatCurrencyMx(monthIncome)}</p>}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Ventas o cobros registrados en Caja durante el mes actual.</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Gastos del mes</p>
                {financeLoading ? <Skeleton className="mt-3 h-8 w-32" /> : <p className="mt-3 text-3xl font-semibold">{formatCurrencyMx(monthExpense)}</p>}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
                <ArrowDownRight className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Egresos operativos capturados por tu equipo en este periodo.</p>
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-sky-50/40 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Ganancia del mes</p>
                {financeLoading ? <Skeleton className="mt-3 h-8 w-32" /> : <p className="mt-3 text-3xl font-semibold">{formatCurrencyMx(monthNet)}</p>}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
                <Wallet className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Diferencia simple entre ingresos y gastos. No sustituye contabilidad fiscal.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <Card className="border-white/70 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-slate-950/70">
          <CardHeader className="space-y-2 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Movimiento de los últimos 30 días
                </CardTitle>
                <p className="text-sm text-muted-foreground">Visualiza ingresos, gastos y ganancia neta con la información ya capturada en Caja.</p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                Últimos 30 días
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {financeLoading ? (
              <Skeleton className="h-[320px] w-full rounded-2xl" />
            ) : hasChartData ? (
              <ChartContainer config={financeChartConfig} className="h-[320px] w-full">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="shortDate" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={62}
                    tickFormatter={(value: number) => formatCompactNumber(value)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-[160px] items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-medium text-foreground">{formatCurrencyMx(Number(value) || 0)}</span>
                          </div>
                        )}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.shortDate || ""}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="var(--color-income)"
                    fill="url(#incomeFill)"
                    strokeWidth={2.4}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="var(--color-expense)"
                    fill="url(#expenseFill)"
                    strokeWidth={2.1}
                    activeDot={{ r: 4 }}
                  />
                  <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2.2} dot={false} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Aún no hay suficiente movimiento para la gráfica</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Registra ingresos o gastos en la pestaña Caja y aquí verás la tendencia comercial de tu sucursal en tiempo real.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-white/70 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-fuchsia-500" />
                Tracción comercial
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {commercialHighlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.title}</p>
                      <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                    </div>
                    <item.icon className={`h-5 w-5 ${item.accent}`} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{item.helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Lo que más se mueve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Top ingresos</p>
                  <span className="text-[11px] text-muted-foreground">Mes actual</span>
                </div>
                {financeSummary?.topIncomeCategories?.length ? (
                  financeSummary.topIncomeCategories.slice(0, 3).map((item) => (
                    <div key={`income-${item.category}`} className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/20">
                      <span className="text-sm font-medium">{formatCategoryLabel(item.category)}</span>
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrencyMx(item.total)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    Aún no hay ingresos suficientes para destacar categorías.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Top gastos</p>
                  <span className="text-[11px] text-muted-foreground">Mes actual</span>
                </div>
                {financeSummary?.topExpenseCategories?.length ? (
                  financeSummary.topExpenseCategories.slice(0, 3).map((item) => (
                    <div key={`expense-${item.category}`} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/70 px-3 py-2 dark:bg-amber-950/20">
                      <span className="text-sm font-medium">{formatCategoryLabel(item.category)}</span>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{formatCurrencyMx(item.total)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    Todavía no hay gastos categorizados para mostrar.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <NotificationsPanel
          title="Notificaciones de la sucursal"
          limit={5}
          emptyMessage="Sin notificaciones recientes para tu sucursal."
          testIdPrefix="branch-notifications"
        />

        <TodayBirthdaysSection
          alerts={alerts}
          branchName={branchName}
          whatsappTemplates={whatsappTemplates || {}}
          onViewClient={onViewClient}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <AlertsSection
          alerts={alerts}
          isLoading={alertsLoading}
          branchName={branchName}
          whatsappTemplates={whatsappTemplates || {}}
          onViewClient={onViewClient}
        />

        <div className="grid gap-4">
          <Card className="border-white/70 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Estado de la sucursal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={branchStatus} testId="badge-summary-status-compact" />
                <p className={`text-sm ${currentStatus.accent}`}>{currentStatus.label}</p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{currentStatus.description}</p>
            </CardContent>
          </Card>

          <AnnouncementsSection branchId={branchId} />
        </div>
      </div>

      <WhatsAppConfigCard />
    </div>
  );
}

function ResumenTabPremiumCompact({ branchStats, branchStatus, branchSlug, branchId, branchName, isLoading, reservationStats, reservationLoading, dashboardMetrics, alerts, alertsLoading, onViewClient }: {
  branchStats: { activeMemberships: number; uniqueActiveCustomers: number; totalCustomers: number } | undefined;
  branchStatus: string;
  branchSlug: string;
  branchId: string;
  branchName: string;
  isLoading: boolean;
  reservationStats: ReservationStats | undefined;
  reservationLoading: boolean;
  dashboardMetrics: BranchDashboardMetrics | undefined;
  alerts: AlertsData | undefined;
  alertsLoading: boolean;
  onViewClient: (userId: string) => void;
}) {
  const { data: whatsappTemplates } = useQuery<WhatsAppTemplates>({
    queryKey: ["/api/branch/whatsapp-templates"],
  });
  const financeFrom = getIsoDateDaysAgo(29);
  const financeTo = getIsoDateDaysAgo(0);
  const { data: financeSummary, isLoading: financeLoading } = useQuery<BranchFinanceSummary>({
    queryKey: ["/api/branch/finance/summary", "overview", financeFrom, financeTo],
    queryFn: async () => {
      const res = await fetch(`/api/branch/finance/summary?from=${financeFrom}&to=${financeTo}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar el resumen financiero");
      }
      return res.json();
    },
    staleTime: 60_000,
  });

  const statusConfig: Record<string, { label: string; description: string; accent: string; surface: string }> = {
    active: {
      label: "Activa",
      description: "Tu sucursal está operando con normalidad y lista para recibir clientes.",
      accent: "text-emerald-600 dark:text-emerald-400",
      surface: "bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-800/60",
    },
    suspended: {
      label: "Suspendida",
      description: "Hay una restricción temporal. Conviene revisarla cuanto antes.",
      accent: "text-amber-600 dark:text-amber-400",
      surface: "bg-amber-500/10 border-amber-200/70 dark:border-amber-800/60",
    },
    blacklisted: {
      label: "Bloqueada",
      description: "La sucursal necesita atención administrativa antes de volver a operar.",
      accent: "text-rose-600 dark:text-rose-400",
      surface: "bg-rose-500/10 border-rose-200/70 dark:border-rose-800/60",
    },
  };

  const currentStatus = statusConfig[branchStatus] || statusConfig.active;
  const monthIncome = financeSummary?.monthIncome ?? 0;
  const monthExpense = financeSummary?.monthExpense ?? 0;
  const monthNet = monthIncome - monthExpense;
  const chartData = (financeSummary?.dailyBreakdown || []).map((item) => ({
    ...item,
    shortDate: formatShortDate(item.date),
  }));
  const hasChartData = chartData.some((item) => item.income > 0 || item.expense > 0 || item.net !== 0);

  const financeChartConfig = {
    income: { label: "Ingresos", color: "#22c55e" },
    expense: { label: "Gastos", color: "#f97316" },
    net: { label: "Ganancia", color: "#2563eb" },
  } as const;

  const topOverviewCards = [
    {
      title: "Clientes con membresía",
      value: branchStats?.uniqueActiveCustomers ?? 0,
      helper: branchStats && branchStats.totalCustomers > branchStats.uniqueActiveCustomers
        ? `${branchStats.totalCustomers} clientes registrados`
        : "Clientes con membresía activa hoy",
      icon: Users,
      tint: "from-sky-500/15 via-sky-500/5 to-transparent",
      iconClassName: "text-sky-600 dark:text-sky-400",
      valueTestId: "text-clients-count",
    },
    {
      title: "Membresías activas",
      value: branchStats?.activeMemberships ?? 0,
      helper: "Planes activos cobrando valor al negocio",
      icon: CreditCard,
      tint: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      valueTestId: "text-memberships-count",
    },
    {
      title: "Reservas de hoy",
      value: reservationStats?.todayCount ?? 0,
      helper: "Citas o clases confirmadas para hoy",
      icon: CalendarDays,
      tint: "from-violet-500/15 via-violet-500/5 to-transparent",
      iconClassName: "text-violet-600 dark:text-violet-400",
      valueTestId: "text-reservations-today",
    },
  ];

  const commercialHighlights = [
    {
      title: "Clientes recurrentes",
      value: dashboardMetrics?.activeClients ?? 0,
      helper: "Activos o VIP en tu CRM",
      icon: Sparkles,
      accent: "text-fuchsia-600 dark:text-fuchsia-400",
    },
    {
      title: "Promociones activas",
      value: dashboardMetrics?.activePromotions ?? 0,
      helper: "Campañas visibles hoy",
      icon: Tag,
      accent: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Reseñas recientes",
      value: dashboardMetrics?.recentReviews ?? 0,
      helper: "Últimos 30 días",
      icon: MessageCircle,
      accent: "text-cyan-600 dark:text-cyan-400",
    },
    {
      title: "Clases por agotarse",
      value: dashboardMetrics?.lowClassesClients ?? 0,
      helper: "Clientes listos para renovar",
      icon: Gift,
      accent: "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[22px] border border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-4 h-24 w-24 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={branchStatus} testId="badge-summary-status" />
              <Badge variant="outline" className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${currentStatus.surface} ${currentStatus.accent}`}>
                Vista ejecutiva
              </Badge>
            </div>

            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">Resumen comercial</p>
                <h2 className="max-w-3xl text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  Así va {branchName}
                </h2>
                <p className="max-w-2xl text-sm text-muted-foreground" data-testid="text-status-description">
                  {currentStatus.description}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Perfil público</p>
                <p className="mt-1 font-medium text-foreground">/app/{branchSlug}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {topOverviewCards.map((item) => (
                <div
                  key={item.title}
                  className={`min-h-[102px] rounded-2xl border border-white/70 bg-gradient-to-br ${item.tint} p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{item.title}</p>
                      {isLoading || reservationLoading ? (
                        <Skeleton className="mt-2.5 h-7 w-20 rounded-lg" />
                      ) : (
                        <p className="mt-2.5 text-xl font-semibold tracking-tight md:text-2xl" data-testid={item.valueTestId}>
                          {item.value}
                        </p>
                      )}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm dark:bg-slate-950/60">
                      <item.icon className={`h-4.5 w-4.5 ${item.iconClassName}`} />
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <Card className="border-white/70 bg-white/85 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-violet-500" />
                  Próxima reserva
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reservationLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ) : reservationStats?.nextBooking ? (
                  <div className="space-y-1">
                    <p className="text-lg font-semibold leading-tight" data-testid="text-next-reservation">
                      {reservationStats.nextBooking.className}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {reservationStats.nextBooking.startTime} · {formatShortDate(reservationStats.nextBooking.bookingDate)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-3.5">
                    <p className="text-sm font-medium text-foreground" data-testid="text-next-reservation">Sin reservas próximas</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Cuando entren nuevas citas o clases, aparecerán aquí.</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-2xl bg-sky-50 p-2.5 dark:bg-sky-950/30">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próximas</p>
                    <p className="mt-1.5 text-lg font-semibold">{dashboardMetrics?.upcomingBookings ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-2.5 dark:bg-amber-950/30">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Canceladas</p>
                    <p className="mt-1.5 text-lg font-semibold">{dashboardMetrics?.cancelledBookings ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-2.5 dark:bg-rose-950/30">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">No show</p>
                    <p className="mt-1.5 text-lg font-semibold">{dashboardMetrics?.noShowBookings ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/85 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-sky-500" />
                  Perfil público
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl bg-muted/40 p-3.5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ruta visible</p>
                  <p className="mt-2 text-sm font-semibold" data-testid="text-branch-slug-dashboard">
                    /app/{branchSlug}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Comparte este enlace con tus clientes para reservas y contenido.</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-between rounded-2xl border-border/70 bg-background/80"
                  onClick={() => window.open(`/app/${branchSlug}`, "_blank")}
                  data-testid="button-view-public-page"
                >
                  Ver perfil público
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Ingresos del mes</p>
                {financeLoading ? <Skeleton className="mt-2.5 h-7 w-28" /> : <p className="mt-2.5 text-2xl font-semibold">{formatCurrencyMx(monthIncome)}</p>}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10">
                <ArrowUpRight className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">Ventas o cobros registrados en Caja durante el mes actual.</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Gastos del mes</p>
                {financeLoading ? <Skeleton className="mt-2.5 h-7 w-28" /> : <p className="mt-2.5 text-2xl font-semibold">{formatCurrencyMx(monthExpense)}</p>}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10">
                <ArrowDownRight className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">Egresos operativos capturados por tu equipo en este periodo.</p>
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-sky-50/40 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Ganancia del mes</p>
                {financeLoading ? <Skeleton className="mt-2.5 h-7 w-28" /> : <p className="mt-2.5 text-2xl font-semibold">{formatCurrencyMx(monthNet)}</p>}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10">
                <Wallet className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">Diferencia simple entre ingresos y gastos. No sustituye contabilidad fiscal.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Card className="border-white/70 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Movimiento de los últimos 30 días
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Visualiza ingresos, gastos y ganancia neta con la información ya capturada en Caja.</p>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                  Últimos 30 días
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {financeLoading ? (
                <Skeleton className="h-[248px] w-full rounded-2xl" />
              ) : hasChartData ? (
                <ChartContainer config={financeChartConfig} className="h-[248px] w-full">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="shortDate" tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={62}
                      tickFormatter={(value: number) => formatCompactNumber(value)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex min-w-[160px] items-center justify-between gap-4">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="font-medium text-foreground">{formatCurrencyMx(Number(value) || 0)}</span>
                            </div>
                          )}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.shortDate || ""}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="var(--color-income)"
                      fill="url(#incomeFill)"
                      strokeWidth={2.4}
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      stroke="var(--color-expense)"
                      fill="url(#expenseFill)"
                      strokeWidth={2.1}
                      activeDot={{ r: 4 }}
                    />
                    <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2.2} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[212px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">Aún no hay suficiente movimiento para la gráfica</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Registra ingresos o gastos en la pestaña Caja y aquí verás la tendencia comercial de tu sucursal en tiempo real.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <AlertsSection
            alerts={alerts}
            isLoading={alertsLoading}
            branchName={branchName}
            whatsappTemplates={whatsappTemplates || {}}
            onViewClient={onViewClient}
          />
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Card className="border-white/70 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-fuchsia-500" />
                Tracción comercial
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {commercialHighlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/60 bg-background/70 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.title}</p>
                      <p className="mt-1.5 text-xl font-semibold">{item.value}</p>
                    </div>
                    <item.icon className={`h-4.5 w-4.5 ${item.accent}`} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{item.helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Lo que más se mueve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Top ingresos</p>
                  <span className="text-[11px] text-muted-foreground">Mes actual</span>
                </div>
                {financeSummary?.topIncomeCategories?.length ? (
                  financeSummary.topIncomeCategories.slice(0, 3).map((item) => (
                    <div key={`income-${item.category}`} className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/20">
                      <span className="text-sm font-medium">{formatCategoryLabel(item.category)}</span>
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrencyMx(item.total)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    Aún no hay ingresos suficientes para destacar categorías.
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Top gastos</p>
                  <span className="text-[11px] text-muted-foreground">Mes actual</span>
                </div>
                {financeSummary?.topExpenseCategories?.length ? (
                  financeSummary.topExpenseCategories.slice(0, 3).map((item) => (
                    <div key={`expense-${item.category}`} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/70 px-3 py-2 dark:bg-amber-950/20">
                      <span className="text-sm font-medium">{formatCategoryLabel(item.category)}</span>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{formatCurrencyMx(item.total)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    Todavía no hay gastos categorizados para mostrar.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <NotificationsPanel
            title="Notificaciones de la sucursal"
            limit={5}
            emptyMessage="Sin notificaciones recientes para tu sucursal."
            testIdPrefix="branch-notifications"
          />

          <TodayBirthdaysSection
            alerts={alerts}
            branchName={branchName}
            whatsappTemplates={whatsappTemplates || {}}
            onViewClient={onViewClient}
          />

          <AnnouncementsSection branchId={branchId} />
          <WhatsAppConfigCard />
        </div>
      </div>
    </div>
  );
}

function ResumenTabDesktopSaaS({ branchStats, branchStatus, branchSlug, branchId, branchName, isLoading, reservationStats, reservationLoading, dashboardMetrics, alerts, alertsLoading, onViewClient }: {
  branchStats: { activeMemberships: number; uniqueActiveCustomers: number; totalCustomers: number } | undefined;
  branchStatus: string;
  branchSlug: string;
  branchId: string;
  branchName: string;
  isLoading: boolean;
  reservationStats: ReservationStats | undefined;
  reservationLoading: boolean;
  dashboardMetrics: BranchDashboardMetrics | undefined;
  alerts: AlertsData | undefined;
  alertsLoading: boolean;
  onViewClient: (userId: string) => void;
}) {
  const { data: whatsappTemplates } = useQuery<WhatsAppTemplates>({
    queryKey: ["/api/branch/whatsapp-templates"],
  });
  const { data: branchClients = [], isLoading: branchClientsLoading } = useQuery<BranchClientSummary[]>({
    queryKey: ["/api/branch/clients"],
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const financeFrom = getIsoDateDaysAgo(29);
  const financeTo = getIsoDateDaysAgo(0);
  const { data: financeSummary, isLoading: financeLoading } = useQuery<BranchFinanceSummary>({
    queryKey: ["/api/branch/finance/summary", "overview", financeFrom, financeTo],
    queryFn: async () => {
      const res = await fetch(`/api/branch/finance/summary?from=${financeFrom}&to=${financeTo}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar el resumen financiero");
      }
      return res.json();
    },
    staleTime: 60_000,
  });

  const statusConfig: Record<string, { label: string; description: string; accent: string; surface: string }> = {
    active: {
      label: "Activa",
      description: "Tu sucursal está operando con normalidad y lista para recibir clientes.",
      accent: "text-emerald-600 dark:text-emerald-400",
      surface: "bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-800/60",
    },
    suspended: {
      label: "Suspendida",
      description: "Hay una restricción temporal. Conviene revisarla cuanto antes.",
      accent: "text-amber-600 dark:text-amber-400",
      surface: "bg-amber-500/10 border-amber-200/70 dark:border-amber-800/60",
    },
    blacklisted: {
      label: "Bloqueada",
      description: "La sucursal necesita atención administrativa antes de volver a operar.",
      accent: "text-rose-600 dark:text-rose-400",
      surface: "bg-rose-500/10 border-rose-200/70 dark:border-rose-800/60",
    },
  };

  const currentStatus = statusConfig[branchStatus] || statusConfig.active;
  const monthIncome = financeSummary?.monthIncome ?? 0;
  const monthExpense = financeSummary?.monthExpense ?? 0;
  const monthNet = monthIncome - monthExpense;
  const chartData = (financeSummary?.dailyBreakdown || []).map((item) => ({
    ...item,
    shortDate: formatShortDate(item.date),
  }));
  const hasChartData = chartData.some((item) => item.income > 0 || item.expense > 0 || item.net !== 0);

  const financeChartConfig = {
    income: { label: "Ingresos", color: "#22c55e" },
    expense: { label: "Gastos", color: "#f97316" },
    net: { label: "Ganancia", color: "#2563eb" },
  } as const;
  const clientKpis = useMemo(() => {
    const totalClients = branchClients.length;
    const withActivePlan = branchClients.filter((client) => client.planStatus === "active").length;
    return {
      totalClients,
      withActivePlan,
      withoutActivePlan: Math.max(totalClients - withActivePlan, 0),
    };
  }, [branchClients]);
  const topCardsLoading = isLoading || reservationLoading || financeLoading || branchClientsLoading;

  const topCards = [
    {
      title: "Clientes con membresía",
      value: branchStats?.uniqueActiveCustomers ?? 0,
      helper: branchStats && branchStats.totalCustomers > branchStats.uniqueActiveCustomers
        ? `${branchStats.totalCustomers} registrados`
        : "Activos hoy",
      icon: Users,
      iconClassName: "text-sky-600 dark:text-sky-400",
      tint: "from-sky-500/15 via-sky-500/5 to-transparent",
      testId: "text-clients-count",
    },
    {
      title: "Membresías activas",
      value: branchStats?.activeMemberships ?? 0,
      helper: "Planes vigentes",
      icon: CreditCard,
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      tint: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      testId: "text-memberships-count",
    },
    {
      title: "Reservas de hoy",
      value: reservationStats?.todayCount ?? 0,
      helper: "Agenda confirmada",
      icon: CalendarDays,
      iconClassName: "text-violet-600 dark:text-violet-400",
      tint: "from-violet-500/15 via-violet-500/5 to-transparent",
      testId: "text-reservations-today",
    },
    {
      title: "Ingresos del mes",
      value: formatCurrencyMx(monthIncome),
      helper: "Cobros en Caja",
      icon: ArrowUpRight,
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      tint: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      testId: "text-income-month-overview",
    },
    {
      title: "Gastos del mes",
      value: formatCurrencyMx(monthExpense),
      helper: "Salidas registradas",
      icon: ArrowDownRight,
      iconClassName: "text-amber-600 dark:text-amber-400",
      tint: "from-amber-500/15 via-amber-500/5 to-transparent",
    },
    {
      title: "Ganancia del mes",
      value: formatCurrencyMx(monthNet),
      helper: "Ingreso menos gasto",
      icon: Wallet,
      iconClassName: "text-sky-600 dark:text-sky-400",
      tint: "from-sky-500/15 via-sky-500/5 to-transparent",
    },
  ];
  const summaryTopCards = [
    {
      ...topCards[0],
      title: "Clientes totales",
      value: clientKpis.totalClients,
      helper: "Registrados en tu sucursal",
      testId: "text-clients-total-overview",
    },
    {
      ...topCards[1],
      title: "Con servicio o plan",
      value: clientKpis.withActivePlan,
      helper: "Con plan activo hoy",
      testId: "text-clients-with-plan-overview",
    },
    {
      title: "Sin servicio o plan",
      value: clientKpis.withoutActivePlan,
      helper: "Sin plan activo",
      icon: UserCircle,
      iconClassName: "text-amber-600 dark:text-amber-400",
      tint: "from-amber-500/15 via-amber-500/5 to-transparent",
      testId: "text-clients-without-plan-overview",
    },
    ...topCards.slice(2),
  ];

  const commercialHighlights = [
    {
      title: "Clientes recurrentes",
      value: dashboardMetrics?.activeClients ?? 0,
      helper: "Activos o VIP en tu CRM",
      icon: Sparkles,
      accent: "text-fuchsia-600 dark:text-fuchsia-400",
    },
    {
      title: "Promociones activas",
      value: dashboardMetrics?.activePromotions ?? 0,
      helper: "Campañas visibles",
      icon: Tag,
      accent: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Reseñas recientes",
      value: dashboardMetrics?.recentReviews ?? 0,
      helper: "Últimos 30 días",
      icon: MessageCircle,
      accent: "text-cyan-600 dark:text-cyan-400",
    },
    {
      title: "Clases por agotarse",
      value: dashboardMetrics?.lowClassesClients ?? 0,
      helper: "Listos para renovar",
      icon: Gift,
      accent: "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-[22px] border border-slate-200/70 bg-white/95 p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={branchStatus} testId="badge-summary-status" />
              <Badge variant="outline" className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${currentStatus.surface} ${currentStatus.accent}`}>
                Resumen ejecutivo
              </Badge>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Así va {branchName}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-status-description">
              {currentStatus.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Perfil público</p>
              <p className="mt-1 font-medium text-foreground">/app/{branchSlug}</p>
            </div>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => window.open(`/app/${branchSlug}`, "_blank")}
              data-testid="button-view-public-page"
            >
              Ver perfil
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {summaryTopCards.map((item) => (
            <div
              key={item.title}
              className={`min-h-[102px] rounded-2xl border border-white/70 bg-gradient-to-br ${item.tint} p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{item.title}</p>
                  {topCardsLoading ? (
                    <Skeleton className="mt-2.5 h-7 w-20 rounded-lg" />
                  ) : (
                    <p className="mt-2.5 truncate text-xl font-semibold tracking-tight md:text-2xl" data-testid={item.testId}>
                      {item.value}
                    </p>
                  )}
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/85 shadow-sm dark:bg-slate-950/60">
                  <item.icon className={`h-4.5 w-4.5 ${item.iconClassName}`} />
                </div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{item.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <Card className="border-white/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <CardHeader className="space-y-2 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Movimiento de los últimos 30 días
                </CardTitle>
                <p className="text-sm text-muted-foreground">Ingresos, gastos y ganancia neta con la información ya capturada en Caja.</p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                Últimos 30 días
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {financeLoading ? (
              <Skeleton className="h-[190px] w-full rounded-2xl" />
            ) : hasChartData ? (
              <ChartContainer config={financeChartConfig} className="h-[190px] w-full">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeFillDesktop" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expenseFillDesktop" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="shortDate" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={62}
                    tickFormatter={(value: number) => formatCompactNumber(value)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-[160px] items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-medium text-foreground">{formatCurrencyMx(Number(value) || 0)}</span>
                          </div>
                        )}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.shortDate || ""}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="var(--color-income)"
                    fill="url(#incomeFillDesktop)"
                    strokeWidth={2.4}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="var(--color-expense)"
                    fill="url(#expenseFillDesktop)"
                    strokeWidth={2.1}
                    activeDot={{ r: 4 }}
                  />
                  <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2.2} dot={false} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[150px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold">Aún no hay suficiente movimiento para la gráfica</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Registra ingresos o gastos en la pestaña Caja y aquí verás la tendencia comercial de tu sucursal.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Card className="border-white/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-violet-500" />
                Próxima reserva
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reservationLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : reservationStats?.nextBooking ? (
                <div className="space-y-1">
                  <p className="text-lg font-semibold leading-tight" data-testid="text-next-reservation">
                    {reservationStats.nextBooking.className}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reservationStats.nextBooking.startTime} · {formatShortDate(reservationStats.nextBooking.bookingDate)}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-3.5">
                  <p className="text-sm font-medium text-foreground" data-testid="text-next-reservation">Sin reservas próximas</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Cuando entren nuevas citas o clases, aparecerán aquí.</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-2xl bg-sky-50 p-2.5 dark:bg-sky-950/30">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próximas</p>
                  <p className="mt-1.5 text-lg font-semibold">{dashboardMetrics?.upcomingBookings ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-2.5 dark:bg-amber-950/30">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Canceladas</p>
                  <p className="mt-1.5 text-lg font-semibold">{dashboardMetrics?.cancelledBookings ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-2.5 dark:bg-rose-950/30">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">No show</p>
                  <p className="mt-1.5 text-lg font-semibold">{dashboardMetrics?.noShowBookings ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-fuchsia-500" />
                Tracción comercial
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {commercialHighlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/60 bg-background/70 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.title}</p>
                      <p className="mt-1.5 text-xl font-semibold">{item.value}</p>
                    </div>
                    <item.icon className={`h-4.5 w-4.5 ${item.accent}`} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{item.helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Top ingresos y gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Top ingresos</p>
                  <span className="text-[11px] text-muted-foreground">Mes actual</span>
                </div>
                {financeSummary?.topIncomeCategories?.length ? (
                  financeSummary.topIncomeCategories.slice(0, 3).map((item) => (
                    <div key={`income-dashboard-${item.category}`} className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/20">
                      <span className="text-sm font-medium">{formatCategoryLabel(item.category)}</span>
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrencyMx(item.total)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    Aún no hay ingresos suficientes para destacar categorías.
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Top gastos</p>
                  <span className="text-[11px] text-muted-foreground">Mes actual</span>
                </div>
                {financeSummary?.topExpenseCategories?.length ? (
                  financeSummary.topExpenseCategories.slice(0, 3).map((item) => (
                    <div key={`expense-dashboard-${item.category}`} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/70 px-3 py-2 dark:bg-amber-950/20">
                      <span className="text-sm font-medium">{formatCategoryLabel(item.category)}</span>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{formatCurrencyMx(item.total)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    Todavía no hay gastos categorizados para mostrar.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Operación rápida</h3>
            <p className="text-sm text-muted-foreground">Accesos cortos para lo que tu equipo revisa más seguido.</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <AnnouncementsSection branchId={branchId} />
          <WhatsAppConfigCard />
        </div>
      </section>
    </div>
  );
}

function WhatsAppConfigCard() {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: branchInfo, isLoading } = useQuery<{ whatsappNumber: string | null }>({
    queryKey: ["/api/branch/info"],
  });

  function handleEdit() {
    setInputValue(branchInfo?.whatsappNumber || "");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/branch/profile", { whatsappNumber: inputValue.trim() || null });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/info"] });
      toast({ title: "WhatsApp actualizado" });
      setEditing(false);
    } catch (err: any) {
      toast({ title: err.message || "Error al guardar", variant: "destructive" });
    } finally { setSaving(false); }
  }

  const currentNumber = branchInfo?.whatsappNumber;
  const displayNumber = currentNumber
    ? currentNumber.startsWith("52") ? `+${currentNumber}` : `+52${currentNumber}`
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          WhatsApp de contacto
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <div className="h-8 bg-muted rounded animate-pulse" />
        ) : editing ? (
          <div className="flex gap-2 items-center">
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Ej: 5512345678 o 525512345678"
              className="text-sm"
              data-testid="input-whatsapp-number"
            />
            <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-whatsapp">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              {currentNumber ? (
                <p className="text-sm font-medium text-green-700 dark:text-green-400" data-testid="text-whatsapp-configured">
                  {displayNumber}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-whatsapp-not-configured">
                  Sin número configurado
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentNumber ? "Los clientes pueden contactarte por WhatsApp" : "Configura tu número para que los clientes te contacten"}
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={handleEdit} data-testid="button-edit-whatsapp">
              {currentNumber ? "Editar" : "Agregar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function PromocionesTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: promos = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/branch/promotions"] });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast({ title: "Solo JPG, PNG o WebP", variant: "destructive" }); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Máximo 5MB", variant: "destructive" }); return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function resetForm() {
    setTitle(""); setDescription(""); setStartDate(""); setEndDate("");
    setIsGlobal(false); setImageFile(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowForm(false);
  }

  async function handleSubmit() {
    if (!title.trim()) { toast({ title: "El título es requerido", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      if (description.trim()) fd.append("description", description.trim());
      if (startDate) fd.append("startDate", startDate);
      if (endDate) fd.append("endDate", endDate);
      fd.append("isGlobal", String(isGlobal));
      if (imageFile) fd.append("image", imageFile);
      const res = await fetch("/api/promotions", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Error"); }
      toast({ title: "Promoción creada" });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/promotions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/global"] });
      resetForm();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  async function handleToggle(id: string, field: "isActive" | "isGlobal", current: boolean) {
    try {
      await apiRequest("PATCH", `/api/promotions/${id}`, { [field]: !current });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/promotions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/global"] });
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiRequest("DELETE", `/api/promotions/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/branch/promotions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/global"] });
      toast({ title: "Promoción eliminada" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    } finally { setDeleteId(null); }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4 p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Promociones</h2>
          <p className="text-sm text-muted-foreground">Crea ofertas visibles en tu perfil y en la app global</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-promotion">
          <Plus className="h-4 w-4 mr-2" /> Nueva promoción
        </Button>
      </div>

      {showForm && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nueva promoción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="promo-title">Título *</Label>
              <Input id="promo-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: 20% de descuento en membresía mensual" data-testid="input-promo-title" />
            </div>
            <div>
              <Label htmlFor="promo-desc">Descripción</Label>
              <Textarea id="promo-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles de la promoción..." rows={3} data-testid="input-promo-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="promo-start">Fecha de inicio</Label>
                <Input id="promo-start" type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)} data-testid="input-promo-start-date" />
              </div>
              <div>
                <Label htmlFor="promo-end">Fecha de fin</Label>
                <Input id="promo-end" type="date" value={endDate} min={startDate || today} onChange={e => setEndDate(e.target.value)} data-testid="input-promo-end-date" />
              </div>
            </div>
            <div>
              <Label>Imagen (opcional)</Label>
              <div
                className="mt-1 border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-promo-image"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="mx-auto max-h-32 rounded object-cover" />
                ) : (
                  <div className="text-muted-foreground text-sm">
                    <ImagePlus className="h-8 w-8 mx-auto mb-1 opacity-40" />
                    Haz clic para subir imagen
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} data-testid="input-promo-image-file" />
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Globe className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Mostrar en app global</p>
                <p className="text-xs text-muted-foreground">Visible para todos los clientes en la sección "Promociones"</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGlobal(!isGlobal)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isGlobal ? "bg-blue-500" : "bg-muted-foreground/30"}`}
                data-testid="toggle-promo-global"
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isGlobal ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1" data-testid="button-submit-promo">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar promoción
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={submitting} data-testid="button-cancel-promo">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : promos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Tag className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">Sin promociones</p>
            <p className="text-sm text-muted-foreground mt-1">Crea tu primera promoción para atraer más clientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promos.map((promo: any) => {
            const isExpired = promo.endDate && promo.endDate < today;
            return (
              <Card key={promo.id} className={`overflow-hidden ${!promo.isActive || isExpired ? "opacity-60" : ""}`} data-testid={`card-promo-${promo.id}`}>
                <div className="flex">
                  {promo.imageUrl && (
                    <img src={promo.imageUrl} alt={promo.title} className="w-28 h-full object-cover flex-shrink-0" style={{ minHeight: 96 }} />
                  )}
                  <CardContent className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" data-testid={`text-promo-title-${promo.id}`}>{promo.title}</p>
                        {promo.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{promo.description}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {promo.endDate && (
                            <Badge variant={isExpired ? "destructive" : "outline"} className="text-xs">
                              {isExpired ? "Vencida" : `Hasta ${promo.endDate}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          title={promo.isActive ? "Desactivar" : "Activar"}
                          onClick={() => handleToggle(promo.id, "isActive", promo.isActive)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${promo.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-muted text-muted-foreground"}`}
                          data-testid={`toggle-active-${promo.id}`}
                        >
                          {promo.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {promo.isActive ? "Activa" : "Inactiva"}
                        </button>
                        <button
                          title={promo.isGlobal ? "Quitar de app global" : "Mostrar en app global"}
                          onClick={() => handleToggle(promo.id, "isGlobal", promo.isGlobal)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${promo.isGlobal ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30" : "bg-muted text-muted-foreground"}`}
                          data-testid={`toggle-global-${promo.id}`}
                        >
                          <Globe className="h-3 w-3" />
                          {promo.isGlobal ? "Global" : "Solo perfil"}
                        </button>
                        <button
                          onClick={() => setDeleteId(promo.id)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 transition-colors"
                          data-testid={`button-delete-promo-${promo.id}`}
                        >
                          <Trash2 className="h-3 w-3" /> Eliminar
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar promoción?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConfigurationTab({
  branchName,
  branchSlug,
  refetchAuth,
  onOpenPublicProfileSettings,
  onOpenMyProfile,
}: {
  branchName: string;
  branchSlug: string;
  refetchAuth: () => void | Promise<unknown>;
  onOpenPublicProfileSettings: () => void;
  onOpenMyProfile: () => void;
}) {
  const { toast } = useToast();
  const [draftName, setDraftName] = useState(branchName);

  useEffect(() => {
    setDraftName(branchName);
  }, [branchName]);

  const renameBranchMutation = useMutation({
    mutationFn: async (nextName: string) => {
      const resp = await apiRequest("PATCH", "/api/branch/profile", {
        name: nextName,
      });
      return resp.json();
    },
    onSuccess: async () => {
      await Promise.resolve(refetchAuth());
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Nombre de sucursal actualizado" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "No se pudo actualizar el nombre de la sucursal",
        variant: "destructive",
      });
    },
  });

  const hasNameChanged = draftName.trim() !== branchName.trim();

  return (
    <div className="space-y-4" data-testid="branch-settings-tab">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuración
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Administra los datos visibles de tu sucursal y accede rápidamente a tu perfil y seguridad.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="border-border/70 shadow-sm" data-testid="card-branch-settings">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Información de la sucursal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch-official-name">Nombre oficial</Label>
              <Input
                id="branch-official-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Nombre visible de tu sucursal"
                data-testid="input-branch-official-name"
              />
              <p className="text-xs text-muted-foreground">
                Este nombre se reflejará en tu dashboard, perfil público, app móvil y vista de Super Admin.
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">Perfil público</p>
              <p className="mt-1 text-muted-foreground">
                {branchSlug ? `/app/${branchSlug}` : "Tu enlace público estará disponible cuando exista un slug"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Aquí solo puedes cambiar el nombre oficial. El slug, estado y permisos administrativos siguen protegidos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => renameBranchMutation.mutate(draftName.trim())}
                disabled={!draftName.trim() || !hasNameChanged || renameBranchMutation.isPending}
                data-testid="button-save-branch-official-name"
              >
                {renameBranchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar nombre
              </Button>
              <Button
                variant="outline"
                onClick={onOpenPublicProfileSettings}
                data-testid="button-open-public-profile-settings"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir perfil público
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm" data-testid="card-profile-security-shortcut">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Mi perfil y seguridad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reutiliza las funciones existentes para actualizar tu nombre, apellido, teléfono personal, correo de acceso y contraseña.
            </p>
            <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>Incluye:</p>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                <li>Editar nombre, apellido y teléfono personal</li>
                <li>Cambiar correo de acceso</li>
                <li>Cambiar contraseña</li>
              </ul>
            </div>
            <Button onClick={onOpenMyProfile} data-testid="button-open-my-profile-security">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir a mi perfil y seguridad
            </Button>
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
  const [reservationFocus, setReservationFocus] = useState<ReservationNotificationTarget | null>(null);
  const [clientFocus, setClientFocus] = useState<ClientNotificationTarget | null>(null);

  const branchName = user?.branch?.name || "Tu Sucursal";
  const branchSlug = user?.branch?.slug || "";
  const branchStatus = user?.branch?.status || "active";
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

  const { data: dashboardMetrics } = useQuery<BranchDashboardMetrics>({
    queryKey: ["/api/branch/dashboard-metrics"],
    enabled: !!user?.branchId,
  });

  const endImpersonateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/superadmin/impersonate/end");
    },
    onSuccess: () => {
      queryClient.clear();
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

  function handleViewClient(userId: string) {
    if (!userId) {
      return;
    }

    setClientFocus({
      userId,
      nonce: Date.now(),
    });
    setActiveTab("clientes");
  }

  function handleOpenNotificationClient(notification: NotificationItem) {
    const data = notification.data && typeof notification.data === "object" ? notification.data : {};
    const clientUserId =
      typeof data.clientUserId === "string" && data.clientUserId
        ? data.clientUserId
        : typeof data.userId === "string" && data.userId
        ? data.userId
        : null;

    if (!clientUserId) {
      toast({
        title: "Cliente no localizado",
        description: "No pudimos localizar este cliente.",
        variant: "destructive",
      });
      return;
    }

    handleViewClient(clientUserId);
  }

  function handleOpenBranchNotification(notification: NotificationItem) {
    const data = notification.data && typeof notification.data === "object" ? notification.data : {};
    const reservationId =
      typeof data.reservationId === "string" && data.reservationId
        ? data.reservationId
        : typeof data.bookingId === "string" && data.bookingId
        ? data.bookingId
        : null;
    const classScheduleId =
      typeof data.classScheduleId === "string" && data.classScheduleId
        ? data.classScheduleId
        : typeof data.classId === "string" && data.classId
        ? data.classId
        : null;
    const reservationDate =
      typeof data.reservationDate === "string" && data.reservationDate
        ? data.reservationDate
        : typeof data.bookingDate === "string" && data.bookingDate
        ? data.bookingDate
        : typeof data.date === "string" && data.date
        ? data.date
        : null;
    const clientUserId =
      typeof data.clientUserId === "string" && data.clientUserId
        ? data.clientUserId
        : typeof data.userId === "string" && data.userId
        ? data.userId
        : null;
    const isReservationNotification =
      data.notificationAction === "open_reservation" ||
      notification.type === "booking_created" ||
      notification.type === "booking_cancelled";

    if (isReservationNotification) {
      if (!classScheduleId || !reservationDate || (!reservationId && !clientUserId)) {
        toast({
          title: "Reserva no localizada",
          description: "No pudimos localizar esta reserva.",
          variant: "destructive",
        });
        return;
      }

      setReservationFocus({
        bookingId: reservationId,
        clientUserId,
        classScheduleId,
        bookingDate: reservationDate,
        nonce: Date.now(),
      });
      setActiveTab("reservas");
      return;
    }

    if (clientUserId || data.notificationAction === "open_client") {
      if (clientUserId) {
        handleViewClient(clientUserId);
        return;
      }

      setActiveTab("clientes");
      return;
    }

    toast({
      title: notification.title,
      description: notification.message,
    });
  }

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
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-4 py-4 lg:px-6">
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
          <div className="flex items-center gap-2">
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium text-foreground">{user?.name || user?.email || "Administrador"}</p>
              <p className="text-xs text-muted-foreground">{user?.email || "Sucursal"}</p>
            </div>
            <StatusBadge status={branchStatus} />
            <NotificationsPanel
              title="Alertas operativas"
              limit={5}
              testIdPrefix="branch-notifications"
              variant="bell"
              pollingMs={30000}
              onOpenNotification={handleOpenBranchNotification}
              onOpenClientNotification={handleOpenNotificationClient}
            />
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

      <main className="mx-auto max-w-[1680px] px-4 py-4 lg:px-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <div className="overflow-x-auto pb-1 lg:hidden">
            <TabsList className="w-full sm:w-auto" data-testid="tabs-dashboard-nav">
              {DASHBOARD_NAV_TABS.map((tab) => (
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

          <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
            <aside className="hidden lg:block lg:sticky lg:top-24">
              <div className="rounded-[28px] border border-slate-800/80 bg-slate-950 px-4 py-5 text-white shadow-[0_22px_70px_-38px_rgba(15,23,42,0.65)]">
                <div className="flex items-center gap-3 px-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-100">
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Webcool</p>
                    <p className="text-xs text-slate-400">Panel de sucursal</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <p className="text-sm font-medium text-white">{branchName}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={branchStatus} />
                  </div>
                </div>

                <TabsList className="mt-4 flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0" data-testid="tabs-dashboard-nav-desktop">
                  {DASHBOARD_NAV_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="h-auto w-full justify-start gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm"
                      data-testid={`tab-desktop-${tab.value}`}
                    >
                      <tab.icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="mb-4 hidden items-center justify-between rounded-[26px] border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/75 lg:flex">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dashboard de sucursal</p>
                  <h2 className="text-lg font-semibold text-foreground">Resumen operativo y comercial</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded-full border border-border/70 bg-background px-3 py-1.5">Sucursal: {branchName}</span>
                  <span className="rounded-full border border-border/70 bg-background px-3 py-1.5">{user?.name || user?.email || "Administrador"}</span>
                </div>
              </div>

              <TabsContent value="resumen" className="mt-0">
                <ResumenTabDesktopSaaS
                  branchStats={branchStats}
                  branchStatus={branchStatus}
                  branchSlug={branchSlug}
                  branchId={user?.branchId || ""}
                  branchName={branchName}
                  isLoading={statsLoading}
                  reservationStats={reservationStats}
                  reservationLoading={reservationLoading}
                  dashboardMetrics={dashboardMetrics}
                  alerts={alerts}
                  alertsLoading={alertsLoading}
                  onViewClient={handleViewClient}
                />
              </TabsContent>

              <TabsContent value="clientes" className="mt-0">
                <ClientesTab focusRequest={clientFocus} />
              </TabsContent>

              <TabsContent value="membresias" className="mt-0">
                <MembresiasTab />
              </TabsContent>

              <TabsContent value="caja" className="mt-0">
                <CajaTab />
              </TabsContent>

              <TabsContent value="reservas" className="mt-0">
                <ReservasTab focusRequest={reservationFocus} />
              </TabsContent>

              <TabsContent value="contenido" className="mt-0">
                <ContenidoTab />
              </TabsContent>

              <TabsContent value="perfil" className="mt-0">
                <PerfilPublicoTab />
              </TabsContent>

              <TabsContent value="configuracion" className="mt-0">
                <ConfigurationTab
                  branchName={branchName}
                  branchSlug={branchSlug}
                  refetchAuth={refetch}
                  onOpenPublicProfileSettings={() => setActiveTab("perfil")}
                  onOpenMyProfile={() => setLocation("/profile")}
                />
              </TabsContent>

              <TabsContent value="promociones" className="mt-0">
                <PromocionesTab />
              </TabsContent>

              <TabsContent value="tv" className="mt-0">
                <TvModeTab />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
