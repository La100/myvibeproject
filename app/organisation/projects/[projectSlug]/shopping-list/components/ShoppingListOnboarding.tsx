"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  FolderPlusIcon,
  PlugZapIcon,
  ShoppingBagIcon,
  XIcon,
} from "lucide-react";

interface ShoppingListOnboardingProps {
  projectName: string;
  sectionsCount: number;
  extensionReady: boolean;
  itemsCount: number;
  onCreateSectionClick: () => void;
  onAddProductClick: () => void;
  onDismiss?: () => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
  onAction?: () => void;
  externalHref?: string;
  icon: typeof FolderPlusIcon;
  meta: string;
}

function StepCard({
  step,
  stepNumber,
  isLast,
}: {
  step: OnboardingStep;
  stepNumber: number;
  isLast: boolean;
}) {
  const Icon = step.icon;
  const isExternalAction = Boolean(step.externalHref);

  return (
    <div
      className={cn(
        "vibe-surface relative flex min-h-[260px] min-w-0 flex-col gap-5 p-6 md:min-h-[300px]",
        isExternalAction &&
          "border-primary/12 bg-[color-mix(in_oklab,var(--ui-surface-inner)_84%,#f4eee5_16%)] shadow-sm",
      )}
    >
      {!isLast ? (
        <div className="pointer-events-none absolute -right-4 top-14 hidden h-px w-8 bg-border/70 xl:block" />
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-secondary/65 text-base font-semibold text-foreground/70">
          {step.done ? <CheckIcon className="h-5 w-5 text-primary" /> : stepNumber}
        </div>
        <Badge variant={step.done ? "secondary" : "outline"} className="mt-1">
          {step.done ? "Done" : "Next"}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{step.meta}</span>
        </div>
        <h3 className="max-w-[14rem] text-lg font-medium leading-tight tracking-tight text-foreground">
          <span>{step.title}</span>
        </h3>
        <p className="max-w-[15rem] text-sm leading-6 text-muted-foreground">
          {step.description}
        </p>
      </div>

      <div className="mt-auto">
        {step.externalHref ? (
          <Button asChild className="h-10 w-full min-w-0 max-w-full justify-between overflow-hidden rounded-full px-4 text-sm">
            <Link href={step.externalHref} target="_blank" rel="noreferrer">
              <span className="min-w-0 truncate">{step.actionLabel}</span>
              <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button
            variant={step.done ? "outline" : "default"}
            className={cn(
              "h-10 w-full min-w-0 max-w-full justify-between overflow-hidden rounded-full px-4 text-sm",
              step.done && "bg-card",
            )}
            onClick={step.onAction}
          >
            <span className="min-w-0 truncate">{step.actionLabel}</span>
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ShoppingListOnboarding({
  projectName,
  sectionsCount,
  extensionReady,
  itemsCount,
  onCreateSectionClick,
  onAddProductClick,
  onDismiss,
}: ShoppingListOnboardingProps) {
  const chromeWebStoreUrl =
    "https://chromewebstore.google.com/detail/myvibeproject-web-clipper/nklbcopiimkboameblhnmdookkelncih";

  const steps: OnboardingStep[] = [
    {
      title: sectionsCount > 0 ? "Sections are ready" : "Name your sections",
      description:
        sectionsCount > 0
          ? "Rooms and categories are ready for incoming products."
          : "Create rooms or categories so every item lands in the right place.",
      done: sectionsCount > 0,
      actionLabel: sectionsCount > 0 ? "Review sections" : "Add first section",
      onAction: onCreateSectionClick,
      icon: FolderPlusIcon,
      meta: "Structure",
    },
    ...(!extensionReady
      ? [
          {
            title: "Install MyVibe Clipper",
            description: "Open the Chrome Web Store and add the extension before clipping products.",
            done: false,
            actionLabel: "Chrome Web Store",
            externalHref: chromeWebStoreUrl,
            icon: PlugZapIcon,
            meta: "Extension",
          },
        ]
      : []),
    {
      title: itemsCount > 0 ? "First product added" : "Add your first product",
      description:
        itemsCount > 0
          ? "The shopping list is live. Keep adding options as the scope grows."
          : "Clip a store page or add one manually to start the list.",
      done: itemsCount > 0,
      actionLabel: itemsCount > 0 ? "Add another product" : "Add first product",
      onAction: onAddProductClick,
      icon: ShoppingBagIcon,
      meta: "First item",
    },
  ];

  const completedSteps = steps.filter((step) => step.done).length;

  return (
    <section className="vibe-panel relative mb-8 overflow-hidden">
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10 h-9 w-9 rounded-full text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          onClick={onDismiss}
          aria-label="Hide shopping list setup"
          title="Hide"
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}

      <div className="grid items-start gap-8 p-6 lg:p-8 2xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="flex min-w-0 flex-col justify-between gap-6 py-1 2xl:min-h-[300px]">
          <div className="flex flex-col gap-4">
            <Badge variant="secondary" className="w-fit">
              Shopping list setup
            </Badge>
            <div className="flex flex-col gap-3">
              <h2 className="clean-title max-w-lg text-3xl font-medium leading-tight tracking-tight md:text-4xl">
                Set up shopping in three quick steps.
              </h2>
              <p className="max-w-md break-words text-sm leading-6 text-muted-foreground md:text-base">
                {projectName} is empty. Add sections, install the Chrome extension, then save the first product.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="vibe-row min-w-36 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {completedSteps}/{steps.length}
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "grid min-w-0 items-stretch gap-4",
            steps.length === 2 ? "md:grid-cols-2" : "lg:grid-cols-3",
          )}
        >
          {steps.map((step, index) => (
            <StepCard
              key={step.title}
              step={step}
              stepNumber={index + 1}
              isLast={index === steps.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
