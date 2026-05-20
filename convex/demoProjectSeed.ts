import type { Id } from "./_generated/dataModel";

type SeedCtx = {
  db: any;
};

type DemoSeedLocale = "en" | "pl";
type TaskSeed = readonly [string, string, string, string];
type ShoppingSeed = readonly [
  string,
  number,
  string,
  string,
  number,
  string,
  number,
  string,
];
type MoodboardSeed = readonly [string, string, string];
type LaborSeed = readonly [string, number, number, string, number];
type PaymentSeed = readonly [string, string, number, string];
type ContactSeed = readonly [string, string, string, string];
type NoteSeed = readonly [string, string];

type DemoSeedContent = {
  project: {
    name: string;
    description: string;
    budget: number;
    customer: string;
    customerEmail: string;
    location: string;
    currency: "USD" | "PLN";
    measurements: "imperial" | "metric";
    paymentCustomerDetails: {
      name: string;
      email: string;
      addressLine1: string;
      city: string;
      postalCode: string;
      country: string;
    };
  };
  taskStatusSettings: {
    todo: { name: string; color: string };
    in_progress: { name: string; color: string };
    review: { name: string; color: string };
    done: { name: string; color: string };
  };
  moodboardSections: Array<{ id: string; title: string; order: number }>;
  tasks: readonly TaskSeed[];
  portalTaskTitle: string;
  portalTaskDescription: string;
  taskDescription: (tag: string) => string;
  shoppingSections: readonly string[];
  shoppingItems: readonly ShoppingSeed[];
  demoSupplier: string;
  orderedItemNames: readonly string[];
  moodboardImages: readonly MoodboardSeed[];
  moodboardDescription: string;
  laborSections: readonly string[];
  laborItems: readonly LaborSeed[];
  laborNotes: string;
  payments: readonly PaymentSeed[];
  contacts: readonly ContactSeed[];
  contactPhone: string;
  contactCity: string;
  contactCountry: string;
  contactNotes: (role: string) => string;
  notes: readonly NoteSeed[];
};

const DEMO_PROJECT_SLUG = "demo-project";
const DEMO_COVER_IMAGE = "/landing/generated/editorial-studio-hero-web.png";

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

