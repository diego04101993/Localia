import { getBranchClientIdentityControl } from "./branch-client-identity";
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

const BRANCH_TIMEZONE = "America/Mexico_City";

function originLabel(originType: "manual" | "counter" | "app") {
  if (originType === "app") return "Se unió desde la app";
  if (originType === "counter") return "Cliente de mostrador";
  return "Agregado manualmente";
}

function formatNotificationDay(date: string | null | undefined) {
  if (!date) return null;

  return new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

function formatNotificationTime(time: string | null | undefined) {
  if (!time) return null;

  const [hours = "00", minutes = "00"] = time.split(":");
  return new Date(`2000-01-01T${hours}:${minutes}:00`).toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

function buildPlanStatusLabel(params: {
  hasActivePlan: boolean;
  planName?: string | null;
}) {
  if (!params.hasActivePlan) return "Sin servicio o plan";
  return params.planName?.trim() || "Con servicio o plan activo";
}

function getMxDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRANCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return { year, month, day };
}

function isBirthdayToday(birthDate: string | null | undefined) {
  if (!birthDate) return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return false;

  const today = getMxDateParts();
  const month = Number(match[2]);
  const day = Number(match[3]);

  return month === today.month && day === today.day;
}

function calculateBirthdayAge(birthDate: string | null | undefined) {
  if (!birthDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(year, month - 1, day);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = getMxDateParts();
  let age = today.year - birth.getFullYear();
  const monthDiff = today.month - (birth.getMonth() + 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.day < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

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

async function createBranchNotificationOnce(
  branchId: string,
  params: {
    type: string;
    referenceId: string;
    title: string;
    message: string;
    data?: Record<string, any> | null;
  },
) {
  try {
    const existing = await storage.findNotificationByReference({
      type: params.type,
      referenceId: params.referenceId,
      branchId,
      roleTarget: "BRANCH_ADMIN",
      recipientUserId: null,
    });

    if (existing) {
      return existing;
    }

    return await createBranchNotification(branchId, {
      type: params.type,
      title: params.title,
      message: params.message,
      data: {
        referenceId: params.referenceId,
        ...(params.data ?? {}),
      },
    });
  } catch (err: any) {
    console.error(`[NOTIFICATIONS] Failed to dedupe ${params.type}:`, err?.stack || err);
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
      console.log(`[NOTIFICATIONS] Limpieza automatica elimino ${deleted} notificaciones antiguas`);
    } catch (err: any) {
      console.error("[NOTIFICATIONS] Error en limpieza automatica:", err?.stack || err);
    }
  })();
}

export async function syncBirthdayTodayNotifications(params: {
  branchId: string;
  actorUserId: string;
}) {
  try {
    const [branch, birthdaysToday] = await Promise.all([
      storage.getBranch(params.branchId),
      storage.getUpcomingBirthdays(params.branchId, 0),
    ]);

    if (!branch || birthdaysToday.length === 0) {
      return 0;
    }

    const currentYear = getMxDateParts().year;
    let createdCount = 0;

    for (const customer of birthdaysToday) {
      if (!customer?.userId || !isBirthdayToday(customer.birthDate)) {
        continue;
      }

      const referenceId = `birthday:${params.branchId}:${customer.userId}:${currentYear}`;
      const existingAudit = await storage.findAuditLogByReference({
        action: "NOTIFICATION_BIRTHDAY_TODAY_EMITTED",
        branchId: params.branchId,
        referenceId,
      });

      const existingNotification = await storage.findNotificationByReference({
        type: "birthday_today",
        referenceId,
        branchId: params.branchId,
        roleTarget: "BRANCH_ADMIN",
        recipientUserId: null,
      });

      const auditMetadata =
        existingAudit && typeof existingAudit.metadata === "object" && existingAudit.metadata
          ? (existingAudit.metadata as Record<string, any>)
          : null;
      const auditNotificationId =
        typeof auditMetadata?.notificationId === "string" && auditMetadata.notificationId
          ? auditMetadata.notificationId
          : null;

      if (existingAudit && (existingNotification || auditNotificationId)) {
        continue;
      }

      const user = await storage.getUser(customer.userId);
      if (!user) {
        continue;
      }

      const membership = await storage.getMembershipByUserAndBranch(customer.userId, params.branchId);
      const identityControl = getBranchClientIdentityControl(
        {
          email: user.email,
          authProvider: user.authProvider,
          firebaseUid: user.firebaseUid,
          acceptedTerms: user.acceptedTerms,
        },
        { source: membership?.source ?? null },
      );

      const clientName = [customer.name, customer.lastName].filter(Boolean).join(" ").trim() || user.name;
      const age = calculateBirthdayAge(customer.birthDate);
      const clientOriginLabel = originLabel(identityControl.originType);
      const title = `🎂 Hoy cumple ${clientName}`;
      const message = [age !== null ? `Cumple ${age} años` : "Cumple hoy", clientOriginLabel]
        .filter(Boolean)
        .join(" · ");

      let notificationId = existingNotification?.id ?? null;

      if (!existingNotification) {
        const created = await createBranchNotificationOnce(params.branchId, {
          type: "birthday_today",
          referenceId,
          title,
          message,
          data: {
            clientUserId: customer.userId,
            branchId: params.branchId,
            birthDate: customer.birthDate,
            birthdayAge: age,
            phone: customer.phone ?? null,
            branchName: branch.name,
            clientName,
            clientOrigin: identityControl.originType,
            clientOriginLabel,
            notificationAction: "open_client",
          },
        });
        notificationId = created?.id ?? null;
        if (created) {
          createdCount += 1;
        }
      } else {
        notificationId = existingNotification.id;
      }

      if (!notificationId) {
        continue;
      }

      await storage.createAuditLog({
        actorUserId: params.actorUserId,
        action: "NOTIFICATION_BIRTHDAY_TODAY_EMITTED",
        branchId: params.branchId,
        metadata: {
          referenceId,
          clientUserId: customer.userId,
          birthDate: customer.birthDate,
          notificationId,
        },
      });
    }

    return createdCount;
  } catch (err: any) {
    console.error("[NOTIFICATIONS] Error sincronizando cumpleaños de hoy:", err?.stack || err);
    return 0;
  }
}

async function buildReservationNotificationSnapshotByBooking(
  bookingId: string,
  branchIdHint?: string | null,
) {

  const booking = await storage.getBooking(bookingId);
  if (!booking) return null;

  const branchId = branchIdHint ?? booking.branchId;
  if (!branchId) return null;

  const [user, schedule, membership, branch] = await Promise.all([
    storage.getUser(booking.userId),
    storage.getClassSchedule(booking.classScheduleId),
    storage.getMembershipByUserAndBranch(booking.userId, branchId),
    storage.getBranch(branchId),
  ]);

  if (!user || !schedule || !branch) return null;

  const identityControl = getBranchClientIdentityControl(
    {
      email: user.email,
      authProvider: user.authProvider,
      firebaseUid: user.firebaseUid,
      acceptedTerms: user.acceptedTerms,
    },
    { source: membership?.source ?? null },
  );

  const plan = membership?.planId ? await storage.getPlan(membership.planId) : null;
  const planName = plan?.name || membership?.planNameSnapshot || null;
  const hasActivePlan = Boolean(
    membership &&
    membership.status === "active" &&
    (
      membership.planId ||
      membership.planNameSnapshot ||
      membership.expiresAt ||
      membership.classesRemaining !== null ||
      membership.classesTotal !== null
    ),
  );
  const reservationDateLabel = formatNotificationDay(booking.bookingDate);
  const reservationTimeLabel = formatNotificationTime(schedule.startTime);
  const planStatusLabel = buildPlanStatusLabel({ hasActivePlan, planName });
  const customerOriginLabel = originLabel(identityControl.originType);
  const displayTitleBase = `${user.name} reserv\u00F3 ${schedule.name}`;
  const displayCancelTitleBase = `${user.name} cancel\u00F3 ${schedule.name}`;
  const displayLine1 = [reservationDateLabel, reservationTimeLabel].filter(Boolean).join(" \u00B7 ");
  const displayLine2 = [planStatusLabel, customerOriginLabel].filter(Boolean).join(" \u00B7 ");

  return {
    booking,
    titleBase: `${user.name} reservó ${schedule.name}`,
    cancelTitleBase: `${user.name} canceló ${schedule.name}`,
    message: [reservationDateLabel, reservationTimeLabel, planStatusLabel, customerOriginLabel]
      .filter(Boolean)
      .join(" · "),
    data: {
      reservationId: booking.id,
      bookingId: booking.id,
      clientUserId: booking.userId,
      userId: booking.userId,
      branchId: booking.branchId,
      classScheduleId: schedule.id,
      classId: schedule.id,
      serviceName: schedule.name,
      className: schedule.name,
      reservationDate: booking.bookingDate,
      bookingDate: booking.bookingDate,
      reservationTime: schedule.startTime,
      hasActivePlan,
      planName,
      planStatusLabel,
      clientOrigin: identityControl.originType,
      clientOriginLabel: customerOriginLabel,
      clientName: user.name,
      bookingStatus: booking.status,
      source: booking.source,
      branchName: branch.name,
      notificationAction: "open_reservation",
      displayTitle: displayTitleBase,
      displayCancelTitle: displayCancelTitleBase,
      displayLine1,
      displayLine2,
    },
    displayTitleBase,
    displayCancelTitleBase,
    displayLine1,
    displayLine2,
  };
}

async function buildReservationNotificationSnapshot(event: SystemEventRef) {
  const bookingId = event.payload?.bookingId as string | undefined;
  if (!bookingId || !event.branchId) return null;

  return buildReservationNotificationSnapshotByBooking(bookingId, event.branchId);
}

function hasRichReservationNotificationData(data: any) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const hasClientName = typeof data.clientName === "string" && data.clientName.trim().length > 0;
  const hasServiceName =
    (typeof data.serviceName === "string" && data.serviceName.trim().length > 0) ||
    (typeof data.className === "string" && data.className.trim().length > 0);
  const hasReservationDate =
    (typeof data.reservationDate === "string" && data.reservationDate.trim().length > 0) ||
    (typeof data.bookingDate === "string" && data.bookingDate.trim().length > 0);
  const hasReservationTime =
    (typeof data.reservationTime === "string" && data.reservationTime.trim().length > 0) ||
    (typeof data.startTime === "string" && data.startTime.trim().length > 0);
  const hasOrigin =
    (typeof data.clientOriginLabel === "string" && data.clientOriginLabel.trim().length > 0) ||
    (typeof data.clientOrigin === "string" && data.clientOrigin.trim().length > 0);
  const hasPlanState =
    (typeof data.planStatusLabel === "string" && data.planStatusLabel.trim().length > 0) ||
    typeof data.hasActivePlan === "boolean";
  const hasDisplayCopy =
    (
      (typeof data.displayTitle === "string" && data.displayTitle.trim().length > 0) ||
      (typeof data.displayCancelTitle === "string" && data.displayCancelTitle.trim().length > 0)
    ) &&
    (
      (typeof data.displayLine1 === "string" && data.displayLine1.trim().length > 0) ||
      (typeof data.displayLine2 === "string" && data.displayLine2.trim().length > 0)
    );

  return hasClientName && hasServiceName && hasReservationDate && hasReservationTime && hasOrigin && hasPlanState && hasDisplayCopy;
}

export async function enrichNotificationForDisplay(notification: any) {
  if (!notification || (notification.type !== "booking_created" && notification.type !== "booking_cancelled")) {
    return notification;
  }

  try {
    const currentData = notification.data && typeof notification.data === "object" ? notification.data : {};
    if (hasRichReservationNotificationData(currentData)) {
      return notification;
    }

    const bookingId =
      typeof currentData.bookingId === "string" && currentData.bookingId
        ? currentData.bookingId
        : typeof currentData.reservationId === "string" && currentData.reservationId
        ? currentData.reservationId
        : null;

    if (!bookingId) {
      return notification;
    }

    const snapshot = await buildReservationNotificationSnapshotByBooking(
      bookingId,
      notification.branchId ?? currentData.branchId ?? null,
    );

    if (!snapshot) {
      return notification;
    }

    const isCancelled = notification.type === "booking_cancelled";

    return {
      ...notification,
      title: isCancelled ? snapshot.displayCancelTitleBase : snapshot.displayTitleBase,
      message: [snapshot.displayLine1, snapshot.displayLine2].filter(Boolean).join(" \u00B7 "),
      data: {
        ...currentData,
        ...snapshot.data,
        sourceEventType:
          currentData.sourceEventType ??
          currentData.eventType ??
          (isCancelled ? "booking_cancelled" : "booking_created"),
      },
    };
  } catch (err: any) {
    console.error("[NOTIFICATIONS_ENRICH]", err?.stack || err);
    return notification;
  }
}

async function createReservationNotification(
  event: SystemEventRef,
  kind: "created" | "cancelled",
) {
  if (!event.branchId || event.payload?.source !== "app") {
    return null;
  }

  const snapshot = await buildReservationNotificationSnapshot(event);
  if (!snapshot) {
    return null;
  }

  const isCreated = kind === "created";

  return createBranchNotificationOnce(event.branchId, {
    type: isCreated ? "booking_created" : "booking_cancelled",
    referenceId: `${isCreated ? "reservation_created" : "reservation_cancelled"}:${snapshot.booking.id}`,
    title: isCreated ? snapshot.displayTitleBase : snapshot.displayCancelTitleBase,
    message: [snapshot.displayLine1, snapshot.displayLine2].filter(Boolean).join(" \u00B7 "),
    data: {
      sourceEventType: event.eventType,
      ...snapshot.data,
    },
  });
}

export async function notifyBranchCustomerJoinedFromApp(branchId: string, userId: string) {
  try {
    const [user, membership, branch] = await Promise.all([
      storage.getUser(userId),
      storage.getMembershipByUserAndBranch(userId, branchId),
      storage.getBranch(branchId),
    ]);

    if (!user || !branch) return null;

    const plan = membership?.planId ? await storage.getPlan(membership.planId) : null;
    const planName = plan?.name || membership?.planNameSnapshot || null;
    const hasActivePlan = Boolean(
      membership &&
      membership.status === "active" &&
      (
        membership.planId ||
        membership.planNameSnapshot ||
        membership.expiresAt ||
        membership.classesRemaining !== null ||
        membership.classesTotal !== null
      ),
    );

    return createBranchNotificationOnce(branchId, {
      type: "customer_joined_app",
      referenceId: `app_join:${userId}`,
      title: `${user.name} se unió desde la app`,
      message: buildPlanStatusLabel({ hasActivePlan, planName }),
      data: {
        clientUserId: userId,
        branchId,
        branchName: branch.name,
        hasActivePlan,
        planName,
        planStatusLabel: buildPlanStatusLabel({ hasActivePlan, planName }),
        clientOrigin: "app",
        clientOriginLabel: "Se unió desde la app",
        notificationAction: "open_client",
      },
    });
  } catch (err: any) {
    console.error("[NOTIFICATIONS] Error creando notificacion de cliente app:", err?.stack || err);
    return null;
  }
}

export async function syncBranchOperationalNotifications(
  branchId: string,
  alerts: {
    expiringMemberships?: any[];
    expiredMemberships?: any[];
    clientsWithoutClasses?: any[];
    upcomingBirthdays?: any[];
  },
) {
  try {
    const tasks: Promise<any>[] = [];

    for (const membership of alerts.expiringMemberships ?? []) {
      const expiresLabel = formatNotificationDay(membership.expiresAt);
      tasks.push(
        createBranchNotificationOnce(branchId, {
          type: "plan_expiring",
          referenceId: `plan_expiring:${membership.membershipId}:${membership.expiresAt}`,
          title: `${membership.name} esta por vencer`,
          message: [membership.planName || "Servicio o plan", expiresLabel ? `Vence ${expiresLabel}` : null]
            .filter(Boolean)
            .join(" · "),
          data: {
            clientUserId: membership.userId,
            membershipId: membership.membershipId,
            branchId,
            planName: membership.planName || null,
            expiresAt: membership.expiresAt,
            classesRemaining: membership.classesRemaining ?? null,
            classesTotal: membership.classesTotal ?? null,
            notificationAction: "open_client",
          },
        }),
      );
    }

    for (const membership of alerts.expiredMemberships ?? []) {
      const expiresLabel = formatNotificationDay(membership.expiresAt);
      tasks.push(
        createBranchNotificationOnce(branchId, {
          type: "plan_expired",
          referenceId: `plan_expired:${membership.membershipId}:${membership.expiresAt}`,
          title: `${membership.name} tiene un plan vencido`,
          message: [membership.planName || "Servicio o plan", expiresLabel ? `Vencio ${expiresLabel}` : null]
            .filter(Boolean)
            .join(" · "),
          data: {
            clientUserId: membership.userId,
            membershipId: membership.membershipId,
            branchId,
            planName: membership.planName || null,
            expiresAt: membership.expiresAt,
            classesRemaining: membership.classesRemaining ?? null,
            notificationAction: "open_client",
          },
        }),
      );
    }

    for (const membership of alerts.clientsWithoutClasses ?? []) {
      tasks.push(
        createBranchNotificationOnce(branchId, {
          type: "plan_no_uses",
          referenceId: `plan_no_uses:${membership.membershipId}`,
          title: `${membership.name} ya no tiene usos disponibles`,
          message: [membership.planName || "Servicio o plan", "Sin clases disponibles"]
            .filter(Boolean)
            .join(" · "),
          data: {
            clientUserId: membership.userId,
            membershipId: membership.membershipId,
            branchId,
            planName: membership.planName || null,
            classesRemaining: membership.classesRemaining ?? null,
            classesTotal: membership.classesTotal ?? null,
            expiresAt: membership.expiresAt ?? null,
            notificationAction: "open_client",
          },
        }),
      );
    }

    const currentYear = new Date().getFullYear();
    for (const customer of alerts.upcomingBirthdays ?? []) {
      tasks.push(
        createBranchNotificationOnce(branchId, {
          type: "birthday_upcoming",
          referenceId: `birthday_upcoming:${customer.membershipId}:${currentYear}`,
          title: `${customer.name} cumple años pronto`,
          message: formatNotificationDay(customer.birthDate) || "Cumpleaños proximo",
          data: {
            clientUserId: customer.userId,
            membershipId: customer.membershipId,
            branchId,
            birthDate: customer.birthDate ?? null,
            notificationAction: "open_client",
          },
        }),
      );
    }

    await Promise.all(tasks);
  } catch (err: any) {
    console.error("[NOTIFICATIONS] Error sincronizando alertas operativas:", err?.stack || err);
  }
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
        message: "Se registro un nuevo cliente en la app.",
        data,
      });
    case "promotion_created":
      if (!event.branchId) return null;
      return createBranchNotification(event.branchId, {
        type: event.eventType,
        title: "Promocion creada correctamente",
        message: "La promocion ya esta disponible para tu sucursal.",
        data,
      });
    case "customer_reported":
      return createSuperAdminNotification({
        type: event.eventType,
        title: "Sucursal reporto a un cliente",
        message: "Se registro una incidencia nueva de cliente.",
        data,
      });
    case "customer_blocked_local":
      return createSuperAdminNotification({
        type: event.eventType,
        title: "Cliente bloqueado por una sucursal",
        message: "Una sucursal aplico un bloqueo local a un cliente.",
        data,
      });
    case "booking_created": {
      return createReservationNotification(event, "created");
    }
    case "booking_cancelled": {
      return createReservationNotification(event, "cancelled");
    }
    default:
      return null;
  }
}
