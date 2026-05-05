"use client";

import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useEffect, useMemo } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { CompanySidebar } from "@/components/company/CompanySidebar";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { postAuthResolverUrl } from "@/lib/authRedirects";
import { cn } from "@/lib/utils";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { organization, isLoaded } = useOrganization();
  const teamSettings = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) {
      return;
    }
    if (isLoaded && !organization?.id) {
      router.replace(postAuthResolverUrl);
      return;
    }
    if (isLoaded && organization?.id && teamSettings === null) {
      router.replace(postAuthResolverUrl);
      return;
    }
  }, [isAuthLoaded, isSignedIn, isLoaded, organization?.id, router, teamSettings]);

  const breadcrumbs = useMemo(() => {
    const routeLabels: Record<string, string> = {
      "/organisation": "Projects",
      "/organisation/notifications": "Notifications",
      "/organisation/calendar": "Calendar",
      "/organisation/projects/new": "New Project",
      "/organisation/contacts": "Contacts",
      "/organisation/tax": "Tax",
      "/organisation/settings": "Settings",
      "/organisation/subscription": "Subscription",
      "/organisation/team": "Team",
      "/organisation/reports": "Reports",
      "/organisation/libraries": "Libraries",
      "/organisation/product-library": "Product Library",
      "/organisation/product-library/new": "Add Product",
      "/organisation/survey-library": "Survey Library",
      "/organisation/survey-library/new": "New Survey Template",
      "/organisation/visualizations": "Visualizations",
    };

    const routeBreadcrumbs: Record<string, { label: string; href: string }[]> = {
      "/organisation/team": [
        { label: "Team", href: "/organisation/team" },
      ],
      "/organisation/product-library/new": [
        { label: "Projects", href: "/organisation" },
        { label: "Libraries", href: "/organisation/libraries" },
        { label: "Product Library", href: "/organisation/product-library" },
        { label: "Add Product", href: "/organisation/product-library/new" },
      ],
      "/organisation/survey-library/new": [
        { label: "Projects", href: "/organisation" },
        { label: "Libraries", href: "/organisation/libraries" },
        { label: "Survey Library", href: "/organisation/survey-library" },
        { label: "New Survey Template", href: "/organisation/survey-library/new" },
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
  const isFullBleedRoute = pathname === "/organisation/visualizations";
  const isCompanyOverviewRoute = pathname === "/organisation";

  if (
    !isAuthLoaded ||
    !isSignedIn ||
    teamSettings === undefined ||
    teamSettings === null ||
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
    <div className="vibe-shell min-h-svh">
      <SidebarProvider>
        <CompanySidebar />
        <SidebarInset className="xl:overflow-hidden">
          <header className="xl:hidden sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-[rgba(253,251,247,0.92)] px-4 backdrop-blur-md">
            <SidebarTrigger className="-ml-1 [&.hidden]:flex" />
            <span className="text-lg font-medium text-foreground">Workspace</span>
          </header>
          <main className="flex-1 min-h-0 overflow-auto">
            {isFullBleedRoute ? (
              <div className="flex w-full flex-col pb-8 pt-4 xl:pt-8">
                {breadcrumbs.length > 1 && (
                  <div className="mx-auto w-full max-w-[1540px] px-5 md:px-7 xl:px-10">
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
                  </div>
                )}
                <div className="flex flex-col gap-6">
                  {children}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "mx-auto flex w-full flex-col pb-8 pt-4 xl:pt-8",
                  isCompanyOverviewRoute
                    ? "max-w-[1960px] px-5 md:px-7 xl:px-10"
                    : "max-w-[1540px] px-5 md:px-7 xl:px-10",
                )}
              >
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
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
} 
