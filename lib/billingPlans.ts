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
      "Project workspace with a practical AI allowance for studios getting daily work under control.",
    limits: [
      "Projects, clients, and decisions in one workspace",
      "Light AI assistant allowance included",
      "Reports, documents, and team organization",
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
      "For designers and project managers using AI in regular client and project work.",
    limits: [
      "Everything in Core",
      "AI assistant for project work",
      "Visualizations and client-facing variants",
    ],
  },
] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];
export type BillingPlanKey = BillingPlan["key"];
export type BillingCurrency = "usd" | "pln";
