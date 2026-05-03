"use client";

import { useAuth, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { cn } from "@/lib/utils";
import { selectOrganizationUrl } from "@/lib/authRedirects";

const ACTIVATION_RETRY_DELAY_MS = 2500;
const MAX_ACTIVATION_ATTEMPTS = 3;
const ACTIVATION_RELOAD_KEY = "myvibe-dashboard-activation-reloaded";
const ORG_SYNCING_ERROR = "Active organization is still syncing";

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

export function SmartDashboard() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const ensureCurrentUserTeamMembership = useMutation(
    apiAny.teamMembership.ensureCurrentUserTeamMembership,
  );
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization: activeOrganization } = useOrganization();
  const activeTeamSettings = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    activeOrganization?.id ? { clerkOrgId: activeOrganization.id } : "skip",
  );
  const [isEnsuringMembership, setIsEnsuringMembership] = useState(false);
  const [activationAttempt, setActivationAttempt] = useState(0);
  const [activationError, setActivationError] = useState<string | null>(null);
  const activatingOrganizationIdRef = useRef<string | null>(null);
  const activationRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const organizations = useMemo(
    () =>
      userMemberships?.data?.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
      })) || [],
    [userMemberships?.data]
  );

  const hasRedirectedRef = useRef(false);
  const ensuredActiveOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isLoaded ||
      !activeOrganization?.id ||
      activeTeamSettings === undefined ||
      activeTeamSettings ||
      ensuredActiveOrgIdRef.current === activeOrganization.id
    ) {
      return;
    }

    ensuredActiveOrgIdRef.current = activeOrganization.id;
    setIsEnsuringMembership(true);
    setActivationError(null);

    ensureCurrentUserTeamMembership({
      clerkOrgId: activeOrganization.id,
      orgName: activeOrganization.name,
    })
      .catch((error) => {
        ensuredActiveOrgIdRef.current = null;
        console.error("Failed to ensure dashboard membership", error);
        const message = toUserFacingErrorMessage(error);
        if (message.includes(ORG_SYNCING_ERROR) && activationAttempt < MAX_ACTIVATION_ATTEMPTS) {
          activationRetryTimeoutRef.current = setTimeout(() => {
            setActivationAttempt((attempt) => attempt + 1);
          }, ACTIVATION_RETRY_DELAY_MS);
          return;
        }
        setActivationError(message);
        toast.error("Could not verify workspace access.", {
          description: message,
        });
      })
      .finally(() => {
        setIsEnsuringMembership(false);
      });
  }, [
    activeOrganization?.id,
    activeOrganization?.name,
    activeTeamSettings,
    activationAttempt,
    ensureCurrentUserTeamMembership,
    isLoaded,
  ]);

  useEffect(() => {
    if (
      !isAuthLoaded ||
      !isLoaded ||
      !isSignedIn ||
      hasRedirectedRef.current ||
      isEnsuringMembership
    ) {
      return;
    }

    if (activeOrganization?.id && activeTeamSettings === undefined) {
      return;
    }

    if (activeOrganization?.id && !activeTeamSettings) {
      return;
    }

    if (activeOrganization?.id && activeTeamSettings) {
      router.replace(
        activeTeamSettings.onboardingCompleted
          ? "/organisation"
          : "/onboarding",
      );
      hasRedirectedRef.current = true;
      return;
    }

    if (organizations.length === 0) {
      router.replace(selectOrganizationUrl);
      hasRedirectedRef.current = true;
      return;
    }

    const primaryOrganization = organizations[0];

    if (activationAttempt >= MAX_ACTIVATION_ATTEMPTS) {
      if (sessionStorage.getItem(ACTIVATION_RELOAD_KEY) !== "1") {
        sessionStorage.setItem(ACTIVATION_RELOAD_KEY, "1");
        window.location.replace("/dashboard");
      } else {
        const message = "We could not activate your workspace automatically. Please try again.";
        setActivationError(message);
        toast.error("Could not activate your workspace.", {
          description: message,
        });
      }
      return;
    }

    if (!setActive || activatingOrganizationIdRef.current === primaryOrganization.id) {
      return;
    }

    setActivationError(null);
    activatingOrganizationIdRef.current = primaryOrganization.id;
    if (activationRetryTimeoutRef.current) {
      clearTimeout(activationRetryTimeoutRef.current);
    }
    activationRetryTimeoutRef.current = setTimeout(() => {
      if (activatingOrganizationIdRef.current !== primaryOrganization.id) {
        return;
      }

      activatingOrganizationIdRef.current = null;
      setActivationAttempt((attempt) => attempt + 1);
    }, ACTIVATION_RETRY_DELAY_MS);

    void (async () => {
      try {
        await setActive({ organization: primaryOrganization.id });
        router.refresh();
      } catch (error) {
        if (activationRetryTimeoutRef.current) {
          clearTimeout(activationRetryTimeoutRef.current);
          activationRetryTimeoutRef.current = null;
        }
        activatingOrganizationIdRef.current = null;
        setActivationAttempt((attempt) => attempt + 1);
        console.error("Failed to set active organization", error);
      }
    })();
  }, [
    activationAttempt,
    activeTeamSettings,
    isAuthLoaded,
    isEnsuringMembership,
    isSignedIn,
    isLoaded,
    organizations,
    activeOrganization?.id,
    setActive,
    router,
  ]);

  const loadingMessage = useMemo(() => {
    if (isEnsuringMembership) {
      return "Finalizing workspace access...";
    }
    if (organizations.length === 0) {
      return "Opening workspace setup...";
    }
    if (activeOrganization?.id && activeTeamSettings) {
      return activeTeamSettings.onboardingCompleted
        ? "Redirecting to your organization..."
        : "Opening workspace setup...";
    }
    return "Activating your workspace...";
  }, [
    isEnsuringMembership,
    activeTeamSettings,
    activeOrganization?.id,
    organizations.length,
  ]);

  useEffect(() => {
    if (activeOrganization?.id) {
      sessionStorage.removeItem(ACTIVATION_RELOAD_KEY);
      activatingOrganizationIdRef.current = null;
      setActivationAttempt(0);
      setActivationError(null);
      if (activationRetryTimeoutRef.current) {
        clearTimeout(activationRetryTimeoutRef.current);
        activationRetryTimeoutRef.current = null;
      }
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    return () => {
      if (activationRetryTimeoutRef.current) {
        clearTimeout(activationRetryTimeoutRef.current);
      }
    };
  }, []);

  // Show loading while checking organizations
  if (!isAuthLoaded || !isLoaded) {
    return <LoadingState title="Loading your workspace..." description="Please wait a moment." />;
  }

  if (!isSignedIn) {
    return <LoadingState title="Authorizing workspace..." description="One moment while we verify access." />;
  }

  if (activeOrganization?.id && activeTeamSettings === undefined) {
    return <LoadingState title="Loading your workspace..." description="We are checking your setup." />;
  }

  if (activationError) {
    return (
      <ErrorState
        title="Workspace setup needs attention"
        description={activationError}
        onRetry={() => {
          setActivationError(null);
          setActivationAttempt(0);
          hasRedirectedRef.current = false;
          router.refresh();
        }}
      />
    );
  }

  // Always show loading while redirecting
  return <LoadingState title="Working..." description={loadingMessage} />;
}
