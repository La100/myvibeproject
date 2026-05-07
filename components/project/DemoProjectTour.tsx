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

const getSteps = (projectSlug: string): DemoTourStep[] => {
  const basePath = `/organisation/projects/${projectSlug}`;

  return [
    {
      id: "overview",
      title: "Start with the project snapshot",
      body: "Review the timeline, budget signals, recent activity, and the prepared demo data before opening the deeper modules.",
      route: basePath,
      cta: "Open overview",
      icon: LayoutDashboard,
    },
    {
      id: "tasks",
      title: "Track architecture and construction work",
      body: "Tasks show the design, permit, procurement, and site milestones that drive this demo house project.",
      route: `${basePath}/tasks`,
      cta: "Open tasks",
      icon: ListTodo,
    },
    {
      id: "shopping",
      title: "Review the shopping list",
      body: "The shopping list is filled with product images, suppliers, prices, statuses, and client decisions.",
      route: `${basePath}/shopping-list`,
      cta: "Open shopping list",
      icon: ShoppingCart,
    },
    {
      id: "moodboard",
      title: "Inspect the visual direction",
      body: "Moodboard sections contain concept, material, furniture, and lighting imagery reused from the landing visuals.",
      route: `${basePath}/moodboard`,
      cta: "Open moodboard",
      icon: ImageIcon,
    },
    {
      id: "labor",
      title: "Check labor and site work",
      body: "Labor breaks down pre-construction, shell construction, and interior fit-out costs with planned dates.",
      route: `${basePath}/labor`,
      cta: "Open labor",
      icon: Hammer,
    },
    {
      id: "contacts",
      title: "See the project team",
      body: "Contacts include the architect, structural engineer, contractor, supplier, and electrical subcontractor.",
      route: `${basePath}/contacts`,
      cta: "Open contacts",
      icon: SquareUserRound,
    },
    {
      id: "payments",
      title: "Review payments and budget",
      body: "Payments show deposit, permit documentation, construction drawings, and site supervision installments.",
      route: `${basePath}/payments`,
      cta: "Open payments",
      icon: Wallet,
    },
    {
      id: "portal-publish",
      title: "Publish the client portal",
      body: "All demo sections are enabled. Click Update portal so the client-facing snapshot is created from the project data.",
      route: `${basePath}/customer-panel`,
      cta: "Open client portal setup",
      secondary: "Click Update portal on this page.",
      icon: Eye,
      actionEvent: "client-portal-published",
    },
    {
      id: "portal-open",
      title: "Open the client view",
      body: "After publishing, open the portal to see the project as Emily Carter would see it.",
      route: `${basePath}/customer-panel`,
      cta: "Return to portal setup",
      secondary: "Click Open portal on this page.",
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
  const { project } = useProject();
  const isDemoProject = project.slug === DEMO_PROJECT_SLUG;
  const panelConfig = useQuery(
    apiAny.projects.getClientPanelConfiguration,
    isDemoProject ? { projectId: project._id } : "skip",
  );
  const hasPublishedPortal = (panelConfig?.version ?? 0) > 0;
  const storageKey = `myvibe:demo-project-tour:${TOUR_VERSION}:${project._id}`;
  const steps = useMemo(() => getSteps(project.slug), [project.slug]);
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
              Demo tour {currentIndex + 1}/{steps.length}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={dismissTour}
              className="h-7 w-7 rounded-full"
              aria-label="Dismiss demo tour"
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
            {currentStep.actionEvent ? "Complete action on page" : "Next"}
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
          Demo only
        </div>
      </div>
    </aside>
  );
}
