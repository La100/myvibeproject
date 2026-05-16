import {
  AI_PRO_MONTHLY_TOKENS,
  AI_SCALE_MONTHLY_TOKENS,
} from "@/lib/aiPricing";

export const BILLING_PLANS = [
  {
    key: "core",
    name: "Core",
    prices: {
      usd: 15,
      pln: 59,
    },
    monthlyCreditsPerUser: 0,
    description:
      "Operational workspace for studios that want projects, clients, budgets, and decisions in one place.",
    limits: [
      "Projects, clients, and decisions in one workspace",
      "Budgets, shopping lists, and product library",
      "Reports, documents, and team organization",
    ],
  },
  {
    key: "ai",
    name: "Studio AI",
    prices: {
      usd: 29,
      pln: 119,
    },
    monthlyCreditsPerUser: AI_PRO_MONTHLY_TOKENS,
    description:
      "For designers and project managers using AI in regular client and project work.",
    limits: [
      "Everything in Core",
      "AI assistant for project work",
      "Visualizations and client-facing variants",
    ],
  },
  {
    key: "ai_scale",
    name: "Studio AI Plus",
    prices: {
      usd: 59,
      pln: 249,
    },
    monthlyCreditsPerUser: AI_SCALE_MONTHLY_TOKENS,
    description:
      "For people who use AI and visual exploration as a daily part of the studio process.",
    limits: [
      "Everything in Studio AI",
      "Larger AI allowance per seat",
      "Built for many parallel projects",
    ],
  },
] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];
export type BillingPlanKey = BillingPlan["key"];
export type BillingCurrency = "usd" | "pln";
