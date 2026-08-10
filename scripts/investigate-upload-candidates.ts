/**
 * scripts/investigate-upload-candidates.ts
 *
 * Read-only forensic investigation for uploads referenced by WebCool.
 *
 * Usage:
 *   npx tsx scripts/investigate-upload-candidates.ts
 *   npx tsx scripts/investigate-upload-candidates.ts --out-dir "C:\temp\report"
 *
 * Safety:
 * - Never modifies existing database rows
 * - Never deletes, renames, or overwrites files inside uploads
 * - Only writes NEW report artifacts under os.tmpdir() by default
 */

import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import sharp from "sharp";

dotenv.config();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const REPORT_ROOT_DEFAULT = path.join(os.tmpdir(), `webcool-upload-investigation-${Date.now()}`);

const VERY_CLOSE_DHASH_MAX = 4;
const POSSIBLE_DHASH_MAX = 10;
const NEARBY_TIME_WINDOW_MS = 1000 * 60 * 60 * 48;
const CANDIDATE_LIMIT_PER_MISSING_PRODUCT = 5;

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
  ".heic",
  ".heif",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".m4v",
  ".ogv",
]);

const PRIORITY_SOURCE_RANK: Record<string, number> = {
  "branch_products.image_url": 1,
  "promotions.image_url": 2,
  "branch_posts.media_url": 3,
  "branch_photos.url": 4,
  "branch_announcements.image_url": 5,
  "class_schedules.routine_image_url": 6,
  "users.avatar_url": 7,
};

type SourceDefinition = {
  key: string;
  module: string;
  sql: string;
};

type ReferenceRow = {
  source_key: string;
  module_name: string;
  url: string | null;
  record_id: string | null;
  branch_id: string | null;
  record_name: string | null;
  detail: string | null;
};

type PhysicalFile = {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  mtimeMs: number;
};

type LocalReference = {
  kind: "local";
  originalUrl: string;
  normalizedUrl: string;
  relativePath: string;
  absolutePath: string;
};

type ExternalReference = {
  kind: "external";
  originalUrl: string;
  normalizedUrl: string;
};

type InvalidReference = {
  kind: "invalid";
  originalUrl: string;
  normalizedUrl: string;
  reason: string;
};

type ClassifiedUrl = LocalReference | ExternalReference | InvalidReference;

type ReferenceRecord = {
  sourceKey: string;
  moduleName: string;
  originalUrl: string;
  normalizedUrl: string;
  recordId: string | null;
  branchId: string | null;
  recordName: string | null;
  detail: string | null;
};

type FileReference = ReferenceRecord & {
  relativePath: string;
  absolutePath: string;
};

type ImageAnalysis = {
  kind: "image";
  relativePath: string;
  absolutePath: string;
  fileName: string;
  extension: string;
  detectedFormat: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  dHashHex: string;
  mtimeMs: number;
  mtimeIso: string;
  inferredTimestampMs: number | null;
  inferredTimestampIso: string | null;
  thumbnailRelativePath: string;
};

type VideoAnalysis = {
  kind: "video";
  relativePath: string;
  absolutePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  mtimeMs: number;
  mtimeIso: string;
  inferredTimestampMs: number | null;
  inferredTimestampIso: string | null;
};

type OtherAnalysis = {
  kind: "other";
  relativePath: string;
  absolutePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  mtimeMs: number;
  mtimeIso: string;
  inferredTimestampMs: number | null;
  inferredTimestampIso: string | null;
  note: string;
};

type FileAnalysis = ImageAnalysis | VideoAnalysis | OtherAnalysis;

type UsedImageRecord = ImageAnalysis & {
  references: FileReference[];
};

type OrphanAnalysisRecord = FileAnalysis & {
  matchCountExact: number;
  matchCountVeryClose: number;
  matchCountPossible: number;
};

type ImageMatch = {
  orphanRelativePath: string;
  usedRelativePath: string;
  matchType: "EXACT" | "VERY_CLOSE" | "POSSIBLE";
  hammingDistance: number;
  temporalDeltaHours: number | null;
  usedSourceKeys: string[];
  usedBranchIds: string[];
  usedRecordNames: string[];
  usedPriorityRank: number | null;
};

type CommercialMissingRecord = {
  productId: string | null;
  branchId: string | null;
  name: string | null;
  category: string | null;
  photoUrl: string;
  expectedFilename: string;
  inferredTimestampMs: number | null;
  inferredTimestampIso: string | null;
};

type MissingCommercialCandidate = {
  relativePath: string;
  reason: string[];
  sameBranch: boolean;
  tokenOverlap: number;
  temporalDeltaHours: number | null;
  thumbnailRelativePath: string | null;
  sourceKeys: string[];
  recordNames: string[];
};

