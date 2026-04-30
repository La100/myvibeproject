import {
  AI_PRO_MONTHLY_TOKENS,
  AI_SCALE_MONTHLY_TOKENS,
} from "@/lib/aiPricing";

export const BILLING_PLANS = [
  {
    key: "ai",
    name: "AI Pro",
    price: 39,
    monthlyCredits: AI_PRO_MONTHLY_TOKENS,
    description:
      "Best for teams using the assistant and visualizations every week.",
    limits: ["20 active projects", "2 team members", "50 GB storage"],
  },
  {
    key: "ai_scale",
    name: "AI Scale",
    price: 99,
    monthlyCredits: AI_SCALE_MONTHLY_TOKENS,
    description:
      "Higher monthly AI volume with stronger workspace limits and better token value.",
    limits: ["75 active projects", "100 team members", "250 GB storage"],
  },
] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];
export type BillingPlanKey = BillingPlan["key"];
