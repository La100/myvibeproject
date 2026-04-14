import {
  type OrganizationTaxSettings,
  resolveOrganizationTaxSettings,
} from "./organizationTax.ts";

export type LaborExportRow = {
  sectionName: string;
  work: string;
  qty: string;
  unit: string;
  unitNet: string;
  unitTax: string;
  unitGross: string;
  totalNet: string;
  totalTax: string;
  totalGross: string;
  notes: string;
  referenceLink: string;
};

export type LaborExportColumnOptions = {
  includeNotes: boolean;
  includeReferenceLink: boolean;
  includeSection?: boolean;
};

export function getLaborExportHeaders(
  options: LaborExportColumnOptions,
  taxSettings?: Partial<OrganizationTaxSettings> | null,
): string[] {
  const resolvedTaxSettings = resolveOrganizationTaxSettings(taxSettings);
  const priceHeaders =
    resolvedTaxSettings.priceDisplay === "both"
      ? [
          "Unit Net",
          `Unit ${resolvedTaxSettings.taxLabel}`,
          "Unit Gross",
          "Net Total",
          `${resolvedTaxSettings.taxLabel} Amount`,
          "Gross Total",
        ]
      : resolvedTaxSettings.priceDisplay === "gross"
        ? ["Unit Gross", "Gross Total"]
        : ["Unit Net", "Net Total"];

  return [
    ...(options.includeSection ? ["Section"] : []),
    "Work",
    "Qty",
    "Unit",
    ...priceHeaders,
    ...(options.includeNotes ? ["Notes"] : []),
    ...(options.includeReferenceLink ? ["Reference Link"] : []),
  ];
}

export function getLaborExportCsvRow(
  row: LaborExportRow,
  options: LaborExportColumnOptions,
  taxSettings?: Partial<OrganizationTaxSettings> | null,
): string[] {
  const resolvedTaxSettings = resolveOrganizationTaxSettings(taxSettings);
  const priceColumns =
    resolvedTaxSettings.priceDisplay === "both"
      ? [
          row.unitNet,
          row.unitTax,
          row.unitGross,
          row.totalNet,
          row.totalTax,
          row.totalGross,
        ]
      : resolvedTaxSettings.priceDisplay === "gross"
        ? [row.unitGross, row.totalGross]
        : [row.unitNet, row.totalNet];

  return [
    ...(options.includeSection ? [row.sectionName] : []),
    row.work,
    row.qty,
    row.unit,
    ...priceColumns,
    ...(options.includeNotes ? [row.notes] : []),
    ...(options.includeReferenceLink ? [row.referenceLink] : []),
  ];
}