const demoSeedCopy: Record<DemoSeedLocale, DemoSeedContent> = {
  en: {
    project: {
      name: "Demo: Modern Family House",
      description:
        "A fully prepared demo project for a warm modern family house, including tasks, shopping, moodboard, labor, contacts, payments, notes, and a draft client portal.",
      budget: 850000,
      customer: "Emily Carter",
      customerEmail: "emily.carter@example.com",
      location: "Austin, Texas",
      currency: "USD" as const,
      measurements: "imperial" as const,
      paymentCustomerDetails: {
        name: "Emily Carter",
        email: "emily.carter@example.com",
        addressLine1: "1408 Oak Ridge Lane",
        city: "Austin",
        postalCode: "78704",
        country: "US",
      },
    },
    taskStatusSettings: {
      todo: { name: "To Do", color: "#808080" },
      in_progress: { name: "In Progress", color: "#3b82f6" },
      review: { name: "Review", color: "#a855f7" },
      done: { name: "Done", color: "#22c55e" },
    },
    moodboardSections: [
      { id: "concept-direction", title: "CONCEPT DIRECTION", order: 0 },
      { id: "materials-finishes", title: "MATERIALS AND FINISHES", order: 1 },
      { id: "furniture-lighting", title: "FURNITURE AND LIGHTING", order: 2 },
    ],
    tasks: [
      [
        "Confirm architectural concept and massing",
        "review",
        "high",
        "Architecture",
      ],
      [
        "Coordinate structural framing strategy",
        "in_progress",
        "high",
        "Structure",
      ],
      ["Submit permit drawing package", "todo", "urgent", "Permits"],
      [
        "Finalize kitchen and bath finish schedule",
        "review",
        "medium",
        "Interiors",
      ],
      [
        "Approve window and exterior door specification",
        "todo",
        "medium",
        "Envelope",
      ],
      [
        "Prepare site logistics and foundation layout",
        "in_progress",
        "medium",
        "Site",
      ],
      [
        "Review lighting plan with electrical subcontractor",
        "todo",
        "medium",
        "MEP",
      ],
      ["Publish the client portal demo", "todo", "high", "Client portal"],
    ] as const,
    portalTaskTitle: "Publish the client portal demo",
    portalTaskDescription:
      "Open Client Portal, click Update portal, then Open portal to review the client-facing demo.",
    taskDescription: (tag: string) =>
      `Demo task for ${tag.toLowerCase()} coordination on the modern family house project.`,
    shoppingSections: [
      "Living Room Package",
      "Kitchen and Bath Finishes",
      "Lighting and Electrical",
      "Exterior Materials",
    ],
    shoppingItems: [
      [
        "Barcelona chair",
        0,
        "Furniture",
        "/landing/generated/barcelona-chair-main.png",
        2,
        "pcs",
        4280,
        "Client approved",
      ],
      [
        "Green zellige tile",
        1,
        "Wall finish",
        "/landing/generated/green-zellige-interior.png",
        42,
        "sq ft",
        118,
        "Sample ordered",
      ],
      [
        "Red travertine side table",
        0,
        "Furniture",
        "/landing/generated/red-travertine-side-table.png",
        1,
        "pcs",
        1240,
        "Quote requested",
      ],
      [
        "Cream boucle swivel",
        0,
        "Seating",
        "/landing/generated/cream-boucle-swivel-chair.png",
        2,
        "pcs",
        2180,
        "Alt option",
      ],
      [
        "Terracotta hallway tile",
        3,
        "Floor finish",
        "/landing/generated/terracotta-tile-hallway.png",
        60,
        "sq ft",
        96,
        "Supplier hold",
      ],
      [
        "Alabaster pendant light",
        2,
        "Lighting",
        "/landing/generated/alabaster-pendant-light.png",
        3,
        "pcs",
        760,
        "Client approved",
      ],
      [
        "Brushed nickel wall sconce",
        2,
        "Lighting",
        "/landing/generated/brushed-nickel-wall-sconce.png",
        6,
        "pcs",
        340,
        "Order next week",
      ],
      [
        "Walnut fluted cabinet",
        1,
        "Millwork",
        "/landing/generated/walnut-fluted-cabinet.png",
        1,
        "pcs",
        6800,
        "Shop drawing needed",
      ],
    ] as const,
    demoSupplier: "Demo supplier",
    orderedItemNames: ["Barcelona chair", "Alabaster pendant light"],
    moodboardImages: [
      [
        "Warm interior concept",
        "concept-direction",
        "/landing/generated/editorial-studio-hero-web.png",
      ],
      [
        "Lounge furniture direction",
        "concept-direction",
        "/landing/generated/barcelona-chair-room.png",
      ],
      [
        "Green zellige wall finish",
        "materials-finishes",
        "/landing/generated/green-zellige-interior.png",
      ],
      [
        "Terracotta hallway tile",
        "materials-finishes",
        "/landing/generated/terracotta-tile-hallway.png",
      ],
      [
        "Cream boucle swivel chair",
        "furniture-lighting",
        "/landing/generated/cream-boucle-swivel-chair.png",
      ],
      [
        "Leather stone and walnut palette",
        "furniture-lighting",
        "/landing/generated/barcelona-chair-materials.png",
      ],
    ] as const,
    moodboardDescription: "Demo moodboard image",
    laborSections: [
      "Pre-construction",
      "Shell construction",
      "Interior fit-out",
    ],
    laborItems: [
      ["Site survey and layout", 0, 24, "hours", 95],
      ["Permit coordination", 0, 18, "hours", 120],
      ["Foundation crew", 1, 160, "hours", 88],
      ["Framing crew", 1, 240, "hours", 82],
      ["Exterior envelope installation", 1, 110, "hours", 96],
      ["Millwork installation", 2, 72, "hours", 105],
      ["Lighting and device trim-out", 2, 40, "hours", 98],
    ] as const,
    laborNotes: "Demo labor line for client budget review.",
    payments: [
      [
        "Design deposit",
        "Paid deposit for concept and schematic design.",
        25000,
        "paid",
      ],
      [
        "Permit documentation milestone",
        "Due after permit package submission.",
        42000,
        "open",
      ],
      [
        "Construction drawings milestone",
        "Draft payment for detailed drawings.",
        58000,
        "draft",
      ],
      [
        "Site supervision retainer",
        "Draft retainer for construction administration.",
        36000,
        "draft",
      ],
    ] as const,
    contacts: [
      ["Noah Bennett", "Bennett Architecture", "architect", "other"],
      ["Sophia Grant", "Grant Structural", "structural engineer", "contractor"],
      ["Liam Parker", "Parker Build Co.", "general contractor", "contractor"],
      [
        "Olivia Stone",
        "Stone Surface Studio",
        "materials supplier",
        "supplier",
      ],
      [
        "Mason Reed",
        "Reed Electrical",
        "electrical subcontractor",
        "subcontractor",
      ],
    ] as const,
    contactPhone: "+1 512 555 0100",
    contactCity: "Austin",
    contactCountry: "US",
    contactNotes: (role: string) => `Demo ${role} contact.`,
    notes: [
      [
        "Demo: Client priorities",
        "Emily wants warm natural materials, durable family spaces, and clear budget visibility.",
      ],
      [
        "Demo: Permit strategy",
        "Keep the permit package aligned with the structural framing review and window schedule.",
      ],
      [
        "Demo: Procurement watchlist",
        "Track lead times for tile, feature lighting, exterior doors, and custom walnut millwork.",
      ],
      [
        "Demo: Portal handoff",
        "Use Update portal to publish the current demo data, then Open portal for the client-facing review.",
      ],
    ] as const,
  },
  pl: {
    project: {
      name: "Demo: Nowoczesny dom rodzinny",
      description:
        "Gotowy projekt demo dla ciepłego, nowoczesnego domu rodzinnego: zadania, lista zakupów, moodboard, robocizna, kontakty, płatności, notatki i szkic panelu klienta.",
      budget: 850000,
      customer: "Anna Kowalska",
      customerEmail: "anna.kowalska@example.com",
      location: "Warszawa, Polska",
      currency: "PLN" as const,
      measurements: "metric" as const,
      paymentCustomerDetails: {
        name: "Anna Kowalska",
        email: "anna.kowalska@example.com",
        addressLine1: "ul. Dębowa 14",
        city: "Warszawa",
        postalCode: "00-001",
        country: "PL",
      },
    },
    taskStatusSettings: {
      todo: { name: "Do zrobienia", color: "#808080" },
      in_progress: { name: "W trakcie", color: "#3b82f6" },
      review: { name: "Do akceptacji", color: "#a855f7" },
      done: { name: "Gotowe", color: "#22c55e" },
    },
    moodboardSections: [
      { id: "concept-direction", title: "KIERUNEK KONCEPCJI", order: 0 },
      { id: "materials-finishes", title: "MATERIAŁY I WYKOŃCZENIA", order: 1 },
      { id: "furniture-lighting", title: "MEBLE I OŚWIETLENIE", order: 2 },
    ],
    tasks: [
      [
        "Zatwierdzić koncepcję architektoniczną i bryłę",
        "review",
        "high",
        "Architektura",
      ],
      [
        "Skoordynować strategię konstrukcji szkieletowej",
        "in_progress",
        "high",
        "Konstrukcja",
      ],
      ["Złożyć pakiet rysunków do pozwolenia", "todo", "urgent", "Pozwolenia"],
      [
        "Domknąć zestawienie wykończeń kuchni i łazienek",
        "review",
        "medium",
        "Wnętrza",
      ],
      [
        "Zatwierdzić specyfikację okien i drzwi zewnętrznych",
        "todo",
        "medium",
        "Elewacja",
      ],
      [
        "Przygotować logistykę placu budowy i wytyczenie fundamentów",
        "in_progress",
        "medium",
        "Budowa",
      ],
      [
        "Omówić plan oświetlenia z podwykonawcą elektrycznym",
        "todo",
        "medium",
        "Instalacje",
      ],
      ["Opublikować demo panelu klienta", "todo", "high", "Panel klienta"],
    ] as const,
    portalTaskTitle: "Opublikować demo panelu klienta",
    portalTaskDescription:
      "Otwórz Panel klienta, kliknij Aktualizuj portal, a potem Otwórz portal, żeby sprawdzić wersję widoczną dla klienta.",
    taskDescription: (tag: string) =>
      `Zadanie demo do koordynacji obszaru: ${tag.toLowerCase()} w projekcie nowoczesnego domu rodzinnego.`,
    shoppingSections: [
      "Pakiet salonu",
      "Wykończenia kuchni i łazienek",
      "Oświetlenie i elektryka",
      "Materiały zewnętrzne",
    ],
    shoppingItems: [
      [
        "Fotel Barcelona",
        0,
        "Meble",
        "/landing/generated/barcelona-chair-main.png",
        2,
        "szt.",
        4280,
        "Zaakceptowane przez klienta",
      ],
      [
        "Zielone płytki zellige",
        1,
        "Wykończenie ścian",
        "/landing/generated/green-zellige-interior.png",
        4,
        "m²",
        1180,
        "Próbka zamówiona",
      ],
      [
        "Stolik z czerwonego trawertynu",
        0,
        "Meble",
        "/landing/generated/red-travertine-side-table.png",
        1,
        "szt.",
        1240,
        "Wysłano zapytanie o wycenę",
      ],
      [
        "Obrotowy fotel boucle",
        0,
        "Siedziska",
        "/landing/generated/cream-boucle-swivel-chair.png",
        2,
        "szt.",
        2180,
        "Opcja alternatywna",
      ],
      [
        "Terakota do holu",
        3,
        "Wykończenie podłóg",
        "/landing/generated/terracotta-tile-hallway.png",
        6,
        "m²",
        960,
        "Rezerwacja u dostawcy",
      ],
      [
        "Lampa wisząca z alabastru",
        2,
        "Oświetlenie",
        "/landing/generated/alabaster-pendant-light.png",
        3,
        "szt.",
        760,
        "Zaakceptowane przez klienta",
      ],
      [
        "Kinkiet szczotkowany nikiel",
        2,
        "Oświetlenie",
        "/landing/generated/brushed-nickel-wall-sconce.png",
        6,
        "szt.",
        340,
        "Zamówienie w przyszłym tygodniu",
      ],
      [
        "Ryflowana szafka orzechowa",
        1,
        "Zabudowa stolarska",
        "/landing/generated/walnut-fluted-cabinet.png",
        1,
        "szt.",
        6800,
        "Potrzebny rysunek warsztatowy",
      ],
    ] as const,
    demoSupplier: "Dostawca demo",
    orderedItemNames: ["Fotel Barcelona", "Lampa wisząca z alabastru"],
    moodboardImages: [
      [
        "Ciepła koncepcja wnętrza",
        "concept-direction",
        "/landing/generated/editorial-studio-hero-web.png",
      ],
      [
        "Kierunek mebli wypoczynkowych",
        "concept-direction",
        "/landing/generated/barcelona-chair-room.png",
      ],
      [
        "Zielone płytki zellige",
        "materials-finishes",
        "/landing/generated/green-zellige-interior.png",
      ],
      [
        "Terakota do holu",
        "materials-finishes",
        "/landing/generated/terracotta-tile-hallway.png",
      ],
      [
        "Kremowy fotel boucle",
        "furniture-lighting",
        "/landing/generated/cream-boucle-swivel-chair.png",
      ],
      [
        "Paleta skóry, kamienia i orzecha",
        "furniture-lighting",
        "/landing/generated/barcelona-chair-materials.png",
      ],
    ] as const,
    moodboardDescription: "Obraz moodboardu demo",
    laborSections: [
      "Przygotowanie inwestycji",
      "Stan surowy",
      "Wykończenie wnętrz",
    ],
    laborItems: [
      ["Inwentaryzacja i wytyczenie", 0, 24, "godz.", 95],
      ["Koordynacja pozwolenia", 0, 18, "godz.", 120],
      ["Ekipa fundamentowa", 1, 160, "godz.", 88],
      ["Ekipa konstrukcyjna", 1, 240, "godz.", 82],
      ["Montaż przegród zewnętrznych", 1, 110, "godz.", 96],
      ["Montaż zabudowy stolarskiej", 2, 72, "godz.", 105],
      ["Biały montaż elektryczny", 2, 40, "godz.", 98],
    ] as const,
    laborNotes: "Pozycja robocizny demo do przeglądu budżetu przez klienta.",
    payments: [
      [
        "Zaliczka projektowa",
        "Opłacona zaliczka za koncepcję i projekt schematyczny.",
        25000,
        "paid",
      ],
      [
        "Etap dokumentacji do pozwolenia",
        "Płatność po złożeniu pakietu dokumentacji do pozwolenia.",
        42000,
        "open",
      ],
      [
        "Etap rysunków wykonawczych",
        "Szkic płatności za szczegółowe rysunki wykonawcze.",
        58000,
        "draft",
      ],
      [
        "Ryczałt za nadzór autorski",
        "Szkic ryczałtu za obsługę w trakcie realizacji.",
        36000,
        "draft",
      ],
    ] as const,
    contacts: [
      ["Jan Nowak", "Pracownia Nowak Architektura", "architekt", "other"],
      ["Maria Zielińska", "Zielińska Konstrukcje", "konstruktor", "contractor"],
      [
        "Piotr Malinowski",
        "Malinowski Budowa",
        "generalny wykonawca",
        "contractor",
      ],
      [
        "Katarzyna Wolska",
        "Wolska Studio Materiałów",
        "dostawca materialow",
        "supplier",
      ],
      [
        "Tomasz Lewandowski",
        "Lewandowski Elektryka",
        "podwykonawca elektryczny",
        "subcontractor",
      ],
    ] as const,
    contactPhone: "+48 22 555 0100",
    contactCity: "Warszawa",
    contactCountry: "PL",
    contactNotes: (role: string) => `Kontakt demo: ${role}.`,
    notes: [
      [
        "Demo: Priorytety klienta",
        "Anna chce ciepłych naturalnych materiałów, trwałych przestrzeni rodzinnych i czytelnego budżetu.",
      ],
      [
        "Demo: Strategia pozwolenia",
        "Utrzymać zgodność pakietu do pozwolenia z przeglądem konstrukcji i harmonogramem stolarki.",
      ],
      [
        "Demo: Lista zakupów pod obserwacją",
        "Śledzić terminy dostaw płytek, oświetlenia dekoracyjnego, drzwi zewnętrznych i zabudowy orzechowej.",
      ],
      [
        "Demo: Przekazanie portalu",
        "Użyj Aktualizuj portal, żeby opublikować aktualne dane demo, a potem Otwórz portal do przeglądu po stronie klienta.",
      ],
    ] as const,
  },
};

