export const ACTIONS = {
  INITIATE_AUTH: "initiate-auth",
  PING: "ping",
  CAN_OPEN_CLIPPER: "canOpenClipper",
  DETECT_PRODUCT: "detectProduct",
  ENABLE_IMAGE_PICKER: "enableImagePicker",
  OPEN_IFRAME_POPUP: "openIframePopup",
  CLOSE_IFRAME_POPUP: "closeIframePopup",
  IMAGE_SELECTED: "imageSelected",
  AUTH_COMPLETED: "authCompleted",
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

export type RuntimeMessage =
  | BaseMessage
  | ImageSelectedMessage
  | DetectProductMessage
  | CanOpenClipperMessage
  | AuthInitiateMessage

export function isObjectMessage(value: unknown): value is RuntimeMessage {
  return typeof value === "object" && value !== null && "action" in value
}
