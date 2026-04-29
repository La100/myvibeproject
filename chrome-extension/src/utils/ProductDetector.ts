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
  catalogNumber?: string
}

type PriceSource = "structured" | "meta" | "semantic" | "contextual"

interface PriceCandidate {
  amount: number
  rawText: string
  source: PriceSource
  element: Element | null
  score: number
  reasons: string[]
}

interface PriceCluster {
  amount: number
  key: string
  candidates: PriceCandidate[]
  score: number
}

interface ProductPageContext {
  titleElement: Element | null
  buyActionElement: Element | null
  productRoot: Element | null
}

interface TextCandidate {
  value: string
  score: number
}

interface StructuredOfferPriceCandidate {
  amount: number
  score: number
  reasons: string[]
}

const TITLE_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  'h1[itemprop="name"]',
  '[itemprop="name"]',
  "main h1",
  "article h1",
  "h1",
]

const DESCRIPTION_SELECTORS = [
  'meta[property="og:description"]',
  'meta[name="description"]',
  '[itemprop="description"]',
  '[data-testid*="description"]',
  ".product-description",
  "#description",
]

const BRAND_SELECTORS = [
  '[itemprop="brand"]',
  '[itemprop="manufacturer"]',
  '[data-testid*="brand"]',
  '[class*="brand"]',
]

const IMAGE_SELECTORS = [
  'meta[property="og:image"]',
  'meta[name="twitter:image"]',
  '[itemprop="image"]',
]

const CATALOG_NUMBER_SELECTORS = [
  '[itemprop="sku"]',
  '[itemprop="mpn"]',
  '[data-testid*="sku"]',
  '[data-testid*="mpn"]',
  '[class*="sku"]',
]

const PRODUCT_ROOT_SELECTORS = [
  '[itemtype*="Product"]',
  '[id*="projector"]',
  '[class*="projector"]',
  '[id*="product"]',
  '[class*="product"]',
  "main",
  "article",
]

const PRICE_META_SELECTORS = [
  '[itemprop="price"]',
  'meta[property="product:price:amount"]',
  'meta[property="og:price:amount"]',
  'meta[property="og:price:standard_amount"]',
  'meta[property="product:sale_price:amount"]',
  'meta[name="twitter:data1"]',
]

const PRICE_SEMANTIC_SELECTORS = [
  '[itemprop="price"]',
  '[data-testid*="price"]',
  '[data-price]',
  '[class*="price"]',
  '[id*="price"]',
  ".current-price",
  ".sale-price",
  ".final-price",
]

const GENERIC_PRICE_TEXT_SELECTORS = "span,div,p,strong,b,h2,h3,h4,li"

const RECOMMENDATION_CONTAINER_SELECTORS = [
  '[id*="related"]',
  '[class*="related"]',
  '[id*="recommend"]',
  '[class*="recommend"]',
  '[id*="similar"]',
  '[class*="similar"]',
  '[id*="upsell"]',
  '[class*="upsell"]',
  '[id*="cross-sell"]',
  '[class*="cross-sell"]',
  '[class*="carousel"]',
  '[id*="carousel"]',
  '[data-testid*="related"]',
  '[data-testid*="recommend"]',
]

const BUY_ACTION_TEXT_PATTERN =
  /(add to cart|buy now|to cart|basket|checkout|purchase|order|dodaj do koszyka|kup teraz|do koszyka|zamow|zamów|koszyk)/i

const PRICE_CURRENCY_PATTERN =
  /(?:[$€£¥₽]|(?:\bzł\b)|(?:\bpln\b)|(?:\busd\b)|(?:\beur\b)|(?:\bgbp\b)|(?:\bsek\b)|(?:\bnok\b)|(?:\bdkk\b)|(?:\bkr\b))/i

const PRICE_CONTEXT_HINT_PATTERN =
  /\b(price|cena|koszt|amount|total|now|teraz|our price|sale price|final price)\b/i

const LOW_CONFIDENCE_PRICE_TEXT_PATTERN =
  /\b(from|starting|starting at|lowest|as low as|rata|raty|na raty|monthly|month|installment|leasing)\b/i

const OLD_PRICE_HINT_PATTERN =
  /\b(old|regular|before|was|compare|strike|crossed|list|msrp|catalog)\b/i

const DISCOUNT_TEXT_PATTERN = /\b\d{1,2}%\s*off\b|\bsave\s+\d+%|\bdiscount\b/i

const PRICE_UNIT_HINT_PATTERN =
  /\/(?:kg|g|100g|l|ml|m2|m²|m|cm|mm|szt|pc|pcs|pack)\b/i

const NOISE_TITLE_PATTERN =
  /\b(home|homepage|shop|store|produkt|produkty|category|search|wyniki|koszyk)\b/i

const MAX_GENERIC_PRICE_SCAN = 1200
const MAX_SEMANTIC_PRICE_SCAN = 500

class ProductDetector {
  private readonly debug: boolean

  constructor(options: ProductDetectorOptions = {}) {
    this.debug = options.debug ?? false
  }

  async detectFromPage(): Promise<Product | null> {
    const context = this.buildPageContext()
    const structured = this.extractStructuredData()

    const name = this.pickBestName(structured, context)
    if (!name) {
      return null
    }

    const description = this.pickBestDescription(structured)
    const supplier = this.pickBestSupplier(structured)
    const imageUrl = this.pickBestImageUrl(structured, context)
    const price = this.pickBestPrice(structured.price, context)
    const catalogNumber = this.pickBestCatalogNumber(structured)

    const product: Product = {
      name,
      price,
      quantity: 1,
      productLink: window.location.href,
      supplier,
      catalogNumber,
      notes: description,
      imageUrl,
    }

    if (this.debug) {
      console.debug("[ProductDetector] Product", product)
    }

    return product
  }

