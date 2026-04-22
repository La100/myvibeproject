import Image from "next/image";
import Link from "next/link";
import { TaskChooseOrganization } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";

const taskAppearance = {
  elements: {
    cardBox: "shadow-none bg-transparent border-0",
    card: "border-0 bg-transparent shadow-none p-0",
    header: "sr-only",
    headerTitle: "sr-only",
    headerSubtitle: "sr-only",
    formFieldLabel:
      "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
    formFieldInput:
      "h-12 rounded-2xl border border-border bg-background text-foreground placeholder:text-muted-foreground shadow-none focus:border-primary focus:ring-2 focus:ring-primary/15",
    formButtonPrimary:
      "mt-2 h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-medium shadow-none hover:bg-primary/92",
    footer: "border-0 pt-5",
    footerActionText: "text-sm text-muted-foreground",
    footerActionLink: "font-medium text-foreground hover:underline",
    organizationSwitcherTrigger:
      "h-12 rounded-2xl border border-border bg-background shadow-none",
    formFieldInputShowPasswordButton: "text-muted-foreground",
  },
  variables: {
    colorPrimary: "var(--primary)",
    colorText: "var(--foreground)",
    colorInputText: "var(--foreground)",
    colorInputBackground: "var(--background)",
    colorBackground: "transparent",
    borderRadius: "1rem",
  },
} as const;

export default function ChooseOrganizationTaskPage() {
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
                  Onboarding
                </span>
              </Link>

              <h1 className="max-w-[12ch] text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-foreground">
                Confirm organization access and continue.
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
                This screen resolves your current Clerk session task. After
                confirming the organization, we will route you to the correct app
                destination.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <span className="rounded-full border border-border/80 bg-background/80 px-4 py-2 text-sm text-foreground">
                  1. Confirm organization
                </span>
                <span className="rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm text-muted-foreground">
                  2. Activate workspace
                </span>
                <span className="rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm text-muted-foreground">
                  3. Open app
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="mx-auto w-full max-w-[520px] rounded-[32px] border border-border/70 bg-card/95 p-6 shadow-[0_24px_80px_rgba(25,20,14,0.08)] backdrop-blur xl:p-8">
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
                  Session task
                </p>
                <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-foreground">
                  Confirm organization
                </h2>
                <p className="mt-3 max-w-[38ch] text-sm leading-6 text-muted-foreground">
                  Confirm the organization for this session. If that workspace
                  still needs setup, we will send you there next.
                </p>
              </div>

              <TaskChooseOrganization
                appearance={taskAppearance}
                redirectUrlComplete={postAuthResolverUrl}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
