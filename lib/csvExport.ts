type CsvRow = Array<string | number | null | undefined>;

type DownloadCsvFileOptions = {
  fileName: string;
  headers: string[];
  rows: CsvRow[];
};

const escapeCsvCell = (value: string | number | null | undefined) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export function downloadCsvFile(options: DownloadCsvFileOptions): void {
  const csvContent = [options.headers, ...options.rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = options.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
