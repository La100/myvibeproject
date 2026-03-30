import assert from "node:assert/strict";
import test from "node:test";

import { buildWorkflowRuntimeContext } from "../../convex/ai/helpers/workflowRuntime.ts";

test("buildWorkflowRuntimeContext returns workflow section and step allowlist", () => {
  const runtime = buildWorkflowRuntimeContext({
    workflowId: "floor-plan-analysis",
    stepId: "schedule",
    previousResponses: [
      {
        stepId: "room-analysis",
        response: "Bedrooms and kitchen identified.",
      },
    ],
  });

  assert.equal(runtime.allowedToolNames.includes("update_item"), true);
  assert.equal(runtime.allowedToolNames.includes("update_multiple_items"), true);
  assert.equal(runtime.allowedToolNames.includes("create_item"), false);
  assert.match(runtime.workflowSection ?? "", /WORKFLOW MODE - GUIDED FLOW/);
  assert.match(runtime.workflowSection ?? "", /Step 5 of 5/);
});

test("buildWorkflowRuntimeContext falls back to full runtime tools for invalid step", () => {
  const runtime = buildWorkflowRuntimeContext({
    workflowId: "floor-plan-analysis",
    stepId: "missing-step",
  });

  assert.equal(runtime.workflowSection, null);
  assert.equal(runtime.allowedToolNames.includes("create_item"), true);
  assert.equal(runtime.allowedToolNames.includes("update_item"), true);
  assert.equal(runtime.allowedToolNames.includes("search_items"), true);
});
