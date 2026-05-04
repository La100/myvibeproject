"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { apiAny } from "@/lib/convexApiAny";
import { selectOrganizationUrl } from "@/lib/authRedirects";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { cn } from "@/lib/utils";

const MAX_BOOTSTRAP_RETRIES = 4;

const isTransientActiveOrganizationSyncError = (error: unknown) => {
  const message = toUserFacingErrorMessage(error).toLowerCase();
  return (
    message.includes("active organization is still syncing") ||
    message.includes("selected organization does not match active auth context")
  );
};

function LoadingState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[220px] items-center justify-center px-4", className)}>
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-2 text-center">
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Spinner fullHeight={false} className="py-0" iconClassName="size-5" />
        </CardContent>
      </Card>
    </div>
  );
}

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

export function PostAuthRouter() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
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
      if (
        bootstrapAttempt < MAX_BOOTSTRAP_RETRIES &&
        isTransientActiveOrganizationSyncError(error)
      ) {
        window.setTimeout(() => {
          if (!cancelled) {
            setBootstrapAttempt((attempt) => attempt + 1);
          }
        }, 750);
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

    router.replace(teamSettings.onboardingCompleted ? "/organisation" : "/onboarding");
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
      return "Preparing your workspace.";
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

  return <LoadingState title="Loading your workspace..." description={loadingDescription} />;
}
