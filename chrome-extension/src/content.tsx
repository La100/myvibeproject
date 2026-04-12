import ProductDetector from "./utils/ProductDetector"

const ACTIONS = {
  PING: "ping",
  CAN_OPEN_CLIPPER: "canOpenClipper",
  DETECT_PRODUCT: "detectProduct",
  ENABLE_IMAGE_PICKER: "enableImagePicker",
  ENABLE_SCREENSHOT_PICKER: "enableScreenshotPicker",
  OPEN_IFRAME_POPUP: "openIframePopup",
  CLOSE_IFRAME_POPUP: "closeIframePopup",
  CAPTURE_VISIBLE_TAB: "captureVisibleTab",
  IMAGE_SELECTED: "imageSelected",
  PICKER_STATUS_CHANGED: "pickerStatusChanged",
} as const

type RuntimeMessage = {
  action: string
  [key: string]: unknown
}

type PendingClipperImage = {
  kind: "url" | "data"
  value: string
  updatedAt: number
}

const CLIPPER_PENDING_IMAGE_STORAGE_KEY = "clipper_pending_image"

function isObjectMessage(value: unknown): value is RuntimeMessage {
  return typeof value === "object" && value !== null && "action" in value
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Extension context invalidated/i.test(error.message)
  )
}

function isRuntimeContextAvailable(): boolean {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

function notifyPickerStatus(
  picker: "image" | "screenshot",
  active: boolean,
  reason: "selected" | "cancelled" | "error" | "idle" = "idle",
): void {
  void sendRuntimeMessage({
    action: ACTIONS.PICKER_STATUS_CHANGED,
    picker,
    active,
    reason,
  })
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
const POPUP_TOP_GAP_PX = 16
const POPUP_VERTICAL_GAP_PX = POPUP_TOP_GAP_PX * 2

let iframePopup: HTMLIFrameElement | null = null
let overlayElement: HTMLDivElement | null = null
let escapeListener: ((event: KeyboardEvent) => void) | null = null

let imagePickerActive = false
const imagePickerElements = new Set<HTMLImageElement>()
const imageOriginalStyles = new Map<HTMLImageElement, string>()

let screenshotPickerActive = false
let screenshotOverlayElement: HTMLDivElement | null = null
let screenshotSelectionElement: HTMLDivElement | null = null
let screenshotStartPoint: { x: number; y: number } | null = null
let screenshotEscapeListener: ((event: KeyboardEvent) => void) | null = null
let previousIframeVisibility: string | null = null
let previousOverlayVisibility: string | null = null

function cleanupInvalidatedContext(): void {
  if (screenshotEscapeListener) {
    window.removeEventListener("keydown", screenshotEscapeListener)
    screenshotEscapeListener = null
  }

  if (escapeListener) {
    window.removeEventListener("keydown", escapeListener)
    escapeListener = null
  }

  if (screenshotOverlayElement) {
    screenshotOverlayElement.remove()
    screenshotOverlayElement = null
  }

  screenshotSelectionElement = null
  screenshotStartPoint = null
  screenshotPickerActive = false

  for (const img of imagePickerElements) {
    img.removeEventListener("click", handleImageClick, true)
    img.removeEventListener("mouseenter", handleImageMouseEnter)
    img.removeEventListener("mouseleave", handleImageMouseLeave)
    resetImageStyles(img)
  }

  imagePickerElements.clear()
  imagePickerActive = false

  if (iframePopup) {
    iframePopup.remove()
    iframePopup = null
  }

  if (overlayElement) {
    overlayElement.remove()
    overlayElement = null
  }

  previousIframeVisibility = null
  previousOverlayVisibility = null
}

async function sendRuntimeMessage(payload: RuntimeMessage): Promise<void> {
  if (!isRuntimeContextAvailable()) {
    cleanupInvalidatedContext()
    return
  }

  try {
    await chrome.runtime.sendMessage(payload)
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      cleanupInvalidatedContext()
      return
    }

    throw error
  }
}

async function persistPendingImageSelection(selection: PendingClipperImage): Promise<void> {
  if (!isRuntimeContextAvailable()) {
    cleanupInvalidatedContext()
    return
  }

  try {
    await chrome.storage.local.set({
      [CLIPPER_PENDING_IMAGE_STORAGE_KEY]: selection,
    })
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      cleanupInvalidatedContext()
      return
    }

    throw error
  }
}

