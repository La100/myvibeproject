"use client";

import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  id?: string;
  name: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-1 text-sm text-muted-foreground", className)}>
      {items.map((item, index) => (
        <div key={item.id || index} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="mx-1 size-4 text-muted-foreground/60" />
          )}

          {item.onClick ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={item.onClick}
              className="h-8 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
            >
              {index === 0 && <Home data-icon="inline-start" />}
              {item.name}
            </Button>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 font-medium text-foreground">
              {index === 0 && <Home className="size-4 text-muted-foreground" />}
              {item.name}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
