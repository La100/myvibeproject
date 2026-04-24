/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Utility function to check project access
const hasProjectAccess = async (
  ctx: any,
  projectId: Id<"projects">,
  requireWriteAccess = false,
): Promise<boolean> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject),
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) return false;
  if (
    membership.role === "member" &&
    Array.isArray(membership.projectIds) &&
    !membership.projectIds.includes(projectId)
  ) {
    return false;
  }

  if (requireWriteAccess) {
    return membership.role === "admin" || membership.role === "member";
  }

  return membership.role === "admin" || membership.role === "member";
};

const fetchUsersByClerkIds = async (
  ctx: any,
  clerkUserIds: Iterable<string | null | undefined>,
) => {
  const uniqueIds = [
    ...new Set([...clerkUserIds].filter((id): id is string => Boolean(id))),
  ];

  if (uniqueIds.length === 0) return new Map<string, any>();

  const users = await Promise.all(
    uniqueIds.map((clerkUserId) =>
      ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
        .unique(),
    ),
  );

  const byClerkId = new Map<string, any>();
  for (const user of users) {
    if (user) byClerkId.set(user.clerkUserId, user);
  }

  return byClerkId;
};

const isRangeOverlapping = (
  itemStart: number,
  itemEnd: number,
  rangeStart: number,
  rangeEnd: number,
) => itemStart <= rangeEnd && itemEnd >= rangeStart;

const monthRangeFromKey = (month: string) => {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;

  const firstDay = new Date(Date.UTC(year, monthIdx, 1));
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0));

  const startTimestamp = firstDay.getTime();
  const endTimestamp = lastDay.getTime() + 86399999;

  return { startTimestamp, endTimestamp };
};

const getAccessibleProjectsForClerkOrg = async (ctx: any, clerkOrgId: string) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return [];

  const team = await ctx.db
    .query("teams")
    .withIndex("by_clerk_org", (q: any) => q.eq("clerkOrgId", clerkOrgId))
    .unique();

  if (!team) return [];

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", team._id).eq("clerkUserId", identity.subject),
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .unique();

  if (!membership) return [];

  if (membership.role === "admin") {
    return await ctx.db
      .query("projects")
      .withIndex("by_team", (q: any) => q.eq("teamId", team._id))
      .collect();
  }

  if (Array.isArray(membership.projectIds)) {
    const projectResults = await Promise.all(
      membership.projectIds.map((projectId: Id<"projects">) => ctx.db.get(projectId)),
    );
    return projectResults.filter(Boolean);
  }

  return await ctx.db
    .query("projects")
    .withIndex("by_team", (q: any) => q.eq("teamId", team._id))
    .collect();
};

// ====== QUERIES ======

