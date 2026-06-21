import fs from "fs";
import admin from "firebase-admin";

let firebaseResolved = false;
let firebaseApp: admin.app.App | null = null;

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
      console.error("[FIREBASE_ADMIN] FIREBASE_SERVICE_ACCOUNT_JSON invalido:", err?.message || err);
      return null;
    }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return normalizeServiceAccount(JSON.parse(raw));
    } catch (err: any) {
      console.error("[FIREBASE_ADMIN] FIREBASE_SERVICE_ACCOUNT_PATH invalido:", err?.message || err);
      return null;
    }
  }

  return null;
}

export function getFirebaseAdminApp(): admin.app.App | null {
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
    console.error("[FIREBASE_ADMIN] Error inicializando Firebase Admin:", err?.message || err);
    firebaseApp = null;
  }

  return firebaseApp;
}

export function getFirebaseAdminAuth(): admin.auth.Auth | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return admin.auth(app);
}

export class FirebaseAdminConfigurationError extends Error {}

export class FirebaseAdminTokenError extends Error {}

export async function verifyFirebaseIdToken(idToken: string) {
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    throw new FirebaseAdminConfigurationError("Firebase Admin no esta configurado en el servidor");
  }

  try {
    return await auth.verifyIdToken(idToken);
  } catch (err: any) {
    throw new FirebaseAdminTokenError(err?.message || "No fue posible validar el token de Firebase");
  }
}

export async function deleteFirebaseUserByUid(uid: string): Promise<"deleted" | "not_found"> {
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    throw new FirebaseAdminConfigurationError("Firebase Admin no esta configurado en el servidor");
  }

  try {
    await auth.deleteUser(uid);
    return "deleted";
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      return "not_found";
    }
    throw err;
  }
}
