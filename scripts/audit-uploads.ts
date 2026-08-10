/**
 * scripts/audit-uploads.ts
 *
 * Read-only audit for files referenced through /uploads.
 *
 * Usage:
 *   npx tsx scripts/audit-uploads.ts
 *
 * This script never deletes files and never modifies database rows.
 */

import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { getUploadsDir } from "../server/media-storage";

dotenv.config();

const UPLOADS_DIR = getUploadsDir();

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

type PhysicalFile = {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
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

function bytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeDisplayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "-";
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
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

function formatReference(ref: ReferenceRecord): string {
  const name = normalizeDisplayText(ref.recordName);
  const detail = normalizeDisplayText(ref.detail);
  return `${ref.sourceKey} | id=${normalizeDisplayText(ref.recordId)} | branch=${normalizeDisplayText(ref.branchId)} | name=${name} | detail=${detail}`;
}

async function loadReferenceRows(client: pg.Client): Promise<ReferenceRow[]> {
  const rows: ReferenceRow[] = [];

  for (const source of SOURCES) {
    const result = await client.query<ReferenceRow>(source.sql);
    rows.push(...result.rows);
  }

  return rows;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL: NO DEFINIDA");
    process.exit(1);
  }

  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (!fs.existsSync(uploadsRoot)) {
    console.error(`No existe el directorio de uploads: ${uploadsRoot}`);
    process.exit(1);
  }

  console.log("DATABASE_URL: OK");
  console.log(`UPLOADS_DIR: ${uploadsRoot}`);
  console.log("Modo: READ-ONLY (sin borrado)");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
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
      externalReferences.push({
        ...baseRecord,
        normalizedUrl: classified.normalizedUrl,
      });
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

    const record: FileReference = {
      ...baseRecord,
      normalizedUrl: classified.normalizedUrl,
      relativePath: classified.relativePath,
      absolutePath: classified.absolutePath,
    };

    const existing = localReferenceMap.get(classified.relativePath) ?? [];
    existing.push(record);
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

  const sharedFiles = usedFiles
    .map((file) => {
      const sourceKeys = new Set(file.references.map((ref) => ref.sourceKey));
      const recordKeys = new Set(
        file.references.map((ref) => `${ref.sourceKey}:${normalizeDisplayText(ref.recordId)}:${normalizeDisplayText(ref.branchId)}`),
      );
      return {
        ...file,
        referenceCount: file.references.length,
        sourceCount: sourceKeys.size,
        recordCount: recordKeys.size,
      };
    })
    .filter((file) => file.referenceCount > 1 || file.sourceCount > 1)
    .sort((a, b) => b.referenceCount - a.referenceCount || a.relativePath.localeCompare(b.relativePath));

  const missingCommercialProducts = missingOnDisk.filter(({ references }) =>
    references.some((ref) => ref.sourceKey === "branch_commercial_products.photo_url"),
  );

  const physicalTotalBytes = Array.from(physicalFiles.values()).reduce((sum, file) => sum + file.sizeBytes, 0);
  const orphanTotalBytes = trueOrphans.reduce((sum, file) => sum + file.sizeBytes, 0);

  console.log("\n==================================================");
  console.log("UPLOAD AUDIT SUMMARY");
  console.log("==================================================");
  console.log(`Physical files       : ${physicalFiles.size} (${bytes(physicalTotalBytes)})`);
  console.log(`DB reference rows    : ${referenceRows.length}`);
  console.log(`USED                 : ${usedFiles.length}`);
  console.log(`TRUE_ORPHAN          : ${trueOrphans.length} (${bytes(orphanTotalBytes)})`);
  console.log(`MISSING_ON_DISK      : ${missingOnDisk.length}`);
  console.log(`EXTERNAL_URL         : ${externalReferences.length}`);
  console.log(`INVALID_REFERENCE    : ${invalidReferences.length}`);
  console.log(`SHARED_LOCAL_FILES   : ${sharedFiles.length}`);
  console.log(`Missing commercial   : ${missingCommercialProducts.length}`);

  console.log("\n--------------------------------------------------");
  console.log("SOURCES AUDITED");
  console.log("--------------------------------------------------");
  for (const source of SOURCES) {
    const localCount = referenceRows.filter((row) => row.source_key === source.key).length;
    console.log(`- ${source.key} (${source.module}) -> ${localCount} row(s)`);
  }

  console.log("\n--------------------------------------------------");
  console.log("USED FILES");
  console.log("--------------------------------------------------");
  if (usedFiles.length === 0) {
    console.log("(none)");
  } else {
    for (const file of usedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      const sourceKeys = Array.from(new Set(file.references.map((ref) => ref.sourceKey))).sort();
      console.log(`USED | ${file.relativePath} | ${bytes(file.sizeBytes)} | refs=${file.references.length} | sources=${sourceKeys.length}`);
      for (const ref of file.references) {
        console.log(`  -> ${formatReference(ref)}`);
      }
    }
  }

  console.log("\n--------------------------------------------------");
  console.log("TRUE_ORPHAN FILES");
  console.log("--------------------------------------------------");
  if (trueOrphans.length === 0) {
    console.log("(none)");
  } else {
    for (const file of trueOrphans.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      console.log(`TRUE_ORPHAN | ${file.relativePath} | ${bytes(file.sizeBytes)}`);
    }
  }

  console.log("\n--------------------------------------------------");
  console.log("MISSING_ON_DISK REFERENCES");
  console.log("--------------------------------------------------");
  if (missingOnDisk.length === 0) {
    console.log("(none)");
  } else {
    for (const missing of missingOnDisk.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      console.log(`MISSING_ON_DISK | ${missing.relativePath} | refs=${missing.references.length}`);
      for (const ref of missing.references) {
        console.log(`  -> ${formatReference(ref)}`);
      }
    }
  }

  console.log("\n--------------------------------------------------");
  console.log("EXTERNAL_URL REFERENCES");
  console.log("--------------------------------------------------");
  if (externalReferences.length === 0) {
    console.log("(none)");
  } else {
    for (const ref of externalReferences.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.originalUrl.localeCompare(b.originalUrl))) {
      console.log(`EXTERNAL_URL | ${ref.originalUrl}`);
      console.log(`  -> ${formatReference(ref)}`);
    }
  }

  console.log("\n--------------------------------------------------");
  console.log("INVALID_REFERENCE ROWS");
  console.log("--------------------------------------------------");
  if (invalidReferences.length === 0) {
    console.log("(none)");
  } else {
    for (const ref of invalidReferences.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.originalUrl.localeCompare(b.originalUrl))) {
      console.log(`INVALID_REFERENCE | ${ref.reason} | ${ref.originalUrl}`);
      console.log(`  -> ${formatReference(ref)}`);
    }
  }

  console.log("\n--------------------------------------------------");
  console.log("SHARED LOCAL FILES");
  console.log("--------------------------------------------------");
  if (sharedFiles.length === 0) {
    console.log("(none)");
  } else {
    for (const file of sharedFiles) {
      console.log(
        `SHARED | ${file.relativePath} | refs=${file.referenceCount} | records=${file.recordCount} | sourceTables=${file.sourceCount}`,
      );
      for (const ref of file.references) {
        console.log(`  -> ${formatReference(ref)}`);
      }
    }
  }

  console.log("\n--------------------------------------------------");
  console.log("COMMERCIAL PRODUCT IMAGES MISSING ON DISK");
  console.log("--------------------------------------------------");
  if (missingCommercialProducts.length === 0) {
    console.log("(none)");
  } else {
    for (const missing of missingCommercialProducts.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      console.log(`COMMERCIAL_PRODUCT_MISSING | ${missing.relativePath}`);
      for (const ref of missing.references.filter((item) => item.sourceKey === "branch_commercial_products.photo_url")) {
        console.log(`  -> ${formatReference(ref)}`);
      }
    }
  }

  console.log("\nDONE");
  console.log("This audit is read-only. It does not delete files and does not modify database rows.");
}

main().catch((err) => {
  console.error("Upload audit failed:", err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