export const getProjectCalendarEvents = query({
  args: {
    projectId: v.id("projects"),
    dateRange: v.optional(
      v.object({
        startDate: v.number(),
        endDate: v.number(),
      }),
    ),
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) {
      return {
        tasks: [],
        shoppingItems: [],
        laborItems: [],
        surveys: [],
        estimations: [],
        notes: [],
        todos: [],
      };
    }

    const [allTasks, allShoppingItems, allLaborItems, allSurveys, allEstimations, allNotes] =
      await Promise.all([
        ctx.db.query("tasks").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
        ctx.db
          .query("shoppingListItems")
          .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
          .collect(),
        ctx.db.query("laborItems").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
        ctx.db.query("surveys").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
        ctx.db
          .query("costEstimations")
          .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
          .collect(),
        ctx.db.query("notes").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
      ]);

    const withinRange = (timestamp: number | undefined) => {
      if (!timestamp) return false;
      if (!args.dateRange) return true;
      return timestamp >= args.dateRange.startDate && timestamp <= args.dateRange.endDate;
    };

    const tasksWithDates = allTasks.filter((task: any) => {
      const taskStart = task.startDate ?? task.endDate;
      const taskEnd = task.endDate ?? task.startDate;
      if (!taskStart || !taskEnd) return false;

      if (!args.dateRange) return true;
      return isRangeOverlapping(taskStart, taskEnd, args.dateRange.startDate, args.dateRange.endDate);
    });

    const laborWithDates = allLaborItems.filter((item: any) => {
      const laborStart = item.startDate ?? item.endDate;
      const laborEnd = item.endDate ?? item.startDate;
      if (!laborStart || !laborEnd) return false;

      if (!args.dateRange) return true;
      return isRangeOverlapping(laborStart, laborEnd, args.dateRange.startDate, args.dateRange.endDate);
    });

    const shoppingWithDates = allShoppingItems.filter((item: any) => withinRange(item.buyBefore));

    const surveysWithDates = allSurveys.filter((survey: any) => {
      const surveyStart = survey.startDate ?? survey.endDate;
      const surveyEnd = survey.endDate ?? survey.startDate;
      if (!surveyStart || !surveyEnd) return false;

      if (!args.dateRange) return true;
      return isRangeOverlapping(surveyStart, surveyEnd, args.dateRange.startDate, args.dateRange.endDate);
    });

    const estimationsWithDates = allEstimations.filter((estimation: any) =>
      withinRange(estimation.plannedStartDate) ||
      withinRange(estimation.validUntil) ||
      withinRange(estimation.estimationDate),
    );

    const notesWithDates = allNotes.filter((note: any) => withinRange(note.createdAt));

    const todosWithoutDates = allTasks.filter((task: any) => !task.startDate && !task.endDate);

    const usersByClerkId = await fetchUsersByClerkIds(ctx, [
      ...tasksWithDates.flatMap((task: any) => [task.assignedTo ?? null, task.createdBy]),
      ...shoppingWithDates.flatMap((item: any) => [item.assignedTo ?? null, item.createdBy]),
      ...laborWithDates.flatMap((item: any) => [item.assignedTo ?? null, item.createdBy]),
      ...surveysWithDates.map((survey: any) => survey.createdBy),
      ...estimationsWithDates.map((estimation: any) => estimation.createdBy),
      ...notesWithDates.map((note: any) => note.createdBy),
      ...todosWithoutDates.map((todo: any) => todo.assignedTo ?? null),
    ]);

    const enrichedTasks = tasksWithDates.map((task: any) => {
      const assignedUser = task.assignedTo ? usersByClerkId.get(task.assignedTo) : undefined;
      const createdByUser = usersByClerkId.get(task.createdBy);
      return {
        ...task,
        assignedToName: assignedUser?.name,
        assignedToImageUrl: assignedUser?.imageUrl,
        createdByName: createdByUser?.name,
      };
    });

    const enrichedShoppingItems = shoppingWithDates.map((item: any) => {
      const assignedUser = item.assignedTo ? usersByClerkId.get(item.assignedTo) : undefined;
      const createdByUser = usersByClerkId.get(item.createdBy);
      return {
        ...item,
        assignedToName: assignedUser?.name,
        assignedToImageUrl: assignedUser?.imageUrl,
        createdByName: createdByUser?.name,
      };
    });

    const enrichedLaborItems = laborWithDates.map((item: any) => {
      const assignedUser = item.assignedTo ? usersByClerkId.get(item.assignedTo) : undefined;
      const createdByUser = usersByClerkId.get(item.createdBy);
      return {
        ...item,
        assignedToName: assignedUser?.name,
        assignedToImageUrl: assignedUser?.imageUrl,
        createdByName: createdByUser?.name,
      };
    });

    const enrichedSurveys = surveysWithDates.map((survey: any) => {
      const createdByUser = usersByClerkId.get(survey.createdBy);
      return {
        ...survey,
        createdByName: createdByUser?.name,
      };
    });

    const enrichedEstimations = estimationsWithDates.map((estimation: any) => {
      const createdByUser = usersByClerkId.get(estimation.createdBy);
      return {
        ...estimation,
        createdByName: createdByUser?.name,
      };
    });

    const enrichedNotes = notesWithDates.map((note: any) => {
      const createdByUser = usersByClerkId.get(note.createdBy);
      return {
        ...note,
        createdByName: createdByUser?.name,
        createdByImageUrl: createdByUser?.imageUrl,
      };
    });

    const enrichedTodos = todosWithoutDates.map((todo: any) => {
      const assignedUser = todo.assignedTo ? usersByClerkId.get(todo.assignedTo) : undefined;
      return {
        ...todo,
        assignedToName: assignedUser?.name,
        assignedToImageUrl: assignedUser?.imageUrl,
      };
    });

    return {
      tasks: enrichedTasks,
      shoppingItems: enrichedShoppingItems,
      laborItems: enrichedLaborItems,
      surveys: enrichedSurveys,
      estimations: enrichedEstimations,
      notes: enrichedNotes,
      todos: enrichedTodos,
    };
  },
});

