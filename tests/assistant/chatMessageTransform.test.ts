import assert from "node:assert/strict";
import test from "node:test";

import { mergePersistentCallState } from "../../components/ai/assistant/data/hooks/chatMessageTransform.ts";

test("adds tool-result after confirmation and strips reasoning/thinking", () => {
  const uiMessages: any[] = [
    {
      id: "m1",
      role: "assistant",
      parts: [
        { type: "text", text: "Juz robie<thinking>sekret</thinking>\n" },
        { type: "reasoning", text: "internal" },
        {
          type: "tool-create_item",
          toolCallId: "call-1",
          toolName: "create_item",
        },
      ],
      text: "Juz robie<thinking>sekret</thinking>",
    },
  ];

  const persistentCalls = [
    {
      callId: "call-1",
      status: "confirmed",
      arguments: JSON.stringify({ name: "Farba", quantity: 1 }),
      result: JSON.stringify({ success: true }),
    },
  ];

  const merged = mergePersistentCallState(uiMessages as any, persistentCalls as any);
  assert.ok(merged);
  assert.equal(merged?.length, 1);

  const parts = merged?.[0].parts as any[];
  assert.equal(parts.some((p) => p.type === "reasoning"), false);
  assert.equal(parts.some((p) => p.type === "text" && p.text === "Juz robie"), true);

  const toolResult = parts.find((p) => p.type === "tool-result:call-1");
  assert.ok(toolResult);

  const parsedResult = JSON.parse(toolResult.result);
  assert.equal(parsedResult.status, "confirmed");
  assert.equal(parsedResult.name, "Farba");
  assert.equal(parsedResult.quantity, 1);
  assert.deepEqual(parsedResult.outcome, { success: true });
  assert.equal(merged?.[0].text, "Juz robie");
});

test("updates existing tool-result status from pending to confirmed", () => {
  const uiMessages: any[] = [
    {
      id: "m2",
      role: "assistant",
      parts: [
        {
          type: "tool-result:call-2",
          result: JSON.stringify({ status: "pending", name: "Walek" }),
        },
      ],
    },
  ];

  const persistentCalls = [
    {
      callId: "call-2",
      status: "confirmed",
      arguments: JSON.stringify({ name: "Walek" }),
      result: JSON.stringify({ success: true }),
    },
  ];

  const merged = mergePersistentCallState(uiMessages as any, persistentCalls as any);
  const toolResult = (merged?.[0].parts as any[]).find((p) => p.type === "tool-result:call-2");
  const parsed = JSON.parse(toolResult.result);

  assert.equal(parsed.status, "confirmed");
  assert.equal(parsed.name, "Walek");
  assert.deepEqual(parsed.outcome, { success: true });
});
