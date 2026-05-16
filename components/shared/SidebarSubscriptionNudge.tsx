"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type SidebarSubscriptionNudgeProps = {
  teamId?: Id<"teams"> | null;
  className?: string;
  onNavigate?: () => void;
};

export function SidebarSubscriptionNudge({
  teamId,
  className,
  onNavigate,
}: SidebarSubscriptionNudgeProps) {
  const { t } = useI18n();
  const router = useRouter();
  const subscription = useQuery(
    apiAny.stripe.getTeamSubscription,
    teamId ? { teamId } : "skip",
  );
  const projects = useQuery(
    apiAny.projects.getProjectsForTeam,
    teamId ? { teamId } : "skip",
  );

  if (!teamId || subscription === undefined || projects === undefined) {
    return null;
  }

  const hasActivePaidSubscription =
    subscription.subscriptionPlan !== "free" &&
    (subscription.subscriptionStatus === "active" ||
      subscription.subscriptionStatus === "trialing");

  if (hasActivePaidSubscription) {
    return null;
  }

  const href = "/organisation/subscription";
  const checklistItems = [
    { label: t("subscriptionNudge", "createWorkspace"), completed: true },
    { label: t("subscriptionNudge", "createProject"), completed: projects.length > 0 },
    { label: t("subscriptionNudge", "startSubscription"), completed: false },
  ];

  return (
    <div
      className={cn(
        "mx-2 rounded-2xl border border-sidebar-border/80 bg-card/86 px-4 py-4 text-sidebar-foreground shadow-sm",
        className,
      )}
    >
      <h3 className="text-[15px] font-semibold leading-tight text-sidebar-foreground">
        {t("subscriptionNudge", "title")}
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {checklistItems.map((item) => {
          const Icon = item.completed ? CheckCircle2 : Circle;

          return (
            <li key={item.label} className="flex items-center gap-2.5 text-[13px] font-medium leading-none">
              <Icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0",
                  item.completed
                    ? "text-sidebar-primary/74"
                    : "text-sidebar-foreground/28",
                )}
              />
              <span className="min-w-0 truncate">{item.label}</span>
            </li>
          );
        })}
      </ul>
      <Button
        asChild
        size="sm"
        className="mt-4 h-9 rounded-xl px-4 text-[13px] font-semibold"
      >
        <Link
          href={href}
          onClick={onNavigate}
          onMouseEnter={() => router.prefetch(href)}
        >
          {t("subscriptionNudge", "upgradeNow")}
        </Link>
      </Button>
    </div>
  );
}