  private buildPageContext(): ProductPageContext {
    const titleElement = this.findPrimaryTitleElement()
    const buyActionElement = this.findPrimaryBuyAction()

    let productRoot: Element | null = null

    if (titleElement) {
      productRoot = this.findClosestContainer(titleElement, PRODUCT_ROOT_SELECTORS)
    }

    if (!productRoot && buyActionElement) {
      productRoot = this.findClosestContainer(buyActionElement, PRODUCT_ROOT_SELECTORS)
    }

    if (!productRoot) {
      for (const selector of PRODUCT_ROOT_SELECTORS) {
        const candidate = document.querySelector(selector)
        if (candidate && this.getVisibleRect(candidate)) {
          productRoot = candidate
          break
        }
      }
    }

    return {
      titleElement,
      buyActionElement,
      productRoot,
    }
  }

  private pickBestName(
    structured: StructuredProductData,
    context: ProductPageContext,
  ): string | undefined {
    const candidates: TextCandidate[] = []

    const push = (value: string | undefined, score: number) => {
      const cleaned = this.toCleanText(value)
      if (!cleaned) return
      if (NOISE_TITLE_PATTERN.test(cleaned.toLowerCase()) && cleaned.length < 28) {
        return
      }
      candidates.push({ value: cleaned, score })
    }

    if (context.titleElement) {
      push(this.getElementValue(context.titleElement), 160)
    }

    push(structured.name, 84)

    for (const selector of TITLE_SELECTORS) {
      const nodes = document.querySelectorAll(selector)
      for (const node of nodes) {
        if (this.isInsideRecommendationContainer(node)) {
          continue
        }

        let score = node === context.titleElement ? 140 : 70
        if (node.tagName.toLowerCase() === "h1") {
          score += 24
        }

        score += Math.min(22, this.getFontSizePx(node))

        const rect = this.getVisibleRect(node)
        if (rect) {
          if (rect.top <= window.innerHeight * 0.75) {
            score += 18
          } else if (rect.top <= window.innerHeight * 1.4) {
            score += 8
          }
        } else if (selector === 'meta[property="og:title"]' || selector === 'meta[name="twitter:title"]') {
          score -= 18
        } else {
          continue
        }

        push(this.getElementValue(node), score)
      }
    }

    const documentTitle = this.getTitleFallback()
    push(documentTitle, 40)

    if (candidates.length === 0) {
      return undefined
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates[0].value
  }

  private pickBestDescription(structured: StructuredProductData): string | undefined {
    return this.pickFirstNonEmpty([
      structured.description,
      this.extractFromSelectors(DESCRIPTION_SELECTORS),
    ])
  }

  private pickBestSupplier(structured: StructuredProductData): string | undefined {
    return this.pickFirstNonEmpty([
      structured.brand,
      this.extractFromSelectors(BRAND_SELECTORS),
      this.getDomainName(),
    ])
  }

  private pickBestCatalogNumber(structured: StructuredProductData): string | undefined {
    return this.pickFirstNonEmpty([
      structured.catalogNumber,
      this.extractFromSelectors(CATALOG_NUMBER_SELECTORS),
    ])
  }

  private pickBestImageUrl(
    structured: StructuredProductData,
    context: ProductPageContext,
  ): string | undefined {
    return this.pickFirstNonEmpty([
      this.findBestImageInContext(context),
      structured.imageUrl,
      this.extractFromSelectors(IMAGE_SELECTORS),
      this.findLargestImageOnPage(),
    ])
  }

  private pickBestPrice(
    structuredPrice: string | undefined,
    context: ProductPageContext,
  ): string | undefined {
    const candidates: PriceCandidate[] = []

    const pushCandidate = (candidate: PriceCandidate) => {
      if (!Number.isFinite(candidate.amount) || candidate.amount <= 0) {
        return
      }
      if (candidate.amount > 10_000_000) {
        return
      }

      candidates.push({
        ...candidate,
        amount: this.roundToTwo(candidate.amount),
      })
    }

    if (structuredPrice) {
      const parsed = this.parseAmountFromText(structuredPrice)
      if (parsed !== null) {
        const structuredScore = context.titleElement || context.buyActionElement ? 72 : 112
        pushCandidate({
          amount: parsed,
          rawText: structuredPrice,
          source: "structured",
          element: null,
          score: structuredScore,
          reasons: ["structured-offer"],
        })
      }
    }

    this.collectMetaPriceCandidates(pushCandidate, context)
    this.collectSemanticPriceCandidates(pushCandidate, context)
    this.collectContextualPriceCandidates(pushCandidate, context)
    this.applyOutlierAdjustments(candidates)

    const selected = this.selectBestPriceCluster(candidates)

    if (this.debug) {
      const top = [...candidates]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((candidate) => ({
          amount: candidate.amount,
          source: candidate.source,
          score: candidate.score,
          reasons: candidate.reasons,
          rawText: candidate.rawText,
        }))

      console.debug("[ProductDetector] Price candidates", top)
      console.debug("[ProductDetector] Selected price", selected)
    }

    return selected ? this.formatPrice(selected.amount) : undefined
  }

  private collectMetaPriceCandidates(
    push: (candidate: PriceCandidate) => void,
    context: ProductPageContext,
  ): void {
    for (const selector of PRICE_META_SELECTORS) {
      const nodes = document.querySelectorAll(selector)

      for (const node of nodes) {
        const rawText = this.getElementValue(node)
        if (!rawText) continue

        const amount = this.parseAmountFromText(rawText)
        if (amount === null) continue

        const lowerSelector = selector.toLowerCase()
        let score = 96

        if (lowerSelector.includes("product:price") || lowerSelector.includes("itemprop")) {
          score += 24
        }

        if (lowerSelector.includes("sale")) {
          score += 8
        }

        if (lowerSelector.includes("standard") || lowerSelector.includes("regular")) {
          score -= 18
        }

        const reasons = ["meta-source"]
        if (PRICE_CURRENCY_PATTERN.test(rawText)) {
          score += 10
          reasons.push("currency-signal")
        }

        if (LOW_CONFIDENCE_PRICE_TEXT_PATTERN.test(rawText.toLowerCase())) {
          score -= 56
          reasons.push("from-installment-hint")
        }

        if (DISCOUNT_TEXT_PATTERN.test(rawText.toLowerCase())) {
          score -= 42
          reasons.push("discount-context")
        }

        push({
          amount,
          rawText,
          source: "meta",
          element: node,
          score,
          reasons,
        })
      }
    }

    const bodyText = document.body?.innerText ?? ""
    const inlineMetaMatches = Array.from(
      bodyText.matchAll(/(?:price|cena)\s*[:=]?\s*([\d\s.,]+\s*(?:zł|pln|usd|eur|gbp|\$|€|£))/gi),
    )

    for (const match of inlineMetaMatches.slice(0, 12)) {
      const rawText = match[0] ?? ""
      const amount = this.parseAmountFromText(rawText)
      if (amount === null) continue

      push({
        amount,
        rawText,
        source: "meta",
        element: context.productRoot,
        score: 58,
        reasons: ["inline-price-label"],
      })
    }
  }

  private collectSemanticPriceCandidates(
    push: (candidate: PriceCandidate) => void,
    context: ProductPageContext,
  ): void {
    let scanned = 0

    for (const selector of PRICE_SEMANTIC_SELECTORS) {
      const nodes = document.querySelectorAll(selector)

      for (const node of nodes) {
        if (scanned >= MAX_SEMANTIC_PRICE_SCAN) {
          return
        }
        scanned += 1

        if (node instanceof HTMLMetaElement) {
          continue
        }

        const rawText = this.toCleanText(this.getElementValue(node))
        if (!rawText || rawText.length > 120) {
          continue
        }

        const amount = this.parseAmountFromText(rawText)
        if (amount === null) {
          continue
        }

        let score = 72
        const reasons = ["semantic-selector"]

        if (selector.includes("itemprop")) {
          score += 22
          reasons.push("itemprop-price")
        }

        const classBag = this.getClassAndAttrBag(node)

        if (/(current|sale|now|final|our-price|main-price|actual)/.test(classBag)) {
          score += 20
          reasons.push("current-price-hint")
        }

        if (OLD_PRICE_HINT_PATTERN.test(classBag) || OLD_PRICE_HINT_PATTERN.test(rawText.toLowerCase())) {
          score -= 52
          reasons.push("old-price-hint")
        }

        if (LOW_CONFIDENCE_PRICE_TEXT_PATTERN.test(rawText.toLowerCase())) {
          score -= 28
          reasons.push("from-installment-hint")
        }

        if (DISCOUNT_TEXT_PATTERN.test(rawText.toLowerCase())) {
          score -= 38
          reasons.push("discount-context")
        }

        if (PRICE_UNIT_HINT_PATTERN.test(rawText.toLowerCase())) {
          score -= 14
          reasons.push("unit-price")
        }

        if (PRICE_CURRENCY_PATTERN.test(rawText)) {
          score += 12
          reasons.push("currency-signal")
        }

        score += this.scoreByElementContext(node, context, reasons)

        push({
          amount,
          rawText,
          source: "semantic",
          element: node,
          score,
          reasons,
        })
      }
    }
  }

  private collectContextualPriceCandidates(
    push: (candidate: PriceCandidate) => void,
    context: ProductPageContext,
  ): void {
    const roots = this.getContextualRoots(context)
    const seen = new Set<Element>()

    for (const root of roots) {
      if (seen.has(root)) continue
      seen.add(root)

      const nodes = Array.from(root.querySelectorAll(GENERIC_PRICE_TEXT_SELECTORS)).slice(
        0,
        MAX_GENERIC_PRICE_SCAN,
      )

      for (const node of nodes) {
        const rawText = this.toCleanText(this.getElementValue(node))
        if (!rawText || rawText.length > 84) {
          continue
        }

        if (!this.looksLikePriceText(rawText)) {
          continue
        }

        if (node.children.length > 0 && rawText.length > 46) {
          continue
        }

        const amount = this.parseAmountFromText(rawText)
        if (amount === null) {
          continue
        }

        let score = 38
        const reasons = ["contextual-text"]

        if (PRICE_CURRENCY_PATTERN.test(rawText)) {
          score += 14
          reasons.push("currency-signal")
        }

        if (PRICE_CONTEXT_HINT_PATTERN.test(rawText)) {
          score += 10
          reasons.push("price-label")
        }

        if (LOW_CONFIDENCE_PRICE_TEXT_PATTERN.test(rawText.toLowerCase())) {
          score -= 30
          reasons.push("from-installment-hint")
        }

        if (DISCOUNT_TEXT_PATTERN.test(rawText.toLowerCase())) {
          score -= 36
          reasons.push("discount-context")
        }

        if (OLD_PRICE_HINT_PATTERN.test(rawText.toLowerCase())) {
          score -= 34
          reasons.push("old-price-hint")
        }

        if (PRICE_UNIT_HINT_PATTERN.test(rawText.toLowerCase())) {
          score -= 14
          reasons.push("unit-price")
        }

        score += this.scoreByElementContext(node, context, reasons)

        push({
          amount,
          rawText,
          source: "contextual",
          element: node,
          score,
          reasons,
        })
      }
    }
  }

  private applyOutlierAdjustments(candidates: PriceCandidate[]): void {
    if (candidates.length < 3) {
      return
    }

    const anchorCandidates = candidates.filter((candidate) => {
      if (candidate.score < 62) return false
      if (candidate.source === "structured") return false
      if (candidate.reasons.includes("recommendation-container")) return false
      if (candidate.reasons.includes("from-installment-hint")) return false
      if (candidate.reasons.includes("discount-context")) return false
      return true
    })

    if (anchorCandidates.length === 0) {
      return
    }

    const anchorAmounts = anchorCandidates.map((candidate) => candidate.amount)
    const dominantMedian = this.median(anchorAmounts)
    const dominantMax = Math.max(...anchorAmounts)

    if (!Number.isFinite(dominantMedian) || dominantMedian <= 0) {
      return
    }

    for (const candidate of candidates) {
      const isLowOutlier =
        candidate.amount < dominantMedian * 0.45 &&
        dominantMax > candidate.amount * 2.2

      if (isLowOutlier) {
        const hardPenalty =
          candidate.source === "structured" ||
          candidate.reasons.includes("from-installment-hint") ||
          this.hasInstallmentLikeText(candidate.rawText)

        candidate.score -= hardPenalty ? 84 : 48
        candidate.reasons.push("low-outlier-vs-dominant-price")
      }

      const isHighOutlier =
        anchorCandidates.length >= 2 && candidate.amount > dominantMedian * 2.9

      if (isHighOutlier) {
        candidate.score -= 34
        candidate.reasons.push("high-outlier-vs-dominant-price")
      }
    }
  }

  private selectBestPriceCluster(candidates: PriceCandidate[]): PriceCluster | null {
    if (candidates.length === 0) {
      return null
    }

    const filtered = candidates.filter((candidate) => candidate.score > -20)
    if (filtered.length === 0) {
      return null
    }

    const clustersByKey = new Map<string, PriceCluster>()

    for (const candidate of filtered) {
      const key = candidate.amount.toFixed(2)
      const existing = clustersByKey.get(key)
      if (existing) {
        existing.candidates.push(candidate)
        continue
      }

      clustersByKey.set(key, {
        key,
        amount: candidate.amount,
        candidates: [candidate],
        score: 0,
      })
    }

    const sourcePriority: Record<PriceSource, number> = {
      structured: 4,
      meta: 3,
      semantic: 2,
      contextual: 1,
    }

    const clusters = Array.from(clustersByKey.values())
    for (const cluster of clusters) {
      const sorted = [...cluster.candidates].sort((a, b) => b.score - a.score)
      const bestScore = sorted[0]?.score ?? 0
      const averageScore =
        cluster.candidates.reduce((sum, candidate) => sum + candidate.score, 0) /
        cluster.candidates.length

      const sourceDiversity = new Set(cluster.candidates.map((candidate) => candidate.source)).size
      const supportBonus = Math.min(26, (cluster.candidates.length - 1) * 8)
      const diversityBonus = Math.max(0, sourceDiversity - 1) * 7
      const hasNonStructuredSupport = cluster.candidates.some(
        (candidate) => candidate.source !== "structured",
      )
      const structuredOnlyPenalty = hasNonStructuredSupport ? 0 : 22

      cluster.score =
        bestScore * 0.58 +
        averageScore * 0.42 +
        supportBonus +
        diversityBonus -
        structuredOnlyPenalty
      cluster.candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return sourcePriority[b.source] - sourcePriority[a.source]
      })
    }

