import {
  AI_CORE_MONTHLY_TOKENS,
  AI_PRO_MONTHLY_TOKENS,
} from "@/lib/aiPricing";

export const BILLING_PLANS = [
  {
    key: "core",
    name: "Core",
    prices: {
      usd: 39,
      pln: 99,
    },
    monthlyCreditsPerUser: AI_CORE_MONTHLY_TOKENS,
    description:
      "Project operations for studios that need clients, budgets, documents, and delivery in one workspace.",
    limits: [
      "50 active projects with clients and decisions",
      "Budgets, tasks, documents, exports, and team workflow",
      "1.0M AI credits for light assistant and visualization work",
    ],
  },
  {
    key: "ai",
    name: "Studio AI",
    prices: {
      usd: 59,
      pln: 149,
    },
    monthlyCreditsPerUser: AI_PRO_MONTHLY_TOKENS,
    description:
      "For studios using AI regularly for project context, visual exploration, and client variants.",
    limits: [
      "Everything in Core",
      "3.0M AI credits for regular project-aware AI work",
      "Visualizations, references, and client-facing variants",
    ],
  },
] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];
export type BillingPlanKey = BillingPlan["key"];
export type BillingCurrency = "usd" | "pln";
