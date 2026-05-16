/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/ui/brand/BrandWordmark";
import { cn } from "@/lib/utils";

type AppLoadingStateProps = {
  title?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  variant?: "screen" | "section" | "panel" | "inline";
  showBrand?: boolean;
  children?: ReactNode;
};

const variantClassNames: Record<NonNullable<AppLoadingStateProps["variant"]>, string> = {
  screen: "min-h-svh px-5",
  section: "min-h-[60vh] px-5",
  panel: "min-h-[220px] px-4",
  inline: "min-h-40 px-4",
};

export function AppLoadingState({
  title = "Loading",
  description,
  className,
  contentClassName,
  variant = "panel",
  showBrand = variant === "screen",
  children,
}: AppLoadingStateProps) {
  const hasText = Boolean(title || description);

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        variantClassNames[variant],
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex w-full max-w-sm flex-col items-center text-center",
          variant === "inline" ? "gap-3" : "gap-4",
          contentClassName,
        )}
      >
        {showBrand ? (
          <div className="flex items-center justify-center gap-3">
            <img
              src="/logo.svg"
              alt=""
              width={36}
              height={36}
              className="size-9 object-contain"
            />
            <BrandWordmark
              className="text-foreground"
              myvibeClassName="text-2xl"
              projectClassName="text-2xl"
            />
          </div>
        ) : null}
        <div className="relative flex size-9 items-center justify-center" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border border-foreground/10" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-foreground/80 border-r-foreground/30" />
          <div className="size-1.5 rounded-full bg-foreground/70" />
        </div>
        {hasText ? (
          <div className="flex flex-col gap-1.5">
            {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
            {description ? (
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
