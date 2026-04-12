import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppState, Project, Team, User } from "../types";
import { CONFIG } from "../config";
import LoginView from "./views/LoginView";
import TeamView from "./views/TeamView";
import ProjectView from "./views/ProjectView";
import ClipperView from "./views/ClipperView";
import Toast from "./ui/Toast";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { authenticatedFetch } from "../lib/auth";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

type LocalStorageSnapshot = {
  [STORAGE_KEYS.TOKEN]?: string;
  [STORAGE_KEYS.USER]?: string;
  [STORAGE_KEYS.TEAMS]?: string;
  [STORAGE_KEYS.SELECTED_TEAM_ID]?: string;
  [STORAGE_KEYS.SELECTED_PROJECT_ID]?: string;
};

type SessionRefreshResult =
  | { user: User; teams: Team[] }
  | { authFailed: true }
  | null;

const initialState: AppState = {
  user: null,
  teams: [],
  selectedTeam: null,
  selectedProject: null,
  sections: [],
  currentView: "login",
  isLoading: true,
};

function safeJsonParse<T>(raw: string | undefined): T | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function pickDefaultSelection(teams: Team[]): {
  team: Team | null;
  project: Project | null;
} {
  const firstTeam = teams[0] ?? null;
  const firstProject = firstTeam?.projects?.[0] ?? null;

  return { team: firstTeam, project: firstProject };
}