    clusters.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aBest = a.candidates[0]?.score ?? Number.NEGATIVE_INFINITY
      const bBest = b.candidates[0]?.score ?? Number.NEGATIVE_INFINITY
      if (bBest !== aBest) return bBest - aBest
      return b.candidates.length - a.candidates.length
    })

    const bestCluster = clusters[0]
    if (!bestCluster) {
      return null
    }

    const strongCurrentCluster = clusters.find((cluster) =>
      cluster.candidates.some(
        (candidate) =>
          candidate.reasons.includes("current-price-hint") &&
          !candidate.reasons.includes("old-price-hint") &&
          !candidate.reasons.includes("from-installment-hint"),
      ),
    )

    if (strongCurrentCluster) {
      const bestIsSuspiciousLow =
        bestCluster.amount < strongCurrentCluster.amount * 0.55 &&
        strongCurrentCluster.score >= bestCluster.score - 14

      if (bestIsSuspiciousLow) {
        return strongCurrentCluster
      }
    }

    if (bestCluster.score < 35) {
      return null
    }

    return bestCluster
  }

  private scoreByElementContext(
    element: Element,
    context: ProductPageContext,
    reasons: string[],
  ): number {
    let score = 0

    if (this.isInsideRecommendationContainer(element)) {
      score -= 170
      reasons.push("recommendation-container")
    }

    const rect = this.getVisibleRect(element)
    if (!rect) {
      return score - 26
    }

    if (rect.top <= window.innerHeight * 1.3) {
      score += 14
      reasons.push("above-fold")
    } else if (rect.top > window.innerHeight * 2.2) {
      score -= 26
      reasons.push("far-below-fold")
    }

    const fontSize = this.getFontSizePx(element)
    if (fontSize >= 28) {
      score += 20
      reasons.push("large-typography")
    } else if (fontSize >= 22) {
      score += 14
      reasons.push("medium-typography")
    } else if (fontSize >= 18) {
      score += 8
      reasons.push("readable-typography")
    }

    const classBag = this.getClassAndAttrBag(element)
    if (/(promo|banner|badge|label|tag|shipping|delivery|coupon)/.test(classBag)) {
      score -= 24
      reasons.push("non-main-price-context")
    }

    if (this.isStrikethroughPrice(element)) {
      score -= 92
      reasons.push("strikethrough-old-price")
    }

    if (context.productRoot) {
      if (context.productRoot.contains(element)) {
        score += 34
        reasons.push("inside-product-root")
      } else {
        score -= 12
        reasons.push("outside-product-root")
      }
    }

    if (context.titleElement) {
      const titleRect = this.getVisibleRect(context.titleElement)
      if (titleRect) {
        const titleDistance = this.measureRectDistance(rect, titleRect)
        if (titleDistance < 220) {
          score += 30
          reasons.push("near-title")
        } else if (titleDistance < 460) {
          score += 16
          reasons.push("title-neighborhood")
        } else if (titleDistance > 1400) {
          score -= 20
          reasons.push("far-from-title")
        }
      }
    }

    if (context.buyActionElement) {
      const buyRect = this.getVisibleRect(context.buyActionElement)
      if (buyRect) {
        const buyDistance = this.measureRectDistance(rect, buyRect)
        if (buyDistance < 260) {
          score += 28
          reasons.push("near-buy-action")
        } else if (buyDistance < 520) {
          score += 14
          reasons.push("buy-action-neighborhood")
        } else if (buyDistance > 1500) {
          score -= 16
          reasons.push("far-from-buy-action")
        }
      }
    }

    return score
  }

  private isStrikethroughPrice(element: Element): boolean {
    try {
      let current: Element | null = element
      let depth = 0

      while (current && depth < 3) {
        const style = window.getComputedStyle(current)
        const decoration = style.textDecorationLine.toLowerCase()

        if (decoration.includes("line-through")) {
          return true
        }

        current = current.parentElement
        depth += 1
      }
    } catch {
      return false
    }

    return false
  }

  private getContextualRoots(context: ProductPageContext): Element[] {
    const roots: Element[] = []
    const seen = new Set<Element>()

    const add = (candidate: Element | null) => {
      if (!candidate || seen.has(candidate)) {
        return
      }
      seen.add(candidate)
      roots.push(candidate)
    }

    add(context.productRoot)

    if (context.titleElement) {
      add(context.titleElement.parentElement)
      add(context.titleElement.closest("section"))
    }

    if (context.buyActionElement) {
      add(context.buyActionElement.parentElement)
      add(context.buyActionElement.closest("section"))
      add(context.buyActionElement.closest("form"))
    }

    add(document.body)

    return roots
  }

  private looksLikePriceText(text: string): boolean {
    if (!text) {
      return false
    }

    const lower = text.toLowerCase()
    if (lower.length < 2 || lower.length > 84) {
      return false
    }

    const digitMatches = lower.match(/\d/g) ?? []
    if (digitMatches.length === 0) {
      return false
    }

    if (PRICE_CURRENCY_PATTERN.test(lower)) {
      return true
    }

    if (PRICE_CONTEXT_HINT_PATTERN.test(lower) && /\d/.test(lower)) {
      return true
    }

    return false
  }

  private hasInstallmentLikeText(text: string): boolean {
    return LOW_CONFIDENCE_PRICE_TEXT_PATTERN.test(text.toLowerCase())
  }

  private parseAmountFromText(input: string): number | null {
    const token = this.pickBestPriceToken(input)
    if (!token) {
      return null
    }

    return this.parseNumericToken(token)
  }

  private pickBestPriceToken(input: string): string | null {
    const matches = Array.from(input.matchAll(/\d[\d\s.,]*\d|\d/g))
    if (matches.length === 0) {
      return null
    }

    let bestToken: string | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (const match of matches) {
      const token = match[0]?.trim()
      if (!token) {
        continue
      }

      const start = match.index ?? 0
      const end = start + token.length
      const contextBefore = input.slice(Math.max(0, start - 14), start)
      const contextAfter = input.slice(end, Math.min(input.length, end + 14))
      const context = `${contextBefore} ${contextAfter}`

      const digitsOnly = token.replace(/\D/g, "")
      if (digitsOnly.length === 0) {
        continue
      }

      let score = 0

      if (/[,.]/.test(token)) score += 14
      if (/\s/.test(token)) score += 4
      if (digitsOnly.length >= 3 && digitsOnly.length <= 8) score += 12
      if (digitsOnly.length <= 2) score -= 12
      if (/(?:[.,]\d{1,2})$/.test(token)) score += 10
      if (PRICE_CURRENCY_PATTERN.test(context)) score += 28
      if (PRICE_CONTEXT_HINT_PATTERN.test(context.toLowerCase())) score += 8
      if (/%/.test(context)) score -= 22
      if (PRICE_UNIT_HINT_PATTERN.test(context.toLowerCase())) score -= 14

      if (score > bestScore) {
        bestScore = score
        bestToken = token
      }
    }

    if (bestScore < 0) {
      return null
    }

    return bestToken
  }

  private parseNumericToken(rawToken: string): number | null {
    const compact = rawToken.replace(/\s+/g, "").replace(/[^\d.,-]/g, "")
    if (!compact) {
      return null
    }

    const unsigned = compact.replace(/^-/, "")
    const commaCount = (unsigned.match(/,/g) ?? []).length
    const dotCount = (unsigned.match(/\./g) ?? []).length

    let normalized = unsigned

    if (commaCount > 0 && dotCount > 0) {
      if (unsigned.lastIndexOf(",") > unsigned.lastIndexOf(".")) {
        normalized = unsigned.replace(/\./g, "").replace(",", ".")
      } else {
        normalized = unsigned.replace(/,/g, "")
      }
    } else if (commaCount > 0) {
      if (commaCount === 1 && /,\d{1,2}$/.test(unsigned)) {
        normalized = unsigned.replace(",", ".")
      } else {
        normalized = unsigned.replace(/,/g, "")
      }
    } else if (dotCount > 0) {
      if (!(dotCount === 1 && /\.\d{1,2}$/.test(unsigned))) {
        normalized = unsigned.replace(/\./g, "")
      }
    }

    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null
    }

    return this.roundToTwo(parsed)
  }

  private extractStructuredData(): StructuredProductData {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    const products: Record<string, unknown>[] = []

    for (const script of scripts) {
      const raw = script.textContent?.trim()
      if (!raw) continue

      try {
        const parsed = JSON.parse(raw)
        this.collectStructuredProducts(parsed, products)
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }

    if (products.length === 0) {
      return {}
    }

    const ranked = products
      .map((product) => ({
        product,
        score: this.scoreStructuredProduct(product),
      }))
      .sort((a, b) => b.score - a.score)

    const best = ranked[0]?.product
    if (!best) {
      return {}
    }

    return {
      name: this.toCleanText(best.name),
      description: this.toCleanText(best.description),
      imageUrl: this.extractImageUrl(best.image),
      brand: this.extractBrand(best.brand),
      price: this.extractStructuredPrice(best),
      catalogNumber: this.extractCatalogNumber(best),
    }
  }

  private collectStructuredProducts(
    input: unknown,
    products: Record<string, unknown>[],
  ): void {
    if (!input) {
      return
    }

    if (Array.isArray(input)) {
      for (const item of input) {
        this.collectStructuredProducts(item, products)
      }
      return
    }

    if (typeof input !== "object") {
      return
    }

    const node = input as Record<string, unknown>
    const type = node["@type"]

    if (this.isProductType(type)) {
      products.push(node)
    }

    const graph = node["@graph"]
    if (graph) {
      this.collectStructuredProducts(graph, products)
    }

    const mainEntity = node.mainEntity
    if (mainEntity) {
      this.collectStructuredProducts(mainEntity, products)
    }

    const itemListElement = node.itemListElement
    if (itemListElement) {
      this.collectStructuredProducts(itemListElement, products)
    }
  }

  private isProductType(type: unknown): boolean {
    if (typeof type === "string") {
      return type.toLowerCase() === "product"
    }

    if (Array.isArray(type)) {
      return type.some((entry) => typeof entry === "string" && entry.toLowerCase() === "product")
    }

    return false
  }

  private scoreStructuredProduct(product: Record<string, unknown>): number {
    let score = 0

    if (this.toCleanText(product.name)) score += 60
    if (this.extractStructuredPrice(product)) score += 48
    if (this.extractImageUrl(product.image)) score += 20
    if (this.toCleanText(product.description)) score += 8
    if (this.extractBrand(product.brand)) score += 10

    return score
  }

  private extractStructuredPrice(product: Record<string, unknown>): string | undefined {
    const directPrice = this.parseStructuredNumber(product.price)
    if (directPrice !== null) {
      return this.formatPrice(directPrice)
    }

    const productLowPrice = this.parseStructuredNumber(product.lowPrice)
    const productHighPrice = this.parseStructuredNumber(product.highPrice)

    if (productLowPrice !== null && productHighPrice !== null) {
      if (productHighPrice >= productLowPrice * 1.35) {
        // Product-level range usually means "starting from", so avoid taking lowPrice blindly.
        return this.formatPrice(productHighPrice)
      }
      return this.formatPrice(productLowPrice)
    }

    const fallbackFromRange = productLowPrice ?? productHighPrice
    if (fallbackFromRange !== null) {
      return this.formatPrice(fallbackFromRange)
    }

    const offers = product.offers
    if (!offers) {
      return undefined
    }

    const offerCandidates = this.collectStructuredOfferPriceCandidates(offers)
    if (offerCandidates.length === 0) {
      return undefined
    }

    offerCandidates.sort((a, b) => b.score - a.score)
    return this.formatPrice(offerCandidates[0].amount)
  }

  private collectStructuredOfferPriceCandidates(input: unknown): StructuredOfferPriceCandidate[] {
    const candidates: StructuredOfferPriceCandidate[] = []

    const visit = (node: unknown, depth = 0) => {
      if (!node || depth > 4) {
        return
      }

      if (Array.isArray(node)) {
        for (const item of node) {
          visit(item, depth + 1)
        }
        return
      }

      if (typeof node !== "object") {
        return
      }

      const offer = node as Record<string, unknown>
      const types = this.getStructuredTypes(offer["@type"])
      const isOfferLike =
        types.includes("offer") ||
        types.includes("aggregateoffer") ||
        "price" in offer ||
        "lowPrice" in offer ||
        "highPrice" in offer

      if (!isOfferLike) {
        if (offer.offers) {
          visit(offer.offers, depth + 1)
        }
        return
      }

      const textBag = JSON.stringify(offer).toLowerCase()
      const hasInstallmentSignal = LOW_CONFIDENCE_PRICE_TEXT_PATTERN.test(textBag)
      const hasOldPriceSignal = OLD_PRICE_HINT_PATTERN.test(textBag)
      const isOutOfStock = /\boutofstock\b|\bsoldout\b/.test(textBag)
      const isAggregateOffer = types.includes("aggregateoffer")

      const pushCandidate = (
        amount: number | null,
        score: number,
        reasons: string[],
      ) => {
        if (amount === null) {
          return
        }

        let adjustedScore = score
        const adjustedReasons = [...reasons]

        if (hasInstallmentSignal) {
          adjustedScore -= 78
          adjustedReasons.push("from-installment-hint")
        }

        if (hasOldPriceSignal) {
          adjustedScore -= 30
          adjustedReasons.push("old-price-hint")
        }

        if (isOutOfStock) {
          adjustedScore -= 14
          adjustedReasons.push("out-of-stock")
        }

        candidates.push({
          amount,
          score: adjustedScore,
          reasons: adjustedReasons,
        })
      }

      const directPrice = this.parseStructuredNumber(offer.price)
      pushCandidate(directPrice, 114, ["structured-offer-price"])

      const lowPrice = this.parseStructuredNumber(offer.lowPrice)
      const highPrice = this.parseStructuredNumber(offer.highPrice)

      if (lowPrice !== null && highPrice !== null) {
        const rangeRatio = highPrice / Math.max(lowPrice, 0.01)

        if (rangeRatio >= 1.35) {
          pushCandidate(lowPrice, 70, ["structured-low-price-range"])
          pushCandidate(highPrice, 86, ["structured-high-price-range"])
        } else {
          pushCandidate(lowPrice, 92, ["structured-range-price"])
        }
      } else {
        pushCandidate(lowPrice, isAggregateOffer ? 72 : 88, ["structured-low-price"])
        pushCandidate(highPrice, isAggregateOffer ? 64 : 76, ["structured-high-price"])
      }

      if (offer.offers) {
        visit(offer.offers, depth + 1)
      }
    }

    visit(input)
    return candidates
  }

  private parseStructuredNumber(value: unknown): number | null {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value <= 0) {
        return null
      }
      return this.roundToTwo(value)
    }

    if (typeof value === "string") {
      return this.parseAmountFromText(value)
    }

    return null
  }

  private getStructuredTypes(typeValue: unknown): string[] {
    if (typeof typeValue === "string") {
      return [typeValue.toLowerCase()]
    }

    if (Array.isArray(typeValue)) {
      return typeValue
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.toLowerCase())
    }

    return []
  }

  private extractCatalogNumber(product: Record<string, unknown>): string | undefined {
    const directCandidates = [
      product.sku,
      product.mpn,
      product.productID,
      product.gtin,
      product.gtin8,
      product.gtin12,
      product.gtin13,
      product.gtin14,
    ]

    for (const value of directCandidates) {
      const cleaned = this.toCleanText(value)
      if (cleaned) {
        return cleaned
      }
    }

    const offers = product.offers
    if (Array.isArray(offers)) {
      for (const offer of offers) {
        if (!offer || typeof offer !== "object") {
          continue
        }

        const item = offer as Record<string, unknown>
        const cleaned = this.pickFirstNonEmpty([
          this.toCleanText(item.sku),
          this.toCleanText(item.mpn),
        ])

        if (cleaned) {
          return cleaned
        }
      }
    } else if (offers && typeof offers === "object") {
      const offer = offers as Record<string, unknown>
      const cleaned = this.pickFirstNonEmpty([
        this.toCleanText(offer.sku),
        this.toCleanText(offer.mpn),
      ])

      if (cleaned) {
        return cleaned
      }
    }

    return undefined
  }

  private extractImageUrl(input: unknown): string | undefined {
    if (typeof input === "string") {
      return this.resolveUrl(input)
    }

    if (Array.isArray(input)) {
      for (const item of input) {
        const imageUrl = this.extractImageUrl(item)
        if (imageUrl) {
          return imageUrl
        }
      }
      return undefined
    }

    if (input && typeof input === "object") {
      const value = input as Record<string, unknown>
      return this.pickFirstNonEmpty([
        this.extractImageUrl(value.url),
        this.extractImageUrl(value.contentUrl),
      ])
    }

    return undefined
  }

  private extractBrand(input: unknown): string | undefined {
    if (typeof input === "string") {
      return this.toCleanText(input)
    }

    if (input && typeof input === "object") {
      const objectValue = input as Record<string, unknown>
      return this.toCleanText(objectValue.name)
    }

    return undefined
  }

  private findPrimaryTitleElement(): Element | null {
    let bestElement: Element | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (const selector of TITLE_SELECTORS) {
      const elements = document.querySelectorAll(selector)
      for (const element of elements) {
        if (this.isInsideRecommendationContainer(element)) {
          continue
        }

        const text = this.toCleanText(this.getElementValue(element))
        if (!text || text.length < 4) {
          continue
        }

        const rect = this.getVisibleRect(element)
        if (!rect) {
          continue
        }

        let score = 0
        if (selector === "h1" || selector === "main h1" || selector === "article h1") {
          score += 40
        }
        if (element.tagName.toLowerCase() === "h1") {
          score += 30
        }

        score += Math.min(28, this.getFontSizePx(element))

        if (rect.top <= window.innerHeight * 0.8) {
          score += 24
        } else if (rect.top <= window.innerHeight * 1.5) {
          score += 12
        }

        if (rect.width >= 160) {
          score += 8
        }

        if (score > bestScore) {
          bestScore = score
          bestElement = element
        }
      }
    }

    return bestElement
  }

  private findPrimaryBuyAction(): Element | null {
    const buttons = document.querySelectorAll("button, [role='button'], input[type='submit'], a")

    let bestElement: Element | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (const button of buttons) {
      const rect = this.getVisibleRect(button)
      if (!rect) continue

      const text = this.getElementValue(button).toLowerCase()
      const attrBag = this.getClassAndAttrBag(button)

      const isBuyActionText = BUY_ACTION_TEXT_PATTERN.test(text)
      const isBuyActionAttr = /(buy|cart|basket|checkout|order|purchase|koszyk|kup)/.test(attrBag)

      let score = 0
      if (isBuyActionText) score += 40
      if (isBuyActionAttr) score += 28
      if (button.tagName.toLowerCase() === "button") score += 10
      if (rect.top <= window.innerHeight * 1.8) score += 8
      if (rect.width >= 80 && rect.height >= 30) score += 6

      if (score > bestScore) {
        bestScore = score
        bestElement = button
      }
    }

    return bestScore >= 24 ? bestElement : null
  }

  private getVisibleRect(element: Element): DOMRect | null {
    const htmlElement = element as HTMLElement
    if (htmlElement.hidden) {
      return null
    }

    const style = window.getComputedStyle(htmlElement)
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number.parseFloat(style.opacity) <= 0.01
    ) {
      return null
    }

    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }

    const topLimit = -window.innerHeight * 0.8
    const bottomLimit = window.innerHeight * 3.2

    if (rect.bottom < topLimit || rect.top > bottomLimit) {
      return null
    }

    return rect
  }

  private getFontSizePx(element: Element): number {
    try {
      const size = window.getComputedStyle(element).fontSize
      const parsed = Number.parseFloat(size)
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  }

  private findClosestContainer(element: Element, selectors: string[]): Element | null {
    for (const selector of selectors) {
      const container = element.closest(selector)
      if (container) {
        return container
      }
    }

    return null
  }

  private isInsideRecommendationContainer(element: Element): boolean {
    return Boolean(this.findClosestContainer(element, RECOMMENDATION_CONTAINER_SELECTORS))
  }

  private measureRectDistance(a: DOMRect, b: DOMRect): number {
    const ax = a.left + a.width / 2
    const ay = a.top + a.height / 2
    const bx = b.left + b.width / 2
    const by = b.top + b.height / 2

    return Math.abs(ax - bx) + Math.abs(ay - by)
  }

  private findBestImageInContext(context: ProductPageContext): string | undefined {
    const roots = [context.productRoot, context.titleElement?.parentElement, context.buyActionElement?.parentElement]
      .filter((value): value is Element => Boolean(value))

    let bestImage: HTMLImageElement | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (const root of roots) {
      const images = root.querySelectorAll("img")

      for (const image of images) {
        if (!(image instanceof HTMLImageElement)) {
          continue
        }

        if (!/^https?:\/\//.test(image.src)) {
          continue
        }

        if (image.naturalWidth < 140 || image.naturalHeight < 140) {
          continue
        }

        const rect = this.getVisibleRect(image)
        if (!rect) {
          continue
        }

        const area = image.naturalWidth * image.naturalHeight
        let score = Math.log10(Math.max(area, 1)) * 18

        if (/logo|icon|avatar|sprite/i.test(image.src)) {
          score -= 60
        }

        if (context.titleElement) {
          const titleRect = this.getVisibleRect(context.titleElement)
          if (titleRect) {
            const distance = this.measureRectDistance(rect, titleRect)
            if (distance < 600) {
              score += 12
            }
          }
        }

        if (score > bestScore) {
          bestScore = score
          bestImage = image
        }
      }
    }

    return bestImage ? this.resolveUrl(bestImage.src) : undefined
  }

  private findLargestImageOnPage(): string | undefined {
    const images = Array.from(document.querySelectorAll("img"))
      .filter((node): node is HTMLImageElement => node instanceof HTMLImageElement)
      .filter((image) => image.naturalWidth >= 180 && image.naturalHeight >= 180)
      .filter((image) => /^https?:\/\//.test(image.src))
      .filter((image) => !/logo|icon|avatar|sprite/i.test(image.src))

    if (images.length === 0) {
      return undefined
    }

    images.sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)
    return this.resolveUrl(images[0].src)
  }

  private extractFromSelectors(selectors: string[]): string | undefined {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      let fallback: string | undefined

      for (const element of elements) {
        const value = this.getElementValue(element)
        const cleaned = this.toCleanText(value)
        if (!cleaned) {
          continue
        }

        if (!fallback) {
          fallback = cleaned
        }

        if (element instanceof HTMLMetaElement) {
          continue
        }

        if (this.isInsideRecommendationContainer(element)) {
          continue
        }

        if (this.getVisibleRect(element)) {
          return cleaned
        }
      }

      if (fallback) {
        return fallback
      }
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

  private getClassAndAttrBag(element: Element): string {
    return `${element.className} ${element.id} ${element.getAttribute("data-testid") ?? ""} ${
      element.getAttribute("name") ?? ""
    } ${element.getAttribute("aria-label") ?? ""}`.toLowerCase()
  }

  private getTitleFallback(): string | undefined {
    const title = document.title
    if (!title) {
      return undefined
    }

    return this.toCleanText(title.split(/[|\-–—•]/)[0] ?? title)
  }

  private formatPrice(value: number): string {
    return this.roundToTwo(value).toFixed(2)
  }

  private roundToTwo(value: number): number {
    return Math.round(value * 100) / 100
  }

  private median(values: number[]): number {
    if (values.length === 0) {
      return 0
    }

    const sorted = [...values].sort((a, b) => a - b)
    const midpoint = Math.floor(sorted.length / 2)

    if (sorted.length % 2 === 0) {
      return (sorted[midpoint - 1] + sorted[midpoint]) / 2
    }

    return sorted[midpoint]
  }

  private resolveUrl(value: unknown): string | undefined {
    if (typeof value !== "string" || value.trim().length === 0) {
      return undefined
    }

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

export default ProductDetector
