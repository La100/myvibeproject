export function parseDecimalInput(value: string): number {
  const sanitized = value
    .trim()
    .replace(/\s|\u00a0/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!sanitized) {
    return Number.NaN;
  }

  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");
  const decimalSeparator =
    lastComma >= 0 && lastDot >= 0
      ? lastComma > lastDot
        ? ","
        : "."
      : lastComma >= 0
        ? ","
        : ".";

  const normalized =
    decimalSeparator === ","
      ? sanitized.replace(/\./g, "").replace(",", ".")
      : sanitized.replace(/,/g, "");

  return Number.parseFloat(normalized);
}
