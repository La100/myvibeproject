import ProductDetector from "./utils/ProductDetector"

const ACTIONS = {
  PING: "ping",
  CAN_OPEN_CLIPPER: "canOpenClipper",
  DETECT_PRODUCT: "detectProduct",
  ENABLE_IMAGE_PICKER: "enableImagePicker",
  OPEN_IFRAME_POPUP: "openIframePopup",
  CLOSE_IFRAME_POPUP: "closeIframePopup",
  IMAGE_SELECTED: "imageSelected",
} as const

type RuntimeMessage = {
  action: string
  [key: string]: unknown
}

function isObjectMessage(value: unknown): value is RuntimeMessage {
  return typeof value === "object" && value !== null && "action" in value
}

function hasStructuredProductSignal(): boolean {
  if (document.querySelector('[itemtype*="Product"]')) {
    return true
  }

  const ogType = document
    .querySelector('meta[property="og:type"]')
    ?.getAttribute("content")
    ?.toLowerCase()
  if (ogType?.includes("product")) {
    return true
  }

  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    const text = script.textContent?.toLowerCase() ?? ""
    if (text.includes('"@type":"product"') || text.includes('"@type": "product"')) {
      return true
    }
  }

  return false
}

function hasPriceSignal(): boolean {
  const priceSelectors = [
    '[itemprop="price"]',
    '[data-testid*="price"]',
    ".price",
    ".current-price",
    ".sale-price",
    '[class*="price"]',
  ]

  for (const selector of priceSelectors) {
    const node = document.querySelector(selector)
    const text = node?.textContent?.trim()
    if (text && /[$€£¥₽]|zł|pln|usd|eur|gbp|sek|nok|dkk|kr/i.test(text)) {
      return true
    }
  }

  const bodySample = document.body?.innerText?.slice(0, 3500) ?? ""
  return /(?:[$€£¥₽]|zł|pln|usd|eur|gbp|sek|nok|dkk|kr)\s?\d/i.test(bodySample)
}

function hasProductLikePathname(): boolean {
  const path = window.location.pathname.toLowerCase()
  return /\/(product|products|produkt|produkty|item|items|offer|oferta|p)\b/.test(path)
}

function hasReasonableTitleSignal(): boolean {
  const h1 = document.querySelector("h1")?.textContent?.trim() ?? ""
  if (h1.length >= 6 && h1.length <= 180) {
    return true
  }

  const title = document.title.trim()
  return title.length >= 8 && title.length <= 200
}

function canOpenClipperOnThisPage(): { allowed: boolean; reason?: string } {
  if (!document.body) {
    return { allowed: false, reason: "document-not-ready" }
  }

  if (hasStructuredProductSignal()) {
    return { allowed: true, reason: "structured-product" }
  }

  const titleSignal = hasReasonableTitleSignal()
  const priceSignal = hasPriceSignal()
  const pathSignal = hasProductLikePathname()

  if ((titleSignal && priceSignal) || (pathSignal && priceSignal)) {
    return { allowed: true, reason: "heuristic-product" }
  }

  // Allow opening clipper on any regular page so users can fill product details manually.
  return { allowed: true, reason: "manual-mode" }
}

const IFRAME_ID = "myvibeproject-iframe-popup"
const OVERLAY_ID = "myvibeproject-iframe-overlay"

let iframePopup: HTMLIFrameElement | null = null
let overlayElement: HTMLDivElement | null = null
let escapeListener: ((event: KeyboardEvent) => void) | null = null

let imagePickerActive = false
const imagePickerElements = new Set<HTMLImageElement>()
const imageOriginalStyles = new Map<HTMLImageElement, string>()

function isSupportedImage(img: HTMLImageElement): boolean {
  if (!img.src) return false
  if (img.width < 80 || img.height < 80) return false
  return /^https?:\/\//.test(img.src)
}

function applyImagePickerStyles(img: HTMLImageElement): void {
  if (!imageOriginalStyles.has(img)) {
    imageOriginalStyles.set(img, img.style.cssText)
  }

  img.style.cursor = "crosshair"
  img.style.outline = "2px solid #2563eb"
  img.style.outlineOffset = "2px"
  img.style.transition = "transform 0.15s ease"
}

function resetImageStyles(img: HTMLImageElement): void {
  const previousStyle = imageOriginalStyles.get(img)
  if (previousStyle !== undefined) {
    img.style.cssText = previousStyle
  } else {
    img.removeAttribute("style")
  }
  imageOriginalStyles.delete(img)
}

function handleImageMouseEnter(event: Event): void {
  const img = event.currentTarget as HTMLImageElement | null
  if (!img) return

  img.style.transform = "scale(1.02)"
  img.style.boxShadow = "0 8px 18px rgba(37, 99, 235, 0.25)"
}

