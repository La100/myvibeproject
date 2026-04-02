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
        <div className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="mb-4 flex flex-col gap-4 sm:mb-0">
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="text-primary">
                            {icon}
                        </div>
                    )}
                    <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                        {title}
                    </h1>
                </div>
                {subtitle && (
                    <p className="text-muted-foreground">
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
