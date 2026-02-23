import type { jsPDF } from "jspdf";

const PAGE_MARGIN = 18;
const HEADER_GAP = 12;
const FOOTER_MARGIN = 8;
const PDF_UNICODE_FONT_FAMILY = "ArialUnicode";
const PDF_UNICODE_REGULAR_FILE = "Arial.ttf";
const PDF_UNICODE_BOLD_FILE = "Arial-Bold.ttf";

let regularFontBinaryPromise: Promise<string> | null = null;
let boldFontBinaryPromise: Promise<string> | null = null;

export function sanitizeFileName(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return sanitized || "export";
}

export function formatMoney(value: number | undefined, currencySymbol: string): string {
  if (value === undefined || value === null) {
    return "-";
  }
  return `${value.toFixed(2)} ${currencySymbol}`;
}

export function resolvePageBreak(doc: jsPDF, y: number, reserveHeight = 20): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + reserveHeight <= pageHeight - PAGE_MARGIN) {
    return y;
  }
  doc.addPage();
  return PAGE_MARGIN + 4;
}

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    result += String.fromCharCode(...chunk);
  }

  return result;
}

async function loadFontBinary(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load font: ${path}`);
  }
  const buffer = await response.arrayBuffer();
  return arrayBufferToBinaryString(buffer);
}

async function getUnicodeRegularFontBinary(): Promise<string> {
  if (!regularFontBinaryPromise) {
    regularFontBinaryPromise = loadFontBinary(`/fonts/${PDF_UNICODE_REGULAR_FILE}`);
  }
  return regularFontBinaryPromise;
}

async function getUnicodeBoldFontBinary(): Promise<string> {
  if (!boldFontBinaryPromise) {
    boldFontBinaryPromise = loadFontBinary(`/fonts/${PDF_UNICODE_BOLD_FILE}`);
  }
  return boldFontBinaryPromise;
}

export async function ensurePdfUnicodeFont(doc: jsPDF): Promise<string> {
  const [regularFontBinary, boldFontBinary] = await Promise.all([
    getUnicodeRegularFontBinary(),
    getUnicodeBoldFontBinary(),
  ]);

  doc.addFileToVFS(PDF_UNICODE_REGULAR_FILE, regularFontBinary);
  doc.addFont(PDF_UNICODE_REGULAR_FILE, PDF_UNICODE_FONT_FAMILY, "normal");
  doc.addFileToVFS(PDF_UNICODE_BOLD_FILE, boldFontBinary);
  doc.addFont(PDF_UNICODE_BOLD_FILE, PDF_UNICODE_FONT_FAMILY, "bold");

  return PDF_UNICODE_FONT_FAMILY;
}

export async function addBrandHeader(
  doc: jsPDF,
  options: { teamName: string; teamImageUrl?: string; fontFamily?: string },
): Promise<number> {
  const { teamName, teamImageUrl, fontFamily = "helvetica" } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = PAGE_MARGIN;

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(20);
  doc.setTextColor(24, 24, 24);
  doc.text(teamName || "Organization", PAGE_MARGIN, y);

  if (teamImageUrl) {
    const loaded = await loadImageAsDataUrl(teamImageUrl);
    if (loaded) {
      const maxLogoWidth = 26;
      const maxLogoHeight = 16;
      const aspectRatio = loaded.width / loaded.height || 1;
      let logoWidth = maxLogoWidth;
      let logoHeight = logoWidth / aspectRatio;

      if (logoHeight > maxLogoHeight) {
        logoHeight = maxLogoHeight;
        logoWidth = logoHeight * aspectRatio;
      }

      const logoX = pageWidth - PAGE_MARGIN - logoWidth;
      const logoY = y - 6;
      doc.addImage(loaded.dataUrl, "PNG", logoX, logoY, logoWidth, logoHeight);
    }
  }

  y += 5;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  return y + HEADER_GAP;
}

export function addDocumentMeta(
  doc: jsPDF,
  options: { title: string; subtitle?: string; generatedOn: string; startY?: number; fontFamily?: string },
): number {
  const fontFamily = options.fontFamily ?? "helvetica";
  let y = options.startY ?? PAGE_MARGIN + 20;

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(17);
  doc.setTextColor(24, 24, 24);
  doc.text(options.title, PAGE_MARGIN, y);

  y += 7;
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);

  if (options.subtitle) {
    doc.text(options.subtitle, PAGE_MARGIN, y);
    y += 5;
  }

  doc.text(`Generated: ${options.generatedOn}`, PAGE_MARGIN, y);
  return y + 7;
}

export function addPageNumbers(doc: jsPDF, fontFamily = "helvetica"): void {
  const pages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let index = 1; index <= pages; index += 1) {
    doc.setPage(index);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${index} / ${pages}`, pageWidth - PAGE_MARGIN, pageHeight - FOOTER_MARGIN, {
      align: "right",
    });
  }
}

async function loadImageAsDataUrl(
  imageUrl: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.warn("Could not load image for PDF header:", error);
    return null;
  }
}

export const pdfTableTheme = {
  margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  styles: {
    fontSize: 9,
    cellPadding: 3,
    lineColor: [230, 230, 230] as [number, number, number],
    lineWidth: 0.1,
    textColor: [28, 28, 28] as [number, number, number],
    overflow: "linebreak" as const,
    valign: "middle" as const,
  },
  headStyles: {
    fillColor: [48, 48, 48] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontSize: 9,
    fontStyle: "bold" as const,
  },
  alternateRowStyles: {
    fillColor: [248, 248, 248] as [number, number, number],
  },
  theme: "striped" as const,
};
