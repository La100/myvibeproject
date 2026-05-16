/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useQuery } from "convex/react";
import { useClerk, useOrganization, useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { dedupeActivityLogActivities } from "@/lib/activityLogDeduplication";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { SidebarSubscriptionNudge } from "@/components/shared/SidebarSubscriptionNudge";
import {
  Settings,
  CreditCard,
  Users,
  FolderOpen,
  Library,
  Calendar,
  BarChart3,
  Contact,
  Package,
  Percent,
  Sparkles,
  LogOut,
  Settings2,
  ChevronDown,
  BellRing,
  ClipboardList,
  Mail,
  Languages,
} from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";

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
      <img
        src="/logo.svg"
        alt="Myvibe Project"
        className={`h-full w-full object-contain ${imagePaddingClassName}`}
      />
    </div>
  );
}

function CompanySidebarContent() {
  const { locale, setLocale, t } = useI18n();
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
  const organizationNotifications = useQuery(
    apiAny.activityLog.getClientNotificationsForTeam,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const notificationsHref = "/organisation/notifications";
  const dedupedOrganizationNotifications = useMemo(
    () => dedupeActivityLogActivities(organizationNotifications ?? []),
    [organizationNotifications],
  );
  const unreadOrganizationNotificationCount = dedupedOrganizationNotifications.filter(
    (notification) =>
      notification._creationTime >
      ((notification as { effectiveLastReadAt?: number }).effectiveLastReadAt ?? 0),
  ).length;

  // Define navigation items based on user role
  const allNavItems = [
    { href: "/organisation", label: t("navigation", "projects"), icon: FolderOpen, allowedRoles: ["admin", "member"] },
    {
      href: notificationsHref,
      label: t("navigation", "notifications"),
      icon: BellRing,
      allowedRoles: ["admin", "member"],
      notificationCount: pathname.startsWith(notificationsHref) ? 0 : unreadOrganizationNotificationCount,
    },
    { href: "/organisation/calendar", label: t("navigation", "calendar"), icon: Calendar, allowedRoles: ["admin", "member"] },
    { href: "/organisation/visualizations", label: t("navigation", "visualizations"), icon: Sparkles, allowedRoles: ["admin", "member"] },
    { href: "/organisation/libraries", label: t("navigation", "libraries"), icon: Library, allowedRoles: ["admin", "member"], isLibraryGroup: true },
    { href: "/organisation/team", label: t("navigation", "team"), icon: Users, allowedRoles: ["admin", "member"] },
    { href: "/organisation/tax", label: t("navigation", "tax"), icon: Percent, allowedRoles: ["admin", "member"] },
    { href: "/organisation/reports", label: t("navigation", "reports"), icon: BarChart3, allowedRoles: ["admin", "member"] },
  ];
  const libraryItems = [
    { href: "/organisation/contacts", label: t("navigation", "teamContacts"), icon: Contact },
    { href: "/organisation/product-library", label: t("navigation", "productLibrary"), icon: Package },
    { href: "/organisation/survey-library", label: t("navigation", "surveyLibrary"), icon: ClipboardList },
  ];
  const footerItems = [
    { href: "/organisation/settings", label: t("navigation", "settings"), icon: Settings, isActive: pathname === "/organisation/settings" },
    { href: "/organisation/subscription", label: t("navigation", "subscription"), icon: CreditCard, isActive: pathname === "/organisation/subscription" },
    { href: "/contact", label: t("common", "contact"), icon: Mail, isActive: pathname.startsWith("/contact") },
  ];

  const userInitial =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";
  const organizationName = organization?.name || team?.name || t("common", "workspace");
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
              alt={organization?.name || team?.name || t("common", "workspace")}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              title={organizationName}
              className="line-clamp-2 max-w-full overflow-hidden font-serif text-[18px] font-medium leading-[1.08] tracking-[-0.035em] text-sidebar-foreground [overflow-wrap:anywhere]"
            >
              {organizationName}
            </h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/72 leading-none">
              {t("navigation", "companySpace")}
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
                const isLibraryGroup = "isLibraryGroup" in item && item.isLibraryGroup === true;
                const isLibraryActive = isLibraryGroup && (
                  pathname === "/organisation/libraries" ||
                  libraryItems.some((libraryItem) => pathname.startsWith(libraryItem.href))
                );
                const isActive = isLibraryActive || (isProjectsRoot
                  ? pathname === "/organisation" || pathname.startsWith("/organisation/projects")
                  : pathname.startsWith(item.href));

                if (isLibraryGroup) {
                  return (
                    <Collapsible key={item.href} defaultOpen={isActive} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            className={`h-9 justify-start gap-2.5 rounded-2xl border px-3 text-[13px] font-medium ${
                              isActive
                                ? "border-sidebar-border/90 bg-white text-sidebar-foreground shadow-sm"
                                : "border-transparent bg-transparent text-sidebar-foreground/82 hover:bg-sidebar-accent/34 hover:text-sidebar-foreground"
                            }`}
                          >
                            <item.icon
                              className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/68"}`}
                            />
                            <span className="truncate">{item.label}</span>
                            <ChevronDown className="ml-auto h-4 w-4 text-sidebar-foreground/52 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="group/collapsible data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                          <SidebarMenuSub className="mt-1.5 gap-0.5 border-sidebar-border/60 py-1">
                            {libraryItems.map((libraryItem) => {
                              const isChildActive = pathname.startsWith(libraryItem.href);
                              return (
                                <SidebarMenuSubItem key={libraryItem.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isChildActive}
                                    className={`h-8 rounded-xl text-[13px] ${
                                      isChildActive
                                        ? "bg-white text-sidebar-foreground shadow-sm"
                                        : "text-sidebar-foreground/76 hover:bg-sidebar-accent/34 hover:text-sidebar-foreground"
                                    }`}
                                  >
                                    <Link
                                      href={libraryItem.href}
                                      onClick={handleLinkClick}
                                      onMouseEnter={() => handleLinkHover(libraryItem.href)}
                                    >
                                      <libraryItem.icon className={isChildActive ? "text-sidebar-primary" : "text-sidebar-foreground/58"} />
                                      <span>{libraryItem.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-9 justify-start gap-2.5 rounded-2xl border px-3 text-[13px] font-medium ${
                        isActive
                          ? "border-sidebar-border/90 bg-white text-sidebar-foreground shadow-sm"
                          : "border-transparent bg-transparent text-sidebar-foreground/82 hover:bg-sidebar-accent/34 hover:text-sidebar-foreground"
                      }`}
                    >
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        onMouseEnter={() => handleLinkHover(item.href)}
                        className="flex flex-1 items-center gap-3"
                      >
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/68"}`}
                        />
                        <span className="truncate">{item.label}</span>
                        {typeof item.notificationCount === "number" && item.notificationCount > 0 ? (
                          <Badge variant="secondary" className="ml-auto min-w-5 px-1.5 py-0.5 text-[10px] leading-none">
                            {item.notificationCount > 99 ? "99+" : item.notificationCount}
                          </Badge>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSubscriptionNudge
          teamId={team?._id}
          className="mb-3"
          onNavigate={handleLinkClick}
        />

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
                      className={`h-9 justify-start gap-2.5 rounded-2xl border px-3 text-[13px] font-medium ${
                        isActive
                          ? "border-sidebar-border/90 bg-white text-sidebar-foreground shadow-sm"
                          : "border-transparent text-sidebar-foreground/78 hover:bg-sidebar-accent/34 hover:text-sidebar-foreground"
                      }`}
                    >
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        onMouseEnter={() => handleLinkHover(item.href)}
                        className="flex flex-1 items-center gap-3"
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/68"}`} />
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
                  className="flex w-full items-center gap-2.5 rounded-2xl border border-transparent bg-transparent px-2.5 py-1.5 text-left transition hover:bg-sidebar-accent/40"
                >
                  {user?.imageUrl ? (
                    <div className="relative h-8 w-8 overflow-hidden rounded-full border border-sidebar-border/70">
                      <img
                        src={user.imageUrl}
                        alt={user.fullName || user.firstName || "User"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {userInitial.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                      {user?.fullName || user?.firstName || t("common", "account")}
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
                    {user?.fullName || user?.firstName || t("common", "account")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Languages className="h-3.5 w-3.5" />
                  {t("common", "language")}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={locale}
                  onValueChange={(value) => setLocale(value as Locale)}
                >
                  <DropdownMenuRadioItem value="en">
                    {t("language", "english")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pl">
                    {t("language", "polish")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => openUserProfile?.()}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    {t("common", "manageAccount")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("common", "signOut")}
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
          <SidebarContent className="justify-center">
            <Spinner fullHeight={false} iconClassName="size-5" />
          </SidebarContent>
        </Sidebar>
      }
    >
      <CompanySidebarContent />
    </Suspense>
  );
}
