import { ReactNode } from "react";

interface ProjectPageHeaderProps {
    title: string;
    icon?: ReactNode;
    tags?: ReactNode;
    actions?: ReactNode;
}

export function ProjectPageHeader({
    title,
    icon,
    tags,
    actions,
}: ProjectPageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10">
            <div className="mb-4 sm:mb-0 space-y-4">
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="text-[var(--ui-accent-brand)]">
                            {icon}
                        </div>
                    )}
                    <h1 className="text-4xl md:text-5xl font-medium tracking-tight font-[var(--font-display-serif)] text-[var(--ui-text-strong)]">
                        {title}
                    </h1>
                </div>
                {tags && (
                    <div className="flex flex-wrap gap-3 items-center">
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
