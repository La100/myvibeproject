import assert from "node:assert/strict";
import test from "node:test";

import { dedupeActivityLogActivities } from "../../lib/activityLogDeduplication.ts";

test("dedupes repeated customer decisions within the duplicate window", () => {
  const result = dedupeActivityLogActivities([
    {
      _creationTime: 10_000,
      actionType: "shopping.customer.decision",
      entityId: "item-1",
      details: {
        decision: "approved",
        actorName: "Anna",
        itemName: "Farba",
      },
    },
    {
      _creationTime: 11_500,
      actionType: "shopping.customer.decision",
      entityId: "item-1",
      details: {
        decision: "approved",
        actorName: "Anna",
        itemName: "Farba",
      },
    },
  ]);

  assert.equal(result.length, 1);
});

test("keeps separate customer decisions outside the duplicate window", () => {
  const result = dedupeActivityLogActivities([
    {
      _creationTime: 10_000,
      actionType: "shopping.customer.decision",
      entityId: "item-1",
      details: {
        decision: "approved",
        actorName: "Anna",
        itemName: "Farba",
      },
    },
    {
      _creationTime: 12_100,
      actionType: "shopping.customer.decision",
      entityId: "item-1",
      details: {
        decision: "approved",
        actorName: "Anna",
        itemName: "Farba",
      },
    },
  ]);

  assert.equal(result.length, 2);
});

test("drops empty feedback when a matching decision was already logged", () => {
  const result = dedupeActivityLogActivities([
    {
      _creationTime: 10_000,
      actionType: "shopping.customer.decision",
      entityId: "item-1",
      details: {
        decision: "rejected",
        actorName: "Anna",
        itemName: "Walek",
      },
    },
    {
      _creationTime: 10_500,
      actionType: "shopping.customer.feedback",
      entityId: "item-1",
      details: {
        decision: "rejected",
        actorName: "Anna",
        itemName: "Walek",
        comment: "   ",
      },
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.actionType, "shopping.customer.decision");
});

test("keeps feedback with a real comment even when decision exists", () => {
  const result = dedupeActivityLogActivities([
    {
      _creationTime: 10_000,
      actionType: "shopping.customer.decision",
      entityId: "item-1",
      details: {
        decision: "approved",
        actorName: "Anna",
        itemName: "Lampa",
      },
    },
    {
      _creationTime: 10_500,
      actionType: "shopping.customer.feedback",
      entityId: "item-1",
      details: {
        decision: "approved",
        actorName: "Anna",
        itemName: "Lampa",
        comment: "Bierzemy ten wariant",
      },
    },
  ]);

  assert.equal(result.length, 2);
});
