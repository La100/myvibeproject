import { useCallback, useEffect, useState } from "react";
import type { Team, User } from "../../types";
import { CONFIG } from "../../config";
import { ACTIONS } from "../../lib/messages";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { useI18n } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";

interface LoginViewProps {
  onLogin: (user: User, teams: Team[]) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

type InitiateAuthResponse = {
  success?: boolean;
  error?: string;
};

const LoginView = ({ onLogin, showToast }: LoginViewProps) => {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  const verifyTokenAndLogin = useCallback(
    async (token: string): Promise<boolean> => {
      setIsLoading(true);

      try {
        const response = await fetch(`${CONFIG.API_BASE}/clipper`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          let errorMessage = t("signInFailed");
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          if (payload?.message) {
            errorMessage = payload.message;
          }
          showToast(errorMessage, "error");
          await chrome.storage.local.remove([
            STORAGE_KEYS.TOKEN,
            STORAGE_KEYS.TOKEN_TIMESTAMP,
          ]);
          return false;
        }

        const data = (await response.json()) as { user?: User; teams?: Team[] };
        if (data.user && Array.isArray(data.teams)) {
          onLogin(data.user, data.teams);
          showToast(t("signedIn"), "success");
          return true;
        }

        showToast(t("invalidServerResponse"), "error");
        return false;
      } catch {
        showToast(t("couldNotConnectServer"), "error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [onLogin, showToast, t],
  );

  const pollForSyncedToken = useCallback(
    async (baselineToken: string | null, baselineTimestamp: number | null) => {
      const timeoutAt = Date.now() + 25_000;
      let seenToken = baselineToken;
      let seenTimestamp = baselineTimestamp;

      while (Date.now() < timeoutAt) {
        const snapshot = await chrome.storage.local.get([
          STORAGE_KEYS.TOKEN,
          STORAGE_KEYS.TOKEN_TIMESTAMP,
        ]);
        const token =
          typeof snapshot[STORAGE_KEYS.TOKEN] === "string"
            ? snapshot[STORAGE_KEYS.TOKEN]
            : null;
        const timestamp =
          typeof snapshot[STORAGE_KEYS.TOKEN_TIMESTAMP] === "number"
            ? snapshot[STORAGE_KEYS.TOKEN_TIMESTAMP]
            : null;

        const tokenChanged = token !== seenToken || timestamp !== seenTimestamp;
        if (token && tokenChanged) {
          seenToken = token;
          seenTimestamp = timestamp;
          const success = await verifyTokenAndLogin(token);
          if (success) {
            return;
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }

      setIsLoading(false);
      showToast(t("signInTimedOut"), "error");
    },
    [showToast, t, verifyTokenAndLogin],
  );

  useEffect(() => {
    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return;

      const tokenChange = changes[STORAGE_KEYS.TOKEN];
      if (typeof tokenChange?.newValue === "string" && tokenChange.newValue) {
        void verifyTokenAndLogin(tokenChange.newValue);
      }
    };

    const runtimeListener = (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "action" in message &&
        (message as { action?: string }).action === ACTIONS.AUTH_COMPLETED
      ) {
        void chrome.storage.local.get([STORAGE_KEYS.TOKEN]).then((result) => {
          const token = result[STORAGE_KEYS.TOKEN];
          if (typeof token === "string") {
            void verifyTokenAndLogin(token);
            return;
          }
        });
      }
    };

    chrome.storage.onChanged.addListener(storageListener);
    chrome.runtime.onMessage.addListener(runtimeListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
      chrome.runtime.onMessage.removeListener(runtimeListener);
    };
  }, [verifyTokenAndLogin]);

  const handleSyncFromApp = async () => {
    setIsLoading(true);
    showToast(t("finishSignIn"), "info");

    const baseline = await chrome.storage.local.get([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
    ]);
    const baselineToken =
      typeof baseline[STORAGE_KEYS.TOKEN] === "string"
        ? baseline[STORAGE_KEYS.TOKEN]
        : null;
    const baselineTimestamp =
      typeof baseline[STORAGE_KEYS.TOKEN_TIMESTAMP] === "number"
        ? baseline[STORAGE_KEYS.TOKEN_TIMESTAMP]
        : null;

    chrome.runtime.sendMessage(
      { action: ACTIONS.INITIATE_AUTH },
      (response?: InitiateAuthResponse) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          showToast(t("couldNotStartSignIn"), "error");
          setIsLoading(false);
          return;
        }

        if (!response?.success) {
          showToast(response?.error ?? t("couldNotStartSignIn"), "error");
          setIsLoading(false);
          return;
        }

        void pollForSyncedToken(baselineToken, baselineTimestamp);
      },
    );
  };

  const handleOpenMainApp = () => {
    void chrome.tabs.create({ url: CONFIG.MAIN_APP_URL });
  };

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-6">
      <div className="mb-4 space-y-2">
        <span className="vp-chip">MyVibeProject Clipper</span>
        <h1 className="clean-title text-2xl font-medium leading-tight text-foreground">
          {t("addProductsHeadline").split("\n").map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("addProductsIntro")}
        </p>
      </div>

      <Card className="clean-panel flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>{t("signIn")}</CardTitle>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <CardDescription>
            {t("signInDescription")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <Button
            className="w-full"
            onClick={handleSyncFromApp}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("syncSession")}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleOpenMainApp}
          >
            {t("openMainApp")}
          </Button>

          <div className="mt-2 rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-[11px] text-muted-foreground">
            Version {CONFIG.VERSION}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginView;
