export const ACTIONS = {
  INITIATE_AUTH: "initiate-auth",
  PING: "ping",
  CAN_OPEN_CLIPPER: "canOpenClipper",
  DETECT_PRODUCT: "detectProduct",
  ENABLE_IMAGE_PICKER: "enableImagePicker",
  ENABLE_SCREENSHOT_PICKER: "enableScreenshotPicker",
  OPEN_IFRAME_POPUP: "openIframePopup",
  CLOSE_IFRAME_POPUP: "closeIframePopup",
  CAPTURE_VISIBLE_TAB: "captureVisibleTab",
  IMAGE_SELECTED: "imageSelected",
  AUTH_COMPLETED: "authCompleted",
  PICKER_STATUS_CHANGED: "pickerStatusChanged",
} as const

export type ExtensionAction = (typeof ACTIONS)[keyof typeof ACTIONS]

export interface BaseMessage {
  action: ExtensionAction
}

export interface ImageSelectedMessage extends BaseMessage {
  action: typeof ACTIONS.IMAGE_SELECTED
  imageUrl: string
}

export interface DetectProductMessage extends BaseMessage {
  action: typeof ACTIONS.DETECT_PRODUCT
}

export interface CanOpenClipperMessage extends BaseMessage {
  action: typeof ACTIONS.CAN_OPEN_CLIPPER
}

export interface AuthInitiateMessage extends BaseMessage {
  action: typeof ACTIONS.INITIATE_AUTH
}

export interface PickerStatusChangedMessage extends BaseMessage {
  action: typeof ACTIONS.PICKER_STATUS_CHANGED
  picker: "image" | "screenshot"
  active: boolean
  reason?: "selected" | "cancelled" | "error" | "idle"
}

export type RuntimeMessage =
  | BaseMessage
  | ImageSelectedMessage
  | DetectProductMessage
  | CanOpenClipperMessage
  | AuthInitiateMessage
  | PickerStatusChangedMessage

export function isObjectMessage(value: unknown): value is RuntimeMessage {
  return typeof value === "object" && value !== null && "action" in value
}
