"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useClerk, useOrganization, useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  Users,
  FolderOpen,
  BarChart3,
  Contact,
  Package,
  Sparkles,
  LifeBuoy,
  LogOut,
  Settings2,
  ChevronDown,
} from "lucide-react";

function CompanySidebarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { signOut, openUserProfile } = useClerk();
  const { organization } = useOrganization();
  const { user } = useUser();

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  // Get current user role in team
  const userRole = useQuery(
    apiAny.teams.getCurrentUserRoleInClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  // Define navigation items based on user role
  const allNavItems = [
    { href: "/organisation", label: "Projects", icon: FolderOpen, allowedRoles: ["admin", "member"] },
    { href: "/organisation/visualizations", label: "Visualizations", icon: Sparkles, allowedRoles: ["admin", "member"] },
    { href: "/organisation/product-library", label: "Product Library", icon: Package, allowedRoles: ["admin", "member"] },
    { href: "/organisation/team", label: "Team", icon: Users, allowedRoles: ["admin", "member"] },
    { href: "/organisation/contacts", label: "Contacts", icon: Contact, allowedRoles: ["admin", "member"] },
    { href: "/organisation/reports", label: "Reports", icon: BarChart3, allowedRoles: ["admin", "member"] },
  ];
  const footerItems = [
    { href: "/organisation/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "Help", icon: LifeBuoy },
  ];

  const userInitial =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";

  // Filter navigation items based on user role
  const navItems = allNavItems.filter(
    (item) => !userRole || item.allowedRoles.includes(userRole)
  );

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLinkHover = (href: string) => {
    router.prefetch(href);
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border/70">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex-shrink-0">
            {organization?.imageUrl || team?.imageUrl ? (
              <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-sidebar-border/70 bg-card">
                <Image
                  src={organization?.imageUrl || team?.imageUrl || ""}
                  alt={organization?.name || team?.name || "Organization"}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold">
                {(organization?.name || team?.name || "O").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="clean-title mb-1 truncate text-base font-medium leading-none text-sidebar-foreground">
              {organization?.name || team?.name || "Loading..."}
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/55 leading-none">
              Company Space
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isProjectsRoot = item.href === "/organisation";
                const isActive = isProjectsRoot
                  ? pathname === "/organisation" || pathname.startsWith("/organisation/projects")
                  : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      variant={isActive ? "active" : "default"}
                      isActive={isActive}
                      className={cn(
                        "relative h-10 justify-start gap-3 text-sm",
                        isActive && "before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
                      )}
                    >
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        onMouseEnter={() => handleLinkHover(item.href)}
                        className="flex flex-1 items-center gap-3"
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-all duration-200",
                            isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/65"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto border-t border-sidebar-border/70 pt-2">
          <SidebarGroupContent className="pt-2">
            <SidebarMenu>
              {footerItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      variant={isActive ? "active" : "default"}
                      isActive={isActive}
                      className="h-10 justify-start gap-3 text-sm text-sidebar-foreground"
                    >
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        onMouseEnter={() => handleLinkHover(item.href)}
                        className="flex flex-1 items-center gap-3"
                      >
                        <item.icon className={cn("h-4 w-4", isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/65")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          <SidebarGroupContent className="px-2 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-sidebar-border/70 hover:bg-sidebar-accent/50"
                >
                  {user?.imageUrl ? (
                    <div className="relative h-9 w-9 overflow-hidden rounded-full border border-sidebar-border/70">
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName || user.firstName || "User"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {userInitial.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">
                      {user?.fullName || user?.firstName || "Account"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">
                      {user?.primaryEmailAddress?.emailAddress || ""}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl border-border/70">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">
                    {user?.fullName || user?.firstName || "Account"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openUserProfile?.()}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Manage account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function CompanySidebar() {
  return (
    <Suspense
      fallback={
        <Sidebar variant="inset">
          <SidebarHeader className="border-b border-sidebar-border/70">
            <div className="flex flex-col gap-2 py-2 px-2">
              <div className="px-2 py-1">
                <div className="h-7 bg-muted rounded animate-pulse mb-1" />
                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <div className="h-10 bg-muted rounded animate-pulse mx-2 mb-1" />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      }
    >
      <CompanySidebarContent />
    </Suspense>
  );
}
