"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLoadingState } from "@/components/ui/loading-state";
import { Progress } from "@/components/ui/progress";
import { apiAny } from "@/lib/convexApiAny";
import { selectOrganizationUrl } from "@/lib/authRedirects";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

const BOOTSTRAP_RETRY_DELAY_MS = 1_000;
const BOOTSTRAP_FATAL_AFTER_MS = 45_000;

const isSyncPendingResult = (
  result: unknown,
): result is { status: "sync_pending"; reason: string } =>
  Boolean(
    result &&
      typeof result === "object" &&
      "status" in result &&
      result.status === "sync_pending",
  );

function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-2 text-center">
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Button onClick={onRetry}>{retryLabel}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceSetupProgress({
  value,
  accountLabel,
  workspaceLabel,
}: {
  value: number;
  accountLabel: string;
  workspaceLabel: string;
}) {
  return (
    <div className="flex w-full max-w-[280px] flex-col gap-2 pt-1">
      <Progress
        value={value}
        className="h-2 bg-muted/70 shadow-inner"
        indicatorClassName="bg-gradient-to-r from-foreground via-primary to-foreground transition-all duration-700 ease-out"
      />
      <div className="flex justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>{accountLabel}</span>
        <span>{workspaceLabel}</span>
      </div>
    </div>
  );
}

export function PostAuthRouter() {
  const { t } = useI18n();
  const router = useRouter();
  const {
    isLoaded: isAuthLoaded,
    isSignedIn,
    orgId: activeClerkOrgId,
  } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const { organization, isLoaded: isOrganizationLoaded } = useOrganization();
  const activeWorkspaceOrgId =
    isAuthLoaded &&
    isSignedIn &&
    organization?.id &&
    activeClerkOrgId === organization.id
      ? organization.id
      : null;
  const ensureCurrentUserTeamMembership = useMutation(
    apiAny.teamMembership.ensureCurrentUserTeamMembership,
  );
  const teamSettings = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    activeWorkspaceOrgId ? { clerkOrgId: activeWorkspaceOrgId } : "skip",
  );
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const bootstrappedOrgIdRef = useRef<string | null>(null);
  const bootstrapStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthLoaded || !isOrganizationLoaded) {
      return;
    }

    if (!isSignedIn || !organization?.id) {
      router.replace(selectOrganizationUrl);
    }
  }, [isAuthLoaded, isOrganizationLoaded, isSignedIn, organization?.id, router]);

  useEffect(() => {
    bootstrapStartedAtRef.current = null;
    bootstrappedOrgIdRef.current = null;
    setBootstrapError(null);
    setBootstrapAttempt(0);
  }, [organization?.id]);

  useEffect(() => {
    if (
      !activeWorkspaceOrgId ||
      teamSettings !== null ||
      isConvexAuthLoading ||
      !isConvexAuthenticated ||
      bootstrappedOrgIdRef.current === activeWorkspaceOrgId
    ) {
      return;
    }

    let cancelled = false;
    bootstrapStartedAtRef.current ??= Date.now();
    bootstrappedOrgIdRef.current = activeWorkspaceOrgId;
    setBootstrapError(null);

    const retryBootstrap = () => {
      const bootstrapStartedAt = bootstrapStartedAtRef.current ?? Date.now();
      const elapsedMs = Date.now() - bootstrapStartedAt;
      if (elapsedMs >= BOOTSTRAP_FATAL_AFTER_MS) {
        setBootstrapError(t("workspaceSetup", "setupTakingLong"));
        return;
      }

      window.setTimeout(() => {
        if (!cancelled) {
          setBootstrapAttempt((attempt) => attempt + 1);
        }
      }, BOOTSTRAP_RETRY_DELAY_MS);
    };

    void ensureCurrentUserTeamMembership({
      clerkOrgId: activeWorkspaceOrgId,
      orgName: organization?.name,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (isSyncPendingResult(result)) {
          bootstrappedOrgIdRef.current = null;
          retryBootstrap();
        }
      })
      .catch((error) => {
      if (cancelled) {
        return;
      }
      bootstrappedOrgIdRef.current = null;
      console.error("Failed to bootstrap workspace membership", error);
      setBootstrapError(toUserFacingErrorMessage(error));
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeWorkspaceOrgId,
    bootstrapAttempt,
    ensureCurrentUserTeamMembership,
    isConvexAuthenticated,
    isConvexAuthLoading,
    organization?.name,
    teamSettings,
    t,
  ]);

  useEffect(() => {
    if (!organization?.id || !teamSettings) {
      return;
    }

    bootstrapStartedAtRef.current = null;
    router.replace("/organisation");
  }, [organization?.id, router, teamSettings]);

  const loadingDescription = useMemo(() => {
    if (!isAuthLoaded || !isOrganizationLoaded) {
      return t("workspaceSetup", "loadingSession");
    }
    if (!organization?.id) {
      return t("workspaceSetup", "loadingSelection");
    }
    if (isConvexAuthLoading || !isConvexAuthenticated) {
      return t("workspaceSetup", "loadingConnecting");
    }
    if (!activeWorkspaceOrgId) {
      return t("workspaceSetup", "loadingConfirming");
    }
    if (teamSettings === null) {
      return t("workspaceSetup", "loadingFinalizing");
    }
    return t("workspaceSetup", "loadingOpening");
  }, [
    activeWorkspaceOrgId,
    isAuthLoaded,
    isConvexAuthenticated,
    isConvexAuthLoading,
    isOrganizationLoaded,
    organization?.id,
    teamSettings,
    t,
  ]);
  const workspaceSetupProgress = useMemo(() => {
    if (!isAuthLoaded || !isOrganizationLoaded) {
      return 18;
    }
    if (!organization?.id) {
      return 32;
    }
    if (isConvexAuthLoading || !isConvexAuthenticated) {
      return 48;
    }
    if (!activeWorkspaceOrgId) {
      return 64;
    }
    if (teamSettings === null) {
      return 78;
    }
    return 96;
  }, [
    activeWorkspaceOrgId,
    isAuthLoaded,
    isConvexAuthenticated,
    isConvexAuthLoading,
    isOrganizationLoaded,
    organization?.id,
    teamSettings,
  ]);

  if (bootstrapError) {
    return (
      <ErrorState
        title={t("workspaceSetup", "errorTitle")}
        description={bootstrapError}
        retryLabel={t("workspaceSetup", "tryAgain")}
        onRetry={() => {
          setBootstrapError(null);
          bootstrappedOrgIdRef.current = null;
          setBootstrapAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }

  return (
    <AppLoadingState
      variant="section"
      title={t("workspaceSetup", "creatingWorkspace")}
      description={loadingDescription}
      contentClassName="max-w-md gap-5"
      showBrand
    >
      <WorkspaceSetupProgress
        value={workspaceSetupProgress}
        accountLabel={t("workspaceSetup", "progressAccount")}
        workspaceLabel={t("workspaceSetup", "progressWorkspace")}
      />
    </AppLoadingState>
  );
}
