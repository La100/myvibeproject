import { cronJobs, makeFunctionReference } from "convex/server";
import type { SchedulableFunctionReference } from "convex/server";

const reconcileHostedChatKitUsage =
  makeFunctionReference<"action">(
    "ai/hostedChatkitBillingActions:reconcileHostedChatKitUsage",
  ) as SchedulableFunctionReference;

const crons = cronJobs();

crons.interval(
  "reconcile hosted chatkit usage",
  { minutes: 5 },
  reconcileHostedChatKitUsage,
  {},
);

export default crons;
