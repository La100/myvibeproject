import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { action, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const PROFILE_CONFIG = {
  lite: {
    tasks: 4,
    notes: 2,
    shoppingItems: 6,
    laborItems: 4,
    contacts: 2,
    surveys: 1,
  },
  standard: {
    tasks: 8,
    notes: 3,
    shoppingItems: 12,
    laborItems: 8,
    contacts: 3,
    surveys: 2,
  },
  heavy: {
    tasks: 14,
    notes: 5,
    shoppingItems: 20,
    laborItems: 14,
    contacts: 5,
    surveys: 3,
  },
} as const;

const DEFAULT_PROFILE = "standard" as const;
const getProjectRef = makeFunctionReference<"query">("projects:getProject");
const getCurrentUserTeamMemberRef =
  makeFunctionReference<"query">("teams:getCurrentUserTeamMember");
const getTeamByIdRef = makeFunctionReference<"query">("teams:getTeamById");
const createContactRef = makeFunctionReference<"mutation">("contacts:createContact");
const assignContactToProjectRef =
  makeFunctionReference<"mutation">("contacts:assignContactToProject");
const createTaskRef = makeFunctionReference<"mutation">("tasks:createTask");
const createNoteRef = makeFunctionReference<"mutation">("notes:createNote");
const createShoppingListItemRef =
  makeFunctionReference<"mutation">("shopping:createShoppingListItem");
const createLaborItemRef = makeFunctionReference<"mutation">("labor:createLaborItem");
const createSurveyRef = makeFunctionReference<"mutation">("surveys:createSurvey");
const createSurveyQuestionRef =
  makeFunctionReference<"mutation">("surveys:createSurveyQuestion");
const analyzeProjectDataRef = makeFunctionReference<"query">("projectDiagnostics:analyzeProjectData");

const hasProjectAccess = (
  membership: Pick<Doc<"teamMembers">, "role" | "projectIds" | "isActive"> | null,
  projectId: Id<"projects">,
  requireWrite: boolean,
) => {
  if (!membership || !membership.isActive) return false;
  if (
    membership.role === "member" &&
    Array.isArray(membership.projectIds) &&
    !membership.projectIds.includes(projectId)
  ) {
    return false;
  }
  return true;
};

const includesSeedTag = (values: Array<string | undefined | null>, seedTag?: string) => {
  if (!seedTag) return true;
  const normalized = seedTag.toLowerCase();
  return values.some((value) => typeof value === "string" && value.toLowerCase().includes(normalized));
};

const percentage = (value: number, total: number) => {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
};

const sum = (values: number[]) => values.reduce((acc, current) => acc + current, 0);

export const analyzeProjectData = query({
  args: {
    projectId: v.id("projects"),
    seedTag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject))
      .unique();

    if (!hasProjectAccess(membership, args.projectId, false)) {
      throw new Error("Forbidden");
    }

    const now = Date.now();

    const [tasksRaw, notesRaw, shoppingRaw, laborRaw, surveysRaw, projectContactsRaw] = await Promise.all([
      ctx.db.query("tasks").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
      ctx.db.query("notes").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
      ctx.db.query("shoppingListItems").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
      ctx.db.query("laborItems").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
      ctx.db.query("surveys").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
      ctx.db.query("projectContacts").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect(),
    ]);

    const projectContactsResolved = await Promise.all(
      projectContactsRaw.map(async (assignment) => ({
        assignment,
        contact: await ctx.db.get(assignment.contactId),
      })),
    );

    const tasks = tasksRaw.filter((item) => includesSeedTag([item.title, item.description], args.seedTag));
    const notes = notesRaw.filter((item) => includesSeedTag([item.title, item.content], args.seedTag));
    const shoppingItems = shoppingRaw.filter((item) => includesSeedTag([item.name, item.notes], args.seedTag));
    const laborItems = laborRaw.filter((item) => includesSeedTag([item.name, item.notes], args.seedTag));
    const surveys = surveysRaw.filter((item) => includesSeedTag([item.title, item.description], args.seedTag));
    const projectContacts = projectContactsResolved.filter(({ contact }) =>
      includesSeedTag([contact?.name, contact?.companyName, contact?.notes], args.seedTag),
    );

    const surveyQuestionCounts = new Map<string, number>();
    await Promise.all(
      surveys.map(async (survey) => {
        const questions = await ctx.db
          .query("surveyQuestions")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .collect();
        surveyQuestionCounts.set(survey._id, questions.length);
      }),
    );

    const doneTasks = tasks.filter((task) => task.status === "done").length;
    const overdueTasks = tasks.filter((task) => !!task.endDate && task.endDate < now && task.status !== "done");
    const shoppingWithPrice = shoppingItems.filter((item) => typeof item.unitPrice === "number" && item.unitPrice > 0);
    const laborWithPrice = laborItems.filter((item) => typeof item.unitPrice === "number" && item.unitPrice > 0);
    const surveysWithQuestions = surveys.filter((survey) => (surveyQuestionCounts.get(survey._id) || 0) > 0).length;

    const shoppingWithoutPrice = shoppingItems.filter((item) => !(typeof item.unitPrice === "number" && item.unitPrice > 0));
    const laborWithoutPrice = laborItems.filter((item) => !(typeof item.unitPrice === "number" && item.unitPrice > 0));

    const shoppingBudget = sum(
      shoppingItems.map((item) => {
        if (typeof item.totalPrice === "number") return item.totalPrice;
        if (typeof item.unitPrice === "number") return item.quantity * item.unitPrice;
        return 0;
      }),
    );

    const laborBudget = sum(
      laborItems.map((item) => {
        if (typeof item.totalPrice === "number") return item.totalPrice;
        if (typeof item.unitPrice === "number") return item.quantity * item.unitPrice;
        return 0;
      }),
    );

    const notesAverageLength =
      notes.length > 0 ? Math.round(sum(notes.map((note) => note.content.length)) / notes.length) : 0;

    const tasksDonePct = percentage(doneTasks, tasks.length);
    const shoppingPriceCoveragePct = percentage(shoppingWithPrice.length, shoppingItems.length);
    const laborPriceCoveragePct = percentage(laborWithPrice.length, laborItems.length);
    const surveysWithQuestionsPct = percentage(surveysWithQuestions, surveys.length);

    let score = 0;
    if (tasks.length > 0) score += 20;
    if (shoppingItems.length > 0) score += 10;
    if (laborItems.length > 0) score += 10;
    if (notes.length > 0) score += 8;
    if (projectContacts.length > 0) score += 12;
    if (surveys.length > 0) score += 10;
    score += Math.round(tasksDonePct * 0.15);
    score += Math.round(shoppingPriceCoveragePct * 0.15);
    score += Math.round(laborPriceCoveragePct * 0.12);
    score += Math.round(surveysWithQuestionsPct * 0.08);
    if (overdueTasks.length === 0 && tasks.length > 0) score += 5;
    score = Math.min(100, Math.max(0, score));

    const insights: string[] = [];
    if (tasks.length === 0) insights.push("No tasks in the project.");
    if (shoppingItems.length === 0) insights.push("No shopping items.");
    if (laborItems.length === 0) insights.push("No labor items.");
    if (projectContacts.length === 0) insights.push("No contacts assigned to the project.");
    if (surveys.length === 0) insights.push("No surveys.");
    if (shoppingWithoutPrice.length > 0) {
      insights.push(`Missing prices for ${shoppingWithoutPrice.length} shopping items.`);
    }
    if (laborWithoutPrice.length > 0) {
      insights.push(`Missing prices for ${laborWithoutPrice.length} labor items.`);
    }
    if (overdueTasks.length > 0) {
      insights.push(`You have ${overdueTasks.length} overdue tasks.`);
    }
    if (notes.length > 0 && notesAverageLength < 120) {
      insights.push("Notes are very short - add more execution context.");
    }
    if (insights.length === 0) {
      insights.push("No critical data gaps.");
    }

    return {
      scope: args.seedTag ? "seeded" : "project",
      seedTag: args.seedTag ?? null,
      counts: {
        tasks: tasks.length,
        notes: notes.length,
        shoppingItems: shoppingItems.length,
        laborItems: laborItems.length,
        contacts: projectContacts.length,
        surveys: surveys.length,
      },
      coverage: {
        tasksDonePct,
        shoppingPriceCoveragePct,
        laborPriceCoveragePct,
        surveysWithQuestionsPct,
      },
      budget: {
        shoppingTotal: Math.round(shoppingBudget * 100) / 100,
        laborTotal: Math.round(laborBudget * 100) / 100,
        grandTotal: Math.round((shoppingBudget + laborBudget) * 100) / 100,
      },
      risks: {
        overdueTasks: overdueTasks.length,
        shoppingWithoutPrice: shoppingWithoutPrice.length,
        laborWithoutPrice: laborWithoutPrice.length,
      },
      examples: {
        overdueTasks: overdueTasks.slice(0, 5).map((task) => task.title),
        shoppingWithoutPrice: shoppingWithoutPrice.slice(0, 5).map((item) => item.name),
        laborWithoutPrice: laborWithoutPrice.slice(0, 5).map((item) => item.name),
      },
      notesAverageLength,
      score,
      insights,
      generatedAt: now,
    };
  },
});

