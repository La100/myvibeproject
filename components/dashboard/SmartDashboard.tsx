"use client";

import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { chooseOrganizationUrl } from "@/lib/authRedirects";

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
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization: activeOrganization } = useOrganization();

  const organizations = useMemo(
    () =>
      userMemberships?.data?.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
      })) || [],
    [userMemberships?.data]
  );

  const hasActiveMembership = useMemo(
    () =>
      Boolean(
        activeOrganization?.id &&
          organizations.some((organization) => organization.id === activeOrganization.id)
      ),
    [activeOrganization?.id, organizations],
  );
  const hasRedirectedRef = useRef(false);

  // Check for pending invitation ticket in URL and force reload after delay
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const clerkTicket = params.get('__clerk_ticket');

    if (clerkTicket) {
      console.log('[SmartDashboard] Invitation ticket detected, will reload after Clerk processes it...');

      // Give Clerk time to process the invitation (5 seconds)
      const timer = setTimeout(() => {
        console.log('[SmartDashboard] Reloading page to check organization membership...');
        // Remove ticket from URL and reload
        const url = new URL(window.location.href);
        url.searchParams.delete('__clerk_ticket');
        url.searchParams.delete('__clerk_status');
        window.location.replace(url.toString());
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-redirect based on organization status
  useEffect(() => {
    if (!isLoaded || onboardingStatus === undefined || hasRedirectedRef.current) return;
    if (!onboardingStatus.authenticated) return;

    if (!onboardingStatus.completed) {
      router.replace("/onboarding");
      hasRedirectedRef.current = true;
      return;
    }

    if (organizations.length === 0) {
      console.log("No organization found, redirecting to choose organization");
      router.replace(chooseOrganizationUrl);
      hasRedirectedRef.current = true;
      return;
    }

    if (hasActiveMembership) {
      router.replace("/organisation");
      hasRedirectedRef.current = true;
      return;
    }

    if (organizations.length === 1) {
      const org = organizations[0];
      console.log("One organization found, activating:", org);
      (async () => {
        try {
          if (setActive) {
            await setActive({ organization: org.id });
          }
        } catch (error) {
          console.error("Failed to set active organization, continuing redirect", error);
        } finally {
          console.log("Pushing to: /organisation");
          router.replace("/organisation");
          hasRedirectedRef.current = true;
        }
      })();
      return;
    }

    // Multiple organizations with no active selection: let user choose in onboarding.
    console.log("Multiple organizations found without active org, redirecting to choose organization");
    router.replace(chooseOrganizationUrl);
    hasRedirectedRef.current = true;
  }, [isLoaded, onboardingStatus, organizations, hasActiveMembership, setActive, router]);

  const loadingMessage = useMemo(() => {
    if (organizations.length === 0) {
      return "Redirecting to workspace setup...";
    }
    if (hasActiveMembership || organizations.length === 1) {
      return "Redirecting to your organization...";
    }
    return "Preparing organization selection...";
  }, [organizations.length, hasActiveMembership]);

  // Check if there's a pending invitation ticket
  const hasInvitationTicket =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("__clerk_ticket");

  // Show special loading for invitation acceptance
  if (hasInvitationTicket) {
    return (
      <LoadingState
        title="Processing your invitation..."
        description="We're adding you to the organization. This will take just a moment."
      />
    );
  }

  // Show loading while checking organizations
  if (!isLoaded) {
    return <LoadingState title="Loading your workspace..." description="Please wait a moment." />;
  }

  if (onboardingStatus === undefined) {
    return <LoadingState title="Preparing onboarding..." description="We are checking your setup." />;
  }

  if (!onboardingStatus.authenticated) {
    return <LoadingState title="Authorizing workspace..." description="One moment while we verify access." />;
  }

  // Always show loading while redirecting
  return <LoadingState title="Working..." description={loadingMessage} />;
}
