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
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                    {icon && (
                        <div className="text-primary [&>svg]:h-6 [&>svg]:w-6">
                            {icon}
                        </div>
                    )}
                    <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        {title}
                    </h1>
                </div>
                {subtitle && (
                    <p className="text-sm text-muted-foreground">
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
                <div className="flex flex-wrap gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
}
