"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { postAuthResolverUrl } from "@/lib/authRedirects";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";

export default function SelectOrganizationPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { createOrganization, isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [workspaceName, setWorkspaceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizations = useMemo(
    () =>
      userMemberships?.data?.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
      })) || [],
    [userMemberships?.data],
  );

  useEffect(() => {
    if (!isLoaded || !setActive || isSubmitting) {
      return;
    }

    if (organization?.id) {
      router.replace(postAuthResolverUrl);
      return;
    }

    if (organizations.length === 0) {
      return;
    }

    void (async () => {
      try {
        await setActive({ organization: organizations[0].id });
        router.replace(postAuthResolverUrl);
      } catch (error) {
        console.error("Failed to activate workspace", error);
        toast.error("Could not reconnect to your workspace.", {
          description: toUserFacingErrorMessage(error),
        });
      }
    })();
  }, [isLoaded, isSubmitting, organization?.id, organizations, router, setActive]);

  const handleCreateWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = workspaceName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      toast.error("Enter at least 2 characters for workspace name.");
      return;
    }

    if (!createOrganization || !setActive || organizations.length > 0) {
      toast.error("This account already has a workspace.");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdOrganization = await createOrganization({ name: trimmedName });
      await setActive({ organization: createdOrganization.id });
      router.replace(postAuthResolverUrl);
    } catch (error) {
      console.error(error);
      toast.error("Could not create workspace.", {
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
                <Image
                  src="/logo.svg"
                  alt="Myvibe project"
                  width={56}
                  height={56}
                  className="size-14"
                />
                <span className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Workspace
                </span>
              </Link>

              <h1 className="max-w-[12ch] text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-foreground">
                Create your workspace and continue.
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
                Each account now works inside a single organization. Create your
                workspace once and we will take you straight into the app.
              </p>
            </div>
          </section>

          <section>
            <div className="mx-auto w-full max-w-[520px] rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur xl:p-8">
              <div className="mb-6 lg:hidden">
                <Link href="/" className="inline-flex items-center gap-3">
                  <Image
                    src="/logo.svg"
                    alt="Myvibe project"
                    width={44}
                    height={44}
                    className="size-11"
                  />
                  <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Organization
                  </span>
                </Link>
              </div>

              <div className="mb-7">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Workspace access
                </p>
                <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-foreground">
                  Create workspace
                </h2>
                <p className="mt-3 max-w-[38ch] text-sm leading-6 text-muted-foreground">
                  Your account can belong to only one workspace. Start by naming it.
                </p>
              </div>
              {!isLoaded || (organizations.length > 0 && !organization?.id) ? (
                <div className="flex min-h-40 items-center justify-center">
                  <Spinner fullHeight={false} className="py-0" iconClassName="size-5" />
                </div>
              ) : (
                <Card className="border-0 bg-transparent shadow-none">
                  <CardContent className="p-0">
                    <form className="flex flex-col gap-4" onSubmit={handleCreateWorkspace}>
                      <Input
                        value={workspaceName}
                        onChange={(event) => setWorkspaceName(event.target.value)}
                        placeholder="Workspace name"
                        className="h-12 rounded-2xl"
                        disabled={isSubmitting || organizations.length > 0}
                      />
                      <Button
                        type="submit"
                        className="h-12 rounded-2xl"
                        disabled={isSubmitting || organizations.length > 0}
                      >
                        {isSubmitting ? "Creating..." : "Create workspace"}
                      </Button>
                      {organizations.length > 0 ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          This account already has a workspace. We are reconnecting you to it now.
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
