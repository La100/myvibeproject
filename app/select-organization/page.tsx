import Image from "next/image";
import Link from "next/link";
import { OrganizationList } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";

const organizationListAppearance = {
  elements: {
    cardBox: "shadow-none bg-transparent border-0",
    card: "border-0 bg-transparent shadow-none p-0",
    header: "sr-only",
    headerTitle: "sr-only",
    headerSubtitle: "sr-only",
    navbar: "hidden",
    pageScrollBox: "p-0",
    organizationSwitcherTrigger:
      "h-12 rounded-2xl border border-border bg-background shadow-none",
    formButtonPrimary:
      "h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-medium shadow-none hover:bg-primary/92",
    formButtonReset:
      "h-12 rounded-2xl border border-border bg-background text-foreground text-sm font-medium shadow-none",
    organizationPreview:
      "rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-none hover:bg-muted/20",
    organizationPreviewMainIdentifier:
      "text-sm font-medium text-foreground",
    organizationPreviewSecondaryIdentifier:
      "text-xs text-muted-foreground",
    actionCard:
      "rounded-2xl border border-dashed border-border/80 bg-background/70 shadow-none hover:bg-muted/20",
    actionCardText: "text-sm font-medium text-foreground",
    actionCardTextContainer: "text-muted-foreground",
    formFieldInput:
      "h-12 rounded-2xl border border-border bg-background text-foreground placeholder:text-muted-foreground shadow-none focus:border-primary focus:ring-2 focus:ring-primary/15",
    formFieldLabel:
      "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
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

export default function SelectOrganizationPage() {
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
                Pick the organization you want to use.
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
                Select an existing workspace or create a new one. Setup only
                appears when that specific organization still needs it.
              </p>
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
                  Workspace access
                </p>
                <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-foreground">
                  Select organization
                </h2>
                <p className="mt-3 max-w-[38ch] text-sm leading-6 text-muted-foreground">
                  Choose one of your workspaces or create a new organization.
                </p>
              </div>

              <OrganizationList
                appearance={organizationListAppearance}
                hidePersonal
                afterCreateOrganizationUrl={postAuthResolverUrl}
                afterSelectOrganizationUrl={postAuthResolverUrl}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
