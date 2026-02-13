"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Logo from "../Logo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-50 transition-all duration-300", scrolled ? "px-4 py-2 sm:px-8" : "")}>
      <div
        className={cn(
          "mx-auto flex h-14 items-center justify-between px-6 transition-all duration-300",
          scrolled
            ? "max-w-5xl rounded-full border border-border/50 bg-background/85 backdrop-blur-xl shadow-lg shadow-black/[0.06]"
            : "max-w-[1440px] bg-background/80 backdrop-blur-md sm:px-10"
        )}
      >
        <Logo />

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <SignedIn>
            <Button
              variant="ghost"
              asChild
              className="text-sm font-medium text-foreground hover:text-foreground"
            >
              <Link href="/organisation">Dashboard</Link>
            </Button>
            <UserButton
              appearance={{
                elements: { userButtonAvatarBox: "rounded-full" },
              }}
            />
          </SignedIn>
          <SignedOut>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border text-sm font-medium px-5 h-9"
            >
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-5 h-9 text-sm font-medium"
            >
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </SignedOut>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <SignedIn>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-full px-3 text-sm font-medium"
            >
              <Link href="/organisation">Dashboard</Link>
            </Button>
          </SignedIn>
          <SignedOut>
            <Button asChild size="sm" className="rounded-full px-4 text-sm font-medium">
              <Link href="/sign-up">Start free</Link>
            </Button>
          </SignedOut>

          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/85 text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-card"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="top" className="border-none bg-background px-6 pt-12 pb-8">
              <SheetTitle className="sr-only">Main navigation</SheetTitle>
              <div className="mx-auto flex w-full max-w-md flex-col gap-6">
                <div className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.label}>
                      <Link
                        href={link.href}
                        className="rounded-2xl border border-border/50 bg-card/70 px-5 py-4 text-base font-medium text-foreground transition-colors hover:bg-card"
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </div>

                <SignedIn>
                  <div className="flex items-center gap-3">
                    <SheetClose asChild>
                      <Button asChild className="h-11 flex-1 rounded-full">
                        <Link href="/organisation">Go to dashboard</Link>
                      </Button>
                    </SheetClose>
                    <UserButton
                      appearance={{
                        elements: { userButtonAvatarBox: "rounded-full" },
                      }}
                    />
                  </div>
                </SignedIn>

                <SignedOut>
                  <div className="flex flex-col gap-3">
                    <SheetClose asChild>
                      <Button asChild className="h-11 rounded-full">
                        <Link href="/sign-up">Get Started</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild variant="outline" className="h-11 rounded-full">
                        <Link href="/sign-in">Log in</Link>
                      </Button>
                    </SheetClose>
                  </div>
                </SignedOut>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
