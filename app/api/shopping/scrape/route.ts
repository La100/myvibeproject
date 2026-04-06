import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

import { apiAny } from "@/lib/convexApiAny";
import { verifyAssistantAccess, verifyProjectScope } from "@/lib/assistant/serverAccess";
import {
  calculateCloudflareBrowserRenderingCostUSD,
  usdToCredits,
} from "@/lib/aiPricing";
import { assertSafeRemoteUrl } from "@/lib/security/remoteUrlSafety";

type JsonLdNode = Record<string, unknown>;

type ScrapeElementAttribute = {
  name?: string;
  value?: string;
};

type ScrapeElementMatch = {
  text?: string;
  html?: string;
  attributes?: ScrapeElementAttribute[];
};

type ScrapeElementResult = {
  selector?: string;
  results?: ScrapeElementMatch[];
};

type CloudflareScrapeResponse = {
  success?: boolean;
  result?: ScrapeElementResult[];
  errors?: Array<{ message?: string }>;
};

type CloudflareScrapeResult = {
  html: string;
  finalUrl: URL;
  browserMsUsed: number;
};

interface ScrapedProductData {
  name?: string;
  supplier?: string;
  category?: string;
  catalogNumber?: string;
  dimensions?: string;
  unitPrice?: number;
  currency?: string;
  imageUrl?: string;
  productLink: string;
  notes?: string;
}

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 12000;
const CLOUDFLARE_TIMEOUT_MS = 20000;
const MAX_HTML_LENGTH = 2_000_000;
const META_TAG_REGEX = /<meta\b[^>]*>/gi;
const ATTR_REGEX = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const JSON_LD_REGEX =
  /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const CLOUDFLARE_SCRAPE_SELECTORS = [
  "title",
  "h1",
  "meta[property], meta[name], meta[itemprop]",
  "script[type='application/ld+json']",
  "link[rel='canonical']",
  "[itemprop='price']",
  "[itemprop='priceCurrency']",
  "[data-price]",
  "[data-product-price]",
  "[data-testid*='price']",
];
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4/accounts";
export const runtime = "nodejs";

function getCloudflareConfig() {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ??
    process.env.CF_ACCOUNT_ID?.trim() ??
    "";
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN?.trim() ??
    process.env.CLOUDFLARE_BROWSER_RENDERING_API_TOKEN?.trim() ??
    process.env.CF_API_TOKEN?.trim() ??
    "";

  if (!accountId || !apiToken) {
    return null;
  }

  return { accountId, apiToken };
}

function getConvexClient(token: string): ConvexHttpClient {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function normalizeInputUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("URL is required.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  await assertSafeRemoteUrl(parsed, {
    blockedHostMessage: "This URL host is blocked for security reasons.",
    unresolvedHostMessage: "Unable to resolve URL host.",
  });

  return parsed;
}

async function fetchHtmlWithRedirects(initialUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  let currentUrl = initialUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    await assertSafeRemoteUrl(currentUrl, {
      blockedHostMessage: "Redirected URL host is blocked for security reasons.",
      unresolvedHostMessage: "Redirected URL host could not be resolved.",
    });

    const response = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MyVibeProjectBot/1.0; +https://myvibeproject.local)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9,pl;q=0.8",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (isRedirect) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect (${response.status}) without location header.`);
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Remote server responded with ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error("Provided URL does not point to an HTML page.");
    }

    const fullHtml = await response.text();
    const html =
      fullHtml.length > MAX_HTML_LENGTH ? fullHtml.slice(0, MAX_HTML_LENGTH) : fullHtml;

    if (!html.trim()) {
      throw new Error("Fetched page is empty.");
    }

    return { html, finalUrl: currentUrl };
  }

  throw new Error("Too many redirects.");
}

function normalizeScrapeText(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : undefined;
}