const normalizeDemoSeedLocale = (locale?: string): DemoSeedLocale =>
  locale === "pl" ? "pl" : "en";

const toDemoEmailLocalPart = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".");

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

const hasDemoProject = async (ctx: SeedCtx, teamId: Id<"teams">) => {
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
    locale?: DemoSeedLocale;
  },
) => {
  if (await hasDemoProject(ctx, args.teamId)) {
    return null;
  }

  const copy = demoSeedCopy[normalizeDemoSeedLocale(args.locale)];
  const now = Date.now();
  const projectId = await ctx.db.insert("projects", {
    name: copy.project.name,
    description: copy.project.description,
    coverImageUrl: DEMO_COVER_IMAGE,
    teamId: args.teamId,
    slug: DEMO_PROJECT_SLUG,
    projectId: await generateNextProjectId(ctx),
    status: "active",
    startDate: atNoonUtc(2026, 5, 1),
    endDate: atNoonUtc(2026, 10, 20),
    budget: copy.project.budget,
    customer: copy.project.customer,
    customerEmail: copy.project.customerEmail,
    location: copy.project.location,
    currency: copy.project.currency,
    measurements: copy.project.measurements,
    createdBy: args.createdByClerkUserId,
    responsibleClerkUserId: args.createdByClerkUserId,
    clientPortalNotificationSettings: {
      recipientClerkUserIds: [args.createdByClerkUserId],
    },
    assignedTo: [args.createdByClerkUserId],
    taskStatusSettings: copy.taskStatusSettings,
    clientPanelPublishedSettings: portalSettings,
    paymentCustomerName: copy.project.customer,
    paymentCustomerEmail: copy.project.customerEmail,
    paymentCustomerDetails: copy.project.paymentCustomerDetails,
    aiAutoConfirmCrud: false,
    moodboardSections: copy.moodboardSections,
  });

  await seedTasks(ctx, projectId, args.teamId, args.createdByClerkUserId, copy);
  await seedShopping(
    ctx,
    projectId,
    args.teamId,
    args.createdByClerkUserId,
    copy,
  );
  await seedMoodboard(
    ctx,
    projectId,
    args.teamId,
    args.createdByClerkUserId,
    copy,
  );
  await seedLabor(ctx, projectId, args.teamId, args.createdByClerkUserId, copy);
  await seedPayments(
    ctx,
    projectId,
    args.teamId,
    args.createdByClerkUserId,
    copy,
  );
  await seedNotes(
    ctx,
    projectId,
    args.teamId,
    args.createdByClerkUserId,
    now,
    copy,
  );

  return projectId;
};

