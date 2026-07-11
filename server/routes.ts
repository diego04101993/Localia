import type { Express, Request } from "express";
import { type Server } from "http";
import passport from "passport";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import { storage } from "./storage";
import {
  getBranchClientIdentityControl,
  isCrmPlaceholderEmail,
} from "./branch-client-identity";
import {
  deleteAllNotifications,
  deleteNotification,
  deleteReadNotifications,
  dispatchNotificationFromSystemEvent,
  enrichNotificationForDisplay,
  getNotificationSummary,
  markNotificationRead,
  notifyBranchCustomerJoinedFromApp,
  syncBirthdayTodayNotifications,
} from "./notifications";
import { dispatchPushFromSystemEvent } from "./push";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  getTransactionalEmailStatus,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
} from "./email";
import {
  setupAuth,
  requireAuth,
  requireRole,
  isImpersonating,
  getOriginalUserId,
  CUSTOMER_BLOCKED_MESSAGE,
  applySessionLifetimeForRequest,
  getBranchAdminAccessIssue,
  getImpersonationMaxAgeMs,
} from "./auth";
import {
  GoogleAuthConfigurationError,
  GoogleAuthTokenError,
  getConfiguredGoogleAudiences,
  verifyGoogleMobileIdToken,
} from "./google-auth";
import {
  FirebaseAdminConfigurationError,
  FirebaseAdminTokenError,
  deleteFirebaseUserByUid,
  verifyFirebaseIdToken,
} from "./firebase-admin";
import { seedDatabase } from "./seed";
import {
  loginSchema,
  publicCustomerRegisterSchema,
  createBranchSchema,
  createCatalogCategorySchema,
  createCatalogSubcategorySchema,
  createCategoryKeywordLinkSchema,
  joinBranchSchema,
  favoriteBranchSchema,
  createClientSchema,
  updateBranchClientPrivateSchema,
  updateCatalogCategorySchema,
  updateCatalogSubcategorySchema,
  updateBranchClientCrmSchema,
  createCustomerReportSchema,
  updateBranchCustomerBlockSchema,
  updateCustomerGlobalBlockSchema,
  updateCustomerReportStatusSchema,
  updateAppSettingSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
  createPlanSchema,
  assignPlanSchema,
  quickChargeSingleSessionSchema,
  createClassScheduleSchema,
  createBookingSchema,
  createReviewReportSchema,
  updateReviewReplySchema,
  updateReviewReportStatusSchema,
  updateReviewVisibilitySchema,
  createBranchFinanceEntrySchema,
  updateBranchFinanceEntrySchema,
  createBranchRecurringExpenseSchema,
  updateBranchRecurringExpenseSchema,
  registerBranchRecurringExpenseChargeSchema,
  createBranchStaffMemberSchema,
  updateBranchStaffMemberSchema,
  createBranchStaffClassLogSchema,
  createBranchServiceSchema,
  updateBranchServiceSchema,
  createBranchServiceSaleOptionSchema,
  updateBranchServiceSaleOptionSchema,
  branchFinancePaymentMethodValues,
  upsertBranchMonthlyBillingSchema,
} from "@shared/schema";
import { z } from "zod";
import { normalizeSearchText } from "./search-utils";

const DEFAULT_CANCEL_CUTOFF_MINUTES = 180;
const membershipFinancePayloadSchema = z.object({
  paymentMethod: z.enum(branchFinancePaymentMethodValues).nullable().optional(),
});
const assignPlanWithFinanceSchema = assignPlanSchema.extend({
  paymentMethod: z.enum(branchFinancePaymentMethodValues).nullable().optional(),
});
const updateBranchClientGlobalSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(120, "Maximo 120 caracteres").optional(),
  email: z.string().email("Correo invalido").optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
});

function addCalendarMonths(from: Date, months: number): Date {
  if (months === 0) {
    const result = new Date(from);
    result.setDate(result.getDate() + 1);
    return result;
  }
  const result = new Date(from);
  const dayOfMonth = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== dayOfMonth) {
    result.setDate(0);
  }
  return result;
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function resolveLocalUploadPath(fileUrl: string | null | undefined): string | null {
  if (typeof fileUrl !== "string") return null;

  const trimmed = fileUrl.trim();
  if (!trimmed.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = trimmed.replace(/^\/+/, "");
  const resolvedPath = path.resolve(process.cwd(), relativePath);
  const uploadsRoot = path.resolve(uploadsDir);
  const relativeToUploads = path.relative(uploadsRoot, resolvedPath);

  if (relativeToUploads.startsWith("..") || path.isAbsolute(relativeToUploads)) {
    return null;
  }

  return resolvedPath;
}

function deleteLocalUploadFiles(fileUrls: Array<string | null | undefined>): number {
  const uniqueUrls = Array.from(
    new Set(
      fileUrls
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  );

  let deletedCount = 0;
  for (const fileUrl of uniqueUrls) {
    const localPath = resolveLocalUploadPath(fileUrl);
    if (!localPath) continue;

    try {
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        deletedCount += 1;
      }
    } catch (err: any) {
      console.error(`[UPLOAD_DELETE] Failed to delete ${localPath}:`, err?.stack || err);
    }
  }

  return deletedCount;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const ext = path.extname(file.originalname).toLowerCase() || `.${file.mimetype.split("/")[1]}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Permitidos: jpg, png, webp, mp4, webm`));
    }
  },
});

const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25 MB

const uploadVideo = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan videos mp4 o webm`));
    }
  },
});

function generateSecurePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMxPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("521") && digits.length === 13) return `52${digits.slice(3)}`;
  if (digits.startsWith("52")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return `52${digits.slice(1)}`;
  if (digits.length === 10) return `52${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

const normalizeMxPhoneLike = normalizeMxPhone;

function normalizeComparableName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeComparableFullName(name: unknown, lastName?: unknown): string | null {
  const fullName = [name, lastName]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  return normalizeComparableName(fullName);
}

function normalizeComparableEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparableBirthDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function buildBranchClientDuplicateSummary(client: any) {
  return {
    userId: client.userId,
    membershipId: client.membershipId,
    membershipStatus: client.membershipStatus,
    name: client.name,
    lastName: client.lastName ?? null,
    email: isCrmPlaceholderEmail(client.email) ? null : client.email,
    phone: client.phone ?? null,
    birthDate: client.birthDate ?? null,
    source: client.source,
    identityControl: client.identityControl ?? null,
  };
}

function buildIncomingClientIdentity(data: {
  name?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  firebaseUid?: string | null;
}) {
  return {
    fullName: normalizeComparableFullName(data.name ?? null, data.lastName ?? null),
    email: normalizeComparableEmail(data.email ?? null),
    phone: normalizeMxPhone(data.phone ?? null),
    birthDate: normalizeComparableBirthDate(data.birthDate ?? null),
    firebaseUid: normalizeOptionalText(data.firebaseUid) ?? null,
  };
}

function evaluateBranchClientDuplicateMatch(client: any, incoming: ReturnType<typeof buildIncomingClientIdentity>) {
  const candidate = {
    fullName: normalizeComparableFullName(client.name, client.lastName),
    email: normalizeComparableEmail(client.email),
    phone: normalizeMxPhone(client.phone),
    birthDate: normalizeComparableBirthDate(client.birthDate),
    firebaseUid: normalizeOptionalText(client.firebaseUid) ?? null,
  };

  const matches = {
    phone: !!incoming.phone && incoming.phone === candidate.phone,
    email: !!incoming.email && incoming.email === candidate.email,
    firebaseUid: !!incoming.firebaseUid && incoming.firebaseUid === candidate.firebaseUid,
    fullName: !!incoming.fullName && incoming.fullName === candidate.fullName,
    birthDate: !!incoming.birthDate && incoming.birthDate === candidate.birthDate,
  };

  const conflictingFields: string[] = [];
  const hasPrimarySignal = matches.phone || matches.email || matches.firebaseUid;

  if (hasPrimarySignal && incoming.fullName && candidate.fullName && incoming.fullName !== candidate.fullName) {
    conflictingFields.push("name");
  }
  if (hasPrimarySignal && incoming.birthDate && candidate.birthDate && incoming.birthDate !== candidate.birthDate) {
    conflictingFields.push("birthDate");
  }

  const strongReasons: string[] = [];
  if (matches.phone) strongReasons.push("phone");
  if (matches.email) strongReasons.push("email");
  if (matches.firebaseUid) strongReasons.push("firebaseUid");
  if (matches.fullName && matches.birthDate && matches.phone) strongReasons.push("nameBirthPhone");
  if (matches.fullName && matches.birthDate && matches.email) strongReasons.push("nameBirthEmail");

  const isStrong = strongReasons.length > 0 && conflictingFields.length === 0;
  const isPossible =
    !isStrong &&
    (
      (matches.fullName && matches.birthDate) ||
      (hasPrimarySignal && conflictingFields.length > 0)
    );

  return {
    candidate: buildBranchClientDuplicateSummary(client),
    isStrong,
    isPossible,
    strongReasons,
    conflictingFields,
  };
}

function chooseBestBranchClientMatch(matches: Array<ReturnType<typeof evaluateBranchClientDuplicateMatch>>) {
  return [...matches].sort((left, right) => {
    const leftStatusScore = left.candidate.membershipStatus === "active" ? 2 : left.candidate.membershipStatus === "left" ? 1 : 0;
    const rightStatusScore = right.candidate.membershipStatus === "active" ? 2 : right.candidate.membershipStatus === "left" ? 1 : 0;

    if (leftStatusScore !== rightStatusScore) return rightStatusScore - leftStatusScore;
    return left.candidate.name.localeCompare(right.candidate.name);
  })[0];
}

function collectBranchClientDuplicateMatches(branchClients: any[], incoming: ReturnType<typeof buildIncomingClientIdentity>) {
  const matches = branchClients
    .map((client) => evaluateBranchClientDuplicateMatch(client, incoming))
    .filter((match) => match.isStrong || match.isPossible);

  const strongMatches = matches.filter((match) => match.isStrong);
  const possibleMatches = matches.filter((match) => match.isPossible);

  return {
    strongMatches,
    possibleMatches,
    bestStrongMatch: strongMatches.length > 0 ? chooseBestBranchClientMatch(strongMatches) : null,
    bestPossibleMatch: possibleMatches.length > 0 ? chooseBestBranchClientMatch(possibleMatches) : null,
  };
}

function getMissingClientFieldUpdates(existingUser: any, incoming: {
  name?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  gender?: string | null;
}) {
  const updates: Record<string, any> = {};

  if ((!existingUser.name || !existingUser.name.trim()) && incoming.name?.trim()) {
    updates.name = incoming.name.trim();
  }
  if ((!existingUser.lastName || !existingUser.lastName.trim()) && incoming.lastName?.trim()) {
    updates.lastName = incoming.lastName.trim();
  }
  if ((!existingUser.phone || !existingUser.phone.trim()) && incoming.phone?.trim()) {
    updates.phone = incoming.phone.trim();
  }
  if ((!existingUser.birthDate || !existingUser.birthDate.trim()) && incoming.birthDate?.trim()) {
    updates.birthDate = incoming.birthDate.trim();
  }
  if ((!existingUser.gender || !existingUser.gender.trim()) && incoming.gender?.trim()) {
    updates.gender = incoming.gender.trim();
  }
  if (isCrmPlaceholderEmail(existingUser.email) && incoming.email && !isCrmPlaceholderEmail(incoming.email)) {
    updates.email = incoming.email.trim().toLowerCase();
  }

  return updates;
}

function getBranchClientPhoneMatches(branchClients: any[], normalizedPhone: string | null, excludeUserId?: string | null) {
  if (!normalizedPhone) return [];

  return branchClients.filter((client) => {
    if (excludeUserId && client.userId === excludeUserId) return false;
    return normalizeMxPhone(client.phone) === normalizedPhone;
  });
}

function buildBranchClientPrivateProfilePayload(data: {
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  medicalNotes?: string | null;
  injuriesNotes?: string | null;
  medicalWarnings?: string | null;
  parqAccepted?: boolean;
  parqAcceptedDate?: string | null;
}) {
  const payload: Record<string, any> = {};

  if (data.emergencyContactName !== undefined) payload.emergencyContactName = data.emergencyContactName || null;
  if (data.emergencyContactPhone !== undefined) payload.emergencyContactPhone = data.emergencyContactPhone || null;
  if (data.medicalNotes !== undefined) payload.medicalNotes = data.medicalNotes || null;
  if (data.injuriesNotes !== undefined) payload.injuriesNotes = data.injuriesNotes || null;
  if (data.medicalWarnings !== undefined) payload.medicalWarnings = data.medicalWarnings || null;
  if (data.parqAccepted !== undefined) payload.parqAccepted = data.parqAccepted;
  if (data.parqAcceptedDate !== undefined) payload.parqAcceptedDate = data.parqAcceptedDate || null;

  return payload;
}

async function maybeLinkExistingBranchClientToAuthenticatedUser(
  user: any,
  branchId: string,
  source: "join" | "favorite",
) {
  const branchClients = await storage.getBranchClients(branchId, true);
  const incomingIdentity = buildIncomingClientIdentity({
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    birthDate: user.birthDate,
    firebaseUid: user.firebaseUid,
  });
  const phoneMatches = getBranchClientPhoneMatches(branchClients, incomingIdentity.phone, user.id).filter(
    (match) => match.membershipStatus !== "banned",
  );

  if (phoneMatches.length === 1) {
    const selectedMatch = buildBranchClientDuplicateSummary(phoneMatches[0]);
    await storage.linkBranchClientToAppUser(branchId, selectedMatch.userId, user.id);
    await storage.createAuditLog({
      actorUserId: user.id,
      action: "LINK_APP_USER_TO_BRANCH_CLIENT",
      branchId,
      metadata: {
        source,
        sourceUserId: selectedMatch.userId,
        targetUserId: user.id,
        strongReasons: ["phone"],
      },
    });

    return { membership: await storage.getMembership(user.id, branchId), blocked: null };
  }

  if (phoneMatches.length > 1) {
    await storage.createAuditLog({
      actorUserId: user.id,
      action: "APP_USER_DUPLICATE_MATCH_REVIEW_REQUIRED",
      branchId,
      metadata: {
        source,
        duplicateType: "ambiguous_phone",
        normalizedPhone: incomingIdentity.phone,
        candidateUserIds: phoneMatches.map((client) => client.userId),
      },
    });

    return {
      membership: null,
      blocked: {
        code: "AMBIGUOUS_DUPLICATE",
        message: "Ya existen varios clientes con ese telefono en esta sucursal. Revisa la base antes de vincular la cuenta.",
      },
    };
  }

  const duplicateMatches = collectBranchClientDuplicateMatches(branchClients, incomingIdentity);
  const strongMatches = duplicateMatches.strongMatches.filter(
    (match) =>
      match.candidate.userId !== user.id &&
      match.candidate.membershipStatus !== "banned",
  );

  if (strongMatches.length === 1) {
    const selectedMatch = chooseBestBranchClientMatch(strongMatches);
    await storage.linkBranchClientToAppUser(branchId, selectedMatch.candidate.userId, user.id);
    await storage.createAuditLog({
      actorUserId: user.id,
      action: "LINK_APP_USER_TO_BRANCH_CLIENT",
      branchId,
      metadata: {
        source,
        sourceUserId: selectedMatch.candidate.userId,
        targetUserId: user.id,
        strongReasons: selectedMatch.strongReasons,
      },
    });

    return { membership: await storage.getMembership(user.id, branchId), blocked: null };
  }

  if (strongMatches.length > 1 || duplicateMatches.possibleMatches.length > 0) {
    const bestCandidate =
      (strongMatches.length > 0 ? chooseBestBranchClientMatch(strongMatches) : null) ||
      duplicateMatches.bestPossibleMatch;

    await storage.createAuditLog({
      actorUserId: user.id,
      action: "APP_USER_DUPLICATE_MATCH_REVIEW_REQUIRED",
      branchId,
      metadata: {
        source,
        candidateUserId: bestCandidate?.candidate.userId ?? null,
        strongMatchCount: strongMatches.length,
        possibleMatchCount: duplicateMatches.possibleMatches.length,
      },
    });
  }

  return { membership: null, blocked: null };
}

function buildCrmPlaceholderEmail(branchId: string, normalizedPhone: string | null): string {
  const branchToken = branchId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "branch";
  const phoneToken = normalizedPhone?.slice(-10) || crypto.randomBytes(4).toString("hex");
  const uniqueToken = crypto.randomBytes(3).toString("hex");
  return `crm+${branchToken}.${phoneToken}.${uniqueToken}@crm.webcool.local`;
}

function getMxIsoDate(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function calculatePlanExpirationDate(plan: { cycleMonths: number | null; durationDays?: number | null }, from = new Date()): Date {
  if ((plan.cycleMonths ?? 1) === 0) {
    const result = new Date(from);
    result.setDate(result.getDate() + Math.max(plan.durationDays ?? 1, 1));
    return result;
  }

  return addCalendarMonths(from, plan.cycleMonths ?? 1);
}

function normalizeSearchKeywords(value: unknown): string | null | undefined {
  const normalized = normalizeOptionalText(value);
  if (normalized === undefined || normalized === null) return normalized;

  const keywords = normalized
    .split(/[,;\n]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const uniqueKeywords = Array.from(new Set(keywords));
  return uniqueKeywords.length > 0 ? uniqueKeywords.join(", ") : null;
}

function normalizeTags(value: unknown): string | null | undefined {
  return normalizeSearchKeywords(value);
}

function normalizeModerationText(value: unknown): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized === undefined ? null : normalized;
}

function sanitizeUserForResponse(user: any) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function buildAuthSuccessResponse(user: any, message?: string) {
  const safeUser = sanitizeUserForResponse(user);
  return {
    ...(message ? { message } : {}),
    success: true,
    role: safeUser.role,
    acceptedTerms: !!safeUser.acceptedTerms,
    user: safeUser,
  };
}

function normalizeEmailValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 ? null : normalized;
}

function buildFallbackCustomerName(email: string): string {
  const emailPrefix = email.split("@")[0]?.trim();
  return emailPrefix && emailPrefix.length > 0 ? emailPrefix : "Cliente";
}

function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return { firstName: "", lastName: null };
  }

  const segments = normalized.split(" ");
  if (segments.length === 1) {
    return { firstName: normalized, lastName: null };
  }

  return {
    firstName: segments[0] || normalized,
    lastName: segments.slice(1).join(" ") || null,
  };
}

function resolveAppleLinkedAuthProvider(currentProvider: unknown): string {
  const normalized = normalizeOptionalText(currentProvider) ?? "email";
  if (normalized === "apple" || normalized === "email_apple") {
    return normalized;
  }
  if (normalized === "email") {
    return "email_apple";
  }
  return normalized;
}

async function verifyAppleMobileFirebaseIdentity(
  firebaseIdToken: string,
  hints?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  },
) {
  const decoded = await verifyFirebaseIdToken(firebaseIdToken);
  const provider = (decoded.firebase as any)?.sign_in_provider?.toString().trim() ?? "";
  if (provider !== "apple.com") {
    throw new FirebaseAdminTokenError("El token no corresponde a Sign in with Apple");
  }

  const email =
    normalizeEmailValue(decoded.email) ??
    normalizeEmailValue(hints?.email);
  const fullName =
    normalizeOptionalText((decoded as any).name) ??
    normalizeOptionalText(hints?.fullName);
  const nameParts = fullName ? splitFullName(fullName) : { firstName: "", lastName: null };
  const firstName =
    normalizeOptionalText(hints?.firstName) ??
    normalizeOptionalText(nameParts.firstName);
  const lastName =
    normalizeOptionalText(hints?.lastName) ??
    normalizeOptionalText(nameParts.lastName);

  return {
    firebaseUid: decoded.uid.trim(),
    email,
    emailVerified: decoded.email_verified === true,
    firstName,
    lastName,
    fullName: normalizeOptionalText(fullName),
  };
}

function completeLoginSession(
  req: Request,
  res: any,
  next: (err?: any) => void,
  user: any,
  responseBody: any,
  statusCode = 200,
  loginLabel = "auth",
) {
  req.logIn(user, (err) => {
    if (err) return next(err);

    applySessionLifetimeForRequest(req, user);

    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);

      if (process.env.SESSION_DEBUG_LOGS === "true") {
        console.log(`[AUTH] Sesión ${loginLabel} creada para ${user.email} (${user.role}) :: sid=${req.sessionID}`);
      }

      return res.status(statusCode).json(responseBody);
    });
  });
}

function getStringParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseDateQueryValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function inferSearchSource(req: Request): "web" | "mobile" | "unknown" {
  const userAgent = String(req.get("user-agent") || "").toLowerCase();
  if (userAgent.includes("dart") || userAgent.includes("flutter") || userAgent.includes("okhttp")) {
    return "mobile";
  }
  if (userAgent.includes("mozilla") || !!req.get("origin") || !!req.get("sec-fetch-site")) {
    return "web";
  }
  return "unknown";
}

async function createSystemEventSafe(data: {
  eventType: string;
  branchId?: string | null;
  userId?: string | null;
  payload?: any;
  status?: string;
}) {
  try {
    const event = await storage.createSystemEvent(data);
    await dispatchNotificationFromSystemEvent({
      eventType: event.eventType,
      branchId: event.branchId,
      userId: event.userId,
      payload: event.payload,
    });
    void dispatchPushFromSystemEvent({
      eventType: event.eventType,
      branchId: event.branchId,
      userId: event.userId,
      payload: event.payload,
    });
  } catch (err: any) {
    console.error(`[SYSTEM_EVENTS] Failed to create ${data.eventType}:`, err?.stack || err);
  }
}

async function createReservationAuditSafe(data: {
  bookingId: string;
  branchId: string;
  customerUserId: string;
  actorUserId?: string | null;
  actorRole: string;
  action: "created" | "cancelled" | "attended" | "no_show";
  reason?: string | null;
  source?: string;
  metadata?: any;
}) {
  try {
    await storage.createReservationAuditLog({
      bookingId: data.bookingId,
      branchId: data.branchId,
      customerUserId: data.customerUserId,
      actorUserId: data.actorUserId ?? null,
      actorRole: data.actorRole,
      action: data.action,
      reason: data.reason ?? null,
      source: data.source ?? "system",
      metadata: data.metadata ?? null,
    });
  } catch (err: any) {
    console.error(`[RESERVATION_AUDIT] Failed to create ${data.action}:`, err?.stack || err);
  }
}

async function createNotificationJobSafe(data: {
  type: string;
  branchId?: string | null;
  userId?: string | null;
  payload?: any;
  scheduledFor: Date;
  status?: string;
}) {
  try {
    await storage.createNotificationJob({
      type: data.type,
      branchId: data.branchId ?? null,
      userId: data.userId ?? null,
      payload: data.payload ?? null,
      scheduledFor: data.scheduledFor,
      status: data.status ?? "pending",
      attempts: 0,
      lastError: null,
    });
  } catch (err: any) {
    console.error(`[NOTIFICATION_JOBS] Failed to create ${data.type}:`, err?.stack || err);
  }
}

async function scheduleBookingReminderJobSafe(params: {
  bookingId: string;
  branchId: string;
  userId: string;
  classScheduleId: string;
  bookingDate: string;
}) {
  try {
    const schedule = await storage.getClassSchedule(params.classScheduleId);
    if (!schedule) return;

    const scheduledFor = new Date(`${params.bookingDate}T${schedule.startTime}:00`);
    if (Number.isNaN(scheduledFor.getTime())) return;
    scheduledFor.setHours(scheduledFor.getHours() - 2);
    if (scheduledFor.getTime() <= Date.now()) return;

    await createNotificationJobSafe({
      type: "booking_reminder",
      branchId: params.branchId,
      userId: params.userId,
      scheduledFor,
      payload: {
        bookingId: params.bookingId,
        classScheduleId: params.classScheduleId,
        bookingDate: params.bookingDate,
      },
    });
  } catch (err: any) {
    console.error("[NOTIFICATION_JOBS] Failed to schedule booking reminder:", err?.stack || err);
  }
}

async function getActiveBranchBlockMessage(userId: string, branchId: string): Promise<string | null> {
  const block = await storage.getActiveBranchCustomerBlock(branchId, userId);
  if (!block) return null;
  return "No puedes interactuar con esta sucursal.";
}

const createBranchWithAdminSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  slug: z.string().min(1, "El slug es obligatorio").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  createAdmin: z.boolean().optional().default(false),
  adminEmail: z.string().email("Correo inválido").optional(),
  adminPassword: z.string().min(6).optional(),
  adminName: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  searchKeywords: z.string().optional(),
});

const updateSuperAdminBranchSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").optional(),
  slug: z.string().min(1, "El slug es obligatorio").regex(/^[a-z0-9-]+$/, "Solo letras minÃºsculas, nÃºmeros y guiones").optional(),
  status: z.enum(["active", "suspended", "blacklisted"]).optional(),
  category: z.string().min(1, "La categorÃ­a es obligatoria").optional(),
  subcategory: z.string().nullable().optional(),
  searchKeywords: z.string().nullable().optional(),
});

const googleMobileLoginSchema = z.object({
  idToken: z.string().min(1, "El idToken es obligatorio"),
});

const appleMobileLoginSchema = z.object({
  firebaseIdToken: z.string().min(1, "El token de Firebase es obligatorio"),
  email: z.string().email("Correo invalido").optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
});

const deleteCurrentUserSchema = z.object({
  firebaseIdToken: z.string().min(1).optional(),
});

