import type { Id } from "./_generated/dataModel";

type SeedCtx = {
  db: any;
};

const DEMO_PROJECT_SLUG = "demo-project";
const DEMO_PROJECT_NAME = "Demo: Modern Family House";
const DEMO_COVER_IMAGE = "/landing/visualization-1776944094220.webp";

const defaultTaskStatusSettings = {
  todo: { name: "To Do", color: "#808080" },
  in_progress: { name: "In Progress", color: "#3b82f6" },
  review: { name: "Review", color: "#a855f7" },
  done: { name: "Done", color: "#22c55e" },
};

const portalSettings = {
  showApprovals: true,
  showShoppingList: true,
  allowShoppingItemDecisions: true,
  allowShoppingItemComments: true,
  showFiles: true,
  showMoodboard: true,
  showSurveys: true,
  showTasks: true,
  showLabor: true,
  showContacts: true,
  showBudget: true,
  showPayments: true,
  showNotes: true,
  showSupplier: true,
  showPrice: true,
};

const moodboardSections = [
  { id: "concept-direction", title: "CONCEPT DIRECTION", order: 0 },
  { id: "materials-finishes", title: "MATERIALS AND FINISHES", order: 1 },
  { id: "furniture-lighting", title: "FURNITURE AND LIGHTING", order: 2 },
];

const atNoonUtc = (year: number, monthIndex: number, day: number) =>
  Date.UTC(year, monthIndex, day, 12, 0, 0, 0);

const generateNextProjectId = async (ctx: SeedCtx) => {
  const lastProject = await ctx.db
    .query("projects")
    .withIndex("by_project_id")
    .order("desc")
    .first();

  return (lastProject?.projectId || 0) + 1;
};

const hasDemoProject = async (
  ctx: SeedCtx,
  teamId: Id<"teams">,
) => {
  const existingDemo = await ctx.db
    .query("projects")
    .withIndex("by_team_and_slug", (q: any) =>
      q.eq("teamId", teamId).eq("slug", DEMO_PROJECT_SLUG),
    )
    .first();

  return Boolean(existingDemo);
};

export const ensureDemoProjectForNewWorkspace = async (
  ctx: SeedCtx,
  args: {
    teamId: Id<"teams">;
    clerkOrgId: string;
    createdByClerkUserId: string;
  },
) => {
  if (await hasDemoProject(ctx, args.teamId)) {
    return null;
  }

  const now = Date.now();
  const projectId = await ctx.db.insert("projects", {
    name: DEMO_PROJECT_NAME,
    description:
      "A fully prepared demo project for a warm modern family house, including tasks, shopping, moodboard, labor, contacts, payments, notes, and a draft client portal.",
    coverImageUrl: DEMO_COVER_IMAGE,
    teamId: args.teamId,
    slug: DEMO_PROJECT_SLUG,
    projectId: await generateNextProjectId(ctx),
    status: "active",
    startDate: atNoonUtc(2026, 5, 1),
    endDate: atNoonUtc(2026, 10, 20),
    budget: 850000,
    customer: "Emily Carter",
    customerEmail: "emily.carter@example.com",
    location: "Austin, Texas",
    currency: "USD",
    measurements: "imperial",
    taxEnabled: true,
    taxRate: 8.25,
    createdBy: args.createdByClerkUserId,
    responsibleClerkUserId: args.createdByClerkUserId,
    clientPortalNotificationSettings: {
      recipientClerkUserIds: [args.createdByClerkUserId],
    },
    assignedTo: [args.createdByClerkUserId],
    taskStatusSettings: defaultTaskStatusSettings,
    clientPanelPublishedSettings: portalSettings,
    paymentCustomerName: "Emily Carter",
    paymentCustomerEmail: "emily.carter@example.com",
    paymentCustomerDetails: {
      name: "Emily Carter",
      email: "emily.carter@example.com",
      address: {
        line1: "1408 Oak Ridge Lane",
        city: "Austin",
        state: "TX",
        postalCode: "78704",
        country: "US",
      },
    },
    aiAutoConfirmCrud: false,
    moodboardSections,
  });

  await seedTasks(ctx, projectId, args.teamId, args.createdByClerkUserId);
  await seedShopping(ctx, projectId, args.teamId, args.createdByClerkUserId);
  await seedMoodboard(ctx, projectId, args.teamId, args.createdByClerkUserId);
  await seedLabor(ctx, projectId, args.teamId, args.createdByClerkUserId);
  await seedPayments(ctx, projectId, args.teamId, args.createdByClerkUserId);
  await seedContacts(ctx, projectId, args.teamId, args.createdByClerkUserId);
  await seedNotes(ctx, projectId, args.teamId, args.createdByClerkUserId, now);

  return projectId;
};