const SOURCES: SourceDefinition[] = [
  {
    key: "users.avatar_url",
    module: "Clientes / avatares",
    sql: `
      SELECT
        'users.avatar_url' AS source_key,
        'Clientes / avatares' AS module_name,
        avatar_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        NULLIF(trim(concat_ws(' ', name, last_name)), '') AS record_name,
        role::text AS detail
      FROM users
      WHERE avatar_url IS NOT NULL
    `,
  },
  {
    key: "branches.cover_image_url",
    module: "Sucursales / portada",
    sql: `
      SELECT
        'branches.cover_image_url' AS source_key,
        'Sucursales / portada' AS module_name,
        cover_image_url AS url,
        id::text AS record_id,
        id::text AS branch_id,
        name::text AS record_name,
        slug::text AS detail
      FROM branches
      WHERE cover_image_url IS NOT NULL
    `,
  },
  {
    key: "class_schedules.routine_image_url",
    module: "TV Mode / rutina",
    sql: `
      SELECT
        'class_schedules.routine_image_url' AS source_key,
        'TV Mode / rutina' AS module_name,
        routine_image_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        name::text AS record_name,
        day_of_week::text || ' ' || start_time::text AS detail
      FROM class_schedules
      WHERE routine_image_url IS NOT NULL
    `,
  },
  {
    key: "branch_photos.url",
    module: "Perfil publico / fotos",
    sql: `
      SELECT
        'branch_photos.url' AS source_key,
        'Perfil publico / fotos' AS module_name,
        url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        type::text AS record_name,
        display_order::text AS detail
      FROM branch_photos
      WHERE url IS NOT NULL
    `,
  },
  {
    key: "branch_posts.media_url",
    module: "Contenido / posts",
    sql: `
      SELECT
        'branch_posts.media_url' AS source_key,
        'Contenido / posts' AS module_name,
        media_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        title::text AS record_name,
        media_type::text AS detail
      FROM branch_posts
      WHERE media_url IS NOT NULL
    `,
  },
  {
    key: "branch_products.image_url",
    module: "Contenido / productos legado",
    sql: `
      SELECT
        'branch_products.image_url' AS source_key,
        'Contenido / productos legado' AS module_name,
        image_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        name::text AS record_name,
        type::text AS detail
      FROM branch_products
      WHERE image_url IS NOT NULL
    `,
  },
  {
    key: "branch_commercial_products.photo_url",
    module: "Productos comerciales / inventario / cobrar",
    sql: `
      SELECT
        'branch_commercial_products.photo_url' AS source_key,
        'Productos comerciales / inventario / cobrar' AS module_name,
        photo_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        name::text AS record_name,
        category::text AS detail
      FROM branch_commercial_products
      WHERE photo_url IS NOT NULL
    `,
  },
  {
    key: "branch_videos.url",
    module: "Contenido / videos",
    sql: `
      SELECT
        'branch_videos.url' AS source_key,
        'Contenido / videos' AS module_name,
        url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        COALESCE(title, 'Sin titulo')::text AS record_name,
        'video'::text AS detail
      FROM branch_videos
      WHERE url IS NOT NULL
    `,
  },
  {
    key: "branch_videos.thumbnail_url",
    module: "Contenido / videos",
    sql: `
      SELECT
        'branch_videos.thumbnail_url' AS source_key,
        'Contenido / videos' AS module_name,
        thumbnail_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        COALESCE(title, 'Sin titulo')::text AS record_name,
        'thumbnail'::text AS detail
      FROM branch_videos
      WHERE thumbnail_url IS NOT NULL
    `,
  },
  {
    key: "branch_announcements.image_url",
    module: "Anuncios",
    sql: `
      SELECT
        'branch_announcements.image_url' AS source_key,
        'Anuncios' AS module_name,
        image_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        left(message, 80)::text AS record_name,
        is_active::text AS detail
      FROM branch_announcements
      WHERE image_url IS NOT NULL
    `,
  },
  {
    key: "promotions.image_url",
    module: "Promociones",
    sql: `
      SELECT
        'promotions.image_url' AS source_key,
        'Promociones' AS module_name,
        image_url AS url,
        id::text AS record_id,
        branch_id::text AS branch_id,
        title::text AS record_name,
        is_active::text AS detail
      FROM promotions
      WHERE image_url IS NOT NULL
    `,
  },
];

function parseArgs(argv: string[]): { outDir: string } {
  let outDir = REPORT_ROOT_DEFAULT;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out-dir") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--out-dir requiere una ruta");
      }
      outDir = path.resolve(value);
      i += 1;
    }
  }
  return { outDir };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

function normalizeDisplayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "-";
}

function collectPhysicalFiles(rootDir: string): Map<string, PhysicalFile> {
  const files = new Map<string, PhysicalFile>();

  const walk = (currentDir: string, relativeDir = "") => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = normalizeRelativePath(path.join(relativeDir, entry.name));
      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const stats = fs.statSync(absolutePath);
      files.set(relativePath, {
        relativePath,
        absolutePath,
        sizeBytes: stats.size,
        mtimeMs: stats.mtimeMs,
      });
    }
  };

  walk(rootDir);
  return files;
}

