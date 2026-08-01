import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Calendar,
  Cake,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Package2,
  ShoppingCart,
  Trash2,
  Trophy,
  Truck,
  UserPlus,
  Wallet,
  XCircle,
} from "lucide-react";
import { apiRequest, fetchJson, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

export type NotificationItem = {
  id: string;
  recipientUserId: string | null;
  branchId: string | null;
  roleTarget: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
  readCount: number;
};

type NotificationFilter = "all" | "unread" | "read";
type NotificationsPanelVariant = "card" | "bell";

const FULL_PAGE_SIZE = 10;
const DEFAULT_POLLING_MS = 30000;

function invalidateNotifications() {
  queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && (query.queryKey[0] as string).startsWith("/api/notifications"),
  });
}

function formatNotificationDate(date: string) {
  return new Date(date).toLocaleString("es-MX", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrencyMx(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatRelativeNotificationDate(date: string) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = then - now;
  const diffMinutes = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);
  const formatter = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }
  return formatter.format(diffDays, "day");
}

function normalizePhoneMX(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("521") && digits.length === 13) return `52${digits.slice(3)}`;
  if (digits.startsWith("52") && digits.length >= 12) return digits;
  if (digits.length === 10) return `52${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `52${digits.slice(1)}`;
  return digits;
}

function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalized = normalizePhoneMX(phone);
  if (!normalized || !message.trim()) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function getNotificationData(notification: NotificationItem) {
  return notification.data && typeof notification.data === "object" ? notification.data : {};
}

function formatReservationNotificationDate(date: string | null | undefined) {
  if (!date) return null;
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

function formatReservationNotificationTime(time: string | null | undefined) {
  if (!time) return null;

  const [hours = "00", minutes = "00"] = String(time).split(":");
  return new Date(`2000-01-01T${hours}:${minutes}:00`).toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

function buildReservationNotificationCopy(notification: NotificationItem) {
  const data = getNotificationData(notification);
  const displayTitle = typeof data.displayTitle === "string" ? data.displayTitle.trim() : "";
  const displayCancelTitle = typeof data.displayCancelTitle === "string" ? data.displayCancelTitle.trim() : "";
  const displayLine1 = typeof data.displayLine1 === "string" ? data.displayLine1.trim() : "";
  const displayLine2 = typeof data.displayLine2 === "string" ? data.displayLine2.trim() : "";

  if ((displayTitle || displayCancelTitle) && (displayLine1 || displayLine2)) {
    return {
      title: notification.type === "booking_cancelled" ? (displayCancelTitle || displayTitle) : (displayTitle || notification.title),
      lines: [displayLine1, displayLine2].filter((line) => line.length > 0),
    };
  }

  const clientName = typeof data.clientName === "string" ? data.clientName.trim() : "";
  const serviceName =
    typeof data.serviceName === "string" && data.serviceName.trim().length > 0
      ? data.serviceName.trim()
      : typeof data.className === "string"
      ? data.className.trim()
      : "";
  const reservationDate =
    typeof data.reservationDate === "string" && data.reservationDate
      ? data.reservationDate
      : typeof data.bookingDate === "string"
      ? data.bookingDate
      : null;
  const reservationTime =
    typeof data.reservationTime === "string" && data.reservationTime
      ? data.reservationTime
      : typeof data.startTime === "string"
      ? data.startTime
      : null;
  const planLabel =
    typeof data.planStatusLabel === "string" && data.planStatusLabel.trim().length > 0
      ? data.planStatusLabel.trim()
      : data.hasActivePlan
      ? typeof data.planName === "string" && data.planName.trim().length > 0
        ? data.planName.trim()
        : "Con servicio o plan activo"
      : "Sin servicio o plan";
  const originLabel =
    typeof data.clientOriginLabel === "string" && data.clientOriginLabel.trim().length > 0
      ? data.clientOriginLabel.trim()
      : data.clientOrigin === "app"
      ? "Se uni\u00F3 desde la app"
      : data.clientOrigin === "counter"
      ? "Cliente de mostrador"
      : data.clientOrigin === "manual"
      ? "Agregado manualmente"
      : null;
  const dateLabel = formatReservationNotificationDate(reservationDate);
  const timeLabel = formatReservationNotificationTime(reservationTime);

  const title =
    clientName && serviceName
      ? `${clientName} ${notification.type === "booking_cancelled" ? "cancel\u00F3" : "reserv\u00F3"} ${serviceName}`
      : notification.title;

  const lines = [
    [dateLabel, timeLabel].filter(Boolean).join(" · "),
    [planLabel, originLabel].filter(Boolean).join(" · "),
  ].filter((line) => line.length > 0);

  return {
    title,
    lines: lines.length > 0 ? lines : [notification.message],
  };
}

function getNotificationCopy(notification: NotificationItem) {
  if (notification.type === "booking_created" || notification.type === "booking_cancelled") {
    return buildReservationNotificationCopy(notification);
  }

  if (notification.type === "birthday_today") {
    const data = getNotificationData(notification);
    const title =
      typeof data.clientName === "string" && data.clientName.trim().length > 0
        ? `🎂 Hoy cumple ${data.clientName.trim()}`
        : notification.title;
    const age = typeof data.birthdayAge === "number" ? data.birthdayAge : null;
    const originLabel =
      typeof data.clientOriginLabel === "string" && data.clientOriginLabel.trim().length > 0
        ? data.clientOriginLabel.trim()
        : "Origen no disponible";
    const phoneLine =
      normalizePhoneMX(typeof data.phone === "string" ? data.phone : null).length >= 12
        ? "WhatsApp disponible"
        : "Sin teléfono registrado";

    return {
      title,
      lines: [
        [age !== null ? `Cumple ${age} años` : "Cumple hoy", originLabel].filter(Boolean).join(" · "),
        phoneLine,
      ],
    };
  }

  if (notification.type === "inventory_low_stock" || notification.type === "inventory_out_of_stock") {
    const data = getNotificationData(notification);
    const hasProductName = typeof data.productName === "string" && data.productName.trim().length > 0;
    const productName = hasProductName ? data.productName.trim() : notification.title;
    const quantityOnHand = typeof data.quantityOnHand === "number" ? data.quantityOnHand : Number(data.quantityOnHand ?? 0);
    const minimumStock = typeof data.minimumStock === "number" ? data.minimumStock : Number(data.minimumStock ?? 0);

    return {
      title: hasProductName
        ? (
          notification.type === "inventory_out_of_stock"
            ? `Sin existencias de ${productName}`
            : `${productName} quedó con ${quantityOnHand} unidades`
        )
        : notification.title,
      lines: [
        notification.type === "inventory_out_of_stock"
          ? `Stock mínimo ${minimumStock}`
          : `Mínimo configurado ${minimumStock}`,
        "Revisa inventario comercial",
      ],
    };
  }

  if (notification.type === "commercial_first_purchase") {
    const data = getNotificationData(notification);
    const hasClientName = typeof data.clientName === "string" && data.clientName.trim().length > 0;
    const clientName = hasClientName ? data.clientName.trim() : null;
    const salesCount = typeof data.salesCount === "number" ? data.salesCount : Number(data.salesCount ?? 0);
    const totalSpentAmount = typeof data.totalSpentAmount === "number" ? data.totalSpentAmount : Number(data.totalSpentAmount ?? 0);

    return {
      title: clientName ? `Primera compra de ${clientName}` : notification.title,
      lines: [
        `${formatCurrencyMx(totalSpentAmount)} · ${salesCount} venta${salesCount === 1 ? "" : "s"}`,
      ],
    };
  }

  if (notification.type === "sales_goal_reached") {
    const data = getNotificationData(notification);
    const hasSalespersonName = typeof data.salespersonName === "string" && data.salespersonName.trim().length > 0;
    const salespersonName = hasSalespersonName ? data.salespersonName.trim() : null;
    const totalSoldAmount = typeof data.totalSoldAmount === "number" ? data.totalSoldAmount : Number(data.totalSoldAmount ?? 0);
    const monthlyGoalAmount = typeof data.monthlyGoalAmount === "number" ? data.monthlyGoalAmount : Number(data.monthlyGoalAmount ?? 0);

    return {
      title: salespersonName ? `Meta alcanzada por ${salespersonName}` : notification.title,
      lines: [
        `${formatCurrencyMx(totalSoldAmount)} vendidos`,
        monthlyGoalAmount > 0 ? `Meta ${formatCurrencyMx(monthlyGoalAmount)}` : "Meta del mes cumplida",
      ],
    };
  }

  if (notification.type === "commercial_large_sale") {
    const data = getNotificationData(notification);
    const clientName = typeof data.clientDisplayName === "string" && data.clientDisplayName.trim().length > 0
      ? data.clientDisplayName.trim()
      : "Venta comercial";
    const sellerName = typeof data.sellerName === "string" && data.sellerName.trim().length > 0
      ? data.sellerName.trim()
      : null;
    const totalAmount = typeof data.totalAmount === "number" ? data.totalAmount : Number(data.totalAmount ?? 0);
    const folio = typeof data.folio === "string" && data.folio.trim().length > 0 ? data.folio.trim() : null;

    return {
      title: `${clientName} registró una venta importante`,
      lines: [
        [folio, formatCurrencyMx(totalAmount)].filter(Boolean).join(" · "),
        sellerName ? `Atendió ${sellerName}` : "Venta comercial completada",
      ],
    };
  }

  if (notification.type === "purchase_received") {
    const data = getNotificationData(notification);
    const folio = typeof data.folio === "string" && data.folio.trim().length > 0 ? data.folio.trim() : "Compra";
    const supplierName = typeof data.supplierName === "string" && data.supplierName.trim().length > 0
      ? data.supplierName.trim()
      : "Proveedor";
    const totalAmount = typeof data.totalAmount === "number" ? data.totalAmount : Number(data.totalAmount ?? 0);

    return {
      title: `${folio} recibida`,
      lines: [
        supplierName,
        formatCurrencyMx(totalAmount),
      ],
    };
  }

  if (notification.type === "commission_pending") {
    const data = getNotificationData(notification);
    const hasSalespersonName = typeof data.salespersonName === "string" && data.salespersonName.trim().length > 0;
    const salespersonName = hasSalespersonName ? data.salespersonName.trim() : null;
    const pendingAmount = typeof data.pendingCommissionAmount === "number"
      ? data.pendingCommissionAmount
      : Number(data.pendingCommissionAmount ?? 0);
    const generatedAmount = typeof data.generatedCommissionAmount === "number"
      ? data.generatedCommissionAmount
      : Number(data.generatedCommissionAmount ?? 0);

    return {
      title: salespersonName ? `Comisión pendiente de ${salespersonName}` : notification.title,
      lines: [
        `${formatCurrencyMx(pendingAmount)} pendiente`,
        generatedAmount > 0 ? `${formatCurrencyMx(generatedAmount)} generada en el mes` : "Revisa el cierre del mes",
      ],
    };
  }

  return {
    title: notification.title,
    lines: notification.message ? [notification.message] : [],
  };
}

function getNotificationMeta(notification: NotificationItem) {
  const data = getNotificationData(notification);

  if (notification.type === "booking_created") {
    return {
      icon: Calendar,
      iconClassName: "text-sky-500",
      accentClassName: "border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/25",
      actionLabel: "Abrir reserva",
      eyebrow: data.planStatusLabel || data.clientOriginLabel || "Nueva reserva",
    };
  }

  if (notification.type === "booking_cancelled") {
    return {
      icon: XCircle,
      iconClassName: "text-rose-500",
      accentClassName: "border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/25",
      actionLabel: "Abrir reserva",
      eyebrow: data.planStatusLabel || data.clientOriginLabel || "Reserva cancelada",
    };
  }

  if (notification.type === "customer_joined_app") {
    return {
      icon: UserPlus,
      iconClassName: "text-emerald-500",
      accentClassName: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25",
      actionLabel: "Abrir cliente",
      eyebrow: "Nuevo cliente desde la app",
    };
  }

  if (
    notification.type === "plan_expiring" ||
    notification.type === "plan_expired" ||
    notification.type === "plan_no_uses"
  ) {
    return {
      icon: AlertTriangle,
      iconClassName: "text-amber-500",
      accentClassName: "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25",
      actionLabel: "Abrir cliente",
      eyebrow:
        notification.type === "plan_expired"
          ? "Plan vencido"
          : notification.type === "plan_no_uses"
          ? "Sin usos disponibles"
          : "Plan por vencer",
    };
  }

  if (notification.type === "birthday_upcoming") {
    return {
      icon: Calendar,
      iconClassName: "text-fuchsia-500",
      accentClassName: "border-fuchsia-200 bg-fuchsia-50/70 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/25",
      actionLabel: "Abrir cliente",
      eyebrow: "Cumpleaños próximo",
    };
  }

  if (notification.type === "birthday_today") {
    return {
      icon: Cake,
      iconClassName: "text-pink-500",
      accentClassName: "border-pink-200 bg-pink-50/70 dark:border-pink-900/50 dark:bg-pink-950/25",
      actionLabel: "Ver cliente",
      eyebrow: "Cumpleaños de hoy",
    };
  }

  if (notification.type === "monthly_billing_paid") {
    return {
      icon: CheckCircle2,
      iconClassName: "text-emerald-500",
      accentClassName: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25",
      actionLabel: "Abrir",
      eyebrow: "Movimiento confirmado",
    };
  }

  if (notification.type === "inventory_low_stock") {
    return {
      icon: Package2,
      iconClassName: "text-amber-500",
      accentClassName: "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25",
      actionLabel: "Ver producto",
      eyebrow: "Stock bajo",
    };
  }

  if (notification.type === "inventory_out_of_stock") {
    return {
      icon: AlertTriangle,
      iconClassName: "text-rose-500",
      accentClassName: "border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/25",
      actionLabel: "Abrir inventario",
      eyebrow: "Producto agotado",
    };
  }

  if (notification.type === "commercial_first_purchase") {
    return {
      icon: ShoppingCart,
      iconClassName: "text-emerald-500",
      accentClassName: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25",
      actionLabel: "Ver cliente",
      eyebrow: "Primera compra",
    };
  }

  if (notification.type === "sales_goal_reached") {
    return {
      icon: Trophy,
      iconClassName: "text-violet-500",
      accentClassName: "border-violet-200 bg-violet-50/70 dark:border-violet-900/50 dark:bg-violet-950/25",
      actionLabel: "Ver vendedor",
      eyebrow: "Meta mensual",
    };
  }

  if (notification.type === "commercial_large_sale") {
    return {
      icon: Wallet,
      iconClassName: "text-emerald-500",
      accentClassName: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25",
      actionLabel: "Ver venta",
      eyebrow: "Venta importante",
    };
  }

  if (notification.type === "purchase_received") {
    return {
      icon: Truck,
      iconClassName: "text-sky-500",
      accentClassName: "border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/25",
      actionLabel: "Ver compra",
      eyebrow: "Compra recibida",
    };
  }

  if (notification.type === "commission_pending") {
    return {
      icon: Wallet,
      iconClassName: "text-amber-500",
      accentClassName: "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25",
      actionLabel: "Ver vendedor",
      eyebrow: "Comisión pendiente",
    };
  }

  return {
    icon: Bell,
    iconClassName: "text-slate-500",
    accentClassName: "border-border bg-background",
    actionLabel: "Abrir",
    eyebrow: "Notificación",
  };
}

async function fetchNotifications(
  params: { limit: number; page?: number; status?: NotificationFilter },
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    limit: String(params.limit),
    page: String(params.page ?? 1),
  });

  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }

  return fetchJson<NotificationItem[]>(`/api/notifications?${search.toString()}`, { signal }) as Promise<NotificationItem[]>;
}

async function fetchNotificationSummary(signal?: AbortSignal) {
  return fetchJson<NotificationSummary>("/api/notifications/summary", { signal }) as Promise<NotificationSummary>;
}

function NotificationList({
  notifications,
  testIdPrefix,
  emptyMessage,
  onOpen,
  onOpenClient,
  onMarkRead,
  onDelete,
  markReadPending,
  deletePending,
  compact = false,
  onWhatsApp,
}: {
  notifications: NotificationItem[];
  testIdPrefix: string;
  emptyMessage: string;
  onOpen?: (notification: NotificationItem) => void;
  onOpenClient?: (notification: NotificationItem) => void;
  onMarkRead: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
  onWhatsApp?: (notification: NotificationItem) => void;
  markReadPending: boolean;
  deletePending: boolean;
  compact?: boolean;
}) {
  if (notifications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={`${testIdPrefix}-empty`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3 overflow-x-hidden">
      {notifications.map((notification) => {
        const data = getNotificationData(notification);
        const meta = getNotificationMeta(notification);
        const Icon = meta.icon;
        const actionLabel = meta.actionLabel;
        const copy = getNotificationCopy(notification);
        const canWhatsApp = Boolean(
          onWhatsApp &&
          notification.type === "birthday_today" &&
          normalizePhoneMX(getNotificationData(notification).phone).length >= 12,
        );
        const canOpenClient = Boolean(
          onOpenClient &&
          (
            notification.type === "booking_created" ||
            notification.type === "booking_cancelled" ||
            notification.type === "commercial_first_purchase"
          ) &&
          (
            (typeof data.clientUserId === "string" && data.clientUserId.trim().length > 0) ||
            (typeof data.userId === "string" && data.userId.trim().length > 0)
          ),
        );

        return (
          <div
            key={notification.id}
            className={`max-w-full overflow-hidden rounded-2xl border p-3 transition-colors ${meta.accentClassName} ${
              notification.isRead ? "opacity-90" : "shadow-sm"
            }`}
            data-testid={`${testIdPrefix}-item-${notification.id}`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-900/60`}>
                <Icon className={`h-4 w-4 ${meta.iconClassName}`} />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {meta.eyebrow}
                  </span>
                  {!notification.isRead && <Badge variant="destructive">Nueva</Badge>}
                </div>

                <div
                  role={onOpen ? "button" : undefined}
                  tabIndex={onOpen ? 0 : undefined}
                  onClick={() => onOpen?.(notification)}
                  onKeyDown={(event) => {
                    if (!onOpen) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(notification);
                    }
                  }}
                  className={onOpen ? "cursor-pointer" : undefined}
                >
                  <p className="break-words text-sm font-semibold leading-snug text-foreground">{copy.title}</p>
                  <div className="mt-1 space-y-1">
                    {copy.lines.map((line, index) => (
                      <p key={`${notification.id}-line-${index}`} className="break-words text-sm text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>

                <div className={`flex flex-col gap-2 ${compact ? "pt-0.5" : "pt-1"} sm:flex-row sm:items-center sm:justify-between`}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeNotificationDate(notification.createdAt)}
                    </span>
                    {!compact && <span>{formatNotificationDate(notification.createdAt)}</span>}
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                    {onOpen && (
                      <Button
                        className="w-full justify-center sm:w-auto"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(notification);
                        }}
                        data-testid={`${testIdPrefix}-open-${notification.id}`}
                      >
                        <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
                        {actionLabel}
                      </Button>
                    )}
                    {canOpenClient && (
                      <Button
                        className="w-full justify-center sm:w-auto"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenClient?.(notification);
                        }}
                        data-testid={`${testIdPrefix}-open-client-${notification.id}`}
                      >
                        Ver cliente
                      </Button>
                    )}
                    {canWhatsApp && (
                      <Button
                        className="w-full justify-center border-green-200 text-green-700 hover:bg-green-50 dark:border-green-900/50 dark:text-green-300 dark:hover:bg-green-950/20 sm:w-auto"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onWhatsApp?.(notification);
                        }}
                        data-testid={`${testIdPrefix}-whatsapp-${notification.id}`}
                      >
                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    )}
                    {!notification.isRead && (
                      <Button
                        className="w-full justify-center sm:w-auto"
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMarkRead(notification.id);
                        }}
                        disabled={markReadPending}
                        data-testid={`${testIdPrefix}-read-${notification.id}`}
                      >
                        Marcar leída
                      </Button>
                    )}
                    <Button
                      className="w-full justify-center sm:w-auto"
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(notification.id);
                      }}
                      disabled={deletePending}
                      data-testid={`${testIdPrefix}-delete-${notification.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function NotificationsPanel({
  title = "Notificaciones",
  limit = 5,
  emptyMessage = "Sin notificaciones por ahora.",
  testIdPrefix = "notifications",
  variant = "card",
  onOpenNotification,
  onOpenClientNotification,
  pollingMs = DEFAULT_POLLING_MS,
}: {
  title?: string;
  limit?: number;
  emptyMessage?: string;
  testIdPrefix?: string;
  variant?: NotificationsPanelVariant;
  onOpenNotification?: (notification: NotificationItem) => void;
  onOpenClientNotification?: (notification: NotificationItem) => void;
  pollingMs?: number;
}) {
  const isMobile = useIsMobile();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);

  const summaryQuery = useQuery<NotificationSummary>({
    queryKey: ["/api/notifications/summary"],
    queryFn: ({ signal }) => fetchNotificationSummary(signal),
    refetchInterval: pollingMs,
  });

  const previewQuery = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications", limit, variant === "bell" ? "popover" : "preview"],
    queryFn: ({ signal }) => fetchNotifications({ limit, page: 1, status: "all" }, signal),
    enabled: variant === "card" || isPopoverOpen || isDialogOpen,
    refetchInterval: variant === "card" || isPopoverOpen ? pollingMs : false,
  });

  const fullNotificationsQuery = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications", "full", filter, page, FULL_PAGE_SIZE],
    queryFn: ({ signal }) => fetchNotifications({ limit: FULL_PAGE_SIZE, page, status: filter }, signal),
    enabled: isDialogOpen,
    refetchInterval: isDialogOpen ? pollingMs : false,
  });

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (isDialogOpen && page > 1 && fullNotificationsQuery.data && fullNotificationsQuery.data.length === 0) {
      setPage((current) => Math.max(current - 1, 1));
    }
  }, [isDialogOpen, page, fullNotificationsQuery.data]);

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const resp = await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
      return resp.json();
    },
    onSuccess: () => {
      invalidateNotifications();
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("PATCH", "/api/notifications/read-all");
      return resp.json();
    },
    onSuccess: () => {
      invalidateNotifications();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const resp = await apiRequest("DELETE", `/api/notifications/${notificationId}`);
      return resp.json();
    },
    onSuccess: () => {
      invalidateNotifications();
    },
  });

  const deleteReadMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("DELETE", "/api/notifications/read");
      return resp.json();
    },
    onSuccess: () => {
      invalidateNotifications();
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("DELETE", "/api/notifications/all");
      return resp.json();
    },
    onSuccess: () => {
      invalidateNotifications();
      setPage(1);
    },
  });

  const unreadCount =
    summaryQuery.data?.unreadCount ??
    previewQuery.data?.filter((notification) => !notification.isRead).length ??
    0;
  const totalCount = summaryQuery.data?.totalCount ?? previewQuery.data?.length ?? 0;
  const readCount = summaryQuery.data?.readCount ?? Math.max(totalCount - unreadCount, 0);
  const hasNextPage = (fullNotificationsQuery.data?.length ?? 0) === FULL_PAGE_SIZE;
  const activeNotifications = useMemo(() => fullNotificationsQuery.data ?? [], [fullNotificationsQuery.data]);

  async function handleOpenNotification(notification: NotificationItem) {
    if (!notification.isRead) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch {
        // ignore and continue opening
      }
    }

    setIsPopoverOpen(false);
    window.requestAnimationFrame(() => {
      onOpenNotification?.(notification);
    });
  }

  async function handleOpenClientNotification(notification: NotificationItem) {
    if (!notification.isRead) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch {
        // ignore and continue opening
      }
    }

    setIsPopoverOpen(false);
    window.requestAnimationFrame(() => {
      onOpenClientNotification?.(notification);
    });
  }

  function handleBirthdayWhatsApp(notification: NotificationItem) {
    const data = getNotificationData(notification);
    const clientName =
      typeof data.clientName === "string" && data.clientName.trim().length > 0
        ? data.clientName.trim()
        : "cliente";
    const firstName = clientName.split(" ")[0] || clientName;
    const branchName =
      typeof data.branchName === "string" && data.branchName.trim().length > 0
        ? data.branchName.trim()
        : "tu sucursal";
    const url = buildWhatsAppUrl(
      typeof data.phone === "string" ? data.phone : null,
      `¡Hola ${firstName}! 🎉 De parte de ${branchName} queremos desearte un feliz cumpleaños. Esperamos que tengas un excelente día 🎂`,
    );

    if (!url) {
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderActions(showViewAll = true) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {showViewAll && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsPopoverOpen(false);
              setIsDialogOpen(true);
            }}
            data-testid={`${testIdPrefix}-view-all`}
          >
            Ver todas
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => readAllMutation.mutate()}
          disabled={readAllMutation.isPending || unreadCount === 0}
          data-testid={`${testIdPrefix}-read-all`}
        >
          {readAllMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Marcar todas como leídas
        </Button>
      </div>
    );
  }

  const panelList = (
    <NotificationList
      notifications={previewQuery.data ?? []}
      testIdPrefix={testIdPrefix}
      emptyMessage={emptyMessage}
      onOpen={onOpenNotification ? handleOpenNotification : undefined}
      onOpenClient={onOpenClientNotification ? handleOpenClientNotification : undefined}
      onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
      onDelete={(notificationId) => deleteMutation.mutate(notificationId)}
      onWhatsApp={handleBirthdayWhatsApp}
      markReadPending={markReadMutation.isPending}
      deletePending={deleteMutation.isPending}
      compact={variant === "bell"}
    />
  );

  return (
    <>
      {variant === "card" ? (
        <Card data-testid={`${testIdPrefix}-panel`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {title}
                {!summaryQuery.isLoading && unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
              </CardTitle>
              {renderActions()}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {previewQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="rounded-2xl border p-3 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))}
              </div>
            ) : (
              panelList
            )}
          </CardContent>
        </Card>
      ) : isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full border border-border/60 bg-background/80 shadow-sm"
          onClick={() => {
            setIsDialogOpen(true);
            void summaryQuery.refetch();
            void fullNotificationsQuery.refetch();
          }}
          data-testid={`${testIdPrefix}-bell-trigger`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      ) : (
        <Popover
          open={isPopoverOpen}
          onOpenChange={(open) => {
            setIsPopoverOpen(open);
            if (open) {
              void summaryQuery.refetch().finally(() => {
                void previewQuery.refetch();
              });
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full border border-border/60 bg-background/80 shadow-sm"
              data-testid={`${testIdPrefix}-bell-trigger`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[420px] max-w-[calc(100vw-1.5rem)] rounded-3xl border border-border/70 p-0 shadow-2xl"
          >
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Centro de alertas</p>
                  <div className="mt-1 flex items-center gap-2">
                    <h3 className="text-base font-semibold">{title}</h3>
                    {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
                  </div>
                </div>
                {renderActions(false)}
              </div>

              {previewQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-2xl border p-3 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  ))}
                </div>
              ) : (
                panelList
              )}

              <div className="flex items-center justify-between gap-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsPopoverOpen(false);
                    setIsDialogOpen(true);
                  }}
                  data-testid={`${testIdPrefix}-popover-view-all`}
                >
                  Ver todas
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (open) {
            void summaryQuery.refetch();
            void fullNotificationsQuery.refetch();
          }
        }}
      >
        <DialogContent className="flex h-full max-h-none max-w-none flex-col overflow-hidden rounded-none p-4 sm:p-6 md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {title}
              {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
            </DialogTitle>
            <DialogDescription>
              Administra tus alertas internas. Se muestran un máximo de {FULL_PAGE_SIZE} por página.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="w-full justify-center sm:w-auto"
                type="button"
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                data-testid={`${testIdPrefix}-filter-all`}
              >
                Todas ({totalCount})
              </Button>
              <Button
                className="w-full justify-center sm:w-auto"
                type="button"
                size="sm"
                variant={filter === "unread" ? "default" : "outline"}
                onClick={() => setFilter("unread")}
                data-testid={`${testIdPrefix}-filter-unread`}
              >
                No leídas ({unreadCount})
              </Button>
              <Button
                className="w-full justify-center sm:w-auto"
                type="button"
                size="sm"
                variant={filter === "read" ? "default" : "outline"}
                onClick={() => setFilter("read")}
                data-testid={`${testIdPrefix}-filter-read`}
              >
                Leídas ({readCount})
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                className="w-full justify-center sm:w-auto"
                variant="outline"
                size="sm"
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending || unreadCount === 0}
                data-testid={`${testIdPrefix}-dialog-read-all`}
              >
                Marcar todas como leídas
              </Button>
              <Button
                className="w-full justify-center sm:w-auto"
                variant="outline"
                size="sm"
                onClick={() => deleteReadMutation.mutate()}
                disabled={deleteReadMutation.isPending || readCount === 0}
                data-testid={`${testIdPrefix}-delete-read`}
              >
                {deleteReadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar leídas
              </Button>
              <Button
                className="w-full justify-center sm:w-auto"
                variant="destructive"
                size="sm"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending || totalCount === 0}
                data-testid={`${testIdPrefix}-delete-all`}
              >
                {deleteAllMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar todas
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1">
            {fullNotificationsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-2xl border p-3 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))}
              </div>
            ) : (
              <NotificationList
                notifications={activeNotifications}
                testIdPrefix={`${testIdPrefix}-dialog`}
                emptyMessage="No hay notificaciones para este filtro."
                onOpen={onOpenNotification ? handleOpenNotification : undefined}
                onOpenClient={onOpenClientNotification ? handleOpenClientNotification : undefined}
                onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
                onDelete={(notificationId) => deleteMutation.mutate(notificationId)}
                onWhatsApp={handleBirthdayWhatsApp}
                markReadPending={markReadMutation.isPending}
                deletePending={deleteMutation.isPending}
              />
            )}
          </div>

          <div className="flex flex-col gap-3 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Página {page}</p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button
                className="flex-1 justify-center sm:flex-none"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
                data-testid={`${testIdPrefix}-page-prev`}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                className="flex-1 justify-center sm:flex-none"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasNextPage}
                data-testid={`${testIdPrefix}-page-next`}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
