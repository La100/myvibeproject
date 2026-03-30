import assert from "node:assert/strict";
import test from "node:test";

import { recoverReplayedCallStatus } from "../../convex/ai/helpers/replayStatus.ts";

test("recoverReplayedCallStatus keeps explicit rejected status from JSON result", () => {
  assert.equal(
    recoverReplayedCallStatus(
      "replayed",
      JSON.stringify({ status: "rejected", result: "User rejected this action." }),
    ),
    "rejected",
  );
});

test("recoverReplayedCallStatus treats plain rejection strings as rejected", () => {
  assert.equal(
    recoverReplayedCallStatus("replayed", "User rejected this action."),
    "rejected",
  );
});

test("recoverReplayedCallStatus leaves non-replayed statuses unchanged", () => {
  assert.equal(
    recoverReplayedCallStatus("confirmed", "User rejected this action."),
    "confirmed",
  );
});
