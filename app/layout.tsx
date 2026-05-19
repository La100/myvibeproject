import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense, type ComponentProps, type CSSProperties } from "react";
import { Toaster } from "@/components/ui/sonner";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import AnalyticsProvider from "@/components/providers/AnalyticsProvider";
import { I18nProvider } from "@/lib/i18n";
import { getLocaleFromAcceptLanguage, type Locale } from "@/lib/i18nConfig";
import { cookies, headers } from "next/headers";
import {
  signInFallbackRedirectUrl,
  signInUrl,
  signUpFallbackRedirectUrl,
  signUpUrl,
} from "@/lib/authRedirects";

const appSans = localFont({
  src: [
    { path: "../public/fonts/Arial.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Arial-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-sans",
});

const brandFontVariables = {
  "--font-mono":
    '"SFMono-Regular", "JetBrains Mono", "Fira Code", "Menlo", "Monaco", monospace',
  "--font-serif": '"Canela", "Noe Display", "Georgia", "Times New Roman", serif',
  "--font-display-serif": '"Canela", "Noe Display", "Georgia", "Times New Roman", serif',
  "--font-sidebar": 'var(--font-serif)',
} as CSSProperties;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://myvibeproject.com";
const socialPreviewImage = "/landing/visualization-1776944094220.png";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Myvibe project",
  description: "Architectural Project Manager",
  openGraph: {
    title: "Myvibe project",
    description: "Architectural Project Manager",
    url: "/",
    siteName: "Myvibe project",
    images: [
      {
        url: socialPreviewImage,
        width: 1024,
        height: 1024,
        alt: "Myvibe project",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Myvibe project",
    description: "Architectural Project Manager",
    images: [socialPreviewImage],
  },
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    shortcut: "/logo.svg",
    apple: "/logo.png",
  },
};

const clerkAppearance: ComponentProps<typeof ClerkProvider>["appearance"] = {
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

const clerkLocalizations = {
  en: {
    dividerText: "or",
    formButtonPrimary: "Continue",
    formFieldHintText__optional: "Optional",
    formFieldLabel__emailAddress: "Email address",
    formFieldLabel__firstName: "First name",
    formFieldLabel__lastName: "Last name",
    formFieldLabel__organizationName: "Organization name",
    formFieldLabel__password: "Password",
    formFieldInputPlaceholder__emailAddress: "Enter your email address",
    formFieldInputPlaceholder__firstName: "First name",
    formFieldInputPlaceholder__lastName: "Last name",
    formFieldInputPlaceholder__organizationName: "My Organization",
    formFieldInputPlaceholder__password: "Enter your password",
    backButton: "Back",
    signInEnterPasswordTitle: "Enter your password",
    footerActionLink__useAnotherMethod: "Use another method",
    signIn: {
      start: {
        title: "Sign in",
        titleCombined: "Sign in",
        subtitle: "Welcome back! Please sign in to continue.",
        subtitleCombined: "Welcome back! Please sign in to continue.",
        actionText: "Don't have an account?",
        actionLink: "Sign up",
        actionLink__use_email: "Use email",
        actionLink__use_phone: "Use phone",
        actionLink__use_username: "Use username",
        actionLink__use_email_username: "Use email or username",
        actionLink__use_passkey: "Use passkey",
        actionText__join_waitlist: "Want access?",
        actionLink__join_waitlist: "Join waitlist",
      },
      password: {
        title: "Enter your password",
        subtitle: "Enter the password associated with your account",
        actionLink: "Forgot password?",
      },
      forgotPassword: {
        title: "Reset your password",
        subtitle: "Enter your email address to reset your password",
        subtitle_email: "Enter your email address to reset your password",
        subtitle_phone: "Enter your phone number to reset your password",
        formTitle: "Reset password",
        resendButton: "Resend code",
      },
      resetPassword: {
        title: "Set a new password",
        formButtonPrimary: "Reset password",
        successMessage: "Your password has been reset successfully.",
        requiredMessage: "Password is required.",
      },
      emailCode: {
        title: "Check your email",
        subtitle: "Enter the verification code sent to your email",
        formTitle: "Verification code",
        resendButton: "Resend code",
      },
    },
    signUp: {
      start: {
        title: "Create your account",
        titleCombined: "Create your account",
        subtitle: "Welcome! Please fill in the details to get started.",
        subtitleCombined: "Welcome! Please fill in the details to get started.",
        actionText: "Already have an account?",
        actionLink: "Sign in",
      },
    },
    taskChooseOrganization: {
      title: "Setup your organization",
      subtitle: "Enter your organization details to continue",
      signOut: {
        actionText: "Signed in as {{identifier}}",
        actionLink: "Sign out",
      },
      createOrganization: {
        title: "Setup your organization",
        subtitle: "Enter your organization details to continue",
        formButtonSubmit: "Continue",
        formButtonReset: "Reset",
        formFieldLabel__name: "Name",
        formFieldLabel__slug: "Slug",
        formFieldInputPlaceholder__name: "My Organization",
        formFieldInputPlaceholder__slug: "my-organization",
      },
      chooseOrganization: {
        title: "Choose your organization",
        subtitle: "Select an organization to continue",
        subtitle__createOrganizationDisabled: "Select an organization to continue",
        suggestionsAcceptedLabel: "Accepted",
        action__suggestionsAccept: "Accept",
        action__createOrganization: "Create organization",
        action__invitationAccept: "Accept invitation",
      },
      organizationCreationDisabled: {
        title: "Organization setup unavailable",
        subtitle: "Choose an existing organization to continue.",
      },
      alerts: {
        organizationAlreadyExists: "An organization named {{organizationName}} already exists.",
      },
    },
  },
  pl: {
    dividerText: "lub",
    formButtonPrimary: "Kontynuuj",
    formFieldHintText__optional: "Opcjonalne",
    formFieldLabel__emailAddress: "Adres email",
    formFieldLabel__firstName: "Imię",
    formFieldLabel__lastName: "Nazwisko",
    formFieldLabel__organizationName: "Nazwa organizacji",
    formFieldLabel__password: "Hasło",
    formFieldInputPlaceholder__emailAddress: "Wpisz adres email",
    formFieldInputPlaceholder__firstName: "Imię",
    formFieldInputPlaceholder__lastName: "Nazwisko",
    formFieldInputPlaceholder__organizationName: "Moja organizacja",
    formFieldInputPlaceholder__password: "Wpisz hasło",
    backButton: "Wróć",
    signInEnterPasswordTitle: "Wpisz hasło",
    footerActionLink__useAnotherMethod: "Użyj innej metody",
    signIn: {
      start: {
        title: "Zaloguj się",
        titleCombined: "Zaloguj się",
        subtitle: "Witaj ponownie! Zaloguj się, aby kontynuować.",
        subtitleCombined: "Witaj ponownie! Zaloguj się, aby kontynuować.",
        actionText: "Nie masz konta?",
        actionLink: "Utwórz konto",
        actionLink__use_email: "Użyj emaila",
        actionLink__use_phone: "Użyj telefonu",
        actionLink__use_username: "Użyj nazwy użytkownika",
        actionLink__use_email_username: "Użyj emaila lub nazwy użytkownika",
        actionLink__use_passkey: "Użyj passkey",
        actionText__join_waitlist: "Chcesz uzyskać dostęp?",
        actionLink__join_waitlist: "Dołącz do listy oczekujących",
      },
      password: {
        title: "Wpisz hasło",
        subtitle: "Wpisz hasło powiązane z kontem",
        actionLink: "Nie pamiętasz hasła?",
      },
      forgotPassword: {
        title: "Zresetuj hasło",
        subtitle: "Wpisz adres email, aby zresetować hasło",
        subtitle_email: "Wpisz adres email, aby zresetować hasło",
        subtitle_phone: "Wpisz numer telefonu, aby zresetować hasło",
        formTitle: "Reset hasła",
        resendButton: "Wyślij kod ponownie",
      },
      resetPassword: {
        title: "Ustaw nowe hasło",
        formButtonPrimary: "Zresetuj hasło",
        successMessage: "Hasło zostało zresetowane.",
        requiredMessage: "Hasło jest wymagane.",
      },
      emailCode: {
        title: "Sprawdź email",
        subtitle: "Wpisz kod weryfikacyjny wysłany na email",
        formTitle: "Kod weryfikacyjny",
        resendButton: "Wyślij kod ponownie",
      },
    },
    signUp: {
      start: {
        title: "Utwórz konto",
        titleCombined: "Utwórz konto",
        subtitle: "Witaj! Uzupełnij dane, aby rozpocząć.",
        subtitleCombined: "Witaj! Uzupełnij dane, aby rozpocząć.",
        actionText: "Masz już konto?",
        actionLink: "Zaloguj się",
      },
    },
    taskChooseOrganization: {
      title: "Skonfiguruj organizację",
      subtitle: "Wpisz dane organizacji, aby kontynuować",
      signOut: {
        actionText: "Zalogowano jako {{identifier}}",
        actionLink: "Wyloguj się",
      },
      createOrganization: {
        title: "Skonfiguruj organizację",
        subtitle: "Wpisz dane organizacji, aby kontynuować",
        formButtonSubmit: "Kontynuuj",
        formButtonReset: "Resetuj",
        formFieldLabel__name: "Nazwa",
        formFieldLabel__slug: "Slug",
        formFieldInputPlaceholder__name: "Moja organizacja",
        formFieldInputPlaceholder__slug: "moja-organizacja",
      },
      chooseOrganization: {
        title: "Wybierz organizację",
        subtitle: "Wybierz organizację, aby kontynuować",
        subtitle__createOrganizationDisabled: "Wybierz organizację, aby kontynuować",
        suggestionsAcceptedLabel: "Zaakceptowano",
        action__suggestionsAccept: "Akceptuj",
        action__createOrganization: "Utwórz organizację",
        action__invitationAccept: "Przyjmij zaproszenie",
      },
      organizationCreationDisabled: {
        title: "Konfiguracja organizacji niedostępna",
        subtitle: "Wybierz istniejącą organizację, aby kontynuować.",
      },
      alerts: {
        organizationAlreadyExists: "Organizacja {{organizationName}} już istnieje.",
      },
    },
  },
} satisfies Record<Locale, ComponentProps<typeof ClerkProvider>["localization"]>;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get("myvibe.locale")?.value;
  const initialLocale: Locale =
    cookieLocale === "en" || cookieLocale === "pl"
      ? cookieLocale
      : getLocaleFromAcceptLanguage(headerStore.get("accept-language"));

  return (
    <html
      lang={initialLocale}
      className={cn("font-sans", appSans.variable)}
      style={brandFontVariables}
    >
      <body className="antialiased">
        <ClerkProvider
          appearance={clerkAppearance}
          localization={clerkLocalizations[initialLocale]}
          signInUrl={signInUrl}
          signUpUrl={signUpUrl}
          signInFallbackRedirectUrl={signInFallbackRedirectUrl}
          signUpFallbackRedirectUrl={signUpFallbackRedirectUrl}
          taskUrls={{ "choose-organization": "/session-tasks/choose-organization" }}
        >
          <I18nProvider initialLocale={initialLocale}>
            <ConvexClientProvider>
              <Suspense fallback={null}>
                <AnalyticsProvider />
              </Suspense>
              {children}
              <Toaster />
            </ConvexClientProvider>
          </I18nProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
