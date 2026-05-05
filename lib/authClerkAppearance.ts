export const authClerkAppearance = {
  elements: {
    rootBox:
      "mx-auto w-full max-w-[440px] overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-xl backdrop-blur-xl",
    cardBox: "mx-auto w-full max-w-[440px]",
    card: "rounded-none border-0 bg-transparent px-6 py-6 shadow-none sm:px-8 sm:py-8",
    headerTitle: "text-2xl font-semibold tracking-tight text-foreground",
    headerSubtitle: "mt-2 text-sm leading-6 text-muted-foreground",
    socialButtons: "flex items-center justify-center gap-4",
    socialButtonsBlockButton:
      "size-14 min-h-14 min-w-14 rounded-full border border-border bg-background px-0 text-foreground shadow-none transition-colors hover:bg-muted",
    socialButtonsBlockButtonText: "sr-only",
    socialButtonsProviderIcon: "size-6",
    dividerRow: "my-6",
    dividerText: "text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground",
    dividerLine: "bg-border/70",
    formFieldLabel: "mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground",
    formFieldInput:
      "h-12 rounded-full border border-border bg-background text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20",
    formButtonPrimary:
      "mt-2 h-12 rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90",
    footer: "border-t border-border/60 px-6 py-5 sm:px-8",
    footerAction: "justify-center",
    footerActionText: "text-sm text-muted-foreground",
    footerActionLink: "font-semibold text-foreground hover:underline",
    badge:
      "mx-auto mb-5 inline-flex rounded-full border border-accent bg-accent px-3 py-1 text-xs font-medium text-accent-foreground shadow-none",
  },
} as const;
