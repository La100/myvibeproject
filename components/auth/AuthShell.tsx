import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/ui/brand/BrandWordmark";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type AuthShellProps = {
  primaryActionLabel: string;
  primaryAction: () => Promise<void> | void;
  secondaryActionLabel: string;
  secondaryAction: () => Promise<void> | void;
  termsVerb: "in" | "up";
};

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthShell({
  primaryActionLabel,
  primaryAction,
  secondaryActionLabel,
  secondaryAction,
  termsVerb,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
      <section className="border-b border-border/60 bg-muted/20 lg:border-b-0 lg:border-r lg:min-h-screen">
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

      <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:min-h-screen lg:px-12">
        <div className="flex w-full max-w-[360px] flex-col items-center">
          <Link href="/" className="mb-3 inline-flex">
            <Image
              src="/logo.svg"
              alt="Myvibe project"
              width={1024}
              height={1024}
              className="size-16"
            />
          </Link>
          <p className="mb-10 max-w-[340px] text-center text-lg leading-relaxed text-foreground">
            Intelligent platform to manage projects for interior designers and architects.
          </p>

          <Button
            onClick={primaryAction}
            className="mb-6 h-12 w-full gap-3 rounded-full"
          >
            <GoogleIcon />
            {primaryActionLabel}
          </Button>

          <div className="mb-6 flex w-full items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-[0.28em] text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            onClick={secondaryAction}
            className="mb-8 h-12 w-full rounded-full"
          >
            {secondaryActionLabel}
          </Button>

          <div id="clerk-captcha" className="mb-8 w-full" />

          <p className="mb-16 text-center text-xs leading-5 text-foreground">
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

          <p className="text-sm text-muted-foreground">
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
