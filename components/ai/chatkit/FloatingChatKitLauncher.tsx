"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareText, X } from "lucide-react";

import HostedChatKit from "@/components/ai/chatkit/HostedChatKit";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function FloatingChatKitLauncher() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { project } = useProject();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  if (!pathname || pathname === `/organisation/projects/${project.slug}/ai`) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-end sm:inset-x-auto sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2.5">
        {isOpen ? (
          <div className="w-[min(390px,calc(100vw-2rem))] origin-bottom-right translate-y-0 scale-100 opacity-100 transition-all duration-200 ease-out">
            <div className="h-[min(640px,calc(100vh-6rem))] overflow-hidden rounded-3xl border border-border/70 bg-white shadow-lg">
              <HostedChatKit mode="panel" />
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="h-12 rounded-full px-4 text-sm shadow-lg"
          aria-expanded={isOpen}
          aria-label={
            isOpen ? t("aiShell", "closeAssistant") : t("aiShell", "openAssistant")
          }
        >
          {isOpen ? (
            <X className="size-[18px]" />
          ) : (
            <MessageSquareText className="size-[18px]" />
          )}
          <span>
            {isOpen ? t("aiShell", "closeVibe") : t("aiShell", "askVibe")}
          </span>
        </Button>
      </div>
    </div>
  );
}
