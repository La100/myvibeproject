import assert from "node:assert/strict";
import test from "node:test";

import {
  isClientNotificationAction,
  isClientNotificationActivity,
} from "../../lib/projectClientNotifications.ts";

test("recognizes actions that should notify the client", () => {
  assert.equal(isClientNotificationAction("shopping.customer.decision"), true);
  assert.equal(isClientNotificationAction("survey.response.submit"), true);
});

test("rejects unrelated actions", () => {
  assert.equal(isClientNotificationAction("approval.create"), false);
  assert.equal(
    isClientNotificationActivity({ actionType: "milestone.update" }),
    false,
  );
});
