import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  className?: string;
  myvibeClassName?: string;
  projectClassName?: string;
  projectLabel?: string;
};

export function BrandWordmark({
  className,
  myvibeClassName,
  projectClassName,
  projectLabel = "Project",
}: BrandWordmarkProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-x-3 whitespace-nowrap", className)}>
      <span
        className={cn(
          "font-serif italic leading-[0.9] tracking-[-0.04em]",
          myvibeClassName,
        )}
      >
        Myvibe
      </span>
      <span
        className={cn(
          "font-sans font-normal leading-[0.9] tracking-[-0.03em]",
          projectClassName,
        )}
      >
        {projectLabel}
      </span>
    </span>
  );
}
