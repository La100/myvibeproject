"use client";

import { useProject } from "@/components/providers/ProjectProvider";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function MobileProjectHeader() {
  const { project } = useProject();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-[rgba(253,251,247,0.92)] px-4 backdrop-blur-md xl:hidden">
      <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
      <span className="truncate font-serif text-lg font-medium tracking-[-0.03em] text-foreground">
        {project.name}
      </span>
    </header>
  );
}
