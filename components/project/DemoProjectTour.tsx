"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Hammer,
  ImageIcon,
  LayoutDashboard,
  ListTodo,
  ShoppingCart,
  SquareUserRound,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProject } from "@/components/providers/ProjectProvider";
import { apiAny } from "@/lib/convexApiAny";
import { useI18n } from "@/lib/i18n";

type DemoTourStep = {
  id: string;
  title: string;
  body: string;
  route: string;
  cta: string;
  secondary?: string;
  icon: typeof LayoutDashboard;
  actionEvent?: "client-portal-published" | "client-portal-opened";
};

const DEMO_PROJECT_SLUG = "demo-project";
const TOUR_VERSION = 1;

type TranslationFn = ReturnType<typeof useI18n>["t"];

const getSteps = (projectSlug: string, t: TranslationFn): DemoTourStep[] => {
  const basePath = `/organisation/projects/${projectSlug}`;

  return [
    {
      id: "overview",
      title: t("demoProjectTour", "overviewTitle"),
      body: t("demoProjectTour", "overviewBody"),
      route: basePath,
      cta: t("demoProjectTour", "openOverview"),
      icon: LayoutDashboard,
    },
    {
      id: "tasks",
      title: t("demoProjectTour", "tasksTitle"),
      body: t("demoProjectTour", "tasksBody"),
      route: `${basePath}/tasks`,
      cta: t("demoProjectTour", "openTasks"),
      icon: ListTodo,
    },
    {
      id: "shopping",
      title: t("demoProjectTour", "shoppingTitle"),
      body: t("demoProjectTour", "shoppingBody"),
      route: `${basePath}/shopping-list`,
      cta: t("demoProjectTour", "openShoppingList"),
      icon: ShoppingCart,
    },
    {
      id: "moodboard",
      title: t("demoProjectTour", "moodboardTitle"),
      body: t("demoProjectTour", "moodboardBody"),
      route: `${basePath}/moodboard`,
      cta: t("demoProjectTour", "openMoodboard"),
      icon: ImageIcon,
    },
    {
      id: "labor",
      title: t("demoProjectTour", "laborTitle"),
      body: t("demoProjectTour", "laborBody"),
      route: `${basePath}/labor`,
      cta: t("demoProjectTour", "openLabor"),
      icon: Hammer,
    },
    {
      id: "contacts",
      title: t("demoProjectTour", "contactsTitle"),
      body: t("demoProjectTour", "contactsBody"),
      route: `${basePath}/contacts`,
      cta: t("demoProjectTour", "openContacts"),
      icon: SquareUserRound,
    },
    {
      id: "payments",
      title: t("demoProjectTour", "paymentsTitle"),
      body: t("demoProjectTour", "paymentsBody"),
      route: `${basePath}/payments`,
      cta: t("demoProjectTour", "openPayments"),
      icon: Wallet,
    },
    {
      id: "portal-publish",
      title: t("demoProjectTour", "portalPublishTitle"),
      body: t("demoProjectTour", "portalPublishBody"),
      route: `${basePath}/customer-panel`,
      cta: t("demoProjectTour", "openClientPortalSetup"),
      secondary: t("demoProjectTour", "clickUpdatePortal"),
      icon: Eye,
      actionEvent: "client-portal-published",
    },
    {
      id: "portal-open",
      title: t("demoProjectTour", "portalOpenTitle"),
      body: t("demoProjectTour", "portalOpenBody"),
      route: `${basePath}/customer-panel`,
      cta: t("demoProjectTour", "returnToPortalSetup"),
      secondary: t("demoProjectTour", "clickOpenPortal"),
      icon: Eye,
      actionEvent: "client-portal-opened",
    },
  ];
};

const normalizePath = (path: string) => path.replace(/\/$/, "") || "/";

export function emitDemoProjectTourEvent(eventName: DemoTourStep["actionEvent"]) {
  if (!eventName || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("myvibe:demo-project-tour", {
    detail: { eventName },
  }));
}

