/**
 * AI Assistant Theme Configuration
 *
 * Colors, styles, and visual constants for the AI Assistant UI.
 */

// ==================== ACTION COLORS ====================

export const ACTION_COLORS = {
  confirm: "bg-green-600 hover:bg-green-700 text-white",
  confirmSecondary: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  reject: "bg-red-600 hover:bg-red-700 text-white",
  rejectSecondary: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  edit: "bg-blue-600 hover:bg-blue-700 text-white",
  editSecondary: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  primary: "bg-primary/10 text-primary hover:bg-primary/20",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
} as const;

// ==================== STATUS COLORS ====================

export const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  warning: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
} as const;

// ==================== ITEM TYPE COLORS ====================

export const ITEM_TYPE_COLORS = {
  task: "bg-card border-border/50 shadow-sm",
  note: "bg-card border-border/50 shadow-sm",
  shopping: "bg-card border-border/50 shadow-sm",
  survey: "bg-card border-border/50 shadow-sm",
  contact: "bg-card border-border/50 shadow-sm",
  shoppingSection: "bg-card border-border/50 shadow-sm",
  labor: "bg-card border-border/50 shadow-sm",
  laborSection: "bg-card border-border/50 shadow-sm",
} as const;

// ==================== OPERATION LABELS & COLORS ====================

export const OPERATION_CONFIG = {
  create: {
    label: "Create",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  bulk_create: {
    label: "Create",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  edit: {
    label: "Edit",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  bulk_edit: {
    label: "Edit",
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  delete: {
    label: "Delete",
    color: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  },
} as const;

// ==================== MESSAGE COLORS ====================

export const MESSAGE_COLORS = {
  user: {
    background: "var(--primary)",
    text: "text-primary-foreground",
  },
  assistant: {
    background: "bg-transparent",
    text: "text-foreground",
  },
} as const;

// ==================== SPACING & SIZING ====================

export const SPACING = {
  messageGap: "gap-4 md:gap-6",
  sidebarWidth: "w-80",
  mobileHeaderHeight: "h-12",
  desktopToolbarHeight: "h-14",
  inputAreaPadding: "px-4 pb-4 pt-3",
} as const;

export const SIZING = {
  maxContentWidth: "max-w-4xl",
  iconSmall: "h-4 w-4",
  iconMedium: "h-5 w-5",
  iconLarge: "h-6 w-6",
  avatarSize: "size-8",
} as const;

// ==================== ANIMATIONS ====================

export const ANIMATIONS = {
  fadeIn: "fade-in animate-in duration-200",
  slideIn: "slide-in-from-bottom-2 animate-in duration-200",
  spin: "animate-spin",
  pulse: "animate-pulse",
} as const;

// ==================== BORDERS & SHADOWS ====================

export const BORDERS = {
  default: "border border-border/60",
  subtle: "border border-border/50",
  card: "border border-border/50 shadow-sm",
  strong: "border-2 border-border",
} as const;

export const SHADOWS = {
  card: "shadow-sm",
  medium: "shadow-md",
  large: "shadow-lg",
  xl: "shadow-xl",
  inner: "shadow-inner",
} as const;

// ==================== ROUNDED CORNERS ====================

export const ROUNDED = {
  small: "rounded-md",
  medium: "rounded-lg",
  large: "rounded-xl",
  full: "rounded-full",
  message: "rounded-2xl",
} as const;

// ==================== BACKDROP & OVERLAYS ====================

export const BACKDROP = {
  light: "bg-background/50 backdrop-blur-sm",
  medium: "bg-background/80 backdrop-blur-md",
  heavy: "bg-background/95 backdrop-blur-xl",
} as const;
