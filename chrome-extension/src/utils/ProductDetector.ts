import type { Product } from "../types"

interface ProductDetectorOptions {
  debug?: boolean
}

interface StructuredProductData {
  name?: string
  description?: string
  imageUrl?: string
  brand?: string
  price?: string
}

interface PriceCandidate {
  value: number
  score: number
  raw: string
}

const TITLE_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  '[itemprop="name"]',
  'h1[itemprop="name"]',
  "h1",
]

const DESCRIPTION_SELECTORS = [
  'meta[property="og:description"]',
  'meta[name="description"]',
  '[itemprop="description"]',
  ".product-description",
]

const BRAND_SELECTORS = [
  '[itemprop="brand"]',
  '[itemprop="manufacturer"]',
  '[data-testid*="brand"]',
  '.product-brand',
]

const IMAGE_SELECTORS = [
  'meta[property="og:image"]',
  'meta[name="twitter:image"]',
  '[itemprop="image"]',
]

const PRICE_SELECTORS = [
  '[itemprop="price"]',
  'meta[property="product:price:amount"]',
  'meta[property="og:price:amount"]',
  '[data-testid*="price"]',
  '.price',
  '.current-price',
  '.sale-price',
]

export default class ProductDetector {
  private readonly debug: boolean

  constructor(options: ProductDetectorOptions = {}) {
    this.debug = options.debug ?? false
  }

  async detectFromPage(): Promise<Product | null> {
    const structured = this.extractStructuredData()

    const name =
      this.pickFirstNonEmpty([
        structured.name,
        this.extractFromSelectors(TITLE_SELECTORS),
        this.getTitleFallback(),
      ]) ?? ""

    if (!name) {
      return null
    }

    const description = this.pickFirstNonEmpty([
      structured.description,
      this.extractFromSelectors(DESCRIPTION_SELECTORS),
    ])

    const supplier = this.pickFirstNonEmpty([
      structured.brand,
      this.extractFromSelectors(BRAND_SELECTORS),
      this.getDomainName(),
    ])

    const imageUrl = this.pickFirstNonEmpty([
      structured.imageUrl,
      this.extractFromSelectors(IMAGE_SELECTORS),
      this.findBestImageUrl(),
    ])

    const price = this.pickFirstNonEmpty([
      structured.price,
      this.extractPriceFromDom(),
    ])

    const product: Product = {
      name,
      price,
      quantity: 1,
      productLink: window.location.href,
      supplier,
      notes: description,
      imageUrl,
    }

    if (this.debug) {
      console.debug("[ProductDetector] Result", product)
    }

    return product
  }

  private extractStructuredData(): StructuredProductData {
    const result: StructuredProductData = {}

    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      const raw = script.textContent?.trim()
      if (!raw) continue

      try {
        const json = JSON.parse(raw)
        const product = this.findStructuredProduct(json)
        if (!product) continue

        result.name = result.name ?? this.toCleanText(product.name)
        result.description =
          result.description ?? this.toCleanText(product.description)
        result.imageUrl = result.imageUrl ?? this.extractImageUrl(product.image)
        result.brand = result.brand ?? this.extractBrand(product.brand)
        result.price = result.price ?? this.extractPriceValue(product.offers)

        if (result.name && result.imageUrl && result.price) {
          break
        }
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }

    return result
  }

  private findStructuredProduct(input: unknown): Record<string, unknown> | null {
    if (!input) return null

    if (Array.isArray(input)) {
      for (const item of input) {
        const found = this.findStructuredProduct(item)
        if (found) return found
      }
      return null
    }

    if (typeof input !== "object") {
      return null
    }

    const node = input as Record<string, unknown>

    const type = node["@type"]
    if (
      type === "Product" ||
      (Array.isArray(type) && type.includes("Product"))
    ) {
      return node
    }

    const graph = node["@graph"]
    if (graph) {
      const fromGraph = this.findStructuredProduct(graph)
      if (fromGraph) return fromGraph
    }

    return null
  }

  private extractPriceFromDom(): string | undefined {
    const candidates: PriceCandidate[] = []

    for (const selector of PRICE_SELECTORS) {
      const elements = document.querySelectorAll(selector)
      for (const element of elements) {
        const value = this.getElementValue(element)
        const parsed = this.parsePrice(value)
        if (!parsed) continue

        let score = 40
        const lower = `${element.className}`.toLowerCase()

        if (selector.includes("itemprop") || selector.includes("meta")) score += 40
        if (lower.includes("current") || lower.includes("sale")) score += 20
        if (lower.includes("old") || lower.includes("strike")) score -= 30

        candidates.push({ value: parsed, score, raw: value })
      }
    }

    if (candidates.length === 0) {
      return undefined
    }

    candidates.sort((a, b) => b.score - a.score)
    return this.formatPrice(candidates[0].value)
  }

