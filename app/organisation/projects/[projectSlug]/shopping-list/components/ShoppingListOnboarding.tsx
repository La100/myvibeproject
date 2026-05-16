"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
          {step.done ? t("shoppingList", "done") : t("shoppingList", "next")}
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
  const { t } = useI18n();
  const chromeWebStoreUrl =
    "https://chromewebstore.google.com/detail/myvibeproject-web-clipper/nklbcopiimkboameblhnmdookkelncih";

  const steps: OnboardingStep[] = [
    {
      title: sectionsCount > 0 ? t("shoppingList", "sectionsAreReady") : t("shoppingList", "nameYourSections"),
      description:
        sectionsCount > 0
          ? t("shoppingList", "sectionsReadyDescription")
          : t("shoppingList", "nameSectionsDescription"),
      done: sectionsCount > 0,
      actionLabel: sectionsCount > 0 ? t("shoppingList", "reviewSections") : t("shoppingList", "addFirstSection"),
      onAction: onCreateSectionClick,
      icon: FolderPlusIcon,
      meta: t("shoppingList", "structure"),
    },
    ...(!extensionReady
      ? [
          {
            title: t("shoppingList", "installMyVibeClipper"),
            description: t("shoppingList", "installClipperDescription"),
            done: false,
            actionLabel: t("shoppingList", "chromeWebStore"),
            externalHref: chromeWebStoreUrl,
            icon: PlugZapIcon,
            meta: t("shoppingList", "extension"),
          },
        ]
      : []),
    {
      title: itemsCount > 0 ? t("shoppingList", "firstProductAdded") : t("shoppingList", "addYourFirstProduct"),
      description:
        itemsCount > 0
          ? t("shoppingList", "firstProductAddedDescription")
          : t("shoppingList", "addFirstProductDescription"),
      done: itemsCount > 0,
      actionLabel: itemsCount > 0 ? t("shoppingList", "addAnotherProduct") : t("shoppingList", "addFirstProduct"),
      onAction: onAddProductClick,
      icon: ShoppingBagIcon,
      meta: t("shoppingList", "firstItem"),
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
          aria-label={t("shoppingList", "hideShoppingListSetup")}
          title={t("shoppingList", "hide")}
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}

      <div className="grid items-start gap-8 p-6 lg:p-8 2xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="flex min-w-0 flex-col justify-between gap-6 py-1 2xl:min-h-[300px]">
          <div className="flex flex-col gap-4">
            <Badge variant="secondary" className="w-fit">
              {t("shoppingList", "shoppingListSetup")}
            </Badge>
            <div className="flex flex-col gap-3">
              <h2 className="clean-title max-w-lg text-3xl font-medium leading-tight tracking-tight md:text-4xl">
                {t("shoppingList", "setupShoppingSteps")}
              </h2>
              <p className="max-w-md break-words text-sm leading-6 text-muted-foreground md:text-base">
                {projectName} {t("shoppingList", "setupDescription")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="vibe-row min-w-36 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("shoppingList", "progress")}
              </p>
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
