type WorkbookCellValue = string | number | null | undefined;
type ExcelJsModule = Pick<typeof import("exceljs"), "Workbook">;

export type XlsxTable = {
  accentColor?: string;
  columnWidths?: number[];
  headers: string[];
  rows: WorkbookCellValue[][];
  title?: string;
};

export type XlsxSheet = {
  generatedOn: string;
  name: string;
  subtitle?: string;
  tables: XlsxTable[];
  title: string;
};

type ExportWorkbookTablesOptions = {
  fileName: string;
  sheets: XlsxSheet[];
};

const SECTION_COLOR_PALETTE = [
  "DCEBFF",
  "E4F6E7",
  "FFF0D9",
  "F7E6FF",
  "FFE3E8",
  "E5F7F7",
  "F7F0DD",
];

const TITLE_FILL = "F6F4EE";
const HEADER_FILL = "232323";
const HEADER_TEXT = "FFFFFF";

const toArgb = (value: string) => {
  const normalized = value.replace("#", "").toUpperCase();
  return normalized.length === 8 ? normalized : `FF${normalized}`;
};

const sanitizeSheetName = (value: string) => {
  const sanitized = value.replace(/[\\/*?:[\]]/g, " ").trim();
  return (sanitized || "Export").slice(0, 31);
};

const saveBufferAsFile = (buffer: ArrayBuffer, fileName: string) => {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getExcelJs = async () => {
  const excelModule = (await import("exceljs")) as unknown as {
    Workbook?: ExcelJsModule["Workbook"];
    default?: ExcelJsModule;
  };
  if (excelModule.Workbook) {
    return { Workbook: excelModule.Workbook };
  }
  if (excelModule.default) {
    return excelModule.default;
  }
  throw new Error("ExcelJS module is unavailable.");
};

const estimateWidth = (value: WorkbookCellValue) => String(value ?? "").length;

export const getSectionAccentColor = (index: number) =>
  SECTION_COLOR_PALETTE[index % SECTION_COLOR_PALETTE.length];

export async function exportWorkbookTables(
  options: ExportWorkbookTablesOptions,
): Promise<void> {
  const ExcelJS = await getExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  for (const sheet of options.sheets) {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(sheet.name));
    const maxColumnCount = Math.max(
      1,
      ...sheet.tables.map((table) => table.headers.length),
    );

    const titleRow = worksheet.addRow([sheet.title]);
    worksheet.mergeCells(titleRow.number, 1, titleRow.number, maxColumnCount);
    titleRow.height = 24;
    titleRow.getCell(1).font = { bold: true, size: 15 };
    titleRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: toArgb(TITLE_FILL) },
    };
    titleRow.getCell(1).alignment = { vertical: "middle" };

    if (sheet.subtitle) {
      const subtitleRow = worksheet.addRow([sheet.subtitle]);
      worksheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, maxColumnCount);
      subtitleRow.getCell(1).font = { size: 11, color: { argb: toArgb("5E5E5E") } };
    }

    const generatedOnRow = worksheet.addRow([`Generated: ${sheet.generatedOn}`]);
    worksheet.mergeCells(generatedOnRow.number, 1, generatedOnRow.number, maxColumnCount);
    generatedOnRow.getCell(1).font = { size: 10, color: { argb: toArgb("777777") } };
    worksheet.addRow([]);

    let firstHeaderRowNumber: number | null = null;
    const widthByColumn = Array.from({ length: maxColumnCount }, () => 12);

    sheet.tables.forEach((table, tableIndex) => {
      const tableAccent = toArgb(table.accentColor || getSectionAccentColor(tableIndex));
      if (table.title) {
        const sectionRow = worksheet.addRow([table.title]);
        worksheet.mergeCells(sectionRow.number, 1, sectionRow.number, table.headers.length);
        sectionRow.getCell(1).font = { bold: true, size: 12 };
        sectionRow.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: tableAccent },
        };
        sectionRow.getCell(1).border = {
          top: { style: "thin", color: { argb: toArgb("D9D4C8") } },
          bottom: { style: "thin", color: { argb: toArgb("D9D4C8") } },
        };
      }

      const headerRow = worksheet.addRow(table.headers);
      if (firstHeaderRowNumber === null) {
        firstHeaderRowNumber = headerRow.number;
      }
      headerRow.font = { bold: true, color: { argb: toArgb(HEADER_TEXT) } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: toArgb(HEADER_FILL) },
      };
      headerRow.alignment = { vertical: "middle" };

      table.headers.forEach((header, index) => {
        const explicitWidth = table.columnWidths?.[index];
        widthByColumn[index] = Math.max(
          widthByColumn[index],
          explicitWidth ?? Math.min(Math.max(header.length + 4, 12), 40),
        );
      });

      if (table.rows.length === 0) {
        const emptyRow = worksheet.addRow(["No data"]);
        worksheet.mergeCells(emptyRow.number, 1, emptyRow.number, table.headers.length);
        emptyRow.getCell(1).font = { italic: true, color: { argb: toArgb("666666") } };
      } else {
        table.rows.forEach((row) => {
          const bodyRow = worksheet.addRow(row);
          bodyRow.eachCell((cell) => {
            cell.alignment = { vertical: "top", wrapText: true };
            cell.border = {
              bottom: { style: "thin", color: { argb: toArgb("ECE7DE") } },
            };
          });
          row.forEach((cellValue, index) => {
            const explicitWidth = table.columnWidths?.[index];
            widthByColumn[index] = Math.max(
              widthByColumn[index],
              explicitWidth ?? Math.min(Math.max(estimateWidth(cellValue) + 3, 12), 40),
            );
          });
        });
      }

      if (tableIndex < sheet.tables.length - 1) {
        worksheet.addRow([]);
      }
    });

    widthByColumn.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    if (sheet.tables.length === 1 && firstHeaderRowNumber !== null) {
      worksheet.autoFilter = {
        from: { row: firstHeaderRowNumber, column: 1 },
        to: {
          row: firstHeaderRowNumber,
          column: sheet.tables[0]?.headers.length || 1,
        },
      };
      worksheet.views = [{ state: "frozen", ySplit: firstHeaderRowNumber }];
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveBufferAsFile(buffer, options.fileName);
}
