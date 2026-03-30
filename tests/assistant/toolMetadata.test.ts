import assert from "node:assert/strict";
import test from "node:test";

import {
  buildToolExecutionPolicy,
  buildToolPromptList,
  getAssistantToolApprovalMode,
  getAssistantToolDefaults,
  isReadOnlyAssistantTool,
  shouldPersistPendingToolCall,
} from "../../convex/ai/toolMetadata.ts";
import { buildDefaultPrompt } from "../../convex/ai/prompt.ts";

test("tool metadata marks search and context loaders as read-only", () => {
  assert.equal(isReadOnlyAssistantTool("search_items"), true);
  assert.equal(isReadOnlyAssistantTool("load_full_project_context"), true);
  assert.equal(isReadOnlyAssistantTool("create_item"), false);
});

test("tool metadata exposes fallback defaults for mutating tools", () => {
  assert.deepEqual(getAssistantToolDefaults("create_item"), { operation: "create" });
  assert.deepEqual(getAssistantToolDefaults("update_project_settings"), {
    type: "projectSettings",
    operation: "edit",
  });
});

test("tool metadata persists pending state only for actionable confirmation tools", () => {
  assert.equal(
    shouldPersistPendingToolCall("create_item", { type: "task", operation: "create" }),
    true,
  );
  assert.equal(
    shouldPersistPendingToolCall("search_items", { type: "task", operation: "create" }),
    false,
  );
  assert.equal(
    shouldPersistPendingToolCall("generate_moodboard_image", null),
    false,
  );
  assert.equal(
    shouldPersistPendingToolCall("create_item", { error: "missing title" }),
    false,
  );
});

test("default prompt is generated from the shared tool registry", () => {
  const prompt = buildDefaultPrompt(["create_item", "search_items"]);
  const toolLines = buildToolPromptList(["create_item", "search_items"]);
  const executionPolicy = buildToolExecutionPolicy(["create_item", "search_items"]);

  assert.equal(toolLines.length, 2);
  assert.equal(executionPolicy.length, 2);
  assert.match(prompt, /- create_item: Create one project item\. \[requires-confirmation\]/);
  assert.match(prompt, /- search_items: Search existing tasks.*\[read-only\]/);
  assert.match(prompt, /Read-only tools execute immediately: search_items\./);
  assert.match(prompt, /Mutating tools create drafts that require UI confirmation before persistence: create_item\./);
  assert.doesNotMatch(prompt, /generate_moodboard_image/);
});

test("tool metadata exposes approval mode for prompt and confirmation flows", () => {
  assert.equal(getAssistantToolApprovalMode("search_items"), "read-only");
  assert.equal(getAssistantToolApprovalMode("create_item"), "requires-confirmation");
});
