import { ReactNode } from "react";

interface ProjectPageLayoutProps {
    children: ReactNode;
}

/**
 * A consistent wrapper for all project subpages (Overview, Labor, Tasks, etc) to ensure 
 * the exact same responsive width and structural padding across the entire project dashboard.
 */
export function ProjectPageLayout({ children }: ProjectPageLayoutProps) {
    return (
        <div className="w-full">
            {children}
        </div>
    );
}
