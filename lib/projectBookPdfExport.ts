import type { UserOptions } from "jspdf-autotable";

import {
  addBrandHeader,
  addDocumentMeta,
  addPageNumbers,
  ensurePdfUnicodeFont,
  pdfTableTheme,
  renderPdfTable,
  resolvePageBreak,
} from "./pdfExport";

export type ProjectBookChapter = {
  title: string;
  description?: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string>>;
  emptyMessage?: string;
  columnStyles?: UserOptions["columnStyles"];
};

type ExportProjectBookPdfOptions = {
  brand?: {
    teamName: string;
    teamImageUrl?: string;
  };
  chapters: ProjectBookChapter[];
  fileName: string;
  generatedOn: string;
  subtitle?: string;
  title: string;
};

export async function exportProjectBookPdf(
  options: ExportProjectBookPdfOptions,
): Promise<void> {
  const jsPdfModule = await import("jspdf");
  const jsPDF = jsPdfModule.jsPDF ?? jsPdfModule.default;

  const doc = new jsPDF({
    putOnlyUsedFonts: true,
    format: "a4",
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
        teamName: options.brand.teamName,
        teamImageUrl: options.brand.teamImageUrl,
        fontFamily: pdfFontFamily,
      })
    : undefined;

  let yPosition = addDocumentMeta(doc, {
    title: options.title,
    subtitle: options.subtitle,
    generatedOn: options.generatedOn,
    startY: headerStartY,
    fontFamily: pdfFontFamily,
  });

  for (const chapter of options.chapters) {
    yPosition = resolvePageBreak(doc, yPosition, 28);

    doc.setFont(pdfFontFamily, "bold");
    doc.setFontSize(14);
    doc.setTextColor(24, 24, 24);
    doc.text(chapter.title, 18, yPosition);
    yPosition += 6;

    if (chapter.description) {
      doc.setFont(pdfFontFamily, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(95, 95, 95);
      const lines = doc.splitTextToSize(chapter.description, 174);
      doc.text(lines, 18, yPosition);
      yPosition += lines.length * 4.5;
    }

    if (chapter.rows.length === 0) {
      doc.setFont(pdfFontFamily, "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(chapter.emptyMessage || "No data available for this section.", 18, yPosition);
      yPosition += 10;
      continue;
    }

    await renderPdfTable(doc, {
      ...pdfTableTheme,
      startY: yPosition,
      head: [chapter.columns.map((column) => column.label)],
      body: chapter.rows.map((row) =>
        chapter.columns.map((column) => row[column.key] || "-"),
      ),
      columnStyles: chapter.columnStyles,
      styles: {
        ...pdfTableTheme.styles,
        font: pdfFontFamily,
      },
      headStyles: {
        ...pdfTableTheme.headStyles,
        font: pdfFontFamily,
      },
    });

    yPosition =
      ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ||
        yPosition) + 10;
  }

  addPageNumbers(doc, pdfFontFamily);
  doc.save(options.fileName);
}
