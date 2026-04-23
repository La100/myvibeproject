"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectContentContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isTasksRoute = /^\/organisation\/projects\/[^/]+\/tasks(?:\/|$)/.test(pathname);
  const isProjectWorkspaceRoute =
    /^\/organisation\/projects\/[^/]+(?:\/|$)/.test(pathname);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6 px-5 pb-10 pt-5 md:px-7 md:pt-6 xl:px-10 xl:pt-4 2xl:px-12",
        isTasksRoute
          ? "max-w-none"
          : isProjectWorkspaceRoute
            ? "max-w-none"
            : "mx-auto max-w-[1080px]",
      )}
    >
      {children}
    </div>
  );
}