const seedTasks = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
) => {
  const tasks = [
    ["Confirm architectural concept and massing", "review", "high", "Architecture"],
    ["Coordinate structural framing strategy", "in_progress", "high", "Structure"],
    ["Submit permit drawing package", "todo", "urgent", "Permits"],
    ["Finalize kitchen and bath finish schedule", "review", "medium", "Interiors"],
    ["Approve window and exterior door specification", "todo", "medium", "Envelope"],
    ["Prepare site logistics and foundation layout", "in_progress", "medium", "Site"],
    ["Review lighting plan with electrical subcontractor", "todo", "medium", "MEP"],
    ["Publish the client portal demo", "todo", "high", "Client portal"],
  ] as const;

  await Promise.all(
    tasks.map(([title, status, priority, tag], index) =>
      ctx.db.insert("tasks", {
        title,
        description:
          title === "Publish the client portal demo"
            ? "Open Client Portal, click Update portal, then Open portal to review the client-facing demo."
            : `Demo task for ${tag.toLowerCase()} coordination on the modern family house project.`,
        projectId,
        teamId,
        status,
        priority,
        assignedTo: createdBy,
        createdBy,
        startDate: atNoonUtc(2026, 5, 1 + index * 7),
        endDate: atNoonUtc(2026, 5, 8 + index * 7),
        tags: [tag],
        updatedAt: Date.now(),
      }),
    ),
  );
};

const seedShopping = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
) => {
  const sections = await Promise.all(
    ["Living Room Package", "Kitchen and Bath Finishes", "Lighting and Electrical", "Exterior Materials"].map(
      (name, order) =>
        ctx.db.insert("shoppingListSections", {
          name,
          projectId,
          teamId,
          order,
          createdBy,
        }),
    ),
  );

  const items = [
    ["Barcelona chair", sections[0], "Furniture", "/landing/generated/barcelona-chair-main.png", 2, "pcs", 4280, "Client approved", "gross"],
    ["Green zellige tile", sections[1], "Wall finish", "/landing/generated/green-zellige-interior.png", 42, "sq ft", 118, "Sample ordered", "gross"],
    ["Red travertine side table", sections[0], "Furniture", "/landing/generated/red-travertine-side-table.png", 1, "pcs", 1240, "Quote requested", "unspecified"],
    ["Cream boucle swivel", sections[0], "Seating", "/landing/generated/cream-boucle-swivel-chair.png", 2, "pcs", 2180, "Alt option", "unspecified"],
    ["Terracotta hallway tile", sections[3], "Floor finish", "/landing/generated/terracotta-tile-hallway.png", 60, "sq ft", 96, "Supplier hold", "unspecified"],
    ["Alabaster pendant light", sections[2], "Lighting", "/landing/generated/alabaster-pendant-light.png", 3, "pcs", 760, "Client approved", "gross"],
    ["Brushed nickel wall sconce", sections[2], "Lighting", "/landing/generated/brushed-nickel-wall-sconce.png", 6, "pcs", 340, "Order next week", "unspecified"],
    ["Walnut fluted cabinet", sections[1], "Millwork", "/landing/generated/walnut-fluted-cabinet.png", 1, "pcs", 6800, "Shop drawing needed", "unspecified"],
  ] as const;

  await Promise.all(
    items.map(([name, sectionId, category, imageUrl, quantity, unit, unitPrice, notes, priceTaxMode]) =>
      ctx.db.insert("shoppingListItems", {
        name,
        notes,
        completed: false,
        priority: "medium",
        imageUrl,
        supplier: "Demo supplier",
        category,
        quantity,
        unit,
        unitPrice,
        totalPrice: quantity * unitPrice,
        priceTaxMode,
        taxRateSnapshot:
          priceTaxMode === "gross"
            ? { name: "Sales tax", rate: 8.25, description: "Demo sales tax" }
            : undefined,
        realizationStatus: name.includes("Barcelona") || name.includes("Alabaster") ? "ORDERED" : "PLANNED",
        sectionId,
        projectId,
        teamId,
        createdBy,
        assignedTo: createdBy,
        updatedAt: Date.now(),
      }),
    ),
  );
};

const seedMoodboard = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
) => {
  const images = [
    ["Warm modern house concept", "concept-direction", "/landing/visualization-1776944094220.webp"],
    ["Facade massing reference", "concept-direction", "/landing/visualization-1776943891109.webp"],
    ["Green zellige wall finish", "materials-finishes", "/landing/generated/green-zellige-interior.png"],
    ["Terracotta hallway tile", "materials-finishes", "/landing/generated/terracotta-tile-hallway.png"],
    ["Lounge seating direction", "furniture-lighting", "/landing/generated/cream-boucle-swivel-chair.png"],
    ["Leather and stone palette", "furniture-lighting", "/landing/generated/barcelona-chair-materials.png"],
  ] as const;

  await Promise.all(
    images.map(([name, section, storageId], order) =>
      ctx.db.insert("files", {
        name,
        description: "Demo moodboard image",
        teamId,
        projectId,
        fileType: "image",
        storageId,
        size: 1,
        mimeType: storageId.endsWith(".webp") ? "image/webp" : "image/png",
        uploadedBy: createdBy,
        version: 1,
        isLatest: true,
        origin: "general",
        moodboardSection: section,
        moodboardOrder: order,
        showInClientPortal: true,
        aiKnowledgeEnabled: false,
        aiKnowledgeStatus: "excluded",
      }),
    ),
  );
};

