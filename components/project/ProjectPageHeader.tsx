import { ReactNode } from "react";

interface ProjectPageHeaderProps {
    title: string;
    icon?: ReactNode;
    subtitle?: ReactNode;
    tags?: ReactNode;
    actions?: ReactNode;
}

export function ProjectPageHeader({
    title,
    icon,
    subtitle,
    tags,
    actions,
}: ProjectPageHeaderProps) {
    return (
        <div className="mb-8 flex flex-col items-start justify-between gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center gap-2.5">
                    {icon && (
                        <div className="flex size-10 items-center justify-center rounded-2xl border border-border/70 bg-secondary/70 text-accent shadow-sm [&>svg]:h-5 [&>svg]:w-5">
                            {icon}
                        </div>
                    )}
                    <h1 className="font-serif text-[2rem] font-medium leading-none tracking-[-0.04em] text-foreground sm:text-[2.6rem]">
                        {title}
                    </h1>
                </div>
                {subtitle && (
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        {subtitle}
                    </p>
                )}
                {tags && (
                    <div className="flex flex-wrap items-center gap-3">
                        {tags}
                    </div>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap gap-3 sm:justify-end">
                    {actions}
                </div>
            )}
        </div>
    );
}
