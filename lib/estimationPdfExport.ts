import { format } from "date-fns";
import type { jsPDF } from "jspdf";

import {
  addBrandHeader,
  addDocumentMeta,
  addPageNumbers,
  ensurePdfUnicodeFont,
  formatMoney,
  pdfTableTheme,
  renderPdfTable,
  resolvePageBreak,
} from "./pdfExport";
import {
  calculateTaxBreakdown,
  resolveOrganizationTaxSettings,
  type OrganizationTaxSettings,
} from "./organizationTax";

type EstimationTaxSnapshot = {
  taxEnabled: boolean;
  taxLabel: string;
  priceDisplay?: OrganizationTaxSettings["priceDisplay"];
  taxRate: number;
};

type EstimationPdfLineItem = {
  name: string;
  notes?: string | null;
  quantity: number;
  sourceItemId?: string | null;
  totalPrice?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
};

type EstimationPdfExportPayload = {
  _id: string;
  contact?: {
    address?: string | null;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
  } | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  discountAmount?: number | null;
  estimationDate: number;
  estimationNumber?: string | null;
  grossTotal?: number | null;
  laborItems: EstimationPdfLineItem[];
  laborTotal?: number | null;
  location?: string | null;
  materialItems: EstimationPdfLineItem[];
  materialsTotal?: number | null;
  netTotal?: number | null;
  notes?: string | null;
  plannedStartDate?: number | null;
  status: string;
  taxSnapshot?: EstimationTaxSnapshot | null;
  title: string;
  validUntil?: number | null;
  vatAmount?: number | null;
  vatPercent: number;
};

type EstimationPdfExportOptions = {
  brand?: {
    teamImageUrl?: string;
    teamName: string;
  };
  currencySymbol: string;
  estimation: EstimationPdfExportPayload;
  fileName: string;
  generatedOn: string;
  organizationTaxSettings?: Partial<OrganizationTaxSettings> | null;
  projectName: string;
};

const PAGE_LEFT = 18;
const PAGE_RIGHT = 18;
const DETAIL_LABEL_WIDTH = 34;
const STATUS_LABELS: Record<string, string> = {
  accepted: "Accepted",
  draft: "Draft",
  expired: "Expired",
  rejected: "Rejected",
  sent: "Sent",
};

function normalizeText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildDocumentTaxSettings(
  estimation: EstimationPdfExportPayload,
  organizationTaxSettings?: Partial<OrganizationTaxSettings> | null,
): OrganizationTaxSettings {
  const base = resolveOrganizationTaxSettings(organizationTaxSettings);
  const snapshot = estimation.taxSnapshot;

  if (snapshot?.taxEnabled) {
    return {
      taxEnabled: true,
      taxLabel: snapshot.taxLabel || base.taxLabel,
      taxRate: snapshot.taxRate,
      priceDisplay: base.priceDisplay,
    };
  }

  if (estimation.vatPercent > 0) {
    return {
      taxEnabled: true,
      taxLabel: base.taxLabel,
      taxRate: estimation.vatPercent,
      priceDisplay: base.priceDisplay,
    };
  }

  return {
    ...base,
    taxEnabled: false,
    taxRate: 0,
  };
}

function getPriceColumns(
  taxSettings: OrganizationTaxSettings,
): Array<{ key: string; label: string }> {
  void taxSettings;
  return [
    { key: "unitNet", label: "Unit Net" },
    { key: "totalNet", label: "Net Total" },
  ];
}

function buildRows(
  items: EstimationPdfLineItem[],
  currencySymbol: string,
  taxSettings: OrganizationTaxSettings,
  kind: "labor" | "materials",
) {
  return items.map((item) => {
    const unitBreakdown = calculateTaxBreakdown(item.unitPrice, taxSettings);
    const totalBreakdown = calculateTaxBreakdown(item.totalPrice, taxSettings);

    return {
      item: item.name,
      qty: String(item.quantity),
      unit: kind === "labor" ? item.unit?.trim() || "-" : undefined,
      unitGross: formatMoney(unitBreakdown.gross, currencySymbol),
      unitNet: formatMoney(unitBreakdown.net, currencySymbol),
      unitTax: formatMoney(unitBreakdown.tax, currencySymbol),
      totalGross: formatMoney(totalBreakdown.gross, currencySymbol),
      totalNet: formatMoney(totalBreakdown.net, currencySymbol),
      totalTax: formatMoney(totalBreakdown.tax, currencySymbol),
    };
  });
}

