/**
 * scripts/audit-uploads.ts
 *
 * Auditoría de archivos huérfanos en /uploads.
 * Solo lee — no borra nada a menos que pases --delete.
 *
 * Uso:
 *   npx tsx scripts/audit-uploads.ts           ← solo auditoría
 *   npx tsx scripts/audit-uploads.ts --delete  ← auditoría + borrar huérfanos
 */

import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const DRY_RUN = !process.argv.includes("--delete");

// ─── Todas las consultas que devuelven rutas de archivo ─────────────────────
const QUERIES: Array<{ label: string; sql: string }> = [
  {
    label: "users.avatar_url",
    sql: `SELECT avatar_url AS url FROM users WHERE avatar_url IS NOT NULL`,
  },
  {
    label: "branches.cover_image_url",
    sql: `SELECT cover_image_url AS url FROM branches WHERE cover_image_url IS NOT NULL`,
  },
  {
    label: "class_schedules.routine_image_url",
    sql: `SELECT routine_image_url AS url FROM class_schedules WHERE routine_image_url IS NOT NULL`,
  },
  {
    label: "branch_photos.url",
    sql: `SELECT url FROM branch_photos WHERE url IS NOT NULL`,
  },
  {
    label: "branch_posts.media_url",
    sql: `SELECT media_url AS url FROM branch_posts WHERE media_url IS NOT NULL`,
  },
  {
    label: "branch_products.image_url",
    sql: `SELECT image_url AS url FROM branch_products WHERE image_url IS NOT NULL`,
  },
  {
    label: "branch_videos.url",
    sql: `SELECT url FROM branch_videos WHERE url IS NOT NULL`,
  },
  {
    label: "branch_videos.thumbnail_url",
    sql: `SELECT thumbnail_url AS url FROM branch_videos WHERE thumbnail_url IS NOT NULL`,
  },
  {
    label: "branch_announcements.image_url",
    sql: `SELECT image_url AS url FROM branch_announcements WHERE image_url IS NOT NULL`,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extrae el nombre de archivo de una URL/ruta. */
function toFilename(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/uploads\/([^?#]+)/);
  return match ? match[1] : null;
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "OK" : "NO DEFINIDA");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  AUDITORÍA DE ARCHIVOS /uploads");
  console.log(`  Modo: ${DRY_RUN ? "SOLO LECTURA (sin borrar)" : "⚠️  BORRADO ACTIVADO"}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Leer archivos físicos
  const physicalFiles = new Set<string>();
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`No existe el directorio: ${UPLOADS_DIR}`);
    process.exit(1);
  }
  for (const f of fs.readdirSync(UPLOADS_DIR)) {
    const stat = fs.statSync(path.join(UPLOADS_DIR, f));
    if (stat.isFile()) physicalFiles.add(f);
  }
  console.log(`Archivos físicos en /uploads: ${physicalFiles.size}\n`);

  // 2. Recopilar todas las referencias en la BD
  const referencedFiles = new Set<string>();
  const sourceMap = new Map<string, string[]>(); // filename → [tabla.columna, ...]

  for (const q of QUERIES) {
    const result = await client.query(q.sql);
    let count = 0;
    for (const row of result.rows) {
      const filename = toFilename(row.url);
      if (!filename) continue;
      referencedFiles.add(filename);
      if (!sourceMap.has(filename)) sourceMap.set(filename, []);
      sourceMap.get(filename)!.push(q.label);
      count++;
    }
    if (count > 0) {
      console.log(`  ✓ ${q.label}: ${count} referencia(s)`);
    }
  }

  await client.end();

  // 3. Clasificar
  const used: string[] = [];
  const orphans: string[] = [];

  for (const f of physicalFiles) {
    if (referencedFiles.has(f)) {
      used.push(f);
    } else {
      orphans.push(f);
    }
  }

  // 3b. Detectar referencias rotas (en BD pero no en disco)
  const missing: Array<{ file: string; source: string }> = [];
  for (const [filename, sources] of sourceMap.entries()) {
    if (!physicalFiles.has(filename)) {
      missing.push({ file: filename, source: sources.join(", ") });
    }
  }

  // 4. Reporte: usados
  console.log(`\n───────────────────────────────────────────────────`);
  console.log(`  ARCHIVOS USADOS: ${used.length}`);
  console.log(`───────────────────────────────────────────────────`);
  for (const f of used.sort()) {
    const sources = sourceMap.get(f)?.join(", ") ?? "—";
    const stat = fs.statSync(path.join(UPLOADS_DIR, f));
    console.log(`  ✅ ${f}  (${bytes(stat.size)})`);
    console.log(`      ↳ ${sources}`);
  }

  // 5. Reporte: huérfanos
  console.log(`\n───────────────────────────────────────────────────`);
  console.log(`  ARCHIVOS HUÉRFANOS: ${orphans.length}`);
  console.log(`───────────────────────────────────────────────────`);
  if (orphans.length === 0) {
    console.log("  (ninguno — todo está referenciado)");
  }

  let orphanTotalBytes = 0;
  for (const f of orphans.sort()) {
    const stat = fs.statSync(path.join(UPLOADS_DIR, f));
    orphanTotalBytes += stat.size;
    const marker = DRY_RUN ? "🗑 " : "❌ ELIMINANDO";
    console.log(`  ${marker} ${f}  (${bytes(stat.size)})`);

    if (!DRY_RUN) {
      fs.unlinkSync(path.join(UPLOADS_DIR, f));
    }
  }

  // 5b. Reporte: referencias rotas
  if (missing.length > 0) {
    console.log(`\n───────────────────────────────────────────────────`);
    console.log(`  ⚠️  REFERENCIAS ROTAS (en BD, no en disco): ${missing.length}`);
    console.log(`  (estos registros apuntan a archivos que ya no existen)`);
    console.log(`───────────────────────────────────────────────────`);
    for (const { file, source } of missing.sort((a, b) => a.file.localeCompare(b.file))) {
      console.log(`  🔗 ${file}`);
      console.log(`      ↳ ${source}`);
    }
  }

  // 6. Resumen
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RESUMEN`);
  console.log(`  Total físicos   : ${physicalFiles.size}`);
  console.log(`  Usados          : ${used.length}`);
  console.log(`  Huérfanos       : ${orphans.length}  (${bytes(orphanTotalBytes)})`);
  console.log(`  Refs. rotas BD  : ${missing.length}  (en BD, ya no en disco)`);
  if (DRY_RUN && orphans.length > 0) {
    console.log(`\n  Para borrar los huérfanos ejecuta:`);
    console.log(`  npx tsx scripts/audit-uploads.ts --delete`);
  } else if (!DRY_RUN && orphans.length > 0) {
    console.log(`\n  ✅ Huérfanos eliminados.`);
  }
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Error en auditoría:", err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
