interface PriceDetectionResult {
  price: number
  confidence: number
  currency?: string
  method: "structured" | "selector" | "content"
  debugInfo?: { sample: string }
}

const STRUCTURED_PRICE_SELECTORS = [
  'meta[property="product:price:amount"]',
  'meta[property="og:price:amount"]',
  '[itemprop="price"]',
]

const DOM_PRICE_SELECTORS = [
  '[data-testid*="price"]',
  '.price',
  '.current-price',
  '.sale-price',
]

export default class UltimatePriceDetector {
  private readonly debug: boolean

  constructor(enableDebug = false) {
    this.debug = enableDebug
  }

  async detectPrice(): Promise<PriceDetectionResult | null> {
    const structured = this.extractFromSelectors(STRUCTURED_PRICE_SELECTORS)
    if (structured) {
      return {
        price: structured,
        confidence: 95,
        method: "structured",
      }
    }

    const selector = this.extractFromSelectors(DOM_PRICE_SELECTORS)
    if (selector) {
      return {
        price: selector,
        confidence: 85,
        method: "selector",
      }
    }

    const content = this.extractFromContent()
    if (content) {
      return {
        price: content,
        confidence: 65,
        method: "content",
        debugInfo: this.debug
          ? { sample: document.body.textContent?.slice(0, 120) ?? "" }
          : undefined,
      }
    }

    return null
  }

  private extractFromSelectors(selectors: string[]): number | null {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      for (const element of elements) {
        const raw = this.readElementValue(element)
        const parsed = this.parsePrice(raw)
        if (parsed) {
          return parsed
        }
      }
    }

    return null
  }

  private extractFromContent(): number | null {
    const text = document.body.textContent
    if (!text) return null

    const matches = text.match(/(?:\d{1,3}(?:[ .,]\d{3})*|\d+)(?:[.,]\d{1,2})?/g)
    if (!matches) return null

    for (const match of matches.slice(0, 50)) {
      const parsed = this.parsePrice(match)
      if (parsed && parsed > 0.5) {
        return parsed
      }
    }

    return null
  }

  private readElementValue(element: Element): string {
    if (element instanceof HTMLMetaElement) {
      return element.content ?? ""
    }

    return element.textContent?.trim() ?? ""
  }

  private parsePrice(value: string): number | null {
    const cleaned = value.replace(/\s+/g, "").replace(/[^\d.,]/g, "")
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

    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
}
