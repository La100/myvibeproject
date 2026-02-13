"use client";

import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";


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
      // No organization - force custom onboarding organization setup
      console.log("No organization found, redirecting to /onboarding");
      router.replace("/onboarding");
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
    console.log("Multiple organizations found without active org, redirecting to /onboarding");
    router.replace("/onboarding");
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <h3 className="text-xl font-semibold">Processing your invitation...</h3>
          <p className="text-muted-foreground">
            We're adding you to the organization. This will take just a moment.
          </p>
        </div>
      </div>
    );
  }

  // Show loading while checking organizations
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (onboardingStatus === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Preparing onboarding...</p>
        </div>
      </div>
    );
  }

  if (!onboardingStatus.authenticated) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Authorizing workspace...</p>
        </div>
      </div>
    );
  }

  // Always show loading while redirecting
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-muted-foreground">{loadingMessage}</p>
      </div>
    </div>
  );
}