export const getUpcomingEvents = query({
  args: {
    projectId: v.id("projects"),
    daysAhead: v.optional(v.number()), // default 7 days
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const now = Date.now();
    const daysAhead = args.daysAhead || 7;
    const endDate = now + daysAhead * 24 * 60 * 60 * 1000;

    const [tasks, shoppingItems, laborItems, surveys, estimations] =
      await Promise.all([
        ctx.db.query("tasks").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
        ctx.db
          .query("shoppingListItems")
          .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
          .collect(),
        ctx.db.query("laborItems").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
        ctx.db.query("surveys").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
        ctx.db
          .query("costEstimations")
          .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
          .collect(),
      ]);

    const allEvents = [
      ...tasks
        .filter((task: any) => {
          const taskDate = task.endDate || task.startDate;
          return !!taskDate && taskDate >= now && taskDate <= endDate;
        })
        .map((task: any) => ({
        type: "task" as const,
        id: task._id,
        title: task.title,
        date: task.endDate || task.startDate,
        priority: task.priority || "medium",
        status: task.status,
      })),
      ...shoppingItems
        .filter((item: any) => !!item.buyBefore && item.buyBefore >= now && item.buyBefore <= endDate)
        .map((item: any) => ({
        type: "shopping" as const,
        id: item._id,
        title: item.name,
        date: item.buyBefore,
        priority: item.priority || "medium",
        status: item.realizationStatus,
      })),
      ...laborItems
        .filter((item: any) => {
          const laborDate = item.endDate || item.startDate;
          return !!laborDate && laborDate >= now && laborDate <= endDate;
        })
        .map((item: any) => ({
        type: "labor" as const,
        id: item._id,
        title: item.name,
        date: item.endDate || item.startDate,
        priority: "medium",
        status: "planned",
      })),
      ...surveys
        .filter((survey: any) => {
          const surveyDate = survey.endDate || survey.startDate;
          return !!surveyDate && surveyDate >= now && surveyDate <= endDate;
        })
        .map((survey: any) => ({
        type: "survey" as const,
        id: survey._id,
        title: survey.title,
        date: survey.endDate || survey.startDate,
        priority: "medium",
        status: survey.status,
      })),
      ...estimations
        .filter((estimation: any) => {
          const estimationDate =
            estimation.validUntil || estimation.plannedStartDate || estimation.estimationDate;
          return !!estimationDate && estimationDate >= now && estimationDate <= endDate;
        })
        .map((estimation: any) => ({
        type: "estimation" as const,
        id: estimation._id,
        title: estimation.title,
        date: estimation.validUntil || estimation.plannedStartDate || estimation.estimationDate,
        priority: "medium",
        status: estimation.status,
      })),
    ]
      .filter((event) => typeof event.date === "number")
      .sort((a, b) => a.date - b.date);

    return allEvents;
  },
});

export const getOverdueEvents = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const now = Date.now();

    const [tasks, shoppingItems, surveys, estimations] = await Promise.all([
      ctx.db.query("tasks").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
      ctx.db
        .query("shoppingListItems")
        .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db.query("surveys").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
      ctx.db
        .query("costEstimations")
        .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const overdueEvents = [
      ...tasks
        .filter((task: any) => {
          if (task.status === "done") return false;
          const taskDate = task.endDate || task.startDate;
          return taskDate && taskDate < now;
        })
        .map((task: any) => ({
          type: "task" as const,
          id: task._id,
          title: task.title,
          date: task.endDate || task.startDate,
          priority: task.priority || "medium",
          status: task.status,
        })),
      ...shoppingItems
        .filter((item: any) => {
          if (!item.buyBefore || item.buyBefore >= now) return false;
          return item.realizationStatus !== "COMPLETED" && item.realizationStatus !== "CANCELLED";
        })
        .map((item: any) => ({
          type: "shopping" as const,
          id: item._id,
          title: item.name,
          date: item.buyBefore,
          priority: item.priority || "medium",
          status: item.realizationStatus,
        })),
      ...surveys
        .filter((survey: any) => {
          const surveyDate = survey.endDate || survey.startDate;
          if (!surveyDate || surveyDate >= now) return false;
          return survey.status === "active" || survey.status === "draft";
        })
        .map((survey: any) => ({
          type: "survey" as const,
          id: survey._id,
          title: survey.title,
          date: survey.endDate || survey.startDate,
          priority: "medium",
          status: survey.status,
        })),
      ...estimations
        .filter((estimation: any) => {
          const due = estimation.validUntil;
          if (!due || due >= now) return false;
          return estimation.status === "draft" || estimation.status === "sent";
        })
        .map((estimation: any) => ({
          type: "estimation" as const,
          id: estimation._id,
          title: estimation.title,
          date: estimation.validUntil,
          priority: "medium",
          status: estimation.status,
        })),
    ].sort((a, b) => a.date - b.date);

    return overdueEvents;
  },
});

