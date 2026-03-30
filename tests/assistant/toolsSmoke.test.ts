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

const getToolModule = async () => {
  const globalWithRequire = globalThis as typeof globalThis & {
    require?: ReturnType<typeof createRequire>;
  };
  if (!globalWithRequire.require) {
    globalWithRequire.require = createRequire(
      new URL("../../convex/ai/tools.ts", import.meta.url),
    );
  }
  return import("../../convex/ai/tools.ts");
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

test("createStreamingTools can enforce an allowlist", async () => {
  const { createStreamingTools, getActiveRuntimeToolNames } = await getToolModule();
  const tools = createStreamingTools({
    projectId: "project_1",
    allowedToolNames: ["search_items", "load_full_project_context"],
  });

  assert.deepEqual(
    Object.keys(tools).sort(),
    ["load_full_project_context", "search_items"],
  );
  assert.deepEqual(
    getActiveRuntimeToolNames(["search_items", "unknown_tool", "load_full_project_context"]),
    ["search_items", "load_full_project_context"],
  );
});

test("create_item maps shopping title alias into name", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_item.execute({
    type: "shopping",
    data: {
      title: "Farba biala",
      quantity: 2,
    } as any,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "create");
  assert.equal(parsed.data.name, "Farba biala");
});

test("create_item maps task name alias into title", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_item.execute({
    type: "task",
    data: {
      name: "Rozpisac harmonogram",
      priority: "high",
    } as any,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "create");
  assert.equal(parsed.data.title, "Rozpisac harmonogram");
});

test("create_item supports all assistant entity types", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const cases: Array<{
    type: "task" | "note" | "shopping" | "labor" | "survey" | "contact" | "shoppingSection" | "laborSection";
    data: Record<string, unknown>;
  }> = [
    { type: "task", data: { title: "Task test" } },
    { type: "note", data: { title: "Note test", content: "Body" } },
    { type: "shopping", data: { name: "Farba", quantity: 1 } },
    { type: "labor", data: { name: "Malowanie", quantity: 1 } },
    {
      type: "survey",
      data: {
        title: "Survey test",
        questions: [{ questionText: "Czy ok?", questionType: "yes_no" }],
      },
    },
    { type: "contact", data: { name: "Jan Kowalski" } },
    { type: "shoppingSection", data: { name: "Sciany" } },
    { type: "laborSection", data: { name: "Roboty mokre" } },
  ];

  for (const entry of cases) {
    const raw = await tools.create_item.execute({
      type: entry.type,
      data: entry.data as any,
    });
    const parsed = JSON.parse(raw);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.operation, "create");
    assert.equal(parsed.type, entry.type);
  }
});

test("create_item keeps survey single-question fields in payload", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_item.execute({
    type: "survey",
    data: {
      title: "Ankieta testowa",
      questionText: "Jak oceniasz dzisiejszy dzien?",
      questionType: "rating",
      order: 1,
    } as any,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "create");
  assert.equal(parsed.type, "survey");
  assert.equal(parsed.data.title, "Ankieta testowa");
  assert.equal(parsed.data.questionText, "Jak oceniasz dzisiejszy dzien?");
  assert.equal(parsed.data.questionType, "rating");
  assert.equal(parsed.data.order, undefined);
});

test("create_item strips unsupported order from survey questions array", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_item.execute({
    type: "survey",
    data: {
      title: "Ankieta testowa",
      questions: [
        {
          questionText: "Jak oceniasz dzisiejszy dzien?",
          questionType: "rating",
          order: 1,
          isRequired: true,
        },
      ],
    } as any,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "create");
  assert.equal(parsed.type, "survey");
  assert.equal(Array.isArray(parsed.data.questions), true);
  assert.equal(parsed.data.questions[0].questionText, "Jak oceniasz dzisiejszy dzien?");
  assert.equal(parsed.data.questions[0].questionType, "rating");
  assert.equal(parsed.data.questions[0].isRequired, true);
  assert.equal(parsed.data.questions[0].order, undefined);
});

test("create_multiple_items uses surveys key for bulk survey payload", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_multiple_items.execute({
    type: "survey",
    items: [
      {
        title: "Ankieta 1",
        questions: [
          {
            questionText: "Czy materialy sa ok?",
            questionType: "yes_no",
            isRequired: true,
          },
        ],
      },
    ] as any,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_create");
  assert.equal(Array.isArray(parsed.data?.surveys), true);
  assert.equal(parsed.data.surveys.length, 1);
  assert.equal(parsed.data.surveys[0].title, "Ankieta 1");
  assert.equal(Array.isArray(parsed.data?.items), false);
});

test("create_multiple_items uses contacts key for bulk contact payload", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_multiple_items.execute({
    type: "contact",
    items: [
      {
        name: "Jan Kowalski",
        email: "jan@example.com",
      },
    ] as any,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_create");
  assert.equal(Array.isArray(parsed.data?.contacts), true);
  assert.equal(parsed.data.contacts.length, 1);
  assert.equal(parsed.data.contacts[0].name, "Jan Kowalski");
  assert.equal(Array.isArray(parsed.data?.items), false);
});

test("create_multiple_items rejects entries missing required primary field", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_multiple_items.execute({
    type: "shopping",
    items: [
      { name: "Walek" } as any,
      { title: "   " } as any,
    ],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, undefined);
  assert.equal(parsed.error, "Cannot create shopping items without name");
  assert.deepEqual(parsed.invalidItemPositions, [2]);
});

test("create_multiple_items rejects empty input list", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.create_multiple_items.execute({
    type: "shopping",
    items: [],
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, undefined);
  assert.equal(parsed.error, "No items were provided for bulk create");
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

test("update_item accepts survey question operations metadata", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      title: "Survey",
    }),
  });

  const raw = await tools.update_item.execute({
    type: "survey",
    itemId: "survey_1",
    data: {
      questions: [
        {
          questionId: "question_1",
          operation: "edit",
          questionText: "Updated question",
          questionType: "text_short",
          order: 1,
        },
      ],
    },
  } as any);
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "edit");
  assert.equal(parsed.updates.questions[0].questionId, "question_1");
  assert.equal(parsed.updates.questions[0].operation, "edit");
  assert.equal(parsed.updates.questions[0].questionText, "Updated question");
});

