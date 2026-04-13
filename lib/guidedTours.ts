export type TourId = "workspace" | "project";

export type TourPlacement = "top" | "right" | "bottom" | "left";

export type TourStep = {
  id: string;
  route: string;
  selector: string;
  title: string;
  description: string;
  placement?: TourPlacement;
};

export type LocalGuidedTourState = {
  activeTourId: TourId | null;
  activeStepIndex: number;
};

export type PersistentGuidedTourState = {
  completedTourIds: TourId[];
  skippedTourIds: TourId[];
  dismissedPromptIds: TourId[];
};

export type PersistentGuidedTourStatus = "completed" | "skipped" | "dismissed";

export const GUIDED_TOUR_STATE_KEY = "myvibeproject-guided-tour-state";
export const GUIDED_TOUR_START_EVENT = "myvibeproject:start-guided-tour";

export const defaultLocalGuidedTourState: LocalGuidedTourState = {
  activeTourId: null,
  activeStepIndex: 0,
};

export const defaultPersistentGuidedTourState: PersistentGuidedTourState = {
  completedTourIds: [],
  skippedTourIds: [],
  dismissedPromptIds: [],
};

export function applyPersistentGuidedTourStatus(
  state: PersistentGuidedTourState,
  tourId: TourId,
  status: PersistentGuidedTourStatus,
): PersistentGuidedTourState {
  const nextState: PersistentGuidedTourState = {
    completedTourIds: state.completedTourIds.filter((id) => id !== tourId),
    skippedTourIds: state.skippedTourIds.filter((id) => id !== tourId),
    dismissedPromptIds: state.dismissedPromptIds.filter((id) => id !== tourId),
  };

  if (status === "completed") {
    nextState.completedTourIds.push(tourId);
  } else if (status === "skipped") {
    nextState.skippedTourIds.push(tourId);
  } else {
    nextState.dismissedPromptIds.push(tourId);
  }

  return nextState;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readGuidedTourState(): LocalGuidedTourState {
  if (!canUseStorage()) {
    return defaultLocalGuidedTourState;
  }

  const rawValue = window.localStorage.getItem(GUIDED_TOUR_STATE_KEY);
  if (!rawValue) {
    return defaultLocalGuidedTourState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LocalGuidedTourState>;
    return {
      activeTourId: parsed.activeTourId ?? null,
      activeStepIndex: parsed.activeStepIndex ?? 0,
    };
  } catch {
    return defaultLocalGuidedTourState;
  }
}

export function readLegacyPersistentGuidedTourState(): PersistentGuidedTourState {
  if (!canUseStorage()) {
    return defaultPersistentGuidedTourState;
  }

  const rawValue = window.localStorage.getItem(GUIDED_TOUR_STATE_KEY);
  if (!rawValue) {
    return defaultPersistentGuidedTourState;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistentGuidedTourState>;
    return {
      completedTourIds: Array.isArray(parsed.completedTourIds) ? parsed.completedTourIds : [],
      skippedTourIds: Array.isArray(parsed.skippedTourIds) ? parsed.skippedTourIds : [],
      dismissedPromptIds: Array.isArray(parsed.dismissedPromptIds) ? parsed.dismissedPromptIds : [],
    };
  } catch {
    return defaultPersistentGuidedTourState;
  }
}

export function writeGuidedTourState(nextState: LocalGuidedTourState) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(GUIDED_TOUR_STATE_KEY, JSON.stringify(nextState));
}

export function updateGuidedTourState(
  updater: (current: LocalGuidedTourState) => LocalGuidedTourState,
) {
  const nextState = updater(readGuidedTourState());
  writeGuidedTourState(nextState);
  return nextState;
}

export function startGuidedTour(tourId: TourId) {
  return updateGuidedTourState((current) => ({
    ...current,
    activeTourId: tourId,
    activeStepIndex: 0,
  }));
}