export const getProjectCalendarData = query({
  args: {
    projectId: v.id("projects"),
    month: v.string(), // "YYYY-MM" format
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) {
      return {
        tasks: [],
        shoppingItems: [],
        laborItems: [],
        projectPayments: [],
      };
    }

    const { startTimestamp, endTimestamp } = monthRangeFromKey(args.month);
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return {
        tasks: [],
        shoppingItems: [],
        laborItems: [],
        projectPayments: [],
      };
    }

    const [allTasks, allShoppingItems, allLaborItems, allProjectPayments] = await Promise.all([
      ctx.db.query("tasks").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
      ctx.db
        .query("shoppingListItems")
        .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db.query("laborItems").withIndex("by_project", (q: any) => q.eq("projectId", args.projectId)).collect(),
      ctx.db
        .query("projectPayments")
        .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const tasksInRange = allTasks.filter((task: any) => {
      const taskStart = task.startDate ?? task.endDate;
      const taskEnd = task.endDate ?? task.startDate;
      if (!taskStart || !taskEnd) return false;
      return isRangeOverlapping(taskStart, taskEnd, startTimestamp, endTimestamp);
    });

    const shoppingInRange = allShoppingItems.filter(
      (item: any) => !!item.buyBefore && item.buyBefore >= startTimestamp && item.buyBefore <= endTimestamp,
    );

    const laborInRange = allLaborItems.filter((item: any) => {
      const laborStart = item.startDate ?? item.endDate;
      const laborEnd = item.endDate ?? item.startDate;
      if (!laborStart || !laborEnd) return false;
      return isRangeOverlapping(laborStart, laborEnd, startTimestamp, endTimestamp);
    });

    const projectPaymentsInRange = allProjectPayments.filter((payment: any) =>
      [payment.dueDate, payment.invoiceIssuedAt, payment.sentAt, payment.paidAt].some(
        (timestamp) =>
          typeof timestamp === "number" && timestamp >= startTimestamp && timestamp <= endTimestamp,
      ),
    );

    const usersByClerkId = await fetchUsersByClerkIds(ctx, [
      ...tasksInRange.map((task: any) => task.assignedTo ?? null),
      ...shoppingInRange.map((item: any) => item.assignedTo ?? null),
      ...laborInRange.map((item: any) => item.assignedTo ?? null),
      ...projectPaymentsInRange.map((payment: any) => payment.createdBy),
    ]);

    const enrichedTasks = tasksInRange.map((task: any) => ({
      _id: task._id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      startDate: task.startDate,
      endDate: task.endDate,
      assignedToName: task.assignedTo ? usersByClerkId.get(task.assignedTo)?.name : undefined,
      projectSlug: project.slug,
      projectName: project.name,
    }));

    const enrichedShoppingItems = shoppingInRange.map((item: any) => ({
      _id: item._id,
      name: item.name,
      notes: item.notes,
      buyBefore: item.buyBefore,
      priority: item.priority,
      realizationStatus: item.realizationStatus,
      quantity: item.quantity,
      assignedToName: item.assignedTo ? usersByClerkId.get(item.assignedTo)?.name : undefined,
      projectSlug: project.slug,
      projectName: project.name,
    }));

    const enrichedLaborItems = laborInRange.map((item: any) => ({
      _id: item._id,
      name: item.name,
      notes: item.notes,
      quantity: item.quantity,
      unit: item.unit,
      startDate: item.startDate,
      endDate: item.endDate,
      assignedToName: item.assignedTo ? usersByClerkId.get(item.assignedTo)?.name : undefined,
      projectSlug: project.slug,
      projectName: project.name,
    }));

    const enrichedProjectPayments = projectPaymentsInRange.map((payment: any) => ({
      _id: payment._id,
      title: payment.title,
      description: payment.description,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      invoiceNumber: payment.invoiceNumber || payment.stripeInvoiceNumber,
      paymentReference: payment.paymentReference,
      dueDate: payment.dueDate,
      invoiceIssuedAt: payment.invoiceIssuedAt,
      sentAt: payment.sentAt,
      paidAt: payment.paidAt,
      createdByName: usersByClerkId.get(payment.createdBy)?.name,
      projectSlug: project.slug,
      projectName: project.name,
      relevantDates: [
        {
          type: "dueDate" as const,
          timestamp: payment.dueDate,
        },
        {
          type: "invoiceIssuedAt" as const,
          timestamp: payment.invoiceIssuedAt,
        },
        {
          type: "sentAt" as const,
          timestamp: payment.sentAt,
        },
        {
          type: "paidAt" as const,
          timestamp: payment.paidAt,
        },
      ].filter(
        (entry) =>
          typeof entry.timestamp === "number" &&
          entry.timestamp >= startTimestamp &&
          entry.timestamp <= endTimestamp,
      ),
    }));

    return {
      tasks: enrichedTasks,
      shoppingItems: enrichedShoppingItems,
      laborItems: enrichedLaborItems,
      projectPayments: enrichedProjectPayments,
    };
  },
});