function setOverlayInteractivity(enabled: boolean): void {
  if (!overlayElement) {
    return
  }

  overlayElement.style.pointerEvents = enabled ? "auto" : "none"
}

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

async function handleImageClick(event: Event): Promise<void> {
  event.preventDefault()
  event.stopPropagation()
  if ("stopImmediatePropagation" in event) {
    event.stopImmediatePropagation()
  }

  const img = event.currentTarget as HTMLImageElement | null
  if (!img?.src) {
    return
  }

  try {
    const rect = createSelectionRect(
      {
        x: img.getBoundingClientRect().left,
        y: img.getBoundingClientRect().top,
      },
      {
        x: img.getBoundingClientRect().right,
        y: img.getBoundingClientRect().bottom,
      },
    )

    let selection: PendingClipperImage = {
      kind: "url",
      value: img.currentSrc || img.src,
      updatedAt: Date.now(),
    }

    if (rect.width >= 8 && rect.height >= 8) {
      hideClipperForScreenshotPicker()

      try {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })

        const screenshot = await requestVisibleTabCapture()
        const croppedImage = await cropCapturedScreenshot(
          screenshot,
          rect,
          window.innerWidth,
          window.innerHeight,
        )

        selection = {
          kind: "data",
          value: croppedImage,
          updatedAt: Date.now(),
        }
      } catch (error) {
        console.warn("[MyVibeProject Content] Failed to capture clicked image", error)
      } finally {
        restoreClipperAfterScreenshotPicker()
      }
    }

    await persistPendingImageSelection(selection)
    await sendRuntimeMessage({ action: ACTIONS.IMAGE_SELECTED })
  } catch (error) {
    console.warn("[MyVibeProject Content] Failed to persist selected image", error)
  }

  disableImagePicker()
}

function enableImagePicker(): number {
  if (imagePickerActive) {
    return imagePickerElements.size
  }

  const images = document.querySelectorAll("img")
  let selectableCount = 0

  for (const img of images) {
    if (!(img instanceof HTMLImageElement) || !isSupportedImage(img)) {
      continue
    }

    selectableCount += 1
    imagePickerElements.add(img)
    applyImagePickerStyles(img)
    img.addEventListener("click", handleImageClick, true)
    img.addEventListener("mouseenter", handleImageMouseEnter)
    img.addEventListener("mouseleave", handleImageMouseLeave)
  }

  if (selectableCount === 0) {
    return 0
  }

  imagePickerActive = true
  setOverlayInteractivity(false)
  return selectableCount
}

function disableImagePicker(): void {
  if (!imagePickerActive) {
    setOverlayInteractivity(true)
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
  setOverlayInteractivity(true)
  notifyPickerStatus("image", false, "idle")
}

function hideClipperForScreenshotPicker(): void {
  if (iframePopup) {
    previousIframeVisibility = iframePopup.style.visibility
    iframePopup.style.visibility = "hidden"
  }

  if (overlayElement) {
    previousOverlayVisibility = overlayElement.style.visibility
    overlayElement.style.visibility = "hidden"
  }
}

function restoreClipperAfterScreenshotPicker(): void {
  if (iframePopup && previousIframeVisibility !== null) {
    iframePopup.style.visibility = previousIframeVisibility
  }
  if (overlayElement && previousOverlayVisibility !== null) {
    overlayElement.style.visibility = previousOverlayVisibility
  }
  previousIframeVisibility = null
  previousOverlayVisibility = null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function createSelectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const x1 = clamp(Math.min(start.x, end.x), 0, viewportWidth)
  const y1 = clamp(Math.min(start.y, end.y), 0, viewportHeight)
  const x2 = clamp(Math.max(start.x, end.x), 0, viewportWidth)
  const y2 = clamp(Math.max(start.y, end.y), 0, viewportHeight)

  return {
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
  }
}

function updateSelectionElement(rect: {
  x: number
  y: number
  width: number
  height: number
}): void {
  if (!screenshotSelectionElement) {
    return
  }

  screenshotSelectionElement.style.display = "block"
  screenshotSelectionElement.style.left = `${rect.x}px`
  screenshotSelectionElement.style.top = `${rect.y}px`
  screenshotSelectionElement.style.width = `${rect.width}px`
  screenshotSelectionElement.style.height = `${rect.height}px`
}

function requestVisibleTabCapture(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isRuntimeContextAvailable()) {
      cleanupInvalidatedContext()
      reject(new Error("Extension context invalidated"))
      return
    }

    try {
      chrome.runtime.sendMessage(
        { action: ACTIONS.CAPTURE_VISIBLE_TAB },
        (response: { success?: boolean; dataUrl?: string; error?: string }) => {
          const runtimeError = chrome.runtime.lastError
          if (runtimeError) {
            const error = new Error(runtimeError.message)
            if (isExtensionContextInvalidatedError(error)) {
              cleanupInvalidatedContext()
            }
            reject(error)
            return
          }

          if (!response?.success || typeof response.dataUrl !== "string") {
            reject(new Error(response?.error ?? "Failed to capture screenshot"))
            return
          }

          resolve(response.dataUrl)
        },
      )
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        cleanupInvalidatedContext()
      }
      reject(error instanceof Error ? error : new Error("Failed to capture screenshot"))
    }
  })
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Failed to decode captured screenshot"))
    image.src = dataUrl
  })
}

