import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { MobileProjectHeader } from "@/components/project/MobileProjectHeader";
import { ProjectProvider } from "@/components/providers/ProjectProvider";
import { FloatingChatKitLauncher } from "@/components/ai/chatkit/FloatingChatKitLauncher";
import { 
  SidebarProvider, 
  SidebarInset, 
} from "@/components/ui/sidebar";
import type { CSSProperties } from "react";
import { Suspense } from "react";

const swappedSurfaceVars = {
  "--workspace-background": "var(--background)",
  "--workspace-sidebar": "var(--sidebar)",
  "--background": "var(--workspace-sidebar)",
  "--sidebar": "var(--workspace-background)",
} as CSSProperties;

function ProjectLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div style={swappedSurfaceVars}>
      <SidebarProvider
        style={{
          "--sidebar-width": "16rem",
        } as CSSProperties}
      >
        <ProjectSidebar />
        <SidebarInset className="bg-[#faf9f7] xl:clean-panel xl:overflow-hidden">
          <MobileProjectHeader />
          <main className="flex-1 min-h-0 overflow-auto bg-[#faf9f7]">
            <Suspense fallback={
              <div className="flex flex-col gap-4">
                <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-32 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              </div>
            }>
              <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6 px-5 pb-10 pt-5 md:px-7 xl:px-10 xl:pt-10">
                {children}
              </div>
            </Suspense>
          </main>
          <FloatingChatKitLauncher />
        </SidebarInset>
      </SidebarProvider>
    </div>
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
          <div className="flex flex-col gap-4">
            <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded bg-muted" />
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
