import assert from "node:assert/strict";
import test from "node:test";

import {
  mergePersistentCallState,
  supersedeStaleApprovalMessages,
} from "../../components/ai/assistant/data/hooks/chatMessageTransform.ts";

type TestUIMessage = {
  role: "assistant" | "user";
  text: string;
  parts: Array<Record<string, unknown>>;
};

test("mergePersistentCallState refreshes pending tool-result payload after a refinement", () => {
  const merged = mergePersistentCallState(
    [
      {
        role: "assistant",
        text: "",
        parts: [
          {
            type: "tool-result:call_task",
            result: JSON.stringify({
              type: "task",
              operation: "create",
              data: { title: "Test task" },
            }),
          },
        ],
      },
    ] as TestUIMessage[],
    [
      {
        callId: "call_task",
        status: "pending",
        arguments: JSON.stringify({
          type: "task",
          operation: "create",
          data: {
            title: "Test task",
            assignedTo: "user_123",
          },
        }),
      },
    ],
  );

  const result = JSON.parse(
    ((merged?.[0]?.parts?.[0] as { result?: string })?.result as string) ?? "{}",
  );

  assert.equal(result.data.title, "Test task");
  assert.equal(result.data.assignedTo, "user_123");
});

test("mergePersistentCallState marks superseded tool results so stale confirmations can disappear", () => {
  const merged = mergePersistentCallState(
    [
      {
        role: "assistant",
        text: "",
        parts: [
          {
            type: "tool-result:call_task",
            result: JSON.stringify({
              type: "task",
              operation: "create",
              data: { title: "Old task" },
            }),
          },
        ],
      },
    ] as TestUIMessage[],
    [
      {
        callId: "call_task",
        status: "superseded",
        result: JSON.stringify({
          status: "superseded",
          result: "Superseded by a newer user message.",
        }),
        arguments: JSON.stringify({
          type: "task",
          operation: "create",
          data: { title: "Old task" },
        }),
      },
    ],
  );

  const result = JSON.parse(
    ((merged?.[0]?.parts?.[0] as { result?: string })?.result as string) ?? "{}",
  );

  assert.equal(result.status, "superseded");
});

test("supersedeStaleApprovalMessages removes stale approval cards after a newer user follow-up", () => {
  const transformed = supersedeStaleApprovalMessages(
    [
      {
        role: "assistant",
        text: "",
        parts: [
          {
            type: "tool-call",
            toolCallId: "call_1",
            toolName: "manage_shopping",
            state: "approval-requested",
          },
          {
            type: "tool-result:call_1",
            result: JSON.stringify({
              type: "shopping",
              operation: "create",
              approvalState: "approval-requested",
              data: { name: "Testowy item" },
            }),
          },
        ],
      },
      {
        role: "user",
        text: "napisz go po francusku",
        parts: [{ type: "text", text: "napisz go po francusku" }],
      },
    ] as TestUIMessage[],
  );

  assert.ok(transformed);
  assert.equal(transformed?.[0]?.parts?.length, 0);
});

test("mergePersistentCallState preserves reasoning parts for streaming reasoning UI", () => {
  const merged = mergePersistentCallState(
    [
      {
        role: "assistant",
        text: "",
        parts: [
          {
            type: "reasoning",
            text: "Najpierw sprawdze dane projektu, potem dodam zadanie.",
          },
          {
            type: "text",
            text: "Dodaje zadanie.",
          },
        ],
      },
    ] as TestUIMessage[],
    [],
  );

  assert.equal(merged?.[0]?.parts?.[0]?.type, "reasoning");
  assert.equal(
    (merged?.[0]?.parts?.[0] as { text?: string })?.text,
    "Najpierw sprawdze dane projektu, potem dodam zadanie.",
  );
});
