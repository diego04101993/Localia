import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NotificationItem = {
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

const FULL_PAGE_SIZE = 10;

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

async function fetchNotifications(params: { limit: number; page?: number; status?: NotificationFilter }) {
  const search = new URLSearchParams({
    limit: String(params.limit),
    page: String(params.page ?? 1),
  });

  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }

  const resp = await fetch(`/api/notifications?${search.toString()}`, { credentials: "include" });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}

async function fetchNotificationSummary() {
  const resp = await fetch("/api/notifications/summary", { credentials: "include" });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}

function NotificationList({
  notifications,
  testIdPrefix,
  emptyMessage,
  onMarkRead,
  onDelete,
  markReadPending,
  deletePending,
}: {
  notifications: NotificationItem[];
  testIdPrefix: string;
  emptyMessage: string;
  onMarkRead: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
  markReadPending: boolean;
  deletePending: boolean;
}) {
  if (notifications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={`${testIdPrefix}-empty`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`rounded-md border p-3 space-y-2 ${notification.isRead ? "opacity-80" : "bg-muted/30"}`}
          data-testid={`${testIdPrefix}-item-${notification.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{notification.title}</p>
                {!notification.isRead && <Badge variant="secondary">Nueva</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!notification.isRead && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onMarkRead(notification.id)}
                  disabled={markReadPending}
                  data-testid={`${testIdPrefix}-read-${notification.id}`}
                >
                  Marcar leida
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(notification.id)}
                disabled={deletePending}
                data-testid={`${testIdPrefix}-delete-${notification.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{formatNotificationDate(notification.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPanel({
  title = "Notificaciones",
  limit = 5,
  emptyMessage = "Sin notificaciones por ahora.",
  testIdPrefix = "notifications",
}: {
  title?: string;
  limit?: number;
  emptyMessage?: string;
  testIdPrefix?: string;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);

  const { data: summary, isLoading: summaryLoading } = useQuery<NotificationSummary>({
    queryKey: ["/api/notifications/summary"],
    queryFn: fetchNotificationSummary,
    refetchInterval: 30000,
  });

  const { data: notifications, isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications", limit, "preview"],
    queryFn: async () => fetchNotifications({ limit, page: 1, status: "all" }),
    refetchInterval: 30000,
  });

  const { data: fullNotifications, isLoading: fullLoading } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications", "full", filter, page, FULL_PAGE_SIZE],
    queryFn: async () => fetchNotifications({ limit: FULL_PAGE_SIZE, page, status: filter }),
    enabled: isDialogOpen,
    refetchInterval: 30000,
  });

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (isDialogOpen && page > 1 && fullNotifications && fullNotifications.length === 0) {
      setPage((current) => Math.max(current - 1, 1));
    }
  }, [isDialogOpen, page, fullNotifications]);

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

  const unreadCount = summary?.unreadCount ?? notifications?.filter((notification) => !notification.isRead).length ?? 0;
  const totalCount = summary?.totalCount ?? notifications?.length ?? 0;
  const readCount = summary?.readCount ?? Math.max(totalCount - unreadCount, 0);
  const hasNextPage = (fullNotifications?.length ?? 0) === FULL_PAGE_SIZE;
  const activeNotifications = useMemo(() => fullNotifications ?? [], [fullNotifications]);

  return (
    <>
      <Card data-testid={`${testIdPrefix}-panel`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {title}
              {!summaryLoading && unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(true)}
                data-testid={`${testIdPrefix}-view-all`}
              >
                Ver todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending || unreadCount === 0}
                data-testid={`${testIdPrefix}-read-all`}
              >
                {readAllMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Marcar todas como leidas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-md border p-3 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <NotificationList
              notifications={notifications ?? []}
              testIdPrefix={testIdPrefix}
              emptyMessage={emptyMessage}
              onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
              onDelete={(notificationId) => deleteMutation.mutate(notificationId)}
              markReadPending={markReadMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {title}
              {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
            </DialogTitle>
            <DialogDescription>
              Administra tus notificaciones internas. Se muestran un maximo de {FULL_PAGE_SIZE} por pagina.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                data-testid={`${testIdPrefix}-filter-all`}
              >
                Todas ({totalCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filter === "unread" ? "default" : "outline"}
                onClick={() => setFilter("unread")}
                data-testid={`${testIdPrefix}-filter-unread`}
              >
                No leidas ({unreadCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filter === "read" ? "default" : "outline"}
                onClick={() => setFilter("read")}
                data-testid={`${testIdPrefix}-filter-read`}
              >
                Leidas ({readCount})
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending || unreadCount === 0}
                data-testid={`${testIdPrefix}-dialog-read-all`}
              >
                Marcar todas como leidas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteReadMutation.mutate()}
                disabled={deleteReadMutation.isPending || readCount === 0}
                data-testid={`${testIdPrefix}-delete-read`}
              >
                {deleteReadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Eliminar leidas
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending || totalCount === 0}
                data-testid={`${testIdPrefix}-delete-all`}
              >
                {deleteAllMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Eliminar todas
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {fullLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-md border p-3 space-y-2">
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
                onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
                onDelete={(notificationId) => deleteMutation.mutate(notificationId)}
                markReadPending={markReadMutation.isPending}
                deletePending={deleteMutation.isPending}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <p className="text-sm text-muted-foreground">Pagina {page}</p>
            <div className="flex items-center gap-2">
              <Button
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
