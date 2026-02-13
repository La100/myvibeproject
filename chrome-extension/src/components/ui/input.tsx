import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground/90 selection:bg-primary selection:text-primary-foreground border-input/90 flex h-10 w-full min-w-0 rounded-xl border bg-card px-3.5 py-2 text-base shadow-[0_6px_14px_-12px_rgba(22,22,22,0.45)] transition-[color,box-shadow,border-color,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring/80 focus-visible:ring-ring/20 focus-visible:ring-[3px]",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
