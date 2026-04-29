"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useProject } from "@/components/providers/ProjectProvider";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ArrowLeft,
  LayoutDashboard,
  Eye,
  Settings,
  ShoppingCart,
  CheckSquare,
  Files,
  Sparkles,
  ClipboardList,
  Contact,
  StickyNote,
  Image,
  Hammer,
  Calculator,
  LogOut,
  Settings2,
  ChevronDown,
  Calendar,
  BellRing,
  FolderOpen,
  DraftingCompass,
  Wallet,
  Mail,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isClientNotificationActivity } from "@/lib/projectClientNotifications";

function ProjectSidebarContent() {
  const params = useParams<{ projectSlug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { project, markClientNotificationsReadLocally } = useProject();
  const { signOut, openUserProfile } = useClerk();
  const { user } = useUser();
  const markClientNotificationsRead = useMutation(apiAny.projects.markClientNotificationsRead);
  const activities = useQuery(apiAny.activityLog.getForProject, { projectId: project._id });
  const notificationsHref = `/organisation/projects/${params.projectSlug}/changelog`;
  const isNotificationsRouteActive = pathname.startsWith(notificationsHref);
  const lastMarkedNotificationAtRef = useRef(0);

  const clientNotifications = useMemo(
    () => dedupeActivityLogActivities((activities ?? []).filter(isClientNotificationActivity)),
    [activities],
  );
  const lastReadAt = project.clientNotificationsLastReadAt ?? 0;
  const latestNotificationAt = clientNotifications[0]?._creationTime ?? 0;

  const unreadClientNotifications = clientNotifications.filter(
    (activity) => activity._creationTime > lastReadAt,
  ).length;
  const visibleNotificationCount = isNotificationsRouteActive ? 0 : unreadClientNotifications;

  useEffect(() => {
    if (!isNotificationsRouteActive || latestNotificationAt === 0) {
      return;
    }
    if (lastReadAt >= latestNotificationAt) {
      return;
    }
    if (lastMarkedNotificationAtRef.current >= latestNotificationAt) {
      return;
    }

    lastMarkedNotificationAtRef.current = latestNotificationAt;
    markClientNotificationsReadLocally(latestNotificationAt);

    void markClientNotificationsRead({
      projectId: project._id,
      lastReadAt: latestNotificationAt,
    });
  }, [
    isNotificationsRouteActive,
    lastReadAt,
    latestNotificationAt,
    markClientNotificationsRead,
    markClientNotificationsReadLocally,
    project._id,
  ]);

  const allNavItems = [
    { href: `/organisation/projects/${params.projectSlug}`, label: "Overview", icon: LayoutDashboard, key: "overview", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/customer-panel`, label: "Client Portal", icon: Eye, key: "customer_panel", group: "project" },
    {
      href: notificationsHref,
      label: "Notifications",
      icon: BellRing,
      key: "notifications",
      group: "project",
      notificationCount: visibleNotificationCount,
    },
    { href: `/organisation/projects/${params.projectSlug}/tasks`, label: "Tasks", icon: CheckSquare, key: "tasks", group: "architecture" },
    { href: `/organisation/projects/${params.projectSlug}/moodboard`, label: "Moodboard", icon: Image, key: "moodboard", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/notes`, label: "Notes", icon: StickyNote, key: "notes", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/contacts`, label: "Contacts", icon: Contact, key: "contacts", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/calendar`, label: "Calendar", icon: Calendar, key: "calendar", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/payments`, label: "Payments", icon: Wallet, key: "payments", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/surveys`, label: "Surveys", icon: ClipboardList, key: "surveys", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/files`, label: "Files", icon: Files, key: "files", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/shopping-list`, label: "Shopping List", icon: ShoppingCart, key: "shopping_list", group: "architecture" },
    { href: `/organisation/projects/${params.projectSlug}/labor`, label: "Labor", icon: Hammer, key: "labor", group: "architecture" },
    { href: `/organisation/projects/${params.projectSlug}/estimations`, label: "Estimations", icon: Calculator, key: "estimations", group: "project" },
  ];

  const aiItem = { href: `/organisation/projects/${params.projectSlug}/ai`, label: "AI", icon: Sparkles, key: "ai" };
  const settingsItem = { href: `/organisation/projects/${params.projectSlug}/settings`, label: "Settings", icon: Settings, key: "settings" };

  const projectNavItems = allNavItems.filter((item) => item.group === "project");
  const architectureNavItems = allNavItems.filter((item) => item.group === "architecture");
  const footerItems = [
    settingsItem,
    { href: "/contact", label: "Contact", icon: Mail },
  ];

  const userInitial =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";
  const projectName = project?.name || "Project";

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  const handleLinkHover = (href: string) => {
    router.prefetch(href);
  };

  const isItemActive = (href: string) => {
    const isOverviewRoute = href === `/organisation/projects/${params.projectSlug}`;
    return isOverviewRoute ? pathname === href : pathname.startsWith(href);
  };

  const renderSection = (
    title: string,
    icon: LucideIcon,
    items: typeof projectNavItems
  ) => {
    const Icon = icon;
    return (
      <SidebarGroupContent className="pt-3 first:pt-0">
        <div className="mb-1.5 flex items-center gap-2.5 px-2">
          <Icon className="h-3.5 w-3.5 text-sidebar-foreground/75" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/85">
            {title}
          </span>
        </div>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const isActive = isItemActive(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={`h-9 justify-start gap-2.5 rounded-2xl border px-3 text-[13px] font-medium ${isActive
                      ? "border-sidebar-border/90 bg-sidebar-accent/70 text-sidebar-foreground shadow-sm"
                      : "border-transparent bg-transparent text-sidebar-foreground/82 hover:bg-sidebar-accent/34 hover:text-sidebar-foreground"
                    }`}
                >
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    onMouseEnter={() => handleLinkHover(item.href)}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/68"}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {typeof item.notificationCount === "number" && item.notificationCount > 0 ? (
                      <Badge variant="secondary" className="min-w-5 px-1.5 py-0.5 text-[10px] leading-none">
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
    );
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border/70 px-4 pt-5 pb-3">
        <div className="flex items-center">
          <Link
            href="/organisation"
            onClick={handleLinkClick}
            onMouseEnter={() => handleLinkHover("/organisation")}
            className="group flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-1 py-1 text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/28"
          >
            <ArrowLeft className="h-4 w-4 text-sidebar-foreground/55" />
            <span className="min-w-0 flex-1 truncate font-serif text-[18px] font-medium tracking-[-0.035em] text-sidebar-foreground">
              {projectName}
            </span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-0 px-2 pb-2">
        <SidebarGroup className="flex-1 px-3 pt-7 pb-2">
          {renderSection("Project", FolderOpen, projectNavItems)}
          {renderSection("Architecture", DraftingCompass, architectureNavItems)}
        </SidebarGroup>

        <SidebarGroup className="mt-auto px-4 pb-9 pt-1.5">
          <SidebarGroupContent>
            <Button asChild className="h-10 w-full justify-center rounded-full text-[13px] font-medium">
              <Link
                href={aiItem.href}
                onClick={handleLinkClick}
                onMouseEnter={() => handleLinkHover(aiItem.href)}
              >
                <aiItem.icon data-icon="inline-start" />
                <span className="truncate">{aiItem.label}</span>
              </Link>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="border-t border-sidebar-border/70 px-2 pb-1 pt-2.5">
          <SidebarGroupContent className="pt-2">
            <SidebarMenu className="gap-0.5">
              {footerItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-9 justify-start gap-2.5 rounded-2xl border px-3 text-[13px] font-medium ${isActive
                          ? "border-sidebar-border/90 bg-sidebar-accent/70 text-sidebar-foreground shadow-sm"
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
                      <NextImage
                        src={user.imageUrl}
                        alt={user.fullName || user.firstName || "User"}
                        fill
                        sizes="32px"
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

export function ProjectSidebar() {
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
                  {Array.from({ length: 7 }).map((_, i) => (
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
      <ProjectSidebarContent />
    </Suspense>
  );
}
