import { forwardRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const MoodboardImageGrid = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
  }
>(function MoodboardImageGrid({ children, className }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "min-h-28 columns-1 gap-6 [column-fill:_balance] sm:columns-2 lg:columns-3 2xl:columns-4",
        className,
      )}
    >
      {children}
    </div>
  );
});

export function MoodboardImageGridItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 break-inside-avoid", className)}>{children}</div>
  );
}