export const seedAndAnalyzeProject = action({
  args: {
    projectId: v.id("projects"),
    profile: v.optional(v.union(v.literal("lite"), v.literal("standard"), v.literal("heavy"))),
    seedTag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.runQuery(getProjectRef, { projectId: args.projectId });
    if (!project) throw new Error("Project not found");

    const membership = await ctx.runQuery(getCurrentUserTeamMemberRef, {
      teamId: project.teamId,
    });
    if (!hasProjectAccess(membership, args.projectId, true)) {
      throw new Error("Forbidden");
    }

    const team = await ctx.runQuery(getTeamByIdRef, { teamId: project.teamId });
    if (!team?.slug) {
      throw new Error("Team slug missing");
    }

    const profile = args.profile ?? DEFAULT_PROFILE;
    const config = PROFILE_CONFIG[profile];
    const now = Date.now();
    const autoTag = `SEED-${new Date(now).toISOString().slice(0, 10)}-${now.toString(36).slice(-4)}`;
    const seedTag = args.seedTag?.trim() || autoTag;
    const warnings: string[] = [];

    const created = {
      tasks: 0,
      notes: 0,
      shoppingItems: 0,
      laborItems: 0,
      contacts: 0,
      surveys: 0,
      surveyQuestions: 0,
    };

    const createdContactIds: Id<"contacts">[] = [];
    const statuses: Array<"todo" | "in_progress" | "review" | "done"> = [
      "todo",
      "in_progress",
      "review",
      "done",
    ];
    const priorities: Array<"low" | "medium" | "high" | "urgent"> = [
      "low",
      "medium",
      "high",
      "urgent",
    ];
    const shoppingStatuses: Array<"PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED"> = [
      "PLANNED",
      "ORDERED",
      "IN_TRANSIT",
      "DELIVERED",
      "COMPLETED",
    ];
    const laborUnits = ["m2", "m", "hours", "pcs"] as const;
    const contactTypes: Array<"contractor" | "supplier" | "subcontractor" | "other"> = [
      "contractor",
      "supplier",
      "subcontractor",
      "other",
    ];

    for (let i = 0; i < config.contacts; i += 1) {
      try {
        const contactId = await ctx.runMutation(createContactRef, {
          teamSlug: team.slug,
          name: `${seedTag} Kontakt ${i + 1}`,
          companyName: `${seedTag} Firma ${i + 1}`,
          email: `${seedTag.toLowerCase()}-${i + 1}@example.com`,
          phone: `+48 500 100 ${String(i + 1).padStart(3, "0")}`,
          type: contactTypes[i % contactTypes.length],
          notes: `Kontakt testowy wygenerowany przez seed (${seedTag})`,
          website: `https://example.com/${seedTag.toLowerCase()}/${i + 1}`,
        });
        created.contacts += 1;
        createdContactIds.push(contactId);
      } catch (error) {
        warnings.push(`contact_${i + 1}: ${(error as Error).message}`);
      }
    }

    for (const contactId of createdContactIds) {
      try {
        await ctx.runMutation(assignContactToProjectRef, {
          projectId: args.projectId,
          contactId,
          role: "seed",
          notes: `Przypisane automatycznie (${seedTag})`,
        });
      } catch (error) {
        warnings.push(`project_contact_${contactId}: ${(error as Error).message}`);
      }
    }

    for (let i = 0; i < config.tasks; i += 1) {
      const status = statuses[i % statuses.length];
      const endDate = now + (i - 2) * 24 * 60 * 60 * 1000;
      try {
        await ctx.runMutation(createTaskRef, {
          title: `${seedTag} Task ${i + 1}`,
          description: `Automatyczny task testowy (${seedTag})`,
          projectId: args.projectId,
          teamId: project.teamId,
          status,
          priority: priorities[i % priorities.length],
          startDate: now - 24 * 60 * 60 * 1000,
          endDate,
          tags: [seedTag, "seed", "diagnostics"],
          content: `Checklist dla taska ${i + 1} - wygenerowane automatycznie.`,
        });
        created.tasks += 1;
      } catch (error) {
        warnings.push(`task_${i + 1}: ${(error as Error).message}`);
      }
    }

    for (let i = 0; i < config.notes; i += 1) {
      try {
        await ctx.runMutation(createNoteRef, {
          title: `${seedTag} Notatka ${i + 1}`,
          content:
            `To jest notatka testowa (${seedTag}).\n` +
            "Zakres: przygotowanie projektu, logistyka, wykonawcy, terminy i ryzyka.\n" +
            `Sekcja #${i + 1}.`,
          projectId: args.projectId,
        });
        created.notes += 1;
      } catch (error) {
        warnings.push(`note_${i + 1}: ${(error as Error).message}`);
      }
    }

    for (let i = 0; i < config.shoppingItems; i += 1) {
      try {
        const quantity = (i % 4) + 1;
        const unitPrice = i % 3 === 0 ? undefined : 15 + i * 7;
        await ctx.runMutation(createShoppingListItemRef, {
          projectId: args.projectId,
          name: `${seedTag} Material ${i + 1}`,
          notes: `Test shopping item (${seedTag})`,
          quantity,
          unitPrice,
          priority: priorities[i % priorities.length],
          category: i % 2 === 0 ? "Finishes" : "Installations",
          supplier: `Supplier ${i + 1}`,
          realizationStatus: shoppingStatuses[i % shoppingStatuses.length],
        });
        created.shoppingItems += 1;
      } catch (error) {
        warnings.push(`shopping_${i + 1}: ${(error as Error).message}`);
      }
    }

    for (let i = 0; i < config.laborItems; i += 1) {
      try {
        const quantity = (i % 5) + 1;
        const unitPrice = i % 4 === 0 ? undefined : 40 + i * 12;
        await ctx.runMutation(createLaborItemRef, {
          projectId: args.projectId,
          name: `${seedTag} Labor ${i + 1}`,
          notes: `Test labor item (${seedTag})`,
          quantity,
          unit: laborUnits[i % laborUnits.length],
          unitPrice,
          startDate: now + i * 24 * 60 * 60 * 1000,
          endDate: now + (i + 1) * 24 * 60 * 60 * 1000,
        });
        created.laborItems += 1;
      } catch (error) {
        warnings.push(`labor_${i + 1}: ${(error as Error).message}`);
      }
    }

    for (let i = 0; i < config.surveys; i += 1) {
      try {
        const surveyId = await ctx.runMutation(createSurveyRef, {
          title: `${seedTag} Survey ${i + 1}`,
          description: `Quality survey generated automatically (${seedTag})`,
          projectId: args.projectId,
          isRequired: i % 2 === 0,
          allowMultipleResponses: false,
          startDate: now,
          endDate: now + 14 * 24 * 60 * 60 * 1000,
        });
        created.surveys += 1;

        await ctx.runMutation(createSurveyQuestionRef, {
          surveyId,
          questionText: "How do you rate the work progress?",
          questionType: "rating",
          isRequired: true,
          order: 0,
          ratingScale: {
            min: 1,
            max: 5,
            minLabel: "Poor",
            maxLabel: "Very good",
          },
        });
        created.surveyQuestions += 1;

        await ctx.runMutation(createSurveyQuestionRef, {
          surveyId,
          questionText: "What should be improved in the next stage?",
          questionType: "text_long",
          isRequired: false,
          order: 1,
        });
        created.surveyQuestions += 1;
      } catch (error) {
        warnings.push(`survey_${i + 1}: ${(error as Error).message}`);
      }
    }

    const analysis = await ctx.runQuery(analyzeProjectDataRef, {
      projectId: args.projectId,
      seedTag,
    });

    return {
      success: true,
      profile,
      seedTag,
      created,
      warnings,
      analysis,
    };
  },
});
