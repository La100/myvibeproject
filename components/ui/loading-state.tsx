import Image from "next/image";
import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/ui/brand/BrandWordmark";
import { Spinner } from "@/components/ui/spinner";
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
            <Image
              src="/logo.svg"
              alt=""
              width={36}
              height={36}
              className="size-9 object-contain"
              priority
            />
            <BrandWordmark
              className="text-foreground"
              myvibeClassName="text-2xl"
              projectClassName="text-2xl"
            />
          </div>
        ) : null}
        <Spinner fullHeight={false} className="py-0" iconClassName="size-5" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
