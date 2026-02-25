import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const getCreateStreamingTools = async () => {
  const globalWithRequire = globalThis as typeof globalThis & {
    require?: ReturnType<typeof createRequire>;
  };
  if (!globalWithRequire.require) {
    globalWithRequire.require = createRequire(
      new URL("../../convex/ai/tools.ts", import.meta.url),
    );
  }
  const mod = await import("../../convex/ai/tools.ts");
  return mod.createStreamingTools;
};

test("update_item uses runQuery for getItemById lookup", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const calls = { runAction: 0, runQuery: 0 };

  const tools = createStreamingTools({
    projectId: "project_1",
    runAction: async () => {
      calls.runAction += 1;
      return null;
    },
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => {
      calls.runQuery += 1;
      return {
        _id: args.itemId,
        projectId: "project_1",
        name: "Farba",
      };
    },
  });

  const raw = await tools.update_item.execute({
    type: "shopping",
    itemId: "shopping_1",
    data: { unitPrice: 99 },
  });
  const parsed = JSON.parse(raw);

  assert.equal(calls.runQuery, 1);
  assert.equal(calls.runAction, 0);
  assert.equal(parsed.operation, "edit");
  assert.equal(parsed.originalItem._id, "shopping_1");
});

test("update_item accepts top-level shopping price fields without data wrapper", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: "Farba",
    }),
  });

  const raw = await tools.update_item.execute({
    type: "shopping",
    itemId: "shopping_1",
    unitPrice: "199 PLN",
  } as any);
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "edit");
  assert.equal(parsed.updates.unitPrice, 199);
});

test("update_multiple_items returns bulk_edit when items belong to active project", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      { itemId: "a", data: { unitPrice: 10 } },
      { itemId: "b", data: { unitPrice: 20 } },
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(Array.isArray(parsed.data.items), true);
  assert.equal(parsed.data.items.length, 2);
  assert.equal(parsed.error, undefined);
});

test("update_multiple_items normalizes shopping price alias to unitPrice", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      { itemId: "a", data: { price: 40 } },
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(parsed.data.items[0].updates.unitPrice, 40);
  assert.equal(parsed.data.items[0].updates.price, undefined);
});

test("update_multiple_items parses shopping price alias with currency text", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      { itemId: "a", data: { price: "1 800 PLN" } },
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(parsed.data.items[0].updates.unitPrice, 1800);
  assert.equal(parsed.data.items[0].updates.price, undefined);
});

test("update_multiple_items drops non-positive shopping prices", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      { itemId: "a", data: { unitPrice: 0 } },
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, undefined);
  assert.equal(parsed.error, "No valid update fields provided");
});

test("update_multiple_items falls back to raw non-empty updates when normalization strips values", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      { itemId: "a", data: { price: "PLN" } },
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(parsed.data.items[0].updates.price, "PLN");
});

test("update_multiple_items schema preserves raw data keys", async () => {
  const mod = await import("../../convex/ai/tools.ts");
  const parsed = mod.updateMultipleItemsSchema.parse({
    type: "shopping",
    updates: [
      {
        itemId: "a",
        data: {
          unitPrice: "250 PLN",
          customPriceField: "example",
        },
      },
    ],
  });

  assert.equal(parsed.updates[0]!.data!.unitPrice, "250 PLN");
  assert.equal(parsed.updates[0]!.data!.customPriceField, "example");
});

test("update_multiple_items schema preserves direct update keys outside data", async () => {
  const mod = await import("../../convex/ai/tools.ts");
  const parsed = mod.updateMultipleItemsSchema.parse({
    type: "shopping",
    updates: [
      {
        itemId: "a",
        unitPrice: "250 PLN",
        customPriceField: "example",
      },
    ],
  });

  assert.equal((parsed.updates[0] as Record<string, unknown>).unitPrice, "250 PLN");
  assert.equal((parsed.updates[0] as Record<string, unknown>).customPriceField, "example");
});

test("update_multiple_items accepts direct shopping fields without data wrapper", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      {
        itemId: "a",
        unitPrice: "320 PLN",
      },
    ],
  } as any);
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(parsed.data.items[0].updates.unitPrice, 320);
});

test("update_multiple_items flattens nested updates wrapper", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      {
        itemId: "a",
        data: { updates: { unitPrice: "250 PLN" } },
      },
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(parsed.data.items[0].updates.unitPrice, 250);
});

test("update_multiple_items supports field/value update payloads", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: `Item ${args.itemId}`,
    }),
  });

  const raw = await tools.update_multiple_items.execute({
    type: "shopping",
    updates: [
      {
        itemId: "a",
        data: { field: "unitPrice", value: 320 },
      },
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(parsed.data.items[0].updates.unitPrice, 320);
});

test("search_items uses runAction (not runQuery)", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const calls = { runAction: 0, runQuery: 0 };

  const tools = createStreamingTools({
    projectId: "project_1",
    runAction: async () => {
      calls.runAction += 1;
      return {
        count: 1,
        total: 1,
        items: [{ _id: "shopping_1", name: "Farba", projectId: "project_1" }],
      };
    },
    runQuery: async () => {
      calls.runQuery += 1;
      return null;
    },
  });

  const raw = await tools.search_items.execute({
    type: "shopping",
    query: "farba",
    limit: 10,
  });
  const parsed = JSON.parse(raw);

  assert.equal(calls.runAction, 1);
  assert.equal(calls.runQuery, 0);
  assert.equal(parsed.total, 1);
});