test("delete_item blocks cross-project deletion candidates", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_2",
      title: "Other project task",
    }),
  });

  const raw = await tools.delete_item.execute({
    type: "task",
    itemId: "task_other",
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, undefined);
  assert.equal(parsed.error, "Cannot delete item outside the active project");
});

test("delete_item includes sectionId for section deletions", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: "Sciany",
    }),
  });

  const raw = await tools.delete_item.execute({
    type: "shoppingSection",
    itemId: "section_1",
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "delete");
  assert.equal(parsed.data.itemId, "section_1");
  assert.equal(parsed.data.sectionId, "section_1");
  assert.equal(parsed.data.name, "Sciany");
});

test("delete_item maps moodboard notes to moodboard payload", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      title: "Inspiracja 01",
      storageId: "storage_1",
      moodboardSection: "Concept",
    }),
  });

  const raw = await tools.delete_item.execute({
    type: "note",
    itemId: "note_1",
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "delete");
  assert.equal(parsed.type, "moodboard");
  assert.equal(parsed.data.fileId, "note_1");
  assert.equal(parsed.data.moodboardSection, "Concept");
  assert.equal(parsed.data.name, "Inspiracja 01");
});

test("update_project_settings trims values and rejects too-short name", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const invalidRaw = await tools.update_project_settings.execute({
    name: "a",
  });
  const invalidParsed = JSON.parse(invalidRaw);

  assert.equal(invalidParsed.error, "Project name must be at least 2 characters");

  const raw = await tools.update_project_settings.execute({
    name: "  Mieszkanie Mokotow  ",
    description: "  Etap 2  ",
    customer: "  Jan Kowalski  ",
    location: "  Warszawa  ",
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "edit");
  assert.equal(parsed.type, "projectSettings");
  assert.equal(parsed.updates.name, "Mieszkanie Mokotow");
  assert.equal(parsed.updates.description, "Etap 2");
  assert.equal(parsed.updates.customer, "Jan Kowalski");
  assert.equal(parsed.updates.location, "Warszawa");
});

test("update_project_settings rejects updates that normalize to empty values", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.update_project_settings.execute({
    name: "   ",
    description: "   ",
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, undefined);
  assert.equal(parsed.error, "No valid project setting updates were provided");
});

test("search_items uses runAction (not runQuery)", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const calls = { runAction: 0, runQuery: 0 };
  let receivedArgs: Record<string, unknown> | null = null;

  const tools = createStreamingTools({
    projectId: "project_1",
    runAction: async (_actionRef: unknown, args: Record<string, unknown>) => {
      calls.runAction += 1;
      receivedArgs = args;
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
    filters: {
      completed: true,
      status: "done",
      badKey: "ignored",
    } as any,
  });
  const parsed = JSON.parse(raw);

  assert.equal(calls.runAction, 1);
  assert.equal(calls.runQuery, 0);
  assert.equal(parsed.total, 1);
  assert.equal((receivedArgs as { completed?: boolean } | null)?.completed, true);
  assert.equal("status" in (receivedArgs ?? {}), false);
  assert.equal("badKey" in (receivedArgs ?? {}), false);
});

test("generate_moodboard_image uses runAction and passes project context", async () => {
  const createStreamingTools = await getCreateStreamingTools();
  const calls: Array<Record<string, unknown>> = [];

  const tools = createStreamingTools({
    projectId: "project_1",
    userClerkId: "user_123",
    runAction: async (_actionRef: unknown, args: Record<string, unknown>) => {
      calls.push(args);
      return {
        success: true,
        sectionKey: "1",
        sectionLabel: "CONCEPT",
        model: "gemini-2.5-flash-image",
        message: "Saved a new image to the CONCEPT moodboard section.",
      };
    },
  });

  const raw = await tools.generate_moodboard_image.execute({
    prompt: "Warm minimal living room with travertine and oak",
    section: "Concept",
  });
  const parsed = JSON.parse(raw);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].projectId, "project_1");
  assert.equal(calls[0].userClerkId, "user_123");
  assert.equal(calls[0].section, "Concept");
  assert.equal(parsed.success, true);
  assert.equal(parsed.sectionLabel, "CONCEPT");
});
