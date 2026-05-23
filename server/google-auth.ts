import { OAuth2Client, type TokenPayload } from "google-auth-library";

const googleClient = new OAuth2Client();

function collectConfiguredAudiences(): string[] {
  const explicitList = (process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const namedValues = [
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
    process.env.GOOGLE_CLIENT_ID_WEB,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value);

  return Array.from(new Set([...explicitList, ...namedValues]));
}

export class GoogleAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthConfigurationError";
  }
}

export class GoogleAuthTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthTokenError";
  }
}

export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  givenName: string | null;
  familyName: string | null;
  avatarUrl: string | null;
  rawPayload: TokenPayload;
  audience: string | null;
}

export function getConfiguredGoogleAudiences(): string[] {
  return collectConfiguredAudiences();
}

export async function verifyGoogleMobileIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
  const trimmedToken = idToken.trim();
  if (!trimmedToken) {
    throw new GoogleAuthTokenError("El idToken es obligatorio");
  }

  const audiences = collectConfiguredAudiences();
  if (audiences.length === 0) {
    throw new GoogleAuthConfigurationError("Google Sign-In no está configurado en el servidor");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: trimmedToken,
    audience: audiences,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new GoogleAuthTokenError("No fue posible validar la identidad de Google");
  }

  const email = (payload.email || "").trim().toLowerCase();
  if (!email) {
    throw new GoogleAuthTokenError("La cuenta de Google no proporcionó correo");
  }

  if (!payload.email_verified) {
    throw new GoogleAuthTokenError("La cuenta de Google no tiene correo verificado");
  }

  const googleId = (payload.sub || "").trim();
  if (!googleId) {
    throw new GoogleAuthTokenError("La cuenta de Google no proporcionó identificador");
  }

  return {
    googleId,
    email,
    emailVerified: !!payload.email_verified,
    fullName: payload.name?.trim() || null,
    givenName: payload.given_name?.trim() || null,
    familyName: payload.family_name?.trim() || null,
    avatarUrl: payload.picture?.trim() || null,
    rawPayload: payload,
    audience: payload.aud?.trim() || null,
  };
}
