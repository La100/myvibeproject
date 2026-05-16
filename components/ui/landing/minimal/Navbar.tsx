"use client";

import Link from "next/link";
import { Languages, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton, useUser } from "@clerk/nextjs";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Logo from "../Logo";
import { useI18n } from "@/lib/i18n";

const navLinks = [
  { labelKey: "product", href: "/#product" },
  { labelKey: "workflow", href: "/#workflow" },
  { labelKey: "webClipper", href: "/#web-clipper" },
  { labelKey: "resources", href: "/#resources" },
  { labelKey: "pricing", href: "/#pricing" },
  { labelKey: "contact", href: "/contact" },
] as const;

const userButtonAppearance = {
  elements: {
    userButtonAvatarBox: "rounded-full",
    userButtonPopoverCard: "z-[80] pointer-events-auto",
    userButtonPopoverActionButton: "pointer-events-auto",
  },
} as const;

export function Navbar() {
  const { locale, setLocale, t } = useI18n();
  const { isSignedIn } = useUser();
  const toggleLocale = () => setLocale(locale === "pl" ? "en" : "pl");
  const languageButton = (
    <Button
      type="button"
      variant="outline"
      className="h-9 rounded-full px-3 text-sm font-medium"
      aria-label={t("landingNav", "switchLanguage")}
      onClick={toggleLocale}
    >
      <Languages className="mr-2 h-4 w-4" />
      {locale === "pl" ? "EN" : "PL"}
    </Button>
  );

  return (
    <header className="relative z-30">
      <div className="mx-auto flex h-24 w-full max-w-[1520px] items-center justify-between px-6 lg:px-10">
        <Logo
          className="size-11 sm:size-12"
          showWordmark
          wordmarkClassName="text-[1.25rem] sm:text-[1.5rem] [&>span:last-child]:hidden sm:[&>span:last-child]:inline sm:[&>span:last-child]:font-serif sm:[&>span:last-child]:italic sm:[&>span:last-child]:tracking-[-0.04em]"
        />

        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.labelKey}
              href={link.href}
              className="text-[15px] text-foreground/90 transition-colors hover:text-foreground"
            >
              {t("landingNav", link.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {languageButton}
          {isSignedIn ? (
            <>
              <Button
                asChild
                className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/92"
              >
                <Link href="/organisation">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("landingNav", "dashboard")}
                </Link>
              </Button>
              <UserButton
                appearance={userButtonAppearance}
              />
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="h-9 rounded-full px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Link href="/sign-in">{t("landingNav", "signIn")}</Link>
              </Button>
              <Button
                asChild
                className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
              >
                <Link href="/sign-up">{t("landingNav", "startFree")}</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {languageButton}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={t("landingNav", "openNavigation")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background text-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="top" className="border-none bg-background px-6 pb-8 pt-12">
              <SheetTitle className="sr-only">{t("landingNav", "mainNavigation")}</SheetTitle>
              <div className="mx-auto flex w-full max-w-md flex-col gap-6">
                <div className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.labelKey}>
                      <Link
                        href={link.href}
                        className="rounded-2xl border border-border/60 px-5 py-4 text-base text-foreground"
                      >
                        {t("landingNav", link.labelKey)}
                      </Link>
                    </SheetClose>
                  ))}
                </div>

                {isSignedIn ? (
                  <div className="relative flex items-center gap-3">
                    <SheetClose asChild>
                      <Button
                        asChild
                        className="relative z-0 h-11 flex-1 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/92"
                      >
                        <Link href="/organisation">
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t("landingNav", "dashboard")}
                        </Link>
                      </Button>
                    </SheetClose>
                    <div className="relative z-[70] flex shrink-0">
                      <UserButton appearance={userButtonAppearance} />
                    </div>
                  </div>
                ) : null}

                {!isSignedIn ? (
                  <div className="flex flex-col gap-3">
                    <SheetClose asChild>
                      <Button asChild className="h-11 rounded-full">
                        <Link href="/sign-up">{t("landingNav", "startFree")}</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild variant="outline" className="h-11 rounded-full">
                        <Link href="/sign-in">{t("landingNav", "signIn")}</Link>
                      </Button>
                    </SheetClose>
                  </div>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