const seedLabor = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
) => {
  const sections = await Promise.all(
    ["Pre-construction", "Shell construction", "Interior fit-out"].map((name, order) =>
      ctx.db.insert("laborSections", {
        name,
        projectId,
        teamId,
        order,
        createdBy,
      }),
    ),
  );

  const items = [
    ["Site survey and layout", sections[0], 24, "hours", 95],
    ["Permit coordination", sections[0], 18, "hours", 120],
    ["Foundation crew", sections[1], 160, "hours", 88],
    ["Framing crew", sections[1], 240, "hours", 82],
    ["Exterior envelope installation", sections[1], 110, "hours", 96],
    ["Millwork installation", sections[2], 72, "hours", 105],
    ["Lighting and device trim-out", sections[2], 40, "hours", 98],
  ] as const;

  await Promise.all(
    items.map(([name, sectionId, quantity, unit, unitPrice], index) =>
      ctx.db.insert("laborItems", {
        name,
        notes: "Demo labor line for client budget review.",
        quantity,
        unit,
        unitPrice,
        totalPrice: quantity * unitPrice,
        priceTaxMode: index < 2 ? "unspecified" : "net",
        sectionId,
        projectId,
        teamId,
        createdBy,
        assignedTo: createdBy,
        startDate: atNoonUtc(2026, 6, 1 + index * 10),
        endDate: atNoonUtc(2026, 6, 8 + index * 10),
        updatedAt: Date.now(),
      }),
    ),
  );
};

const seedPayments = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
) => {
  const payments = [
    ["Design deposit", "Paid deposit for concept and schematic design.", 25000, "paid"],
    ["Permit documentation milestone", "Due after permit package submission.", 42000, "open"],
    ["Construction drawings milestone", "Draft payment for detailed drawings.", 58000, "draft"],
    ["Site supervision retainer", "Draft retainer for construction administration.", 36000, "draft"],
  ] as const;

  await Promise.all(
    payments.map(([title, description, amount, status], order) =>
      ctx.db.insert("projectPayments", {
        projectId,
        teamId,
        title,
        description,
        amount,
        currency: "USD",
        dueDate: atNoonUtc(2026, 5 + order, 15),
        order,
        status,
        createdBy,
        updatedAt: Date.now(),
        paidAt: status === "paid" ? Date.now() : undefined,
      }),
    ),
  );
};

const seedContacts = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
) => {
  const contacts = [
    ["Noah Bennett", "Bennett Architecture", "architect", "other"],
    ["Sophia Grant", "Grant Structural", "structural engineer", "contractor"],
    ["Liam Parker", "Parker Build Co.", "general contractor", "contractor"],
    ["Olivia Stone", "Stone Surface Studio", "materials supplier", "supplier"],
    ["Mason Reed", "Reed Electrical", "electrical subcontractor", "subcontractor"],
  ] as const;

  for (const [name, companyName, role, type] of contacts) {
    const contactId = await ctx.db.insert("contacts", {
      name,
      companyName,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      phone: "+1 512 555 0100",
      city: "Austin",
      country: "US",
      notes: `Demo ${role} contact.`,
      type,
      teamId,
      createdBy,
      isActive: true,
      website: "https://example.com",
    });

    await ctx.db.insert("projectContacts", {
      projectId,
      contactId,
      teamId,
      role,
      assignedBy: createdBy,
      assignedAt: Date.now(),
      isActive: true,
    });
  }
};

const seedNotes = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
  now: number,
) => {
  const notes = [
    ["Demo: Client priorities", "Emily wants warm natural materials, durable family spaces, and clear budget visibility."],
    ["Demo: Permit strategy", "Keep the permit package aligned with the structural framing review and window schedule."],
    ["Demo: Procurement watchlist", "Track lead times for tile, feature lighting, exterior doors, and custom walnut millwork."],
    ["Demo: Portal handoff", "Use Update portal to publish the current demo data, then Open portal for the client-facing review."],
  ] as const;

  await Promise.all(
    notes.map(([title, content]) =>
      ctx.db.insert("notes", {
        title,
        content,
        projectId,
        teamId,
        createdBy,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  );
};
