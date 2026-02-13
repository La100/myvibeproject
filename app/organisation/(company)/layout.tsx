"use client";

import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useEffect, useRef } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "@/components/company/CompanySidebar";
import { useOrganization } from "@clerk/nextjs";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { organization, isLoaded } = useOrganization();
  const ensureCurrentUserTeamMembership = useMutation(apiAny.teamMembership.ensureCurrentUserTeamMembership);
  const ensuredOrgIdRef = useRef<string | null>(null);
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);

  const userRole = useQuery(
    apiAny.teams.getCurrentUserRoleInClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  useEffect(() => {
    if (onboardingStatus === undefined) {
      return;
    }
    if (!onboardingStatus.authenticated) {
      return;
    }
    if (!onboardingStatus.completed) {
      router.replace("/onboarding");
      return;
    }
    if (isLoaded && !organization?.id) {
      router.replace("/onboarding");
    }
  }, [onboardingStatus, isLoaded, organization?.id, router]);

  useEffect(() => {
    if (!isLoaded || !organization?.id) {
      ensuredOrgIdRef.current = null;
      return;
    }

    if (ensuredOrgIdRef.current === organization.id) {
      return;
    }

    ensuredOrgIdRef.current = organization.id;
    ensureCurrentUserTeamMembership({
      clerkOrgId: organization.id,
      orgName: organization.name,
    }).catch((error) => {
      ensuredOrgIdRef.current = null;
      console.error("Failed to ensure team membership", error);
    });
  }, [isLoaded, organization?.id, organization?.name, ensureCurrentUserTeamMembership]);

  useEffect(() => {
    if (userRole === "customer") {
      const allowedPaths = ["/organisation"];
      if (!allowedPaths.some(path => pathname === path)) {
        router.replace("/organisation");
      }
    }
  }, [userRole, pathname, router]);

  if (
    onboardingStatus === undefined ||
    !onboardingStatus.authenticated ||
    !onboardingStatus.completed ||
    !isLoaded ||
    !organization
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <CompanySidebar />
      <SidebarInset className="xl:clean-panel xl:overflow-hidden">
        <header className="xl:hidden sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
          <span className="clean-title text-lg font-medium">Workspace</span>
        </header>
        <main className="flex-1 min-h-0 overflow-auto">
          <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-6 px-4 pb-8 pt-4 md:px-6 xl:px-8 xl:pt-8">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 