function handleImageMouseLeave(event: Event): void {
  const img = event.currentTarget as HTMLImageElement | null
  if (!img) return

  img.style.transform = ""
  img.style.boxShadow = ""
}

function handleImageClick(event: Event): void {
  event.preventDefault()
  event.stopPropagation()

  const img = event.currentTarget as HTMLImageElement | null
  if (!img?.src) {
    return
  }

  chrome.runtime
    .sendMessage({
      action: ACTIONS.IMAGE_SELECTED,
      imageUrl: img.src,
    })
    .catch(() => {
      // If popup isn't open, we can ignore this.
    })

  disableImagePicker()
}

function enableImagePicker(): void {
  if (imagePickerActive) {
    return
  }

  imagePickerActive = true

  const images = document.querySelectorAll("img")
  for (const img of images) {
    if (!(img instanceof HTMLImageElement) || !isSupportedImage(img)) {
      continue
    }

    imagePickerElements.add(img)
    applyImagePickerStyles(img)
    img.addEventListener("click", handleImageClick, true)
    img.addEventListener("mouseenter", handleImageMouseEnter)
    img.addEventListener("mouseleave", handleImageMouseLeave)
  }
}

function disableImagePicker(): void {
  if (!imagePickerActive) {
    return
  }

  imagePickerActive = false

  for (const img of imagePickerElements) {
    img.removeEventListener("click", handleImageClick, true)
    img.removeEventListener("mouseenter", handleImageMouseEnter)
    img.removeEventListener("mouseleave", handleImageMouseLeave)
    resetImageStyles(img)
  }

  imagePickerElements.clear()
}

function removeIframePopup(): void {
  if (escapeListener) {
    window.removeEventListener("keydown", escapeListener)
    escapeListener = null
  }

  if (iframePopup) {
    iframePopup.remove()
    iframePopup = null
  }

  if (overlayElement) {
    overlayElement.remove()
    overlayElement = null
  }

  disableImagePicker()
}

function createIframePopup(): void {
  if (iframePopup) {
    return
  }

  const overlay = document.createElement("div")
  overlay.id = OVERLAY_ID
  overlay.style.cssText = `
    position: fixed !important;
    inset: 0 !important;
    background: rgba(15, 23, 42, 0.28) !important;
    backdrop-filter: blur(1px) !important;
    z-index: 2147483646 !important;
  `
  overlay.addEventListener("click", removeIframePopup)

  const iframe = document.createElement("iframe")
  iframe.id = IFRAME_ID
  iframe.src = chrome.runtime.getURL("popup.html")
  iframe.title = "MyVibeProject Clipper"
  iframe.style.cssText = `
    position: fixed !important;
    top: 24px !important;
    right: 24px !important;
    width: 420px !important;
    height: 600px !important;
    border: 1px solid rgba(15, 23, 42, 0.15) !important;
    border-radius: 14px !important;
    box-shadow: 0 22px 40px rgba(2, 6, 23, 0.35) !important;
    z-index: 2147483647 !important;
    background: #ffffff !important;
  `

  escapeListener = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      removeIframePopup()
    }
  }
  window.addEventListener("keydown", escapeListener)

  document.body.append(overlay, iframe)

  overlayElement = overlay
  iframePopup = iframe
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isObjectMessage(request)) {
    return false
  }

  if (request.action === ACTIONS.PING) {
    sendResponse({ status: "ready" })
    return false
  }

  if (request.action === ACTIONS.CAN_OPEN_CLIPPER) {
    sendResponse(canOpenClipperOnThisPage())
    return false
  }

  if (request.action === ACTIONS.OPEN_IFRAME_POPUP) {
    createIframePopup()
    sendResponse({ success: true })
    return false
  }

  if (request.action === ACTIONS.CLOSE_IFRAME_POPUP) {
    removeIframePopup()
    sendResponse({ success: true })
    return false
  }

  if (request.action === ACTIONS.ENABLE_IMAGE_PICKER) {
    enableImagePicker()
    sendResponse({ success: true })
    return false
  }

  if (request.action === ACTIONS.DETECT_PRODUCT) {
    const detector = new ProductDetector({ debug: false })

    void detector
      .detectFromPage()
      .then((product) => {
        if (product) {
          sendResponse({ success: true, product })
        } else {
          sendResponse({ success: false, error: "No product detected" })
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Detection failed"
        sendResponse({ success: false, error: message })
      })

    return true
  }

  sendResponse({ success: false, error: `Unknown action: ${request.action}` })
  return false
})
