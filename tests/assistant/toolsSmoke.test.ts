import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

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
    getActiveRuntimeToolNames(["web_search", "search_items", "unknown_tool", "load_full_project_context"]),
    ["web_search", "search_items", "load_full_project_context"],
  );
  assert.deepEqual(
    getActiveRuntimeToolNames(
      ["web_search", "search_items", "manage_tasks", "load_full_project_context"],
      "always_ask",
    ),
    ["web_search", "search_items"],
  );
});

test("createStreamingTools defaults to full toolset only in auto_confirm mode", async () => {
  const { createStreamingTools } = await getToolModule();
  const tools = createStreamingTools({
    projectId: "project_1",
    crudApprovalMode: "auto_confirm",
  });

  assert.deepEqual(
    Object.keys(tools).sort(),
    [
      "generate_moodboard_image",
      "load_full_project_context",
      "manage_contacts",
      "manage_labor",
      "manage_notes",
      "manage_shopping",
      "manage_surveys",
      "manage_tasks",
      "search_items",
      "update_project_settings",
      "web_search",
    ],
  );
});

test("createStreamingTools exposes only search tools in always_ask mode", async () => {
  const { createStreamingTools } = await getToolModule();
  const tools = createStreamingTools({
    projectId: "project_1",
    crudApprovalMode: "always_ask",
  });

  assert.deepEqual(Object.keys(tools).sort(), ["search_items", "web_search"]);
});

test("web_search uses injected runner and returns cited results", async () => {
  const { createStreamingTools } = await getToolModule();
  const tools = createStreamingTools({
    runWebSearch: async ({ query, searchContextSize }) => ({
      ok: true,
      query,
      searchContextSize,
      summary: "Found current results.",
      sources: [{ title: "Example", url: "https://example.com" }],
    }),
  });

  const raw = await tools.web_search.prepare({
    query: "latest kitchen appliance trends",
    searchContextSize: "high",
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.query, "latest kitchen appliance trends");
  assert.equal(parsed.searchContextSize, "high");
  assert.equal(parsed.sources[0].url, "https://example.com");
});

test("manage_tasks prepares task creation payload", async () => {
  const { createStreamingTools } = await getToolModule();
  const tools = createStreamingTools({ projectId: "project_1" });

  const raw = await tools.manage_tasks.prepare({
    action: "create",
    title: "Book electrician",
    priority: "high",
  } as never);
  const parsed = JSON.parse(raw);

  assert.equal(parsed.type, "task");
  assert.equal(parsed.operation, "create");
  assert.equal(parsed.data.title, "Book electrician");
});

test("manage_shopping prepares section deletion payload", async () => {
  const { createStreamingTools } = await getToolModule();
  const tools = createStreamingTools({
    projectId: "project_1",
    runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
      _id: args.itemId,
      projectId: "project_1",
      name: "Walls",
    }),
  });

  const raw = await tools.manage_shopping.prepare({
    action: "delete",
    entity: "section",
    sectionId: "section_1",
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.type, "shoppingSection");
  assert.equal(parsed.operation, "delete");
  assert.equal(parsed.data.sectionId, "section_1");
});

