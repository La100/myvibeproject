"use client";

import { useProject } from "@/components/providers/ProjectProvider";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function MobileProjectHeader() {
  const { project } = useProject();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md xl:hidden">
      <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
      <span className="truncate text-lg font-medium text-foreground">
        {project.name}
      </span>
    </header>
  );
}