function drawDetailColumn(
  doc: jsPDF,
  items: Array<{ label: string; value: string }>,
  options: { fontFamily: string; startX: number; startY: number; valueWidth: number },
): number {
  const { fontFamily, startX, startY, valueWidth } = options;
  let y = startY;

  for (const item of items) {
    const lines = doc.splitTextToSize(item.value, valueWidth);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(item.label, startX, y);

    doc.setFont(fontFamily, "normal");
    doc.setTextColor(24, 24, 24);
    doc.text(lines, startX + DETAIL_LABEL_WIDTH, y);
    y += Math.max(lines.length, 1) * 5 + 2;
  }

  return y;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function drawSubtotal(
  doc: jsPDF,
  options: {
    amount: string;
    fontFamily: string;
    label: string;
    pageWidth: number;
    startY: number;
  },
): number {
  const { amount, fontFamily, label, pageWidth, startY } = options;
  const labelX = pageWidth - PAGE_RIGHT - 72;
  const valueX = pageWidth - PAGE_RIGHT;

  doc.setDrawColor(220, 220, 220);
  doc.line(labelX, startY - 2, valueX, startY - 2);
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 24);
  doc.text(label, labelX, startY + 2);
  doc.text(amount, valueX, startY + 2, { align: "right" });

  return startY + 10;
}

