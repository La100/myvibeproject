import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { MobileProjectHeader } from "@/components/project/MobileProjectHeader";
import { ProjectProvider } from "@/components/providers/ProjectProvider";
import { FloatingChatKitLauncher } from "@/components/ai/chatkit/FloatingChatKitLauncher";
import { ProjectContentContainer } from "@/components/project/ProjectContentContainer";
import { DemoProjectTour } from "@/components/project/DemoProjectTour";
import { 
  SidebarProvider, 
  SidebarInset, 
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
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
              <Spinner className="p-6" />
            }>
              <ProjectContentContainer>{children}</ProjectContentContainer>
            </Suspense>
          </main>
          <FloatingChatKitLauncher />
          <DemoProjectTour />
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
      <div className="vibe-shell min-h-svh">
        <Spinner />
      </div>
    }>
      <ProjectProvider>
        <ProjectLayoutContent>{children}</ProjectLayoutContent>
      </ProjectProvider>
    </Suspense>
  );
} 
