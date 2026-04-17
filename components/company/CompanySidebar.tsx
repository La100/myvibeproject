"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useClerk, useOrganization, useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings,
  CreditCard,
  Users,
  FolderOpen,
  BarChart3,
  Contact,
  Package,
  Percent,
  Sparkles,
  LifeBuoy,
  LogOut,
  Settings2,
  ChevronDown,
} from "lucide-react";

function OrganizationAvatar({
  imageUrl,
  hasImage = false,
  alt,
  className = "h-9 w-9 rounded-xl",
  imagePaddingClassName = "p-1",
}: {
  imageUrl?: string | null;
  hasImage?: boolean;
  alt: string;
  className?: string;
  imagePaddingClassName?: string;
}) {
  if (hasImage && imageUrl) {
    return (
      <div className={`relative overflow-hidden border border-sidebar-border/70 bg-card ${className}`}>
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden border border-sidebar-border/70 bg-card ${className}`}>
      <Image
        src="/logo.svg"
        alt="Myvibe Project"
        fill
        className={`object-contain ${imagePaddingClassName}`}
      />
    </div>
  );
}

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
    { href: "/organisation/tax", label: "Tax", icon: Percent, allowedRoles: ["admin", "member"] },
    { href: "/organisation/reports", label: "Reports", icon: BarChart3, allowedRoles: ["admin", "member"] },
  ];
  const footerItems = [
    { href: "/organisation/settings", label: "Settings", icon: Settings, isActive: pathname === "/organisation/settings" },
    { href: "/organisation/subscription", label: "Subscription", icon: CreditCard, isActive: pathname === "/organisation/subscription" },
    { href: "/help", label: "Help", icon: LifeBuoy, isActive: pathname.startsWith("/help") },
  ];

  const userInitial =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";
  const organizationName = organization?.name || team?.name || "Loading...";
  const organizationHasImage = organization?.hasImage ?? false;
  const organizationImageUrl = team?.imageUrl || organization?.imageUrl;

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
      <SidebarHeader className="border-b border-sidebar-border/70 px-4 pt-5 pb-3">
        <div className="flex w-full items-center gap-3 px-1 py-1 text-left">
          <div className="flex-shrink-0">
            <OrganizationAvatar
              imageUrl={organizationImageUrl}
              hasImage={organizationHasImage}
              alt={organization?.name || team?.name || "Organization"}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              title={organizationName}
              className="line-clamp-2 max-w-full overflow-hidden text-[17px] font-semibold leading-[1.08] tracking-tight text-sidebar-foreground [overflow-wrap:anywhere]"
            >
              {organizationName}
            </h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/72 leading-none">
              Company Space
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-0 px-2 pb-2">
        <SidebarGroup className="flex-1 px-3 pt-7 pb-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isProjectsRoot = item.href === "/organisation";
                const isActive = isProjectsRoot
                  ? pathname === "/organisation" || pathname.startsWith("/organisation/projects")
                  : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-8 justify-start gap-2.5 rounded-xl border px-3 text-[13px] font-medium ${
                        isActive
                          ? "border-sidebar-border/80 bg-sidebar-accent/45 text-sidebar-foreground"
                          : "border-transparent bg-transparent text-sidebar-foreground hover:bg-transparent hover:text-sidebar-foreground"
                      }`}
                    >
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        onMouseEnter={() => handleLinkHover(item.href)}
                        className="flex flex-1 items-center gap-3"
                      >
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-sidebar-foreground/88" : "text-sidebar-foreground/72"}`}
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

        <SidebarGroup className="mt-auto border-t border-sidebar-border/70 px-2 pb-1 pt-2.5">
          <SidebarGroupContent className="pt-2">
            <SidebarMenu className="gap-0.5">
              {footerItems.map((item) => {
                const isActive = item.isActive;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-8 justify-start gap-2.5 rounded-xl border px-3 text-[13px] font-medium ${
                        isActive
                          ? "border-sidebar-border/80 bg-sidebar-accent/45 text-sidebar-foreground"
                          : "border-transparent text-sidebar-foreground/82 hover:bg-transparent hover:text-sidebar-foreground"
                      }`}
                    >
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        onMouseEnter={() => handleLinkHover(item.href)}
                        className="flex flex-1 items-center gap-3"
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-foreground/88" : "text-sidebar-foreground/72"}`} />
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
                  className="flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-transparent px-2.5 py-1.5 text-left transition hover:bg-sidebar-accent/30"
                >
                  {user?.imageUrl ? (
                    <div className="relative h-8 w-8 overflow-hidden rounded-full border border-sidebar-border/70">
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName || user.firstName || "User"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {userInitial.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                      {user?.fullName || user?.firstName || "Account"}
                    </p>
                    <p className="truncate text-[11px] text-sidebar-foreground/60">
                      {user?.primaryEmailAddress?.emailAddress || ""}
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/60" />
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
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => openUserProfile?.()}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Manage account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
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
                <Skeleton className="mb-1 h-7" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <Skeleton className="mx-2 mb-1 h-10" />
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
