import type { jsPDF } from "jspdf";

const PAGE_MARGIN = 18;
const HEADER_GAP = 12;
const FOOTER_MARGIN = 8;

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

export async function addBrandHeader(doc: jsPDF, options: { teamName: string; teamImageUrl?: string }): Promise<number> {
  const { teamName, teamImageUrl } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = PAGE_MARGIN;

  doc.setFont("helvetica", "bold");
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
  options: { title: string; subtitle?: string; generatedOn: string; startY?: number },
): number {
  let y = options.startY ?? PAGE_MARGIN + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(24, 24, 24);
  doc.text(options.title, PAGE_MARGIN, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);

  if (options.subtitle) {
    doc.text(options.subtitle, PAGE_MARGIN, y);
    y += 5;
  }

  doc.text(`Generated: ${options.generatedOn}`, PAGE_MARGIN, y);
  return y + 7;
}

export function addPageNumbers(doc: jsPDF): void {
  const pages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let index = 1; index <= pages; index += 1) {
    doc.setPage(index);
    doc.setFont("helvetica", "normal");
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
