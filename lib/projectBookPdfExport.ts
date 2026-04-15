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

type ProjectBookTableChapter = {
  type?: "table";
  title: string;
  description?: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string>>;
  emptyMessage?: string;
  columnStyles?: UserOptions["columnStyles"];
};

type ProjectBookGallerySection = {
  title: string;
  items: Array<{
    title: string;
    imageUrl?: string;
  }>;
};

type ProjectBookGalleryChapter = {
  type: "gallery";
  title: string;
  description?: string;
  sections: ProjectBookGallerySection[];
  emptyMessage?: string;
};

export type ProjectBookChapter = ProjectBookTableChapter | ProjectBookGalleryChapter;

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
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.warn("Could not load moodboard image for PDF:", error);
    return null;
  }
}

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

    if (chapter.type === "gallery") {
      const gallerySections = chapter.sections.filter((section) => section.items.length > 0);

      if (gallerySections.length === 0) {
        doc.setFont(pdfFontFamily, "normal");
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text(chapter.emptyMessage || "No data available for this section.", 18, yPosition);
        yPosition += 10;
        continue;
      }

      const pageHeight = doc.internal.pageSize.getHeight();
      const leftX = 18;
      const gap = 8;
      const cardWidth = 83;
      const imageHeight = 55;
      const cardHeight = imageHeight + 12;
      let columnIndex = 0;

      for (const section of gallerySections) {
        yPosition = resolvePageBreak(doc, yPosition, 22);

        doc.setFont(pdfFontFamily, "bold");
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text(section.title, 18, yPosition);
        yPosition += 6;
        columnIndex = 0;

        for (const item of section.items) {
          if (columnIndex === 0) {
            yPosition = resolvePageBreak(doc, yPosition, cardHeight + 8);
          }

          const cardX = leftX + columnIndex * (cardWidth + gap);
          const cardY = yPosition;

          doc.setDrawColor(225, 225, 225);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(cardX, cardY, cardWidth, imageHeight, 3, 3, "FD");

          const loadedImage = item.imageUrl ? await loadImageAsDataUrl(item.imageUrl) : null;
          if (loadedImage) {
            const imageRatio = loadedImage.width / loadedImage.height || 1;
            let renderWidth = cardWidth - 4;
            let renderHeight = renderWidth / imageRatio;

            if (renderHeight > imageHeight - 4) {
              renderHeight = imageHeight - 4;
              renderWidth = renderHeight * imageRatio;
            }

            const imageX = cardX + (cardWidth - renderWidth) / 2;
            const imageY = cardY + (imageHeight - renderHeight) / 2;
            doc.addImage(loadedImage.dataUrl, "JPEG", imageX, imageY, renderWidth, renderHeight);
          } else {
            doc.setFont(pdfFontFamily, "normal");
            doc.setFontSize(9);
            doc.setTextColor(140, 140, 140);
            doc.text("Image unavailable", cardX + cardWidth / 2, cardY + imageHeight / 2, {
              align: "center",
            });
          }

          doc.setFont(pdfFontFamily, "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(75, 75, 75);
          const titleLines = doc.splitTextToSize(item.title, cardWidth);
          doc.text(titleLines.slice(0, 2), cardX, cardY + imageHeight + 5);

          if (columnIndex === 1) {
            yPosition += cardHeight + 6;
          }

          columnIndex = (columnIndex + 1) % 2;
        }

        if (columnIndex === 1) {
          yPosition += cardHeight + 6;
        }

        if (yPosition + 10 > pageHeight - 18) {
          yPosition = resolvePageBreak(doc, yPosition, 10);
        } else {
          yPosition += 4;
        }
      }

      continue;
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
