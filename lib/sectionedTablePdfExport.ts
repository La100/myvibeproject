import type { UserOptions } from "jspdf-autotable";

import {
  addBrandHeader,
  addDocumentMeta,
  addPageNumbers,
  ensurePdfUnicodeFont,
  pdfTableTheme,
  renderPdfTable,
} from "./pdfExport";

export type SectionedTablePdfColumn = {
  key: string;
  label: string;
};

export type SectionedTablePdfRow = Record<string, string>;

export type SectionedTablePdfSection = {
  sectionName: string;
  rows: SectionedTablePdfRow[];
};

type SectionedTablePdfExportOptions = {
  brand?: {
    teamName: string;
    teamImageUrl?: string;
  };
  columns: SectionedTablePdfColumn[];
  columnStyles?: UserOptions["columnStyles"];
  fileName: string;
  generatedOn: string;
  groupBySections?: boolean;
  sections: SectionedTablePdfSection[];
  subtitle?: string;
  title: string;
};

export async function exportSectionedTablePdf(
  options: SectionedTablePdfExportOptions,
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

  let yPosition: number = addDocumentMeta(doc, {
    title: options.title,
    subtitle: options.subtitle,
    generatedOn: options.generatedOn,
    startY: headerStartY,
    fontFamily: pdfFontFamily,
  });

  const head = [options.columns.map((column) => column.label)];
  const buildRows = (rows: SectionedTablePdfRow[]) =>
    rows.map((row) => options.columns.map((column) => row[column.key] || "-"));

  const renderRows = async (rows: SectionedTablePdfRow[]) => {
    await renderPdfTable(doc, {
      ...pdfTableTheme,
      startY: yPosition,
      head,
      body: buildRows(rows),
      columnStyles: options.columnStyles,
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
        yPosition) + 8;
  };

  if (options.groupBySections === false) {
    await renderRows(options.sections.flatMap((section) => section.rows));
  } else {
    for (const section of options.sections) {
      if (section.rows.length === 0) {
        continue;
      }

      doc.setFont(pdfFontFamily, "bold");
      doc.setFontSize(12);
      doc.text(section.sectionName, 18, yPosition);
      yPosition += 4;

      await renderRows(section.rows);
    }
  }

  addPageNumbers(doc, pdfFontFamily);
  doc.save(options.fileName);
}