  private parsePrice(input: string): number | null {
    if (!input) return null

    const cleaned = input
      .replace(/\s+/g, "")
      .replace(/[^\d.,-]/g, "")
      .replace(/(,\-|\.\-)$/g, "")

    if (!cleaned) return null

    const commaCount = (cleaned.match(/,/g) ?? []).length
    const dotCount = (cleaned.match(/\./g) ?? []).length

    let normalized = cleaned

    if (commaCount > 0 && dotCount > 0) {
      if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
        normalized = cleaned.replace(/\./g, "").replace(",", ".")
      } else {
        normalized = cleaned.replace(/,/g, "")
      }
    } else if (commaCount > 0) {
      normalized = cleaned.replace(/,/g, ".")
    }

    const numeric = Number.parseFloat(normalized)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null
    }

    return numeric
  }

  private formatPrice(value: number): string {
    return value.toFixed(2)
  }

  private extractImageUrl(input: unknown): string | undefined {
    if (typeof input === "string") {
      return this.resolveUrl(input)
    }

    if (Array.isArray(input)) {
      for (const entry of input) {
        const url = this.extractImageUrl(entry)
        if (url) return url
      }
    }

    if (typeof input === "object" && input !== null) {
      const obj = input as Record<string, unknown>
      const nested = obj.url
      if (typeof nested === "string") {
        return this.resolveUrl(nested)
      }
    }

    return undefined
  }

  private extractBrand(input: unknown): string | undefined {
    if (typeof input === "string") {
      return this.toCleanText(input)
    }

    if (typeof input === "object" && input !== null) {
      const obj = input as Record<string, unknown>
      const name = obj.name
      if (typeof name === "string") {
        return this.toCleanText(name)
      }
    }

    return undefined
  }

  private extractPriceValue(input: unknown): string | undefined {
    if (!input) return undefined

    if (Array.isArray(input)) {
      for (const offer of input) {
        const price = this.extractPriceValue(offer)
        if (price) return price
      }
      return undefined
    }

    if (typeof input !== "object") {
      return undefined
    }

    const offer = input as Record<string, unknown>
    const rawPrice = offer.price

    if (typeof rawPrice === "number") {
      return this.formatPrice(rawPrice)
    }

    if (typeof rawPrice === "string") {
      const parsed = this.parsePrice(rawPrice)
      return parsed ? this.formatPrice(parsed) : undefined
    }

    return undefined
  }

  private getElementValue(element: Element): string {
    if (element instanceof HTMLMetaElement) {
      return element.content ?? ""
    }

    if (element instanceof HTMLInputElement) {
      return element.value ?? ""
    }

    return element.textContent?.trim() ?? ""
  }

  private extractFromSelectors(selectors: string[]): string | undefined {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (!element) continue

      const value = this.getElementValue(element)
      const cleaned = this.toCleanText(value)
      if (cleaned) {
        return cleaned
      }
    }

    return undefined
  }

  private getTitleFallback(): string | undefined {
    const title = document.title
    if (!title) return undefined

    return this.toCleanText(title.split(/[|\-–—•]/)[0] ?? title)
  }

  private findBestImageUrl(): string | undefined {
    const images = Array.from(document.querySelectorAll("img"))
      .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
      .filter((img) => img.naturalWidth >= 200 && img.naturalHeight >= 200)
      .filter((img) => /^https?:\/\//.test(img.src))
      .filter((img) => !/logo|icon|sprite|avatar/i.test(img.src))

    if (images.length === 0) {
      return undefined
    }

    images.sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)

    return this.resolveUrl(images[0].src)
  }

  private resolveUrl(value?: string): string | undefined {
    if (!value) return undefined

    try {
      return new URL(value, window.location.href).toString()
    } catch {
      return undefined
    }
  }

  private getDomainName(): string | undefined {
    try {
      return window.location.hostname.replace(/^www\./, "")
    } catch {
      return undefined
    }
  }

  private toCleanText(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined
    }

    const cleaned = value.replace(/\s+/g, " ").trim()
    return cleaned.length > 1 ? cleaned : undefined
  }

  private pickFirstNonEmpty(values: Array<string | undefined>): string | undefined {
    return values.find((value): value is string => Boolean(value && value.trim().length > 0))
  }
}