const App = () => {
  const [state, setState] = useState<AppState>(initialState);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  };

  const loadStorage = useCallback(async (): Promise<LocalStorageSnapshot> => {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.TEAMS,
      STORAGE_KEYS.SELECTED_TEAM_ID,
      STORAGE_KEYS.SELECTED_PROJECT_ID,
    ]);

    return data as LocalStorageSnapshot;
  }, []);

  const persistSelection = useCallback(
    async (teamId: string | null, projectId: string | null) => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SELECTED_TEAM_ID]: teamId,
        [STORAGE_KEYS.SELECTED_PROJECT_ID]: projectId,
      });
    },
    [],
  );

  const clearCachedData = useCallback(async () => {
    await chrome.storage.local.remove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.TEAMS,
      STORAGE_KEYS.SELECTED_TEAM_ID,
      STORAGE_KEYS.SELECTED_PROJECT_ID,
    ]);
  }, []);

  const refreshSession = useCallback(
    async (token: string): Promise<SessionRefreshResult> => {
      try {
        const response = await authenticatedFetch(
          `${CONFIG.API_BASE}/clipper`,
          undefined,
          {
            retryOnAuthFailure: true,
            preferredToken: token,
            allowInteractiveAuth: false,
          },
        );

        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          return null;
        }

        const data = (await response.json()) as { user?: User; teams?: Team[] };
        if (!data.user || !Array.isArray(data.teams)) {
          return null;
        }

        await chrome.storage.local.set({
          [STORAGE_KEYS.USER]: JSON.stringify(data.user),
          [STORAGE_KEYS.TEAMS]: JSON.stringify(data.teams),
        });

        return {
          user: data.user,
          teams: data.teams,
        };
      } catch (error) {
        if (error instanceof Error && error.message === "AUTH_REQUIRED") {
          return null;
        }
        return null;
      }
    },
    [],
  );

  const applySession = useCallback(
    async (user: User, teams: Team[], snapshot: LocalStorageSnapshot) => {
      const selectedTeamId = snapshot[STORAGE_KEYS.SELECTED_TEAM_ID] ?? null;

      const team = selectedTeamId
        ? (teams.find((entry) => entry._id === selectedTeamId) ?? null)
        : null;

      const selectedProjectId =
        snapshot[STORAGE_KEYS.SELECTED_PROJECT_ID] ?? null;

      const fallback = pickDefaultSelection(teams);
      const finalTeam = team ?? fallback.team;

      const project =
        selectedProjectId && finalTeam
          ? (finalTeam.projects.find(
              (entry) => entry._id === selectedProjectId,
            ) ?? null)
          : null;

      const finalProject = project ?? finalTeam?.projects?.[0] ?? null;

      const currentView =
        finalTeam && finalProject ? "clipper" : finalTeam ? "project" : "team";

      setState({
        user,
        teams,
        selectedTeam: finalTeam,
        selectedProject: finalProject,
        sections: finalProject?.sections ?? [],
        currentView,
        isLoading: false,
      });

      await persistSelection(finalTeam?._id ?? null, finalProject?._id ?? null);
    },
    [persistSelection],
  );

  useEffect(() => {
    const initialize = async () => {
      const snapshot = await loadStorage();
      const token = snapshot[STORAGE_KEYS.TOKEN];

      if (!token) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          currentView: "login",
        }));
        return;
      }

      const cachedUser = safeJsonParse<User>(snapshot[STORAGE_KEYS.USER]);
      const cachedTeams = safeJsonParse<Team[]>(snapshot[STORAGE_KEYS.TEAMS]);

      if (cachedUser && cachedTeams) {
        await applySession(cachedUser, cachedTeams, snapshot);
      } else {
        const refreshed = await refreshSession(token);
        if (!refreshed || "authFailed" in refreshed) {
          await clearCachedData();
          setState((prev) => ({
            ...prev,
            isLoading: false,
            currentView: "login",
          }));
          return;
        }

        await applySession(refreshed.user, refreshed.teams, snapshot);
      }
    };

    void initialize();
  }, [applySession, clearCachedData, loadStorage, refreshSession]);

  const handleLogin = async (user: User, teams: Team[]) => {
    const snapshot = await loadStorage();
    await applySession(user, teams, snapshot);
  };

  const handleLogout = async () => {
    await clearCachedData();

    setState({
      user: null,
      teams: [],
      selectedTeam: null,
      selectedProject: null,
      sections: [],
      currentView: "login",
      isLoading: false,
    });

    showToast("Signed out.", "info");
  };

  const handleTeamSelect = async (team: Team) => {
    await persistSelection(team._id, null);

    setState((prev) => ({
      ...prev,
      selectedTeam: team,
      selectedProject: null,
      sections: [],
      currentView: "project",
    }));
  };

  const handleProjectSelect = async (project: Project) => {
    if (!state.selectedTeam) {
      return;
    }

    await persistSelection(state.selectedTeam._id, project._id);

    setState((prev) => ({
      ...prev,
      selectedProject: project,
      sections: project.sections,
      currentView: "clipper",
    }));

    showToast(`Selected project: ${project.name}`, "success");
  };

  const handleBackToTeams = async () => {
    await persistSelection(null, null);

    setState((prev) => ({
      ...prev,
      selectedTeam: null,
      selectedProject: null,
      sections: [],
      currentView: "team",
    }));
  };

  const handleBackToProjects = async () => {
    if (!state.selectedTeam) return;

    await persistSelection(state.selectedTeam._id, null);

    setState((prev) => ({
      ...prev,
      selectedProject: null,
      sections: [],
      currentView: "project",
    }));
  };

  const loadingView = useMemo(
    () => (
      <div className="vp-shell">
        <div className="vp-content flex h-full items-center justify-center">
          <div className="clean-panel flex items-center gap-3 px-5 py-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
            <span className="text-sm font-semibold text-foreground/80">
              Loading data...
            </span>
          </div>
        </div>
      </div>
    ),
    [],
  );

  if (state.isLoading) {
    return loadingView;
  }

  return (
    <div className="vp-shell">
      <div className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.82),transparent_68%)]" />
      <div className="pointer-events-none absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(231,229,221,0.55),transparent_68%)]" />
      <div className="vp-content">
        {state.currentView === "login" && (
          <LoginView onLogin={handleLogin} showToast={showToast} />
        )}

        {state.currentView === "team" && state.user && (
          <TeamView
            teams={state.teams}
            user={state.user}
            onTeamSelect={handleTeamSelect}
            onLogout={handleLogout}
          />
        )}

        {state.currentView === "project" && state.selectedTeam && (
          <ProjectView
            team={state.selectedTeam}
            onProjectSelect={handleProjectSelect}
            onBack={handleBackToTeams}
          />
        )}

        {state.currentView === "clipper" &&
          state.user &&
          state.selectedTeam &&
          state.selectedProject && (
            <ClipperView
              team={state.selectedTeam}
              project={state.selectedProject}
              onBack={handleBackToProjects}
              showToast={showToast}
            />
          )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
};

export default App;
