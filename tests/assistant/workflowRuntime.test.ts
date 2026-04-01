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

  assert.equal(runtime.allowedToolNames.includes("manage_tasks"), true);
  assert.match(runtime.workflowSection ?? "", /WORKFLOW MODE - GUIDED FLOW/);
  assert.match(runtime.workflowSection ?? "", /Step 5 of 5/);
});

test("buildWorkflowRuntimeContext falls back to full runtime tools for invalid step", () => {
  const runtime = buildWorkflowRuntimeContext({
    workflowId: "floor-plan-analysis",
    stepId: "missing-step",
  });

  assert.equal(runtime.workflowSection, null);
  assert.equal(runtime.allowedToolNames.includes("manage_tasks"), true);
  assert.equal(runtime.allowedToolNames.includes("manage_notes"), true);
  assert.equal(runtime.allowedToolNames.includes("search_items"), true);
});

test("buildWorkflowRuntimeContext restricts workflow tools to read-only in always_ask mode", () => {
  const runtime = buildWorkflowRuntimeContext(
    {
      workflowId: "floor-plan-analysis",
      stepId: "schedule",
    },
    false,
    "always_ask",
  );

  assert.deepEqual(runtime.allowedToolNames.sort(), ["search_items", "web_search"]);
  assert.match(runtime.workflowSection ?? "", /WORKFLOW MODE - GUIDED FLOW/);
});

test("buildWorkflowRuntimeContext falls back to read-only tools for invalid step in always_ask mode", () => {
  const runtime = buildWorkflowRuntimeContext(
    {
      workflowId: "floor-plan-analysis",
      stepId: "missing-step",
    },
    false,
    "always_ask",
  );

  assert.deepEqual(runtime.allowedToolNames.sort(), ["search_items", "web_search"]);
});