async function cropCapturedScreenshot(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
): Promise<string> {
  const image = await loadImageFromDataUrl(dataUrl)
  const scaleX = image.naturalWidth / Math.max(1, viewportWidth)
  const scaleY = image.naturalHeight / Math.max(1, viewportHeight)

  const sourceX = clamp(Math.floor(rect.x * scaleX), 0, image.naturalWidth - 1)
  const sourceY = clamp(Math.floor(rect.y * scaleY), 0, image.naturalHeight - 1)
  const sourceWidth = clamp(
    Math.max(1, Math.floor(rect.width * scaleX)),
    1,
    image.naturalWidth - sourceX,
  )
  const sourceHeight = clamp(
    Math.max(1, Math.floor(rect.height * scaleY)),
    1,
    image.naturalHeight - sourceY,
  )

  const canvas = document.createElement("canvas")
  canvas.width = sourceWidth
  canvas.height = sourceHeight

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not initialize screenshot canvas context")
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  )

  return canvas.toDataURL("image/png")
}

function disableScreenshotPicker(options?: {
  restoreClipper?: boolean
  reason?: "selected" | "cancelled" | "error" | "idle"
}): void {
  const restoreClipper = options?.restoreClipper !== false
  const reason = options?.reason ?? "idle"

  if (screenshotEscapeListener) {
    window.removeEventListener("keydown", screenshotEscapeListener)
    screenshotEscapeListener = null
  }

  if (screenshotOverlayElement) {
    screenshotOverlayElement.remove()
    screenshotOverlayElement = null
  }

  screenshotSelectionElement = null
  screenshotStartPoint = null
  screenshotPickerActive = false
  setOverlayInteractivity(true)
  notifyPickerStatus("screenshot", false, reason)

  if (restoreClipper) {
    restoreClipperAfterScreenshotPicker()
  }
}

async function finalizeScreenshotSelection(rect: {
  x: number
  y: number
  width: number
  height: number
}): Promise<void> {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  disableScreenshotPicker({ restoreClipper: false, reason: "selected" })

  // Let the browser repaint without the picker overlay before capture.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

  try {
    const screenshot = await requestVisibleTabCapture()
    const croppedImage = await cropCapturedScreenshot(
      screenshot,
      rect,
      viewportWidth,
      viewportHeight,
    )

    await persistPendingImageSelection({
      kind: "data",
      value: croppedImage,
      updatedAt: Date.now(),
    })
    await sendRuntimeMessage({
      action: ACTIONS.IMAGE_SELECTED,
    })
    notifyPickerStatus("screenshot", false, "selected")
  } catch (error) {
    console.warn("[MyVibeProject Content] Failed to capture selected area", error)
    notifyPickerStatus("screenshot", false, "error")
  } finally {
    restoreClipperAfterScreenshotPicker()
  }
}