function getScrapeAttributeMap(match: ScrapeElementMatch): Map<string, string> {
  const map = new Map<string, string>();
  for (const attribute of match.attributes ?? []) {
    const name = normalizeScrapeText(attribute.name)?.toLowerCase();
    const value = normalizeScrapeText(attribute.value);
    if (!name || !value) continue;
    map.set(name, value);
  }
  return map;
}

function getScrapeMatchesBySelector(
  results: ScrapeElementResult[],
  selector: string,
): ScrapeElementMatch[] {
  return results.find((entry) => entry.selector === selector)?.results ?? [];
}

function detectCurrencyFromText(value: string | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return undefined;

  if (/\bPLN\b|ZŁ/.test(normalized)) return "PLN";
  if (/\bEUR\b|€/.test(normalized)) return "EUR";
  if (/\bUSD\b|\$/.test(normalized)) return "USD";
  if (/\bGBP\b|£/.test(normalized)) return "GBP";
  if (/\bCHF\b/.test(normalized)) return "CHF";

  return undefined;
}

function buildCloudflareHtml(
  results: ScrapeElementResult[],
  pageUrl: URL,
): { html: string; finalUrl: URL } {
  const htmlParts: string[] = [];

  const titleMatch =
    getScrapeMatchesBySelector(results, "title")[0] ??
    getScrapeMatchesBySelector(results, "h1")[0];
  const titleText = normalizeScrapeText(titleMatch?.text);
  if (titleText) {
    htmlParts.push(`<title>${escapeHtmlText(titleText)}</title>`);
  }

  for (const match of getScrapeMatchesBySelector(results, "meta[property], meta[name], meta[itemprop]")) {
    const attributes = getScrapeAttributeMap(match);
    const content = attributes.get("content");
    if (!content) continue;

    const attrs = ["property", "name", "itemprop"]
      .map((key) => {
        const value = attributes.get(key);
        return value ? `${key}="${escapeHtmlAttribute(value)}"` : null;
      })
      .filter((entry): entry is string => Boolean(entry));

    if (attrs.length === 0) continue;
    htmlParts.push(
      `<meta ${attrs.join(" ")} content="${escapeHtmlAttribute(content)}">`,
    );
  }

  for (const match of getScrapeMatchesBySelector(results, "script[type='application/ld+json']")) {
    const raw = match.html ?? match.text;
    const json = typeof raw === "string" ? raw.trim() : "";
    if (!json) continue;
    htmlParts.push(`<script type="application/ld+json">${json}</script>`);
  }

  let finalUrl = pageUrl;
  const canonicalHref = getScrapeMatchesBySelector(results, "link[rel='canonical']")
    .map((match) => getScrapeAttributeMap(match).get("href"))
    .find((value): value is string => Boolean(value));

  if (canonicalHref) {
    try {
      finalUrl = new URL(canonicalHref, pageUrl);
    } catch {
      finalUrl = pageUrl;
    }
  }

  const priceCandidates = [
    ...getScrapeMatchesBySelector(results, "[itemprop='price']").map((match) => match.text),
    ...getScrapeMatchesBySelector(results, "[data-price]").map((match) => match.text),
    ...getScrapeMatchesBySelector(results, "[data-product-price]").map((match) => match.text),
    ...getScrapeMatchesBySelector(results, "[data-testid*='price']").map((match) => match.text),
  ]
    .map((value) => normalizeScrapeText(value))
    .filter((value): value is string => Boolean(value));

  const priceText = priceCandidates.find((candidate) => parsePrice(candidate) !== undefined);
  if (priceText) {
    htmlParts.push(`<meta name="price" content="${escapeHtmlAttribute(priceText)}">`);
  }

  const currencyText =
    getScrapeMatchesBySelector(results, "[itemprop='priceCurrency']")
      .map((match) => normalizeScrapeText(match.text))
      .find((value): value is string => Boolean(value)) ??
    detectCurrencyFromText(priceText);

  if (currencyText) {
    htmlParts.push(`<meta name="currency" content="${escapeHtmlAttribute(currencyText)}">`);
  }

  return {
    html: htmlParts.join("\n"),
    finalUrl,
  };
}

