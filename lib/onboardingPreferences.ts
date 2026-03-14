export type CurrencyCode =
  | "USD"
  | "EUR"
  | "PLN"
  | "GBP"
  | "CAD"
  | "AUD"
  | "JPY"
  | "CHF"
  | "SEK"
  | "NOK"
  | "DKK"
  | "CZK"
  | "HUF"
  | "CNY"
  | "INR"
  | "BRL"
  | "MXN"
  | "KRW"
  | "SGD"
  | "HKD";

export const currencyOptions: Array<{ code: CurrencyCode; label: string }> = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "PLN", label: "Polish Zloty (PLN)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "SEK", label: "Swedish Krona (SEK)" },
  { code: "NOK", label: "Norwegian Krone (NOK)" },
  { code: "DKK", label: "Danish Krone (DKK)" },
  { code: "CZK", label: "Czech Koruna (CZK)" },
  { code: "HUF", label: "Hungarian Forint (HUF)" },
  { code: "CNY", label: "Chinese Yuan (CNY)" },
  { code: "INR", label: "Indian Rupee (INR)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
  { code: "MXN", label: "Mexican Peso (MXN)" },
  { code: "KRW", label: "South Korean Won (KRW)" },
  { code: "SGD", label: "Singapore Dollar (SGD)" },
  { code: "HKD", label: "Hong Kong Dollar (HKD)" },
];

const supportedCurrencyCodes = currencyOptions.map((currency) => currency.code);

const supportedCurrencyCodeSet = new Set<CurrencyCode>(supportedCurrencyCodes);

const COUNTRY_TO_CURRENCY: Partial<Record<string, CurrencyCode>> = {
  AT: "EUR",
  AU: "AUD",
  BE: "EUR",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  CY: "EUR",
  CZ: "CZK",
  DE: "EUR",
  DK: "DKK",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GB: "GBP",
  GR: "EUR",
  HK: "HKD",
  HR: "EUR",
  HU: "HUF",
  IE: "EUR",
  IN: "INR",
  IT: "EUR",
  JP: "JPY",
  KR: "KRW",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MT: "EUR",
  MX: "MXN",
  NL: "EUR",
  NO: "NOK",
  PL: "PLN",
  PT: "EUR",
  SE: "SEK",
  SG: "SGD",
  SI: "EUR",
  SK: "EUR",
  US: "USD",
};

const TIMEZONE_TO_CURRENCY: Partial<Record<string, CurrencyCode>> = {
  "America/Toronto": "CAD",
  "Asia/Hong_Kong": "HKD",
  "Asia/Kolkata": "INR",
  "Asia/Seoul": "KRW",
  "Asia/Shanghai": "CNY",
  "Asia/Singapore": "SGD",
  "Asia/Tokyo": "JPY",
  "Australia/Perth": "AUD",
  "Australia/Sydney": "AUD",
  "Europe/London": "GBP",
  "Europe/Warsaw": "PLN",
};

export const isCurrencyCode = (value: string | null | undefined): value is CurrencyCode =>
  typeof value === "string" && supportedCurrencyCodeSet.has(value as CurrencyCode);

const getExplicitRegionFromLocale = (locale: string | null | undefined): string | undefined => {
  if (!locale) {
    return undefined;
  }

  const normalized = locale.trim();
  if (!normalized) {
    return undefined;
  }

  const segments = normalized.split(/[-_]/).filter(Boolean);
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    if (/^[A-Za-z]{2}$/.test(segment)) {
      return segment.toUpperCase();
    }
  }

  return undefined;
};

const getInferredRegionFromLocale = (locale: string | null | undefined): string | undefined => {
  if (!locale) {
    return undefined;
  }

  const normalized = locale.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    if (typeof Intl !== "undefined" && typeof Intl.Locale === "function") {
      const intlLocale = new Intl.Locale(normalized);
      const region = intlLocale.maximize().region;
      if (region) {
        return region.toUpperCase();
      }
    }
  } catch {
    // Ignore invalid or unsupported locale tags.
  }

  return undefined;
};

type DetectCurrencyOptions = {
  countryCode?: string | null;
  locale?: string | null;
  locales?: ReadonlyArray<string> | null;
  timezone?: string | null;
  fallback?: CurrencyCode;
};

export const detectCurrency = ({
  countryCode,
  locale,
  locales,
  timezone,
  fallback = "USD",
}: DetectCurrencyOptions = {}): CurrencyCode => {
  const explicitCountryCandidates = [
    countryCode?.toUpperCase(),
    ...((locales ?? []).map((value) => getExplicitRegionFromLocale(value)).filter(Boolean) as string[]),
    getExplicitRegionFromLocale(locale),
  ].filter(Boolean) as string[];

  for (const candidate of explicitCountryCandidates) {
    const currency = COUNTRY_TO_CURRENCY[candidate];
    if (currency) {
      return currency;
    }
  }

  if (timezone) {
    const exactMatch = TIMEZONE_TO_CURRENCY[timezone];
    if (exactMatch) {
      return exactMatch;
    }
  }

  const inferredCountryCandidates = [
    ...((locales ?? []).map((value) => getInferredRegionFromLocale(value)).filter(Boolean) as string[]),
    getInferredRegionFromLocale(locale),
  ].filter(Boolean) as string[];

  for (const candidate of inferredCountryCandidates) {
    const currency = COUNTRY_TO_CURRENCY[candidate];
    if (currency) {
      return currency;
    }
  }

  return fallback;
};

type DetectBrowserCurrencyOptions = {
  countryCode?: string | null;
  timezone?: string | null;
  fallback?: CurrencyCode;
};

export const detectBrowserCurrency = ({
  countryCode,
  timezone,
  fallback = "USD",
}: DetectBrowserCurrencyOptions = {}): CurrencyCode => {
  if (typeof navigator === "undefined") {
    return fallback;
  }

  return detectCurrency({
    countryCode,
    timezone,
    locale: navigator.language,
    locales: navigator.languages,
    fallback,
  });
};
