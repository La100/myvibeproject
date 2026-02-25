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
