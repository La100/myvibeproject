/* eslint-disable @next/next/no-img-element */
"use client";

import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronDown,
  Chrome,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  ImageIcon,
  ListChecks,
  MessageSquare,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import { BillingPlanCard } from "@/components/billing/BillingPlanCard";
import { Button } from "@/components/ui/button";
import { BILLING_PLANS } from "@/lib/billingPlans";
import { useI18n } from "@/lib/i18n";

type LandingIcon = ComponentType<{ className?: string }>;

const conceptVisuals = [
  {
    titleKey: "visualStudioFacade",
    src: "/landing/visualization-1776944094220.webp",
  },
  {
    titleKey: "visualSiteReference",
    src: "/landing/visualization-1776943891109.webp",
  },
  {
    titleKey: "visualCourtyardOption",
    src: "/landing/visualization-1776943915361.webp",
  },
  {
    titleKey: "visualVillageMassing",
    src: "/landing/visualization-1776943937854.webp",
  },
];

const landingProducts = [
  {
    nameKey: "productBarcelonaChair",
    categoryKey: "categoryLounge",
    statusKey: "statusClientApproved",
    price: "EUR 4,280",
    src: "/landing/generated/barcelona-chair-main.png",
  },
  {
    nameKey: "productGreenZelligeTile",
    categoryKey: "categoryWallFinish",
    statusKey: "statusSampleOrdered",
    price: "EUR 118 / m2",
    src: "/landing/generated/green-zellige-interior.png",
  },
  {
    nameKey: "productRedTravertineTable",
    categoryKey: "categoryFurniture",
    statusKey: "statusQuoteRequested",
    price: "EUR 1,240",
    src: "/landing/generated/red-travertine-side-table.png",
  },
  {
    nameKey: "productCreamBoucleSwivel",
    categoryKey: "categorySeating",
    statusKey: "statusAltOption",
    price: "EUR 2,180",
    src: "/landing/generated/cream-boucle-swivel-chair.png",
  },
  {
    nameKey: "productWalnutFlutedCabinet",
    categoryKey: "categoryStorage",
    statusKey: "statusSupplierSaved",
    price: "EUR 2,460",
    src: "/landing/generated/walnut-fluted-cabinet.png",
  },
  {
    nameKey: "productAlabasterPendant",
    categoryKey: "categoryLighting",
    statusKey: "statusApproved",
    price: "EUR 1,340",
    src: "/landing/generated/alabaster-pendant-light.png",
  },
  {
    nameKey: "productSmokedGlassTable",
    categoryKey: "categoryCoffeeTable",
    statusKey: "statusReusable",
    price: "EUR 1,590",
    src: "/landing/generated/smoked-glass-coffee-table.png",
  },
  {
    nameKey: "productTerracottaFloorTile",
    categoryKey: "categoryFloorFinish",
    statusKey: "statusClientReview",
    price: "EUR 92 / m2",
    src: "/landing/generated/terracotta-tile-hallway.png",
  },
  {
    nameKey: "productNickelWallSconce",
    categoryKey: "categoryLighting",
    statusKey: "statusSupplierSaved",
    price: "EUR 640",
    src: "/landing/generated/brushed-nickel-wall-sconce.png",
  },
  {
    nameKey: "productOatWoolGridRug",
    categoryKey: "categoryTextile",
    statusKey: "statusApproved",
    price: "EUR 1,760",
    src: "/landing/generated/oat-wool-grid-rug.png",
  },
];

const conceptProducts = [landingProducts[2], landingProducts[5]];
const shoppingProducts = landingProducts.slice(0, 4);
const reviewProducts = [landingProducts[4], landingProducts[7], landingProducts[8]];
const projectSystemProducts = [
  landingProducts[1],
  landingProducts[5],
  landingProducts[7],
  landingProducts[9],
];
const libraryProducts = [
  landingProducts[0],
  landingProducts[3],
  landingProducts[4],
  landingProducts[6],
  landingProducts[8],
  landingProducts[9],
];

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/myvibeproject-web-clipper/nklbcopiimkboameblhnmdookkelncih";

const projectTasks = [
  { titleKey: "taskConfirmTileGrout", metaKey: "taskMetaClientReview", statusKey: "taskStatusReview" },
  { titleKey: "taskSendChairLeadTime", metaKey: "taskMetaSourcing", statusKey: "taskStatusToday" },
  { titleKey: "taskUpdateLoungeBudget", metaKey: "taskMetaBudget", statusKey: "taskStatusDone" },
];

const workspaceNavItems: { labelKey: string; icon: LandingIcon }[] = [
  { labelKey: "navOverview", icon: CheckCircle2 },
  { labelKey: "navMoodboard", icon: ImageIcon },
  { labelKey: "navShoppingList", icon: ShoppingCart },
  { labelKey: "navTasks", icon: ListChecks },
];

