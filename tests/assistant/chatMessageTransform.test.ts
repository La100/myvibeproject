import assert from "node:assert/strict";
import test from "node:test";

import { mergePersistentCallState } from "../../components/ai/assistant/data/hooks/chatMessageTransform.ts";

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
    ] as any,
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
    ] as any,
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