test("prepareCreatePayload maps shopping title alias into name", async () => {
  const { prepareCreatePayload } = await getToolModule();

  const raw = await prepareCreatePayload({
    type: "shopping",
    data: {
      title: "Farba biala",
      quantity: 2,
    } as never,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "create");
  assert.equal(parsed.data.name, "Farba biala");
});

test("prepareCreatePayload maps task name alias into title", async () => {
  const { prepareCreatePayload } = await getToolModule();

  const raw = await prepareCreatePayload({
    type: "task",
    data: {
      name: "Rozpisac harmonogram",
      priority: "high",
    } as never,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "create");
  assert.equal(parsed.data.title, "Rozpisac harmonogram");
});

test("prepareCreatePayload supports all assistant entity types", async () => {
  const { prepareCreatePayload } = await getToolModule();

  const cases: Array<{
    type:
      | "task"
      | "note"
      | "shopping"
      | "labor"
      | "survey"
      | "contact"
      | "shoppingSection"
      | "laborSection";
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
    const raw = await prepareCreatePayload({
      type: entry.type,
      data: entry.data as never,
    });
    const parsed = JSON.parse(raw);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.operation, "create");
    assert.equal(parsed.type, entry.type);
  }
});

test("prepareCreatePayload keeps survey single-question fields in payload", async () => {
  const { prepareCreatePayload } = await getToolModule();

  const raw = await prepareCreatePayload({
    type: "survey",
    data: {
      title: "Ankieta testowa",
      questionText: "Jak oceniasz dzisiejszy dzien?",
      questionType: "rating",
      order: 1,
    } as never,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "create");
  assert.equal(parsed.type, "survey");
  assert.equal(parsed.data.title, "Ankieta testowa");
  assert.equal(parsed.data.questionText, "Jak oceniasz dzisiejszy dzien?");
  assert.equal(parsed.data.questionType, "rating");
  assert.equal(parsed.data.order, undefined);
});

test("prepareBulkCreatePayload uses surveys key and rejects invalid input", async () => {
  const { prepareBulkCreatePayload } = await getToolModule();

  const raw = await prepareBulkCreatePayload({
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
    ] as never,
  });
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_create");
  assert.equal(Array.isArray(parsed.data.surveys), true);

  const invalidRaw = await prepareBulkCreatePayload({
    type: "shopping",
    items: [{ quantity: 1 }] as never,
  });
  const invalidParsed = JSON.parse(invalidRaw);
  assert.equal(invalidParsed.error, "Cannot create shopping items without name");
});

test("prepareUpdatePayload uses runQuery for lookup and normalizes price aliases", async () => {
  const { prepareUpdatePayload } = await getToolModule();
  const calls = { runQuery: 0 };

  const raw = await prepareUpdatePayload(
    {
      type: "shopping",
      itemId: "shopping_1",
      unitPrice: "199 PLN",
    } as never,
    {
      projectId: "project_1",
      runQuery: async (_queryRef: unknown, args: { itemId: string }) => {
        calls.runQuery += 1;
        return {
          _id: args.itemId,
          projectId: "project_1",
          name: "Farba",
        };
      },
    },
  );
  const parsed = JSON.parse(raw);

  assert.equal(calls.runQuery, 1);
  assert.equal(parsed.operation, "edit");
  assert.equal(parsed.updates.unitPrice, 199);
  assert.equal(parsed.originalItem._id, "shopping_1");
});

test("prepareBulkUpdatePayload returns bulk_edit and supports field/value updates", async () => {
  const { prepareBulkUpdatePayload } = await getToolModule();

  const raw = await prepareBulkUpdatePayload(
    {
      type: "shopping",
      updates: [
        { itemId: "a", data: { price: 40 } },
        { itemId: "b", data: { field: "unitPrice", value: 320 } },
      ],
    } as never,
    {
      projectId: "project_1",
      runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
        _id: args.itemId,
        projectId: "project_1",
        name: `Item ${args.itemId}`,
      }),
    },
  );
  const parsed = JSON.parse(raw);

  assert.equal(parsed.operation, "bulk_edit");
  assert.equal(parsed.data.items[0].updates.unitPrice, 40);
  assert.equal(parsed.data.items[1].updates.unitPrice, 320);
});

test("prepareDeletePayload blocks cross-project deletion and maps moodboard notes", async () => {
  const { prepareDeletePayload } = await getToolModule();

  const invalidRaw = await prepareDeletePayload(
    {
      type: "task",
      itemId: "task_other",
    },
    {
      projectId: "project_1",
      runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
        _id: args.itemId,
        projectId: "project_2",
        title: "Other project task",
      }),
    },
  );
  const invalidParsed = JSON.parse(invalidRaw);
  assert.equal(invalidParsed.error, "Cannot delete item outside the active project");

  const moodboardRaw = await prepareDeletePayload(
    {
      type: "note",
      itemId: "note_1",
    },
    {
      projectId: "project_1",
      runQuery: async (_queryRef: unknown, args: { itemId: string }) => ({
        _id: args.itemId,
        projectId: "project_1",
        title: "Inspiracja 01",
        storageId: "storage_1",
        moodboardSection: "Concept",
      }),
    },
  );
  const moodboardParsed = JSON.parse(moodboardRaw);
  assert.equal(moodboardParsed.type, "moodboard");
  assert.equal(moodboardParsed.data.fileId, "note_1");
});