const reviewDecisions = [
  { labelKey: "decisionWalnutCabinet", statusKey: "statusApproved" },
  { labelKey: "decisionTerracottaFloor", statusKey: "statusNeedsRevision" },
  { labelKey: "decisionNickelWallSconce", statusKey: "statusApproved" },
];

const estimateRows = [
  { itemKey: "estimateConceptPackage", statusKey: "statusApproved", amount: "EUR 9,226" },
  { itemKey: "estimatePaidDeposit", statusKey: "statusReceived", amount: "EUR 2,750" },
  { itemKey: "estimateSupplierQuotes", statusKey: "statusPending", amount: "EUR 1,120" },
];

const reportMetrics = [
  { labelKey: "metricBudgetLocked", value: "72%" },
  { labelKey: "metricPendingApprovals", value: "2" },
  { labelKey: "metricProductsReused", value: "4" },
];

const faqItems = [
  {
    categoryKey: "faqProductScopeCategory",
    questionKey: "faqProductScopeQuestion",
    answerKey: "faqProductScopeAnswer",
  },
  {
    categoryKey: "faqProjectCategory",
    questionKey: "faqProjectQuestion",
    answerKey: "faqProjectAnswer",
  },
  {
    categoryKey: "faqAiAssistantCategory",
    questionKey: "faqAiAssistantQuestion",
    answerKey: "faqAiAssistantAnswer",
  },
  {
    categoryKey: "faqSourcingCategory",
    questionKey: "faqSourcingQuestion",
    answerKey: "faqSourcingAnswer",
  },
  {
    categoryKey: "faqClientCollaborationCategory",
    questionKey: "faqClientCollaborationQuestion",
    answerKey: "faqClientCollaborationAnswer",
  },
  {
    categoryKey: "faqCommercialCategory",
    questionKey: "faqCommercialQuestion",
    answerKey: "faqCommercialAnswer",
  },
  {
    categoryKey: "faqPlansCategory",
    questionKey: "faqPlansQuestion",
    answerKey: "faqPlansAnswer",
  },
];

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/7 bg-white/72 px-2.5 py-1 text-[10px] font-medium text-foreground/48">
      {children}
    </span>
  );
}

function Line({ className }: { className: string }) {
  return <div className={`rounded-full bg-stone-300/88 ${className}`} />;
}

function useLandingText() {
  const { t } = useI18n();
  return (key: string, values?: Record<string, string | number>) =>
    t("landingProductSections", key, values);
}

function ImagePanel({
  visual,
  className,
  imageClassName = "object-cover",
  children,
}: {
  visual: (typeof conceptVisuals)[number];
  className: string;
  imageClassName?: string;
  children?: ReactNode;
}) {
  const lt = useLandingText();

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-black/6 bg-[#e8e4dc] shadow-[0_22px_60px_rgba(24,20,16,0.05)] ${className}`}
    >
      <img
        src={visual.src}
        alt={lt(visual.titleKey)}
        className={`absolute inset-0 h-full w-full ${imageClassName}`}
        loading="eager"
      />
      {children}
    </div>
  );
}