export const getOrganizationCalendarData = query({
  args: {
    clerkOrgId: v.string(),
    month: v.string(),
  },
  async handler(ctx, args) {
    const projects = await getAccessibleProjectsForClerkOrg(ctx, args.clerkOrgId);
    if (projects.length === 0) {
      return {
        tasks: [],
        shoppingItems: [],
        laborItems: [],
        projectPayments: [],
      };
    }

    const { startTimestamp, endTimestamp } = monthRangeFromKey(args.month);
    const projectMetaById = new Map<string, { slug: string; name: string }>(
      projects.map((project: any) => [
        String(project._id),
        { slug: project.slug as string, name: project.name as string },
      ]),
    );

    const [tasksByProject, shoppingByProject, laborByProject, projectPaymentsByProject] =
      await Promise.all([
        Promise.all(
          projects.map((project: any) =>
            ctx.db.query("tasks").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
          ),
        ),
        Promise.all(
          projects.map((project: any) =>
            ctx.db
              .query("shoppingListItems")
              .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
              .collect(),
          ),
        ),
        Promise.all(
          projects.map((project: any) =>
            ctx.db.query("laborItems").withIndex("by_project", (q: any) => q.eq("projectId", project._id)).collect(),
          ),
        ),
        Promise.all(
          projects.map((project: any) =>
            ctx.db
              .query("projectPayments")
              .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
              .collect(),
          ),
        ),
      ]);

    const allTasks = tasksByProject.flat();
    const allShoppingItems = shoppingByProject.flat();
    const allLaborItems = laborByProject.flat();
    const allProjectPayments = projectPaymentsByProject.flat();

    const tasksInRange = allTasks.filter((task: any) => {
      const taskStart = task.startDate ?? task.endDate;
      const taskEnd = task.endDate ?? task.startDate;
      if (!taskStart || !taskEnd) return false;
      return isRangeOverlapping(taskStart, taskEnd, startTimestamp, endTimestamp);
    });

    const shoppingInRange = allShoppingItems.filter(
      (item: any) => !!item.buyBefore && item.buyBefore >= startTimestamp && item.buyBefore <= endTimestamp,
    );

    const laborInRange = allLaborItems.filter((item: any) => {
      const laborStart = item.startDate ?? item.endDate;
      const laborEnd = item.endDate ?? item.startDate;
      if (!laborStart || !laborEnd) return false;
      return isRangeOverlapping(laborStart, laborEnd, startTimestamp, endTimestamp);
    });

    const projectPaymentsInRange = allProjectPayments.filter((payment: any) =>
      [payment.dueDate, payment.invoiceIssuedAt, payment.sentAt, payment.paidAt].some(
        (timestamp) =>
          typeof timestamp === "number" && timestamp >= startTimestamp && timestamp <= endTimestamp,
      ),
    );

    const usersByClerkId = await fetchUsersByClerkIds(ctx, [
      ...tasksInRange.map((task: any) => task.assignedTo ?? null),
      ...shoppingInRange.map((item: any) => item.assignedTo ?? null),
      ...laborInRange.map((item: any) => item.assignedTo ?? null),
      ...projectPaymentsInRange.map((payment: any) => payment.createdBy),
    ]);

    const enrichedTasks = tasksInRange.map((task: any) => {
      const projectMeta = projectMetaById.get(String(task.projectId));
      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        startDate: task.startDate,
        endDate: task.endDate,
        assignedToName: task.assignedTo ? usersByClerkId.get(task.assignedTo)?.name : undefined,
        projectSlug: projectMeta?.slug,
        projectName: projectMeta?.name,
      };
    });

    const enrichedShoppingItems = shoppingInRange.map((item: any) => {
      const projectMeta = projectMetaById.get(String(item.projectId));
      return {
        _id: item._id,
        name: item.name,
        notes: item.notes,
        buyBefore: item.buyBefore,
        priority: item.priority,
        realizationStatus: item.realizationStatus,
        quantity: item.quantity,
        assignedToName: item.assignedTo ? usersByClerkId.get(item.assignedTo)?.name : undefined,
        projectSlug: projectMeta?.slug,
        projectName: projectMeta?.name,
      };
    });

    const enrichedLaborItems = laborInRange.map((item: any) => {
      const projectMeta = projectMetaById.get(String(item.projectId));
      return {
        _id: item._id,
        name: item.name,
        notes: item.notes,
        quantity: item.quantity,
        unit: item.unit,
        startDate: item.startDate,
        endDate: item.endDate,
        assignedToName: item.assignedTo ? usersByClerkId.get(item.assignedTo)?.name : undefined,
        projectSlug: projectMeta?.slug,
        projectName: projectMeta?.name,
      };
    });

    const enrichedProjectPayments = projectPaymentsInRange.map((payment: any) => {
      const projectMeta = projectMetaById.get(String(payment.projectId));
      return {
        _id: payment._id,
        title: payment.title,
        description: payment.description,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        invoiceNumber: payment.invoiceNumber || payment.stripeInvoiceNumber,
        paymentReference: payment.paymentReference,
        dueDate: payment.dueDate,
        invoiceIssuedAt: payment.invoiceIssuedAt,
        sentAt: payment.sentAt,
        paidAt: payment.paidAt,
        createdByName: usersByClerkId.get(payment.createdBy)?.name,
        projectSlug: projectMeta?.slug,
        projectName: projectMeta?.name,
        relevantDates: [
          {
            type: "dueDate" as const,
            timestamp: payment.dueDate,
          },
          {
            type: "invoiceIssuedAt" as const,
            timestamp: payment.invoiceIssuedAt,
          },
          {
            type: "sentAt" as const,
            timestamp: payment.sentAt,
          },
          {
            type: "paidAt" as const,
            timestamp: payment.paidAt,
          },
        ].filter(
          (entry) =>
            typeof entry.timestamp === "number" &&
            entry.timestamp >= startTimestamp &&
            entry.timestamp <= endTimestamp,
        ),
      };
    });

    return {
      tasks: enrichedTasks,
      shoppingItems: enrichedShoppingItems,
      laborItems: enrichedLaborItems,
      projectPayments: enrichedProjectPayments,
    };
  },
});

// ====== MUTATIONS ======

export const updateTaskDates = mutation({
  args: {
    taskId: v.id("tasks"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const hasAccess = await hasProjectAccess(ctx, task.projectId, true);
    if (!hasAccess) throw new Error("Permission denied");

    await ctx.db.patch(args.taskId, {
      startDate: args.startDate,
      endDate: args.endDate,
    });

    return { success: true };
  },
});

export const updateShoppingItemBuyBefore = mutation({
  args: {
    itemId: v.id("shoppingListItems"),
    buyBefore: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Shopping item not found");

    const hasAccess = await hasProjectAccess(ctx, item.projectId, true);
    if (!hasAccess) throw new Error("Permission denied");

    await ctx.db.patch(args.itemId, { buyBefore: args.buyBefore });

    return { success: true };
  },
});