function classifyUrl(rawUrl: string | null | undefined, uploadsDir: string): ClassifiedUrl {
  const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!trimmed) {
    return {
      kind: "invalid",
      originalUrl: rawUrl ?? "",
      normalizedUrl: "",
      reason: "EMPTY_VALUE",
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      kind: "external",
      originalUrl: trimmed,
      normalizedUrl: trimmed,
    };
  }

  if (!trimmed.startsWith("/uploads/")) {
    return {
      kind: "invalid",
      originalUrl: trimmed,
      normalizedUrl: trimmed,
      reason: "NOT_UNDER_UPLOADS_PREFIX",
    };
  }

  const pathOnly = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  let decodedPath = pathOnly;
  try {
    decodedPath = decodeURIComponent(pathOnly);
  } catch {
    return {
      kind: "invalid",
      originalUrl: trimmed,
      normalizedUrl: pathOnly,
      reason: "INVALID_URL_ENCODING",
    };
  }

  if (!decodedPath.startsWith("/uploads/")) {
    return {
      kind: "invalid",
      originalUrl: trimmed,
      normalizedUrl: decodedPath,
      reason: "INVALID_LOCAL_PREFIX",
    };
  }

  const relativePart = decodedPath.slice("/uploads/".length);
  if (!relativePart || relativePart.trim().length === 0) {
    return {
      kind: "invalid",
      originalUrl: trimmed,
      normalizedUrl: decodedPath,
      reason: "EMPTY_LOCAL_PATH",
    };
  }

  const candidatePath = path.resolve(uploadsDir, relativePart);
  const uploadsRoot = path.resolve(uploadsDir);
  const relativeToRoot = normalizeRelativePath(path.relative(uploadsRoot, candidatePath));

  if (
    relativeToRoot.length === 0 ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    relativePart.includes("\\") ||
    relativeToRoot.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    return {
      kind: "invalid",
      originalUrl: trimmed,
      normalizedUrl: decodedPath,
      reason: "PATH_TRAVERSAL_OR_INVALID_SEGMENT",
    };
  }

  return {
    kind: "local",
    originalUrl: trimmed,
    normalizedUrl: `/uploads/${relativeToRoot}`,
    relativePath: relativeToRoot,
    absolutePath: candidatePath,
  };
}

async function loadReferenceRows(client: pg.Client): Promise<ReferenceRow[]> {
  const rows: ReferenceRow[] = [];
  for (const source of SOURCES) {
    const result = await client.query<ReferenceRow>(source.sql);
    rows.push(...result.rows);
  }
  return rows;
}

function inferTimestampFromFilename(fileName: string): { ms: number | null; iso: string | null } {
  const match = /^(\d{10,})-/.exec(fileName);
  if (!match) {
    return { ms: null, iso: null };
  }
  const numericPrefix = Number(match[1]);
  if (!Number.isFinite(numericPrefix) || numericPrefix <= 0) {
    return { ms: null, iso: null };
  }
  const date = new Date(numericPrefix);
  if (Number.isNaN(date.getTime())) {
    return { ms: null, iso: null };
  }
  return { ms: numericPrefix, iso: date.toISOString() };
}

function createSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function computeDHashHex(buffer: Buffer): Promise<string> {
  const pixels = await sharp(buffer)
    .rotate()
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  if (pixels.length !== 72) {
    throw new Error(`dHash esperaba 72 bytes y obtuvo ${pixels.length}`);
  }

  let bits = "";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = pixels[y * 9 + x];
      const right = pixels[y * 9 + x + 1];
      bits += left > right ? "1" : "0";
    }
  }

  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