async function fetchCloudflareScrape(url: URL): Promise<CloudflareScrapeResult> {
  const config = getCloudflareConfig();
  if (!config) {
    throw new Error("Cloudflare Browser Rendering is not configured.");
  }

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/${config.accountId}/browser-rendering/scrape`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url.toString(),
        userAgent:
          "Mozilla/5.0 (compatible; MyVibeProductScraper/1.0; +https://myvibeproject.com)",
        gotoOptions: {
          waitUntil: "networkidle0",
        },
        elements: CLOUDFLARE_SCRAPE_SELECTORS.map((selector) => ({ selector })),
      }),
      signal: AbortSignal.timeout(CLOUDFLARE_TIMEOUT_MS),
    },
  );

  const payload = (await response.json().catch(() => null)) as CloudflareScrapeResponse | null;
  if (!response.ok || !payload?.success || !Array.isArray(payload.result)) {
    const message =
      payload?.errors?.find((entry) => typeof entry?.message === "string")?.message ??
      `Cloudflare scrape failed with status ${response.status}.`;
    throw new Error(message);
  }

  const browserMsUsedHeader = response.headers.get("x-browser-ms-used");
  const browserMsUsed = browserMsUsedHeader
    ? Number.parseFloat(browserMsUsedHeader)
    : 0;

  return {
    ...buildCloudflareHtml(payload.result, url),
    browserMsUsed: Number.isFinite(browserMsUsed) ? Math.max(0, browserMsUsed) : 0,
  };
}

async function recordScrapeUsage(
  request: NextRequest,
  browserMsUsed: number,
) {
  if (!Number.isFinite(browserMsUsed) || browserMsUsed <= 0) {
    return;
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim();
  const teamId = request.nextUrl.searchParams.get("teamId")?.trim();
  if (!projectId || !teamId) {
    return;
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return;
  }

  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return;
  }

  const estimatedCostUsd = calculateCloudflareBrowserRenderingCostUSD(browserMsUsed);
  const estimatedCostCents = Math.round(estimatedCostUsd * 100);
  const billableTokens = usdToCredits(estimatedCostUsd);

  const client = getConvexClient(convexToken);
  await client.mutation(apiAny.ai.usage.recordSelfHostedChatKitUsage, {
    projectId,
    teamId,
    model: "cloudflare-browser-rendering/scrape",
    feature: "assistant",
    requestType: "other",
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    billableTokens,
    mode: "chatkit_scrape",
    estimatedCostCents,
    responseTimeMs: Math.round(browserMsUsed),
    success: true,
  });
}

function parseMetaTags(html: string) {
  const byProperty = new Map<string, string>();
  const byName = new Map<string, string>();
  const byItemprop = new Map<string, string>();

  const metaTags = html.match(META_TAG_REGEX) ?? [];
  for (const tag of metaTags) {
    const attributes = new Map<string, string>();
    ATTR_REGEX.lastIndex = 0;

    for (const match of tag.matchAll(ATTR_REGEX)) {
      const key = match[1]?.toLowerCase();
      const value = normalizeWhitespace(match[2] ?? match[3] ?? match[4] ?? "");
      if (!key || !value) continue;
      attributes.set(key, value);
    }

    const content = attributes.get("content");
    if (!content) continue;

    const property = attributes.get("property");
    const name = attributes.get("name");
    const itemprop = attributes.get("itemprop");

    if (property) byProperty.set(property.toLowerCase(), content);
    if (name) byName.set(name.toLowerCase(), content);
    if (itemprop) byItemprop.set(itemprop.toLowerCase(), content);
  }

  return { byProperty, byName, byItemprop };
}

function pickMeta(
  meta: ReturnType<typeof parseMetaTags>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const normalized = key.toLowerCase();
    const value =
      meta.byProperty.get(normalized) ??
      meta.byName.get(normalized) ??
      meta.byItemprop.get(normalized);
    if (value) return value;
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(TITLE_REGEX);
  if (!match?.[1]) return undefined;
  return normalizeWhitespace(match[1].replace(/<[^>]+>/g, ""));
}

function parseJsonLdBlocks(html: string): JsonLdNode[] {
  const products: JsonLdNode[] = [];

  for (const match of html.matchAll(JSON_LD_REGEX)) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = collectProductNodes(parsed);
      if (nodes.length > 0) {
        products.push(...nodes);
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return products;
}

function collectProductNodes(input: unknown): JsonLdNode[] {
  const result: JsonLdNode[] = [];
  const seen = new WeakSet<object>();

  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object") return;

    const obj = value as JsonLdNode;
    if (seen.has(obj)) return;
    seen.add(obj);

    const typeValue = obj["@type"];
    if (
      typeValue === "Product" ||
      (Array.isArray(typeValue) && typeValue.includes("Product"))
    ) {
      result.push(obj);
    }

    for (const nested of Object.values(obj)) {
      if (nested && (typeof nested === "object" || Array.isArray(nested))) {
        visit(nested);
      }
    }
  };

  visit(input);
  return result;
}

function pickBestProduct(products: JsonLdNode[]): JsonLdNode | undefined {
  let best: JsonLdNode | undefined;
  let bestScore = -1;

  for (const product of products) {
    let score = 0;
    if (typeof product.name === "string") score += 3;
    if (typeof product.description === "string") score += 1;
    if (product.image) score += 2;
    if (product.offers) score += 3;
    if (product.brand) score += 1;
    if (typeof product.sku === "string") score += 1;

    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }

  return best;
}

function extractString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function extractImageUrl(value: unknown, baseUrl: URL): string | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractImageUrl(item, baseUrl);
      if (url) return url;
    }
    return undefined;
  }

  if (typeof value === "object") {
    const obj = value as JsonLdNode;
    const nested = obj.url ?? obj.contentUrl;
    if (nested) return extractImageUrl(nested, baseUrl);
  }

  return undefined;
}

function extractBrand(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return extractString(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const brand = extractBrand(item);
      if (brand) return brand;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const obj = value as JsonLdNode;
    return extractString(obj.name ?? obj.brand);
  }
  return undefined;
}

function parsePrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/(,\-|\.\-)$/g, "");

  if (!cleaned) return undefined;

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  let normalized = cleaned;

  if (commaCount > 0 && dotCount > 0) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount > 0) {
    normalized = cleaned.replace(/,/g, ".");
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function extractOfferData(offers: unknown): { price?: number; currency?: string } {
  const tryOffer = (offer: unknown): { price?: number; currency?: string } => {
    if (!offer || typeof offer !== "object") return {};
    const record = offer as JsonLdNode;

    const price =
      parsePrice(record.price) ??
      parsePrice(record.lowPrice) ??
      parsePrice(record.highPrice) ??
      parsePrice((record.priceSpecification as JsonLdNode | undefined)?.price);

    const currency = extractString(record.priceCurrency ?? record.currency);
    return { price, currency };
  };

  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const data = tryOffer(offer);
      if (data.price) return data;
    }
    return {};
  }

  return tryOffer(offers);
}

function fallbackSupplierFromHostname(url: URL): string {
  return url.hostname.replace(/^www\./i, "");
}

function extractStructuredData(
  product: JsonLdNode | undefined,
  pageUrl: URL,
): Partial<ScrapedProductData> {
  if (!product) return {};

  const offerData = extractOfferData(product.offers);

  return {
    name: extractString(product.name),
    notes: extractString(product.description),
    supplier: extractBrand(product.brand),
    category: extractString(product.category),
    catalogNumber: extractString(product.sku ?? product.mpn ?? product.gtin),
    dimensions: extractString(product.size ?? product.width ?? product.height),
    imageUrl: extractImageUrl(product.image, pageUrl),
    unitPrice: offerData.price,
    currency: offerData.currency,
  };
}

function dedupeAndTrimNotes(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) return undefined;
  return cleaned.length > 1000 ? `${cleaned.slice(0, 997)}...` : cleaned;
}

function resolveOptionalUrl(rawUrl: string | undefined, baseUrl: URL): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractProductData(html: string, finalUrl: URL): ScrapedProductData {
  const meta = parseMetaTags(html);
  const products = parseJsonLdBlocks(html);
  const bestProduct = pickBestProduct(products);
  const structured = extractStructuredData(bestProduct, finalUrl);

  const titleFromTag = extractTitle(html);
  const name =
    structured.name ??
    pickMeta(meta, ["og:title", "twitter:title", "product:title", "title"]) ??
    titleFromTag;

  const notes =
    structured.notes ??
    pickMeta(meta, ["og:description", "description", "twitter:description"]);

  const supplier =
    structured.supplier ??
    pickMeta(meta, ["og:site_name", "application-name", "product:brand"]) ??
    fallbackSupplierFromHostname(finalUrl);

  const imageUrlRaw =
    structured.imageUrl ??
    pickMeta(meta, [
      "og:image",
      "twitter:image",
      "product:image",
      "image",
      "thumbnail",
      "thumbnailurl",
    ]);

  const imageUrl = resolveOptionalUrl(imageUrlRaw, finalUrl);

  const unitPrice =
    structured.unitPrice ??
    parsePrice(
      pickMeta(meta, [
        "product:price:amount",
        "og:price:amount",
        "price",
        "product:price",
      ]),
    );

  const currency =
    structured.currency ??
    pickMeta(meta, ["product:price:currency", "og:price:currency", "currency"]);

  const data: ScrapedProductData = {
    name: name ? normalizeWhitespace(name) : undefined,
    supplier: supplier ? normalizeWhitespace(supplier) : undefined,
    category: structured.category,
    catalogNumber: structured.catalogNumber,
    dimensions: structured.dimensions,
    unitPrice,
    currency,
    imageUrl,
    productLink: finalUrl.toString(),
    notes: dedupeAndTrimNotes(notes),
  };

  return data;
}

function toErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unexpected error.";

  const status = /required|allowed|invalid|blocked/i.test(message)
    ? 400
    : /timeout|network|redirect/i.test(message)
      ? 502
      : 500;

  return NextResponse.json({ message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim();
    const teamId = request.nextUrl.searchParams.get("teamId")?.trim();
    if (!projectId || !teamId) {
      return NextResponse.json(
        { error: "Missing required project or team scope." },
        { status: 400 },
      );
    }

    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyProjectScope(convexToken, projectId, teamId);
      await verifyAssistantAccess(convexToken, teamId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Access denied for shopping scrape.";
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const rawUrl = request.nextUrl.searchParams.get("url") ?? "";
    const parsedUrl = await normalizeInputUrl(rawUrl);
    let html: string;
    let finalUrl: URL;
    let browserMsUsed = 0;

    try {
      ({ html, finalUrl, browserMsUsed } = await fetchCloudflareScrape(parsedUrl));
    } catch (cloudflareError) {
      console.warn("[SHOPPING_SCRAPE_CLOUDFLARE_FALLBACK]", cloudflareError);
      ({ html, finalUrl } = await fetchHtmlWithRedirects(parsedUrl));
    }

    const data = extractProductData(html, finalUrl);

    if (browserMsUsed > 0) {
      try {
        await recordScrapeUsage(request, browserMsUsed);
      } catch (usageError) {
        console.error("[SHOPPING_SCRAPE_USAGE_ERROR]", usageError);
      }
    }

    if (!data.name) {
      return NextResponse.json(
        { message: "Could not detect product details from this URL." },
        { status: 422 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[SHOPPING_SCRAPE_ERROR]", error);
    return toErrorResponse(error);
  }
}
