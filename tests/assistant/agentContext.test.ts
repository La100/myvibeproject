import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeIncompleteToolHistory } from "../../convex/ai/helpers/sanitizeToolHistory.ts";

test("sanitizeIncompleteToolHistory drops orphan tool approval responses", () => {
  const sanitized = sanitizeIncompleteToolHistory([
    {
      role: "assistant",
      content: [
        {
          type: "tool-approval-response",
          approvalId: "missing-approval",
          approved: true,
        },
        {
          type: "text",
          text: "hello",
        },
      ],
    },
  ] as never);

  assert.deepEqual(sanitized, [
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "hello",
        },
      ],
    },
  ]);
});

test("sanitizeIncompleteToolHistory keeps matched tool approval responses", () => {
  const sanitized = sanitizeIncompleteToolHistory([
    {
      role: "assistant",
      content: [
        {
          type: "tool-approval-request",
          approvalId: "approval-1",
          toolCallId: "call-1",
        },
        {
          type: "tool-approval-response",
          approvalId: "approval-1",
          approved: true,
        },
        {
          type: "text",
          text: "done",
        },
      ],
    },
  ] as never);

  assert.deepEqual(sanitized, [
    {
      role: "assistant",
      content: [
        {
          type: "tool-approval-request",
          approvalId: "approval-1",
          toolCallId: "call-1",
        },
        {
          type: "tool-approval-response",
          approvalId: "approval-1",
          approved: true,
        },
        {
          type: "text",
          text: "done",
        },
      ],
    },
  ]);
});
