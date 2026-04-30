import { storage } from "./storage";

type NotificationRole = "SUPER_ADMIN" | "BRANCH_ADMIN" | "CUSTOMER";

type NotificationPayload = {
  recipientUserId?: string | null;
  branchId?: string | null;
  roleTarget?: NotificationRole | null;
  type: string;
  title: string;
  message: string;
  data?: any;
};

type ActorRef = {
  id: string;
  role: string;
  branchId?: string | null;
};

type SystemEventRef = {
  eventType: string;
  branchId?: string | null;
  userId?: string | null;
  payload?: any;
};

export async function createNotification(data: NotificationPayload) {
  return storage.createNotification(data);
}

async function createNotificationSafe(data: NotificationPayload) {
  try {
    return await createNotification(data);
  } catch (err: any) {
    console.error(`[NOTIFICATIONS] Failed to create ${data.type}:`, err?.stack || err);
    return null;
  }
}

export async function createSuperAdminNotification(params: {
  type: string;
  title: string;
  message: string;
  data?: any;
}) {
  return createNotificationSafe({
    roleTarget: "SUPER_ADMIN",
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data ?? null,
  });
}

export async function createBranchNotification(branchId: string, params: {
  type: string;
  title: string;
  message: string;
  data?: any;
}) {
  return createNotificationSafe({
    branchId,
    roleTarget: "BRANCH_ADMIN",
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data ?? null,
  });
}

export async function createUserNotification(userId: string, params: {
  type: string;
  title: string;
  message: string;
  data?: any;
}) {
  return createNotificationSafe({
    recipientUserId: userId,
    roleTarget: "CUSTOMER",
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data ?? null,
  });
}

export async function markNotificationRead(notificationId: string, actor: ActorRef) {
  return storage.markNotificationRead(notificationId, actor);
}

export async function getNotificationSummary(actor: ActorRef) {
  return storage.getNotificationSummary(actor);
}

export async function deleteNotification(notificationId: string, actor: ActorRef) {
  return storage.deleteNotification(notificationId, actor);
}

export async function deleteReadNotifications(actor: ActorRef) {
  return storage.deleteReadNotifications(actor);
}

export async function deleteAllNotifications(actor: ActorRef) {
  return storage.deleteAllNotifications(actor);
}

export async function cleanupOldNotifications(maxAgeDays = 30) {
  return storage.cleanupOldNotifications(maxAgeDays);
}

export function createNotificationCleanupJob(maxAgeDays = 30) {
  void (async () => {
    try {
      const deleted = await cleanupOldNotifications(maxAgeDays);
      console.log(`[NOTIFICATIONS] Limpieza automática eliminó ${deleted} notificaciones antiguas`);
    } catch (err: any) {
      console.error("[NOTIFICATIONS] Error en limpieza automática:", err?.stack || err);
    }
  })();
}

export async function dispatchNotificationFromSystemEvent(event: SystemEventRef) {
  const data = {
    sourceEventType: event.eventType,
    ...(event.payload ?? {}),
  };

  switch (event.eventType) {
    case "customer_registered":
      return createSuperAdminNotification({
        type: event.eventType,
        title: "Nuevo usuario registrado",
        message: "Se registró un nuevo cliente en la app.",
        data,
      });
    case "promotion_created":
      if (!event.branchId) return null;
      return createBranchNotification(event.branchId, {
        type: event.eventType,
        title: "Promoción creada correctamente",
        message: "La promoción ya está disponible para tu sucursal.",
        data,
      });
    case "customer_reported":
      return createSuperAdminNotification({
        type: event.eventType,
        title: "Sucursal reportó a un cliente",
        message: "Se registró una incidencia nueva de cliente.",
        data,
      });
    case "customer_blocked_local":
      return createSuperAdminNotification({
        type: event.eventType,
        title: "Cliente bloqueado por una sucursal",
        message: "Una sucursal aplicó un bloqueo local a un cliente.",
        data,
      });
    case "booking_created":
      if (!event.branchId || event.payload?.source !== "app") return null;
      return createBranchNotification(event.branchId, {
        type: event.eventType,
        title: "Nueva reserva recibida",
        message: "Un cliente hizo una nueva reserva en tu sucursal.",
        data,
      });
    case "booking_cancelled":
      if (!event.branchId || event.payload?.source !== "app") return null;
      return createBranchNotification(event.branchId, {
        type: event.eventType,
        title: "Reserva cancelada",
        message: "Un cliente canceló una de sus reservas.",
        data,
      });
    default:
      return null;
  }
}
