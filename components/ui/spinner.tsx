import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = React.ComponentProps<"div"> & {
  iconClassName?: string;
  fullHeight?: boolean;
};

export function Spinner({
  className,
  iconClassName,
  fullHeight = true,
  ...props
}: SpinnerProps) {
  return (
    <div
      data-slot="spinner"
      className={cn(
        "flex items-center justify-center",
        fullHeight ? "min-h-[220px]" : "py-6",
        className,
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Loader2 className={cn("h-8 w-8 animate-spin text-primary", iconClassName)} />
      <span className="sr-only">Loading</span>
    </div>
  );
}