export function DemoProjectTour() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { project } = useProject();
  const isDemoProject = project.slug === DEMO_PROJECT_SLUG;
  const panelConfig = useQuery(
    apiAny.projects.getClientPanelConfiguration,
    isDemoProject ? { projectId: project._id } : "skip",
  );
  const hasPublishedPortal = (panelConfig?.version ?? 0) > 0;
  const storageKey = `myvibe:demo-project-tour:${TOUR_VERSION}:${project._id}`;
  const steps = useMemo(() => getSteps(project.slug, t), [project.slug, t]);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isDemoProject || typeof window === "undefined") {
      setCurrentStepId(null);
      setDismissed(true);
      setReady(true);
      return;
    }

    const saved = window.localStorage.getItem(storageKey);
    if (saved === "done" || saved === "dismissed") {
      setCurrentStepId(null);
      setDismissed(true);
      setReady(true);
      return;
    }

    const savedStep = steps.some((step) => step.id === saved) ? saved : steps[0]?.id;
    setCurrentStepId(
      savedStep === "portal-publish" && hasPublishedPortal
        ? "portal-open"
        : savedStep ?? null,
    );
    setDismissed(false);
    setReady(true);
  }, [hasPublishedPortal, isDemoProject, steps, storageKey]);

  useEffect(() => {
    if (!ready || !currentStepId || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, currentStepId);
  }, [currentStepId, ready, storageKey]);

  useEffect(() => {
    if (!isDemoProject || typeof window === "undefined") return;

    const handleTourEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ eventName?: string }>;
      const eventName = customEvent.detail?.eventName;
      const currentIndex = steps.findIndex((step) => step.id === currentStepId);
      const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

      if (!currentStep?.actionEvent || currentStep.actionEvent !== eventName) {
        return;
      }

      const nextStep = steps[currentIndex + 1];
      if (!nextStep) {
        window.localStorage.setItem(storageKey, "done");
        setDismissed(true);
        setCurrentStepId(null);
        return;
      }

      setCurrentStepId(nextStep.id);
    };

    window.addEventListener("myvibe:demo-project-tour", handleTourEvent);
    return () => {
      window.removeEventListener("myvibe:demo-project-tour", handleTourEvent);
    };
  }, [currentStepId, isDemoProject, steps, storageKey]);

  if (!ready || dismissed || !currentStepId || !isDemoProject) {
    return null;
  }

  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : steps[0];
  const isCurrentRoute = normalizePath(pathname) === normalizePath(currentStep.route);
  const progress = Math.round(((currentIndex + 1) / steps.length) * 100);
  const Icon = currentStep.icon;

  const goToNextStep = () => {
    const nextStep = steps[currentIndex + 1];
    if (!nextStep) {
      window.localStorage.setItem(storageKey, "done");
      setDismissed(true);
      setCurrentStepId(null);
      return;
    }
    setCurrentStepId(nextStep.id);
  };

  const dismissTour = () => {
    window.localStorage.setItem(storageKey, "dismissed");
    setDismissed(true);
    setCurrentStepId(null);
  };

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-border/80 bg-card p-4 text-card-foreground shadow-xl shadow-black/10">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/70 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("demoProjectTour", "demoTourProgress", {
                current: currentIndex + 1,
                total: steps.length,
              })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={dismissTour}
              className="h-7 w-7 rounded-full"
              aria-label={t("demoProjectTour", "dismissDemoTour")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="mt-1 text-base font-semibold leading-6">
            {currentStep.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {currentStep.body}
          </p>
          {currentStep.secondary && isCurrentRoute ? (
            <p className="mt-2 rounded-xl border border-primary/18 bg-primary/6 px-3 py-2 text-sm font-medium text-foreground">
              {currentStep.secondary}
            </p>
          ) : null}
        </div>
      </div>

      <Progress value={progress} className="mt-4 h-1.5" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {isCurrentRoute ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToNextStep}
            disabled={Boolean(currentStep.actionEvent)}
            className="rounded-full"
          >
            {currentStep.actionEvent
              ? t("demoProjectTour", "completeActionOnPage")
              : t("demoProjectTour", "next")}
            {!currentStep.actionEvent ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
        ) : (
          <Button asChild type="button" size="sm" className="rounded-full">
            <Link href={currentStep.route}>
              {currentStep.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("demoProjectTour", "demoOnly")}
        </div>
      </div>
    </aside>
  );
}
