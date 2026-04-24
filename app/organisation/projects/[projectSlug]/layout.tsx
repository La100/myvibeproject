import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { MobileProjectHeader } from "@/components/project/MobileProjectHeader";
import { ProjectProvider } from "@/components/providers/ProjectProvider";
import { FloatingChatKitLauncher } from "@/components/ai/chatkit/FloatingChatKitLauncher";
import { ProjectContentContainer } from "@/components/project/ProjectContentContainer";
import { 
  SidebarProvider, 
  SidebarInset, 
} from "@/components/ui/sidebar";
import type { CSSProperties } from "react";
import { Suspense } from "react";

function ProjectLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="vibe-shell min-h-svh">
      <SidebarProvider
        style={{
          "--sidebar-width": "16rem",
        } as CSSProperties}
      >
        <ProjectSidebar />
        <SidebarInset className="bg-transparent xl:clean-panel xl:overflow-hidden">
          <MobileProjectHeader />
          <main className="flex-1 min-h-0 overflow-auto bg-transparent">
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
              <ProjectContentContainer>{children}</ProjectContentContainer>
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