function enableScreenshotPicker(): boolean {
  if (screenshotPickerActive) {
    return true
  }

  if (!document.body) {
    return false
  }

  disableImagePicker()
  hideClipperForScreenshotPicker()

  const pickerOverlay = document.createElement("div")
  pickerOverlay.style.cssText = `
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    cursor: crosshair !important;
    background: transparent !important;
    user-select: none !important;
  `

  const hint = document.createElement("div")
  hint.style.cssText = `
    position: fixed !important;
    top: 16px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: rgba(15, 23, 42, 0.88) !important;
    color: #ffffff !important;
    padding: 8px 12px !important;
    border-radius: 999px !important;
    font-size: 12px !important;
    line-height: 1 !important;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif !important;
    pointer-events: none !important;
  `
  hint.textContent = "Drag to select area. Press Esc to cancel."
  pickerOverlay.appendChild(hint)

  const selection = document.createElement("div")
  selection.style.cssText = `
    position: fixed !important;
    display: none !important;
    left: 0 !important;
    top: 0 !important;
    width: 0 !important;
    height: 0 !important;
    border: 2px solid #2563eb !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border-radius: 8px !important;
    box-shadow:
      0 0 0 9999px rgba(2, 6, 23, 0.42),
      0 0 0 1px rgba(255, 255, 255, 0.95) inset,
      0 12px 32px rgba(2, 6, 23, 0.28) !important;
    pointer-events: none !important;
  `
  pickerOverlay.appendChild(selection)

  pickerOverlay.addEventListener("contextmenu", (event) => {
    event.preventDefault()
  })

  pickerOverlay.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    const point = { x: event.clientX, y: event.clientY }
    screenshotStartPoint = point
    updateSelectionElement({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    })
  })

  pickerOverlay.addEventListener("mousemove", (event) => {
    if (!screenshotStartPoint) {
      return
    }
    event.preventDefault()
    const rect = createSelectionRect(screenshotStartPoint, {
      x: event.clientX,
      y: event.clientY,
    })
    updateSelectionElement(rect)
  })

  pickerOverlay.addEventListener("mouseup", (event) => {
    if (event.button !== 0 || !screenshotStartPoint) {
      return
    }
    event.preventDefault()
    const rect = createSelectionRect(screenshotStartPoint, {
      x: event.clientX,
      y: event.clientY,
    })
    screenshotStartPoint = null

    if (rect.width < 8 || rect.height < 8) {
      disableScreenshotPicker({ reason: "cancelled" })
      return
    }

    void finalizeScreenshotSelection(rect)
  })

  screenshotEscapeListener = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      disableScreenshotPicker({ reason: "cancelled" })
    }
  }
  window.addEventListener("keydown", screenshotEscapeListener)

  document.body.appendChild(pickerOverlay)
  screenshotPickerActive = true
  screenshotOverlayElement = pickerOverlay
  screenshotSelectionElement = selection
  setOverlayInteractivity(false)
  return true
}

function removeIframePopup(): void {
  disableScreenshotPicker()

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

  if (!isRuntimeContextAvailable()) {
    cleanupInvalidatedContext()
    return
  }

  let popupUrl: string
  try {
    popupUrl = chrome.runtime.getURL("popup.html")
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      cleanupInvalidatedContext()
      return
    }

    throw error
  }

  const overlay = document.createElement("div")
  overlay.id = OVERLAY_ID
  overlay.style.cssText = `
    position: fixed !important;
    inset: 0 !important;
    background: rgba(15, 23, 42, 0.28) !important;
    z-index: 2147483646 !important;
  `
  overlay.addEventListener("click", removeIframePopup)

  const iframe = document.createElement("iframe")
  iframe.id = IFRAME_ID
  iframe.src = popupUrl
  iframe.title = "MyVibeProject Clipper"
  iframe.style.cssText = `
    position: fixed !important;
    top: ${POPUP_TOP_GAP_PX}px !important;
    right: 24px !important;
    width: 420px !important;
    height: calc(100vh - ${POPUP_VERTICAL_GAP_PX}px) !important;
    max-height: calc(100vh - ${POPUP_VERTICAL_GAP_PX}px) !important;
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

if (isRuntimeContextAvailable()) {
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
      const selectableCount = enableImagePicker()
      sendResponse({ success: selectableCount > 0, count: selectableCount })
      return false
    }

    if (request.action === ACTIONS.ENABLE_SCREENSHOT_PICKER) {
      const success = enableScreenshotPicker()
      sendResponse({
        success,
        error: success ? undefined : "Could not start screenshot picker on this page.",
      })
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
}
