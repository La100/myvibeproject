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
  assert.equal(isReadOnlyAssistantTool("web_search"), true);
  assert.equal(isReadOnlyAssistantTool("search_items"), true);
  assert.equal(isReadOnlyAssistantTool("load_full_project_context"), true);
  assert.equal(isReadOnlyAssistantTool("manage_tasks"), false);
});

test("tool metadata exposes fallback defaults for mutating tools", () => {
  assert.deepEqual(getAssistantToolDefaults("manage_tasks"), { type: "task" });
  assert.deepEqual(getAssistantToolDefaults("update_project_settings"), {
    type: "projectSettings",
    operation: "edit",
  });
});

test("tool metadata persists pending state only for actionable confirmation tools", () => {
  assert.equal(
    shouldPersistPendingToolCall("manage_tasks", { type: "task", operation: "create" }),
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
    shouldPersistPendingToolCall("manage_tasks", { error: "missing title" }),
    false,
  );
});

test("default prompt is generated from the shared tool registry", () => {
  const prompt = buildDefaultPrompt(["web_search", "manage_tasks", "search_items"]);
  const toolLines = buildToolPromptList(["web_search", "manage_tasks", "search_items"]);
  const executionPolicy = buildToolExecutionPolicy(["web_search", "manage_tasks", "search_items"]);

  assert.equal(toolLines.length, 3);
  assert.equal(executionPolicy.length, 2);
  assert.match(prompt, /You are Vibe, the AI copilot for interior design and architecture project management\./);
  assert.match(prompt, /If a task, note, contact, shopping item, labor item, labor section, shopping section, or survey should be created, updated, or deleted, use the corresponding management tool directly\./);
  assert.match(prompt, /- web_search: Search the public web for up-to-date external information and return cited results\. \[read-only\]/);
  assert.match(prompt, /- manage_tasks: Manage tasks with a single tool for create, update, or delete\. \[requires-confirmation\]/);
  assert.match(prompt, /- search_items: Search existing tasks.*\[read-only\]/);
  assert.match(prompt, /Read-only tools execute immediately: web_search, search_items\./);
  assert.doesNotMatch(prompt, /generate_moodboard_image/);
});

test("default prompt switches to read-only contract when mutating tools are unavailable", () => {
  const prompt = buildDefaultPrompt(["web_search", "search_items"]);

  assert.match(prompt, /Editing is disabled in this runtime\. Only read-only tools are available\./);
  assert.match(prompt, /Do not attempt to create, update, delete, or promise changes to project data\./);
  assert.doesNotMatch(prompt, /Do not assume editing is disabled\./);
  assert.doesNotMatch(prompt, /use the corresponding management tool directly\./);
});

test("tool metadata exposes approval mode for prompt and confirmation flows", () => {
  assert.equal(getAssistantToolApprovalMode("web_search"), "read-only");
  assert.equal(getAssistantToolApprovalMode("search_items"), "read-only");
  assert.equal(getAssistantToolApprovalMode("manage_tasks"), "requires-confirmation");
});
