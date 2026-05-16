/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppLoadingState } from "@/components/ui/loading-state";
import { postAuthResolverUrl, signInUrl } from "@/lib/authRedirects";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

export default function SelectOrganizationPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const { createOrganization, isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [workspaceName, setWorkspaceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivatingExistingWorkspace, setIsActivatingExistingWorkspace] = useState(false);

  const organizations = useMemo(
    () =>
      userMemberships?.data?.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
      })) || [],
    [userMemberships?.data],
  );

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace(
        `${signInUrl}?redirect_url=${encodeURIComponent("/select-organization")}`,
      );
      return;
    }

    if (!isLoaded || !setActive || isSubmitting || isActivatingExistingWorkspace) {
      return;
    }

    if (organization?.id) {
      router.replace(postAuthResolverUrl);
      return;
    }

    if (organizations.length === 0) {
      return;
    }

    setIsActivatingExistingWorkspace(true);
    void (async () => {
      try {
        await setActive({
          organization: organizations[0].id,
        });
        router.replace(postAuthResolverUrl);
      } catch (error) {
        console.error("Failed to activate workspace", error);
        setIsActivatingExistingWorkspace(false);
        toast.error(t("workspaceSetup", "reconnectError"), {
          description: toUserFacingErrorMessage(error),
        });
      }
    })();
  }, [
    isActivatingExistingWorkspace,
    isAuthLoaded,
    isLoaded,
    isSignedIn,
    isSubmitting,
    organization?.id,
    organizations,
    router,
    setActive,
    t,
  ]);

  const handleCreateWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = workspaceName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      toast.error(t("workspaceSetup", "nameMinLength"));
      return;
    }

    if (!createOrganization || !setActive || organizations.length > 0) {
      toast.error(t("workspaceSetup", "alreadyHasWorkspace"));
      return;
    }

    setIsSubmitting(true);
    try {
      const createdOrganization = await createOrganization({ name: trimmedName });
      await setActive({
        organization: createdOrganization.id,
      });
      router.replace(postAuthResolverUrl);
    } catch (error) {
      console.error(error);
      toast.error(t("workspaceSetup", "createError"), {
        description: toUserFacingErrorMessage(error),
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,111,89,0.14),transparent_34%),linear-gradient(180deg,rgba(250,248,244,0.98)_0%,rgba(246,242,236,0.94)_100%)] px-5 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,520px)] lg:items-center">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <Link href="/" className="mb-8 inline-flex items-center gap-3">
                <img
                  src="/logo.svg"
                  alt="Myvibe project"
                  width={56}
                  height={56}
                  className="size-14"
                />
                <span className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {t("workspaceSetup", "workspaceLabel")}
                </span>
              </Link>

              <h1 className="max-w-[12ch] text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-foreground">
                {t("workspaceSetup", "headline")}
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
                {t("workspaceSetup", "description")}
              </p>
            </div>
          </section>

          <section>
            <div className="mx-auto w-full max-w-[520px] rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur xl:p-8">
              <div className="mb-6 lg:hidden">
                <Link href="/" className="inline-flex items-center gap-3">
                  <img
                    src="/logo.svg"
                    alt="Myvibe project"
                    width={44}
                    height={44}
                    className="size-11"
                  />
                  <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    {t("navigation", "companySpace")}
                  </span>
                </Link>
              </div>

              <div className="mb-7">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  {t("workspaceSetup", "workspaceAccess")}
                </p>
                <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-foreground">
                  {t("workspaceSetup", "title")}
                </h2>
                <p className="mt-3 max-w-[38ch] text-sm leading-6 text-muted-foreground">
                  {t("workspaceSetup", "subtitle")}
                </p>
              </div>
              {!isLoaded || isActivatingExistingWorkspace || (organizations.length > 0 && !organization?.id) ? (
                <AppLoadingState
                  variant="inline"
                  title={t("workspaceSetup", "loadingWorkspace")}
                  description={t("workspaceSetup", "loadingWorkspaceDescription")}
                  className="min-h-40 px-0"
                />
              ) : (
                <Card className="border-0 bg-transparent shadow-none">
                  <CardContent className="p-0">
                    <form className="flex flex-col gap-4" onSubmit={handleCreateWorkspace}>
                      <Input
                        value={workspaceName}
                        onChange={(event) => setWorkspaceName(event.target.value)}
                        placeholder={t("workspaceSetup", "namePlaceholder")}
                        className="h-12 rounded-2xl"
                        disabled={isSubmitting || organizations.length > 0}
                      />
                      <Button
                        type="submit"
                        className="h-12 rounded-2xl"
                        disabled={isSubmitting || organizations.length > 0}
                      >
                        {isSubmitting ? t("workspaceSetup", "creating") : t("workspaceSetup", "create")}
                      </Button>
                      {organizations.length > 0 ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {t("workspaceSetup", "alreadyHasWorkspaceReconnect")}
                        </p>
                      ) : null}
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