function hammingDistance64(hexA: string, hexB: string): number {
  let value = BigInt(`0x${hexA}`) ^ BigInt(`0x${hexB}`);
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

function formatIsoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function sanitizeFileId(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function csvEscape(value: unknown): string {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function writeCsv(filePath: string, headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeTextTokens(...values: Array<string | null | undefined>): string[] {
  const combined = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return Array.from(new Set(combined.split(/[^a-z0-9]+/).filter((token) => token.length >= 3)));
}

function tokenOverlapScore(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function getUsedPriorityRank(references: FileReference[]): number | null {
  const ranks = references
    .map((ref) => PRIORITY_SOURCE_RANK[ref.sourceKey])
    .filter((value): value is number => Number.isFinite(value));
  if (ranks.length === 0) {
    return null;
  }
  return Math.min(...ranks);
}

async function analyzePhysicalFile(
  file: PhysicalFile,
  thumbnailsDir: string,
): Promise<FileAnalysis> {
  const fileName = path.basename(file.relativePath);
  const extension = path.extname(file.relativePath).toLowerCase();
  const inferredTimestamp = inferTimestampFromFilename(fileName);
  const mtimeIso = formatIsoFromMs(file.mtimeMs);

  if (VIDEO_EXTENSIONS.has(extension)) {
    return {
      kind: "video",
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      fileName,
      extension,
      sizeBytes: file.sizeBytes,
      mtimeMs: file.mtimeMs,
      mtimeIso,
      inferredTimestampMs: inferredTimestamp.ms,
      inferredTimestampIso: inferredTimestamp.iso,
    };
  }

  const buffer = fs.readFileSync(file.absolutePath);
  const sha256 = createSha256(buffer);

  try {
    const metadata = await sharp(buffer, { failOn: "none" }).rotate().metadata();
    if (metadata.width && metadata.height && (metadata.format || IMAGE_EXTENSIONS.has(extension))) {
      const thumbnailName = `${sanitizeFileId(file.relativePath)}.webp`;
      const thumbnailAbsolutePath = path.join(thumbnailsDir, thumbnailName);
      await sharp(buffer, { failOn: "none" })
        .rotate()
        .resize(320, 320, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbnailAbsolutePath);

      return {
        kind: "image",
        relativePath: file.relativePath,
        absolutePath: file.absolutePath,
        fileName,
        extension,
        detectedFormat: metadata.format ?? null,
        sizeBytes: file.sizeBytes,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        sha256,
        dHashHex: await computeDHashHex(buffer),
        mtimeMs: file.mtimeMs,
        mtimeIso,
        inferredTimestampMs: inferredTimestamp.ms,
        inferredTimestampIso: inferredTimestamp.iso,
        thumbnailRelativePath: normalizeRelativePath(path.join("thumbnails", thumbnailName)),
      };
    }
  } catch {
    // Falls through to "other".
  }

  return {
    kind: "other",
    relativePath: file.relativePath,
    absolutePath: file.absolutePath,
    fileName,
    extension,
    sizeBytes: file.sizeBytes,
    mtimeMs: file.mtimeMs,
    mtimeIso,
    inferredTimestampMs: inferredTimestamp.ms,
    inferredTimestampIso: inferredTimestamp.iso,
    note: "NO_IMAGE_METADATA",
  };
}

function buildHtmlReport(params: {
  outDir: string;
  summary: Record<string, unknown>;
  orphanImages: OrphanAnalysisRecord[];
  orphanVideos: OrphanAnalysisRecord[];
  orphanOthers: OrphanAnalysisRecord[];
  usedImages: UsedImageRecord[];
  matchesByOrphan: Map<string, ImageMatch[]>;
  commercialMissing: CommercialMissingRecord[];
  missingCommercialCandidates: Map<string, MissingCommercialCandidate[]>;
}) {
  const {
    summary,
    orphanImages,
    orphanVideos,
    orphanOthers,
    usedImages,
    matchesByOrphan,
    commercialMissing,
    missingCommercialCandidates,
  } = params;

  const renderMatchCards = (orphanPath: string) => {
    const matches = matchesByOrphan.get(orphanPath) ?? [];
    if (matches.length === 0) {
      return `<p class="muted">Sin coincidencias exactas ni perceptuales dentro de los umbrales.</p>`;
    }

    return `
      <div class="match-grid">
        ${matches
          .map((match) => {
            const used = usedImages.find((item) => item.relativePath === match.usedRelativePath);
            if (!used) return "";
            return `
              <article class="match-card ${match.matchType.toLowerCase()}">
                <img src="${escapeHtml(used.thumbnailRelativePath)}" alt="${escapeHtml(used.relativePath)}" />
                <div class="match-meta">
                  <strong>${escapeHtml(match.matchType)}</strong>
                  <div>${escapeHtml(used.relativePath)}</div>
                  <div>dHash: ${match.hammingDistance}</div>
                  <div>SHA: ${used.sha256.slice(0, 12)}...</div>
                  <div>Refs: ${used.references.length}</div>
                  <div>Fuentes: ${escapeHtml(Array.from(new Set(match.usedSourceKeys)).join(", "))}</div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const renderMissingCandidates = (productId: string | null) => {
    const key = productId ?? "";
    const candidates = missingCommercialCandidates.get(key) ?? [];
    if (candidates.length === 0) {
      return `<p class="muted">Sin candidatos auxiliares por tiempo, sucursal o texto.</p>`;
    }

    return `
      <div class="candidate-list">
        ${candidates
          .map(
            (candidate) => `
              <article class="candidate-card">
                ${
                  candidate.thumbnailRelativePath
                    ? `<img src="${escapeHtml(candidate.thumbnailRelativePath)}" alt="${escapeHtml(candidate.relativePath)}" />`
                    : `<div class="thumb-placeholder">Sin miniatura</div>`
                }
                <div class="candidate-meta">
                  <div><strong>${escapeHtml(candidate.relativePath)}</strong></div>
                  <div>Motivos: ${escapeHtml(candidate.reason.join(", "))}</div>
                  <div>Misma sucursal: ${candidate.sameBranch ? "sí" : "no"}</div>
                  <div>Solapamiento de texto: ${candidate.tokenOverlap}</div>
                  <div>Delta temporal: ${
                    candidate.temporalDeltaHours == null ? "-" : `${candidate.temporalDeltaHours.toFixed(1)} h`
                  }</div>
                  <div>Fuentes: ${escapeHtml(candidate.sourceKeys.join(", ") || "-")}</div>
                  <div>Registros: ${escapeHtml(candidate.recordNames.join(" | ") || "-")}</div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  };

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WebCool Upload Investigation</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f6f8fb; color: #1f2937; }
    h1, h2, h3 { margin: 0 0 12px; }
    section { margin-bottom: 32px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .summary-card, .orphan-card, .missing-card { background: white; border: 1px solid #dbe3ee; border-radius: 16px; padding: 16px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); }
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .orphan-card img, .match-card img, .candidate-card img { width: 100%; max-height: 220px; object-fit: contain; background: #f3f4f6; border-radius: 12px; }
    .muted { color: #6b7280; }
    .meta-list { font-size: 14px; line-height: 1.5; margin-top: 12px; }
    .match-grid, .candidate-list { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px; }
    .match-card, .candidate-card { display: grid; grid-template-columns: 120px 1fr; gap: 12px; align-items: start; padding: 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fafafa; }
    .match-card.exact { border-color: #059669; }
    .match-card.very_close { border-color: #d97706; }
    .match-card.possible { border-color: #2563eb; }
    .candidate-meta, .match-meta { font-size: 13px; line-height: 1.45; }
    .thumb-placeholder { display: flex; align-items: center; justify-content: center; background: #eef2ff; border-radius: 12px; height: 100px; color: #4b5563; font-size: 13px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 13px; vertical-align: top; }
    code { background: #eef2ff; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Investigación forense de uploads</h1>
  <p class="muted">Reporte local, solo lectura. Generado fuera de <code>uploads</code>.</p>

  <section>
    <h2>Resumen</h2>
    <div class="summary">
      ${Object.entries(summary)
        .map(
          ([key, value]) => `
            <article class="summary-card">
              <div class="muted">${escapeHtml(key)}</div>
              <strong>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value))}</strong>
            </article>
          `,
        )
        .join("")}
    </div>
  </section>

  <section>
    <h2>TRUE_ORPHAN imágenes</h2>
    <div class="gallery">
      ${orphanImages
        .map(
          (item) => `
            <article class="orphan-card">
              <img src="${escapeHtml(item.thumbnailRelativePath)}" alt="${escapeHtml(item.relativePath)}" />
              <h3>${escapeHtml(item.relativePath)}</h3>
              <div class="meta-list">
                <div>Formato: ${escapeHtml(item.detectedFormat ?? "-")}</div>
                <div>Dimensiones: ${item.width ?? "-"} x ${item.height ?? "-"}</div>
                <div>Tamaño: ${bytes(item.sizeBytes)}</div>
                <div>SHA-256: <code>${escapeHtml(item.sha256)}</code></div>
                <div>dHash: <code>${escapeHtml(item.dHashHex)}</code></div>
                <div>mtime: ${escapeHtml(item.mtimeIso)}</div>
                <div>Inferido: ${escapeHtml(item.inferredTimestampIso ?? "-")}</div>
                <div>Matches: exact=${item.matchCountExact}, very_close=${item.matchCountVeryClose}, possible=${item.matchCountPossible}</div>
              </div>
              ${renderMatchCards(item.relativePath)}
            </article>
          `,
        )
        .join("")}
    </div>
  </section>

  <section>
    <h2>TRUE_ORPHAN videos</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Archivo</th><th>Tamaño</th><th>mtime</th><th>Inferido</th></tr></thead>
        <tbody>
          ${
            orphanVideos.length === 0
              ? `<tr><td colspan="4">Sin videos huérfanos.</td></tr>`
              : orphanVideos
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(item.relativePath)}</td>
                        <td>${bytes(item.sizeBytes)}</td>
                        <td>${escapeHtml(item.mtimeIso)}</td>
                        <td>${escapeHtml(item.inferredTimestampIso ?? "-")}</td>
                      </tr>
                    `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>TRUE_ORPHAN otros</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Archivo</th><th>Nota</th><th>Tamaño</th></tr></thead>
        <tbody>
          ${
            orphanOthers.length === 0
              ? `<tr><td colspan="3">Sin archivos adicionales.</td></tr>`
              : orphanOthers
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(item.relativePath)}</td>
                        <td>${escapeHtml(item.kind === "other" ? item.note : "-")}</td>
                        <td>${bytes(item.sizeBytes)}</td>
                      </tr>
                    `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Productos comerciales faltantes</h2>
    <div class="gallery">
      ${commercialMissing
        .map(
          (item) => `
            <article class="missing-card">
              <h3>${escapeHtml(item.name ?? "Sin nombre")}</h3>
              <div class="meta-list">
                <div>Producto: ${escapeHtml(item.productId ?? "-")}</div>
                <div>Sucursal: ${escapeHtml(item.branchId ?? "-")}</div>
                <div>Categoría: ${escapeHtml(item.category ?? "-")}</div>
                <div>URL DB: <code>${escapeHtml(item.photoUrl)}</code></div>
                <div>Archivo esperado: ${escapeHtml(item.expectedFilename)}</div>
                <div>Timestamp inferido: ${escapeHtml(item.inferredTimestampIso ?? "-")}</div>
              </div>
              ${renderMissingCandidates(item.productId)}
            </article>
          `,
        )
        .join("")}
    </div>
  </section>
</body>
</html>`;

  fs.writeFileSync(path.join(params.outDir, "index.html"), html, "utf8");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no definida");
  }

  const args = parseArgs(process.argv.slice(2));
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (!fs.existsSync(uploadsRoot)) {
    throw new Error(`No existe el directorio uploads: ${uploadsRoot}`);
  }

  const outDir = args.outDir;
  const thumbnailsDir = path.join(outDir, "thumbnails");
  ensureDir(outDir);
  ensureDir(thumbnailsDir);

  console.log("Modo: READ-ONLY");
  console.log(`Uploads: ${uploadsRoot}`);
  console.log(`Reporte: ${outDir}`);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "webcool-upload-investigation-read-only",
  });
  await client.connect();

  const physicalFiles = collectPhysicalFiles(uploadsRoot);
  const referenceRows = await loadReferenceRows(client);
  await client.end();

  const localReferenceMap = new Map<string, FileReference[]>();
  const externalReferences: ReferenceRecord[] = [];
  const invalidReferences: Array<ReferenceRecord & { reason: string }> = [];

  for (const row of referenceRows) {
    const rawUrl = typeof row.url === "string" ? row.url : "";
    const baseRecord: ReferenceRecord = {
      sourceKey: row.source_key,
      moduleName: row.module_name,
      originalUrl: rawUrl,
      normalizedUrl: rawUrl,
      recordId: row.record_id,
      branchId: row.branch_id,
      recordName: row.record_name,
      detail: row.detail,
    };

    const classified = classifyUrl(rawUrl, uploadsRoot);
    if (classified.kind === "external") {
      externalReferences.push({ ...baseRecord, normalizedUrl: classified.normalizedUrl });
      continue;
    }

    if (classified.kind === "invalid") {
      invalidReferences.push({
        ...baseRecord,
        normalizedUrl: classified.normalizedUrl,
        reason: classified.reason,
      });
      continue;
    }

    const ref: FileReference = {
      ...baseRecord,
      normalizedUrl: classified.normalizedUrl,
      relativePath: classified.relativePath,
      absolutePath: classified.absolutePath,
    };
    const existing = localReferenceMap.get(classified.relativePath) ?? [];
    existing.push(ref);
    localReferenceMap.set(classified.relativePath, existing);
  }

  const usedFiles: Array<PhysicalFile & { references: FileReference[] }> = [];
  const trueOrphans: PhysicalFile[] = [];

  for (const file of physicalFiles.values()) {
    const references = localReferenceMap.get(file.relativePath) ?? [];
    if (references.length > 0) {
      usedFiles.push({ ...file, references });
    } else {
      trueOrphans.push(file);
    }
  }

  const missingOnDisk: Array<{ relativePath: string; references: FileReference[] }> = [];
  for (const [relativePath, references] of localReferenceMap.entries()) {
    if (!physicalFiles.has(relativePath)) {
      missingOnDisk.push({ relativePath, references });
    }
  }

  const analysisMap = new Map<string, FileAnalysis>();
  for (const file of physicalFiles.values()) {
    analysisMap.set(file.relativePath, await analyzePhysicalFile(file, thumbnailsDir));
  }

  const orphanAnalyses: OrphanAnalysisRecord[] = trueOrphans
    .map((file) => analysisMap.get(file.relativePath))
    .filter((value): value is FileAnalysis => Boolean(value))
    .map((analysis) => ({
      ...analysis,
      matchCountExact: 0,
      matchCountVeryClose: 0,
      matchCountPossible: 0,
    }));

  const usedImageAnalyses: UsedImageRecord[] = usedFiles
    .map((file) => {
      const analysis = analysisMap.get(file.relativePath);
      if (!analysis || analysis.kind !== "image") {
        return null;
      }
      return {
        ...analysis,
        references: file.references,
      };
    })
    .filter((value): value is UsedImageRecord => Boolean(value));

  const orphanImageAnalyses = orphanAnalyses.filter((item): item is OrphanAnalysisRecord & ImageAnalysis => item.kind === "image");
  const orphanVideoAnalyses = orphanAnalyses.filter((item): item is OrphanAnalysisRecord & VideoAnalysis => item.kind === "video");
  const orphanOtherAnalyses = orphanAnalyses.filter((item): item is OrphanAnalysisRecord & OtherAnalysis => item.kind === "other");

  const matches: ImageMatch[] = [];
  const matchesByOrphan = new Map<string, ImageMatch[]>();

  for (const orphan of orphanImageAnalyses) {
    const orphanMatches: ImageMatch[] = [];
    for (const used of usedImageAnalyses) {
      let matchType: ImageMatch["matchType"] | null = null;
      let hammingDistance = 0;

      if (orphan.sha256 === used.sha256) {
        matchType = "EXACT";
      } else {
        hammingDistance = hammingDistance64(orphan.dHashHex, used.dHashHex);
        if (hammingDistance <= VERY_CLOSE_DHASH_MAX) {
          matchType = "VERY_CLOSE";
        } else if (hammingDistance <= POSSIBLE_DHASH_MAX) {
          matchType = "POSSIBLE";
        }
      }

      if (!matchType) {
        continue;
      }

      const usedSourceKeys = Array.from(new Set(used.references.map((ref) => ref.sourceKey))).sort();
      const usedBranchIds = Array.from(new Set(used.references.map((ref) => normalizeDisplayText(ref.branchId)))).sort();
      const usedRecordNames = Array.from(new Set(used.references.map((ref) => normalizeDisplayText(ref.recordName)))).sort();
      const temporalDeltaHours =
        orphan.inferredTimestampMs != null && used.inferredTimestampMs != null
          ? Math.abs(orphan.inferredTimestampMs - used.inferredTimestampMs) / (1000 * 60 * 60)
          : null;

      const match: ImageMatch = {
        orphanRelativePath: orphan.relativePath,
        usedRelativePath: used.relativePath,
        matchType,
        hammingDistance,
        temporalDeltaHours,
        usedSourceKeys,
        usedBranchIds,
        usedRecordNames,
        usedPriorityRank: getUsedPriorityRank(used.references),
      };

      orphanMatches.push(match);
      matches.push(match);
    }

    orphanMatches.sort((left, right) => {
      const typeRank = { EXACT: 0, VERY_CLOSE: 1, POSSIBLE: 2 };
      return (
        typeRank[left.matchType] - typeRank[right.matchType] ||
        left.hammingDistance - right.hammingDistance ||
        (left.usedPriorityRank ?? 99) - (right.usedPriorityRank ?? 99) ||
        (left.temporalDeltaHours ?? Number.POSITIVE_INFINITY) - (right.temporalDeltaHours ?? Number.POSITIVE_INFINITY) ||
        left.usedRelativePath.localeCompare(right.usedRelativePath)
      );
    });

    orphan.matchCountExact = orphanMatches.filter((match) => match.matchType === "EXACT").length;
    orphan.matchCountVeryClose = orphanMatches.filter((match) => match.matchType === "VERY_CLOSE").length;
    orphan.matchCountPossible = orphanMatches.filter((match) => match.matchType === "POSSIBLE").length;
    matchesByOrphan.set(orphan.relativePath, orphanMatches);
  }

  const commercialMissing: CommercialMissingRecord[] = missingOnDisk
    .flatMap(({ references }) =>
      references
        .filter((ref) => ref.sourceKey === "branch_commercial_products.photo_url")
        .map((ref) => {
          const expectedFilename = path.basename(ref.relativePath);
          const inferredTimestamp = inferTimestampFromFilename(expectedFilename);
          return {
            productId: ref.recordId,
            branchId: ref.branchId,
            name: ref.recordName,
            category: ref.detail,
            photoUrl: ref.originalUrl,
            expectedFilename,
            inferredTimestampMs: inferredTimestamp.ms,
            inferredTimestampIso: inferredTimestamp.iso,
          };
        }),
    )
    .sort((left, right) => left.expectedFilename.localeCompare(right.expectedFilename));

  const missingCommercialCandidates = new Map<string, MissingCommercialCandidate[]>();
  for (const missing of commercialMissing) {
    const productTokens = normalizeTextTokens(missing.name, missing.category);
    const candidates: MissingCommercialCandidate[] = [];

    for (const orphan of orphanImageAnalyses) {
      const deltaHours =
        missing.inferredTimestampMs != null && orphan.inferredTimestampMs != null
          ? Math.abs(missing.inferredTimestampMs - orphan.inferredTimestampMs) / (1000 * 60 * 60)
          : null;
      if (deltaHours == null || deltaHours > NEARBY_TIME_WINDOW_MS / (1000 * 60 * 60)) {
        continue;
      }

      candidates.push({
        relativePath: orphan.relativePath,
        reason: ["orphan", "time_close"],
        sameBranch: false,
        tokenOverlap: 0,
        temporalDeltaHours: deltaHours,
        thumbnailRelativePath: orphan.thumbnailRelativePath,
        sourceKeys: [],
        recordNames: [],
      });
    }

    for (const used of usedImageAnalyses) {
      const usedTokens = normalizeTextTokens(
        ...used.references.flatMap((ref) => [ref.recordName, ref.detail]),
      );
      const overlap = tokenOverlapScore(productTokens, usedTokens);
      const sameBranch = used.references.some((ref) => ref.branchId != null && ref.branchId === missing.branchId);
      const deltaHours =
        missing.inferredTimestampMs != null && used.inferredTimestampMs != null
          ? Math.abs(missing.inferredTimestampMs - used.inferredTimestampMs) / (1000 * 60 * 60)
          : null;

      const withinTimeWindow = deltaHours != null && deltaHours <= NEARBY_TIME_WINDOW_MS / (1000 * 60 * 60);
      if (!sameBranch && overlap === 0 && !withinTimeWindow) {
        continue;
      }

      const reasons: string[] = [];
      if (sameBranch) reasons.push("same_branch");
      if (overlap > 0) reasons.push(`token_overlap:${overlap}`);
      if (withinTimeWindow) reasons.push("time_close");
      const priorityRank = getUsedPriorityRank(used.references);
      if (priorityRank != null) reasons.push(`priority_source:${priorityRank}`);

      candidates.push({
        relativePath: used.relativePath,
        reason: reasons,
        sameBranch,
        tokenOverlap: overlap,
        temporalDeltaHours: deltaHours,
        thumbnailRelativePath: used.thumbnailRelativePath,
        sourceKeys: Array.from(new Set(used.references.map((ref) => ref.sourceKey))).sort(),
        recordNames: Array.from(new Set(used.references.map((ref) => normalizeDisplayText(ref.recordName)))).sort(),
      });
    }

    candidates.sort((left, right) => {
      const leftScore =
        (left.sameBranch ? 50 : 0) +
        left.tokenOverlap * 10 +
        (left.reason.some((reason) => reason.startsWith("priority_source:1")) ? 4 : 0) +
        (left.reason.includes("time_close") ? 2 : 0);
      const rightScore =
        (right.sameBranch ? 50 : 0) +
        right.tokenOverlap * 10 +
        (right.reason.some((reason) => reason.startsWith("priority_source:1")) ? 4 : 0) +
        (right.reason.includes("time_close") ? 2 : 0);

      return (
        rightScore - leftScore ||
        (left.temporalDeltaHours ?? Number.POSITIVE_INFINITY) - (right.temporalDeltaHours ?? Number.POSITIVE_INFINITY) ||
        left.relativePath.localeCompare(right.relativePath)
      );
    });

    missingCommercialCandidates.set(
      missing.productId ?? "",
      candidates.slice(0, CANDIDATE_LIMIT_PER_MISSING_PRODUCT),
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    uploadsDir: uploadsRoot,
    reportDir: outDir,
    thresholds: {
      veryCloseDHashMax: VERY_CLOSE_DHASH_MAX,
      possibleDHashMax: POSSIBLE_DHASH_MAX,
      nearbyTimeWindowHours: NEARBY_TIME_WINDOW_MS / (1000 * 60 * 60),
    },
    physicalFiles: physicalFiles.size,
    dbReferenceRows: referenceRows.length,
    trueOrphans: trueOrphans.length,
    usedLocalFiles: usedFiles.length,
    orphanImages: orphanImageAnalyses.length,
    orphanVideos: orphanVideoAnalyses.length,
    orphanOthers: orphanOtherAnalyses.length,
    usedImages: usedImageAnalyses.length,
    missingOnDisk: missingOnDisk.length,
    commercialMissingRows: commercialMissing.length,
    exactMatches: matches.filter((match) => match.matchType === "EXACT").length,
    veryCloseMatches: matches.filter((match) => match.matchType === "VERY_CLOSE").length,
    possibleMatches: matches.filter((match) => match.matchType === "POSSIBLE").length,
    externalReferences: externalReferences.length,
    invalidReferences: invalidReferences.length,
  };

  fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  writeCsv(
    path.join(outDir, "orphans.csv"),
    [
      "kind",
      "filename",
      "relative_path",
      "extension",
      "format_detected",
      "size_bytes",
      "width",
      "height",
      "sha256",
      "dhash_hex",
      "mtime_iso",
      "inferred_timestamp_iso",
      "match_exact",
      "match_very_close",
      "match_possible",
      "thumbnail",
      "note",
    ],
    orphanAnalyses.map((item) => ({
      kind: item.kind,
      filename: item.fileName,
      relative_path: item.relativePath,
      extension: item.extension,
      format_detected: item.kind === "image" ? item.detectedFormat ?? "" : "",
      size_bytes: item.sizeBytes,
      width: item.kind === "image" ? item.width ?? "" : "",
      height: item.kind === "image" ? item.height ?? "" : "",
      sha256: item.kind === "image" ? item.sha256 : "",
      dhash_hex: item.kind === "image" ? item.dHashHex : "",
      mtime_iso: item.mtimeIso,
      inferred_timestamp_iso: item.inferredTimestampIso ?? "",
      match_exact: item.matchCountExact,
      match_very_close: item.matchCountVeryClose,
      match_possible: item.matchCountPossible,
      thumbnail: item.kind === "image" ? item.thumbnailRelativePath : "",
      note: item.kind === "other" ? item.note : "",
    })),
  );

  writeCsv(
    path.join(outDir, "used-images.csv"),
    [
      "relative_path",
      "extension",
      "format_detected",
      "size_bytes",
      "width",
      "height",
      "sha256",
      "dhash_hex",
      "mtime_iso",
      "inferred_timestamp_iso",
      "reference_count",
      "source_keys",
      "branch_ids",
      "record_names",
      "thumbnail",
    ],
    usedImageAnalyses.map((item) => ({
      relative_path: item.relativePath,
      extension: item.extension,
      format_detected: item.detectedFormat ?? "",
      size_bytes: item.sizeBytes,
      width: item.width ?? "",
      height: item.height ?? "",
      sha256: item.sha256,
      dhash_hex: item.dHashHex,
      mtime_iso: item.mtimeIso,
      inferred_timestamp_iso: item.inferredTimestampIso ?? "",
      reference_count: item.references.length,
      source_keys: Array.from(new Set(item.references.map((ref) => ref.sourceKey))).sort().join(" | "),
      branch_ids: Array.from(new Set(item.references.map((ref) => normalizeDisplayText(ref.branchId)))).sort().join(" | "),
      record_names: Array.from(new Set(item.references.map((ref) => normalizeDisplayText(ref.recordName)))).sort().join(" | "),
      thumbnail: item.thumbnailRelativePath,
    })),
  );

  writeCsv(
    path.join(outDir, "commercial-missing.csv"),
    [
      "product_id",
      "branch_id",
      "name",
      "category",
      "photo_url",
      "expected_filename",
      "inferred_timestamp_iso",
      "candidate_paths",
    ],
    commercialMissing.map((item) => ({
      product_id: item.productId,
      branch_id: item.branchId,
      name: item.name,
      category: item.category,
      photo_url: item.photoUrl,
      expected_filename: item.expectedFilename,
      inferred_timestamp_iso: item.inferredTimestampIso ?? "",
      candidate_paths: (missingCommercialCandidates.get(item.productId ?? "") ?? [])
        .map((candidate) => candidate.relativePath)
        .join(" | "),
    })),
  );

  writeCsv(
    path.join(outDir, "matches.csv"),
    [
      "orphan_path",
      "used_path",
      "match_type",
      "hamming_distance",
      "temporal_delta_hours",
      "used_source_keys",
      "used_branch_ids",
      "used_record_names",
      "used_priority_rank",
    ],
    matches.map((item) => ({
      orphan_path: item.orphanRelativePath,
      used_path: item.usedRelativePath,
      match_type: item.matchType,
      hamming_distance: item.hammingDistance,
      temporal_delta_hours: item.temporalDeltaHours == null ? "" : item.temporalDeltaHours.toFixed(3),
      used_source_keys: item.usedSourceKeys.join(" | "),
      used_branch_ids: item.usedBranchIds.join(" | "),
      used_record_names: item.usedRecordNames.join(" | "),
      used_priority_rank: item.usedPriorityRank ?? "",
    })),
  );

  buildHtmlReport({
    outDir,
    summary,
    orphanImages: orphanImageAnalyses,
    orphanVideos: orphanVideoAnalyses,
    orphanOthers: orphanOtherAnalyses,
    usedImages: usedImageAnalyses,
    matchesByOrphan,
    commercialMissing,
    missingCommercialCandidates,
  });

  console.log("Resumen:");
  console.log(`- TRUE_ORPHAN físicos: ${trueOrphans.length}`);
  console.log(`- USED locales: ${usedFiles.length}`);
  console.log(`- Imágenes huérfanas analizadas: ${orphanImageAnalyses.length}`);
  console.log(`- Imágenes USED analizadas: ${usedImageAnalyses.length}`);
  console.log(`- Productos comerciales faltantes: ${commercialMissing.length}`);
  console.log(`- EXACT: ${summary.exactMatches}`);
  console.log(`- VERY_CLOSE: ${summary.veryCloseMatches}`);
  console.log(`- POSSIBLE: ${summary.possibleMatches}`);
  console.log(`Reporte generado en: ${outDir}`);
  console.log("Este script solo lee DB/archivos existentes y genera reportes nuevos fuera de uploads.");
}

main().catch((error) => {
  console.error("Investigation failed:", error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
