import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { ProjectProvider } from "@/components/providers/ProjectProvider";
import { 
  SidebarProvider, 
  SidebarInset, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { Suspense } from "react";

function ProjectLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ProjectSidebar />
      <SidebarInset className="xl:clean-panel xl:overflow-hidden">
        <header className="xl:hidden sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
          <span className="clean-title text-lg font-medium">Project</span>
        </header>
        <main className="flex-1 min-h-0 overflow-auto">
          <Suspense fallback={
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </div>
          }>
            <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-6 px-4 pb-8 pt-4 md:px-6 xl:px-8 xl:pt-8">
              {children}
            </div>
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    projectSlug: string;
  }>;
}

export default async function ProjectLayout({
  children,
}: ProjectLayoutProps) {
  return (
    <Suspense fallback={
      <div className="flex h-screen">
        <div className="w-64 bg-muted animate-pulse" />
        <div className="flex-1 p-8">
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <ProjectProvider>
        <ProjectLayoutContent>{children}</ProjectLayoutContent>
      </ProjectProvider>
    </Suspense>
  );
} 
