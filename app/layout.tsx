import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import type { ClerkProviderProps } from "@clerk/clerk-react";
import type { CSSProperties } from "react";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Myvibe project",
  description: "Architektoniczny Project Manager",
  icons: {
    icon: "/convex.svg",
  },
};

const clerkAppearance: ClerkProviderProps["appearance"] = {
  layout: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  variables: {
    colorPrimary: "#171717",
    colorText: "#171717",
    colorInputText: "#171717",
    colorInputBackground: "#FAFAF8",
    colorBackground: "#FFFFFF",
    borderRadius: "1rem",
  },
  elements: {
    modalBackdrop: "backdrop-blur-sm bg-black/60",
    modal: "rounded-3xl shadow-[0_24px_80px_rgba(18,18,18,0.09)] border border-[#E4E2DB] bg-[#F7F6F2]",
    card: "rounded-3xl border border-[#E4E2DB] shadow-[0_20px_60px_rgba(18,18,18,0.05)] bg-[#FCFCFA]",
    headerTitle: "text-xl font-semibold text-[#171717]",
    headerSubtitle: "text-sm text-[#686662]",
    socialButtons: "gap-3",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-[#E4E2DB] bg-[#FFFFFF] text-[#171717] hover:bg-[#F7F6F2] shadow-none",
    socialButtonsBlockButtonText: "text-sm font-semibold",
    socialButtonsProviderIcon: "text-base",
    dividerText: "text-[#9E9A92] text-xs font-semibold uppercase tracking-[0.16em]",
    dividerLine: "bg-[#E9E7E1]",
    formFieldLabel: "text-xs font-semibold text-[#686662] uppercase tracking-[0.06em]",
    formFieldInput:
      "h-11 rounded-2xl border border-[#E4E2DB] bg-[#FFFFFF] text-[#171717] placeholder:text-[#9E9A92] focus:ring-2 focus:ring-[#171717]/20 focus:border-[#171717]",
    formFieldInputShowPasswordButton: "text-[#686662]",
    formButtonPrimary:
      "h-11 rounded-xl bg-[#171717] text-white text-sm font-semibold shadow-[0_12px_28px_rgba(18,18,18,0.12)] hover:bg-[#262626]",
    footerActionText: "text-[#6E6B65] text-sm",
    footerActionLink: "text-[#171717] font-semibold hover:underline",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" style={rootFontVariables}>
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