function BrowserChrome({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center gap-2 border-b border-black/7 bg-[#f4f1eb]/92 px-4">
      <span className="h-2.5 w-2.5 rounded-full bg-black/16" />
      <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
      <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
      <div className="mx-auto hidden min-w-[14rem] rounded-full border border-black/7 bg-white/68 px-4 py-1 text-center text-[11px] font-medium text-foreground/42 sm:block">
        myvibe.app/{label}
      </div>
    </div>
  );
}

function ProductThumb({
  product,
  className = "",
}: {
  product: (typeof landingProducts)[number];
  className?: string;
}) {
  const lt = useLandingText();

  return (
    <div className={`overflow-hidden rounded-[16px] border border-black/6 bg-white/76 ${className}`}>
      <div className="relative aspect-[1.15/1] bg-[#eee9df]">
        <img
          src={product.src}
          alt={lt(product.nameKey)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate text-[12px] font-medium tracking-[-0.02em] text-foreground/84">
          {lt(product.nameKey)}
        </p>
        <div className="flex items-center justify-between gap-2 text-[10px] text-foreground/42">
          <span>{lt(product.categoryKey)}</span>
          <span>{product.price}</span>
        </div>
      </div>
    </div>
  );
}

function ConceptWorkspaceMock() {
  const lt = useLandingText();

  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[22px] border border-white/58 bg-[rgba(253,251,247,0.94)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md sm:top-[7%] sm:rounded-[24px] lg:inset-x-[6%]">
      <BrowserChrome label="projects/lounge-refresh" />
      <div className="grid min-h-[18.25rem] bg-white/58 text-foreground md:min-h-[25rem] md:grid-cols-[0.9fr_1.35fr]">
        <aside className="hidden border-r border-black/7 bg-[#f8f6f1]/86 p-4 md:block">
          <div className="flex items-center gap-2 text-[12px] font-medium text-foreground/72">
            <Sparkles className="h-3.5 w-3.5 text-[#f06422]" />
            {lt("mockLoungeRefresh")}
          </div>
          <div className="mt-6 space-y-2">
            {workspaceNavItems.map(({ labelKey, icon: Icon }, index) => (
              <div
                key={labelKey}
                className={`flex items-center gap-2 rounded-[14px] px-3 py-2 text-[12px] ${
                  index === 1 ? "bg-white text-foreground shadow-[0_8px_18px_rgba(24,20,16,0.05)]" : "text-foreground/46"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {lt(labelKey)}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[18px] border border-black/6 bg-white/62 p-3">
            <p className="text-[11px] font-medium text-foreground/50">{lt("aiNoteLabel")}</p>
            <p className="mt-2 text-[12px] leading-5 text-foreground/64">
              {lt("aiNoteBody")}
            </p>
          </div>
        </aside>

        <div className="min-w-0 p-3 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/34">
                {lt("conceptPack")}
              </p>
              <h4 className="mt-2 max-w-[12rem] text-[18px] font-medium leading-[1.12] tracking-[-0.04em] text-foreground sm:max-w-none sm:text-[20px]">
                {lt("layeredLoungeDirection")}
              </h4>
            </div>
            <span className="hidden sm:inline-flex">
              <StatusPill>{lt("sharedWithClient")}</StatusPill>
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="relative min-h-[9rem] overflow-hidden rounded-[18px] bg-[#e8e1d5] sm:min-h-[13.5rem] sm:rounded-[20px]">
              <img
                src="/landing/generated/barcelona-chair-room.png"
                alt={lt("layeredLoungeInteriorAlt")}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute left-3 top-3 rounded-full bg-white/76 px-3 py-1 text-[11px] font-medium text-foreground/62 backdrop-blur">
                {lt("roomVisual")}
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-3 sm:grid sm:grid-cols-1">
              {conceptProducts.map((product) => (
                <ProductThumb key={product.nameKey} product={product} />
              ))}
            </div>
          </div>

          <div className="mt-4 hidden gap-3 sm:grid sm:grid-cols-3">
            {["stat3Visuals", "stat4Products", "stat2Approvals"].map((item) => (
              <div key={item} className="rounded-[16px] border border-black/6 bg-white/72 px-3 py-3">
                <Line className="h-3 w-[52%]" />
                <p className="mt-2 text-[12px] font-medium text-foreground/68">{lt(item)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShoppingWorkspaceMock() {
  const lt = useLandingText();

  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[24px] border border-white/58 bg-[rgba(253,251,247,0.95)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md lg:inset-x-[6%]">
      <BrowserChrome label="projects/lounge-refresh/shopping" />
      <div className="grid min-h-[24rem] bg-white/62 p-4 text-foreground lg:grid-cols-[minmax(0,1fr)_210px] lg:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/34">
                {lt("shoppingList")}
              </p>
              <h4 className="mt-2 text-[20px] font-medium tracking-[-0.04em] text-foreground">
                {lt("loungePackage")}
              </h4>
            </div>
            <div className="flex gap-2">
              <StatusPill>EUR 9,226</StatusPill>
              <StatusPill>{lt("fourItems")}</StatusPill>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[18px] border border-black/7 bg-white/78">
            {shoppingProducts.map((product, index) => (
              <div
                key={product.nameKey}
                className={`grid grid-cols-[3.2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 ${
                  index > 0 ? "border-t border-black/6" : ""
                }`}
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-[12px] bg-[#ede8df]">
                  <img
                    src={product.src}
                    alt={lt(product.nameKey)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium tracking-[-0.02em] text-foreground/82">
                    {lt(product.nameKey)}
                  </p>
                  <p className="mt-1 text-[11px] text-foreground/42">
                    {lt(product.categoryKey)} / {lt(product.statusKey)}
                  </p>
                </div>
                <p className="text-[12px] font-medium text-foreground/62">{product.price}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="mt-4 hidden rounded-[18px] border border-black/7 bg-[#f8f6f1]/86 p-4 lg:block">
          <div className="flex items-center gap-2 text-[12px] font-medium text-foreground/66">
            <CircleDollarSign className="h-4 w-4 text-[#f06422]" />
            {lt("budgetImpact")}
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-[11px] text-foreground/44">
                <span>{lt("categoryFurniture")}</span>
                <span>72%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/7">
                <div className="h-full w-[72%] rounded-full bg-[#f06422]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-foreground/44">
                <span>{lt("finishes")}</span>
                <span>28%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/7">
                <div className="h-full w-[28%] rounded-full bg-[#1f4f3b]" />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {projectTasks.map((task) => (
              <div key={task.titleKey} className="rounded-[14px] bg-white/72 p-3">
                <div className="flex items-center gap-2 text-[11px] text-foreground/44">
                  <Clock3 className="h-3.5 w-3.5" />
                  {lt(task.statusKey)}
                </div>
                <p className="mt-1 text-[12px] font-medium leading-5 text-foreground/72">
                  {lt(task.titleKey)}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ClientReviewMock() {
  const lt = useLandingText();

  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[24px] border border-white/58 bg-[rgba(253,251,247,0.95)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md lg:inset-x-[6%]">
      <BrowserChrome label="client-review/lounge-refresh" />
      <div className="grid min-h-[24rem] gap-4 bg-white/62 p-4 text-foreground md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid min-w-0 gap-3">
          <div className="relative min-h-[11rem] overflow-hidden rounded-[20px] bg-[#e8e1d5]">
            <img
              src="/landing/generated/walnut-fluted-cabinet.png"
              alt={lt("clientReviewStorageAlt")}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute left-3 top-3 rounded-full bg-white/78 px-3 py-1 text-[11px] font-medium text-foreground/62 backdrop-blur">
              {lt("roomDirection")}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {reviewProducts.map((product) => (
              <div key={product.nameKey} className="relative aspect-square overflow-hidden rounded-[14px] bg-[#eee9df]">
                <img
                  src={product.src}
                  alt={lt(product.nameKey)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                <MessageSquare className="h-4 w-4 text-[#f06422]" />
                {lt("clientComments")}
              </div>
              <StatusPill>{lt("twoNew")}</StatusPill>
            </div>
            <div className="mt-4 grid gap-2">
              {["commentApproveWalnut", "commentCompareTerracotta"].map((comment) => (
                <div key={comment} className="rounded-[14px] bg-[#f8f6f1] p-3 text-[12px] leading-5 text-foreground/68">
                  {lt(comment)}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
              <FileCheck2 className="h-4 w-4 text-[#f06422]" />
              {lt("decisions")}
            </div>
            <div className="mt-4 grid gap-2">
              {reviewDecisions.map((decision) => (
                <div
                  key={decision.labelKey}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] bg-[#f8f6f1] px-3 py-2.5"
                >
                  <span className="truncate text-[12px] font-medium text-foreground/70">
                    {lt(decision.labelKey)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      decision.statusKey === "statusApproved"
                        ? "bg-[#eef4ef] text-[#42624b]"
                        : "bg-[#fff3eb] text-[#a35b2c]"
                    }`}
                  >
                    {lt(decision.statusKey)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommercialLayerSection() {
  const lt = useLandingText();

  return (
    <section className="grid items-center gap-10 border-t border-black/6 py-14 lg:grid-cols-[minmax(0,0.66fr)_0.34fr] lg:py-16">
      <div className="max-w-[30rem] lg:order-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          {lt("commercialLayerEyebrow")}
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.85rem,2.7vw,2.7rem)] font-medium leading-[1.03] tracking-[-0.04em] text-foreground">
          {lt("commercialLayerTitle")}
        </h3>
        <p className="mt-4 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          {lt("commercialLayerBody")}
        </p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-black/7 bg-[#e6ded1] p-3 shadow-[0_24px_70px_rgba(24,20,16,0.08)] lg:order-1">
        <div className="overflow-hidden rounded-[22px] border border-white/64 bg-[rgba(253,251,247,0.94)] shadow-[0_22px_60px_rgba(24,20,16,0.08)]">
          <BrowserChrome label="projects/lounge-refresh/commercial" />
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(17rem,0.95fr)]">
            <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <CreditCard className="h-4 w-4 text-[#f06422]" />
                  {lt("estimateTable")}
                </div>
                <StatusPill>EUR 9,226</StatusPill>
              </div>
              <div className="mt-4 overflow-hidden rounded-[16px] border border-black/6 bg-[#f8f6f1]">
                {estimateRows.map((row, index) => (
                  <div
                    key={row.itemKey}
                    className={`grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-3 px-3 py-3 ${
                      index > 0 ? "border-t border-black/6" : ""
                    }`}
                  >
                    <span className="truncate text-[12px] font-medium text-foreground/72">
                      {lt(row.itemKey)}
                    </span>
                    <span className="text-[11px] text-foreground/42">{lt(row.statusKey)}</span>
                    <span className="text-[12px] font-medium text-foreground/66">{row.amount}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[16px] bg-[#f8f6f1] p-3">
                  <p className="text-[11px] text-foreground/42">{lt("estimatePaidDeposit")}</p>
                  <p className="mt-2 text-[18px] font-medium tracking-[-0.04em] text-foreground/82">
                    EUR 2,750
                  </p>
                </div>
                <div className="rounded-[16px] bg-[#f8f6f1] p-3">
                  <p className="text-[11px] text-foreground/42">{lt("taskMetaClientReview")}</p>
                  <p className="mt-2 text-[18px] font-medium tracking-[-0.04em] text-foreground/82">
                    {lt("twoPending")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <FileCheck2 className="h-4 w-4 text-[#f06422]" />
                  {lt("approvalSurvey")}
                </div>
                <div className="mt-4 grid gap-2">
                  {["surveyChairSelection", "surveyGreenTileGrout", "surveyFinalPackage"].map((item, index) => (
                    <div key={item} className="rounded-[14px] bg-[#f8f6f1] p-3">
                      <div className="flex items-center justify-between text-[12px] font-medium text-foreground/70">
                        <span>{lt(item)}</span>
                        <span>{lt(index === 1 ? "statusPending" : "statusApproved")}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-black/7">
                        <div
                          className="h-full rounded-full bg-[#f06422]"
                          style={{ width: index === 1 ? "48%" : "100%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <BarChart3 className="h-4 w-4 text-[#f06422]" />
                  {lt("reportSummary")}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {reportMetrics.map((metric) => (
                    <div key={metric.labelKey} className="rounded-[14px] bg-[#f8f6f1] p-3">
                      <p className="text-[17px] font-medium tracking-[-0.04em] text-foreground/82">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-foreground/42">{lt(metric.labelKey)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductLibraryMock() {
  const lt = useLandingText();

  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[24px] border border-white/58 bg-[rgba(253,251,247,0.95)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md lg:inset-x-[6%]">
      <BrowserChrome label="product-library/approved" />
      <div className="min-h-[24rem] bg-white/62 p-4 text-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/34">
              {lt("approvedLibrary")}
            </p>
            <h4 className="mt-2 text-[20px] font-medium tracking-[-0.04em] text-foreground">
              {lt("loungeDecisions")}
            </h4>
          </div>
          <StatusPill>{lt("sixReusableProducts")}</StatusPill>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {libraryProducts.map((product, index) => (
            <div
              key={product.nameKey}
              className="overflow-hidden rounded-[18px] border border-black/6 bg-white/76"
            >
              <div className="relative aspect-[1.35/1] bg-[#eee9df]">
                <img
                  src={product.src}
                  alt={lt(product.nameKey)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-foreground/76">
                      {lt(product.nameKey)}
                    </p>
                    <p className="mt-1 text-[10px] text-foreground/40">{lt(product.categoryKey)}</p>
                  </div>
                  <span className="rounded-full bg-[#f8f6f1] px-2 py-1 text-[10px] font-medium text-foreground/48">
                    {lt(index === 1 ? "statusSupplierSaved" : index === 3 ? "statusReusable" : "statusApproved")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WebClipperMock() {
  const lt = useLandingText();

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[22px] bg-[#efebe4] text-foreground sm:rounded-[28px]">
      <div className="absolute inset-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="relative min-w-0 overflow-hidden bg-[#f4f1eb]">
          <div className="flex h-10 items-center justify-center gap-5 border-b border-black/7 bg-white/64 px-4 text-[13px] font-semibold text-foreground/48 sm:h-12 sm:gap-10">
            <span className="font-serif text-[22px] font-normal tracking-[-0.05em] text-foreground/42 sm:text-[24px]">
              JAPANDI
            </span>
            <span className="hidden sm:inline">{lt("categoryLighting")}</span>
            <span className="hidden sm:inline">{lt("homeDecor")}</span>
            <span className="hidden sm:inline">{lt("categoryFurniture")}</span>
          </div>
          <div className="h-full p-3 pb-24 opacity-52 sm:p-5 sm:pb-28 xl:pb-5 xl:pr-5">
            <div className="relative h-full min-h-[17rem] overflow-hidden rounded-[18px] bg-[#eee9df] sm:min-h-[28rem] sm:rounded-[20px]">
              <img
                src="/landing/generated/boucle-lounge-sofa.png"
                alt={lt("japandiSofaAlt")}
                className="absolute inset-0 h-full w-full object-contain object-center"
              />
            </div>
          </div>
          <div className="absolute inset-0 bg-[#1f2428]/24" />

          <div className="absolute inset-x-3 bottom-3 z-10 rounded-[16px] border border-white/55 bg-white/88 p-3 shadow-[0_16px_40px_rgba(24,20,16,0.18)] backdrop-blur-md sm:inset-x-5 sm:bottom-5 xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/40">
                  {lt("capturedProduct")}
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-foreground/82">
                  {lt("japandiRattanSofa")}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f4f1eb] px-3 py-1 text-[11px] font-medium text-foreground/58">
                $1,529
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="min-w-0 flex-1 rounded-[12px] border border-black/7 bg-white px-3 py-2 text-[11px] text-foreground/54">
                {lt("richardsonShoppingList")}
              </div>
              <button className="inline-flex h-9 shrink-0 items-center justify-center rounded-[12px] bg-foreground px-3 text-[11px] font-medium text-background">
                {lt("save")}
              </button>
            </div>
          </div>
        </div>

        <aside className="relative z-10 hidden h-full min-h-0 flex-col gap-3 border-l border-black/7 bg-[#f8f6f1] p-3 shadow-[-24px_0_70px_rgba(24,20,16,0.18)] xl:flex">
          <div className="shrink-0 rounded-[18px] border border-black/7 bg-white/86 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/38">
              {lt("activeProject")}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
                  Richardson
                </p>
                <p className="mt-1 text-[11px] text-foreground/44">Sonia Projects</p>
              </div>
              <StatusPill>{lt("live")}</StatusPill>
            </div>
          </div>

          <div className="shrink-0 rounded-[18px] border border-black/7 bg-white/86 p-4">
            <p className="text-[13px] font-semibold text-foreground/86">{lt("productImage")}</p>
            <div className="relative mt-4 aspect-[1.72/1] overflow-hidden rounded-[16px] bg-[#eee9df]">
              <img
                src="/landing/generated/boucle-lounge-sofa.png"
                alt={lt("capturedSofaAlt")}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-[12px] bg-[#f4f1eb] px-2 text-[12px] font-medium text-foreground/72">
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="truncate">{lt("pickExisting")}</span>
              </button>
              <button className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-[12px] border border-black/7 bg-white px-2 text-[12px] font-medium text-foreground/72">
                <Camera className="h-3.5 w-3.5" />
                <span className="truncate">{lt("captureArea")}</span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-[18px] border border-black/7 bg-white/86 p-4">
            <p className="text-[13px] font-semibold text-foreground/86">{lt("productDetails")}</p>
            <div className="mt-4 grid gap-2.5">
              <div>
                <p className="text-[11px] font-medium text-foreground/60">{lt("productNameRequired")}</p>
                <div className="mt-1 rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/76">
                  {lt("japandiRattanSofa")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium text-foreground/60">{lt("price")}</p>
                  <div className="mt-1 rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/76">
                    1529.00
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-foreground/60">{lt("quantity")}</p>
                  <div className="mt-1 rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/76">
                    1
                  </div>
                </div>
              </div>
              <div className="rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/68">
                {lt("uncategorizedDefault")}
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-[18px] bg-white p-2 shadow-[0_-10px_24px_rgba(24,20,16,0.08)]">
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-foreground text-sm font-medium text-background">
              <ShoppingCart className="h-4 w-4" />
              {lt("addToShoppingList")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WebClipperSection() {
  const lt = useLandingText();

  return (
    <section
      id="web-clipper"
      className="grid max-w-full items-center gap-7 overflow-hidden border-t border-black/6 py-10 xl:grid-cols-[minmax(0,0.64fr)_minmax(22rem,0.36fr)] xl:gap-10 xl:py-16"
    >
      <div className="relative h-[25rem] min-h-0 w-full max-w-full overflow-hidden rounded-[22px] border border-black/6 bg-[#e8e4dc] shadow-[0_18px_42px_rgba(24,20,16,0.05)] sm:h-[34rem] sm:max-w-[900px] sm:rounded-[28px] sm:shadow-[0_22px_60px_rgba(24,20,16,0.05)] lg:h-[39rem] xl:h-[48rem]">
        <WebClipperMock />
      </div>

      <div className="w-full max-w-[34rem] xl:pl-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          {lt("webClipperEyebrow")}
        </p>
        <h3 className="mt-4 text-balance text-[clamp(1.55rem,6vw,2.05rem)] font-medium leading-[1.08] tracking-[-0.03em] text-foreground xl:mt-5 xl:text-[clamp(1.75rem,2.4vw,2.35rem)]">
          {lt("webClipperTitle")}
        </h3>
        <p className="mt-3 text-pretty text-[1rem] leading-7 text-foreground/58 xl:text-[1.05rem] xl:leading-8">
          {lt("webClipperBody")}
        </p>
        <Button
          asChild
          className="mt-6 h-10 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Link href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer">
            <Chrome className="mr-2 h-4 w-4" />
            {lt("chromeWebStore")}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ShowcaseSection({
  id,
  visual,
  eyebrow,
  title,
  body,
  reverse = false,
  children,
}: {
  id: string;
  visual: (typeof conceptVisuals)[number];
  eyebrow: string;
  title: string;
  body: string;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`grid items-center gap-8 border-t border-black/6 py-12 lg:gap-12 lg:py-16 ${
        reverse
          ? "lg:grid-cols-[minmax(18rem,0.36fr)_minmax(0,0.64fr)]"
          : "lg:grid-cols-[minmax(0,0.64fr)_minmax(18rem,0.36fr)]"
      }`}
    >
      <ImagePanel
        visual={visual}
        className={`aspect-[1.34/1] min-h-[300px] w-full max-w-[860px] sm:min-h-[340px] ${
          reverse ? "lg:order-2 lg:justify-self-end" : ""
        }`}
      >
        {children}
      </ImagePanel>

      <div className={`max-w-[30rem] ${reverse ? "lg:order-1 lg:pl-0" : "lg:pl-2"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          {eyebrow}
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.75rem,2.4vw,2.35rem)] font-medium leading-[1.08] tracking-[-0.03em] text-foreground">
          {title}
        </h3>
        <p className="mt-3 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          {body}
        </p>
      </div>
    </section>
  );
}

function ProjectSystemSection() {
  const lt = useLandingText();

  return (
    <section className="grid items-center gap-10 border-t border-black/6 py-14 lg:grid-cols-[minmax(0,0.66fr)_0.34fr] lg:py-16">
      <div className="max-w-[30rem] lg:order-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          {lt("projectSystemEyebrow")}
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.85rem,2.7vw,2.7rem)] font-medium leading-[1.03] tracking-[-0.04em] text-foreground">
          {lt("projectSystemTitle")}
        </h3>
        <p className="mt-4 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          {lt("projectSystemBody")}
        </p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-black/7 bg-[#e6ded1] p-3 shadow-[0_24px_70px_rgba(24,20,16,0.08)] lg:order-1">
        <div className="overflow-hidden rounded-[22px] border border-white/64 bg-[rgba(253,251,247,0.94)] shadow-[0_22px_60px_rgba(24,20,16,0.08)]">
          <BrowserChrome label="projects/lounge-refresh/overview" />
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.9fr)]">
            <div className="grid gap-4">
              <div className="relative min-h-[18rem] overflow-hidden rounded-[20px] bg-[#e8e1d5]">
                <img
                  src="/landing/generated/oat-wool-grid-rug.png"
                  alt={lt("approvedRugAlt")}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-x-3 bottom-3 rounded-[18px] border border-white/52 bg-white/78 p-4 backdrop-blur-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/38">
                        {lt("approvedDirection")}
                      </p>
                      <p className="mt-1 text-[15px] font-medium tracking-[-0.03em] text-foreground/82">
                        {lt("approvedDirectionBody")}
                      </p>
                    </div>
                    <StatusPill>{lt("clientSignedOff")}</StatusPill>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["projectStatTasks", "projectStatTasksValue", "projectStatTasksMeta"],
                  ["projectStatBudget", "EUR 9.2k", "projectStatBudgetMeta"],
                  ["projectStatPortal", "projectStatPortalValue", "projectStatPortalMeta"],
                ].map(([title, value, meta]) => (
                  <div key={title} className="rounded-[18px] border border-black/6 bg-white/72 p-4">
                    <p className="text-[11px] font-medium text-foreground/42">{lt(title)}</p>
                    <p className="mt-2 text-[18px] font-medium tracking-[-0.04em] text-foreground/84">
                      {value.startsWith("project") ? lt(value) : value}
                    </p>
                    <p className="mt-1 text-[11px] text-foreground/38">{lt(meta)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[20px] border border-black/6 bg-white/72 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                    <ListChecks className="h-4 w-4 text-[#f06422]" />
                    {lt("nextActions")}
                  </div>
                  <StatusPill>{lt("live")}</StatusPill>
                </div>
                <div className="mt-4 grid gap-2">
                  {projectTasks.map((task) => (
                    <div
                      key={task.titleKey}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[14px] bg-[#f8f6f1] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-foreground/72">
                          {lt(task.titleKey)}
                        </p>
                        <p className="mt-1 text-[11px] text-foreground/38">{lt(task.metaKey)}</p>
                      </div>
                      <span className="text-[11px] font-medium text-foreground/44">{lt(task.statusKey)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] border border-black/6 bg-white/72 p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <ShoppingCart className="h-4 w-4 text-[#f06422]" />
                  {lt("reusableLibrary")}
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {projectSystemProducts.map((product) => (
                    <div key={product.nameKey} className="relative aspect-square overflow-hidden rounded-[12px] bg-[#eee9df]">
                      <img
                        src={product.src}
                        alt={lt(product.nameKey)}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[14px] bg-[#f8f6f1] p-3">
                  <div className="flex items-center justify-between text-[11px] text-foreground/44">
                    <span>{lt("savedForNextProject")}</span>
                    <span>{lt("fourProducts")}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-black/7">
                    <div className="h-full w-[64%] rounded-full bg-[#f06422]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection({ isSignedIn }: { isSignedIn: boolean }) {
  const lt = useLandingText();
  const { locale } = useI18n();
  const billingCurrency = locale === "pl" ? "pln" : "usd";

  return (
    <section
      id="pricing"
      className="flex min-w-0 flex-col gap-8 border-t border-black/6 py-12 lg:py-14"
    >
      <div className="min-w-0 max-w-[44rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          {lt("pricingEyebrow")}
        </p>
        <h3 className="mt-4 text-balance text-[clamp(1.7rem,2.4vw,2.35rem)] font-medium leading-[1.04] tracking-[-0.04em] text-foreground">
          {lt("pricingTitle")}
        </h3>
        <p className="mt-3 max-w-2xl text-pretty text-[1rem] leading-7 text-foreground/58">
          {lt("pricingBody")}
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <BillingPlanCard
            key={plan.key}
            plan={plan}
            currency={billingCurrency}
            locale={locale}
            availabilityLabel={lt("available")}
            availabilityVariant="outline"
            footer={
              <Button
                asChild
                className="w-full"
              >
                <Link href={isSignedIn ? "/organisation/subscription" : "/sign-up"}>
                  {lt(isSignedIn ? "openSubscription" : "startWithMyvibe")}
                </Link>
              </Button>
            }
          />
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  const lt = useLandingText();

  return (
    <section
      id="faq"
      className="grid items-start gap-8 border-t border-black/6 py-12 lg:grid-cols-[0.32fr_minmax(0,0.68fr)] lg:py-14"
    >
      <div className="max-w-[28rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          {lt("faqEyebrow")}
        </p>
        <h3 className="mt-4 text-balance text-[clamp(1.75rem,2.35vw,2.35rem)] font-medium leading-[1.04] tracking-[-0.04em] text-foreground">
          {lt("faqTitle")}
        </h3>
        <p className="mt-3 max-w-sm text-pretty text-[0.95rem] leading-7 text-foreground/56">
          {lt("faqBody")}
        </p>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-black/7 bg-white/55 shadow-[0_18px_60px_rgba(24,22,18,0.05)]">
        {faqItems.map((item, index) => (
          <details
            key={item.questionKey}
            className="group border-b border-black/6 last:border-b-0 open:bg-[#f7f4ed]"
            open={index === 0}
          >
            <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left marker:hidden sm:px-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ebe5d8] text-[11px] font-semibold tabular-nums text-foreground/46">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/36">
                  {lt(item.categoryKey)}
                </span>
                <span className="block text-[0.98rem] font-medium leading-6 tracking-[-0.02em] text-foreground/86">
                  {lt(item.questionKey)}
                </span>
              </span>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/7 bg-white/76 text-foreground/54 transition group-open:rotate-180">
                <ChevronDown className="h-4 w-4" />
              </span>
            </summary>
            <p className="max-w-2xl pb-5 pl-16 pr-5 text-[0.92rem] leading-7 text-foreground/58 sm:pl-[4.25rem]">
              {lt(item.answerKey)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ProductSections() {
  const { isSignedIn } = useUser();
  const lt = useLandingText();

  return (
    <div className="overflow-x-hidden px-4 pb-14 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-[1520px]">
        <section className="max-w-3xl pb-14 pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
            {lt("productOverview")}
          </p>
          <h2 className="mt-5 max-w-[16ch] text-balance text-[clamp(1.9rem,3.4vw,3.1rem)] font-medium leading-[1] tracking-[-0.04em] text-foreground">
            {lt("productOverviewTitle")}
          </h2>
          <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-foreground/56">
            {lt("productOverviewBody")}
          </p>
        </section>

        <ShowcaseSection
          id="product"
          visual={conceptVisuals[0]}
          eyebrow={lt("conceptWorkflowEyebrow")}
          title={lt("conceptWorkflowTitle")}
          body={lt("conceptWorkflowBody")}
        >
          <ConceptWorkspaceMock />
        </ShowcaseSection>

        <ShowcaseSection
          id="workflow"
          visual={conceptVisuals[1]}
          eyebrow={lt("workflowEyebrow")}
          title={lt("workflowTitle")}
          body={lt("workflowBody")}
          reverse
        >
          <ShoppingWorkspaceMock />
        </ShowcaseSection>

        <ProjectSystemSection />

        <ShowcaseSection
          id="client-collaboration"
          visual={conceptVisuals[2]}
          eyebrow={lt("clientCollaborationEyebrow")}
          title={lt("clientCollaborationTitle")}
          body={lt("clientCollaborationBody")}
          reverse
        >
          <ClientReviewMock />
        </ShowcaseSection>

        <CommercialLayerSection />

        <ShowcaseSection
          id="resources"
          visual={conceptVisuals[3]}
          eyebrow={lt("studioMemoryEyebrow")}
          title={lt("studioMemoryTitle")}
          body={lt("studioMemoryBody")}
          reverse
        >
          <ProductLibraryMock />
        </ShowcaseSection>

        <WebClipperSection />

        <PricingSection isSignedIn={isSignedIn ?? false} />

        <FAQSection />

        <section className="flex flex-col items-start justify-between gap-6 border-t border-black/6 pt-10 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
              {lt("nextStep")}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-foreground/54">
              {lt("nextStepBody")}
            </p>
          </div>

          <Button asChild className="h-10 rounded-full px-4 text-sm font-medium">
            <Link href={isSignedIn ? "/organisation" : "/sign-up"}>
              {lt(isSignedIn ? "openDashboard" : "startWithMyvibe")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
