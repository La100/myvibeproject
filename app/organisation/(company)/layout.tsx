"use client";

import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useEffect, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { CompanySidebar } from "@/components/company/CompanySidebar";
import { GuidedTourHost } from "@/components/tours/GuidedTourHost";
import { useOrganization } from "@clerk/nextjs";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { chooseOrganizationUrl } from "@/lib/authRedirects";

const swappedSurfaceVars = {
  "--workspace-background": "var(--background)",
  "--workspace-sidebar": "var(--sidebar)",
  "--background": "var(--workspace-sidebar)",
  "--sidebar": "var(--workspace-background)",
} as CSSProperties;

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
      router.replace(chooseOrganizationUrl);
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

  const breadcrumbs = useMemo(() => {
    const routeLabels: Record<string, string> = {
      "/organisation": "Projects",
      "/organisation/projects/new": "New Project",
      "/organisation/contacts": "Contacts",
      "/organisation/settings": "Settings",
      "/organisation/subscription": "Subscription",
      "/organisation/team": "Team",
      "/organisation/reports": "Reports",
      "/organisation/product-library": "Product Library",
      "/organisation/product-library/new": "Add Product",
      "/organisation/visualizations": "Visualizations",
    };

    const routeBreadcrumbs: Record<string, { label: string; href: string }[]> = {
      "/organisation/product-library/new": [
        { label: "Projects", href: "/organisation" },
        { label: "Product Library", href: "/organisation/product-library" },
        { label: "Add Product", href: "/organisation/product-library/new" },
      ],
    };

    const explicitBreadcrumbs = routeBreadcrumbs[pathname];
    if (explicitBreadcrumbs) {
      return explicitBreadcrumbs;
    }

    const crumbs: { label: string; href: string }[] = [];

    // Always start with Projects as home
    crumbs.push({ label: "Projects", href: "/organisation" });

    if (pathname !== "/organisation") {
      // Check for exact match first
      const label = routeLabels[pathname];
      if (label) {
        crumbs.push({ label, href: pathname });
      } else {
        // Build from path segments
        const segments = pathname.replace("/organisation/", "").split("/");
        let currentPath = "/organisation";
        for (const segment of segments) {
          currentPath += `/${segment}`;
          const segLabel = routeLabels[currentPath] || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          crumbs.push({ label: segLabel, href: currentPath });
        }
      }
    }

    return crumbs;
  }, [pathname]);

  if (
    onboardingStatus === undefined ||
    !onboardingStatus.authenticated ||
    !onboardingStatus.completed ||
    !isLoaded ||
    !organization
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="clean-panel flex w-full max-w-sm flex-col items-center gap-3 px-6 py-8 text-center">
          <Spinner fullHeight={false} className="py-0" iconClassName="size-5" />
          <p className="text-sm text-muted-foreground">Preparing workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={swappedSurfaceVars}>
      <SidebarProvider>
        <CompanySidebar />
        <GuidedTourHost scope="workspace" />
        <SidebarInset className="xl:overflow-hidden">
          <header className="xl:hidden sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md">
            <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
            <span className="text-lg font-medium text-foreground">Workspace</span>
          </header>
          <main className="flex-1 min-h-0 overflow-auto">
            <div className="mx-auto flex w-full max-w-[1540px] flex-col px-4 pb-8 pt-4 md:px-6 xl:px-8 xl:pt-8">
              {breadcrumbs.length > 1 && (
                <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={crumb.href} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                      {i < breadcrumbs.length - 1 ? (
                        <Link href={crumb.href} className="hover:text-foreground transition-colors">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-foreground font-medium">{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
              <div className="flex flex-col gap-6">
                {children}
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
} 
