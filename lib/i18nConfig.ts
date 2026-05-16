export const locales = ["en", "pl"] as const;
export type Locale = (typeof locales)[number];

export const getLocaleFromAcceptLanguage = (acceptLanguage: string | null): Locale => {
  if (!acceptLanguage) {
    return "en";
  }

  return acceptLanguage
    .split(",")
    .map((value) => value.trim().split(";", 1)[0]?.toLowerCase())
    .some((value) => value === "pl" || value?.startsWith("pl-"))
    ? "pl"
    : "en";
};
