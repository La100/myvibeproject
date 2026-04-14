import {
  type OrganizationTaxSettings,
  resolveOrganizationTaxSettings,
} from "./organizationTax.ts";

const normalizeLabel = (value?: string | null) => value?.trim() || "";

export type ShoppingExportRow = {
  sectionName: string;
  product: string;
  qty: string;
  unitNet: string;
  unitTax: string;
  unitGross: string;
  totalNet: string;
  totalTax: string;
  totalGross: string;
  status: string;
  supplier: string;
  notes: string;
};

export type ShoppingExportColumnOptions = {
  includeNotes: boolean;
  includeSection?: boolean;
  includeStatus?: boolean;
  includeSupplier?: boolean;
};

export function formatShoppingExportProductLabel(
  productName: string,
  alternativeGroupTitle?: string | null,
): string {
  const normalizedProductName = normalizeLabel(productName);
  const normalizedGroupTitle = normalizeLabel(alternativeGroupTitle);

  if (!normalizedGroupTitle) {
    return normalizedProductName;
  }

  if (
    normalizedGroupTitle.localeCompare(normalizedProductName, undefined, {
      sensitivity: "accent",
    }) === 0
  ) {
    return normalizedProductName;
  }

  if (
    normalizedProductName
      .toLocaleLowerCase()
      .includes(normalizedGroupTitle.toLocaleLowerCase())
  ) {
    return normalizedProductName;
  }

  return `${normalizedGroupTitle}: ${normalizedProductName}`;
}

export function getShoppingExportHeaders(
  options: ShoppingExportColumnOptions,
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
    "Product",
    "Qty",
    ...priceHeaders,
    ...(options.includeStatus ? ["Status"] : []),
    ...(options.includeSupplier ? ["Supplier"] : []),
    ...(options.includeNotes ? ["Notes"] : []),
  ];
}

export function getShoppingExportCsvRow(
  row: ShoppingExportRow,
  options: ShoppingExportColumnOptions,
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
    row.product,
    row.qty,
    ...priceColumns,
    ...(options.includeStatus ? [row.status] : []),
    ...(options.includeSupplier ? [row.supplier] : []),
    ...(options.includeNotes ? [row.notes] : []),
  ];
}
