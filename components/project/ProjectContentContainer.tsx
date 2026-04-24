"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectContentContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWideProjectRoute =
    /^\/organisation\/projects\/[^/]+(?:\/)?$/.test(pathname) ||
    /^\/organisation\/projects\/[^/]+\/(?:tasks|shopping-list|labor|calendar)(?:\/|$)/.test(pathname);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6 px-5 pb-10 pt-8 md:px-7 md:pt-10 xl:px-10 xl:pt-12 2xl:px-12",
        isWideProjectRoute ? "max-w-none" : "mx-auto max-w-[1080px]",
      )}
    >
      {children}
    </div>
  );
}
