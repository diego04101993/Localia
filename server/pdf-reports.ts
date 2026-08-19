import path from "path";
import sharp from "sharp";
import { createRequire } from "module";
import { getUploadsDir, resolveLocalUploadPath } from "./media-storage";

const require = createRequire(path.join(process.cwd(), "server", "pdf-reports.ts"));

type PdfMakeDocument = {
  getBuffer(): Promise<Uint8Array | Buffer>;
};

type PdfMakeServer = {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setLocalAccessPolicy(callback: (filePath: string) => boolean): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  createPdf(docDefinition: Record<string, unknown>, options?: Record<string, unknown>): PdfMakeDocument;
};

const pdfMake = require("pdfmake") as PdfMakeServer;
const pdfMakeRoot = path.dirname(require.resolve("pdfmake/package.json"));
const robotoDir = path.join(pdfMakeRoot, "fonts", "Roboto");

const FONT_PATHS = {
  normal: path.join(robotoDir, "Roboto-Regular.ttf"),
  bold: path.join(robotoDir, "Roboto-Medium.ttf"),
  italics: path.join(robotoDir, "Roboto-Italic.ttf"),
  bolditalics: path.join(robotoDir, "Roboto-MediumItalic.ttf"),
};

function normalizeFsPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
}

function isPathInsideRoot(filePath: string, rootDir: string): boolean {
  const normalizedPath = normalizeFsPath(filePath);
  const normalizedRoot = normalizeFsPath(rootDir);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

pdfMake.setFonts({
  Roboto: FONT_PATHS,
});

pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((filePath) => {
  return isPathInsideRoot(filePath, robotoDir) || isPathInsideRoot(filePath, getUploadsDir());
});

const PDF_PAGE_MARGINS = [28, 92, 28, 42] as const;
const BRAND_TEXT = "WebCool";
const BRAND_COLOR = "#0f172a";
const MUTED_TEXT_COLOR = "#475569";
const BORDER_COLOR = "#dbe4f0";
const TABLE_HEADER_FILL = "#e8eef7";
const SECTION_TITLE_COLOR = "#1d4ed8";

export interface PdfReportBranding {
  branchName: string;
  logoUrl: string | null;
}

export interface FinancePdfRow {
  entryDate: string;
  typeLabel: string;
  category: string | null;
  concept: string | null;
  clientDisplayName: string | null;
  clientEmail: string | null;
  paymentMethod: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number;
  notes: string | null;
}

export interface FinancePdfReportData {
  branding: PdfReportBranding;
  generatedAt: Date;
  periodLabel: string;
  summary: {
    totalIncome: number;
    incomeBaseBeforeTax: number;
    incomeTransferredTax: number;
    totalExpense: number;
    netProfit: number;
  };
  rows: FinancePdfRow[];
}

export interface ClientPdfRow {
  fullName: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthDate: string | null;
  membershipStatus: string | null;
  joinedAt: string | null;
  lastSeenAt: string | null;
  planName: string | null;
  classesRemaining: number | null;
}

export interface ClientsPdfReportData {
  branding: PdfReportBranding;
  generatedAt: Date;
  summary: {
    totalClients: number;
    activeClients: number;
    withPlanCount: number;
  };
  rows: ClientPdfRow[];
}

export interface LeaseQuotePdfInstallmentRow {
  installmentLabel: string;
  dueDate: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface LeaseQuotePdfReportData {
  branding: PdfReportBranding;
  generatedAt: Date;
  clientDisplayName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  leasedItemDescription: string;
  startDate: string;
  contractEndDate: string;
  termMonths: number;
  capturedAssetValueAmount: number;
  assetSubtotalBeforeTaxAmount: number;
  assetTaxAmount: number;
  downPaymentAmount: number;
  financedPrincipalAmount: number;
  surchargeRate: number;
  surchargeAmount: number;
  financedSubtotalBeforeTaxAmount: number;
  contractTaxAmount: number;
  financedFinalAmount: number;
  contractFinalAmount: number;
  approximateInstallmentAmount: number;
  hasAdjustedFinalInstallment: boolean;
  finalInstallmentAmount: number;
  notes: string | null;
  taxModeLabel: string;
  rows: LeaseQuotePdfInstallmentRow[];
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const normalized = value.toFixed(4).replace(/\.?0+$/, "");
  return `${normalized}%`;
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dateFormatter.format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return dateFormatter.format(parsed);
}

function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}

function safeText(value: string | null | undefined, fallback = "-"): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const resolved = safeText(value, "");
  if (!resolved) return "-";
  if (resolved.length <= maxLength) return resolved;
  return `${resolved.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function wrapTableText(value: string | null | undefined, fallback = "-"): string {
  return safeText(value, fallback);
}

function buildStackCell(lines: Array<string | null | undefined>): { stack: Array<{ text: string }> } {
  const filtered = lines
    .map((line) => (typeof line === "string" ? line.trim() : ""))
    .filter((line) => line.length > 0);

  if (!filtered.length) {
    return { stack: [{ text: "-" }] };
  }

  return {
    stack: filtered.map((line) => ({ text: line })),
  };
}

async function loadLogoDataUrl(logoUrl: string | null): Promise<string | null> {
  const localPath = resolveLocalUploadPath(logoUrl);
  if (!localPath) return null;

  try {
    const imageBuffer = await sharp(localPath)
      .resize({
        width: 160,
        height: 64,
        fit: "contain",
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function renderPdfBuffer(docDefinition: Record<string, unknown>): Promise<Buffer> {
  const pdfDocument = pdfMake.createPdf(docDefinition);
  const buffer = await pdfDocument.getBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

function buildHeader(
  branding: PdfReportBranding,
  logoDataUrl: string | null,
  reportTitle: string,
  subtitle: string,
  generatedAt: Date,
) {
  return (_currentPage: number, _pageCount: number, pageSize: { width: number }) => ({
    margin: [28, 18, 28, 10],
    stack: [
      {
        columns: [
          logoDataUrl
            ? { image: logoDataUrl, width: 96, height: 42, fit: [96, 42] }
            : {
                width: 96,
                stack: [
                  { text: BRAND_TEXT, style: "brandFallback" },
                  { text: "Reportes", style: "brandFallbackSubtle" },
                ],
              },
          {
            width: "*",
            stack: [
              { text: branding.branchName, style: "headerBranchName" },
              { text: reportTitle, style: "headerTitle" },
              { text: subtitle, style: "headerMeta" },
              { text: `Generado: ${formatDateTime(generatedAt)}`, style: "headerMeta" },
            ],
            margin: [14, 0, 0, 0],
          },
        ],
      },
      {
        margin: [0, 10, 0, 0],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: pageSize.width - PDF_PAGE_MARGINS[0] - PDF_PAGE_MARGINS[2],
            y2: 0,
            lineWidth: 1,
            lineColor: BORDER_COLOR,
          },
        ],
      },
    ],
  });
}

function buildFooter(currentPage: number, pageCount: number) {
  return {
    margin: [28, 8, 28, 10],
    columns: [
      {
        text: `${BRAND_TEXT} · Reporte generado automáticamente`,
        color: MUTED_TEXT_COLOR,
        fontSize: 8,
      },
      {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: "right",
        color: MUTED_TEXT_COLOR,
        fontSize: 8,
      },
    ],
  };
}

function buildSummaryCards(cards: Array<{ label: string; value: string; accent: string }>) {
  return {
    margin: [0, 0, 0, 14],
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 12,
      vLineColor: () => "white",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    table: {
      widths: Array.from({ length: cards.length }, () => "*"),
      body: [
        cards.map((card) => ({
          stack: [
            { text: card.label, style: "summaryLabel" },
            { text: card.value, style: "summaryValue" },
          ],
          fillColor: "#f8fbff",
          border: [true, true, true, true],
          borderColor: BORDER_COLOR,
          margin: [12, 10, 12, 10],
          canvas: [
            {
              type: "rect",
              x: 0,
              y: 0,
              w: 4,
              h: 42,
              color: card.accent,
            },
          ],
        })),
      ],
    },
  };
}

function getCommonStyles() {
  return {
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: BRAND_COLOR,
    },
    styles: {
      brandFallback: {
        fontSize: 18,
        bold: true,
        color: SECTION_TITLE_COLOR,
      },
      brandFallbackSubtle: {
        fontSize: 10,
        color: MUTED_TEXT_COLOR,
      },
      headerBranchName: {
        fontSize: 16,
        bold: true,
      },
      headerTitle: {
        fontSize: 14,
        bold: true,
        color: SECTION_TITLE_COLOR,
        margin: [0, 2, 0, 0],
      },
      headerMeta: {
        fontSize: 9,
        color: MUTED_TEXT_COLOR,
        margin: [0, 2, 0, 0],
      },
      sectionTitle: {
        fontSize: 12,
        bold: true,
        color: SECTION_TITLE_COLOR,
        margin: [0, 0, 0, 6],
      },
      summaryLabel: {
        fontSize: 9,
        color: MUTED_TEXT_COLOR,
      },
      summaryValue: {
        fontSize: 15,
        bold: true,
        margin: [0, 3, 0, 0],
      },
      tableHeader: {
        fontSize: 8.5,
        bold: true,
        color: BRAND_COLOR,
      },
      tableCell: {
        fontSize: 8,
        lineHeight: 1.15,
      },
      amountIncome: {
        fontSize: 8,
        bold: true,
        color: "#166534",
        alignment: "right",
      },
      amountExpense: {
        fontSize: 8,
        bold: true,
        color: "#b91c1c",
        alignment: "right",
      },
      subtleCell: {
        fontSize: 7.5,
        color: MUTED_TEXT_COLOR,
      },
    },
  };
}

export async function buildBranchFinancePdfReport(data: FinancePdfReportData): Promise<Buffer> {
  const logoDataUrl = await loadLogoDataUrl(data.branding.logoUrl);
  const body = [
    [
      { text: "Fecha", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Tipo", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Categoría", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Concepto", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Cliente", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Correo cliente", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Método de pago", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Subtotal", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "right" },
      { text: "IVA", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "right" },
      { text: "Total", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "right" },
      { text: "Notas", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
    ],
    ...data.rows.map((row) => [
      { text: formatDateOnly(row.entryDate), style: "tableCell" },
      { text: safeText(row.typeLabel), style: "tableCell" },
      { text: wrapTableText(row.category), style: "tableCell" },
      { text: wrapTableText(row.concept), style: "tableCell" },
      { text: wrapTableText(row.clientDisplayName), style: "tableCell" },
      { text: wrapTableText(row.clientEmail), style: "tableCell" },
      { text: wrapTableText(row.paymentMethod), style: "tableCell" },
      {
        text: row.subtotalAmount === null ? "-" : formatCurrency(row.subtotalAmount),
        style: "tableCell",
        alignment: "right",
      },
      {
        text: row.taxAmount === null ? "-" : formatCurrency(row.taxAmount),
        style: "tableCell",
        alignment: "right",
      },
      {
        text: formatCurrency(row.totalAmount),
        style: row.typeLabel === "Ingreso" ? "amountIncome" : "amountExpense",
      },
      { text: wrapTableText(row.notes), style: "tableCell" },
    ]),
  ];

  const commonStyles = getCommonStyles() as {
    styles?: Record<string, Record<string, unknown>>;
  };
  if (commonStyles.styles?.tableHeader) {
    commonStyles.styles.tableHeader.fontSize = 7.6;
  }
  if (commonStyles.styles?.tableCell) {
    commonStyles.styles.tableCell.fontSize = 7.25;
    commonStyles.styles.tableCell.lineHeight = 1.12;
  }
  if (commonStyles.styles?.amountIncome) {
    commonStyles.styles.amountIncome.fontSize = 7.25;
  }
  if (commonStyles.styles?.amountExpense) {
    commonStyles.styles.amountExpense.fontSize = 7.25;
  }

  const docDefinition: Record<string, unknown> = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: PDF_PAGE_MARGINS,
    header: buildHeader(
      data.branding,
      logoDataUrl,
      "Reporte de Caja",
      data.periodLabel,
      data.generatedAt,
    ),
    footer: buildFooter,
    info: {
      title: `Reporte de Caja - ${data.branding.branchName}`,
      author: BRAND_TEXT,
      subject: "Reporte de Caja",
    },
    content: [
      buildSummaryCards([
        { label: "Ingresos cobrados", value: formatCurrency(data.summary.totalIncome), accent: "#0f766e" },
        { label: "Base antes de IVA", value: formatCurrency(data.summary.incomeBaseBeforeTax), accent: "#2563eb" },
        { label: "IVA trasladado", value: formatCurrency(data.summary.incomeTransferredTax), accent: "#ea580c" },
        { label: "Egresos", value: formatCurrency(data.summary.totalExpense), accent: "#b91c1c" },
        { label: "Resultado", value: formatCurrency(data.summary.netProfit), accent: "#1d4ed8" },
      ]),
      { text: "Movimientos", style: "sectionTitle" },
      {
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? TABLE_HEADER_FILL : rowIndex % 2 === 0 ? "#f8fafc" : null),
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        table: {
          headerRows: 1,
          widths: [42, 36, 42, 160, 68, 96, 42, 50, 40, 54, "*"],
          body,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
        },
      },
    ],
    ...commonStyles,
  };

  return renderPdfBuffer(docDefinition);
}

export async function buildBranchClientsPdfReport(data: ClientsPdfReportData): Promise<Buffer> {
  const logoDataUrl = await loadLogoDataUrl(data.branding.logoUrl);
  const body = [
    [
      { text: "Cliente", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Contacto", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Perfil", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Estado", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Ingreso", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Última visita", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Plan", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Clases", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "center" },
    ],
    ...data.rows.map((row) => [
      {
        ...buildStackCell([row.fullName]),
        style: "tableCell",
      },
      {
        ...buildStackCell([
          truncateText(row.email, 44) !== "-" ? truncateText(row.email, 44) : null,
          safeText(row.phone, "-"),
        ]),
        style: "tableCell",
      },
      {
        ...buildStackCell([
          safeText(row.gender, "-"),
          row.birthDate ? `Nacimiento: ${formatDateOnly(row.birthDate)}` : null,
        ]),
        style: "tableCell",
      },
      { text: safeText(row.membershipStatus), style: "tableCell" },
      { text: formatDateOnly(row.joinedAt), style: "tableCell" },
      { text: formatDateOnly(row.lastSeenAt), style: "tableCell" },
      {
        ...buildStackCell([truncateText(row.planName, 48)]),
        style: "tableCell",
      },
      {
        text: row.classesRemaining === null || row.classesRemaining === undefined ? "-" : String(row.classesRemaining),
        style: "tableCell",
        alignment: "center",
      },
    ]),
  ];

  const docDefinition: Record<string, unknown> = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: PDF_PAGE_MARGINS,
    header: buildHeader(
      data.branding,
      logoDataUrl,
      "Directorio / Reporte de Clientes",
      "Clientes de la sucursal",
      data.generatedAt,
    ),
    footer: buildFooter,
    info: {
      title: `Reporte de Clientes - ${data.branding.branchName}`,
      author: BRAND_TEXT,
      subject: "Reporte de Clientes",
    },
    content: [
      buildSummaryCards([
        { label: "Total clientes", value: String(data.summary.totalClients), accent: "#1d4ed8" },
        { label: "Clientes activos", value: String(data.summary.activeClients), accent: "#0f766e" },
        { label: "Con servicio o plan", value: String(data.summary.withPlanCount), accent: "#7c3aed" },
      ]),
      { text: "Clientes", style: "sectionTitle" },
      {
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? TABLE_HEADER_FILL : rowIndex % 2 === 0 ? "#f8fafc" : null),
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        table: {
          headerRows: 1,
          widths: [118, 150, 82, 60, 58, 62, "*", 44],
          body,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
        },
      },
    ],
    ...getCommonStyles(),
  };

  return renderPdfBuffer(docDefinition);
}

export async function buildBranchLeaseQuotePdfReport(data: LeaseQuotePdfReportData): Promise<Buffer> {
  const logoDataUrl = await loadLogoDataUrl(data.branding.logoUrl);
  const body = [
    [
      { text: "#", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "center" },
      { text: "Vencimiento", style: "tableHeader", fillColor: TABLE_HEADER_FILL },
      { text: "Subtotal", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "right" },
      { text: "IVA", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "right" },
      { text: "Total", style: "tableHeader", fillColor: TABLE_HEADER_FILL, alignment: "right" },
    ],
    ...data.rows.map((row) => [
      { text: row.installmentLabel, style: "tableCell", alignment: "center" },
      { text: formatDateOnly(row.dueDate), style: "tableCell" },
      { text: formatCurrency(row.subtotalAmount), style: "tableCell", alignment: "right" },
      { text: formatCurrency(row.taxAmount), style: "tableCell", alignment: "right" },
      { text: formatCurrency(row.totalAmount), style: "amountIncome" },
    ]),
  ];

  const adjustmentNote = data.hasAdjustedFinalInstallment
    ? `Las mensualidades se muestran con importe uniforme y la última puede ajustarse por centavos para cuadrar el total exacto. Última mensualidad: ${formatCurrency(data.finalInstallmentAmount)}.`
    : null;

  const docDefinition: Record<string, unknown> = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: PDF_PAGE_MARGINS,
    header: buildHeader(
      data.branding,
      logoDataUrl,
      "Corrida de Arrendamiento",
      "Vista previa sin crear contrato ni registrar cobros",
      data.generatedAt,
    ),
    footer: buildFooter,
    info: {
      title: `Corrida de Arrendamiento - ${data.branding.branchName}`,
      author: BRAND_TEXT,
      subject: "Corrida de Arrendamiento",
    },
    content: [
      buildSummaryCards([
        { label: "Valor del bien", value: formatCurrency(data.capturedAssetValueAmount), accent: "#2563eb" },
        { label: "Enganche", value: formatCurrency(data.downPaymentAmount), accent: "#0f766e" },
        { label: "Capital financiado", value: formatCurrency(data.financedPrincipalAmount), accent: "#1d4ed8" },
      ]),
      buildSummaryCards([
        { label: "Interés / recargo total", value: formatPercent(data.surchargeRate), accent: "#ea580c" },
        { label: "Monto del recargo", value: formatCurrency(data.surchargeAmount), accent: "#b45309" },
        { label: "Subtotal financiado", value: formatCurrency(data.financedSubtotalBeforeTaxAmount), accent: "#0f766e" },
      ]),
      buildSummaryCards([
        { label: "IVA financiado", value: formatCurrency(data.contractTaxAmount), accent: "#7c3aed" },
        { label: "Total financiado", value: formatCurrency(data.financedFinalAmount), accent: "#6d28d9" },
        { label: "Total contractual", value: formatCurrency(data.contractFinalAmount), accent: "#0f172a" },
      ]),
      buildSummaryCards([
        { label: "Plazo", value: `${data.termMonths} meses`, accent: "#2563eb" },
        { label: "Mensualidad aproximada", value: formatCurrency(data.approximateInstallmentAmount), accent: "#1f2937" },
        { label: "Tratamiento IVA", value: data.taxModeLabel, accent: "#64748b" },
      ]),
      { text: "Datos de la corrida", style: "sectionTitle" },
      {
        layout: {
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        table: {
          widths: ["*", "*"],
          body: [
            [
              {
                stack: [
                  { text: "Cliente", style: "tableHeader" },
                  { text: safeText(data.clientDisplayName), style: "tableCell" },
                  { text: safeText(data.clientEmail), style: "subtleCell" },
                  { text: safeText(data.clientPhone), style: "subtleCell" },
                ],
              },
              {
                stack: [
                  { text: "Bien / equipo", style: "tableHeader" },
                  { text: safeText(data.leasedItemDescription), style: "tableCell" },
                  { text: safeText(data.notes, "Sin notas"), style: "subtleCell" },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: "Inicio", style: "tableHeader" },
                  { text: formatDateOnly(data.startDate), style: "tableCell" },
                ],
              },
              {
                stack: [
                  { text: "Fin contractual", style: "tableHeader" },
                  { text: formatDateOnly(data.contractEndDate), style: "tableCell" },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: "Plazo", style: "tableHeader" },
                  { text: `${data.termMonths} meses`, style: "tableCell" },
                ],
              },
              {
                stack: [
                  { text: "Tratamiento IVA", style: "tableHeader" },
                  { text: data.taxModeLabel, style: "tableCell" },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: "Base antes de IVA", style: "tableHeader" },
                  { text: formatCurrency(data.assetSubtotalBeforeTaxAmount), style: "tableCell" },
                ],
              },
              {
                stack: [
                  { text: "IVA del valor capturado", style: "tableHeader" },
                  { text: formatCurrency(data.assetTaxAmount), style: "tableCell" },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: "Enganche", style: "tableHeader" },
                  { text: formatCurrency(data.downPaymentAmount), style: "tableCell" },
                ],
              },
              {
                stack: [
                  { text: "Capital financiado", style: "tableHeader" },
                  { text: formatCurrency(data.financedPrincipalAmount), style: "tableCell" },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: "Total financiado", style: "tableHeader" },
                  { text: formatCurrency(data.financedFinalAmount), style: "tableCell" },
                ],
              },
              {
                stack: [
                  { text: "Total contractual", style: "tableHeader" },
                  { text: formatCurrency(data.contractFinalAmount), style: "tableCell" },
                ],
              },
            ],
          ],
        },
      },
      adjustmentNote
        ? {
            margin: [0, 10, 0, 10],
            text: adjustmentNote,
            color: MUTED_TEXT_COLOR,
            fontSize: 8.5,
          }
        : { text: "" },
      { text: "Corrida completa", style: "sectionTitle" },
      {
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? TABLE_HEADER_FILL : rowIndex % 2 === 0 ? "#f8fafc" : null),
          hLineColor: () => BORDER_COLOR,
          vLineColor: () => BORDER_COLOR,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        table: {
          headerRows: 1,
          widths: [42, 88, 92, 72, 92],
          body,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
        },
      },
    ],
    ...getCommonStyles(),
  };

  return renderPdfBuffer(docDefinition);
}
