import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import type { ClerkProviderProps } from "@clerk/clerk-react";
import type { CSSProperties } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getUiVibeCssVariables, resolveUiVibeId } from "@/lib/ui-system";

export const metadata: Metadata = {
  title: "Myvibe project",
  description: "Architektoniczny Project Manager",
  icons: {
    icon: "/convex.svg",
  },
};

const activeUiVibe = resolveUiVibeId(process.env.NEXT_PUBLIC_UI_VIBE);
const uiVibeVariables = getUiVibeCssVariables(activeUiVibe);

const clerkAppearance: ClerkProviderProps["appearance"] = {
  layout: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  variables: {
    colorPrimary: "var(--ui-clerk-primary)",
    colorText: "var(--ui-clerk-text)",
    colorInputText: "var(--ui-clerk-text)",
    colorInputBackground: "var(--ui-clerk-input-bg)",
    colorBackground: "var(--ui-clerk-card-bg)",
    borderRadius: "var(--radius)",
  },
  elements: {
    modalBackdrop: "backdrop-blur-sm bg-black/60",
    modal:
      "rounded-3xl shadow-[0_24px_80px_rgba(18,18,18,0.09)] border border-[var(--ui-clerk-border)] bg-[var(--ui-clerk-modal-bg)]",
    card:
      "rounded-3xl border border-[var(--ui-clerk-border)] shadow-[0_20px_60px_rgba(18,18,18,0.05)] bg-[var(--ui-clerk-card-bg)]",
    headerTitle: "text-xl font-semibold text-[var(--ui-clerk-text)]",
    headerSubtitle: "text-sm text-[var(--ui-clerk-text-muted)]",
    socialButtons: "gap-3",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-[var(--ui-clerk-border)] bg-[var(--ui-surface-base)] text-[var(--ui-clerk-text)] hover:bg-[var(--ui-surface-soft)] shadow-none",
    socialButtonsBlockButtonText: "text-sm font-semibold",
    socialButtonsProviderIcon: "text-base",
    dividerText: "text-[var(--ui-text-subtle)] text-xs font-semibold uppercase tracking-[0.16em]",
    dividerLine: "bg-[var(--ui-clerk-divider)]",
    formFieldLabel: "text-xs font-semibold text-[var(--ui-clerk-text-muted)] uppercase tracking-[0.06em]",
    formFieldInput:
      "h-11 rounded-2xl border border-[var(--ui-clerk-border)] bg-[var(--ui-surface-base)] text-[var(--ui-clerk-text)] placeholder:text-[var(--ui-text-subtle)] focus:ring-2 focus:ring-primary/20 focus:border-primary",
    formFieldInputShowPasswordButton: "text-[var(--ui-clerk-text-muted)]",
    formButtonPrimary:
      "h-11 rounded-xl bg-[var(--ui-clerk-primary)] text-[var(--primary-foreground)] text-sm font-semibold shadow-[0_12px_28px_rgba(18,18,18,0.12)] hover:bg-[var(--ui-clerk-primary-hover)]",
    footerActionText: "text-[var(--ui-clerk-text-muted)] text-sm",
    footerActionLink: "text-[var(--ui-clerk-text)] font-semibold hover:underline",
    footer: "pt-2",
  },
};

const rootFontVariables = {
  "--font-sans":
    '"Manrope", "Avenir Next", "Segoe UI", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  "--font-mono":
    '"JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  "--font-serif": '"Newsreader", Georgia, "Times New Roman", serif',
} as CSSProperties;

const rootThemeVariables = {
  ...rootFontVariables,
  ...uiVibeVariables,
} as CSSProperties;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-ui-vibe={activeUiVibe}>
      <body className="antialiased" style={rootThemeVariables}>
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInForceRedirectUrl="/onboarding"
          signUpForceRedirectUrl="/onboarding"
          signInFallbackRedirectUrl="/onboarding"
          signUpFallbackRedirectUrl="/onboarding"
          taskUrls={{
            "choose-organization": "/onboarding",
          }}
        >
          <ConvexClientProvider>
            {children}
            <Toaster />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
