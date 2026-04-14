"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  CheckIcon,
  FolderPlusIcon,
  PlugZapIcon,
  ShoppingBagIcon,
} from "lucide-react";

interface ShoppingListOnboardingProps {
  projectName: string;
  sectionsCount: number;
  extensionReady: boolean;
  itemsCount: number;
  onCreateSectionClick: () => void;
  onConnectClipperClick: () => void;
  onAddProductClick: () => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
  icon: typeof FolderPlusIcon;
  helperText?: string;
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

  return (
    <div className="relative flex h-full flex-col gap-5 rounded-[1.75rem] border border-border/70 bg-white p-6 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.16)]">
      {!isLast ? (
        <div className="pointer-events-none absolute -right-4 top-14 hidden h-px w-8 bg-border/70 xl:block" />
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-white text-base font-semibold text-foreground/70">
          {step.done ? <CheckIcon className="h-5 w-5 text-primary" /> : stepNumber}
        </div>
        <Badge variant={step.done ? "secondary" : "outline"}>
          {step.done ? "Done" : "Next"}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          <span>{step.title}</span>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          {step.description}
        </p>
      </div>

      <div className="mt-auto">
        <Button
          variant={step.done ? "outline" : "default"}
          className={cn("w-full justify-between rounded-xl", step.done && "bg-white")}
          onClick={step.onAction}
        >
          <span>{step.actionLabel}</span>
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
        {step.helperText ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {step.helperText}
          </p>
        ) : null}
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
  onConnectClipperClick,
  onAddProductClick,
}: ShoppingListOnboardingProps) {
  const steps: OnboardingStep[] = [
    {
      title: sectionsCount > 0 ? "Sections are ready" : "Name your sections",
      description:
        sectionsCount > 0
          ? "Your rooms and categories are already in place, so products can land in the right part of the project."
          : "Start with rooms or categories like Kitchen, Bathroom, Lighting, or Furniture. This becomes the structure of the list.",
      done: sectionsCount > 0,
      actionLabel: sectionsCount > 0 ? "Review sections" : "Add first section",
      onAction: onCreateSectionClick,
      icon: FolderPlusIcon,
    },
    ...(!extensionReady
      ? [
          {
            title: "Connect MyVibe Clipper",
            description:
              "Connect the browser extension once, then clip products from store pages instead of filling the list manually.",
            done: false,
            actionLabel: "Connect clipper",
            helperText: "Chrome Web Store link will be added here once the extension is published.",
            onAction: onConnectClipperClick,
            icon: PlugZapIcon,
          },
        ]
      : []),
    {
      title: itemsCount > 0 ? "First product added" : "Add your first product",
      description:
        itemsCount > 0
          ? "Your shopping list is live. Keep adding alternatives, pricing, deadlines, and suppliers as the scope grows."
          : "Use the clipper on a product page or add one manually here to get this shopping list moving.",
      done: itemsCount > 0,
      actionLabel: itemsCount > 0 ? "Add another product" : "Add first product",
      onAction: onAddProductClick,
      icon: ShoppingBagIcon,
    },
  ];

  const completedSteps = steps.filter((step) => step.done).length;

  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-border/70 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]">
      <div className="grid gap-8 p-6 lg:grid-cols-[0.92fr_1.08fr] lg:p-8">
        <div className="flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit">
              Shopping list setup
            </Badge>
            <div className="space-y-3">
              <h2 className="clean-title max-w-lg text-3xl font-medium tracking-tight md:text-4xl">
                Build the list once, then let MyVibe Clipper fill it fast.
              </h2>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground md:text-base">
                {projectName} does not have any shopping items yet. Set the structure
                {extensionReady ? "," : ", connect the clipper,"} and add the first product from a store page
                or manually from here.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-border/70 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {completedSteps}/{steps.length}
              </p>
            </div>
            <div className="max-w-xs text-sm leading-6 text-muted-foreground">
              Use this as the first-run path for materials, fixtures, and sourced products.
            </div>
          </div>
        </div>

        <div className={cn("grid gap-4", steps.length === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3")}>
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
