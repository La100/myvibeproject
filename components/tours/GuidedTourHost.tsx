"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { apiAny } from "@/lib/convexApiAny";
import {
  GUIDED_TOUR_START_EVENT,
  advanceGuidedTourStep,
  applyPersistentGuidedTourStatus,
  defaultPersistentGuidedTourState,
  dispatchStartGuidedTour,
  getProjectTourSteps,
  getWorkspaceTourSteps,
  readLegacyPersistentGuidedTourState,
  readGuidedTourState,
  regressGuidedTourStep,
  startGuidedTour,
  stopGuidedTour,
  type LocalGuidedTourState,
  type PersistentGuidedTourState,
  type PersistentGuidedTourStatus,
  type TourId,
  type TourPlacement,
  writeGuidedTourState,
} from "@/lib/guidedTours";

type GuidedTourHostProps = {
  scope: TourId;
};

type RectSnapshot = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const CARD_WIDTH = 320;
const VIEWPORT_PADDING = 16;

function getProjectSlug(pathname: string) {
  const match = pathname.match(/^\/organisation\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

function getTooltipPosition(rect: RectSnapshot, placement: TourPlacement) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const fallbackPlacement =
    placement === "right" && rect.left + rect.width + CARD_WIDTH + 48 > viewportWidth
      ? "bottom"
      : placement === "left" && rect.left - CARD_WIDTH - 48 < 0
        ? "bottom"
        : placement === "top" && rect.top - 220 < 0
          ? "bottom"
          : placement;

  let top = rect.top;
  let left = rect.left;

  switch (fallbackPlacement) {
    case "top":
      top = rect.top - 220;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2 - 100;
      left = rect.left + rect.width + 24;
      break;
    case "left":
      top = rect.top + rect.height / 2 - 100;
      left = rect.left - CARD_WIDTH - 24;
      break;
    case "bottom":
    default:
      top = rect.top + rect.height + 24;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
      break;
  }

  top = Math.min(Math.max(top, VIEWPORT_PADDING), viewportHeight - 220 - VIEWPORT_PADDING);
  left = Math.min(Math.max(left, VIEWPORT_PADDING), viewportWidth - CARD_WIDTH - VIEWPORT_PADDING);

  return {
    top,
    left,
    resolvedPlacement: fallbackPlacement,
  };
}

function getArrowStyle(rect: RectSnapshot, placement: TourPlacement) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  switch (placement) {
    case "top":
      return {
        bottom: -6,
        left: `calc(min(max(${centerX}px - var(--tour-left), 20px), calc(100% - 20px)))`,
      };
    case "right":
      return {
        left: -6,
        top: `calc(min(max(${centerY}px - var(--tour-top), 20px), calc(100% - 20px)))`,
      };
    case "left":
      return {
        right: -6,
        top: `calc(min(max(${centerY}px - var(--tour-top), 20px), calc(100% - 20px)))`,
      };
    case "bottom":
    default:
      return {
        top: -6,
        left: `calc(min(max(${centerX}px - var(--tour-left), 20px), calc(100% - 20px)))`,
      };
  }
}

function shouldShowPrompt(
  scope: TourId,
  pathname: string,
  localState: LocalGuidedTourState,
  persistentState: PersistentGuidedTourState,
) {
  if (localState.activeTourId) {
    return false;
  }

  if (
    persistentState.completedTourIds.includes(scope) ||
    persistentState.dismissedPromptIds.includes(scope) ||
    persistentState.skippedTourIds.includes(scope)
  ) {
    return false;
  }

  if (scope === "workspace") {
    return pathname === "/organisation";
  }

  const projectSlug = getProjectSlug(pathname);
  return Boolean(projectSlug && pathname === `/organisation/projects/${projectSlug}`);
}

