import {
  type OrganizationTaxSettings,
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
  void taxSettings;
  return [
    ...(options.includeSection ? ["Section"] : []),
    "Work",
    "Qty",
    "Unit",
    "Unit Net",
    "Net Total",
    ...(options.includeNotes ? ["Notes"] : []),
    ...(options.includeReferenceLink ? ["Reference Link"] : []),
  ];
}

export function getLaborExportCsvRow(
  row: LaborExportRow,
  options: LaborExportColumnOptions,
  taxSettings?: Partial<OrganizationTaxSettings> | null,
): string[] {
  void taxSettings;
  return [
    ...(options.includeSection ? [row.sectionName] : []),
    row.work,
    row.qty,
    row.unit,
    row.unitNet,
    row.totalNet,
    ...(options.includeNotes ? [row.notes] : []),
    ...(options.includeReferenceLink ? [row.referenceLink] : []),
  ];
}
