import fs from "fs";
import path from "path";

export type MediaReferenceClassification =
  | {
      kind: "INTERNAL_UPLOAD";
      originalUrl: string;
      normalizedUrl: string;
      relativePath: string;
      absolutePath: string;
    }
  | {
      kind: "EXTERNAL_URL";
      originalUrl: string;
      normalizedUrl: string;
    }
  | {
      kind: "INVALID_REFERENCE";
      originalUrl: string;
      normalizedUrl: string;
      reason: string;
    };

const UPLOADS_PREFIX = "/uploads/";

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

function getConfiguredUploadsDir(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), "uploads");
}

export function getUploadsDir(): string {
  return getConfiguredUploadsDir();
}

export function ensureUploadsDirExists(): string {
  const uploadsDir = getConfiguredUploadsDir();
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

export function resolveSafeUploadPath(relativePathOrFilename: string): string {
  const rawValue = typeof relativePathOrFilename === "string" ? relativePathOrFilename.trim() : "";
  if (!rawValue) {
    throw new Error("EMPTY_UPLOAD_PATH");
  }

  let decodedValue = rawValue;
  try {
    decodedValue = decodeURIComponent(rawValue);
  } catch {
    throw new Error("INVALID_UPLOAD_PATH_ENCODING");
  }

  if (decodedValue.startsWith(UPLOADS_PREFIX)) {
    decodedValue = decodedValue.slice(UPLOADS_PREFIX.length);
  }

  if (!decodedValue || decodedValue.trim().length === 0) {
    throw new Error("EMPTY_UPLOAD_PATH");
  }

  if (decodedValue.includes("\\")) {
    throw new Error("INVALID_UPLOAD_PATH_SEPARATOR");
  }

  const uploadsDir = getConfiguredUploadsDir();
  const resolvedPath = path.resolve(uploadsDir, decodedValue);
  const relativeToRoot = normalizeRelativePath(path.relative(uploadsDir, resolvedPath));

  if (
    relativeToRoot.length === 0 ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    relativeToRoot.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error("UPLOAD_PATH_TRAVERSAL");
  }

  return resolvedPath;
}

export function buildUploadPublicUrl(relativePathOrFilename: string): string {
  const absolutePath = resolveSafeUploadPath(relativePathOrFilename);
  const relativePath = normalizeRelativePath(path.relative(getConfiguredUploadsDir(), absolutePath));
  return `${UPLOADS_PREFIX}${relativePath}`;
}

export function classifyMediaReference(fileUrl: string | null | undefined): MediaReferenceClassification {
  const trimmed = typeof fileUrl === "string" ? fileUrl.trim() : "";
  if (!trimmed) {
    return {
      kind: "INVALID_REFERENCE",
      originalUrl: fileUrl ?? "",
      normalizedUrl: "",
      reason: "EMPTY_VALUE",
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      kind: "EXTERNAL_URL",
      originalUrl: trimmed,
      normalizedUrl: trimmed,
    };
  }

  if (!trimmed.startsWith(UPLOADS_PREFIX)) {
    return {
      kind: "INVALID_REFERENCE",
      originalUrl: trimmed,
      normalizedUrl: trimmed,
      reason: "NOT_UNDER_UPLOADS_PREFIX",
    };
  }

  try {
    const absolutePath = resolveSafeUploadPath(trimmed);
    const relativePath = normalizeRelativePath(path.relative(getConfiguredUploadsDir(), absolutePath));
    return {
      kind: "INTERNAL_UPLOAD",
      originalUrl: trimmed,
      normalizedUrl: `${UPLOADS_PREFIX}${relativePath}`,
      relativePath,
      absolutePath,
    };
  } catch (error) {
    return {
      kind: "INVALID_REFERENCE",
      originalUrl: trimmed,
      normalizedUrl: trimmed,
      reason: error instanceof Error ? error.message : "INVALID_UPLOAD_REFERENCE",
    };
  }
}

export function resolveLocalUploadPath(fileUrl: string | null | undefined): string | null {
  const classified = classifyMediaReference(fileUrl);
  if (classified.kind !== "INTERNAL_UPLOAD") {
    return null;
  }
  return classified.absolutePath;
}