export function stopGuidedTour() {
  return updateGuidedTourState((current) => ({
    ...current,
    activeTourId: null,
    activeStepIndex: 0,
  }));
}

export function advanceGuidedTourStep() {
  return updateGuidedTourState((current) => ({
    ...current,
    activeStepIndex: current.activeStepIndex + 1,
  }));
}

export function regressGuidedTourStep() {
  return updateGuidedTourState((current) => ({
    ...current,
    activeStepIndex: Math.max(0, current.activeStepIndex - 1),
  }));
}

export function dispatchStartGuidedTour(tourId: TourId) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(GUIDED_TOUR_START_EVENT, {
      detail: { tourId },
    }),
  );
}

export function getWorkspaceTourSteps(): TourStep[] {
  return [
    {
      id: "workspace-projects",
      route: "/organisation",
      selector: '[data-tour="workspace-projects-section"]',
      title: "Projects hub",
      description: "This is your workspace home. Every project, active stream, and next action starts here.",
      placement: "bottom",
    },
    {
      id: "workspace-create-project",
      route: "/organisation",
      selector: '[data-tour="workspace-create-project"]',
      title: "Create project",
      description: "Use this CTA to open a new workspace where tasks, files, moodboards, and AI all live together.",
      placement: "left",
    },
    {
      id: "workspace-org-switcher",
      route: "/organisation",
      selector: '[data-tour="workspace-org-switcher"]',
      title: "Organization switcher",
      description: "Switch between company spaces here. The active organization controls projects, billing, and members.",
      placement: "right",
    },
    {
      id: "workspace-settings",
      route: "/organisation",
      selector: '[data-tour="workspace-settings-link"]',
      title: "Workspace settings",
      description: "This is where you update organization image, team defaults, and the rest of the workspace configuration.",
      placement: "right",
    },
  ];
}

export function getProjectTourSteps(projectSlug: string): TourStep[] {
  const projectBase = `/organisation/projects/${projectSlug}`;

  return [
    {
      id: "project-overview",
      route: projectBase,
      selector: '[data-tour="project-overview-root"]',
      title: "Project overview",
      description: "This is the command view for the whole project. Come here when you need a fast read on status and scope.",
      placement: "bottom",
    },
    {
      id: "project-customer-portal",
      route: `${projectBase}/customer-panel`,
      selector: '[data-tour="project-nav-customer-portal"]',
      title: "Customer portal",
      description:
        "This is the client-facing layer of the project. Use it to share progress, align expectations, and keep communication structured.",
      placement: "right",
    },
    {
      id: "project-tasks",
      route: `${projectBase}/tasks`,
      selector: '[data-tour="project-tasks-add-button"]',
      title: "Tasks drive execution",
      description: "This is where execution happens. Create and close tasks here to keep the project moving forward.",
      placement: "bottom",
    },
    {
      id: "project-moodboard",
      route: `${projectBase}/moodboard`,
      selector: '[data-tour="project-moodboard-add-section"]',
      title: "Moodboard for references",
      description: "Collect reference sections here and turn loose inspiration into something the team can work from.",
      placement: "bottom",
    },
    {
      id: "project-ai",
      route: `${projectBase}/ai`,
      selector: '[data-tour="project-ai-root"]',
      title: "AI assistant",
      description: "Use the assistant to plan, reason, and move faster inside the project instead of working in disconnected tools.",
      placement: "left",
    },
    {
      id: "project-payments",
      route: `${projectBase}/payments`,
      selector: '[data-tour="project-nav-payments"]',
      title: "Payments and cashflow",
      description:
        "Track installments, paid vs outstanding amounts, and keep delivery aligned with financial execution.",
      placement: "right",
    },
    {
      id: "project-files",
      route: `${projectBase}/files`,
      selector: '[data-tour="project-files-upload"]',
      title: "Files and source material",
      description: "Upload source files here so the whole project stays attached to the same execution context.",
      placement: "bottom",
    },
  ];
}
