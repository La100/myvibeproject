import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FALLBACK_HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
}

function decodeHtmlEntities(value: string): string {
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = value
    return textarea.value
  }

  return value.replace(
    /&(nbsp|amp|lt|gt|quot|#39);/g,
    (entity) => FALLBACK_HTML_ENTITIES[entity] ?? entity,
  )
}

function truncateWords(value: string, maxWords: number): string {
  const normalized = value.trim().replace(/\s+/g, " ")
  if (!normalized) {
    return ""
  }

  const words = normalized.split(" ")
  if (words.length <= maxWords) {
    return normalized
  }

  return `${words.slice(0, maxWords).join(" ")}...`
}

function htmlToPlainText(html: string, maxWords: number = 20): string {
  if (!html) {
    return ""
  }

  const plainText = html.replace(/<[^>]*>/g, " ")
  const decodedText = decodeHtmlEntities(plainText)
  return truncateWords(decodedText, maxWords)
}

export { htmlToPlainText };

export function getTaskPreview(
  task: { content?: string; description?: string },
  maxWords: number = 20,
): string {
  if (task.content) {
    return htmlToPlainText(task.content, maxWords)
  }

  if (task.description) {
    return truncateWords(task.description, maxWords)
  }

  return ""
}

type FormatCurrencyOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

const currencyMap: Record<string, { symbol: string; locale: string }> = {
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  PLN: { symbol: "zł", locale: "pl-PL" },
  GBP: { symbol: "£", locale: "en-GB" },
  CAD: { symbol: "C$", locale: "en-CA" },
  AUD: { symbol: "A$", locale: "en-AU" },
  JPY: { symbol: "¥", locale: "ja-JP" },
  CHF: { symbol: "CHF", locale: "de-CH" },
  SEK: { symbol: "kr", locale: "sv-SE" },
  NOK: { symbol: "kr", locale: "nb-NO" },
  DKK: { symbol: "kr", locale: "da-DK" },
  CZK: { symbol: "Kč", locale: "cs-CZ" },
  HUF: { symbol: "Ft", locale: "hu-HU" },
  CNY: { symbol: "¥", locale: "zh-CN" },
  INR: { symbol: "₹", locale: "en-IN" },
  BRL: { symbol: "R$", locale: "pt-BR" },
  MXN: { symbol: "MX$", locale: "es-MX" },
  KRW: { symbol: "₩", locale: "ko-KR" },
  SGD: { symbol: "S$", locale: "en-SG" },
  HKD: { symbol: "HK$", locale: "en-HK" },
}

export function getCurrencySymbol(currencyCode?: string | null): string {
  if (!currencyCode) {
    return currencyMap.PLN.symbol
  }

  const normalizedCurrencyCode = currencyCode.toUpperCase()
  return currencyMap[normalizedCurrencyCode]?.symbol || normalizedCurrencyCode
}

export function formatCurrency(
  amount: number,
  currencyCode: string = "USD",
  options: FormatCurrencyOptions = {},
): string {
  const normalizedCurrencyCode = currencyCode.toUpperCase()
  const currency = currencyMap[normalizedCurrencyCode] || currencyMap.USD
  const minimumFractionDigits = options.minimumFractionDigits ?? 2
  const maximumFractionDigits =
    options.maximumFractionDigits ?? minimumFractionDigits

  try {
    return new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: normalizedCurrencyCode,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount)
  } catch {
    return `${amount.toFixed(maximumFractionDigits)} ${currency.symbol || "$"}`
  }
}
