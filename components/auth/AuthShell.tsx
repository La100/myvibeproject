import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/ui/brand/BrandWordmark";
import { Card } from "@/components/ui/card";

type AuthShellProps = {
  children: ReactNode;
  termsVerb: "in" | "up";
};

export function AuthShell({
  children,
  termsVerb,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,111,89,0.16),transparent_34%),linear-gradient(180deg,rgba(250,248,244,0.98)_0%,rgba(246,242,236,0.94)_100%)] lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <section className="hidden border-b border-border/60 bg-muted/20 lg:block lg:border-b-0 lg:border-r lg:min-h-screen">
        <div className="p-4 sm:p-6 lg:h-full lg:p-8">
          <Card className="relative min-h-[320px] overflow-hidden p-0 sm:min-h-[420px] lg:min-h-[calc(100vh-4rem)]">
            <Image
              src="/visualization-1773318760233.png"
              alt="Myvibe project background"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1023px) 100vw, 60vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-white/10" />
            <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8 lg:p-10">
              <h1 className="text-center text-white [text-shadow:0_10px_32px_rgba(0,0,0,0.2)]">
                <BrandWordmark
                  className="flex flex-wrap items-baseline justify-center gap-x-3 whitespace-nowrap"
                  myvibeClassName="text-5xl sm:text-6xl lg:text-7xl xl:text-[7.5rem]"
                  projectClassName="text-5xl sm:text-6xl lg:text-7xl xl:text-[7.5rem]"
                />
              </h1>
            </div>
          </Card>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:min-h-screen lg:px-12">
        <div className="flex w-full max-w-[440px] flex-col items-center">
          <Link href="/" className="mb-6 inline-flex">
            <Image
              src="/logo.svg"
              alt="Myvibe project"
              width={1024}
              height={1024}
              className="size-14"
            />
          </Link>

          <div className="w-full">{children}</div>
          <div id="clerk-captcha" className="sr-only" aria-hidden="true" />

          <p className="mt-6 max-w-[34ch] text-center text-xs leading-5 text-foreground/90">
            By signing {termsVerb} you agree to our{" "}
            <Link href="/privacy" className="font-semibold hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-semibold hover:text-foreground">
              Terms of Service
            </Link>
            .
          </p>

          <p className="mt-10 text-sm text-muted-foreground">
            by{" "}
            <Link href="/" className="whitespace-nowrap text-foreground transition-opacity duration-200 hover:opacity-90">
              <BrandWordmark className="gap-x-1.5" />
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
