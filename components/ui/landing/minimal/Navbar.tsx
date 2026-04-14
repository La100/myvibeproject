"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton, useUser } from "@clerk/nextjs";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Logo from "../Logo";

const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Resources", href: "/#resources" },
];

export function Navbar() {
  const { isSignedIn } = useUser();

  return (
    <header className="relative z-30">
      <div className="mx-auto flex h-24 w-full max-w-[1520px] items-center justify-between px-6 lg:px-10">
        <Logo
          className="size-12 sm:size-[3.5rem]"
          showWordmark
          wordmarkClassName="text-[1.4rem] sm:text-[1.72rem] [&>span:last-child]:hidden sm:[&>span:last-child]:inline sm:[&>span:last-child]:font-serif sm:[&>span:last-child]:italic sm:[&>span:last-child]:tracking-[-0.04em]"
        />

        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[15px] text-foreground/90 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {isSignedIn ? (
            <>
            <Button
              asChild
              variant="ghost"
              className="h-9 rounded-full px-3 text-sm font-medium"
            >
              <Link href="/organisation">Dashboard</Link>
            </Button>
            <UserButton
              appearance={{
                elements: { userButtonAvatarBox: "rounded-full" },
              }}
            />
            </>
          ) : (
            <Button
              asChild
              className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background text-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="top" className="border-none bg-background px-6 pb-8 pt-12">
              <SheetTitle className="sr-only">Main navigation</SheetTitle>
              <div className="mx-auto flex w-full max-w-md flex-col gap-6">
                <div className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.label}>
                      <Link
                        href={link.href}
                        className="rounded-2xl border border-border/60 px-5 py-4 text-base text-foreground"
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </div>

                {isSignedIn ? (
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
                ) : null}

                {!isSignedIn ? (
                  <div className="flex flex-col gap-3">
                    <SheetClose asChild>
                      <Button asChild className="h-11 rounded-full">
                        <Link href="/sign-in">Sign in</Link>
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