const destructiveDeleteConfirmationSchema = z.object({
  confirmationText: z.string().min(1, "La confirmación es obligatoria"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  const express = (await import("express")).default;
  app.use("/uploads", express.static(uploadsDir));

  app.post("/api/branch/upload", requireAuth, (req, res, next) => {
    const user = req.user as any;
    if (user.role !== "BRANCH_ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    if (!user.branchId) {
      return res.status(400).json({ message: "No hay sucursal asignada" });
    }
    next();
  }, (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "El archivo excede el tamaño máximo de 10MB" });
          }
          return res.status(400).json({ message: `Error de archivo: ${err.message}` });
        }
        return res.status(400).json({ message: err.message || "Error al subir archivo" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }
      const url = `/uploads/${req.file.filename}`;
      console.log(`[UPLOAD] File uploaded: ${url} by ${(req.user as any).email}`);
      res.json({ url });
    });
  });

  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos" });
    }
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Credenciales incorrectas" });
      }

      const { passwordHash, ...safeUser } = user;
      return completeLoginSession(req, res, next, user, safeUser, 200, "local");
    })(req, res, next);
  });

  app.post("/api/auth/google-mobile", async (req, res, next) => {
    const result = googleMobileLoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Datos inválidos",
      });
    }

    if (getConfiguredGoogleAudiences().length === 0) {
      return res.status(503).json({
        message: "Google Sign-In no está configurado en el servidor",
        code: "GOOGLE_AUTH_NOT_CONFIGURED",
        missingEnv: ["GOOGLE_SERVER_CLIENT_ID o GOOGLE_CLIENT_IDS", "GOOGLE_CLIENT_ID_ANDROID/IOS/WEB"],
      });
    }

    try {
      const identity = await verifyGoogleMobileIdToken(result.data.idToken);
      const verifiedAt = identity.emailVerified ? new Date().toISOString() : null;
      let user = await storage.getUserByGoogleId(identity.googleId);
      let createdNewUser = false;

      if (user) {
        if (user.role !== "CUSTOMER") {
          return res.status(403).json({
            message: "Esta cuenta pertenece a un administrador. Usa el acceso web correspondiente.",
            code: "WRONG_ROLE",
          });
        }
        if ((user as any).isBlocked) {
          return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
        }

        const updates: Record<string, any> = {};
        if (!user.name && (identity.givenName || identity.fullName)) {
          updates.name = identity.givenName || identity.fullName;
        }
        if (!user.lastName && identity.familyName) {
          updates.lastName = identity.familyName;
        }
        if (!user.avatarUrl && identity.avatarUrl) {
          updates.avatarUrl = identity.avatarUrl;
        }
        if (!user.emailVerified && identity.emailVerified) {
          updates.emailVerified = true;
          updates.emailVerifiedAt = verifiedAt;
        }
        if (user.authProvider !== "google" && user.authProvider !== "email_google") {
          updates.authProvider = user.authProvider ? "email_google" : "google";
        }

        if (Object.keys(updates).length > 0) {
          user = (await storage.updateUser(user.id, updates)) || user;
        }
      } else {
        const existingByEmail = await storage.getUserByEmail(identity.email);

        if (existingByEmail) {
          if (existingByEmail.role !== "CUSTOMER") {
            return res.status(403).json({
              message: "Este correo pertenece a una cuenta de administrador. Usa el acceso web correspondiente.",
              code: "WRONG_ROLE",
            });
          }
          if ((existingByEmail as any).isBlocked) {
            return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
          }

          user = (await storage.updateUser(existingByEmail.id, {
            googleId: identity.googleId,
            authProvider: existingByEmail.authProvider === "google" ? "google" : "email_google",
            ...(existingByEmail.name ? {} : { name: identity.givenName || identity.fullName || existingByEmail.name }),
            ...(existingByEmail.lastName ? {} : { lastName: identity.familyName || existingByEmail.lastName || null }),
            ...(existingByEmail.avatarUrl ? {} : { avatarUrl: identity.avatarUrl || null }),
            ...(!existingByEmail.emailVerified && identity.emailVerified
              ? { emailVerified: true, emailVerifiedAt: verifiedAt }
              : {}),
          })) || existingByEmail;
        } else {
          const generatedPassword = generateSecurePassword(24);
          const passwordHash = await bcrypt.hash(generatedPassword, 10);
          const resolvedName = identity.givenName || identity.fullName || identity.email.split("@")[0] || "Cliente";
          const createdUser = await storage.createUser({
            email: identity.email,
            passwordHash,
            role: "CUSTOMER",
            name: resolvedName,
            lastName: identity.familyName || null,
            avatarUrl: identity.avatarUrl || null,
            googleId: identity.googleId,
            authProvider: "google",
            emailVerified: identity.emailVerified,
            emailVerifiedAt: verifiedAt,
            acceptedTerms: false,
          } as any);

          user = createdUser;
          createdNewUser = true;

          await createSystemEventSafe({
            eventType: "customer_registered",
            userId: createdUser.id,
            payload: {
              source: "google_mobile",
              activatedExisting: false,
              provider: "google",
              audience: identity.audience,
            },
          });
        }
      }

if (!user) {
        return res.status(500).json({ message: "No fue posible iniciar sesión con Google" });
      }

      return completeLoginSession(
        req,
        res,
        next,
        user,
        buildAuthSuccessResponse(
          user,
          createdNewUser ? "Cuenta creada con Google" : "Inicio de sesión con Google correcto",
        ),
        200,
        "google",
      );
    } catch (err) {
      if (err instanceof GoogleAuthConfigurationError) {
        console.error("[GOOGLE_AUTH] configuration error:", err.message);
        return res.status(503).json({ message: err.message, code: "GOOGLE_AUTH_NOT_CONFIGURED" });
      }
      if (err instanceof GoogleAuthTokenError) {
        console.warn("[GOOGLE_AUTH] token rejected:", err.message);
        return res.status(401).json({ message: err.message, code: "INVALID_GOOGLE_TOKEN" });
      }
      const errorCode = typeof (err as any)?.code === "string" ? (err as any).code : "";
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("Failed to retrieve verification certificates") ||
        ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "ENOTFOUND", "ECONNRESET", "EAI_AGAIN"].includes(errorCode)
      ) {
        console.error("[GOOGLE_AUTH] temporarily unavailable:", errorCode || errorMessage);
        return res.status(503).json({
          message: "Google Sign-In no pudo validarse en este momento. Intenta de nuevo más tarde.",
          code: "GOOGLE_AUTH_TEMPORARILY_UNAVAILABLE",
        });
      }
      if (
        errorMessage.toLowerCase().includes("wrong number of segments") ||
        errorMessage.toLowerCase().includes("invalid token") ||
        errorMessage.toLowerCase().includes("jwt") ||
        errorMessage.toLowerCase().includes("token used too late") ||
        errorMessage.toLowerCase().includes("token used too early")
      ) {
        console.warn("[GOOGLE_AUTH] invalid token:", errorMessage);
        return res.status(401).json({
          message: "No fue posible validar el token de Google",
          code: "INVALID_GOOGLE_TOKEN",
        });
      }
      next(err);
    }
  });

  app.post("/api/auth/apple-mobile", async (req, res, next) => {
    const result = appleMobileLoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: result.error.flatten() });
    }

    try {
      const identity = await verifyAppleMobileFirebaseIdentity(
        result.data.firebaseIdToken,
        {
          email: result.data.email,
          firstName: result.data.firstName,
          lastName: result.data.lastName,
          fullName: result.data.fullName,
        },
      );
      const verifiedAt = identity.emailVerified ? new Date().toISOString() : null;
      let user = await storage.getUserByFirebaseUid(identity.firebaseUid);
      let createdNewUser = false;

      if (user) {
        if (user.role !== "CUSTOMER") {
          return res.status(403).json({
            message: "Esta cuenta pertenece a un administrador. Usa el acceso web correspondiente.",
            code: "WRONG_ROLE",
          });
        }
        if ((user as any).isBlocked) {
          return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
        }

        const updates: Record<string, any> = {};
        if (!user.name && (identity.firstName || identity.fullName)) {
          updates.name = identity.firstName || identity.fullName;
        }
        if (!user.lastName && identity.lastName) {
          updates.lastName = identity.lastName;
        }
        if (!user.emailVerified && identity.emailVerified) {
          updates.emailVerified = true;
          updates.emailVerifiedAt = verifiedAt;
        }
        if (!user.firebaseUid) {
          updates.firebaseUid = identity.firebaseUid;
        }
        if (user.authProvider !== "apple" && user.authProvider !== "email_apple") {
          updates.authProvider = resolveAppleLinkedAuthProvider(user.authProvider);
        }

        if (Object.keys(updates).length > 0) {
          user = (await storage.updateUser(user.id, updates)) || user;
        }
      } else {
        const resolvedEmail = identity.email;
        if (!resolvedEmail) {
          return res.status(400).json({
            message:
              "No fue posible recuperar tu correo de Apple. Quita el acceso de esta app desde tu Apple ID y vuelve a intentarlo.",
            code: "APPLE_EMAIL_REQUIRED",
          });
        }

        const existingByEmail = await storage.getUserByEmail(resolvedEmail);
        if (existingByEmail) {
          if (existingByEmail.role !== "CUSTOMER") {
            return res.status(403).json({
              message: "Este correo pertenece a una cuenta de administrador. Usa el acceso web correspondiente.",
              code: "WRONG_ROLE",
            });
          }
          if ((existingByEmail as any).isBlocked) {
            return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
          }
          if (
            existingByEmail.firebaseUid &&
            existingByEmail.firebaseUid !== identity.firebaseUid
          ) {
            return res.status(409).json({
              message:
                "Este correo ya esta vinculado a otra cuenta de Apple. Inicia sesion con el metodo original o contacta soporte.",
              code: "APPLE_ACCOUNT_MISMATCH",
            });
          }

          user = (await storage.updateUser(existingByEmail.id, {
            firebaseUid: identity.firebaseUid,
            authProvider: resolveAppleLinkedAuthProvider(existingByEmail.authProvider),
            ...(existingByEmail.name ? {} : { name: identity.firstName || identity.fullName || existingByEmail.name }),
            ...(existingByEmail.lastName ? {} : { lastName: identity.lastName || existingByEmail.lastName || null }),
            ...(!existingByEmail.emailVerified && identity.emailVerified
              ? { emailVerified: true, emailVerifiedAt: verifiedAt }
              : {}),
          })) || existingByEmail;
        } else {
          const generatedPassword = generateSecurePassword(24);
          const passwordHash = await bcrypt.hash(generatedPassword, 10);
          const resolvedName =
            identity.firstName ||
            identity.fullName ||
            buildFallbackCustomerName(resolvedEmail);

          const createdUser = await storage.createUser({
            email: resolvedEmail,
            passwordHash,
            role: "CUSTOMER",
            name: resolvedName,
            lastName: identity.lastName,
            firebaseUid: identity.firebaseUid,
            authProvider: "apple",
            emailVerified: identity.emailVerified,
            emailVerifiedAt: verifiedAt,
            acceptedTerms: false,
          } as any);

          user = createdUser;
          createdNewUser = true;

          await createSystemEventSafe({
            eventType: "customer_registered",
            userId: createdUser.id,
            payload: {
              source: "apple_mobile",
              activatedExisting: false,
              provider: "apple",
            },
          });
        }
      }

      if (!user) {
        return res.status(500).json({ message: "No fue posible iniciar sesion con Apple" });
      }

      return completeLoginSession(
        req,
        res,
        next,
        user,
        buildAuthSuccessResponse(
          user,
          createdNewUser ? "Cuenta creada con Apple" : "Inicio de sesion con Apple correcto",
        ),
        200,
        "apple",
      );
    } catch (err) {
      if (err instanceof FirebaseAdminConfigurationError) {
        console.error("[APPLE_AUTH] configuration error:", err.message);
        return res.status(503).json({ message: err.message, code: "FIREBASE_AUTH_NOT_CONFIGURED" });
      }
      if (err instanceof FirebaseAdminTokenError) {
        console.warn("[APPLE_AUTH] token rejected:", err.message);
        return res.status(401).json({ message: err.message, code: "INVALID_APPLE_TOKEN" });
      }
      next(err);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const actor = req.user as any;
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Error al cerrar sesión" });
      if (process.env.SESSION_DEBUG_LOGS === "true" && actor?.email) {
        console.log(`[AUTH] Sesión cerrada para ${actor.email} :: sid=${req.sessionID}`);
      }
      res.json({ message: "Sesión cerrada" });
    });
  });

  // ─── Registro público de clientes ────────────────────────────────────────
  app.post("/api/auth/register", async (req, res, next) => {
    const result = publicCustomerRegisterSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }
    const { name, lastName, email, password, phone, birthDate, gender } = result.data;
    const TERMS_VERSION = "1.0";

    try {
      const existing = await storage.getUserByEmail(email);

      if (existing) {
        if ((existing as any).isBlocked) {
          return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
        }
        if (existing.role !== "CUSTOMER") {
          return res.status(409).json({
            code: "WRONG_ROLE",
            message: "Este correo pertenece a una cuenta de administrador. Inicia sesión normalmente.",
          });
        }
        if ((existing as any).acceptedTerms) {
          return res.status(409).json({
            code: "ALREADY_EXISTS",
            message: "Ya existe una cuenta con este correo. Inicia sesión.",
          });
        }
        // Cliente existente con contraseña (creado por sucursal) — no sobreescribir
        if ((existing as any).passwordHash) {
          return res.status(409).json({
            code: "HAS_CREDENTIALS",
            message: "Ya tienes un perfil en WebCool. Inicia sesión con tu contraseña y acepta los términos para continuar.",
          });
        }
        // Cliente existente SIN contraseña — activar (caso especial: alta sin credenciales)
        const hash = await bcrypt.hash(password, 10);
        const updated = await storage.activateCustomerAccount(existing.id, {
          passwordHash: hash,
          name,
          lastName,
          phone: phone || undefined,
          birthDate: birthDate || undefined,
          gender: gender || undefined,
          termsVersion: TERMS_VERSION,
        });
        await createSystemEventSafe({
          eventType: "customer_registered",
          userId: existing.id,
          payload: {
            source: "public_register",
            activatedExisting: true,
          },
        });
        const { passwordHash: _ph, ...safeUser } = updated as any;
        return completeLoginSession(
          req,
          res,
          next,
          updated!,
          { message: "Cuenta activada correctamente", user: safeUser },
          200,
          "register-activation",
        );
        return;
      }

      // Usuario nuevo
      const hash = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        email,
        passwordHash: hash,
        role: "CUSTOMER",
        name,
        acceptedTerms: true,
        acceptedTermsAt: new Date().toISOString(),
        termsVersion: TERMS_VERSION,
      } as any);

      // Guardar campos adicionales
      await storage.updateClient(newUser.id, {
        lastName: lastName || null,
        phone: phone || null,
        birthDate: birthDate || null,
        gender: (gender as any) || null,
      });

      const freshUser = await storage.getUser(newUser.id);
      // Send verification email (async, don't block response)
      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      storage.setEmailVerificationToken(newUser.id, verifyToken, verifyExpires).then(() =>
        sendEmailVerificationEmail(newUser.email, verifyToken)
      ).catch(e => console.error("[REGISTER] email verify send failed:", e));

      await createSystemEventSafe({
        eventType: "customer_registered",
        userId: newUser.id,
        payload: {
          source: "public_register",
          activatedExisting: false,
        },
      });

      const { passwordHash: _ph, ...safeUser } = freshUser as any;
      return completeLoginSession(
        req,
        res,
        next,
        freshUser!,
        { message: "Cuenta creada correctamente", user: safeUser },
        201,
        "register",
      );
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({
          code: "ALREADY_EXISTS",
          message: "Ya existe una cuenta con este correo.",
        });
      }
      next(err);
    }
  });

  // ─── Aceptación de términos para clientes existentes ─────────────────────
  app.post("/api/auth/accept-terms", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Solo disponible para clientes" });
    }
    const TERMS_VERSION = "1.0";
    const updated = await storage.acceptTerms(user.id, TERMS_VERSION);
    if (!updated) return res.status(500).json({ message: "Error al guardar aceptación" });
    const { passwordHash: _ph, ...safeUser } = updated as any;
    return res.json({ message: "Términos aceptados", user: safeUser });
  });

  // ─── Recuperación de contraseña ────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res, next) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Correo requerido" });
    }
    const emailStatus = getTransactionalEmailStatus();
    if (!emailStatus.configured) {
      return res.status(503).json({
        message: "Recuperación de contraseña no disponible: falta configurar el correo transaccional",
        code: "EMAIL_NOT_CONFIGURED",
        missingEnv: emailStatus.missingEnv,
      });
    }
    // Always respond the same way for security (don't reveal if email exists)
    const GENERIC_OK = { message: "Si el correo está registrado, te enviamos instrucciones en breve." };
    try {
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) return res.json(GENERIC_OK);
      // Invalidate any existing tokens for this user
      await storage.invalidateUserPasswordResetTokens(user.id);
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      await sendPasswordResetEmail(user.email, token);
      return res.json(GENERIC_OK);
    } catch (err) {
      if (err instanceof EmailConfigurationError) {
        return res.status(503).json({
          message: "Recuperación de contraseña no disponible: falta configurar el correo transaccional",
          code: "EMAIL_NOT_CONFIGURED",
          missingEnv: err.missingEnv,
        });
      }
      if (err instanceof EmailDeliveryError) {
        console.error("[FORGOT_PASSWORD] Email delivery failed:", err.message);
        return res.status(503).json({
          message: "No se pudo enviar el correo de recuperación en este momento",
          code: "EMAIL_DELIVERY_FAILED",
        });
      }
      next(err);
    }
  });

  app.post("/api/auth/reset-password", async (req, res, next) => {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Datos incompletos" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Las contraseñas no coinciden" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });
    }
    try {
      const record = await storage.getPasswordResetToken(token);
      if (!record) return res.status(400).json({ code: "INVALID_TOKEN", message: "Token inválido o no existe" });
      if (record.used) return res.status(400).json({ code: "TOKEN_USED", message: "Este enlace ya fue utilizado. Solicita uno nuevo." });
      if (new Date(record.expiresAt) < new Date()) {
        return res.status(400).json({ code: "TOKEN_EXPIRED", message: "Este enlace expiró. Solicita uno nuevo." });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(record.userId, hash);
      await storage.markPasswordResetTokenUsed(record.id);
      return res.json({ message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión." });
    } catch (err) {
      next(err);
    }
  });

  // ─── Verificación de email ──────────────────────────────────────────────────
  app.get("/api/auth/verify-email", async (req, res, next) => {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ code: "NO_TOKEN", message: "Token requerido" });
    try {
      const user = await storage.getUserByEmailVerificationToken(token);
      if (!user) return res.status(400).json({ code: "INVALID_TOKEN", message: "Token inválido o ya fue usado" });
      if (user.emailVerified) return res.json({ message: "Ya estaba verificado" });
      const expires = user.emailVerificationTokenExpiresAt;
      if (expires && new Date(expires) < new Date()) {
        return res.status(400).json({ code: "TOKEN_EXPIRED", message: "El enlace expiró. Solicita uno nuevo." });
      }
      const updated = await storage.setEmailVerified(user.id);
      // Refresh session if same user
      if (req.isAuthenticated() && (req.user as any).id === user.id) {
        (req.user as any).emailVerified = true;
      }
      return res.json({ message: "Correo verificado correctamente", userId: user.id });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/resend-verification", requireAuth, async (req, res, next) => {
    const user = req.user as any;
    if (user.role !== "CUSTOMER") return res.status(403).json({ message: "Solo para clientes" });
    if (user.emailVerified) return res.json({ message: "Tu correo ya está verificado" });
    try {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
      await storage.setEmailVerificationToken(user.id, token, expiresAt);
      await sendEmailVerificationEmail(user.email, token);
      return res.json({ message: "Correo de verificación enviado" });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = req.user as any;
    const { passwordHash, ...safeUser } = user;
    let branch = null;
    if (user.branchId) {
      branch = await storage.getBranch(user.branchId);
    }

    const sess = req.session as any;
    const impersonating = !!(sess.impersonating && sess.originalUserId);

    res.json({
      ...safeUser,
      branch: branch || null,
      impersonating,
      impersonatedBranchName: impersonating ? sess.impersonatedBranchName : null,
      originalUserId: impersonating ? sess.originalUserId : null,
    });
  });

  app.delete("/api/users/me", requireAuth, async (req, res) => {
    const actor = req.user as any;
    if (actor.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Solo disponible para clientes" });
    }
    if (actor.isBlocked) {
      return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
    }

    const result = deleteCurrentUserSchema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: result.error.flatten() });
    }

    try {
      let firebaseUid = normalizeOptionalText(actor.firebaseUid) ?? null;
      const firebaseIdToken = normalizeOptionalText(result.data.firebaseIdToken) ?? null;

      if (firebaseIdToken) {
        const decoded = await verifyFirebaseIdToken(firebaseIdToken);
        const tokenUid = normalizeOptionalText(decoded.uid);
        const tokenEmail = normalizeEmailValue(decoded.email);
        const actorEmail = normalizeEmailValue(actor.email);

        if (!tokenUid) {
          return res.status(401).json({ message: "No fue posible validar la sesion de Firebase" });
        }
        if (firebaseUid && tokenUid !== firebaseUid) {
          return res.status(403).json({ message: "La credencial de Firebase no coincide con tu cuenta" });
        }
        if (!firebaseUid && actorEmail && tokenEmail && actorEmail !== tokenEmail) {
          return res.status(403).json({ message: "La credencial de Firebase no coincide con tu correo" });
        }

        firebaseUid = tokenUid;
      }

      await storage.deleteCustomerAccount(actor.id);

      if (firebaseUid) {
        try {
          const firebaseDeleteResult = await deleteFirebaseUserByUid(firebaseUid);
          console.log(`[ACCOUNT_DELETE] firebase_user=${firebaseDeleteResult} userId=${actor.id}`);
        } catch (firebaseErr: any) {
          console.error(
            `[ACCOUNT_DELETE] Firebase delete failed userId=${actor.id}:`,
            firebaseErr?.message || firebaseErr,
          );
        }
      }

      await new Promise<void>((resolve, reject) => {
        req.logout((logoutErr) => {
          if (logoutErr) return reject(logoutErr);
          resolve();
        });
      });

      await new Promise<void>((resolve, reject) => {
        req.session.destroy((sessionErr) => {
          if (sessionErr) return reject(sessionErr);
          resolve();
        });
      });

      res.clearCookie("connect.sid");
      return res.json({ success: true, message: "Account deleted" });
    } catch (err) {
      if (err instanceof FirebaseAdminConfigurationError) {
        return res.status(503).json({ message: err.message, code: "FIREBASE_AUTH_NOT_CONFIGURED" });
      }
      if (err instanceof FirebaseAdminTokenError) {
        return res.status(401).json({ message: err.message, code: "INVALID_FIREBASE_TOKEN" });
      }
      console.error("[DELETE /api/users/me]", (err as any)?.stack || err);
      return res.status(500).json({ message: "No fue posible eliminar tu cuenta en este momento." });
    }
  });

  app.post("/api/push/register-token", requireAuth, async (req, res) => {
    const actor = req.user as any;
    if (actor.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const result = registerPushTokenSchema.safeParse({
      token: req.body.token,
      platform: req.body.platform,
      deviceName: normalizeOptionalText(req.body.deviceName),
    });

    if (!result.success) {
      return res.status(400).json({
        message: "Datos inválidos",
      });
    }

    try {
      const pushToken = await storage.upsertPushToken({
        userId: actor.id,
        token: result.data.token,
        platform: result.data.platform,
        deviceName: result.data.deviceName ?? null,
      });

      res.json({
        success: true,
        tokenId: pushToken.id,
        isActive: pushToken.isActive,
        platform: pushToken.platform,
      });
    } catch (err: any) {
      console.error("[PUSH_REGISTER_TOKEN]", err.stack || err);
      res.status(500).json({ message: "Error al registrar push token" });
    }
  });

  app.post("/api/push/unregister-token", requireAuth, async (req, res) => {
    const actor = req.user as any;
    if (actor.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const result = unregisterPushTokenSchema.safeParse({
      token: req.body.token,
    });
    const privateResult = result;
    const globalResult = result;

    if (!result.success) {
      return res.status(400).json({
        message: "Datos inválidos",
        errors: {
          private: privateResult.success ? null : privateResult.error.flatten(),
          global: globalResult.success ? null : globalResult.error.flatten(),
        },
      });
    }

    try {
      const deactivated = await storage.deactivatePushToken(actor.id, result.data.token);
      res.json({ success: true, deactivated });
    } catch (err: any) {
      console.error("[PUSH_UNREGISTER_TOKEN]", err.stack || err);
      res.status(500).json({ message: "Error al desactivar push token" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    const actor = req.user as any;
    const rawLimit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
    const rawPage = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;
    const status = req.query.status === "read" || req.query.status === "unread" ? req.query.status : "all";

    try {
      const notifications = await storage.getNotificationsForActor({
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId ?? null,
      }, { limit, page, status });
      const hydratedNotifications = await Promise.all(
        notifications.map((notification) => enrichNotificationForDisplay(notification)),
      );
      res.json(hydratedNotifications);
    } catch (err: any) {
      console.error("[NOTIFICATIONS_LIST]", err.stack || err);
      res.status(500).json({ message: "Error al obtener notificaciones" });
    }
  });

  app.get("/api/notifications/summary", requireAuth, async (req, res) => {
    const actor = req.user as any;

    try {
      if (
        actor?.id &&
        actor?.branchId &&
        (actor.role === "BRANCH_ADMIN" || actor.role === "SUPER_ADMIN")
      ) {
        await syncBirthdayTodayNotifications({
          branchId: actor.branchId,
          actorUserId: actor.id,
        });
      }

      const summary = await getNotificationSummary({
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId ?? null,
      });
      res.json(summary);
    } catch (err: any) {
      console.error("[NOTIFICATIONS_SUMMARY]", err.stack || err);
      res.status(500).json({ message: "Error al obtener resumen de notificaciones" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const actor = req.user as any;
    const notificationId = getStringParam(req.params.id);

    try {
      const notification = await markNotificationRead(notificationId, {
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId ?? null,
      });

      if (!notification) {
        return res.status(404).json({ message: "Notificación no encontrada" });
      }

      res.json(notification);
    } catch (err: any) {
      console.error("[NOTIFICATIONS_READ]", err.stack || err);
      res.status(500).json({ message: "Error al marcar notificación" });
    }
  });

  app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
    const actor = req.user as any;

    try {
      const affected = await storage.markAllNotificationsRead({
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId ?? null,
      });

      res.json({ success: true, affected });
    } catch (err: any) {
      console.error("[NOTIFICATIONS_READ_ALL]", err.stack || err);
      res.status(500).json({ message: "Error al marcar notificaciones" });
    }
  });

  app.delete("/api/notifications/read", requireAuth, async (req, res) => {
    const actor = req.user as any;

    try {
      const deleted = await deleteReadNotifications({
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId ?? null,
      });
      res.json({ success: true, deleted });
    } catch (err: any) {
      console.error("[NOTIFICATIONS_DELETE_READ]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar notificaciones leídas" });
    }
  });

  app.delete("/api/notifications/all", requireAuth, async (req, res) => {
    const actor = req.user as any;

    try {
      const deleted = await deleteAllNotifications({
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId ?? null,
      });
      res.json({ success: true, deleted });
    } catch (err: any) {
      console.error("[NOTIFICATIONS_DELETE_ALL]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar notificaciones" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    const actor = req.user as any;
    const notificationId = getStringParam(req.params.id);

    try {
      const deleted = await deleteNotification(notificationId, {
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId ?? null,
      });

      if (!deleted) {
        return res.status(404).json({ message: "Notificación no encontrada" });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[NOTIFICATIONS_DELETE_ONE]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar notificación" });
    }
  });

  app.patch("/api/user/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;
    if (actor.role === "CUSTOMER" && actor.isBlocked) {
      return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
    }
    try {
      const { name, lastName, phone, birthDate, gender } = req.body;
      if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
        return res.status(400).json({ message: "Nombre inválido" });
      }
      if (birthDate !== undefined && birthDate !== null && typeof birthDate !== "string") {
        return res.status(400).json({ message: "Fecha de nacimiento inválida" });
      }
      if (gender !== undefined && gender !== null && !["M", "F", "NE"].includes(String(gender))) {
        return res.status(400).json({ message: "Género inválido" });
      }
      const updated = await storage.updateUser(actor.id, {
        name: name?.trim(),
        lastName: lastName?.trim() ?? undefined,
        phone: phone?.trim() ?? undefined,
        birthDate: normalizeOptionalText(birthDate),
        gender: normalizeOptionalText(gender),
      });
      const { passwordHash, ...safeUser } = updated as any;
      res.json(safeUser);
    } catch (err: any) {
      console.error("[PATCH /api/user/me]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar perfil" });
    }
  });

  app.post("/api/user/me/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;
    if (actor.role === "CUSTOMER" && actor.isBlocked) {
      return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Se requiere contraseña actual y nueva" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });
    }
    try {
      const user = await storage.getUser(actor.id);
      if (!user?.passwordHash) return res.status(400).json({ message: "Error de autenticación" });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Contraseña actual incorrecta" });
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(actor.id, hash);
      res.json({ message: "Contraseña actualizada" });
    } catch (err: any) {
      console.error("[CHANGE-PASSWORD]", err.stack || err);
      res.status(500).json({ message: "Error al cambiar contraseña" });
    }
  });

  app.patch("/api/user/me/email", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;
    if (actor.role === "CUSTOMER" && actor.isBlocked) {
      return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
    }
    const { currentPassword, newEmail } = req.body;
    if (!currentPassword || !newEmail) {
      return res.status(400).json({ message: "Se requiere contraseña y nuevo correo" });
    }
    if (typeof newEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ message: "Correo inválido" });
    }
    try {
      const user = await storage.getUser(actor.id);
      if (!user?.passwordHash) return res.status(400).json({ message: "Error de autenticación" });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Contraseña incorrecta" });
      const existing = await storage.getUserByEmail(newEmail.toLowerCase().trim());
      if (existing && existing.id !== actor.id) {
        return res.status(400).json({ message: "Ese correo ya está en uso" });
      }
      const updated = await storage.updateUser(actor.id, { email: newEmail.toLowerCase().trim() });
      const { passwordHash, ...safeUser } = updated as any;
      res.json(safeUser);
    } catch (err: any) {
      console.error("[CHANGE-EMAIL]", err.stack || err);
      res.status(500).json({ message: "Error al cambiar correo" });
    }
  });

  app.post("/api/user/me/avatar", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const actor = req.user as any;
    if (actor.role === "CUSTOMER" && actor.isBlocked) {
      return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
    }

    upload.single("file")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "El archivo excede el tamaño máximo de 10MB" });
        }
        return res.status(400).json({ message: err.message || "Error al subir archivo" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }

      try {
        const existingUser = await storage.getUser(actor.id);
        if (existingUser?.avatarUrl) {
          deleteLocalUploadFiles([existingUser.avatarUrl]);
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        await storage.updateClient(actor.id, { avatarUrl });

        console.log(`[AVATAR] Self-upload for user ${actor.id} (${actor.email})`);
        res.json({ avatarUrl });
      } catch (err: any) {
        console.error(`[AVATAR] Self-upload error:`, err.stack || err);
        res.status(500).json({ message: "Error al subir foto de perfil" });
      }
    });
  });

  // --- Super Admin: Branches ---
  app.get("/api/branches", requireRole("SUPER_ADMIN"), async (req, res) => {
    const includeDeleted = req.query.include_deleted === "true";
    const allBranches = await storage.getAllBranches(includeDeleted);
    res.json(allBranches);
  });

  app.post("/api/branches", requireRole("SUPER_ADMIN"), async (req, res) => {
    const result = createBranchWithAdminSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    const existing = await storage.getBranchBySlug(result.data.slug);
    if (existing) {
      return res.status(409).json({ message: "Ese slug ya existe" });
    }

    const branch = await storage.createBranch({
      name: result.data.name,
      slug: result.data.slug,
      status: "active",
      category: result.data.category || "box",
      subcategory: normalizeOptionalText(result.data.subcategory),
      searchKeywords: normalizeSearchKeywords(result.data.searchKeywords),
    });

    const actor = req.user as any;

    let adminUser = null;
    let plainPassword = null;

    if (result.data.createAdmin && result.data.adminEmail) {
      const existingUser = await storage.getUserByEmail(result.data.adminEmail);
      if (existingUser) {
        await storage.updateBranchStatus(branch.id, "blacklisted");
        await storage.softDeleteBranch(branch.id);
        return res.status(409).json({ message: "Ese correo ya está registrado" });
      }

      plainPassword = result.data.adminPassword || generateSecurePassword();
      const hash = await bcrypt.hash(plainPassword, 10);

      try {
        adminUser = await storage.createUser({
          email: result.data.adminEmail,
          passwordHash: hash,
          role: "BRANCH_ADMIN",
          branchId: branch.id,
          name: result.data.adminName || `Admin ${result.data.name}`,
        });
      } catch (err) {
        await storage.softDeleteBranch(branch.id);
        return res.status(500).json({ message: "Error al crear el administrador" });
      }
    }

    await storage.createAuditLog({
      actorUserId: actor.id,
      action: "CREATE_BRANCH",
      branchId: branch.id,
      metadata: { branchName: branch.name, slug: branch.slug, adminCreated: !!adminUser },
    });

    res.status(201).json({
      branch,
      admin: adminUser
        ? {
            email: adminUser.email,
            password: plainPassword,
            name: adminUser.name,
          }
        : null,
    });
  });

  app.patch("/api/superadmin/branches/:id", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const branchId = getStringParam(req.params.id);
    const result = updateSuperAdminBranchSchema.safeParse({
      name: normalizeOptionalText(req.body.name) ?? undefined,
      slug: normalizeOptionalText(req.body.slug) ?? undefined,
      status: normalizeOptionalText(req.body.status) ?? undefined,
      category: normalizeOptionalText(req.body.category) ?? undefined,
      subcategory: normalizeOptionalText(req.body.subcategory),
      searchKeywords: req.body.searchKeywords,
    });
    const privateResult = result;
    const globalResult = result;

    if (!result.success) {
      return res.status(400).json({
        message: "Datos inválidos",
        errors: {
          private: privateResult.success ? null : privateResult.error.flatten(),
          global: globalResult.success ? null : globalResult.error.flatten(),
        },
      });
    }

    try {
      const existing = await storage.getBranch(branchId);
      if (!existing) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      if (result.data.slug && result.data.slug !== existing.slug) {
        const slugOwner = await storage.getBranchBySlug(result.data.slug);
        if (slugOwner && slugOwner.id !== branchId) {
          return res.status(409).json({ message: "Ese slug ya existe" });
        }
      }

      const updated = await storage.updateBranch(branchId, {
        ...(result.data.name !== undefined && { name: result.data.name }),
        ...(result.data.slug !== undefined && { slug: result.data.slug }),
        ...(result.data.status !== undefined && { status: result.data.status }),
        ...(result.data.category !== undefined && { category: result.data.category }),
        ...(result.data.subcategory !== undefined && { subcategory: result.data.subcategory }),
        ...(result.data.searchKeywords !== undefined && { searchKeywords: normalizeSearchKeywords(result.data.searchKeywords) }),
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_BRANCH",
        branchId,
        metadata: {
          old: {
            name: existing.name,
            slug: existing.slug,
            status: existing.status,
            category: existing.category,
            subcategory: existing.subcategory,
            searchKeywords: existing.searchKeywords,
          },
          next: {
            name: updated?.name,
            slug: updated?.slug,
            status: updated?.status,
            category: updated?.category,
            subcategory: updated?.subcategory,
            searchKeywords: updated?.searchKeywords,
          },
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[SUPERADMIN_UPDATE_BRANCH]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar sucursal" });
    }
  });

  app.patch("/api/branches/:id/status", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const { status } = req.body;
    const actor = req.user as any;
    console.log(`[UPDATE_STATUS] branchId=${id}, newStatus=${status}, actor=${actor.email}`);

    if (!["active", "suspended", "blacklisted"].includes(status)) {
      console.log(`[UPDATE_STATUS] Invalid status: ${status}`);
      return res.status(400).json({ message: `Estado inválido: ${status}. Válidos: active, suspended, blacklisted` });
    }

    try {
      const oldBranch = await storage.getBranch(id);
      if (!oldBranch) {
        console.log(`[UPDATE_STATUS] Branch not found: ${id}`);
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const branch = await storage.updateBranchStatus(id, status as string);
      console.log(`[UPDATE_STATUS] Success: ${oldBranch.status} -> ${status}`);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_STATUS",
        branchId: id,
        metadata: { oldStatus: oldBranch.status, newStatus: status },
      });

      res.json(branch);
    } catch (err: any) {
      console.error(`[UPDATE_STATUS] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al actualizar estado: ${err.message || "error desconocido"}` });
    }
  });

  // Soft delete
  app.delete("/api/superadmin/branches/:id", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const branch = await storage.getBranch(id);
    if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
    const deleted = await storage.softDeleteBranch(id);

    const actor = req.user as any;
    await storage.createAuditLog({
      actorUserId: actor.id,
      action: "DELETE_BRANCH",
      branchId: id,
      metadata: { branchName: branch.name },
    });

    res.json(deleted);
  });

  app.delete("/api/superadmin/branches/:id/hard", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const branchId = getStringParam(req.params.id);
    const parsed = destructiveDeleteConfirmationSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    if (parsed.data.confirmationText.trim() !== "ELIMINAR SUCURSAL") {
      return res.status(400).json({ message: "Escribe ELIMINAR SUCURSAL para confirmar" });
    }

    try {
      const result = await storage.hardDeleteBranch(branchId);
      if (!result.deleted) {
        return res.status(404).json({ message: result.reason || "Sucursal no encontrada" });
      }

      const deletedUploadCount = deleteLocalUploadFiles(result.uploadUrls);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_BRANCH_HARD",
        branchId,
        metadata: {
          branchName: result.branchName,
          deletedAdminCount: result.deletedAdminCount,
          deletedUploadCount,
        },
      });

      res.json({
        success: true,
        branchId,
        branchName: result.branchName,
        deletedAdminCount: result.deletedAdminCount,
        deletedUploadCount,
      });
    } catch (err: any) {
      console.error("[SUPERADMIN_HARD_DELETE_BRANCH]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar definitivamente la sucursal" });
    }
  });

  // Get branch admin
  app.get("/api/superadmin/branches/:id/admin", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const admins = await storage.getBranchAdmins(id);
    if (admins.length === 0) {
      return res.json(null);
    }
    const a = admins[0];
    res.json({ id: a.id, email: a.email, name: a.name, createdAt: a.createdAt });
  });

  // Update branch admin (name/email or reassign)
  app.patch("/api/superadmin/branches/:id/admin", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const branch = await storage.getBranch(id);
    if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

    const { name, email, reassignEmail } = req.body;
    const actor = req.user as any;

    if (reassignEmail) {
      const existingUser = await storage.getUserByEmail(reassignEmail);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuario no encontrado con ese email" });
      }
      if (existingUser.role !== "BRANCH_ADMIN" && existingUser.role !== "CUSTOMER") {
        return res.status(400).json({ message: "No se puede reasignar un Super Admin" });
      }

      const currentAdmins = await storage.getBranchAdmins(id);
      for (const old of currentAdmins) {
        await storage.updateUser(old.id, {});
        await storage.updateUserBranch(old.id, "");
      }

      await storage.updateUserBranch(existingUser.id, id);
      const updated = await storage.updateUser(existingUser.id, {});
      if (updated && updated.role !== "BRANCH_ADMIN") {
        await storage.updateUser(existingUser.id, {});
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REASSIGN_ADMIN",
        branchId: id,
        metadata: { newAdminEmail: reassignEmail },
      });

      return res.json({ id: existingUser.id, email: existingUser.email, name: existingUser.name });
    }

    const admins = await storage.getBranchAdmins(id);
    if (admins.length === 0) {
      return res.status(404).json({ message: "No hay admin para esta sucursal" });
    }

    const admin = admins[0];
    const updateData: { name?: string; email?: string } = {};
    const metadataLog: any = {};

    if (name && name !== admin.name) {
      updateData.name = name;
      metadataLog.oldName = admin.name;
      metadataLog.newName = name;
    }

    if (email && email !== admin.email) {
      const existingWithEmail = await storage.getUserByEmail(email);
      if (existingWithEmail && existingWithEmail.id !== admin.id) {
        return res.status(409).json({ message: "Ese correo ya está en uso" });
      }
      updateData.email = email;
      metadataLog.oldEmail = admin.email;
      metadataLog.newEmail = email;
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ id: admin.id, email: admin.email, name: admin.name });
    }

    const updated = await storage.updateUser(admin.id, updateData);

    await storage.createAuditLog({
      actorUserId: actor.id,
      action: "UPDATE_ADMIN",
      branchId: id,
      metadata: metadataLog,
    });

    res.json({ id: updated!.id, email: updated!.email, name: updated!.name });
  });

  app.post("/api/superadmin/branches/:id/admin", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const actor = req.user as any;
    const { email, name, password, reassign } = req.body;
    console.log(`[CREATE_ADMIN] branchId=${id}, email=${email}, reassign=${!!reassign}, actor=${actor.email}`);

    try {
      const branch = await storage.getBranch(id);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(id);
      if (admins.length > 0) {
        return res.status(409).json({ message: "Ya existe un admin para esta sucursal. Usa reasignar si quieres cambiar." });
      }

      if (!email) return res.status(400).json({ message: "Email es requerido" });

      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        if (reassign) {
          if (existingUser.role === "SUPER_ADMIN") {
            return res.status(400).json({ message: "No se puede reasignar un Super Admin como admin de sucursal" });
          }
          if (existingUser.branchId && existingUser.role === "BRANCH_ADMIN") {
            const otherBranch = await storage.getBranch(existingUser.branchId);
            if (otherBranch && !otherBranch.deletedAt) {
              return res.status(409).json({ message: `Ese usuario ya es admin de "${otherBranch.name}". Primero desasígnalo de ahí.` });
            }
          }
          await storage.updateUserBranch(existingUser.id, id);
          await storage.updateUser(existingUser.id, { name: name || existingUser.name });
          if (existingUser.role !== "BRANCH_ADMIN") {
            await storage.updateUserRole(existingUser.id, "BRANCH_ADMIN");
          }

          await storage.createAuditLog({
            actorUserId: actor.id,
            action: "REASSIGN_ADMIN",
            branchId: id,
            metadata: { adminEmail: email, reassigned: true },
          });

          console.log(`[CREATE_ADMIN] Reassigned existing user ${email} as admin`);
          return res.status(200).json({
            admin: { id: existingUser.id, email: existingUser.email, name: name || existingUser.name },
            password: null,
            reassigned: true,
          });
        }

        return res.status(409).json({
          message: "Ese correo ya está registrado. ¿Deseas reasignar ese usuario como admin?",
          canReassign: existingUser.role !== "SUPER_ADMIN",
          existingUserRole: existingUser.role,
        });
      }

      const plainPassword = password || generateSecurePassword();
      const hash = await bcrypt.hash(plainPassword, 10);
      const adminUser = await storage.createUser({
        email,
        passwordHash: hash,
        role: "BRANCH_ADMIN",
        branchId: id,
        name: name || `Admin ${branch.name}`,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_ADMIN",
        branchId: id,
        metadata: { adminEmail: email },
      });

      console.log(`[CREATE_ADMIN] Created new admin ${email} for branch ${branch.name}`);
      res.status(201).json({
        admin: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
        password: plainPassword,
      });
    } catch (err: any) {
      console.error(`[CREATE_ADMIN] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al crear admin: ${err.message || "error desconocido"}` });
    }
  });

  app.post("/api/superadmin/branches/:id/reset-admin-password", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    const actor = req.user as any;
    console.log(`[RESET_PASSWORD] branchId=${id}, actor=${actor.email}`);

    try {
      const branch = await storage.getBranch(id);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(id);
      if (admins.length === 0) {
        console.log(`[RESET_PASSWORD] No admin for branch ${id}`);
        return res.status(404).json({ message: "No hay administrador para esta sucursal. Primero crea o asigna un admin." });
      }

      const admin = admins[0];
      const newPassword = generateSecurePassword();
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(admin.id, hash);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "RESET_ADMIN_PASSWORD",
        branchId: id,
        metadata: { adminEmail: admin.email },
      });

      console.log(`[RESET_PASSWORD] Success for ${admin.email}`);
      res.json({
        email: admin.email,
        password: newPassword,
        name: admin.name,
      });
    } catch (err: any) {
      console.error(`[RESET_PASSWORD] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al resetear contraseña: ${err.message || "error desconocido"}` });
    }
  });

  app.get("/api/superadmin/branches/:id/welcome-package", requireRole("SUPER_ADMIN"), async (req, res) => {
    const id = req.params.id as string;
    try {
      const branch = await storage.getBranch(id);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(id);
      const admin = admins.length > 0 ? admins[0] : null;

      res.json({
        branchName: branch.name,
        branchSlug: branch.slug,
        adminEmail: admin?.email || null,
        adminName: admin?.name || null,
        hasAdmin: !!admin,
      });
    } catch (err: any) {
      console.error(`[WELCOME_PACKAGE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener datos del paquete" });
    }
  });

  app.get("/api/superadmin/branches/metrics", requireRole("SUPER_ADMIN"), async (_req, res) => {
    try {
      const metrics = await storage.getBranchMetrics();
      res.json(metrics);
    } catch (err: any) {
      console.error(`[METRICS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener métricas" });
    }
  });

  app.get("/api/superadmin/branches/:id/stats", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const stats = await storage.getBranchStats(req.params.id as string);
      res.json(stats);
    } catch (err: any) {
      console.error(`[BRANCH_STATS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  app.get("/api/superadmin/monthly-billing", requireRole("SUPER_ADMIN"), async (_req, res) => {
    try {
      const rows = await storage.getSuperAdminMonthlyBilling();
      res.json(rows);
    } catch (err: any) {
      console.error("[SUPERADMIN_MONTHLY_BILLING_LIST]", err.stack || err);
      res.status(500).json({ message: "Error al obtener las igualas mensuales" });
    }
  });

  app.put("/api/superadmin/monthly-billing/:branchId", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const branchId = getStringParam(req.params.branchId);
    const result = upsertBranchMonthlyBillingSchema.safeParse({
      monthlyFeeAmount: req.body.monthlyFeeAmount,
      paymentDay: req.body.paymentDay,
      lastPaymentDate: req.body.lastPaymentDate === undefined ? undefined : normalizeOptionalText(req.body.lastPaymentDate) ?? null,
      nextPaymentDate: req.body.nextPaymentDate === undefined ? undefined : normalizeOptionalText(req.body.nextPaymentDate) ?? null,
      paymentStatus: req.body.paymentStatus === undefined ? undefined : normalizeOptionalText(req.body.paymentStatus) ?? undefined,
      sellerName: req.body.sellerName === undefined ? undefined : normalizeOptionalText(req.body.sellerName) ?? null,
      sellerCommissionAmount: req.body.sellerCommissionAmount,
      notes: req.body.notes === undefined ? undefined : normalizeOptionalText(req.body.notes) ?? null,
    });
    const privateResult = result;
    const globalResult = result;

    if (!result.success) {
      return res.status(400).json({
        message: "Datos inválidos",
        errors: {
          private: privateResult.success ? null : privateResult.error.flatten(),
          global: globalResult.success ? null : globalResult.error.flatten(),
        },
      });
    }

    try {
      const branch = await storage.getBranch(branchId);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const updated = await storage.upsertBranchMonthlyBilling(branchId, result.data);
      if (!updated) {
        return res.status(404).json({ message: "No se pudo guardar la iguala" });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.monthly_billing.updated",
        branchId,
        metadata: {
          monthlyFeeAmount: updated.monthlyFeeAmount,
          paymentDay: updated.paymentDay,
          lastPaymentDate: updated.lastPaymentDate,
          nextPaymentDate: updated.nextPaymentDate,
          paymentStatus: updated.paymentStatus,
          sellerName: updated.sellerName,
          sellerCommissionAmount: updated.sellerCommissionAmount,
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[SUPERADMIN_MONTHLY_BILLING_UPDATE]", err.stack || err);
      res.status(500).json({ message: "Error al guardar la iguala mensual" });
    }
  });

  app.post("/api/superadmin/monthly-billing/:branchId/mark-paid", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const branchId = getStringParam(req.params.branchId);

    try {
      const branch = await storage.getBranch(branchId);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const updated = await storage.markBranchMonthlyBillingPaid(branchId);
      if (!updated) {
        return res.status(400).json({ message: "Primero configura la iguala mensual de esta sucursal" });
      }

      await storage.createNotification({
        branchId,
        roleTarget: "SUPER_ADMIN",
        type: "monthly_billing_paid",
        title: "Iguala marcada como pagada",
        message: `${branch.name} fue marcada como pagada.`,
        data: {
          branchId,
          branchName: branch.name,
          lastPaymentDate: updated.lastPaymentDate,
          nextPaymentDate: updated.nextPaymentDate,
          monthlyFeeAmount: updated.monthlyFeeAmount,
        },
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.monthly_billing.mark_paid",
        branchId,
        metadata: {
          lastPaymentDate: updated.lastPaymentDate,
          nextPaymentDate: updated.nextPaymentDate,
          monthlyFeeAmount: updated.monthlyFeeAmount,
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[SUPERADMIN_MONTHLY_BILLING_MARK_PAID]", err.stack || err);
      res.status(500).json({ message: "Error al marcar la iguala como pagada" });
    }
  });

  app.get("/api/superadmin/catalog/categories", requireRole("SUPER_ADMIN"), async (_req, res) => {
    try {
      const items = await storage.listCategories();
      res.json(items);
    } catch (err: any) {
      console.error("[SUPERADMIN_CATALOG_CATEGORIES]", err.stack || err);
      res.status(500).json({ message: "Error al obtener categorías" });
    }
  });

  app.post("/api/superadmin/catalog/categories", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const result = createCatalogCategorySchema.safeParse({
      key: normalizeOptionalText(req.body.key),
      label: normalizeOptionalText(req.body.label),
      icon: normalizeOptionalText(req.body.icon) ?? null,
      isActive: req.body.isActive,
      displayOrder: req.body.displayOrder,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const created = await storage.createCategory({
        key: result.data.key,
        label: result.data.label,
        icon: result.data.icon ?? null,
        isActive: result.data.isActive ?? true,
        displayOrder: result.data.displayOrder ?? 0,
      });
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.catalog.category.created",
        metadata: { categoryKey: created.key },
      });
      res.status(201).json(created);
    } catch (err: any) {
      console.error("[SUPERADMIN_CREATE_CATEGORY]", err.stack || err);
      res.status(500).json({ message: "Error al crear categoría" });
    }
  });

  app.patch("/api/superadmin/catalog/categories/:key", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const categoryKey = getStringParam(req.params.key);
    const result = updateCatalogCategorySchema.safeParse({
      label: normalizeOptionalText(req.body.label),
      icon: normalizeOptionalText(req.body.icon) ?? null,
      isActive: req.body.isActive,
      displayOrder: req.body.displayOrder,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const updated = await storage.updateCategory(categoryKey, result.data);
      if (!updated) {
        return res.status(404).json({ message: "Categoría no encontrada" });
      }
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.catalog.category.updated",
        metadata: { categoryKey },
      });
      res.json(updated);
    } catch (err: any) {
      console.error("[SUPERADMIN_UPDATE_CATEGORY]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar categoría" });
    }
  });

  app.get("/api/superadmin/catalog/subcategories", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const categoryKey = typeof req.query.categoryKey === "string" ? req.query.categoryKey : undefined;
      const items = await storage.listSubcategories(categoryKey);
      res.json(items);
    } catch (err: any) {
      console.error("[SUPERADMIN_CATALOG_SUBCATEGORIES]", err.stack || err);
      res.status(500).json({ message: "Error al obtener subcategorías" });
    }
  });

  app.post("/api/superadmin/catalog/subcategories", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const result = createCatalogSubcategorySchema.safeParse({
      categoryKey: normalizeOptionalText(req.body.categoryKey),
      label: normalizeOptionalText(req.body.label),
      isActive: req.body.isActive,
      displayOrder: req.body.displayOrder,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const created = await storage.createSubcategory({
        categoryKey: result.data.categoryKey,
        label: result.data.label,
        isActive: result.data.isActive ?? true,
        displayOrder: result.data.displayOrder ?? 0,
      });
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.catalog.subcategory.created",
        metadata: { subcategoryId: created.id, categoryKey: created.categoryKey },
      });
      res.status(201).json(created);
    } catch (err: any) {
      console.error("[SUPERADMIN_CREATE_SUBCATEGORY]", err.stack || err);
      res.status(500).json({ message: "Error al crear subcategoría" });
    }
  });

  app.patch("/api/superadmin/catalog/subcategories/:id", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const subcategoryId = getStringParam(req.params.id);
    const result = updateCatalogSubcategorySchema.safeParse({
      categoryKey: normalizeOptionalText(req.body.categoryKey),
      label: normalizeOptionalText(req.body.label),
      isActive: req.body.isActive,
      displayOrder: req.body.displayOrder,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const updated = await storage.updateSubcategory(subcategoryId, result.data);
      if (!updated) {
        return res.status(404).json({ message: "Subcategoría no encontrada" });
      }
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.catalog.subcategory.updated",
        metadata: { subcategoryId },
      });
      res.json(updated);
    } catch (err: any) {
      console.error("[SUPERADMIN_UPDATE_SUBCATEGORY]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar subcategoría" });
    }
  });

  app.get("/api/superadmin/catalog/keywords", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const items = await storage.listCategoryKeywords({
        categoryKey: typeof req.query.categoryKey === "string" ? req.query.categoryKey : undefined,
        subcategoryId: typeof req.query.subcategoryId === "string" ? req.query.subcategoryId : undefined,
      });
      res.json(items);
    } catch (err: any) {
      console.error("[SUPERADMIN_CATALOG_KEYWORDS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener keywords" });
    }
  });

  app.post("/api/superadmin/catalog/keywords", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const result = createCategoryKeywordLinkSchema.safeParse({
      categoryKey: normalizeOptionalText(req.body.categoryKey) ?? null,
      subcategoryId: normalizeOptionalText(req.body.subcategoryId) ?? null,
      keyword: normalizeOptionalText(req.body.keyword),
      kind: normalizeOptionalText(req.body.kind) || "alias",
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const created = await storage.createCategoryKeyword({
        categoryKey: result.data.categoryKey ?? null,
        subcategoryId: result.data.subcategoryId ?? null,
        keyword: result.data.keyword,
        kind: result.data.kind ?? "alias",
      });
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.catalog.keyword.created",
        metadata: { keywordId: created.id, categoryKey: created.categoryKey, subcategoryId: created.subcategoryId },
      });
      res.status(201).json(created);
    } catch (err: any) {
      console.error("[SUPERADMIN_CREATE_KEYWORD]", err.stack || err);
      res.status(500).json({ message: "Error al crear keyword" });
    }
  });

  app.delete("/api/superadmin/catalog/keywords/:id", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const keywordId = getStringParam(req.params.id);
    try {
      const deleted = await storage.deleteCategoryKeyword(keywordId);
      if (!deleted) {
        return res.status(404).json({ message: "Keyword no encontrada" });
      }
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.catalog.keyword.deleted",
        metadata: { keywordId },
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[SUPERADMIN_DELETE_KEYWORD]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar keyword" });
    }
  });

  app.get("/api/superadmin/settings", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
      const settings = await storage.listAppSettings(scope);
      res.json(settings);
    } catch (err: any) {
      console.error("[SUPERADMIN_SETTINGS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener settings" });
    }
  });

  app.patch("/api/superadmin/settings/:key", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const settingKey = getStringParam(req.params.key);
    const result = updateAppSettingSchema.safeParse({
      valueJson: req.body.valueJson,
      scope: normalizeOptionalText(req.body.scope) || undefined,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const setting = await storage.upsertAppSetting(settingKey, {
        valueJson: result.data.valueJson,
        scope: result.data.scope ?? "global",
        updatedBy: actor.id,
      });
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "superadmin.setting.updated",
        metadata: { key: settingKey },
      });
      res.json(setting);
    } catch (err: any) {
      console.error("[SUPERADMIN_UPDATE_SETTING]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar setting" });
    }
  });

  app.get("/api/superadmin/search-logs", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const logs = await storage.getSearchLogs(limit);
      res.json(logs);
    } catch (err: any) {
      console.error("[SUPERADMIN_SEARCH_LOGS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener logs de búsqueda" });
    }
  });

  app.get("/api/superadmin/search-metrics", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const metrics = await storage.getSearchMetrics(limit);
      res.json(metrics);
    } catch (err: any) {
      console.error("[SUPERADMIN_SEARCH_METRICS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener métricas de búsqueda" });
    }
  });

  app.get("/api/superadmin/platform-metrics", requireRole("SUPER_ADMIN"), async (_req, res) => {
    try {
      const metrics = await storage.getPlatformMetrics();
      res.json(metrics);
    } catch (err: any) {
      console.error("[SUPERADMIN_PLATFORM_METRICS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener métricas generales" });
    }
  });

  app.get("/api/superadmin/blocked-users", requireRole("SUPER_ADMIN"), async (_req, res) => {
    try {
      const blockedUsers = await storage.getBlockedCustomerUsers();
      res.json(blockedUsers);
    } catch (err: any) {
      console.error("[SUPERADMIN_BLOCKED_USERS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener usuarios bloqueados" });
    }
  });

  app.get("/api/superadmin/review-reports", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status.trim() || undefined : undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const reports = await storage.getReviewReports({ status, limit });
      res.json(reports);
    } catch (err: any) {
      console.error("[SUPERADMIN_REVIEW_REPORTS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener reportes de reseñas" });
    }
  });

  app.get("/api/superadmin/review-moderation-logs", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const logs = await storage.getReviewModerationLogs(limit);
      res.json(logs);
    } catch (err: any) {
      console.error("[SUPERADMIN_REVIEW_MODERATION_LOGS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener historial de moderación" });
    }
  });

  app.patch("/api/superadmin/review-reports/:id/status", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    try {
      const reportId = getStringParam(req.params.id);
      const payload = updateReviewReportStatusSchema.parse(req.body);
      const updated = await storage.updateReviewReportStatus(
        reportId,
        payload.status,
        actor.id,
        normalizeModerationText(payload.resolutionNote),
      );

      if (!updated) {
        return res.status(404).json({ message: "Reporte no encontrado" });
      }

      await storage.createReviewModerationLog({
        reviewId: updated.reviewId,
        action: `report_${payload.status}`,
        actorUserId: actor.id,
        reason: normalizeModerationText(payload.resolutionNote),
        metadata: { reportId },
      });

      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error("[SUPERADMIN_REVIEW_REPORT_STATUS]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar el reporte" });
    }
  });

  app.patch("/api/superadmin/reviews/:id/visibility", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    try {
      const reviewId = getStringParam(req.params.id);
      const payload = updateReviewVisibilitySchema.parse(req.body);
      const review = await storage.getBranchReviewById(reviewId);
      if (!review) {
        return res.status(404).json({ message: "Reseña no encontrada" });
      }

      const updated = await storage.updateReviewVisibility(reviewId, payload.hidden, normalizeModerationText(payload.reason));
      await storage.createReviewModerationLog({
        reviewId,
        action: payload.hidden ? "hidden" : "shown",
        actorUserId: actor.id,
        reason: normalizeModerationText(payload.reason),
        metadata: { previousHidden: review.isHidden },
      });

      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error("[SUPERADMIN_REVIEW_VISIBILITY]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar la visibilidad" });
    }
  });

  app.get("/api/superadmin/notification-jobs", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status.trim() || undefined : undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const jobs = await storage.getNotificationJobs({ status, limit });
      res.json(jobs);
    } catch (err: any) {
      console.error("[SUPERADMIN_NOTIFICATION_JOBS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener jobs" });
    }
  });

  app.get("/api/superadmin/reservation-audit", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const logs = await storage.getReservationAuditLogs({ limit });
      res.json(logs);
    } catch (err: any) {
      console.error("[SUPERADMIN_RESERVATION_AUDIT]", err.stack || err);
      res.status(500).json({ message: "Error al obtener la auditoría" });
    }
  });

  app.get("/api/branch/stats", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.branchId) return res.status(400).json({ message: "No hay sucursal asignada" });
    try {
      const stats = await storage.getBranchStats(user.branchId);
      res.json(stats);
    } catch (err: any) {
      console.error(`[BRANCH_STATS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  app.get("/api/branch/alerts", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (user.role !== "BRANCH_ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    if (!user.branchId) return res.status(400).json({ message: "No hay sucursal asignada" });
    try {
      const daysAhead = parseInt(req.query.daysAhead as string) || 3;
      const daysSince = parseInt(req.query.daysSince as string) || 30;
      const [expiringMemberships, expiredMemberships, inactiveClients, clientsWithoutClasses, upcomingBirthdays] = await Promise.all([
        storage.getExpiringMemberships(user.branchId, daysAhead),
        storage.getExpiredMemberships(user.branchId),
        storage.getInactiveClients(user.branchId, daysSince),
        storage.getClientsWithoutClasses(user.branchId),
        storage.getUpcomingBirthdays(user.branchId, 7),
      ]);
      res.json({ expiringMemberships, expiredMemberships, inactiveClients, clientsWithoutClasses, upcomingBirthdays });
    } catch (err: any) {
      console.error(`[BRANCH_ALERTS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener alertas" });
    }
  });

  app.get("/api/branch/dashboard-metrics", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const metrics = await storage.getBranchDashboardMetrics(actor.branchId);
      res.json(metrics);
    } catch (err: any) {
      console.error("[BRANCH_DASHBOARD_METRICS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener métricas del dashboard" });
    }
  });

  // Branch admins (list)
  app.get("/api/superadmin/branches/:id/admins", requireRole("SUPER_ADMIN"), async (req, res) => {
    const admins = await storage.getBranchAdmins(req.params.id as string);
    res.json(
      admins.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        createdAt: a.createdAt,
      }))
    );
  });

  app.post("/api/superadmin/impersonate", requireRole("SUPER_ADMIN"), async (req, res) => {
    const { branchId } = req.body;
    const actor = req.user as any;
    console.log(`[IMPERSONATE] branchId=${branchId}, actor=${actor.email}`);

    if (!branchId) return res.status(400).json({ message: "branchId requerido" });

    try {
      const branch = await storage.getBranch(branchId);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });

      const admins = await storage.getBranchAdmins(branchId);
      if (admins.length === 0) {
        console.log(`[IMPERSONATE] No admin for branch ${branchId}`);
        return res.status(404).json({ message: "No hay admin asignado a esta sucursal. Primero crea o asigna un admin.", noAdmin: true });
      }

      const actorId = actor.id;
      const targetAdmin = admins[0];

      await new Promise<void>((resolve, reject) => {
        req.logIn(targetAdmin, (err) => {
          if (err) return reject(err);
          applySessionLifetimeForRequest(req, targetAdmin);
          resolve();
        });
      });

      const sess = req.session as any;
      sess.originalUserId = actorId;
      sess.impersonating = true;
      sess.impersonatedBranchName = branch.name;
      sess.impersonateExpires = Date.now() + getImpersonationMaxAgeMs();

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      await storage.createAuditLog({
        actorUserId: actorId,
        action: "IMPERSONATE_START",
        branchId,
        metadata: { branchName: branch.name, adminEmail: targetAdmin.email },
      });

      console.log(`[IMPERSONATE] Started impersonating ${targetAdmin.email} at ${branch.name}`);
      res.json({ message: "Impersonation active", branchName: branch.name });
    } catch (err: any) {
      console.error(`[IMPERSONATE] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al iniciar modo soporte: ${err.message || "error desconocido"}` });
    }
  });

  // Impersonate: end
  app.post("/api/superadmin/impersonate/end", async (req, res) => {
    const sess = req.session as any;
    if (!req.isAuthenticated() && !(sess?.impersonating && sess?.originalUserId)) {
      return res.status(401).json({ message: "No autenticado" });
    }
    if (!sess.impersonating || !sess.originalUserId) {
      return res.status(400).json({ message: "No hay impersonation activa" });
    }

    const originalId = sess.originalUserId;
    const branchName = sess.impersonatedBranchName;
    const originalUser = await storage.getUser(originalId);
    if (!originalUser) {
      return res.status(500).json({ message: "Error al restaurar sesión" });
    }

    delete sess.impersonating;
    delete sess.originalUserId;
    delete sess.impersonatedBranchName;
    delete sess.impersonateExpires;

    await new Promise<void>((resolve, reject) => {
      req.logIn(originalUser, (err) => {
        if (err) return reject(err);
        applySessionLifetimeForRequest(req, originalUser);
        resolve();
      });
    });

    await storage.createAuditLog({
      actorUserId: originalId,
      action: "IMPERSONATE_END",
      metadata: { branchName },
    });

    res.json({ message: "Impersonation ended" });
  });

  // Audit logs
  app.get("/api/superadmin/audit", requireRole("SUPER_ADMIN"), async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await storage.getAuditLogs(limit);
    res.json(logs);
  });

  app.get("/api/superadmin/system-events", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.getSystemEvents(limit);
      res.json(events);
    } catch (err: any) {
      console.error("[SUPERADMIN_SYSTEM_EVENTS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener eventos del sistema" });
    }
  });

  app.get("/api/superadmin/app-customers/overview", requireRole("SUPER_ADMIN"), async (_req, res) => {
    try {
      const overview = await storage.getCustomerAppOverview();
      res.json(overview);
    } catch (err: any) {
      console.error("[SUPERADMIN_CUSTOMERS_OVERVIEW]", err.stack || err);
      res.status(500).json({ message: "Error al obtener resumen de clientes app" });
    }
  });

  app.get("/api/superadmin/app-customers", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const customers = await storage.getCustomerAppUsers(q);
      res.json(customers);
    } catch (err: any) {
      console.error("[SUPERADMIN_CUSTOMERS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener clientes app" });
    }
  });

  app.get("/api/superadmin/app-customers/:id", requireRole("SUPER_ADMIN"), async (req, res) => {
    const customerId = getStringParam(req.params.id);
    try {
      const detail = await storage.getCustomerAppUserDetail(customerId);
      if (!detail) {
        return res.status(404).json({ message: "Cliente app no encontrado" });
      }
      res.json(detail);
    } catch (err: any) {
      console.error("[SUPERADMIN_CUSTOMER_DETAIL]", err.stack || err);
      res.status(500).json({ message: "Error al obtener detalle del cliente app" });
    }
  });

  app.patch("/api/superadmin/app-customers/:id/block", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const customerId = getStringParam(req.params.id);
    const result = updateCustomerGlobalBlockSchema.safeParse({
      isBlocked: req.body.isBlocked,
      reason: normalizeModerationText(req.body.reason),
      hideReviews: !!req.body.hideReviews,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: result.error.flatten() });
    }

    try {
      const updated = await storage.updateCustomerGlobalBlock(customerId, {
        isBlocked: result.data.isBlocked,
        blockedReason: result.data.reason ?? null,
        blockedBy: actor.id,
      });

      if (!updated) {
        return res.status(404).json({ message: "Cliente app no encontrado" });
      }

      if (result.data.isBlocked && result.data.hideReviews) {
        await storage.hideCustomerReviews(customerId, true, result.data.reason ?? "Cuenta bloqueada");
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: result.data.isBlocked ? "BLOCK_CUSTOMER_GLOBAL" : "UNBLOCK_CUSTOMER_GLOBAL",
        metadata: { customerId, hideReviews: !!result.data.hideReviews },
      });

      if (result.data.isBlocked) {
        await createSystemEventSafe({
          eventType: "customer_blocked_global",
          userId: updated.id,
          payload: {
            reason: result.data.reason ?? null,
            hideReviews: !!result.data.hideReviews,
            blockedByUserId: actor.id,
          },
        });
      }

      const { passwordHash, ...safeUser } = updated as any;
      res.json(safeUser);
    } catch (err: any) {
      console.error("[SUPERADMIN_CUSTOMER_BLOCK]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar bloqueo global" });
    }
  });

  app.post("/api/superadmin/app-customers/:id/hide-reviews", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const customerId = getStringParam(req.params.id);
    const hidden = req.body.hidden !== false;
    const reason = normalizeModerationText(req.body.reason) || "Moderado por Super Admin";

    try {
      const affected = await storage.hideCustomerReviews(customerId, hidden, reason);
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: hidden ? "HIDE_CUSTOMER_REVIEWS" : "UNHIDE_CUSTOMER_REVIEWS",
        metadata: { customerId, affected },
      });
      res.json({ affected, hidden });
    } catch (err: any) {
      console.error("[SUPERADMIN_HIDE_REVIEWS]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar visibilidad de reseñas" });
    }
  });

  app.patch("/api/superadmin/customer-reports/:id/status", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const reportId = getStringParam(req.params.id);
    const result = updateCustomerReportStatusSchema.safeParse({ status: req.body.status });

    if (!result.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: result.error.flatten() });
    }

    try {
      const updated = await storage.updateCustomerReportStatus(reportId, result.data.status, actor.id);
      if (!updated) {
        return res.status(404).json({ message: "Reporte no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REVIEW_CUSTOMER_REPORT",
        metadata: { reportId, status: result.data.status },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[SUPERADMIN_REPORT_STATUS]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar reporte" });
    }
  });

  app.delete("/api/superadmin/app-customers/:id", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const customerId = getStringParam(req.params.id);
    try {
      const result = await storage.deleteCustomerAppUserSafely(customerId);
      if (!result.deleted) {
        return res.status(409).json({ message: result.reason || "No es seguro eliminar este usuario" });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_CUSTOMER_SAFE",
        metadata: { customerId },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[SUPERADMIN_DELETE_CUSTOMER]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar cliente app" });
    }
  });

  app.delete("/api/superadmin/app-customers/:id/hard", requireRole("SUPER_ADMIN"), async (req, res) => {
    const actor = req.user as any;
    const customerId = getStringParam(req.params.id);
    const parsed = destructiveDeleteConfirmationSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    if (parsed.data.confirmationText.trim() !== "ELIMINAR CLIENTE") {
      return res.status(400).json({ message: "Escribe ELIMINAR CLIENTE para confirmar" });
    }

    try {
      const user = await storage.getUser(customerId);
      if (!user || user.role !== "CUSTOMER") {
        return res.status(404).json({ message: "Cliente app no encontrado" });
      }

      const firebaseUid = normalizeOptionalText(user.firebaseUid) ?? null;
      const avatarUrl = normalizeOptionalText(user.avatarUrl) ?? null;

      await storage.deleteCustomerAccount(customerId);

      let firebaseDeleted = false;
      let firebaseDeleteWarning: string | null = null;

      if (firebaseUid) {
        try {
          firebaseDeleted = (await deleteFirebaseUserByUid(firebaseUid)) === "deleted";
        } catch (firebaseErr: any) {
          firebaseDeleteWarning = firebaseErr?.message || "No se pudo eliminar el usuario en Firebase";
          console.error(
            `[SUPERADMIN_HARD_DELETE_CUSTOMER] Firebase delete failed for user ${customerId}:`,
            firebaseErr?.stack || firebaseErr,
          );
        }
      }

      const deletedUploadCount = deleteLocalUploadFiles([avatarUrl]);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_CUSTOMER_HARD",
        metadata: {
          customerId,
          customerEmail: user.email,
          customerName: user.name,
          firebaseUid,
          firebaseDeleted,
          firebaseDeleteWarning,
          deletedUploadCount,
        },
      });

      res.json({
        success: true,
        customerId,
        firebaseDeleted,
        firebaseDeleteWarning,
        deletedUploadCount,
      });
    } catch (err: any) {
      console.error("[SUPERADMIN_HARD_DELETE_CUSTOMER]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar definitivamente el cliente app" });
    }
  });

  // --- Branch Admin: Client Management ---
  async function requireBranchAdmin(req: any, res: any, next: any) {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    const user = req.user as any;
    if (user.role !== "BRANCH_ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    if (!user.branchId) return res.status(400).json({ message: "No hay sucursal asignada" });
    const branchAccessIssue = await getBranchAdminAccessIssue(user);
    if (branchAccessIssue) {
      return res.status(403).json({ message: branchAccessIssue });
    }
    next();
  }

  app.get("/api/branch/finance/summary", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const from = parseDateQueryValue(req.query.from);
      const to = parseDateQueryValue(req.query.to);
      const summary = await storage.getBranchFinanceSummary(user.branchId, { from, to });
      res.json(summary);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_SUMMARY]", err.stack || err);
      res.status(500).json({ message: "Error al obtener el resumen de caja" });
    }
  });

  app.get("/api/branch/finance/entries", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const from = parseDateQueryValue(req.query.from);
      const to = parseDateQueryValue(req.query.to);
      const type = typeof req.query.type === "string" && ["income", "expense"].includes(req.query.type) ? req.query.type : undefined;
      const category = typeof req.query.category === "string" ? req.query.category.trim() || undefined : undefined;
      const clientId = typeof req.query.clientId === "string" ? req.query.clientId.trim() || undefined : undefined;
      const q = typeof req.query.q === "string" ? req.query.q.trim() || undefined : undefined;
      const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);

      const entries = await storage.getBranchFinanceEntries(user.branchId, {
        from,
        to,
        type,
        category,
        clientId,
        q,
        page,
        limit,
      });
      res.json(entries);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_ENTRIES]", err.stack || err);
      res.status(500).json({ message: "Error al obtener movimientos de caja" });
    }
  });

  app.post("/api/branch/finance/entries", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const parsed = createBranchFinanceEntrySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      let clientUserId = normalizeOptionalText(data.clientUserId) ?? null;
      let clientName = normalizeOptionalText(data.clientName) ?? null;

      if (clientUserId) {
        const clientProfile = await storage.getClientProfile(clientUserId, user.branchId);
        if (!clientProfile) {
          return res.status(400).json({ message: "Cliente no encontrado en esta sucursal" });
        }
        clientName = null;
      }

      const created = await storage.createBranchFinanceEntry({
        branchId: user.branchId,
        type: data.type,
        category: normalizeOptionalText(data.category) ?? null,
        concept: data.concept.trim(),
        amount: data.amount.toFixed(2),
        paymentMethod: normalizeOptionalText(data.paymentMethod) ?? null,
        clientUserId,
        clientName,
        notes: normalizeOptionalText(data.notes) ?? null,
        entryDate: data.entryDate,
        source: normalizeOptionalText(data.source) ?? null,
        sourceId: normalizeOptionalText(data.sourceId) ?? null,
        metadata: data.metadata ?? null,
        createdBy: user.id,
      } as any);

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "CREATE_FINANCE_ENTRY",
        branchId: user.branchId,
        metadata: { entryId: created.id, type: created.type, amount: created.amount, entryDate: created.entryDate },
      });

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_CREATE]", err.stack || err);
      res.status(500).json({ message: "Error al crear movimiento de caja" });
    }
  });

  app.patch("/api/branch/finance/entries/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const entryId = getStringParam(req.params.id);
    const parsed = updateBranchFinanceEntrySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      let clientUserId = data.clientUserId === undefined ? undefined : (normalizeOptionalText(data.clientUserId) ?? null);
      let clientName = data.clientName === undefined ? undefined : (normalizeOptionalText(data.clientName) ?? null);

      if (clientUserId) {
        const clientProfile = await storage.getClientProfile(clientUserId, user.branchId);
        if (!clientProfile) {
          return res.status(400).json({ message: "Cliente no encontrado en esta sucursal" });
        }
        clientName = null;
      }

      const updated = await storage.updateBranchFinanceEntry(user.branchId, entryId, {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.category !== undefined ? { category: normalizeOptionalText(data.category) ?? null } : {}),
        ...(data.concept !== undefined ? { concept: data.concept.trim() } : {}),
        ...(data.amount !== undefined ? { amount: data.amount.toFixed(2) } : {}),
        ...(data.paymentMethod !== undefined ? { paymentMethod: normalizeOptionalText(data.paymentMethod) ?? null } : {}),
        ...(data.clientUserId !== undefined ? { clientUserId } : {}),
        ...(data.clientName !== undefined ? { clientName } : {}),
        ...(data.notes !== undefined ? { notes: normalizeOptionalText(data.notes) ?? null } : {}),
        ...(data.entryDate !== undefined ? { entryDate: data.entryDate } : {}),
        ...(data.source !== undefined ? { source: normalizeOptionalText(data.source) ?? null } : {}),
        ...(data.sourceId !== undefined ? { sourceId: normalizeOptionalText(data.sourceId) ?? null } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata ?? null } : {}),
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "Movimiento no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "UPDATE_FINANCE_ENTRY",
        branchId: user.branchId,
        metadata: { entryId: updated.id, type: updated.type, amount: updated.amount, entryDate: updated.entryDate },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_UPDATE]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar movimiento de caja" });
    }
  });

  app.delete("/api/branch/finance/entries/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const deleted = await storage.softDeleteBranchFinanceEntry(user.branchId, getStringParam(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Movimiento no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "DELETE_FINANCE_ENTRY",
        branchId: user.branchId,
        metadata: { entryId: getStringParam(req.params.id) },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_DELETE]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar movimiento de caja" });
    }
  });

  app.get("/api/branch/finance/export.csv", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const from = parseDateQueryValue(req.query.from);
      const to = parseDateQueryValue(req.query.to);
      const type = typeof req.query.type === "string" && ["income", "expense"].includes(req.query.type) ? req.query.type : undefined;
      const entries = await storage.listBranchFinanceEntriesForExport(user.branchId, { from, to, type });

      const header = "fecha,tipo,categoria,concepto,cliente,correo_cliente,metodo_pago,monto,notas";
      const rows = entries.map((entry) => [
        escapeCsvValue(entry.entryDate),
        escapeCsvValue(entry.type === "income" ? "Ingreso" : "Gasto"),
        escapeCsvValue(entry.category),
        escapeCsvValue(entry.concept),
        escapeCsvValue(entry.clientDisplayName),
        escapeCsvValue(entry.clientEmail),
        escapeCsvValue(entry.paymentMethod),
        escapeCsvValue(entry.amount.toFixed(2)),
        escapeCsvValue(entry.notes),
      ].join(","));

      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=caja.csv");
      res.send(csv);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_EXPORT]", err.stack || err);
      res.status(500).json({ message: "Error al exportar movimientos de caja" });
    }
  });

  app.get("/api/branch/finance/fixed-expenses", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const items = await storage.getBranchRecurringExpenses(user.branchId);
      res.json(items);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_FIXED_EXPENSES]", err.stack || err);
      res.status(500).json({ message: "Error al obtener gastos fijos" });
    }
  });

  app.post("/api/branch/finance/fixed-expenses", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const parsed = createBranchRecurringExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const created = await storage.createBranchRecurringExpense({
        branchId: user.branchId,
        name: data.name.trim(),
        category: data.category,
        amount: data.amount.toFixed(2),
        frequency: data.frequency,
        paymentDay: data.paymentDay ?? null,
        notes: normalizeOptionalText(data.notes) ?? null,
        isActive: data.isActive ?? true,
        createdBy: user.id,
      } as any);

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "CREATE_FIXED_EXPENSE",
        branchId: user.branchId,
        metadata: { recurringExpenseId: created.id, category: created.category, amount: created.amount },
      });

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_FIXED_EXPENSE_CREATE]", err.stack || err);
      res.status(500).json({ message: "Error al crear gasto fijo" });
    }
  });

  app.patch("/api/branch/finance/fixed-expenses/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const recurringExpenseId = getStringParam(req.params.id);
    const parsed = updateBranchRecurringExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const updated = await storage.updateBranchRecurringExpense(user.branchId, recurringExpenseId, {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.amount !== undefined ? { amount: data.amount.toFixed(2) } : {}),
        ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
        ...(data.paymentDay !== undefined ? { paymentDay: data.paymentDay ?? null } : {}),
        ...(data.notes !== undefined ? { notes: normalizeOptionalText(data.notes) ?? null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "Gasto fijo no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "UPDATE_FIXED_EXPENSE",
        branchId: user.branchId,
        metadata: { recurringExpenseId: updated.id },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_FIXED_EXPENSE_UPDATE]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar gasto fijo" });
    }
  });

  app.delete("/api/branch/finance/fixed-expenses/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const deleted = await storage.softDeleteBranchRecurringExpense(user.branchId, getStringParam(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Gasto fijo no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "DELETE_FIXED_EXPENSE",
        branchId: user.branchId,
        metadata: { recurringExpenseId: getStringParam(req.params.id) },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_FIXED_EXPENSE_DELETE]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar gasto fijo" });
    }
  });

  app.post("/api/branch/finance/fixed-expenses/:id/register-expense", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const recurringExpenseId = getStringParam(req.params.id);
    const parsed = registerBranchRecurringExpenseChargeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const created = await storage.registerBranchRecurringExpenseInFinance(user.branchId, recurringExpenseId, {
        entryDate: parsed.data.entryDate,
        paymentMethod: normalizeOptionalText(parsed.data.paymentMethod) ?? null,
        notes: normalizeOptionalText(parsed.data.notes) ?? null,
        createdBy: user.id,
      });

      if (!created) {
        return res.status(404).json({ message: "Gasto fijo no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "REGISTER_FIXED_EXPENSE_IN_FINANCE",
        branchId: user.branchId,
        metadata: { recurringExpenseId, financeEntryId: created.id, entryDate: created.entryDate },
      });

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_FIXED_EXPENSE_REGISTER]", err.stack || err);
      res.status(500).json({ message: "Error al registrar gasto fijo en Caja" });
    }
  });

  app.get("/api/branch/finance/staff", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const items = await storage.getBranchStaffMembers(user.branchId);
      res.json(items);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_STAFF]", err.stack || err);
      res.status(500).json({ message: "Error al obtener profesores y empleados" });
    }
  });

  app.post("/api/branch/finance/staff", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const parsed = createBranchStaffMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const created = await storage.createBranchStaffMember({
        branchId: user.branchId,
        name: data.name.trim(),
        phone: normalizeOptionalText(data.phone) ?? null,
        payPerClass: data.payPerClass.toFixed(2),
        notes: normalizeOptionalText(data.notes) ?? null,
        isActive: data.isActive ?? true,
        createdBy: user.id,
      } as any);

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "CREATE_BRANCH_STAFF",
        branchId: user.branchId,
        metadata: { staffId: created.id, name: created.name, payPerClass: created.payPerClass },
      });

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_STAFF_CREATE]", err.stack || err);
      res.status(500).json({ message: "Error al crear profesor o empleado" });
    }
  });

  app.patch("/api/branch/finance/staff/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const staffId = getStringParam(req.params.id);
    const parsed = updateBranchStaffMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const updated = await storage.updateBranchStaffMember(user.branchId, staffId, {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined ? { phone: normalizeOptionalText(data.phone) ?? null } : {}),
        ...(data.payPerClass !== undefined ? { payPerClass: data.payPerClass.toFixed(2) } : {}),
        ...(data.notes !== undefined ? { notes: normalizeOptionalText(data.notes) ?? null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "Profesor o empleado no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "UPDATE_BRANCH_STAFF",
        branchId: user.branchId,
        metadata: { staffId: updated.id },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_STAFF_UPDATE]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar profesor o empleado" });
    }
  });

  app.delete("/api/branch/finance/staff/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const deleted = await storage.softDeleteBranchStaffMember(user.branchId, getStringParam(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Profesor o empleado no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "DELETE_BRANCH_STAFF",
        branchId: user.branchId,
        metadata: { staffId: getStringParam(req.params.id) },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_STAFF_DELETE]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar profesor o empleado" });
    }
  });

  app.get("/api/branch/finance/staff/class-logs", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const from = parseDateQueryValue(req.query.from);
      const to = parseDateQueryValue(req.query.to);
      const staffId = typeof req.query.staffId === "string" ? req.query.staffId.trim() || undefined : undefined;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1), 200);
      const logs = await storage.getBranchStaffClassLogs(user.branchId, { from, to, staffId, limit });
      res.json(logs);
    } catch (err: any) {
      console.error("[BRANCH_FINANCE_STAFF_CLASS_LOGS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener clases registradas" });
    }
  });

  app.post("/api/branch/finance/staff/class-logs", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const parsed = createBranchStaffClassLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const log = await storage.createBranchStaffClassLogAndFinanceEntry({
        branchId: user.branchId,
        staffId: parsed.data.staffId,
        classesCount: parsed.data.classesCount,
        classDate: parsed.data.classDate,
        paymentMethod: normalizeOptionalText(parsed.data.paymentMethod) ?? null,
        notes: normalizeOptionalText(parsed.data.notes) ?? null,
        createdBy: user.id,
      });

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "REGISTER_STAFF_CLASSES_IN_FINANCE",
        branchId: user.branchId,
        metadata: { staffId: log.staffId, classLogId: log.id, paymentTotal: log.paymentTotal },
      });

      res.status(201).json(log);
    } catch (err: any) {
      if (err instanceof Error && err.message === "PROFESSOR_NOT_FOUND") {
        return res.status(404).json({ message: "Profesor o empleado no encontrado" });
      }
      console.error("[BRANCH_FINANCE_STAFF_CLASS_LOG_CREATE]", err.stack || err);
      res.status(500).json({ message: "Error al registrar clases impartidas" });
    }
  });

  app.get("/api/branch/clients", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const includeLeft = req.query.include_left === "true";
      const clients = await storage.getBranchClients(user.branchId, includeLeft);
      res.json(clients);
    } catch (err: any) {
      console.error(`[BRANCH_CLIENTS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener clientes" });
    }
  });

  app.get("/api/branch/clients/export", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const clients = await storage.getBranchClients(user.branchId);
      const header = "nombre,apellido,email,telefono,genero,fechaNacimiento,status,ingreso,ultimaVisita,plan,clasesRestantes";
      const escCsv = (val: string | null | undefined) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const rows = clients.map((c: any) => [
        escCsv(c.name),
        escCsv(c.lastName),
        escCsv(c.email),
        escCsv(c.phone),
        escCsv(c.gender),
        escCsv(c.birthDate),
        escCsv(c.membershipStatus),
        escCsv(c.joinedAt ? new Date(c.joinedAt).toISOString().split("T")[0] : null),
        escCsv(c.lastSeenAt ? new Date(c.lastSeenAt).toISOString().split("T")[0] : null),
        escCsv(c.planName),
        c.classesRemaining !== null && c.classesRemaining !== undefined ? String(c.classesRemaining) : "",
      ].join(","));
      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=clientes.csv");
      res.send(csv);
    } catch (err: any) {
      console.error(`[EXPORT_CSV] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al exportar clientes" });
    }
  });

  app.get("/api/branch/clients/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const clientId = req.params.id as string;
    try {
      const profile = await storage.getClientProfile(clientId, user.branchId);
      if (!profile) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      const rawUser = await storage.getUser(clientId);
      if (!rawUser) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      res.json({
        ...profile,
        identityControl: getBranchClientIdentityControl(rawUser, profile.membership),
      });
    } catch (err: any) {
      console.error(`[CLIENT_PROFILE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener perfil del cliente" });
    }
  });

  app.patch("/api/branch/client/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    const result = updateBranchClientCrmSchema.safeParse({
      clientStatus: req.body.clientStatus === "auto" ? null : req.body.clientStatus,
      tags: req.body.tags,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      const updated = await storage.updateBranchClientCrm(actor.branchId, clientId, {
        ...(result.data.clientStatus !== undefined && { clientStatus: result.data.clientStatus }),
        ...(result.data.tags !== undefined && { tags: normalizeTags(result.data.tags) }),
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLIENT_CRM",
        branchId: actor.branchId,
        metadata: { clientId, fields: Object.keys(result.data) },
      });

      res.json(updated);
    } catch (err: any) {
      console.error(`[CLIENT_CRM] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar CRM del cliente" });
    }
  });

  app.post("/api/branch/client/:id/report", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const result = createCustomerReportSchema.safeParse({
      reason: req.body.reason,
      note: normalizeModerationText(req.body.note),
      blockLocally: !!req.body.blockLocally,
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: result.error.flatten() });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }

      const report = await storage.createCustomerReport({
        branchId: actor.branchId,
        userId: clientId,
        reportedByUserId: actor.id,
        reason: result.data.reason,
        note: result.data.note ?? null,
      });

      let localBlock = null;
      if (result.data.blockLocally) {
        localBlock = await storage.setBranchCustomerBlock(actor.branchId, clientId, {
          blockedByUserId: actor.id,
          reason: result.data.reason,
          note: result.data.note ?? null,
        });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REPORT_CUSTOMER",
        branchId: actor.branchId,
        metadata: { clientId, reportId: report.id, blockLocally: !!localBlock },
      });

      await createSystemEventSafe({
        eventType: "customer_reported",
        branchId: actor.branchId,
        userId: clientId,
        payload: {
          reportId: report.id,
          reason: result.data.reason,
          blockLocally: !!localBlock,
          reportedByUserId: actor.id,
        },
      });

      if (localBlock) {
        await createSystemEventSafe({
          eventType: "customer_blocked_local",
          branchId: actor.branchId,
          userId: clientId,
          payload: {
            reportId: report.id,
            reason: result.data.reason,
            note: result.data.note ?? null,
            blockedByUserId: actor.id,
          },
        });
      }

      res.status(201).json({ report, localBlock });
    } catch (err: any) {
      console.error("[BRANCH_REPORT_CUSTOMER]", err.stack || err);
      res.status(500).json({ message: "Error al reportar cliente" });
    }
  });

  app.post("/api/branch/client/:id/local-block", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const result = updateBranchCustomerBlockSchema.safeParse({
      reason: normalizeModerationText(req.body.reason),
      note: normalizeModerationText(req.body.note),
    });

    if (!result.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: result.error.flatten() });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }

      const block = await storage.setBranchCustomerBlock(actor.branchId, clientId, {
        blockedByUserId: actor.id,
        reason: result.data.reason ?? null,
        note: result.data.note ?? null,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "BLOCK_CUSTOMER_LOCAL",
        branchId: actor.branchId,
        metadata: { clientId, blockId: block.id },
      });

      await createSystemEventSafe({
        eventType: "customer_blocked_local",
        branchId: actor.branchId,
        userId: clientId,
        payload: {
          blockId: block.id,
          reason: result.data.reason ?? null,
          note: result.data.note ?? null,
          blockedByUserId: actor.id,
        },
      });

      res.status(201).json(block);
    } catch (err: any) {
      console.error("[BRANCH_BLOCK_CUSTOMER]", err.stack || err);
      res.status(500).json({ message: "Error al bloquear cliente en la sucursal" });
    }
  });

  app.delete("/api/branch/client/:id/local-block", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    try {
      const affected = await storage.unblockBranchCustomer(actor.branchId, clientId);
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UNBLOCK_CUSTOMER_LOCAL",
        branchId: actor.branchId,
        metadata: { clientId, affected },
      });
      res.json({ success: true, affected });
    } catch (err: any) {
      console.error("[BRANCH_UNBLOCK_CUSTOMER]", err.stack || err);
      res.status(500).json({ message: "Error al desbloquear cliente en la sucursal" });
    }
  });

  app.post("/api/branch/clients", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const result = createClientSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const privateProfilePayload = buildBranchClientPrivateProfilePayload({
        emergencyContactName: result.data.emergencyContactName,
        emergencyContactPhone: result.data.emergencyContactPhone,
        medicalNotes: result.data.medicalNotes,
      });
      const hasPrivateProfilePayload = Object.keys(privateProfilePayload).length > 0;
      const incomingIdentity = buildIncomingClientIdentity({
        name: result.data.name,
        lastName: result.data.lastName,
        email: result.data.email,
        phone: result.data.phone,
        birthDate: result.data.birthDate,
      });
      const branchClients = await storage.getBranchClients(actor.branchId, true);
      const phoneMatches = getBranchClientPhoneMatches(branchClients, incomingIdentity.phone);
      const duplicateMatches = collectBranchClientDuplicateMatches(branchClients, incomingIdentity);
      const forcePhoneDuplicateCreate = phoneMatches.length === 1 && !!result.data.confirmPotentialDuplicate;
      const filteredStrongMatches = forcePhoneDuplicateCreate
        ? duplicateMatches.strongMatches.filter((match) => match.candidate.userId !== phoneMatches[0].userId)
        : duplicateMatches.strongMatches;
      const filteredPossibleMatches = forcePhoneDuplicateCreate
        ? duplicateMatches.possibleMatches.filter((match) => match.candidate.userId !== phoneMatches[0].userId)
        : duplicateMatches.possibleMatches;
      const strongMatch = filteredStrongMatches.length > 0 ? chooseBestBranchClientMatch(filteredStrongMatches) : null;
      const possibleMatch = filteredPossibleMatches.length > 0 ? chooseBestBranchClientMatch(filteredPossibleMatches) : null;
      const existingByEmail = await storage.getUserByEmail(result.data.email);
      if (existingByEmail && existingByEmail.role !== "CUSTOMER") {
        return res.status(409).json({
          message: "Ese correo ya esta vinculado a una cuenta administrativa",
          code: "WRONG_ROLE",
        });
      }
      if ((existingByEmail as any)?.isBlocked) {
        return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
      }

      if (phoneMatches.length > 1) {
        if (!forcePhoneDuplicateCreate) {
          await storage.createAuditLog({
          actorUserId: actor.id,
          action: "DUPLICATE_CLIENT_PREVENTED",
          branchId: actor.branchId,
          metadata: {
            incomingEmail: result.data.email,
            normalizedPhone: incomingIdentity.phone,
            candidateUserIds: phoneMatches.map((client) => client.userId),
            duplicateType: "phone",
          },
        });

        return res.status(409).json({
          code: "AMBIGUOUS_DUPLICATE",
          duplicateType: "phone",
          candidateCount: phoneMatches.length,
          candidates: phoneMatches.map((client) => buildBranchClientDuplicateSummary(client)),
          message: "Ya existen varios clientes con ese telÃ©fono en esta sucursal. RevÃ­salo manualmente antes de crear otro.",
        });
      }
      }

      if (phoneMatches.length === 1) {
        const phoneMatch = evaluateBranchClientDuplicateMatch(phoneMatches[0], incomingIdentity);
        const matchedMembership = await storage.getMembership(phoneMatch.candidate.userId, actor.branchId);
        const matchedUser = await storage.getUser(phoneMatch.candidate.userId);

        if (!matchedMembership || !matchedUser) {
          return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
        }

        if (forcePhoneDuplicateCreate) {
          await storage.createAuditLog({
            actorUserId: actor.id,
            action: "CREATE_CLIENT_CONFIRMED_PHONE_DUPLICATE",
            branchId: actor.branchId,
            metadata: {
              incomingEmail: result.data.email,
              candidateUserId: phoneMatch.candidate.userId,
              normalizedPhone: incomingIdentity.phone,
            },
          });
        } else if (
          result.data.reuseExistingClientId === phoneMatch.candidate.userId &&
          phoneMatch.candidate.membershipStatus !== "banned"
        ) {
          if (existingByEmail && existingByEmail.id !== matchedUser.id) {
            return res.status(409).json({
              code: "DUPLICATE_CLIENT",
              duplicateType: "phone",
              candidate: phoneMatch.candidate,
              candidateCount: 1,
              canReuseExisting: false,
              message: "Ese telÃ©fono ya pertenece a un cliente existente y el correo ingresado ya estÃ¡ ligado a otra cuenta. RevÃ­salo manualmente antes de continuar.",
            });
          }

          const identityControl = getBranchClientIdentityControl(matchedUser, matchedMembership);
          const missingUpdates = identityControl.canEditIdentity
            ? getMissingClientFieldUpdates(matchedUser, {
                name: result.data.name,
                lastName: result.data.lastName,
                email: result.data.email,
                phone: result.data.phone,
                birthDate: result.data.birthDate,
                gender: result.data.gender,
              })
            : {};

          if (Object.keys(missingUpdates).length > 0) {
            await storage.updateUser(matchedUser.id, missingUpdates);
          }

          if (matchedMembership.status === "left") {
            await storage.updateMembership(matchedMembership.id, { status: "active", source: "admin_created" });
          }

          if (hasPrivateProfilePayload) {
            await storage.updateBranchClientPrivateProfile(actor.branchId, matchedUser.id, privateProfilePayload);
          }

          await storage.createAuditLog({
            actorUserId: actor.id,
            action: "DUPLICATE_CLIENT_REUSED",
            branchId: actor.branchId,
            metadata: {
              incomingEmail: result.data.email,
              candidateUserId: phoneMatch.candidate.userId,
              targetUserId: matchedUser.id,
              strongReasons: ["phone"],
              updatedIdentityFields: Object.keys(missingUpdates),
            },
          });

          return res.json({
            message: "Cliente existente actualizado",
            userId: matchedUser.id,
            reusedExisting: true,
          });
        }

        if (!forcePhoneDuplicateCreate) {
          await storage.createAuditLog({
          actorUserId: actor.id,
          action: "DUPLICATE_CLIENT_PREVENTED",
          branchId: actor.branchId,
          metadata: {
            incomingEmail: result.data.email,
            candidateUserId: phoneMatch.candidate.userId,
            candidateCount: 1,
            strongReasons: ["phone"],
          },
        });

        return res.status(409).json({
          code: "DUPLICATE_CLIENT",
          duplicateType: "phone",
          candidate: phoneMatch.candidate,
          candidateCount: 1,
          canReuseExisting: false,
          canCreateAnyway: true,
          message: "Este telÃ©fono ya parece estar registrado en tu sucursal.",
        });
      }
      }

      if (strongMatch) {
        if (
          result.data.reuseExistingClientId === strongMatch.candidate.userId &&
          duplicateMatches.strongMatches.length === 1 &&
          strongMatch.candidate.membershipStatus !== "banned"
        ) {
          if (existingByEmail && existingByEmail.id !== strongMatch.candidate.userId) {
            return res.status(409).json({
              code: "DUPLICATE_CLIENT",
              duplicateType: "strong",
              candidate: strongMatch.candidate,
              candidateCount: duplicateMatches.strongMatches.length,
              canReuseExisting: false,
              message: "Ya existe un cliente coincidente en tu sucursal y el correo pertenece a otra cuenta ya vinculada. Revisa manualmente antes de continuar.",
            });
          }

          const currentUser = await storage.getUser(strongMatch.candidate.userId);
          if (!currentUser) {
            return res.status(404).json({ message: "Cliente no encontrado" });
          }

          const membership = await storage.getMembership(strongMatch.candidate.userId, actor.branchId);
          if (!membership) {
            return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
          }

          const identityControl = getBranchClientIdentityControl(currentUser, membership);
          const missingUpdates = identityControl.canEditIdentity
            ? getMissingClientFieldUpdates(currentUser, {
                name: result.data.name,
                lastName: result.data.lastName,
                email: result.data.email,
                phone: result.data.phone,
                birthDate: result.data.birthDate,
                gender: result.data.gender,
              })
            : {};

          if (Object.keys(missingUpdates).length > 0) {
            await storage.updateUser(currentUser.id, missingUpdates);
          }

          if (membership.status === "left") {
            await storage.updateMembership(membership.id, { status: "active", source: "admin_created" });
          }

          if (hasPrivateProfilePayload) {
            await storage.updateBranchClientPrivateProfile(actor.branchId, currentUser.id, privateProfilePayload);
          }

          await storage.createAuditLog({
            actorUserId: actor.id,
            action: "DUPLICATE_CLIENT_REUSED",
            branchId: actor.branchId,
            metadata: {
              incomingEmail: result.data.email,
              candidateUserId: strongMatch.candidate.userId,
              targetUserId: currentUser.id,
              strongReasons: strongMatch.strongReasons,
              updatedIdentityFields: Object.keys(missingUpdates),
            },
          });

          return res.json({
            message: "Cliente existente actualizado",
            userId: currentUser.id,
            reusedExisting: true,
          });
        }

        await storage.createAuditLog({
          actorUserId: actor.id,
          action: "DUPLICATE_CLIENT_PREVENTED",
          branchId: actor.branchId,
          metadata: {
            incomingEmail: result.data.email,
            candidateUserId: strongMatch.candidate.userId,
            candidateCount: duplicateMatches.strongMatches.length,
            strongReasons: strongMatch.strongReasons,
          },
        });

        return res.status(409).json({
          code: duplicateMatches.strongMatches.length > 1 ? "AMBIGUOUS_DUPLICATE" : "DUPLICATE_CLIENT",
          duplicateType: duplicateMatches.strongMatches.length > 1 ? "ambiguous" : "strong",
          candidate: duplicateMatches.strongMatches.length === 1 ? strongMatch.candidate : null,
          candidateCount: duplicateMatches.strongMatches.length,
          canReuseExisting:
            duplicateMatches.strongMatches.length === 1 &&
            strongMatch.candidate.membershipStatus !== "banned",
          message:
            duplicateMatches.strongMatches.length > 1
              ? "Encontramos varios clientes con coincidencia fuerte en esta sucursal. Revisa el existente antes de crear otro."
              : "Este cliente ya parece estar registrado en tu sucursal.",
        });
      }
      if (possibleMatch && !result.data.confirmPotentialDuplicate) {
        await storage.createAuditLog({
          actorUserId: actor.id,
          action: "DUPLICATE_CLIENT_PREVENTED",
          branchId: actor.branchId,
          metadata: {
            incomingEmail: result.data.email,
            candidateUserId: possibleMatch.candidate.userId,
            duplicateType: "possible",
            conflictingFields: possibleMatch.conflictingFields,
          },
        });
        return res.status(409).json({
          code: "POSSIBLE_DUPLICATE_CLIENT",
          duplicateType: "possible",
          candidate: possibleMatch.candidate,
          canCreateAnyway: true,
          message: "Encontramos una persona con datos similares en esta sucursal. Confirma si deseas crear otro cliente.",
        });
      }
      if (possibleMatch && result.data.confirmPotentialDuplicate) {
        await storage.createAuditLog({
          actorUserId: actor.id,
          action: "CREATE_CLIENT_CONFIRMED_POSSIBLE_DUPLICATE",
          branchId: actor.branchId,
          metadata: {
            incomingEmail: result.data.email,
            candidateUserId: possibleMatch.candidate.userId,
            conflictingFields: possibleMatch.conflictingFields,
          },
        });
      }
      const existing = existingByEmail;
      if (existing) {
        const existingMembership = await storage.getMembership(existing.id, actor.branchId);
        const identityControl = getBranchClientIdentityControl(existing, existingMembership);
        const missingUpdates = identityControl.canEditIdentity
          ? getMissingClientFieldUpdates(existing, {
              name: result.data.name,
              lastName: result.data.lastName,
              email: result.data.email,
              phone: result.data.phone,
              birthDate: result.data.birthDate,
              gender: result.data.gender,
            })
          : {};
        if (Object.keys(missingUpdates).length > 0) {
          await storage.updateUser(existing.id, missingUpdates);
        }
        if (existingMembership) {
          if (existingMembership.status === "active") {
            return res.status(409).json({ message: "Este cliente ya está registrado en tu sucursal" });
          }
          await storage.updateMembership(existingMembership.id, { status: "active", source: "admin_created" });
          if (hasPrivateProfilePayload) {
            await storage.updateBranchClientPrivateProfile(actor.branchId, existing.id, privateProfilePayload);
          }
          await storage.createAuditLog({
            actorUserId: actor.id,
            action: "REACTIVATE_CLIENT",
            branchId: actor.branchId,
            metadata: { clientEmail: existing.email },
          });
          console.log(`[CREATE_CLIENT] Reactivated ${existing.email} for branch ${actor.branchId}`);
          return res.json({ message: "Cliente reactivado", userId: existing.id });
        }
        await storage.createMembership({
          userId: existing.id,
          branchId: actor.branchId,
          status: "active",
          isFavorite: false,
          source: "admin_created",
        });
        if (hasPrivateProfilePayload) {
          await storage.updateBranchClientPrivateProfile(actor.branchId, existing.id, privateProfilePayload);
        }
        await storage.createAuditLog({
          actorUserId: actor.id,
          action: "ADD_EXISTING_CLIENT",
          branchId: actor.branchId,
          metadata: { clientEmail: existing.email },
        });
        console.log(`[CREATE_CLIENT] Added existing user ${existing.email} to branch ${actor.branchId}`);
        return res.json({ message: "Cliente agregado", userId: existing.id });
      }

      const plainPassword = result.data.password || generateSecurePassword(12);
      const hash = await bcrypt.hash(plainPassword, 10);

      const newUser = await storage.createUser({
        email: result.data.email,
        passwordHash: hash,
        role: "CUSTOMER",
        name: result.data.name,
        lastName: result.data.lastName || null,
        phone: result.data.phone || null,
        birthDate: result.data.birthDate || null,
        gender: result.data.gender || null,
      } as any);

      await storage.createMembership({
        userId: newUser.id,
        branchId: actor.branchId,
        status: "active",
        isFavorite: false,
        source: "admin_created",
      });

      if (hasPrivateProfilePayload) {
        await storage.updateBranchClientPrivateProfile(actor.branchId, newUser.id, privateProfilePayload);
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_CLIENT",
        branchId: actor.branchId,
        metadata: {
          clientEmail: newUser.email,
          clientName: newUser.name,
          confirmedPossibleDuplicate: !!result.data.confirmPotentialDuplicate,
          confirmedPhoneDuplicate: forcePhoneDuplicateCreate,
        },
      });

      console.log(`[CREATE_CLIENT] Created new client ${newUser.email} for branch ${actor.branchId}`);
      res.status(201).json({
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        password: plainPassword,
      });
    } catch (err: any) {
      console.error(`[CREATE_CLIENT] Error:`, err.stack || err);
      res.status(500).json({ message: `Error al crear cliente: ${err.message || "error desconocido"}` });
    }
  });

  app.patch("/api/branch/clients/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const privateResult = updateBranchClientPrivateSchema.safeParse(req.body);
    const globalResult = updateBranchClientGlobalSchema.safeParse(req.body);
    const result = {
      error: {
        flatten: () => ({
          private: privateResult.success ? null : privateResult.error.flatten(),
          global: globalResult.success ? null : globalResult.error.flatten(),
        }),
      },
    };
    if (!privateResult.success || !globalResult.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }

      const currentUser = await storage.getUser(clientId);
      if (!currentUser) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }

      const globalPayload = globalResult.data;
      const privatePayload = privateResult.data;
      const hasGlobalChanges = Object.keys(globalPayload).length > 0;
      const hasPrivateChanges = Object.keys(privatePayload).length > 0;

      if (!hasGlobalChanges && !hasPrivateChanges) {
        return res.status(400).json({ message: "No hay cambios válidos para guardar" });
      }

      let updatedUser = null;
      let updatedPrivateProfile = null;

      if (hasGlobalChanges) {
        const identityControl = getBranchClientIdentityControl(currentUser, membership);
        if (!identityControl.canEditIdentity) {
          return res.status(409).json({
            code: "IDENTITY_MANAGED_BY_APP",
            message: identityControl.reason,
          });
        }

        if (
          globalPayload.email !== undefined &&
          normalizeComparableEmail(globalPayload.email) !== normalizeComparableEmail(currentUser.email)
        ) {
          const existingByEmail = await storage.getUserByEmail(globalPayload.email);
          if (existingByEmail && existingByEmail.id !== clientId) {
            return res.status(409).json({
              code: "DUPLICATE_CLIENT",
              message: "Ese correo ya estÃ¡ registrado por otro usuario",
            });
          }
        }

        if (globalPayload.phone !== undefined) {
          const normalizedPhone = normalizeMxPhone(globalPayload.phone);
          if (globalPayload.phone && !normalizedPhone) {
            return res.status(400).json({ message: "El telÃ©fono no tiene un formato vÃ¡lido" });
          }

          const branchClients = await storage.getBranchClients(actor.branchId, true);
          const phoneMatches = getBranchClientPhoneMatches(branchClients, normalizedPhone, clientId);
          if (phoneMatches.length > 1) {
            return res.status(409).json({
              code: "AMBIGUOUS_DUPLICATE",
              message: "Ya existen varios clientes con ese telÃ©fono en esta sucursal. Revisa la base antes de guardarlo.",
            });
          }
          if (phoneMatches.length === 1) {
            return res.status(409).json({
              code: "DUPLICATE_CLIENT",
              candidate: buildBranchClientDuplicateSummary(phoneMatches[0]),
              message: "Ese telÃ©fono ya estÃ¡ registrado por otro cliente de esta sucursal.",
            });
          }
        }

        updatedUser = await storage.updateClient(clientId, {
          ...(globalPayload.name !== undefined && { name: globalPayload.name }),
          ...(globalPayload.email !== undefined && { email: globalPayload.email.trim().toLowerCase() }),
          ...(globalPayload.lastName !== undefined && { lastName: globalPayload.lastName }),
          ...(globalPayload.phone !== undefined && { phone: globalPayload.phone }),
          ...(globalPayload.birthDate !== undefined && { birthDate: globalPayload.birthDate }),
          ...(globalPayload.gender !== undefined && { gender: globalPayload.gender }),
        });
      }

      if (hasPrivateChanges) {
        updatedPrivateProfile = await storage.updateBranchClientPrivateProfile(actor.branchId, clientId, privatePayload);
      }
      /*
          return res.status(409).json({ message: "Ese email ya está registrado por otro usuario" });
        }
      }


      */
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLIENT",
        branchId: actor.branchId,
        metadata: {
          clientId,
          globalFields: Object.keys(globalPayload),
          privateFields: Object.keys(privatePayload),
        },
      });

      console.log(`[UPDATE_CLIENT] Updated client ${clientId} by ${actor.email}`);
      res.json({
        success: true,
        user: updatedUser,
        privateProfile: updatedPrivateProfile,
      });
    } catch (err: any) {
      console.error(`[UPDATE_CLIENT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar cliente" });
    }
  });

  app.delete("/api/branch/clients/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      if (membership.status === "left") {
        return res.status(400).json({ message: "El cliente ya fue eliminado" });
      }

      await storage.softDeleteMembership(membership.id);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "SOFT_DELETE_CLIENT",
        branchId: actor.branchId,
        metadata: { clientId, membershipId: membership.id },
      });

      console.log(`[DELETE_CLIENT] Soft deleted client ${clientId} by ${actor.email}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[DELETE_CLIENT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar cliente" });
    }
  });

  app.post("/api/branch/clients/:id/notes", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ message: "El contenido de la nota es obligatorio" });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }

      const note = await storage.createClientNote({
        branchId: actor.branchId,
        userId: clientId,
        content: content.trim(),
        createdBy: actor.id,
      });

      console.log(`[CLIENT_NOTE] Added note for client ${clientId} by ${actor.email}`);
      res.status(201).json(note);
    } catch (err: any) {
      console.error(`[CLIENT_NOTE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al crear nota" });
    }
  });

  app.post("/api/branch/clients/:id/attendance", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }
      if (membership.status !== "active") {
        return res.status(400).json({ message: "El cliente no tiene una membresía activa" });
      }
      if (membership.clientStatus === "frozen") {
        return res.status(400).json({ message: "El cliente está congelado. No se puede registrar asistencia." });
      }
      if (membership.expiresAt && new Date(membership.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Plan vencido. Renueva para registrar asistencia." });
      }

      const attendance = await storage.createAttendance({
        branchId: actor.branchId,
        userId: clientId,
        registeredBy: actor.id,
      });

      if (membership.classesRemaining !== null && membership.classesRemaining > 0) {
        await storage.decrementClassesRemaining(membership.id);
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REGISTER_ATTENDANCE",
        branchId: actor.branchId,
        metadata: { clientId },
      });

      console.log(`[ATTENDANCE] Registered for client ${clientId} by ${actor.email}`);
      res.status(201).json(attendance);
    } catch (err: any) {
      console.error(`[ATTENDANCE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al registrar asistencia" });
    }
  });

  app.post("/api/branch/clients/:id/avatar", requireBranchAdmin, (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    if (actor.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "La foto global del cliente solo puede administrarla el propio usuario" });
    }

    upload.single("file")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "El archivo excede el tamaño máximo de 10MB" });
        }
        return res.status(400).json({ message: err.message || "Error al subir archivo" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ningún archivo" });
      }

      try {
        const membership = await storage.getMembership(clientId, actor.branchId);
        if (!membership || membership.status !== "active") {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
        }

        const existingUser = await storage.getUser(clientId);
        if (existingUser?.avatarUrl) {
          deleteLocalUploadFiles([existingUser.avatarUrl]);
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        await storage.updateClient(clientId, { avatarUrl });

        console.log(`[AVATAR] Uploaded for client ${clientId} by ${actor.email}`);
        res.json({ avatarUrl });
      } catch (err: any) {
        console.error(`[AVATAR] Error:`, err.stack || err);
        res.status(500).json({ message: "Error al subir avatar" });
      }
    });
  });

  app.delete("/api/branch/clients/:id/avatar", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;

    if (actor.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "La foto global del cliente solo puede administrarla el propio usuario" });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }

      const existingUser = await storage.getUser(clientId);
      if (existingUser?.avatarUrl) {
        deleteLocalUploadFiles([existingUser.avatarUrl]);
      }

      await storage.updateClient(clientId, { avatarUrl: null });

      console.log(`[AVATAR] Removed for client ${clientId} by ${actor.email}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[AVATAR] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar avatar" });
    }
  });

  app.patch("/api/branch/clients/:id/status", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const { clientStatus } = req.body;

    if (!clientStatus || !["active", "inactive", "frozen"].includes(clientStatus)) {
      return res.status(400).json({ message: "Status inválido. Usa: active, inactive, frozen" });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }

      await storage.updateClientStatus(membership.id, clientStatus);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLIENT_STATUS",
        branchId: actor.branchId,
        metadata: { clientId, clientStatus },
      });

      console.log(`[CLIENT_STATUS] ${clientId} → ${clientStatus} by ${actor.email}`);
      res.json({ success: true, clientStatus });
    } catch (err: any) {
      console.error(`[CLIENT_STATUS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar status" });
    }
  });

  app.patch("/api/branch/clients/:id/debt", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const clientId = req.params.id as string;
    const { hasDebt, debtAmount } = req.body;

    if (typeof hasDebt !== "boolean") {
      return res.status(400).json({ message: "hasDebt debe ser boolean" });
    }

    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });
      }

      const amount = hasDebt ? Math.max(0, Math.round(Number(debtAmount) || 0)) : 0;
      await storage.updateClientDebt(membership.id, hasDebt, amount);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLIENT_DEBT",
        branchId: actor.branchId,
        metadata: { clientId, hasDebt, debtAmount: amount },
      });

      console.log(`[CLIENT_DEBT] ${clientId} hasDebt=${hasDebt} amount=${amount} by ${actor.email}`);
      res.json({ success: true, hasDebt, debtAmount: amount });
    } catch (err: any) {
      console.error(`[CLIENT_DEBT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar adeudo" });
    }
  });

  app.post("/api/branch/clients/:id/reset-password", requireBranchAdmin, async (req, res) => {
    return res.status(403).json({ message: "Esta función ya no está disponible. El cliente debe gestionar su contraseña desde el inicio de sesión." });
    const actor = req.user as any;
    const clientId = req.params.id as string;
    try {
      const membership = await storage.getMembership(clientId, actor.branchId);
      if (!membership) return res.status(404).json({ message: "Cliente no encontrado en esta sucursal" });

      const client = await storage.getUser(clientId);
      if (!client) return res.status(404).json({ message: "Usuario no encontrado" });
      const clientEmail = client!.email;

      const newPassword = generateSecurePassword(12);
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(clientId, hash);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "RESET_CLIENT_PASSWORD",
        branchId: actor.branchId,
        metadata: { clientId, clientEmail },
      });

      console.log(`[RESET_CLIENT_PASSWORD] Reset password for ${clientEmail} by ${actor.email}`);
      res.json({ email: clientEmail, password: newPassword });
    } catch (err: any) {
      console.error(`[RESET_CLIENT_PASSWORD] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al resetear contraseña" });
    }
  });

  app.get("/api/branch/invite-link", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranch(user.branchId);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost:5000";
      const inviteUrl = `${protocol}://${host}/app/${branch.slug}`;
      res.json({ inviteUrl, slug: branch.slug });
    } catch (err: any) {
      console.error(`[INVITE_LINK] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al generar link de invitación" });
    }
  });

  // --- Membership Plans ---
  app.get("/api/branch/plans", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const plans = await storage.getBranchPlans(user.branchId);
      res.json(plans);
    } catch (err: any) {
      console.error(`[PLANS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener planes" });
    }
  });

  app.post("/api/branch/plans", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const data = createPlanSchema.parse(req.body);
      const cm = data.cycleMonths ?? 1;
      const plan = await storage.createPlan({
        branchId: actor.branchId,
        name: data.name,
        description: data.description || null,
        price: data.price,
        durationDays: cm === 0 ? 1 : cm * 30,
        classLimit: data.classLimit ?? null,
        cycleMonths: cm,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_PLAN",
        branchId: actor.branchId,
        metadata: { planId: plan.id, name: plan.name },
      });

      console.log(`[PLAN] Created "${plan.name}" by ${actor.email}`);
      res.status(201).json(plan);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PLAN] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear plan" });
    }
  });

  app.patch("/api/branch/plans/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const planId = req.params.id as string;
    try {
      const existing = await storage.getPlan(planId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }

      const updatePlanSchema = createPlanSchema.partial().extend({ isActive: z.boolean().optional() });
      const data = updatePlanSchema.parse(req.body);
      const updated = await storage.updatePlan(planId, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.cycleMonths !== undefined && { cycleMonths: data.cycleMonths, durationDays: data.cycleMonths === 0 ? 1 : (data.cycleMonths ?? 1) * 30 }),
        ...(data.classLimit !== undefined && { classLimit: data.classLimit ?? null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_PLAN",
        branchId: actor.branchId,
        metadata: { planId, changes: data },
      });

      console.log(`[PLAN] Updated "${planId}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PLAN] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar plan" });
    }
  });

  app.delete("/api/branch/plans/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const planId = req.params.id as string;
    try {
      const existing = await storage.getPlan(planId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }

      const plan = await storage.deactivatePlan(planId);
      const detached = await storage.detachPlanFromMemberships(planId, existing.name);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DEACTIVATE_PLAN",
        branchId: actor.branchId,
        metadata: { planId, name: existing.name, detachedClients: detached },
      });

      console.log(`[PLAN] Deactivated "${existing.name}" by ${actor.email}, detached ${detached} client(s)`);
      res.json(plan);
    } catch (err: any) {
      console.error(`[PLAN] Error deactivating:`, err.stack || err);
      res.status(500).json({ message: "Error al desactivar plan" });
    }
  });

  app.post("/api/branch/plans/:id/quick-charge", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const planId = req.params.id as string;
    const result = quickChargeSingleSessionSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos", errors: result.error.flatten() });
    }

    try {
      const plan = await storage.getPlan(planId);
      if (!plan || plan.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Servicio o plan no encontrado" });
      }
      if (!plan.isActive) {
        return res.status(400).json({ message: "Este servicio o plan está desactivado" });
      }
      if ((plan.cycleMonths ?? 1) !== 0) {
        return res.status(400).json({ message: "El cobro rápido solo está disponible para clase suelta o sesión única" });
      }
      if (plan.price <= 0) {
        return res.status(400).json({ message: "El servicio debe tener precio mayor a 0 para registrarlo en Caja" });
      }

      const customerName = normalizeOptionalText(result.data.customerName);
      if (!customerName) {
        return res.status(400).json({ message: "El nombre del cliente es obligatorio" });
      }

      const normalizedPhone = normalizeMxPhoneLike(result.data.whatsapp ?? "");
      if (result.data.whatsapp && !normalizedPhone) {
        return res.status(400).json({ message: "El WhatsApp no tiene un formato válido" });
      }

      if (result.data.requestId) {
        const existingEntry = await storage.findBranchFinanceEntryBySource(actor.branchId, "service_sale", result.data.requestId);
        if (existingEntry) {
          return res.status(200).json({ success: true, duplicate: true, financeEntry: existingEntry });
        }
      }

      const existingClients = await storage.getBranchClients(actor.branchId, true);
      const phoneMatches = normalizedPhone
        ? existingClients.filter((client: any) => normalizeMxPhoneLike(client.phone) === normalizedPhone)
        : [];
      if (phoneMatches.length > 1) {
        await storage.createAuditLog({
          actorUserId: actor.id,
          action: "QUICK_CHARGE_DUPLICATE_PHONE_CONFLICT",
          branchId: actor.branchId,
          metadata: {
            planId,
            normalizedPhone,
            candidateUserIds: phoneMatches.map((client: any) => client.userId),
          },
        });
        return res.status(409).json({
          code: "AMBIGUOUS_DUPLICATE",
          message: "Ya existen varios clientes con ese telefono en esta sucursal. Revisa la base de clientes antes de cobrar.",
        });
      }
      const matchedClient = phoneMatches[0];

      let clientUserId = matchedClient?.userId as string | undefined;
      let membershipId = matchedClient?.membershipId as string | undefined;
      let clientDisplayName = matchedClient
        ? `${matchedClient.name}${matchedClient.lastName ? ` ${matchedClient.lastName}` : ""}`.trim()
        : customerName;
      let clientAction: "matched" | "reactivated" | "created" = matchedClient ? "matched" : "created";

      if (matchedClient && matchedClient.membershipStatus === "left" && membershipId) {
        await storage.updateMembership(membershipId, {
          status: "active",
          source: "admin_created",
        });
        clientAction = "reactivated";
      }

      if (!clientUserId || !membershipId) {
        const generatedPassword = generateSecurePassword(24);
        const passwordHash = await bcrypt.hash(generatedPassword, 10);
        const { firstName, lastName } = splitFullName(customerName);

        let generatedEmail = buildCrmPlaceholderEmail(actor.branchId, normalizedPhone);
        while (await storage.getUserByEmail(generatedEmail)) {
          generatedEmail = buildCrmPlaceholderEmail(actor.branchId, normalizedPhone);
        }

        const newUser = await storage.createUser({
          email: generatedEmail,
          passwordHash,
          role: "CUSTOMER",
          name: firstName || customerName,
          lastName: lastName ?? null,
          phone: normalizedPhone,
          authProvider: "crm",
        } as any);

        const membership = await storage.createMembership({
          userId: newUser.id,
          branchId: actor.branchId,
          status: "active",
          isFavorite: false,
          source: "admin_created",
        });

        clientUserId = newUser.id;
        membershipId = membership.id;
        clientDisplayName = `${newUser.name}${newUser.lastName ? ` ${newUser.lastName}` : ""}`.trim();
        clientAction = "created";
      }

      await storage.updateBranchClientCrm(actor.branchId, clientUserId, { lastVisit: new Date() });

      const requestSourceId = result.data.requestId || crypto.randomUUID();
      const financeEntry = await storage.createBranchFinanceEntry({
        branchId: actor.branchId,
        type: "income",
        category: "servicio",
        concept: plan.name,
        amount: plan.price / 100,
        paymentMethod: result.data.paymentMethod,
        clientUserId,
        clientName: clientDisplayName,
        notes: normalizeOptionalText(result.data.note) ?? "Ingreso automático por cobro rápido de servicio individual",
        entryDate: result.data.entryDate || getMxIsoDate(),
        source: "service_sale",
        sourceId: requestSourceId,
        metadata: {
          planId: plan.id,
          planName: plan.name,
          cycleMonths: plan.cycleMonths,
          durationDays: plan.durationDays,
          classLimit: plan.classLimit,
          quickCharge: true,
          saleKind: "single_session",
          matchedByPhone: !!matchedClient,
          clientAction,
          normalizedPhone,
        },
        createdBy: actor.id,
      } as any);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "QUICK_CHARGE_SINGLE_SESSION",
        branchId: actor.branchId,
        metadata: {
          planId: plan.id,
          membershipId,
          userId: clientUserId,
          amount: plan.price,
          financeEntryId: financeEntry.id,
          clientAction,
        },
      });

      res.status(201).json({
        success: true,
        client: {
          userId: clientUserId,
          membershipId,
          displayName: clientDisplayName,
          action: clientAction,
        },
        financeEntry,
      });
    } catch (err: any) {
      console.error("[PLAN_QUICK_CHARGE]", err.stack || err);
      res.status(500).json({ message: "Error al registrar el cobro rápido" });
    }
  });

  app.post("/api/branch/memberships/:id/assign-plan", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const membershipId = req.params.id as string;
    try {
      const { planId, paymentMethod } = assignPlanWithFinanceSchema.parse(req.body);

      const plan = await storage.getPlan(planId);
      if (!plan || plan.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }
      if (!plan.isActive) {
        return res.status(400).json({ message: "Este plan está desactivado" });
      }

      const membershipCheck = await storage.getMembershipById(membershipId);

      if (!membershipCheck || membershipCheck.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      const classesRemaining = plan.classLimit ?? null;
      const classesTotal = plan.classLimit ?? null;
      const expiresAt = calculatePlanExpirationDate(plan, new Date());

      const membership = await storage.assignPlanToMembership(membershipId, planId, classesRemaining, classesTotal, expiresAt);
      if (!membership) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      const cancelled = await storage.cancelFutureBookingsForUser(membership.userId, actor.branchId);
      if (cancelled > 0) {
        console.log(`[PLAN] Cancelled ${cancelled} future bookings for user ${membership.userId} on plan assignment`);
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "ASSIGN_PLAN",
        branchId: actor.branchId,
        metadata: { membershipId, planId, planName: plan.name, cancelledBookings: cancelled },
      });

      if (plan.price > 0) {
        try {
          await storage.createMembershipFinanceEntry({
            branchId: actor.branchId,
            membershipId: membership.id,
            userId: membership.userId,
            planId: plan.id,
            planName: plan.name,
            amount: plan.price / 100,
            paidAt: membership.paidAt,
            expiresAt: membership.expiresAt,
            paymentMethod: normalizeOptionalText(paymentMethod) ?? null,
            createdBy: actor.id,
            eventType: "assign",
          });
        } catch (financeErr: any) {
          console.error("[PLAN_FINANCE_ASSIGN]", financeErr?.stack || financeErr);
        }
      }

      console.log(`[PLAN] Assigned "${plan.name}" to membership ${membershipId} by ${actor.email}`);
      res.json(membership);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PLAN] Error assigning:`, err.stack || err);
      res.status(500).json({ message: "Error al asignar plan" });
    }
  });

  app.delete("/api/branch/memberships/:id/plan", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const membershipId = req.params.id as string;
    try {
      const membership = await storage.removePlanFromMembership(membershipId);
      if (!membership) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      const cancelled = await storage.cancelFutureBookingsForUser(membership.userId, actor.branchId);
      if (cancelled > 0) {
        console.log(`[PLAN] Cancelled ${cancelled} future bookings for user ${membership.userId} on plan removal`);
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "REMOVE_PLAN",
        branchId: actor.branchId,
        metadata: { membershipId, cancelledBookings: cancelled },
      });

      console.log(`[PLAN] Removed plan from membership ${membershipId} by ${actor.email}`);
      res.json(membership);
    } catch (err: any) {
      console.error(`[PLAN] Error removing:`, err.stack || err);
      res.status(500).json({ message: "Error al quitar plan" });
    }
  });

  app.post("/api/branch/memberships/:id/renew", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const membershipId = req.params.id as string;
    try {
      const { paymentMethod } = membershipFinancePayloadSchema.parse(req.body ?? {});
      const targetMembership = await storage.getMembershipById(membershipId);
      if (!targetMembership || targetMembership.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      if (!targetMembership.planId) {
        return res.status(400).json({ message: "No hay plan asignado para renovar" });
      }

      const plan = await storage.getPlan(targetMembership.planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }

      const now = new Date();
      const expiresAt = calculatePlanExpirationDate(plan, now);

      const classesRemaining = plan.classLimit ?? null;
      const classesTotal = plan.classLimit ?? null;

      const renewed = await storage.renewMembership(
        targetMembership.id, plan.id, classesRemaining, classesTotal, expiresAt, now
      );

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "RENEW_MEMBERSHIP",
        branchId: actor.branchId,
        metadata: { membershipId: targetMembership.id, planId: plan.id, planName: plan.name, paidAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
      });

      if (plan.price > 0 && renewed) {
        try {
          await storage.createMembershipFinanceEntry({
            branchId: actor.branchId,
            membershipId: renewed.id,
            userId: renewed.userId,
            planId: plan.id,
            planName: plan.name,
            amount: plan.price / 100,
            paidAt: renewed.paidAt,
            expiresAt: renewed.expiresAt,
            paymentMethod: normalizeOptionalText(paymentMethod) ?? null,
            createdBy: actor.id,
            eventType: "renew",
          });
        } catch (financeErr: any) {
          console.error("[PLAN_FINANCE_RENEW]", financeErr?.stack || financeErr);
        }
      }

      console.log(`[RENEW] Renewed "${plan.name}" for membership ${targetMembership.id} by ${actor.email}`);
      res.json(renewed);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos invÃ¡lidos" });
      }
      console.error(`[RENEW] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al renovar membresía" });
    }
  });

  app.get("/api/branch/plans/:id/assignments", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const planId = req.params.id as string;
    try {
      const plan = await storage.getPlan(planId);
      if (!plan || plan.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }
      const count = await storage.getMembershipsAssignedToPlan(planId);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: "Error" });
    }
  });

  // --- Branch Stats (updated with reservations) ---
  app.get("/api/branch/reservations/stats", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const todayCount = await storage.getTodayBookingsCount(actor.branchId);
      const nextBooking = await storage.getNextBooking(actor.branchId);
      res.json({ todayCount, nextBooking });
    } catch (err: any) {
      console.error(`[RESERVATIONS] Error getting stats:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  // --- Class Schedules ---
  app.get("/api/branch/classes", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const schedules = await storage.getBranchClassSchedules(actor.branchId);
      res.json(schedules);
    } catch (err: any) {
      console.error(`[CLASSES] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al listar clases" });
    }
  });

  app.post("/api/branch/classes", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const data = createClassScheduleSchema.parse(req.body);
      const schedule = await storage.createClassSchedule({
        ...data,
        branchId: actor.branchId,
        description: data.description || null,
        instructorName: data.instructorName || null,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_CLASS",
        branchId: actor.branchId,
        metadata: { classId: schedule.id, name: schedule.name },
      });

      console.log(`[CLASSES] Created "${schedule.name}" by ${actor.email}`);
      res.status(201).json(schedule);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[CLASSES] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear clase" });
    }
  });

  app.patch("/api/branch/classes/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classId = req.params.id as string;
    try {
      const existing = await storage.getClassSchedule(classId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const updateSchema = createClassScheduleSchema.partial().extend({ isActive: z.boolean().optional() });
      const data = updateSchema.parse(req.body);
      const updated = await storage.updateClassSchedule(classId, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.instructorName !== undefined && { instructorName: data.instructorName || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLASS",
        branchId: actor.branchId,
        metadata: { classId, changes: data },
      });

      console.log(`[CLASSES] Updated "${updated?.name}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[CLASSES] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar clase" });
    }
  });

  app.delete("/api/branch/classes/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classId = req.params.id as string;
    try {
      const existing = await storage.getClassSchedule(classId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const updated = await storage.updateClassSchedule(classId, { isActive: false });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DEACTIVATE_CLASS",
        branchId: actor.branchId,
        metadata: { classId, name: existing.name },
      });

      console.log(`[CLASSES] Deactivated "${existing.name}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[CLASSES] Error deactivating:`, err.stack || err);
      res.status(500).json({ message: "Error al desactivar clase" });
    }
  });

  // --- Copy Week Schedule ---
  app.post("/api/branch/classes/copy-week", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const copySchema = z.object({
        fromDay: z.number().int().min(0).max(6),
        toDay: z.number().int().min(0).max(6),
      });
      const data = copySchema.parse(req.body);

      if (data.fromDay === data.toDay) {
        return res.status(400).json({ message: "El día origen y destino no pueden ser iguales" });
      }

      const created = await storage.copyClassSchedules(actor.branchId, data.fromDay, data.toDay);

      if (created.length === 0) {
        return res.json({ message: "No hay clases nuevas para copiar (ya existen o no hay clases en el día origen)", copied: 0 });
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "COPY_WEEK_SCHEDULE",
        branchId: actor.branchId,
        metadata: { fromDay: data.fromDay, toDay: data.toDay, copiedCount: created.length },
      });

      console.log(`[CLASSES] Copied ${created.length} schedules from day ${data.fromDay} to ${data.toDay} by ${actor.email}`);
      res.json({ message: `Se copiaron ${created.length} clases`, copied: created.length, classes: created });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[CLASSES] Error copying week:`, err.stack || err);
      res.status(500).json({ message: "Error al copiar horario" });
    }
  });

  async function handleBranchBookingStatusChange(
    actor: any,
    bookingId: string,
    status: "confirmed" | "cancelled" | "attended" | "no_show",
    reason?: string | null,
  ) {
    const existing = await storage.getBooking(bookingId);
    if (!existing || existing.branchId !== actor.branchId) {
      return { error: { status: 404, message: "Reserva no encontrada" } } as const;
    }

    const previousStatus = existing.status;
    const alreadyProcessed = existing.status === "attended" || existing.status === "no_show";

    if (status === "attended" && !alreadyProcessed) {
      const mem = await storage.getMembershipByUserAndBranch(existing.userId, actor.branchId);
      if (mem && mem.expiresAt && new Date(mem.expiresAt) < new Date()) {
        return { error: { status: 400, message: "Plan vencido. Renueva la membresía antes de marcar asistencia." } } as const;
      }
    }

    let lateCancellation = false;
    if (status === "cancelled" && existing.status === "confirmed") {
      const schedule = await storage.getClassSchedule(existing.classScheduleId);
      const branch = await storage.getBranch(actor.branchId);
      if (schedule && branch) {
        const cutoff = (branch as any).cancelCutoffMinutes ?? DEFAULT_CANCEL_CUTOFF_MINUTES;
        const classStart = new Date(`${existing.bookingDate}T${schedule.startTime}:00`);
        const diffMin = (classStart.getTime() - Date.now()) / 60000;
        if (diffMin < cutoff) {
          lateCancellation = true;
        }
      }
    }

    const updated = await storage.updateBookingStatus(bookingId, status);
    if (!updated) {
      return { error: { status: 404, message: "Reserva no encontrada" } } as const;
    }

    if (lateCancellation) {
      await storage.markBookingLateCancellation(bookingId);
    }

    if (status === "attended" && !alreadyProcessed) {
      try {
        await storage.createAttendance({
          userId: existing.userId,
          branchId: actor.branchId,
          registeredBy: actor.id,
        });
      } catch (attErr: any) {
        console.error("[BOOKINGS] Error creating attendance record:", attErr.message);
      }
    }

    let classesDeducted = false;
    if (!alreadyProcessed && (status === "attended" || status === "no_show" || (status === "cancelled" && lateCancellation))) {
      const mem = await storage.getMembershipByUserAndBranch(existing.userId, actor.branchId);
      if (mem && mem.classesRemaining !== null && mem.classesRemaining > 0) {
        const updatedMembership = await storage.decrementClassesRemaining(mem.id);
        classesDeducted = !!updatedMembership;
      }
    }

    await createReservationAuditSafe({
      bookingId,
      branchId: actor.branchId,
      customerUserId: existing.userId,
      actorUserId: actor.id,
      actorRole: actor.role,
      action: status === "cancelled" ? "cancelled" : status === "attended" ? "attended" : status === "no_show" ? "no_show" : "created",
      reason: normalizeModerationText(reason),
      source: "dashboard",
      metadata: {
        previousStatus,
        lateCancellation,
        classesDeducted,
      },
    });

    await storage.createAuditLog({
      actorUserId: actor.id,
      action: "UPDATE_BOOKING_STATUS",
      branchId: actor.branchId,
      metadata: { bookingId, previousStatus, status, lateCancellation, classesDeducted, reason: normalizeModerationText(reason) },
    });

    if (status === "cancelled" && previousStatus !== "cancelled") {
      await createSystemEventSafe({
        eventType: "booking_cancelled",
        branchId: actor.branchId,
        userId: existing.userId,
        payload: {
          bookingId,
          classScheduleId: existing.classScheduleId,
          bookingDate: existing.bookingDate,
          source: "dashboard",
          lateCancellation,
          reason: normalizeModerationText(reason),
        },
      });
    }

    return { updated, lateCancellation, classesDeducted } as const;
  }

  // --- Bookings ---
  app.get("/api/branch/bookings", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const date = (req.query.date as string) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    try {
      const bookings = await storage.getBookingsForDate(actor.branchId, date);
      res.json(bookings);
    } catch (err: any) {
      console.error(`[BOOKINGS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al listar reservas" });
    }
  });

  app.get("/api/branch/bookings/class/:classId", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classScheduleId = req.params.classId as string;
    const date = (req.query.date as string) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    try {
      const schedule = await storage.getClassSchedule(classScheduleId);
      if (!schedule || schedule.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }
      const bookings = await storage.getBookingsForClassOnDate(classScheduleId, date);
      res.json({ schedule, bookings, capacity: schedule.capacity, booked: bookings.filter(b => b.status !== "cancelled").length });
    } catch (err: any) {
      console.error(`[BOOKINGS] Error listing class bookings:`, err.stack || err);
      res.status(500).json({ message: "Error al listar reservas de clase" });
    }
  });

  app.post("/api/branch/bookings", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const data = createBookingSchema.parse(req.body);
      const schedule = await storage.getClassSchedule(data.classScheduleId);
      if (!schedule || schedule.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const userMembership = await storage.getMembership(data.userId, actor.branchId);
      if (!userMembership || userMembership.status !== "active") {
        return res.status(400).json({ message: "El cliente no pertenece a esta sucursal o no tiene membresía activa" });
      }
      if (userMembership.clientStatus === "inactive") {
        return res.status(400).json({ message: "El cliente está inactivo. No se puede reservar." });
      }
      if (userMembership.clientStatus === "frozen") {
        return res.status(400).json({ message: "El cliente está congelado. No se puede reservar." });
      }
      if (userMembership.expiresAt && new Date(userMembership.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Plan vencido. Renueva para reservar." });
      }
      if (userMembership.classesRemaining !== null && userMembership.classesRemaining <= 0) {
        return res.status(400).json({ message: "Sin clases disponibles. Renueva para reservar." });
      }

      const bookingAttempt = await storage.createBookingAtomically({
        classScheduleId: data.classScheduleId,
        branchId: actor.branchId,
        userId: data.userId,
        bookingDate: data.bookingDate,
        source: "dashboard",
      });

      if (bookingAttempt.error === "CLASS_NOT_FOUND") {
        return res.status(404).json({ message: "Clase no encontrada" });
      }
      if (bookingAttempt.error === "CLASS_FULL") {
        return res.status(400).json({ message: "Clase llena, no hay lugares disponibles" });
      }
      if (bookingAttempt.error === "ALREADY_BOOKED") {
        return res.status(400).json({ message: "El cliente ya tiene reserva en esta clase" });
      }

      const booking = bookingAttempt.booking!;
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_BOOKING",
        branchId: actor.branchId,
        metadata: { bookingId: booking.id, classId: data.classScheduleId, userId: data.userId, date: data.bookingDate },
      });

      await createSystemEventSafe({
        eventType: "booking_created",
        branchId: actor.branchId,
        userId: data.userId,
        payload: {
          bookingId: booking.id,
          classScheduleId: data.classScheduleId,
          bookingDate: data.bookingDate,
          source: "dashboard",
        },
      });

      await createReservationAuditSafe({
        bookingId: booking.id,
        branchId: actor.branchId,
        customerUserId: data.userId,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "created",
        source: "dashboard",
        metadata: {
          classScheduleId: data.classScheduleId,
          bookingDate: data.bookingDate,
        },
      });

      await scheduleBookingReminderJobSafe({
        bookingId: booking.id,
        branchId: actor.branchId,
        userId: data.userId,
        classScheduleId: data.classScheduleId,
        bookingDate: data.bookingDate,
      });

      console.log(`[BOOKINGS] Created booking for user ${data.userId} in class ${schedule.name} on ${data.bookingDate} by ${actor.email}`);
      res.status(201).json(booking);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[BOOKINGS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear reserva" });
    }
  });

  app.patch("/api/branch/bookings/:id/status", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const bookingId = req.params.id as string;
    try {
      const { status } = z.object({ status: z.enum(["confirmed", "cancelled", "attended", "no_show"]) }).parse(req.body);
      const result = await handleBranchBookingStatusChange(actor, bookingId, status, normalizeModerationText(req.body.reason));
      if ("error" in result && result.error) {
        return res.status(result.error.status).json({ message: result.error.message });
      }

      console.log(`[BOOKINGS] Updated booking ${bookingId} status to ${status}${result.lateCancellation ? " (late cancel)" : ""} by ${actor.email}`);
      return res.json({ ...result.updated, lateCancellation: result.lateCancellation, classesRemaining: null });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos invÃ¡lidos" });
      }
      console.error("[BOOKINGS] Error updating status (safe handler):", err.stack || err);
      return res.status(500).json({ message: "Error al actualizar reserva" });
    }
  });

  app.post("/api/branch/bookings/:id/cancel", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const result = await handleBranchBookingStatusChange(
        actor,
        getStringParam(req.params.id),
        "cancelled",
        normalizeModerationText(req.body.reason),
      );
      if ("error" in result && result.error) {
        return res.status(result.error.status).json({ message: result.error.message });
      }
      res.json({ ...result.updated, lateCancellation: result.lateCancellation });
    } catch (err: any) {
      console.error("[BRANCH_CANCEL_BOOKING]", err.stack || err);
      res.status(500).json({ message: "Error al cancelar la reserva" });
    }
  });

  app.post("/api/branch/bookings/:id/mark-attended", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const result = await handleBranchBookingStatusChange(
        actor,
        getStringParam(req.params.id),
        "attended",
        normalizeModerationText(req.body.reason),
      );
      if ("error" in result && result.error) {
        return res.status(result.error.status).json({ message: result.error.message });
      }
      res.json(result.updated);
    } catch (err: any) {
      console.error("[BRANCH_MARK_ATTENDED]", err.stack || err);
      res.status(500).json({ message: "Error al marcar asistencia" });
    }
  });

  app.post("/api/branch/bookings/:id/mark-no-show", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const result = await handleBranchBookingStatusChange(
        actor,
        getStringParam(req.params.id),
        "no_show",
        normalizeModerationText(req.body.reason),
      );
      if ("error" in result && result.error) {
        return res.status(result.error.status).json({ message: result.error.message });
      }
      res.json(result.updated);
    } catch (err: any) {
      console.error("[BRANCH_MARK_NO_SHOW]", err.stack || err);
      res.status(500).json({ message: "Error al marcar no asistencia" });
    }
  });

  app.get("/api/branch/bookings/history", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const logs = await storage.getReservationAuditLogs({ branchId: actor.branchId, limit });
      res.json(logs);
    } catch (err: any) {
      console.error("[BRANCH_BOOKING_HISTORY]", err.stack || err);
      res.status(500).json({ message: "Error al obtener el historial de reservas" });
    }
  });

  /* Legacy duplicate route disabled. The canonical /api/branch/bookings/:id/status
     handler is the earlier implementation backed by handleBranchBookingStatusChange.
  app.patch("/api/branch/bookings/:id/status", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const bookingId = req.params.id as string;
    try {
      const { status } = z.object({ status: z.enum(["confirmed", "cancelled", "attended", "no_show"]) }).parse(req.body);
      const existing = await storage.getBooking(bookingId);
      if (!existing || existing.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Reserva no encontrada" });
      }

      const alreadyProcessed = existing.status === "attended" || existing.status === "no_show";

      // Rule 1: Block "attended" if plan is expired
      if (status === "attended" && !alreadyProcessed) {
        const mem = await storage.getMembershipByUserAndBranch(existing.userId, actor.branchId);
        if (mem && mem.expiresAt && new Date(mem.expiresAt) < new Date()) {
          return res.status(400).json({ message: "Plan vencido. Renueva la membresía antes de marcar asistencia." });
        }
      }

      let lateCancellation = false;
      if (status === "cancelled" && existing.status === "confirmed") {
        // Rule 3: Cancellation cutoff — late cancel deducts like no_show
        const schedule = await storage.getClassSchedule(existing.classScheduleId);
        const branch = await storage.getBranch(actor.branchId);
        if (schedule && branch) {
          const cutoff = (branch as any).cancelCutoffMinutes ?? DEFAULT_CANCEL_CUTOFF_MINUTES;
          const bookingDateStr = existing.bookingDate;
          const classStart = new Date(`${bookingDateStr}T${schedule.startTime}:00`);
          const now = new Date();
          const diffMin = (classStart.getTime() - now.getTime()) / 60000;
          if (diffMin < cutoff) {
            lateCancellation = true;
          }
        }
      }

      const updated = await storage.updateBookingStatus(bookingId, status);

      if (lateCancellation) {
        await storage.markBookingLateCancellation(bookingId);
      }

      if (status === "attended" && !alreadyProcessed) {
        try {
          await storage.createAttendance({
            userId: existing.userId,
            branchId: actor.branchId,
            registeredBy: actor.id,
          });
        } catch (attErr: any) {
          console.error(`[BOOKINGS] Error creating attendance record:`, attErr.message);
        }
      }

      // Class deduction rules:
      // - attended: -1 class (if plan active and not unlimited)
      // - no_show: -1 class (if plan active and not unlimited)
      // - cancelled + lateCancellation: -1 class (treated as no_show)
      // - cancelled before cutoff: no deduction
      // - already processed (attended/no_show): no double deduction
      const shouldDeduct = !alreadyProcessed && (status === "attended" || status === "no_show" || (status === "cancelled" && lateCancellation));
      let classesRemaining: number | null = null;
      if (shouldDeduct) {
        const mem = await storage.getMembershipByUserAndBranch(existing.userId, actor.branchId);
        if (mem && mem.classesRemaining !== null && mem.classesRemaining > 0) {
          const decremented = await storage.decrementClassesRemaining(mem.id);
          classesRemaining = decremented?.classesRemaining ?? null;
        } else if (mem) {
          classesRemaining = mem.classesRemaining;
        }
      }

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_BOOKING_STATUS",
        branchId: actor.branchId,
        metadata: { bookingId, oldStatus: existing.status, newStatus: status, lateCancellation },
      });

      if (status === "cancelled" && existing.status !== "cancelled") {
        await createSystemEventSafe({
          eventType: "booking_cancelled",
          branchId: actor.branchId,
          userId: existing.userId,
          payload: {
            bookingId,
            classScheduleId: existing.classScheduleId,
            bookingDate: existing.bookingDate,
            source: "dashboard",
            lateCancellation,
          },
        });
      }

      console.log(`[BOOKINGS] Updated booking ${bookingId} status to ${status}${lateCancellation ? " (late cancel)" : ""} by ${actor.email}`);
      res.json({ ...updated, lateCancellation, classesRemaining });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[BOOKINGS] Error updating status:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar reserva" });
    }
  });

  */

  // --- Branch Content Management ---

  // Photos
  app.get("/api/branch/photos", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const photos = await storage.getBranchPhotos(user.branchId);
      res.json(photos);
    } catch (err: any) {
      console.error(`[PHOTOS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener fotos" });
    }
  });

  app.post("/api/branch/photos", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { type, url } = req.body;
      if (!type || !url) {
        return res.status(400).json({ message: "Se requiere type y url" });
      }
      if (!["profile", "facility"].includes(type)) {
        return res.status(400).json({ message: "Tipo inválido. Permitidos: profile, facility" });
      }

      const existing = await storage.getBranchPhotos(actor.branchId);
      const profilePhotos = existing.filter(p => p.type === "profile");
      const facilityPhotos = existing.filter(p => p.type === "facility");

      if (type === "profile" && profilePhotos.length >= 1) {
        return res.status(400).json({ message: "Solo se permite 1 foto de perfil. Elimina la actual primero." });
      }
      if (type === "facility" && facilityPhotos.length >= 5) {
        return res.status(400).json({ message: "Máximo 5 fotos de instalaciones permitidas" });
      }

      const displayOrder = type === "profile" ? 0 : facilityPhotos.length;
      const photo = await storage.addBranchPhoto({
        branchId: actor.branchId,
        type,
        url,
        displayOrder,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_PHOTO",
        branchId: actor.branchId,
        metadata: { photoId: photo.id, type },
      });

      console.log(`[PHOTOS] Added ${type} photo by ${actor.email}`);
      res.status(201).json(photo);
    } catch (err: any) {
      console.error(`[PHOTOS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al agregar foto" });
    }
  });

  app.delete("/api/branch/photos/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const photoId = req.params.id as string;
    try {
      const photos = await storage.getBranchPhotos(actor.branchId);
      const photo = photos.find(p => p.id === photoId);
      if (!photo) {
        return res.status(404).json({ message: "Foto no encontrada" });
      }

      await storage.deleteBranchPhoto(photoId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_PHOTO",
        branchId: actor.branchId,
        metadata: { photoId, type: photo.type },
      });

      console.log(`[PHOTOS] Deleted photo ${photoId} by ${actor.email}`);
      res.json({ message: "Foto eliminada" });
    } catch (err: any) {
      console.error(`[PHOTOS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar foto" });
    }
  });

  app.post("/api/branch/photos/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchPhotos(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[PHOTOS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar fotos" });
    }
  });

  // Posts
  app.get("/api/branch/posts", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const posts = await storage.getBranchPosts(user.branchId);
      res.json(posts);
    } catch (err: any) {
      console.error(`[POSTS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener posts" });
    }
  });

  app.post("/api/branch/posts", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { title, content, mediaUrl, mediaType } = req.body;
      if (!title || !content) {
        return res.status(400).json({ message: "Se requiere título y contenido" });
      }

      const existing = await storage.getBranchPosts(actor.branchId);
      if (existing.length >= 3) {
        return res.status(400).json({ message: "Máximo 3 posts fijos permitidos" });
      }

      if (mediaType && !["image", "video"].includes(mediaType)) {
        return res.status(400).json({ message: "Tipo de media inválido. Permitidos: image, video" });
      }

      const post = await storage.createBranchPost({
        branchId: actor.branchId,
        title,
        content,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        displayOrder: existing.length,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_POST",
        branchId: actor.branchId,
        metadata: { postId: post.id, title },
      });

      console.log(`[POSTS] Created "${title}" by ${actor.email}`);
      res.status(201).json(post);
    } catch (err: any) {
      console.error(`[POSTS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear post" });
    }
  });

  app.patch("/api/branch/posts/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const postId = req.params.id as string;
    try {
      const posts = await storage.getBranchPosts(actor.branchId);
      const post = posts.find(p => p.id === postId);
      if (!post) {
        return res.status(404).json({ message: "Post no encontrado" });
      }

      const { title, content, mediaUrl, mediaType } = req.body;
      if (mediaType && !["image", "video"].includes(mediaType)) {
        return res.status(400).json({ message: "Tipo de media inválido" });
      }

      const updated = await storage.updateBranchPost(postId, {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(mediaUrl !== undefined && { mediaUrl: mediaUrl || null }),
        ...(mediaType !== undefined && { mediaType: mediaType || null }),
      });

      console.log(`[POSTS] Updated "${postId}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[POSTS] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar post" });
    }
  });

  app.delete("/api/branch/posts/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const postId = req.params.id as string;
    try {
      const posts = await storage.getBranchPosts(actor.branchId);
      const post = posts.find(p => p.id === postId);
      if (!post) {
        return res.status(404).json({ message: "Post no encontrado" });
      }

      await storage.deleteBranchPost(postId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_POST",
        branchId: actor.branchId,
        metadata: { postId, title: post.title },
      });

      console.log(`[POSTS] Deleted "${post.title}" by ${actor.email}`);
      res.json({ message: "Post eliminado" });
    } catch (err: any) {
      console.error(`[POSTS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar post" });
    }
  });

  app.post("/api/branch/posts/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchPosts(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[POSTS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar posts" });
    }
  });

  // Services
  app.get("/api/branch/services", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const services = await storage.getBranchServices(user.branchId);
      res.json(services);
    } catch (err: any) {
      console.error("[BRANCH_SERVICES_LIST]", err.stack || err);
      res.status(500).json({ message: "Error al obtener servicios" });
    }
  });

  app.post("/api/branch/services", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const parsed = createBranchServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const existing = await storage.getBranchServices(user.branchId);
      const created = await storage.createBranchService({
        branchId: user.branchId,
        name: data.name.trim(),
        category: data.category.trim(),
        description: normalizeOptionalText(data.description) ?? null,
        baseDurationMinutes: data.baseDurationMinutes ?? null,
        capacity: data.capacity ?? null,
        requiresAgenda: data.requiresAgenda ?? false,
        visibility: data.visibility ?? "public",
        isActive: data.isActive ?? true,
        displayOrder: data.displayOrder ?? existing.length,
        createdBy: user.id,
      } as any);

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "CREATE_BRANCH_SERVICE",
        branchId: user.branchId,
        metadata: { serviceId: created.id, name: created.name },
      });

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[BRANCH_SERVICES_CREATE]", err.stack || err);
      res.status(500).json({ message: "Error al crear servicio" });
    }
  });

  app.patch("/api/branch/services/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const serviceId = getStringParam(req.params.id);
    const parsed = updateBranchServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const updated = await storage.updateBranchService(user.branchId, serviceId, {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.category !== undefined ? { category: data.category.trim() } : {}),
        ...(data.description !== undefined ? { description: normalizeOptionalText(data.description) ?? null } : {}),
        ...(data.baseDurationMinutes !== undefined ? { baseDurationMinutes: data.baseDurationMinutes ?? null } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity ?? null } : {}),
        ...(data.requiresAgenda !== undefined ? { requiresAgenda: data.requiresAgenda } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "Servicio no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "UPDATE_BRANCH_SERVICE",
        branchId: user.branchId,
        metadata: { serviceId: updated.id, name: updated.name },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[BRANCH_SERVICES_UPDATE]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar servicio" });
    }
  });

  app.delete("/api/branch/services/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const serviceId = getStringParam(req.params.id);

    try {
      const deleted = await storage.softDeleteBranchService(user.branchId, serviceId);
      if (!deleted) {
        return res.status(404).json({ message: "Servicio no encontrado" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "DELETE_BRANCH_SERVICE",
        branchId: user.branchId,
        metadata: { serviceId },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[BRANCH_SERVICES_DELETE]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar servicio" });
    }
  });

  app.post("/api/branch/services/:id/options", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const serviceId = getStringParam(req.params.id);
    const parsed = createBranchServiceSaleOptionSchema.safeParse({
      ...req.body,
      serviceId,
    });
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const services = await storage.getBranchServices(user.branchId);
      const service = services.find((item) => item.id === serviceId);
      if (!service) {
        return res.status(404).json({ message: "Servicio no encontrado" });
      }

      const data = parsed.data;
      const created = await storage.createBranchServiceSaleOption({
        branchId: user.branchId,
        serviceId,
        name: data.name.trim(),
        type: data.type,
        price: data.price.toFixed(2),
        includedUses: data.isUnlimited ? null : (data.includedUses ?? null),
        isUnlimited: data.isUnlimited ?? false,
        validityDays: data.validityDays ?? null,
        requiresRegisteredClient: data.type === "membresia" ? true : (data.requiresRegisteredClient ?? false),
        allowsWalkIn: data.type === "membresia" ? false : (data.allowsWalkIn ?? true),
        isPosFavorite: data.isPosFavorite ?? false,
        isActive: data.isActive ?? true,
        internalNotes: normalizeOptionalText(data.internalNotes) ?? null,
        displayOrder: data.displayOrder ?? service.options.length,
        createdBy: user.id,
      } as any);

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "CREATE_SERVICE_SALE_OPTION",
        branchId: user.branchId,
        metadata: { optionId: created.id, serviceId, name: created.name, type: created.type },
      });

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[BRANCH_SERVICE_OPTIONS_CREATE]", err.stack || err);
      res.status(500).json({ message: "Error al crear opcion de venta" });
    }
  });

  app.patch("/api/branch/service-options/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const optionId = getStringParam(req.params.id);
    const parsed = updateBranchServiceSaleOptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Datos invalidos", errors: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      let nextServiceId: string | undefined;
      if (data.serviceId !== undefined) {
        nextServiceId = data.serviceId;
        const services = await storage.getBranchServices(user.branchId);
        if (!services.some((item) => item.id === nextServiceId)) {
          return res.status(400).json({ message: "Servicio destino no encontrado" });
        }
      }

      const nextType = data.type;
      const updated = await storage.updateBranchServiceSaleOption(user.branchId, optionId, {
        ...(nextServiceId !== undefined ? { serviceId: nextServiceId } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.price !== undefined ? { price: data.price.toFixed(2) } : {}),
        ...(data.includedUses !== undefined ? { includedUses: data.includedUses ?? null } : {}),
        ...(data.isUnlimited !== undefined ? { isUnlimited: data.isUnlimited } : {}),
        ...(data.validityDays !== undefined ? { validityDays: data.validityDays ?? null } : {}),
        ...(data.requiresRegisteredClient !== undefined || nextType === "membresia"
          ? { requiresRegisteredClient: nextType === "membresia" ? true : (data.requiresRegisteredClient ?? false) }
          : {}),
        ...(data.allowsWalkIn !== undefined || nextType === "membresia"
          ? { allowsWalkIn: nextType === "membresia" ? false : (data.allowsWalkIn ?? true) }
          : {}),
        ...(data.isPosFavorite !== undefined ? { isPosFavorite: data.isPosFavorite } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.internalNotes !== undefined ? { internalNotes: normalizeOptionalText(data.internalNotes) ?? null } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "Opcion de venta no encontrada" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "UPDATE_SERVICE_SALE_OPTION",
        branchId: user.branchId,
        metadata: { optionId: updated.id, serviceId: updated.serviceId, name: updated.name, type: updated.type },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("[BRANCH_SERVICE_OPTIONS_UPDATE]", err.stack || err);
      res.status(500).json({ message: "Error al actualizar opcion de venta" });
    }
  });

  app.delete("/api/branch/service-options/:id", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    const optionId = getStringParam(req.params.id);
    try {
      const deleted = await storage.softDeleteBranchServiceSaleOption(user.branchId, optionId);
      if (!deleted) {
        return res.status(404).json({ message: "Opcion de venta no encontrada" });
      }

      await storage.createAuditLog({
        actorUserId: user.id,
        action: "DELETE_SERVICE_SALE_OPTION",
        branchId: user.branchId,
        metadata: { optionId },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[BRANCH_SERVICE_OPTIONS_DELETE]", err.stack || err);
      res.status(500).json({ message: "Error al eliminar opcion de venta" });
    }
  });

  // Products
  app.get("/api/branch/products", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const products = await storage.getBranchProducts(user.branchId);
      res.json(products);
    } catch (err: any) {
      console.error(`[PRODUCTS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener productos" });
    }
  });

  app.post("/api/branch/products", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { name, description, price, imageUrl, type, durationMinutes } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Se requiere nombre del producto" });
      }
      if (price === undefined || typeof price !== "number" || price < 0) {
        return res.status(400).json({ message: "Se requiere un precio válido" });
      }

      const existing = await storage.getBranchProducts(actor.branchId);
      const product = await storage.createBranchProduct({
        branchId: actor.branchId,
        name,
        description: description || null,
        price,
        imageUrl: imageUrl || null,
        type: type || "product",
        durationMinutes: durationMinutes || null,
        displayOrder: existing.length,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_PRODUCT",
        branchId: actor.branchId,
        metadata: { productId: product.id, name },
      });

      console.log(`[PRODUCTS] Created "${name}" by ${actor.email}`);
      res.status(201).json(product);
    } catch (err: any) {
      console.error(`[PRODUCTS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear producto" });
    }
  });

  app.patch("/api/branch/products/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const productId = req.params.id as string;
    try {
      const products = await storage.getBranchProducts(actor.branchId);
      const product = products.find(p => p.id === productId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      const { name, description, price, imageUrl, isActive, type, durationMinutes } = req.body;
      const updated = await storage.updateBranchProduct(productId, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(price !== undefined && { price }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(isActive !== undefined && { isActive }),
        ...(type !== undefined && { type }),
        ...(durationMinutes !== undefined && { durationMinutes: durationMinutes || null }),
      });

      console.log(`[PRODUCTS] Updated "${productId}" by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[PRODUCTS] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar producto" });
    }
  });

  app.delete("/api/branch/products/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const productId = req.params.id as string;
    try {
      const products = await storage.getBranchProducts(actor.branchId);
      const product = products.find(p => p.id === productId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      await storage.deleteBranchProduct(productId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_PRODUCT",
        branchId: actor.branchId,
        metadata: { productId, name: product.name },
      });

      console.log(`[PRODUCTS] Deleted "${product.name}" by ${actor.email}`);
      res.json({ message: "Producto eliminado" });
    } catch (err: any) {
      console.error(`[PRODUCTS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar producto" });
    }
  });

  app.post("/api/branch/products/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchProducts(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[PRODUCTS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar productos" });
    }
  });

  // Videos
  app.get("/api/branch/videos", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const videos = await storage.getBranchVideos(user.branchId);
      res.json(videos);
    } catch (err: any) {
      console.error(`[VIDEOS] Error listing:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener videos" });
    }
  });

  app.post("/api/branch/videos", requireBranchAdmin, (req, res) => {
    const actor = req.user as any;

    uploadVideo.single("video")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "El video no puede superar 25 MB" });
        }
        return res.status(400).json({ message: err.message || "Error al subir video" });
      }

      try {
        const { title, thumbnailUrl } = req.body as { title?: string; thumbnailUrl?: string };

        // Acepta archivo subido O URL externa (compatibilidad hacia atrás)
        let videoUrl: string | undefined;
        if (req.file) {
          videoUrl = `/uploads/${req.file.filename}`;
        } else if (req.body.url) {
          videoUrl = req.body.url;
        }

        if (!videoUrl) {
          return res.status(400).json({ message: "Se requiere un archivo de video o una URL" });
        }

        const existing = await storage.getBranchVideos(actor.branchId);
        if (existing.length >= 2) {
          // Si ya se subió el archivo, borrarlo para no dejar basura
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Tu plan actual permite máximo 2 videos" });
        }

        const video = await storage.addBranchVideo({
          branchId: actor.branchId,
          title: title || null,
          url: videoUrl,
          thumbnailUrl: thumbnailUrl || null,
          displayOrder: existing.length,
        });

        await storage.createAuditLog({
          actorUserId: actor.id,
          action: "CREATE_VIDEO",
          branchId: actor.branchId,
          metadata: { videoId: video.id, title: title || "Sin título" },
        });

        console.log(`[VIDEOS] Added video by ${actor.email} → ${videoUrl}`);
        res.status(201).json(video);
      } catch (err: any) {
        console.error(`[VIDEOS] Error creating:`, err.stack || err);
        res.status(500).json({ message: "Error al agregar video" });
      }
    });
  });

  app.delete("/api/branch/videos/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const videoId = req.params.id as string;
    try {
      const videos = await storage.getBranchVideos(actor.branchId);
      const video = videos.find(v => v.id === videoId);
      if (!video) {
        return res.status(404).json({ message: "Video no encontrado" });
      }

      await storage.deleteBranchVideo(videoId);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_VIDEO",
        branchId: actor.branchId,
        metadata: { videoId, title: video.title },
      });

      console.log(`[VIDEOS] Deleted video ${videoId} by ${actor.email}`);
      res.json({ message: "Video eliminado" });
    } catch (err: any) {
      console.error(`[VIDEOS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar video" });
    }
  });

  app.post("/api/branch/videos/reorder", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Se requiere un array de ids" });
      }
      await storage.reorderBranchVideos(actor.branchId, ids);
      res.json({ message: "Orden actualizado" });
    } catch (err: any) {
      console.error(`[VIDEOS] Error reordering:`, err.stack || err);
      res.status(500).json({ message: "Error al reordenar videos" });
    }
  });

  // --- TV Mode ---
  app.get("/api/branch/tv-data", requireBranchAdmin, async (req, res) => {
    const user = req.user as any;
    try {
      const date = (req.query.date as string) || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const data = await storage.getTvModeData(user.branchId, date);
      res.json(data);
    } catch (err: any) {
      console.error(`[TV_MODE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener datos de TV Mode" });
    }
  });

  app.patch("/api/branch/classes/:id/routine", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    const classId = req.params.id;
    try {
      const schedule = await storage.getClassSchedule(classId);
      if (!schedule || schedule.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const { routineDescription, routineImageUrl } = req.body;
      if (routineDescription !== undefined && routineDescription !== null && typeof routineDescription !== "string") {
        return res.status(400).json({ message: "routineDescription debe ser texto o null" });
      }
      if (routineImageUrl !== undefined && routineImageUrl !== null && typeof routineImageUrl !== "string") {
        return res.status(400).json({ message: "routineImageUrl debe ser texto o null" });
      }

      const updated = await storage.updateClassRoutine(
        classId,
        typeof routineDescription === "string" ? routineDescription : null,
        typeof routineImageUrl === "string" ? routineImageUrl : null
      );

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_CLASS_ROUTINE",
        branchId: actor.branchId,
        metadata: { classId, className: schedule.name },
      });

      console.log(`[TV_MODE] Updated routine for class ${schedule.name} by ${actor.email}`);
      res.json(updated);
    } catch (err: any) {
      console.error(`[TV_MODE] Error updating routine:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar rutina" });
    }
  });

  app.patch("/api/branch/profile", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { name, description, address, city, googleMapsUrl, operatingHours, locations, summaryHours, category, subcategory, searchKeywords, latitude, longitude, whatsappNumber } = req.body;
      const normalizedName = normalizeOptionalText(name);

      if (name !== undefined) {
        if (!normalizedName) {
          return res.status(400).json({ message: "Nombre de sucursal inválido" });
        }

        if (normalizedName.length > 160) {
          return res.status(400).json({ message: "El nombre de la sucursal es demasiado largo" });
        }
      }

      // Normalize whatsappNumber: keep only digits, validate length
      let normalizedWhatsapp: string | null | undefined = undefined;
      const normalizedSubcategory = normalizeOptionalText(subcategory);
      const normalizedSearchKeywords = normalizeSearchKeywords(searchKeywords);
      if (whatsappNumber !== undefined) {
        if (!whatsappNumber) {
          normalizedWhatsapp = null;
        } else {
          const digits = String(whatsappNumber).replace(/\D/g, "");
          if (digits.length < 7 || digits.length > 15) {
            return res.status(400).json({ message: "Número de WhatsApp inválido (7-15 dígitos)" });
          }
          normalizedWhatsapp = digits;
        }
      }
      const updated = await storage.updateBranchProfile(actor.branchId, {
        ...(name !== undefined && { name: normalizedName }),
        ...(description !== undefined && { description }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(googleMapsUrl !== undefined && { googleMapsUrl }),
        ...(operatingHours !== undefined && { operatingHours }),
        ...(locations !== undefined && { locations }),
        ...(summaryHours !== undefined && { summaryHours: normalizeOptionalText(summaryHours) }),
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory: normalizedSubcategory }),
        ...(searchKeywords !== undefined && { searchKeywords: normalizedSearchKeywords }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(normalizedWhatsapp !== undefined && { whatsappNumber: normalizedWhatsapp }),
      });
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_BRANCH_PROFILE",
        branchId: actor.branchId,
        metadata: { fields: Object.keys(req.body) },
      });
      res.json(updated);
    } catch (err: any) {
      console.error(`[BRANCH_PROFILE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al actualizar perfil" });
    }
  });

  app.get("/api/public/branch/:slug/reviews", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const [reviews, summary] = await Promise.all([
        storage.getBranchReviews(branch.id),
        storage.getBranchReviewsSummary(branch.id),
      ]);
      res.json({ reviews, ...summary });
    } catch (err: any) {
      console.error(`[REVIEWS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reseñas" });
    }
  });

  app.get("/api/public/branch/:slug/my-review", async (req, res) => {
    if (!req.isAuthenticated()) return res.json({ review: null });
    try {
      const actor = req.user as any;
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const review = await storage.getUserReview(branch.id, actor.id);
      res.json({ review });
    } catch (err: any) {
      console.error(`[MY-REVIEW] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reseña" });
    }
  });

  app.post("/api/public/branch/:slug/reviews", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "No autenticado" });
    try {
      const actor = req.user as any;
      if (actor.role === "CUSTOMER" && actor.isBlocked) {
        return res.status(403).json({ message: CUSTOMER_BLOCKED_MESSAGE });
      }
      const branch = await storage.getBranchBySlug(getStringParam(req.params.slug));
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const localBlockMessage = await getActiveBranchBlockMessage(actor.id, branch.id);
      if (localBlockMessage) {
        return res.status(403).json({ message: localBlockMessage });
      }
      const existingReview = await storage.getUserReview(branch.id, actor.id);
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Calificación inválida (1-5)" });
      }
      const review = await storage.createOrUpdateReview(branch.id, actor.id, Number(rating), comment || null);
      if (!existingReview) {
        await createSystemEventSafe({
          eventType: "review_created",
          branchId: branch.id,
          userId: actor.id,
          payload: {
            reviewId: review.id,
            rating: Number(rating),
          },
        });
      }
      res.json({ review });
    } catch (err: any) {
      console.error(`[POST-REVIEW] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al guardar reseña" });
    }
  });

  app.post("/api/public/branch/:slug/reviews/:id/report", requireAuth, async (req, res) => {
    const actor = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(getStringParam(req.params.slug));
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const reviewId = getStringParam(req.params.id);
      const payload = createReviewReportSchema.parse(req.body);
      const review = await storage.getBranchReviewById(reviewId);
      if (!review || review.branchId !== branch.id) {
        return res.status(404).json({ message: "Reseña no encontrada" });
      }

      const report = await storage.createReviewReport({
        reviewId,
        branchId: branch.id,
        reporterUserId: actor.id,
        reportedByRole: actor.role || "CUSTOMER",
        reason: payload.reason,
        note: normalizeModerationText(payload.note),
      });

      await storage.createReviewModerationLog({
        reviewId,
        action: "reported_by_customer",
        actorUserId: actor.id,
        reason: payload.reason,
        metadata: { reportId: report.id },
      });

      res.status(201).json(report);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error("[PUBLIC_REVIEW_REPORT]", err.stack || err);
      res.status(500).json({ message: "Error al reportar la reseña" });
    }
  });

  app.get("/api/branch/reviews", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const [reviews, summary] = await Promise.all([
        storage.getBranchReviews(actor.branchId),
        storage.getBranchReviewsSummary(actor.branchId),
      ]);
      res.json({ reviews, ...summary });
    } catch (err: any) {
      console.error(`[REVIEWS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reseñas" });
    }
  });

  app.post("/api/branch/reviews/:id/reply", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const reviewId = getStringParam(req.params.id);
      const payload = updateReviewReplySchema.parse(req.body);
      const review = await storage.getBranchReviewById(reviewId);
      if (!review || review.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Reseña no encontrada" });
      }

      const updated = await storage.updateReviewReply(reviewId, normalizeModerationText(payload.adminReply));
      await storage.createReviewModerationLog({
        reviewId,
        action: normalizeModerationText(payload.adminReply) ? "reply_updated" : "reply_deleted",
        actorUserId: actor.id,
        reason: null,
        metadata: { branchId: actor.branchId },
      });
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error("[BRANCH_REVIEW_REPLY]", err.stack || err);
      res.status(500).json({ message: "Error al responder la reseña" });
    }
  });

  app.post("/api/branch/reviews/:id/report", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const reviewId = getStringParam(req.params.id);
      const payload = createReviewReportSchema.parse(req.body);
      const review = await storage.getBranchReviewById(reviewId);
      if (!review || review.branchId !== actor.branchId) {
        return res.status(404).json({ message: "Reseña no encontrada" });
      }

      const report = await storage.createReviewReport({
        reviewId,
        branchId: actor.branchId,
        reporterUserId: actor.id,
        reportedByRole: "BRANCH_ADMIN",
        reason: payload.reason,
        note: normalizeModerationText(payload.note),
      });

      await storage.createReviewModerationLog({
        reviewId,
        action: "reported_by_branch",
        actorUserId: actor.id,
        reason: payload.reason,
        metadata: { reportId: report.id },
      });

      res.status(201).json(report);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error("[BRANCH_REVIEW_REPORT]", err.stack || err);
      res.status(500).json({ message: "Error al reportar la reseña" });
    }
  });

  app.get("/api/branch/notification-jobs", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const status = typeof req.query.status === "string" ? req.query.status.trim() || undefined : undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const jobs = await storage.getNotificationJobs({ branchId: actor.branchId, status, limit });
      res.json(jobs);
    } catch (err: any) {
      console.error("[BRANCH_NOTIFICATION_JOBS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener jobs internos" });
    }
  });

  // --- WhatsApp Templates ---
  app.get("/api/branch/whatsapp-templates", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const branch = await storage.getBranch(actor.branchId);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const defaults: Record<string, string> = {
        expired_membership: "Hola {firstName}, tu membresía en {branchName} ha vencido. ¡Renueva para seguir entrenando!",
        expiring_membership: "Hola {firstName}, tu membresía en {branchName} vence pronto ({expiresAt}). ¡Renueva a tiempo!",
        no_classes: "Hola {firstName}, te has quedado sin clases disponibles en {branchName}. Contacta al estudio para renovar.",
        birthday_greeting: "Hola {firstName}, todo el equipo de {branchName} te desea un feliz cumpleaños. Te esperamos pronto!",
        plan_renewal: "Hola {firstName}, tu renovación en {branchName} quedó lista. Tu plan {planName} ya está activo y vence el {expiresAt}. ¡Gracias por continuar con nosotros!",
      };
      const saved = (branch as any).whatsappTemplates || {};
      res.json({ ...defaults, ...saved });
    } catch (err: any) {
      console.error(`[WHATSAPP_TEMPLATES] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener plantillas" });
    }
  });

  app.patch("/api/branch/whatsapp-templates", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const templates = req.body;
      if (!templates || typeof templates !== "object") {
        return res.status(400).json({ message: "Datos inválidos" });
      }
      const allowed = ["expired_membership", "expiring_membership", "no_classes", "booking_confirmed", "birthday_greeting", "plan_renewal"];
      const filtered: Record<string, string> = {};
      for (const key of allowed) {
        if (typeof templates[key] === "string" && templates[key].trim().length > 0) {
          filtered[key] = templates[key].trim();
        }
      }
      await storage.updateBranchWhatsappTemplates(actor.branchId, filtered);
      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "UPDATE_WHATSAPP_TEMPLATES",
        branchId: actor.branchId,
        metadata: { keys: Object.keys(filtered) },
      });
      res.json(filtered);
    } catch (err: any) {
      console.error(`[WHATSAPP_TEMPLATES] Error updating:`, err.stack || err);
      res.status(500).json({ message: "Error al guardar plantillas" });
    }
  });

  // --- Announcements ---
  app.get("/api/branch/announcements", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const announcements = await storage.getBranchAnnouncements(actor.branchId);
      res.json(announcements);
    } catch (err: any) {
      console.error(`[ANNOUNCEMENTS] Error fetching:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener anuncios" });
    }
  });

  app.post("/api/branch/announcements", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const { message, imageUrl } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "El mensaje es requerido" });
      }
      if (message.length > 500) {
        return res.status(400).json({ message: "El mensaje no puede tener más de 500 caracteres" });
      }

      await storage.deactivateAllAnnouncements(actor.branchId);

      const announcement = await storage.createAnnouncement({
        branchId: actor.branchId,
        message: message.trim(),
        imageUrl: imageUrl || null,
        isActive: true,
      });

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "CREATE_ANNOUNCEMENT",
        branchId: actor.branchId,
        metadata: { announcementId: announcement.id },
      });

      res.json(announcement);
    } catch (err: any) {
      console.error(`[ANNOUNCEMENTS] Error creating:`, err.stack || err);
      res.status(500).json({ message: "Error al crear anuncio" });
    }
  });

  app.delete("/api/branch/announcements/:id", requireBranchAdmin, async (req, res) => {
    const actor = req.user as any;
    try {
      const announcements = await storage.getBranchAnnouncements(actor.branchId);
      const target = announcements.find(a => a.id === req.params.id);
      if (!target) {
        return res.status(404).json({ message: "Anuncio no encontrado" });
      }

      await storage.deleteAnnouncement(req.params.id);

      await storage.createAuditLog({
        actorUserId: actor.id,
        action: "DELETE_ANNOUNCEMENT",
        branchId: actor.branchId,
        metadata: { announcementId: req.params.id },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error(`[ANNOUNCEMENTS] Error deleting:`, err.stack || err);
      res.status(500).json({ message: "Error al eliminar anuncio" });
    }
  });

  // --- Public ---
  app.get("/api/public/branch/:slug/announcements", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const all = await storage.getBranchAnnouncements(branch.id);
      const active = all.filter(a => a.isActive);
      res.json(active);
    } catch (err: any) {
      console.error(`[PUBLIC_ANNOUNCEMENTS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener anuncios" });
    }
  });

  app.get("/api/public/branch/:slug/content", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const [photos, posts, products, videos] = await Promise.all([
        storage.getBranchPhotos(branch.id),
        storage.getBranchPosts(branch.id),
        storage.getBranchProducts(branch.id),
        storage.getBranchVideos(branch.id),
      ]);

      const activeProducts = products.filter(p => p.isActive);

      res.json({
        photos,
        posts,
        products: activeProducts,
        videos,
      });
    } catch (err: any) {
      console.error(`[PUBLIC_CONTENT] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener contenido" });
    }
  });

  app.get("/api/public/branch/:slug", async (req, res) => {
    const branch = await storage.getBranchBySlug(req.params.slug);
    if (!branch || branch.deletedAt) {
      return res.status(404).json({ message: "Sucursal no encontrada" });
    }
    if (branch.status !== "active") {
      return res.status(403).json({ message: "Servicio no activo" });
    }
    res.json(branch);
  });

  // --- Public: Schedule & Client Bookings ---
  app.get("/api/public/branch/:slug/schedule", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const schedules = await storage.getBranchClassSchedules(branch.id);
      const activeSchedules = schedules.filter(s => s.isActive);

      const date = req.query.date as string | undefined;
      let spotsMap: Record<string, number> = {};
      if (date) {
        const allBookings = await storage.getBookingsForDate(branch.id, date);
        const activeBookings = allBookings.filter((b: any) => b.status !== "cancelled" && b.status !== "no_show");
        for (const b of activeBookings) {
          spotsMap[b.classScheduleId] = (spotsMap[b.classScheduleId] || 0) + 1;
        }
      }

      res.json({
        schedules: activeSchedules,
        cancelCutoffMinutes: branch.cancelCutoffMinutes ?? DEFAULT_CANCEL_CUTOFF_MINUTES,
        spotsTaken: spotsMap,
      });
    } catch (err: any) {
      console.error(`[PUBLIC_SCHEDULE] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener horario" });
    }
  });

  app.get("/api/public/branch/:slug/my-bookings", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
      if (!mem || mem.status !== "active") {
        return res.json({ bookings: [], membership: null });
      }
      const allBookings = await storage.getBookingsForDate(branch.id, req.query.date as string || new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }));
      const myBookings = allBookings.filter((b: any) => b.userId === user.id);
      res.json({
        bookings: myBookings,
        membership: {
          id: mem.id,
          planId: mem.planId,
          classesRemaining: mem.classesRemaining,
          classesTotal: mem.classesTotal,
          expiresAt: mem.expiresAt,
          membershipStartDate: mem.membershipStartDate,
          membershipEndDate: mem.membershipEndDate,
          clientStatus: mem.clientStatus,
        },
      });
    } catch (err: any) {
      console.error(`[PUBLIC_MY_BOOKINGS] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reservas" });
    }
  });

  app.get("/api/public/branch/:slug/my-upcoming-bookings", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
      if (!mem || mem.status !== "active") {
        return res.json([]);
      }
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const bookings = await storage.getUpcomingBookingsForUser(branch.id, user.id, today, 5);
      res.json(bookings);
    } catch (err: any) {
      console.error(`[PUBLIC_UPCOMING] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al obtener reservas" });
    }
  });

  app.post("/api/public/branch/:slug/book", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt || branch.status !== "active") {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      const localBlockMessage = await getActiveBranchBlockMessage(user.id, branch.id);
      if (localBlockMessage) {
        return res.status(403).json({ message: localBlockMessage });
      }

      const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
      if (!mem || mem.status !== "active") {
        return res.status(403).json({ message: "Debes ser miembro para reservar" });
      }
      if (mem.clientStatus === "frozen") {
        return res.status(403).json({ message: "Tu membresía está congelada" });
      }
      if (mem.clientStatus === "inactive") {
        return res.status(403).json({ message: "Tu membresía está inactiva" });
      }
      if (mem.expiresAt && new Date(mem.expiresAt) < new Date()) {
        return res.status(403).json({ message: "Tu membresía ha vencido" });
      }
      if (mem.classesRemaining !== null && mem.classesRemaining <= 0) {
        return res.status(403).json({ message: "No tienes clases disponibles" });
      }

      const { classScheduleId, bookingDate } = createBookingSchema.omit({ userId: true }).parse(req.body);
      const schedule = await storage.getClassSchedule(classScheduleId);
      if (!schedule || schedule.branchId !== branch.id || !schedule.isActive) {
        return res.status(404).json({ message: "Clase no encontrada" });
      }

      const bookingAttempt = await storage.createBookingAtomically({
        classScheduleId,
        branchId: branch.id,
        userId: user.id,
        bookingDate,
        source: "app",
        requireActiveSchedule: true,
        excludeNoShowFromCapacity: true,
      });

      if (bookingAttempt.error === "CLASS_NOT_FOUND") {
        return res.status(404).json({ message: "Clase no encontrada" });
      }
      if (bookingAttempt.error === "CLASS_FULL") {
        return res.status(400).json({ message: "Clase llena" });
      }
      if (bookingAttempt.error === "ALREADY_BOOKED") {
        return res.status(400).json({ message: "Ya tienes reserva en esta clase" });
      }

      const booking = bookingAttempt.booking!;

      await createSystemEventSafe({
        eventType: "booking_created",
        branchId: branch.id,
        userId: user.id,
        payload: {
          bookingId: booking.id,
          classScheduleId,
          bookingDate,
          source: "app",
        },
      });

      await createReservationAuditSafe({
        bookingId: booking.id,
        branchId: branch.id,
        customerUserId: user.id,
        actorUserId: user.id,
        actorRole: user.role,
        action: "created",
        source: "app",
        metadata: {
          classScheduleId,
          bookingDate,
        },
      });

      await scheduleBookingReminderJobSafe({
        bookingId: booking.id,
        branchId: branch.id,
        userId: user.id,
        classScheduleId,
        bookingDate,
      });

      res.status(201).json(booking);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PUBLIC_BOOK] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al crear reserva" });
    }
  });

  app.post("/api/public/branch/:slug/cancel-booking", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      const branch = await storage.getBranchBySlug(req.params.slug as string);
      if (!branch || branch.deletedAt) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const { bookingId } = z.object({ bookingId: z.string().min(1) }).parse(req.body);
      const booking = await storage.getBooking(bookingId);
      if (!booking || booking.userId !== user.id || booking.branchId !== branch.id) {
        return res.status(404).json({ message: "Reserva no encontrada" });
      }
      if (booking.status !== "confirmed") {
        return res.status(400).json({ message: "Solo puedes cancelar reservas confirmadas" });
      }

      const schedule = await storage.getClassSchedule(booking.classScheduleId);
      const cutoff = branch.cancelCutoffMinutes ?? DEFAULT_CANCEL_CUTOFF_MINUTES;
      let lateCancellation = false;

      if (schedule) {
        const classStart = new Date(`${booking.bookingDate}T${schedule.startTime}:00`);
        const diffMin = (classStart.getTime() - Date.now()) / 60000;
        if (diffMin < cutoff) {
          lateCancellation = true;
        }
      }

      await storage.updateBookingStatus(bookingId, "cancelled");
      if (lateCancellation) {
        await storage.markBookingLateCancellation(bookingId);
        const mem = await storage.getMembershipByUserAndBranch(user.id, branch.id);
        if (mem && mem.classesRemaining !== null && mem.classesRemaining > 0) {
          await storage.decrementClassesRemaining(mem.id);
        }
      }

      await createSystemEventSafe({
        eventType: "booking_cancelled",
        branchId: branch.id,
        userId: user.id,
        payload: {
          bookingId,
          classScheduleId: booking.classScheduleId,
          bookingDate: booking.bookingDate,
          source: "app",
          lateCancellation,
        },
      });

      await createReservationAuditSafe({
        bookingId,
        branchId: branch.id,
        customerUserId: user.id,
        actorUserId: user.id,
        actorRole: user.role,
        action: "cancelled",
        source: "app",
        metadata: {
          classScheduleId: booking.classScheduleId,
          bookingDate: booking.bookingDate,
          lateCancellation,
        },
      });

      res.json({ success: true, lateCancellation });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error(`[PUBLIC_CANCEL] Error:`, err.stack || err);
      res.status(500).json({ message: "Error al cancelar reserva" });
    }
  });

  // --- Marketplace: Nearby / Search ---
  app.get("/api/branches/ranking", async (_req, res) => {
    try {
      const ranking = await storage.getBranchRanking();
      res.json(ranking);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/search/filters", async (req, res) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category.trim() || undefined : undefined;
      const [categories, subcategories] = await Promise.all([
        storage.listPublicCategories(),
        category ? storage.listPublicSubcategories(category) : Promise.resolve([]),
      ]);

      res.json({
        categories,
        subcategories,
      });
    } catch (err: any) {
      console.error("[SEARCH_FILTERS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener filtros de bÃºsqueda" });
    }
  });

  app.get("/api/search/suggestions", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.json([]);
    }

    try {
      const suggestions = await storage.getSearchSuggestions(q, 10);
      res.json(suggestions);
    } catch (err: any) {
      console.error("[SEARCH_SUGGESTIONS]", err.stack || err);
      res.status(500).json({ message: "Error al obtener sugerencias" });
    }
  });

  app.post("/api/search/select", async (req, res) => {
    try {
      const payload = z.object({
        logId: z.string().min(1),
        branchId: z.string().min(1),
      }).parse(req.body);

      const updated = await storage.updateSearchLogSelection(payload.logId, payload.branchId);
      if (!updated) {
        return res.status(404).json({ message: "Búsqueda no encontrada" });
      }
      res.json({ ok: true });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Datos inválidos" });
      }
      console.error("[SEARCH_SELECT]", err.stack || err);
      res.status(500).json({ message: "Error al registrar la selección" });
    }
  });

  app.get("/api/branches/nearby", async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const category = typeof req.query.category === "string" ? req.query.category.trim() || undefined : undefined;
    const subcategory = typeof req.query.subcategory === "string" ? req.query.subcategory.trim() || undefined : undefined;
    const zone = typeof req.query.zone === "string" ? req.query.zone.trim() || undefined : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() || undefined : undefined;

    try {
      const globalSettings = await storage.listAppSettings("global");
      const settingsMap = new Map(globalSettings.map((setting) => [setting.key, setting.valueJson]));
      const defaultRadiusSetting = settingsMap.get("search.default_radius_km");
      const maxRadiusSetting = settingsMap.get("search.max_radius_km");
      const readKmSetting = (value: unknown, fallback: number) => {
        if (typeof value === "number") return value;
        if (value && typeof value === "object" && "km" in value && typeof (value as any).km === "number") {
          return (value as any).km as number;
        }
        return fallback;
      };
      const defaultRadiusKm = readKmSetting(defaultRadiusSetting, 50);
      const maxRadiusKm = readKmSetting(maxRadiusSetting, 100);
      const requestedRadiusKm = req.query.radius_km ? parseFloat(req.query.radius_km as string) : defaultRadiusKm;
      const radiusKm = Math.min(Math.max(Number.isFinite(requestedRadiusKm) ? requestedRadiusKm : defaultRadiusKm, 1), maxRadiusKm);

      const results = await storage.searchBranchesNearby({ lat, lng, radiusKm, category, subcategory, zone, q });

      if (q || category) {
        try {
          await storage.createSearchLog({
            userId: req.isAuthenticated?.() ? (req.user as any)?.id ?? null : null,
            queryRaw: q ?? null,
            queryNormalized: q ? normalizeSearchText(q) : null,
            category: category ?? null,
            subcategory: subcategory ?? null,
            lat: lat ?? null,
            lng: lng ?? null,
            zone: zone ?? null,
            resultCount: results.length,
            source: inferSearchSource(req),
          });
        } catch (logErr: any) {
          console.error("[SEARCH_LOGS] Failed to persist search log:", logErr?.stack || logErr);
        }
      }

      res.json(results);
    } catch (err: any) {
      console.error("[BRANCHES_NEARBY]", err.stack || err);
      res.status(500).json({ message: "Error al buscar sucursales" });
    }
  });

  // --- Memberships ---
  app.get("/api/memberships", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = await storage.getUserMemberships(user.id);
    res.json(result);
  });

  app.post("/api/memberships/join", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = joinBranchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos" });
    }

    let branch;
    if (result.data.branchSlug) {
      branch = await storage.getBranchBySlug(result.data.branchSlug);
    } else if (result.data.branchId) {
      branch = await storage.getBranch(result.data.branchId);
    }

    if (!branch || branch.deletedAt) {
      return res.status(404).json({ message: "Sucursal no encontrada" });
    }
    if (branch.status !== "active") {
      return res.status(403).json({ message: "Sucursal no activa" });
    }
    const localBlockMessage = await getActiveBranchBlockMessage(user.id, branch.id);
    if (localBlockMessage) {
      return res.status(403).json({ message: localBlockMessage });
    }

      const existing = await storage.getMembership(user.id, branch.id);
      if (existing) {
        if (existing.status === "banned") {
          return res.status(403).json({ message: "No puedes unirte a esta sucursal" });
        }
        if (existing.status === "left") {
          const updated = await storage.updateMembership(existing.id, { status: "active", source: "self_join" });
          await notifyBranchCustomerJoinedFromApp(branch.id, user.id);
          return res.json(updated);
        }
        return res.json(existing);
      }

    const joinLinkResult = await maybeLinkExistingBranchClientToAuthenticatedUser(user, branch.id, "join");
    if (joinLinkResult.blocked) {
      return res.status(409).json(joinLinkResult.blocked);
    }
    if (joinLinkResult.membership) {
      await notifyBranchCustomerJoinedFromApp(branch.id, user.id);
      return res.status(201).json(joinLinkResult.membership);
    }

    const membership = await storage.createMembership({
      userId: user.id,
      branchId: branch.id,
      status: "active",
      isFavorite: false,
      source: "self_join",
    });
    await notifyBranchCustomerJoinedFromApp(branch.id, user.id);
    res.status(201).json(membership);
  });

  app.post("/api/memberships/leave", requireAuth, async (req, res) => {
    const user = req.user as any;
    const { branchSlug } = req.body;
    if (!branchSlug || typeof branchSlug !== "string") {
      return res.status(400).json({ message: "branchSlug requerido" });
    }
    try {
      const branch = await storage.getBranchBySlug(branchSlug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const existing = await storage.getMembership(user.id, branch.id);
      if (!existing || existing.status !== "active") {
        return res.status(400).json({ message: "No eres miembro activo de esta sucursal" });
      }
      const updated = await storage.updateMembership(existing.id, { status: "left" });
      return res.json(updated);
    } catch (err: any) {
      console.error("[LEAVE]", err.stack || err);
      res.status(500).json({ message: "Error al salir de la sucursal" });
    }
  });

  app.post("/api/memberships/favorite", requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = favoriteBranchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Datos inválidos" });
    }

    const branch = await storage.getBranch(result.data.branchId);
    if (!branch || branch.deletedAt || branch.status !== "active") {
      return res.status(403).json({ message: "Sucursal no disponible" });
    }
    const localBlockMessage = await getActiveBranchBlockMessage(user.id, branch.id);
    if (localBlockMessage) {
      return res.status(403).json({ message: localBlockMessage });
    }

    const existing = await storage.getMembership(user.id, branch.id);
    if (existing) {
      if (existing.status === "banned") {
        return res.status(403).json({ message: "No puedes interactuar con esta sucursal" });
      }
      const updated = await storage.updateMembership(existing.id, {
        isFavorite: result.data.isFavorite,
        status: existing.status === "left" ? "active" : existing.status,
      });
      return res.json(updated);
    }

    if (result.data.isFavorite) {
      const favoriteLinkResult = await maybeLinkExistingBranchClientToAuthenticatedUser(user, branch.id, "favorite");
      if (favoriteLinkResult.blocked) {
        return res.status(409).json(favoriteLinkResult.blocked);
      }
      if (favoriteLinkResult.membership) {
        const updatedLinkedMembership = await storage.updateMembership(favoriteLinkResult.membership.id, {
          isFavorite: true,
          status:
            favoriteLinkResult.membership.status === "left"
              ? "active"
              : favoriteLinkResult.membership.status,
        });
        await notifyBranchCustomerJoinedFromApp(branch.id, user.id);
        return res.status(201).json(updatedLinkedMembership || favoriteLinkResult.membership);
      }

      const membership = await storage.createMembership({
        userId: user.id,
        branchId: branch.id,
        status: "active",
        isFavorite: true,
        source: "self_join",
      });
      await notifyBranchCustomerJoinedFromApp(branch.id, user.id);
      return res.status(201).json(membership);
    }

    return res.json({ message: "No membership to update" });
  });

  const shouldRunSeed = process.env.RUN_SEED === "true" || process.env.NODE_ENV !== "production";
  if (shouldRunSeed) {
    try {
      await seedDatabase();
    } catch (e) {
      console.error("Seed error:", e);
    }
  }

  // Branch info endpoint (includes whatsappNumber)
  app.get("/api/branch/info", requireAuth, requireRole("BRANCH_ADMIN"), async (req, res) => {
    try {
      const user = req.user as any;
      const branch = await storage.getBranch(user.branchId);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      res.json({ whatsappNumber: (branch as any).whatsappNumber || null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── PROMOTIONS ──────────────────────────────────────────────────────────────

  // Public: global promotions (all customers, no auth required)
  app.get("/api/promotions/global", async (_req, res) => {
    try {
      const promos = await storage.getGlobalPromotions();
      res.json(promos);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public: active promotions for a specific branch
  app.get("/api/public/branch/:slug/promotions", async (req, res) => {
    try {
      const branch = await storage.getBranchBySlug(req.params.slug);
      if (!branch) return res.status(404).json({ message: "Sucursal no encontrada" });
      const promos = await storage.getBranchActivePromotions(branch.id);
      res.json(promos);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: get all promotions for own branch
  app.get("/api/branch/promotions", requireAuth, requireRole("BRANCH_ADMIN"), async (req, res) => {
    try {
      const user = req.user as any;
      const branchId = user.branchId;
      if (!branchId) return res.status(400).json({ message: "Sin sucursal" });
      const promos = await storage.getBranchPromotions(branchId);
      res.json(promos);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: create promotion (with optional image)
  app.post("/api/promotions", requireAuth, requireRole("BRANCH_ADMIN"), upload.single("image"), async (req, res) => {
    try {
      const user = req.user as any;
      const branchId = user.branchId;
      if (!branchId) return res.status(400).json({ message: "Sin sucursal" });
      const { title, description, startDate, endDate, isGlobal } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ message: "El título es requerido" });
      let imageUrl: string | undefined;
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }
      const promo = await storage.createPromotion({
        branchId,
        title: title.trim(),
        description: description?.trim() || null,
        imageUrl: imageUrl || null,
        startDate: startDate || null,
        endDate: endDate || null,
        isActive: true,
        isGlobal: isGlobal === "true" || isGlobal === true,
      });
      await createSystemEventSafe({
        eventType: "promotion_created",
        branchId,
        userId: user.id,
        payload: {
          promotionId: promo.id,
          title: promo.title,
          isGlobal: promo.isGlobal,
        },
      });

      await createNotificationJobSafe({
        type: "promotion_created",
        branchId,
        userId: user.id,
        scheduledFor: new Date(),
        payload: {
          promotionId: promo.id,
          title: promo.title,
          isGlobal: promo.isGlobal,
        },
      });

      res.status(201).json(promo);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: update promotion (toggle active, global, edit fields)
  app.patch("/api/promotions/:id", requireAuth, requireRole("BRANCH_ADMIN"), async (req, res) => {
    try {
      const user = req.user as any;
      const branchId = user.branchId;
      const promotionId = getStringParam(req.params.id);
      if (!branchId) return res.status(400).json({ message: "Sin sucursal" });
      const { isActive, isGlobal, title, description, startDate, endDate } = req.body;
      const updateData: Record<string, any> = {};
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isGlobal !== undefined) updateData.isGlobal = isGlobal;
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      const updated = await storage.updatePromotion(promotionId, branchId, updateData);
      if (!updated) return res.status(404).json({ message: "Promoción no encontrada" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: delete promotion
  app.delete("/api/promotions/:id", requireAuth, requireRole("BRANCH_ADMIN"), async (req, res) => {
    try {
      const user = req.user as any;
      const branchId = user.branchId;
      const promotionId = getStringParam(req.params.id);
      if (!branchId) return res.status(400).json({ message: "Sin sucursal" });
      await storage.deletePromotion(promotionId, branchId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── END PROMOTIONS ────────────────────────────────────────────────────────────

  // Background job: every 60 seconds, auto-mark attended for confirmed bookings
  // whose class start time has passed, for all active branches.
  // This is the same logic as the manual "Asistió" button — no separate deduction logic.
  setInterval(async () => {
    try {
      const branchIds = await storage.getAllActiveBranchIds();
      for (const branchId of branchIds) {
        const count = await storage.reconcilePastBookings(branchId);
        if (count > 0) {
          console.log(`[RECONCILE] Marked ${count} booking(s) as no_show for branch ${branchId}`);
        }
      }
    } catch (err: any) {
      console.error("[RECONCILE] Background job error:", err.message);
    }
  }, 60_000);

  return httpServer;
}
