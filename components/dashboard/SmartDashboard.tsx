"use client";

import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { selectOrganizationUrl } from "@/lib/authRedirects";

const ACTIVATION_RETRY_DELAY_MS = 2500;
const MAX_ACTIVATION_ATTEMPTS = 3;
const ACTIVATION_RELOAD_KEY = "myvibe-dashboard-activation-reloaded";

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

export function SmartDashboard() {
  const router = useRouter();
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);
  const ensureCurrentUserTeamMembership = useMutation(
    apiAny.teamMembership.ensureCurrentUserTeamMembership,
  );
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization: activeOrganization } = useOrganization();
  const [isEnsuringMembership, setIsEnsuringMembership] = useState(false);
  const [activationAttempt, setActivationAttempt] = useState(0);
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
      onboardingStatus === undefined ||
      !onboardingStatus.authenticated ||
      !activeOrganization?.id ||
      onboardingStatus.activeOrganization ||
      ensuredActiveOrgIdRef.current === activeOrganization.id
    ) {
      return;
    }

    ensuredActiveOrgIdRef.current = activeOrganization.id;
    setIsEnsuringMembership(true);

    ensureCurrentUserTeamMembership({
      clerkOrgId: activeOrganization.id,
      orgName: activeOrganization.name,
    })
      .catch((error) => {
        ensuredActiveOrgIdRef.current = null;
        console.error("Failed to ensure dashboard membership", error);
      })
      .finally(() => {
        setIsEnsuringMembership(false);
      });
  }, [
    activeOrganization?.id,
    activeOrganization?.name,
    ensureCurrentUserTeamMembership,
    isLoaded,
    onboardingStatus,
  ]);

  useEffect(() => {
    if (
      !isLoaded ||
      onboardingStatus === undefined ||
      hasRedirectedRef.current ||
      isEnsuringMembership
    ) {
      return;
    }
    if (!onboardingStatus.authenticated) return;

    if (activeOrganization?.id && !onboardingStatus.activeOrganization) {
      return;
    }

    if (activeOrganization?.id && onboardingStatus.activeOrganization) {
      router.replace(
        onboardingStatus.activeOrganization.onboardingCompleted
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
        setActivationAttempt(0);
      }
      return;
    }

    if (!setActive || activatingOrganizationIdRef.current === primaryOrganization.id) {
      return;
    }

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
    isEnsuringMembership,
    isLoaded,
    onboardingStatus,
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
    if (activeOrganization?.id && onboardingStatus?.activeOrganization) {
      return onboardingStatus.activeOrganization.onboardingCompleted
        ? "Redirecting to your organization..."
        : "Opening workspace setup...";
    }
    return "Activating your workspace...";
  }, [
    isEnsuringMembership,
    onboardingStatus?.activeOrganization,
    activeOrganization?.id,
    organizations.length,
  ]);

  useEffect(() => {
    if (activeOrganization?.id) {
      sessionStorage.removeItem(ACTIVATION_RELOAD_KEY);
      activatingOrganizationIdRef.current = null;
      setActivationAttempt(0);
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
  if (!isLoaded) {
    return <LoadingState title="Loading your workspace..." description="Please wait a moment." />;
  }

  if (onboardingStatus === undefined) {
    return <LoadingState title="Loading your workspace..." description="We are checking your setup." />;
  }

  if (!onboardingStatus.authenticated) {
    return <LoadingState title="Authorizing workspace..." description="One moment while we verify access." />;
  }

  // Always show loading while redirecting
  return <LoadingState title="Working..." description={loadingMessage} />;
}
