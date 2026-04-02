import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import type { ClerkProviderProps } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Myvibe project",
  description: "Architektoniczny Project Manager",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

const clerkAppearance: ClerkProviderProps["appearance"] = {
  layout: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  variables: {
    colorPrimary: "var(--primary)",
    colorText: "var(--foreground)",
    colorInputText: "var(--foreground)",
    colorInputBackground: "var(--background)",
    colorBackground: "var(--background)",
    borderRadius: "var(--radius)",
  },
  elements: {
    modalBackdrop: "backdrop-blur-sm bg-black/60",
    modal: "rounded-3xl border border-border bg-background shadow-xl backdrop-blur-xl",
    card: "rounded-2xl border border-border bg-card shadow-lg",
    headerTitle: "text-xl font-medium text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtons: "gap-3",
    socialButtonsBlockButton: "h-11 rounded-full border border-border bg-background text-foreground hover:bg-muted shadow-none",
    socialButtonsBlockButtonText: "text-sm font-medium",
    socialButtonsProviderIcon: "text-base",
    dividerText: "text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground",
    dividerLine: "bg-border",
    formFieldLabel: "text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
    formFieldInput:
      "h-11 rounded-full border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20",
    formFieldInputShowPasswordButton: "text-muted-foreground",
    formButtonPrimary:
      "h-11 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90",
    footerActionText: "text-sm text-muted-foreground",
    footerActionLink: "font-medium text-foreground hover:underline",
    footer: "pt-2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", geist.variable, geistMono.variable, newsreader.variable)}
    >
      <body className="antialiased">
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInForceRedirectUrl="/dashboard"
          signUpForceRedirectUrl="/dashboard"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
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