test("update_project_settings trims values and rejects too-short name", async () => {
  const { createStreamingTools } = await getToolModule();
  const tools = createStreamingTools({ projectId: "project_1" });

  const invalidRaw = await tools.update_project_settings.prepare({
    name: "a",
  });
  const invalidParsed = JSON.parse(invalidRaw);
  assert.equal(invalidParsed.error, "Project name must be at least 2 characters");

  const raw = await tools.update_project_settings.prepare({
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

test("search_items uses runAction and generate_moodboard_image passes project context", async () => {
  const { createStreamingTools } = await getToolModule();
  const calls: Array<Record<string, unknown>> = [];

  const tools = createStreamingTools({
    projectId: "project_1",
    userClerkId: "user_123",
    runAction: async (_actionRef: unknown, args: Record<string, unknown>) => {
      calls.push(args);
      if ("prompt" in args) {
        return {
          success: true,
          sectionKey: "1",
          sectionLabel: "CONCEPT",
          model: "gemini-2.5-flash-image",
          message: "Saved a new image to the CONCEPT moodboard section.",
        };
      }
      return {
        count: 1,
        total: 1,
        items: [{ _id: "shopping_1", name: "Farba", projectId: "project_1" }],
      };
    },
  });

  const searchRaw = await tools.search_items.prepare({
    type: "shopping",
    query: "farba",
    limit: 10,
    filters: {
      completed: true,
      status: "done",
      badKey: "ignored",
    } as never,
  });
  const searchParsed = JSON.parse(searchRaw);
  assert.equal(searchParsed.total, 1);

  const moodboardRaw = await tools.generate_moodboard_image.prepare({
    prompt: "Warm minimal living room with travertine and oak",
    section: "Living room",
  });
  const moodboardParsed = JSON.parse(moodboardRaw);

  assert.equal(moodboardParsed.success, true);
  assert.equal(calls.some((entry) => entry.projectId === "project_1"), true);
  assert.equal(calls.some((entry) => entry.userClerkId === "user_123"), true);
});

test("manage_tasks execute runs confirmed action instead of only returning prepared payload", async () => {
  const { createStreamingTools } = await getToolModule();
  const calls: Array<Record<string, unknown>> = [];

  const tools = createStreamingTools({
    projectId: "project_1",
    userClerkId: "user_123",
    runAction: async (_actionRef: unknown, args: Record<string, unknown>) => {
      calls.push(args);
      return {
        success: true,
        taskId: "task_1",
        message: "Task created.",
      };
    },
  });

  const raw = await tools.manage_tasks.execute(
    {
      action: "create",
      title: "Book electrician",
      priority: "high",
    } as never,
    {
      toolCallId: "call_1",
      messages: [],
    } as never,
  );
  const parsed = JSON.parse(raw);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.projectId, "project_1");
  assert.equal(calls[0]?.userClerkId, "user_123");
  assert.deepEqual(calls[0]?.taskData, {
    title: "Book electrician",
    priority: "high",
  });
  assert.equal(parsed.status, "confirmed");
  assert.equal(parsed.outcome.success, true);
  assert.equal(parsed.outcome.taskId, "task_1");
});

test("manage_shopping execute strips section aliases before confirmed section create", async () => {
  const { createStreamingTools } = await getToolModule();
  const calls: Array<Record<string, unknown>> = [];

  const tools = createStreamingTools({
    projectId: "project_1",
    userClerkId: "user_123",
    runAction: async (_actionRef: unknown, args: Record<string, unknown>) => {
      calls.push(args);
      return {
        success: true,
        sectionId: "section_1",
        message: "Shopping section created successfully",
      };
    },
  });

  const raw = await tools.manage_shopping.execute(
    {
      action: "create",
      entity: "section",
      data: {
        name: "Demolition",
        sectionName: "Demolition",
      },
    } as never,
    {
      toolCallId: "call_section_1",
      messages: [],
    } as never,
  );
  const parsed = JSON.parse(raw);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    projectId: "project_1",
    userClerkId: "user_123",
    sectionData: {
      name: "Demolition",
    },
  });
  assert.equal(parsed.status, "confirmed");
  assert.equal(parsed.outcome.success, true);
  assert.equal(parsed.outcome.sectionId, "section_1");
});