export function GuidedTourHost({ scope }: GuidedTourHostProps) {
  const router = useRouter();
  const pathname = usePathname();
  const backendPersistentTourState = useQuery(apiAny.guidedTours.getState);
  const markGuidedTourStatus = useMutation(apiAny.guidedTours.markStatus);
  const replaceGuidedTourState = useMutation(apiAny.guidedTours.replaceState);
  const [mounted, setMounted] = useState(false);
  const [tourState, setTourState] = useState<LocalGuidedTourState | null>(null);
  const [persistentTourState, setPersistentTourState] = useState<PersistentGuidedTourState | null>(null);
  const [targetRect, setTargetRect] = useState<RectSnapshot | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  const lastScrolledStepRef = useRef<string | null>(null);
  const routeRedirectRef = useRef<string | null>(null);
  const hasMigratedLegacyStateRef = useRef(false);

  const projectSlug = useMemo(() => getProjectSlug(pathname), [pathname]);

  const steps = useMemo(() => {
    if (!tourState?.activeTourId) {
      return [];
    }

    if (tourState.activeTourId === "workspace") {
      return getWorkspaceTourSteps();
    }

    if (tourState.activeTourId === "project" && projectSlug) {
      return getProjectTourSteps(projectSlug);
    }

    return [];
  }, [projectSlug, tourState?.activeTourId]);

  const currentStep = steps[tourState?.activeStepIndex ?? 0] ?? null;

  useEffect(() => {
    if (backendPersistentTourState !== undefined) {
      setPersistentTourState(backendPersistentTourState);
    }
  }, [backendPersistentTourState]);

  useEffect(() => {
    if (!mounted || backendPersistentTourState === undefined || hasMigratedLegacyStateRef.current) {
      return;
    }

    const hasBackendState =
      backendPersistentTourState.completedTourIds.length > 0 ||
      backendPersistentTourState.skippedTourIds.length > 0 ||
      backendPersistentTourState.dismissedPromptIds.length > 0;

    if (hasBackendState) {
      hasMigratedLegacyStateRef.current = true;
      return;
    }

    const legacyState = readLegacyPersistentGuidedTourState();
    const hasLegacyState =
      legacyState.completedTourIds.length > 0 ||
      legacyState.skippedTourIds.length > 0 ||
      legacyState.dismissedPromptIds.length > 0;

    if (!hasLegacyState) {
      hasMigratedLegacyStateRef.current = true;
      return;
    }

    hasMigratedLegacyStateRef.current = true;
    setPersistentTourState(legacyState);

    void replaceGuidedTourState({ state: legacyState }).catch(() => {
      setPersistentTourState(backendPersistentTourState);
      toast.error("Could not migrate guided tour state.");
      hasMigratedLegacyStateRef.current = false;
    });
  }, [backendPersistentTourState, mounted, replaceGuidedTourState]);

  useEffect(() => {
    setMounted(true);
    setTourState(readGuidedTourState());

    const syncState = () => setTourState(readGuidedTourState());
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "myvibeproject-guided-tour-state") {
        syncState();
      }
    };
    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<{ tourId: TourId }>).detail;
      if (!detail?.tourId) {
        return;
      }

      startGuidedTour(detail.tourId);
      syncState();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncState);
    window.addEventListener(GUIDED_TOUR_START_EVENT, handleStart as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncState);
      window.removeEventListener(GUIDED_TOUR_START_EVENT, handleStart as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!mounted || !tourState?.activeTourId || !currentStep) {
      return;
    }

    if (pathname === currentStep.route) {
      routeRedirectRef.current = null;
      return;
    }

    if (routeRedirectRef.current === currentStep.route) {
      return;
    }

    routeRedirectRef.current = currentStep.route;
    router.push(currentStep.route);
  }, [currentStep, mounted, pathname, router, tourState?.activeTourId]);

  useEffect(() => {
    if (!mounted || !tourState?.activeTourId || !currentStep || pathname !== currentStep.route) {
      setTargetReady(false);
      setTargetRect(null);
      return;
    }

    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const syncTarget = () => {
      const target = document.querySelector(currentStep.selector) as HTMLElement | null;
      if (!target) {
        setTargetReady(false);
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetReady(true);
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });

      if (lastScrolledStepRef.current !== currentStep.id) {
        target.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "smooth",
        });
        lastScrolledStepRef.current = currentStep.id;
      }

      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => {
        animationFrame = window.requestAnimationFrame(syncTarget);
      });
      resizeObserver.observe(target);
    };

    animationFrame = window.requestAnimationFrame(syncTarget);
    window.addEventListener("resize", syncTarget);
    window.addEventListener("scroll", syncTarget, true);

    mutationObserver = new MutationObserver(() => {
      animationFrame = window.requestAnimationFrame(syncTarget);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", syncTarget);
      window.removeEventListener("scroll", syncTarget, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [currentStep, mounted, pathname, tourState?.activeTourId]);

  const syncAndSetState = (nextState: LocalGuidedTourState) => {
    writeGuidedTourState(nextState);
    setTourState(nextState);
  };

  const persistTourStatus = async (
    tourId: TourId,
    status: PersistentGuidedTourStatus,
  ) => {
    const previousState = persistentTourState ?? backendPersistentTourState ?? defaultPersistentGuidedTourState;
    const optimisticState = applyPersistentGuidedTourStatus(previousState, tourId, status);
    setPersistentTourState(optimisticState);

    try {
      const savedState = await markGuidedTourStatus({ tourId, status });
      setPersistentTourState(savedState);
      return savedState;
    } catch (error) {
      setPersistentTourState(previousState);
      toast.error("Could not save guided tour preference.");
      throw error;
    }
  };

  const handleStartTour = (tourId: TourId) => {
    syncAndSetState(startGuidedTour(tourId));
  };

  const handleDismissPrompt = async (tourId: TourId) => {
    await persistTourStatus(tourId, "dismissed");
  };

  const handleSkipTour = async () => {
    if (!tourState?.activeTourId) {
      return;
    }

    await persistTourStatus(tourState.activeTourId, "skipped");
    syncAndSetState(stopGuidedTour());
    setTargetRect(null);
    setTargetReady(false);
  };

  const handleNext = async () => {
    if (!tourState?.activeTourId || !currentStep) {
      return;
    }

    if ((tourState.activeStepIndex ?? 0) >= steps.length - 1) {
      await persistTourStatus(tourState.activeTourId, "completed");
      syncAndSetState(stopGuidedTour());
      setTargetRect(null);
      setTargetReady(false);
      return;
    }

    syncAndSetState(advanceGuidedTourStep());
  };

  const handleBack = () => {
    if (!tourState?.activeTourId || (tourState.activeStepIndex ?? 0) === 0) {
      return;
    }

    syncAndSetState(regressGuidedTourStep());
  };

  const promptVisible =
    mounted &&
    tourState &&
    persistentTourState &&
    shouldShowPrompt(scope, pathname, tourState, persistentTourState);
  const activeTourVisible = mounted && tourState?.activeTourId === scope;

  if (!mounted) {
    return null;
  }

  return (
    <>
      {promptVisible
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4">
              <div className="w-full max-w-md rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-2xl">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {scope === "workspace" ? "Workspace tour" : "Project tour"}
                  </p>
                  <h2 className="clean-title text-2xl font-medium tracking-tight">
                    {scope === "workspace" ? "Take a quick workspace tour" : "Take a quick project tour"}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {scope === "workspace"
                      ? "A short guided walkthrough will show where projects start, where settings live, and how the workspace is organized."
                      : "A short guided walkthrough will take you through overview, customer portal, tasks, moodboard, AI, payments, and files."}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => handleStartTour(scope)} className="rounded-xl">
                    Start tour
                  </Button>
                  <Button variant="outline" onClick={() => void handleDismissPrompt(scope)} className="rounded-xl">
                    Skip for now
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {activeTourVisible
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[130]">
              {targetRect ? (
                <div
                  className="absolute rounded-2xl border border-primary/70 shadow-[0_0_0_9999px_rgba(12,10,9,0.55)] transition-all duration-200"
                  style={{
                    top: targetRect.top - 8,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16,
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-black/45" />
              )}

              {currentStep ? (
                targetReady && targetRect ? (
                  (() => {
                    const position = getTooltipPosition(targetRect, currentStep.placement ?? "bottom");
                    const arrowStyle = getArrowStyle(targetRect, position.resolvedPlacement);
                    return (
                      <div
                        className="pointer-events-auto absolute w-[320px] rounded-[1.5rem] border border-border/80 bg-background p-5 shadow-2xl"
                        style={
                          {
                            top: position.top,
                            left: position.left,
                            ["--tour-left" as string]: `${position.left}px`,
                            ["--tour-top" as string]: `${position.top}px`,
                          } as CSSProperties
                        }
                      >
                        <div
                          className="absolute h-3 w-3 rotate-45 border border-border/80 bg-background"
                          style={arrowStyle}
                        />
                        <div className="space-y-3">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Step {(tourState?.activeStepIndex ?? 0) + 1} of {steps.length}
                          </p>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold tracking-tight text-foreground">
                              {currentStep.title}
                            </h3>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {currentStep.description}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={(tourState?.activeStepIndex ?? 0) === 0}
                            className="rounded-xl"
                          >
                            Back
                          </Button>
                          <Button onClick={() => void handleNext()} className="rounded-xl">
                            {(tourState?.activeStepIndex ?? 0) >= steps.length - 1 ? "Finish" : "Next"}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => void handleSkipTour()}
                            className="rounded-xl text-muted-foreground"
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="pointer-events-auto absolute inset-x-0 top-8 mx-auto w-full max-w-sm rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-2xl">
                    <div className="flex items-start gap-3">
                      <Spinner fullHeight={false} className="py-0" iconClassName="size-4" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{currentStep.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Loading the next step and waiting for the interface to settle.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" onClick={() => void handleSkipTour()} className="rounded-xl">
                        Skip
                      </Button>
                    </div>
                  </div>
                )
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function GuidedTourLauncher({
  tourId,
  label,
  variant = "outline",
  className,
}: {
  tourId: TourId;
  label: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={() => dispatchStartGuidedTour(tourId)}
    >
      {label}
    </Button>
  );
}
