import fs from "fs";
import admin from "firebase-admin";
import { storage } from "./storage";

type PushData = Record<string, string | number | boolean | null | undefined>;

type SystemEventRef = {
  eventType: string;
  branchId?: string | null;
  userId?: string | null;
  payload?: any;
};

type PushSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: string;
};

let firebaseResolved = false;
let firebaseApp: admin.app.App | null = null;
const PUSH_BATCH_SIZE = 500;

function normalizeServiceAccount(serviceAccount: Record<string, any>): admin.ServiceAccount {
  const normalized: admin.ServiceAccount = {
    projectId: serviceAccount.projectId ?? serviceAccount.project_id,
    clientEmail: serviceAccount.clientEmail ?? serviceAccount.client_email,
    privateKey: serviceAccount.privateKey ?? serviceAccount.private_key,
  };

  if (typeof normalized.privateKey === "string") {
    normalized.privateKey = normalized.privateKey.replace(/\\n/g, "\n");
  }

  return normalized;
}

function loadServiceAccountFromEnv(): admin.ServiceAccount | null {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    try {
      return normalizeServiceAccount(JSON.parse(inlineJson));
    } catch (err: any) {
      console.error("[PUSH] FIREBASE_SERVICE_ACCOUNT_JSON invalido:", err?.message || err);
      return null;
    }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return normalizeServiceAccount(JSON.parse(raw));
    } catch (err: any) {
      console.error("[PUSH] FIREBASE_SERVICE_ACCOUNT_PATH invalido:", err?.message || err);
      return null;
    }
  }

  return null;
}

function getFirebaseAppInstance(): admin.app.App | null {
  if (firebaseResolved) {
    return firebaseApp;
  }

  firebaseResolved = true;
  const serviceAccount = loadServiceAccountFromEnv();
  if (!serviceAccount) {
    return null;
  }

  try {
    firebaseApp = admin.apps.length > 0
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
  } catch (err: any) {
    console.error("[PUSH] Error inicializando Firebase Admin:", err?.message || err);
    firebaseApp = null;
  }

  return firebaseApp;
}

function normalizePushData(data?: PushData): Record<string, string> | undefined {
  if (!data) return undefined;

  const entries = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isInvalidTokenErrorCode(code?: string | null): boolean {
  return code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered";
}

async function sendPushToSingleToken(
  app: admin.app.App,
  token: string,
  title: string,
  body: string,
  data?: PushData,
): Promise<{ success: boolean; invalidToken: boolean }> {
  try {
    await admin.messaging(app).send({
      notification: {
        title,
        body,
      },
      data: normalizePushData(data),
      token,
    });
    console.log("Push enviado correctamente");
    return { success: true, invalidToken: false };
  } catch (err: any) {
    const code = err?.code || err?.errorInfo?.code || null;
    console.error("Error enviando push", code || err?.message || err);
    if (isInvalidTokenErrorCode(code)) {
      console.error("[PUSH] Token inválido, se omite");
      return { success: false, invalidToken: true };
    }
    return { success: false, invalidToken: false };
  }
}

async function sendPushToTokens(tokens: string[], title: string, body: string, data?: PushData): Promise<PushSendResult> {
  const normalizedTokens = tokens
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (normalizedTokens.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "no_active_tokens",
    };
  }

  const app = getFirebaseAppInstance();
  if (!app) {
    console.log("Firebase no configurado, push omitido");
    return {
      attempted: normalizedTokens.length,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "firebase_not_configured",
    };
  }

  if (normalizedTokens.length === 1) {
    const result = await sendPushToSingleToken(app, normalizedTokens[0], title, body, data);
    return {
      attempted: 1,
      sent: result.success ? 1 : 0,
      failed: result.success ? 0 : 1,
      skipped: false,
      reason: result.success ? undefined : (result.invalidToken ? "invalid_token" : "send_failed"),
    };
  }

  let sent = 0;
  let failed = 0;
  const payloadData = normalizePushData(data);

  for (let offset = 0; offset < normalizedTokens.length; offset += PUSH_BATCH_SIZE) {
    const batch = normalizedTokens.slice(offset, offset + PUSH_BATCH_SIZE);

    try {
      const response = await admin.messaging(app).sendEachForMulticast({
        tokens: batch,
        notification: {
          title,
          body,
        },
        data: payloadData,
      });

      sent += response.successCount;
      failed += response.failureCount;

      if (response.successCount > 0) {
        console.log("Push enviado correctamente");
      }

      response.responses.forEach((item, index) => {
        if (item.success) return;
        const code = item.error?.code || null;
        console.error("Error enviando push", code || item.error?.message || "unknown_error");
        if (isInvalidTokenErrorCode(code)) {
          console.error(`[PUSH] Token inválido, se omite: ${batch[index]}`);
        }
      });
    } catch (err: any) {
      console.error("Error enviando push", err?.code || err?.message || err);
      failed += batch.length;
    }
  }

  return {
    attempted: normalizedTokens.length,
    sent,
    failed,
    skipped: false,
    reason: failed > 0 ? "partial_failure" : undefined,
  };
}

export async function getActivePushTokensByUser(userId: string) {
  return storage.getActivePushTokensByUser(userId);
}

export async function sendPushToUser(userId: string, title: string, body: string, data?: PushData): Promise<PushSendResult> {
  const tokens = await storage.getActivePushTokensByUser(userId);
  return sendPushToTokens(tokens.map((item) => item.token), title, body, data);
}

export async function sendPushToBranchCustomers(branchId: string, title: string, body: string, data?: PushData): Promise<PushSendResult> {
  const tokens = await storage.getActivePushTokensByBranch(branchId);
  return sendPushToTokens(tokens.map((item) => item.token), title, body, data);
}

function normalizePushText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function sendPushToSuperAdmins(title: string, body: string, data?: PushData) {
  const superAdmins = await storage.getUsersByRole("SUPER_ADMIN");
  if (superAdmins.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(superAdmins.map((user) => user.id)));
  return Promise.all(uniqueIds.map((userId) => sendPushToUser(userId, title, body, data)));
}

export async function dispatchPushFromSystemEvent(event: SystemEventRef) {
  try {
    const data = {
      sourceEventType: event.eventType,
      ...(event.payload ?? {}),
    };

    switch (event.eventType) {
      case "booking_created": {
        if (!event.userId) return null;

        const classScheduleId = normalizePushText(event.payload?.classScheduleId);
        const schedule = classScheduleId ? await storage.getClassSchedule(classScheduleId) : null;
        const startTime = schedule?.startTime ? `Inicia a las ${schedule.startTime}` : "Tu reserva quedó registrada correctamente.";

        return sendPushToUser(
          event.userId,
          "Tienes una nueva reserva",
          startTime,
          data,
        );
      }

      case "booking_cancelled":
        if (!event.userId) return null;
        return sendPushToUser(
          event.userId,
          "Tu reserva fue cancelada",
          "Revisa tu horario para reservar otra clase.",
          data,
        );

      case "promotion_created": {
        if (!event.branchId) return null;
        const promotionTitle = normalizePushText(event.payload?.title);
        return sendPushToBranchCustomers(
          event.branchId,
          "Nueva promoción disponible",
          promotionTitle || "Revisa las promociones nuevas de tu sucursal.",
          data,
        );
      }

      case "customer_reported":
        return sendPushToSuperAdmins(
          "Cliente reportado",
          "Una sucursal reportó a un cliente.",
          data,
        );

      default:
        return null;
    }
  } catch (err: any) {
    console.error(`[PUSH_EVENTS] Failed to dispatch ${event.eventType}:`, err?.stack || err);
    return null;
  }
}