function drawTotals(
  doc: jsPDF,
  options: {
    currencySymbol: string;
    estimation: EstimationPdfExportPayload;
    fontFamily: string;
    pageWidth: number;
    taxLabel: string;
    taxSettings: OrganizationTaxSettings;
    y: number;
  },
): number {
  const { currencySymbol, estimation, fontFamily, pageWidth, taxLabel, taxSettings } = options;
  const labelX = pageWidth - PAGE_RIGHT - 78;
  const valueX = pageWidth - PAGE_RIGHT;
  const laborTotal = estimation.laborTotal || 0;
  const materialsTotal = estimation.materialsTotal || 0;
  const netTotal = estimation.netTotal || 0;
  const taxAmount = estimation.vatAmount || 0;
  const total = estimation.grossTotal || 0;
  let y = options.y;

  const addRow = (
    label: string,
    value: string,
    fontStyle: "normal" | "bold",
    fontSize = 10,
    rowHeight = 7,
  ) => {
    doc.setFont(fontFamily, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(
      fontStyle === "normal" ? 90 : 24,
      fontStyle === "normal" ? 90 : 24,
      fontStyle === "normal" ? 90 : 24,
    );
    doc.text(label, labelX, y);
    doc.text(value, valueX, y, { align: "right" });
    y += rowHeight;
  };

  addRow("Labor", formatMoney(laborTotal, currencySymbol), "normal");
  addRow("Materials", formatMoney(materialsTotal, currencySymbol), "normal");

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(labelX, y - 2.5, valueX, y - 2.5);
  y += 2;

  addRow("Net total", formatMoney(netTotal, currencySymbol), "bold", 11, 8);

  if (taxSettings.taxEnabled) {
    addRow(
      `${taxLabel} (${taxSettings.taxRate}%)`,
      formatMoney(taxAmount, currencySymbol),
      "normal",
      10,
      7,
    );
  }

  doc.setDrawColor(24, 24, 24);
  doc.setLineWidth(0.6);
  doc.line(labelX, y - 2.5, valueX, y - 2.5);
  y += 4;
  addRow("Total", formatMoney(total, currencySymbol), "bold", 16, 9);

  return y;
}

async function buildEstimationPdfDoc(
  options: EstimationPdfExportOptions,
): Promise<jsPDF> {
  const jsPdfModule = await import("jspdf");
  const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;

  const doc = new jsPDF({
    format: "a4",
    putOnlyUsedFonts: true,
    unit: "mm",
  });

  let pdfFontFamily = "helvetica";
  try {
    pdfFontFamily = await ensurePdfUnicodeFont(doc);
  } catch (error) {
    console.warn("Unicode PDF font unavailable, using helvetica", error);
  }
  doc.setFont(pdfFontFamily, "normal");

  const headerStartY = options.brand
    ? await addBrandHeader(doc, {
        teamImageUrl: options.brand.teamImageUrl,
        teamName: options.brand.teamName,
        fontFamily: pdfFontFamily,
      })
    : undefined;

  const taxSettings = buildDocumentTaxSettings(
    options.estimation,
    options.organizationTaxSettings,
  );
  const taxLabel = options.estimation.taxSnapshot?.taxLabel || taxSettings.taxLabel;
  const priceColumns = getPriceColumns(taxSettings);
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = addDocumentMeta(doc, {
    title: options.estimation.title,
    subtitle: [
      "Estimation",
      options.estimation.estimationNumber
        ? `No. ${options.estimation.estimationNumber}`
        : null,
      `Status: ${
        STATUS_LABELS[options.estimation.status] || options.estimation.status
      }`,
    ]
      .filter(Boolean)
      .join(" | "),
    generatedOn: options.generatedOn,
    startY: headerStartY,
    fontFamily: pdfFontFamily,
  });
  y += 3;

  const leftColumnWidth = 84;
  const rightColumnStart = PAGE_LEFT + leftColumnWidth + 10;
  const rightColumnWidth = pageWidth - PAGE_RIGHT - rightColumnStart - DETAIL_LABEL_WIDTH;
  const leftDetails = [
    {
      label: "Date",
      value: format(new Date(options.estimation.estimationDate), "MMMM d, yyyy"),
    },
    ...(normalizeText(options.estimation.location)
      ? [{ label: "Location", value: normalizeText(options.estimation.location)! }]
      : []),
    ...(options.estimation.plannedStartDate
      ? [
          {
            label: "Planned start",
            value: format(new Date(options.estimation.plannedStartDate), "MMMM d, yyyy"),
          },
        ]
      : []),
    ...(options.estimation.validUntil
      ? [
          {
            label: "Valid until",
            value: format(new Date(options.estimation.validUntil), "MMMM d, yyyy"),
          },
        ]
      : []),
  ];
  const customerName =
    normalizeText(options.estimation.customerName) ||
    normalizeText(options.estimation.contact?.name);
  const customerAddress =
    normalizeText(options.estimation.customerAddress) ||
    normalizeText(options.estimation.contact?.address);
  const customerEmail =
    normalizeText(options.estimation.customerEmail) ||
    normalizeText(options.estimation.contact?.email);
  const customerPhone =
    normalizeText(options.estimation.customerPhone) ||
    normalizeText(options.estimation.contact?.phone);
  const rightDetails = [
    ...(customerName ? [{ label: "Customer", value: customerName }] : []),
    ...(customerAddress ? [{ label: "Address", value: customerAddress }] : []),
    ...(customerEmail ? [{ label: "Email", value: customerEmail }] : []),
    ...(customerPhone ? [{ label: "Phone", value: customerPhone }] : []),
  ];

  const leftBottomY = drawDetailColumn(doc, leftDetails, {
    fontFamily: pdfFontFamily,
    startX: PAGE_LEFT,
    startY: y,
    valueWidth: leftColumnWidth - DETAIL_LABEL_WIDTH,
  });
  const rightBottomY =
    rightDetails.length > 0
      ? drawDetailColumn(doc, rightDetails, {
          fontFamily: pdfFontFamily,
          startX: rightColumnStart,
          startY: y,
          valueWidth: rightColumnWidth,
        })
      : y;

  y = Math.max(leftBottomY, rightBottomY) + 6;

  const renderSectionTable = async (
    sectionTitle: string,
    rows: ReturnType<typeof buildRows>,
    kind: "labor" | "materials",
    subtotal: number,
  ) => {
    if (rows.length === 0) {
      return;
    }

    y = resolvePageBreak(doc, y, 32);
    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(13);
    doc.setTextColor(24, 24, 24);
    doc.text(sectionTitle, PAGE_LEFT, y);
    y += 5;

    const columns = [
      { key: "item", label: kind === "labor" ? "Work" : "Product" },
      { key: "qty", label: "Qty" },
      ...(kind === "labor" ? [{ key: "unit", label: "Unit" }] : []),
      ...priceColumns,
    ];

    await renderPdfTable(doc, {
      ...pdfTableTheme,
      startY: y,
      head: [columns.map((column) => column.label)],
      body: rows.map((row) => columns.map((column) => row[column.key as keyof typeof row] || "-")),
      styles: {
        ...pdfTableTheme.styles,
        font: pdfFontFamily,
      },
      headStyles: {
        ...pdfTableTheme.headStyles,
        font: pdfFontFamily,
      },
    });

    y =
      ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 6;
    y = drawSubtotal(doc, {
      amount: formatMoney(subtotal, options.currencySymbol),
      fontFamily: pdfFontFamily,
      label: `${sectionTitle} subtotal`,
      pageWidth,
      startY: y,
    });
  };

  await renderSectionTable(
    "Labor",
    buildRows(options.estimation.laborItems, options.currencySymbol, taxSettings, "labor"),
    "labor",
    options.estimation.laborTotal || 0,
  );
  await renderSectionTable(
    "Materials",
    buildRows(
      options.estimation.materialItems,
      options.currencySymbol,
      taxSettings,
      "materials",
    ),
    "materials",
    options.estimation.materialsTotal || 0,
  );

  y = resolvePageBreak(doc, y, 52);
  y = drawTotals(doc, {
    currencySymbol: options.currencySymbol,
    estimation: options.estimation,
    fontFamily: pdfFontFamily,
    pageWidth,
    taxLabel,
    taxSettings,
    y,
  });

  const notes = normalizeText(options.estimation.notes);
  if (notes) {
    y = resolvePageBreak(doc, y, 24);
    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(12);
    doc.setTextColor(24, 24, 24);
    doc.text("Notes", PAGE_LEFT, y);
    y += 6;
    doc.setFont(pdfFontFamily, "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(doc.splitTextToSize(notes, pageWidth - PAGE_LEFT - PAGE_RIGHT), PAGE_LEFT, y);
  }

  addPageNumbers(doc, pdfFontFamily);
  return doc;
}

export async function exportEstimationPdf(
  options: EstimationPdfExportOptions,
): Promise<void> {
  const doc = await buildEstimationPdfDoc(options);
  doc.save(options.fileName);
}

export async function openEstimationPdfInNewTab(
  options: EstimationPdfExportOptions,
  targetWindow?: Window | null,
): Promise<void> {
  const doc = await buildEstimationPdfDoc(options);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const openedWindow = targetWindow ?? window.open("", "_blank");

  if (!openedWindow) {
    URL.revokeObjectURL(url);
    throw new Error("Could not open PDF in a new tab");
  }

  openedWindow.opener = null;
  openedWindow.document.open();
  openedWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.fileName)}</title>
    <style>
      html, body { height: 100%; margin: 0; background: #f4f1ec; }
      body { font-family: Arial, sans-serif; }
      iframe { border: 0; width: 100%; height: 100%; background: white; }
      .loading {
        display: flex; align-items: center; justify-content: center; height: 100%;
        color: #4a3b2e; font-size: 14px;
      }
    </style>
  </head>
  <body>
    <iframe src="${url}" title="${escapeHtml(options.fileName)}"></iframe>
    <script>
      window.addEventListener('beforeunload', function () {
        URL.revokeObjectURL('${url}');
      });
    </script>
  </body>
</html>`);
  openedWindow.document.close();
}
