import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center animate-fadeIn",
      className
    )}>
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-6 animate-scaleIn">
          <Icon className="size-12 text-muted-foreground" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6 text-sm">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex gap-3 flex-wrap justify-center">
          {action && (
            <Button onClick={action.onClick} size="lg" className="gap-2">
              {action.icon && <action.icon className="size-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline" size="lg">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
