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

const BOOTSTRAP_RETRY_DELAY_MS = 1_000;

const isTransientActiveOrganizationSyncError = (error: unknown) => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error &&
            typeof error === "object" &&
            "data" in error &&
            typeof (error as { data?: { message?: unknown } }).data?.message === "string"
          ? (error as { data: { message: string } }).data.message
          : "";
  const message = `${rawMessage}\n${toUserFacingErrorMessage(error)}`.toLowerCase();
  return (
    message.includes("active organization is still syncing") ||
    message.includes("selected organization does not match active auth context") ||
    message.includes("server error called by client") ||
    message.includes("your workspace is still syncing")
  );
};

function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-2 text-center">
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Button onClick={onRetry}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceSetupProgress({ value }: { value: number }) {
  return (
    <div className="flex w-full max-w-[280px] flex-col gap-2 pt-1">
      <Progress
        value={value}
        className="h-2 bg-muted/70 shadow-inner"
        indicatorClassName="bg-gradient-to-r from-foreground via-primary to-foreground transition-all duration-700 ease-out"
      />
      <div className="flex justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>Account</span>
        <span>Workspace</span>
      </div>
    </div>
  );
}

export function PostAuthRouter() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const { organization, isLoaded: isOrganizationLoaded } = useOrganization();
  const ensureCurrentUserTeamMembership = useMutation(
    apiAny.teamMembership.ensureCurrentUserTeamMembership,
  );
  const teamSettings = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const bootstrappedOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthLoaded || !isOrganizationLoaded) {
      return;
    }

    if (!isSignedIn || !organization?.id) {
      router.replace(selectOrganizationUrl);
    }
  }, [isAuthLoaded, isOrganizationLoaded, isSignedIn, organization?.id, router]);

  useEffect(() => {
    if (
      !organization?.id ||
      teamSettings !== null ||
      isConvexAuthLoading ||
      !isConvexAuthenticated ||
      bootstrappedOrgIdRef.current === organization.id
    ) {
      return;
    }

    let cancelled = false;
    bootstrappedOrgIdRef.current = organization.id;
    setBootstrapError(null);

    void ensureCurrentUserTeamMembership({
      clerkOrgId: organization.id,
      orgName: organization.name,
    }).catch((error) => {
      if (cancelled) {
        return;
      }
      bootstrappedOrgIdRef.current = null;
      if (isTransientActiveOrganizationSyncError(error)) {
        window.setTimeout(() => {
          if (!cancelled) {
            setBootstrapAttempt((attempt) => attempt + 1);
          }
        }, BOOTSTRAP_RETRY_DELAY_MS);
        return;
      }
      console.error("Failed to bootstrap workspace membership", error);
      setBootstrapError(toUserFacingErrorMessage(error));
    });

    return () => {
      cancelled = true;
    };
  }, [
    bootstrapAttempt,
    ensureCurrentUserTeamMembership,
    isConvexAuthenticated,
    isConvexAuthLoading,
    organization?.id,
    organization?.name,
    teamSettings,
  ]);

  useEffect(() => {
    if (!organization?.id || !teamSettings) {
      return;
    }

    router.replace("/organisation");
  }, [organization?.id, router, teamSettings]);

  const loadingDescription = useMemo(() => {
    if (!isAuthLoaded || !isOrganizationLoaded) {
      return "Loading your session.";
    }
    if (!organization?.id) {
      return "Opening workspace selection.";
    }
    if (isConvexAuthLoading || !isConvexAuthenticated) {
      return "Connecting your session to the workspace.";
    }
    if (teamSettings === null) {
      return "Finalizing your workspace access.";
    }
    return "Opening your workspace.";
  }, [
    isAuthLoaded,
    isConvexAuthenticated,
    isConvexAuthLoading,
    isOrganizationLoaded,
    organization?.id,
    teamSettings,
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
    if (teamSettings === null) {
      return 78;
    }
    return 96;
  }, [
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
        title="Workspace setup needs attention"
        description={bootstrapError}
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
      title="Creating your workspace"
      description={loadingDescription}
      contentClassName="max-w-md gap-5"
      showBrand
    >
      <WorkspaceSetupProgress value={workspaceSetupProgress} />
    </AppLoadingState>
  );
}