const seedTasks = async (
  ctx: SeedCtx,
  projectId: Id<"projects">,
  teamId: Id<"teams">,
  createdBy: string,
  copy: (typeof demoSeedCopy)[DemoSeedLocale],
) => {
  await Promise.all(
    copy.tasks.map(([title, status, priority, tag], index) =>
      ctx.db.insert("tasks", {
        title,
        description:
          title === copy.portalTaskTitle
            ? copy.portalTaskDescription
            : copy.taskDescription(tag),
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
  copy: (typeof demoSeedCopy)[DemoSeedLocale],
) => {
  const sections = await Promise.all(
    copy.shoppingSections.map((name, order) =>
      ctx.db.insert("shoppingListSections", {
        name,
        projectId,
        teamId,
        order,
        createdBy,
      }),
    ),
  );

  await Promise.all(
    copy.shoppingItems.map(
      ([
        name,
        sectionIndex,
        category,
        imageUrl,
        quantity,
        unit,
        unitPrice,
        notes,
      ]) =>
        ctx.db.insert("shoppingListItems", {
          name,
          notes,
          completed: false,
          priority: "medium",
          imageUrl,
          supplier: copy.demoSupplier,
          category,
          quantity,
          unit,
          unitPrice,
          totalPrice: quantity * unitPrice,
          realizationStatus: copy.orderedItemNames.includes(name)
            ? "ORDERED"
            : "PLANNED",
          sectionId: sections[sectionIndex],
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
  copy: (typeof demoSeedCopy)[DemoSeedLocale],
) => {
  await Promise.all(
    copy.moodboardImages.map(([name, section, storageId], order) =>
      ctx.db.insert("files", {
        name,
        description: copy.moodboardDescription,
        teamId,
        projectId,
        fileType: "image",
        storageId,
        size: 900000,
        mimeType: "image/png",
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
  copy: (typeof demoSeedCopy)[DemoSeedLocale],
) => {
  const sections = await Promise.all(
    copy.laborSections.map((name, order) =>
      ctx.db.insert("laborSections", {
        name,
        projectId,
        teamId,
        order,
        createdBy,
      }),
    ),
  );

  await Promise.all(
    copy.laborItems.map(
      ([name, sectionIndex, quantity, unit, unitPrice], index) =>
        ctx.db.insert("laborItems", {
          name,
          notes: copy.laborNotes,
          quantity,
          unit,
          unitPrice,
          totalPrice: quantity * unitPrice,
          sectionId: sections[sectionIndex],
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
  copy: (typeof demoSeedCopy)[DemoSeedLocale],
) => {
  await Promise.all(
    copy.payments.map(([title, description, amount, status], order) =>
      ctx.db.insert("projectPayments", {
        projectId,
        teamId,
        title,
        description,
        amount,
        currency: copy.project.currency,
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
  copy: (typeof demoSeedCopy)[DemoSeedLocale],
) => {
  for (const [name, companyName, role, type] of copy.contacts) {
    const contactId = await ctx.db.insert("contacts", {
      name,
      companyName,
      email: `${toDemoEmailLocalPart(name)}@example.com`,
      phone: copy.contactPhone,
      city: copy.contactCity,
      country: copy.contactCountry,
      notes: copy.contactNotes(role),
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
  copy: (typeof demoSeedCopy)[DemoSeedLocale],
) => {
  await Promise.all(
    copy.notes.map(([title, content]) =>
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
