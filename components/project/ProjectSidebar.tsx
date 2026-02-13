"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useProject } from "@/components/providers/ProjectProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ArrowLeft,
  LayoutDashboard,
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
  LifeBuoy,
  LogOut,
  Settings2,
  ChevronDown,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ProjectSidebarContent() {
  const params = useParams<{ projectSlug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { project, team, permissions: sidebarPermissions } = useProject();
  const { signOut, openUserProfile } = useClerk();
  const { user } = useUser();

  const allNavItems = [
    { href: `/organisation/projects/${params.projectSlug}`, label: "Overview", icon: LayoutDashboard, key: "overview", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/tasks`, label: "Tasks", icon: CheckSquare, key: "tasks", group: "architecture" },
    { href: `/organisation/projects/${params.projectSlug}/moodboard`, label: "Moodboard", icon: Image, key: "moodboard", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/notes`, label: "Notes", icon: StickyNote, key: "notes", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/contacts`, label: "Contacts", icon: Contact, key: "contacts", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/calendar`, label: "Calendar", icon: Calendar, key: "calendar", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/surveys`, label: "Surveys", icon: ClipboardList, key: "surveys", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/files`, label: "Files", icon: Files, key: "files", group: "project" },
    { href: `/organisation/projects/${params.projectSlug}/shopping-list`, label: "Materials", icon: ShoppingCart, key: "shopping_list", group: "architecture" },
    { href: `/organisation/projects/${params.projectSlug}/labor`, label: "Labor", icon: Hammer, key: "labor", group: "architecture" },
    { href: `/organisation/projects/${params.projectSlug}/estimations`, label: "Estimations", icon: Calculator, key: "estimations", group: "project" },
  ];

  const aiItem = { href: `/organisation/projects/${params.projectSlug}/ai`, label: "AI Assistant", icon: Sparkles, key: "ai" };
  const settingsItem = { href: `/organisation/projects/${params.projectSlug}/settings`, label: "Settings", icon: Settings, key: "settings" };

  const navItems = sidebarPermissions?.permissions
    ? allNavItems.filter((item) => sidebarPermissions.permissions?.[item.key as keyof typeof sidebarPermissions.permissions]?.visible !== false)
    : allNavItems;
  const projectNavItems = navItems.filter((item) => item.group === "project");
  const architectureNavItems = navItems.filter((item) => item.group === "architecture");

  const showSettings =
    sidebarPermissions?.permissions?.settings?.visible !== false;
  const footerItems = [
    ...(showSettings ? [settingsItem] : []),
    { href: "/help", label: "Help", icon: LifeBuoy },
  ];

  const userInitial =
    user?.fullName?.charAt(0) ||
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "U";

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

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border/70">
        <div className="flex flex-col gap-0.5 py-4 px-4">
          <Link
            href="/organisation"
            onClick={handleLinkClick}
            onMouseEnter={() => handleLinkHover("/organisation")}
            className="group mb-3 flex items-center gap-2 text-sidebar-foreground/65 transition-colors hover:text-sidebar-foreground"
          >
            <ArrowLeft className="h-4 w-4 text-sidebar-foreground/50" />
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase">
              {team?.name || "Organization"}
            </span>
          </Link>

          <div className="px-0.5">
            <h2 className="clean-title text-xl font-medium leading-tight tracking-tight text-sidebar-foreground">
              {project.name}
            </h2>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarGroupLabel className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">
              Project
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1">
              {projectNavItems.map((item) => {
                const isActive = isItemActive(item.href);
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
                        <item.icon className={isActive ? "h-4 w-4 text-sidebar-foreground" : "h-4 w-4 text-sidebar-foreground/65"} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          <SidebarGroupContent className="pt-2">
            <SidebarGroupLabel className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">
              Architecture
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1">
              {architectureNavItems.map((item) => {
                const isActive = isItemActive(item.href);
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
                        <item.icon className={isActive ? "h-4 w-4 text-sidebar-foreground" : "h-4 w-4 text-sidebar-foreground/65"} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent className="px-2 pb-2">
            <Link
              href={aiItem.href}
              onClick={handleLinkClick}
              onMouseEnter={() => handleLinkHover(aiItem.href)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent/75"
            >
              <aiItem.icon className="h-4 w-4" />
              <span className="text-sm font-semibold tracking-tight">{aiItem.label}</span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="border-t border-sidebar-border/70 pt-2">
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
                        <item.icon className={isActive ? "h-4 w-4 text-sidebar-foreground" : "h-4 w-4 text-sidebar-foreground/65"} />
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
                      <NextImage
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

export function ProjectSidebar() {
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
                  {Array.from({ length: 7 }).map((_, i) => (
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
      <ProjectSidebarContent />
    </Suspense>
  );
}
