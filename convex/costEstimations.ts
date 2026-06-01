import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  resolveOrganizationTaxSettings,
  type OrganizationPriceDisplay,
} from "../lib/organizationTax";
import { ensureProjectAccess, ensureTeamAccess } from "./authz";

const ESTIMATION_NUMBER_REGEX = /^EST-(\d{4})-(\d{3,})$/;

// ====== COST ESTIMATION QUERIES ======

export const listCostEstimations = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);

    return await ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const getCostEstimation = query({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) return null;

    await ensureProjectAccess(ctx, estimation.projectId);

    return estimation;
  },
});

export const getCostEstimationWithItems = query({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) return null;

    await ensureProjectAccess(ctx, estimation.projectId);

    const laborItems =
      estimation.laborSnapshots ??
      (
        await Promise.all(estimation.laborItemIds.map((id) => ctx.db.get(id)))
      ).filter(Boolean);

    const materialItems =
      estimation.materialSnapshots ??
      (
        await Promise.all(estimation.materialItemIds.map((id) => ctx.db.get(id)))
      ).filter(Boolean);

    const contact = estimation.contactId
      ? await ctx.db.get(estimation.contactId)
      : null;

    return {
      ...estimation,
      laborItems,
      materialItems,
      contact,
    };
  },
});

// ====== COST ESTIMATION MUTATIONS ======

export const createCostEstimation = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    estimationNumber: v.optional(v.string()),
    location: v.optional(v.string()),
    plannedStartDate: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    vatPercent: v.number(),
    discountPercent: v.optional(v.number()),
    materialItemIds: v.array(v.id("shoppingListItems")),
    laborItemIds: v.array(v.id("laborItems")),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { project, clerkUserId } = await ensureProjectAccess(ctx, args.projectId);

    const title = normalizeRequiredString(args.title, "Title");
    const location = normalizeOptionalString(args.location);
    const notes = normalizeOptionalString(args.notes);
    const plannedStartDate = normalizeTimestamp(args.plannedStartDate, "Planned start date");
    const validUntil = normalizeTimestamp(args.validUntil, "Valid until date");
    assertValidDateRange(plannedStartDate, validUntil);

    const taxSnapshot = await resolveActiveEstimationTaxSnapshot(ctx, {
      project,
      legacyVatPercent: args.vatPercent,
    });
    const vatPercent = taxSnapshot?.taxEnabled ? taxSnapshot.taxRate : 0;
    const discountPercent = 0;

    const laborItemIds = deduplicateIds(args.laborItemIds);
    const materialItemIds = deduplicateIds(args.materialItemIds);
    assertHasAnyItems(laborItemIds, materialItemIds);

    const linkedContact = await resolveProjectContact(ctx, {
      projectId: args.projectId,
      teamId: project.teamId,
      contactId: args.contactId,
    });

    const customerName =
      normalizeOptionalString(args.customerName) ??
      normalizeOptionalString(linkedContact?.name);
    const customerEmail =
      normalizeEmail(args.customerEmail) ?? normalizeEmail(linkedContact?.email);
    const customerPhone =
      normalizeOptionalString(args.customerPhone) ??
      normalizeOptionalString(linkedContact?.phone);
    const customerAddress =
      normalizeOptionalString(args.customerAddress) ??
      buildContactAddress(linkedContact);

    if (!customerName) {
      throw new Error("Customer name is required. Select contact or fill customer name.");
    }

    const requestedNumber = normalizeEstimationNumber(args.estimationNumber);
    const estimationNumber =
      requestedNumber ?? (await generateNextEstimationNumber(ctx, args.projectId));

    await assertEstimationNumberAvailable(ctx, {
      projectId: args.projectId,
      estimationNumber,
    });

    const resolvedItems = await resolveEstimationSourceItems(ctx, {
      projectId: args.projectId,
      laborItemIds,
      materialItemIds,
    });
    const { laborTotal, materialsTotal, netTotal, discountAmount, vatAmount, grossTotal } =
      calculateEstimationTotalsFromItems(resolvedItems, vatPercent);
    const { laborSnapshots, materialSnapshots } =
      buildEstimationItemSnapshots(resolvedItems);

    const estimationId = await ctx.db.insert("costEstimations", {
      title,
      estimationNumber,
      location,
      estimationDate: Date.now(),
      plannedStartDate,
      validUntil,
      vatPercent,
      discountPercent,
      taxSnapshot,
      status: "draft",
      materialItemIds,
      materialSnapshots,
      laborItemIds,
      laborSnapshots,
      laborTotal,
      materialsTotal,
      netTotal,
      discountAmount,
      vatAmount,
      grossTotal,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      contactId: linkedContact?._id,
      notes,
      projectId: args.projectId,
      teamId: project.teamId,
      createdBy: clerkUserId,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activityLog", {
      teamId: project.teamId,
      projectId: args.projectId,
      userId: clerkUserId,
      actionType: "estimation.create",
      entityId: estimationId,
      entityType: "estimation",
      details: {
        title,
        grossTotal,
      },
    });

    return estimationId;
  },
});

export const updateCostEstimation = mutation({
  args: {
    estimationId: v.id("costEstimations"),
    title: v.optional(v.string()),
    estimationNumber: v.optional(v.string()),
    location: v.optional(v.string()),
    plannedStartDate: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    vatPercent: v.optional(v.number()),
    discountPercent: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("expired")
      )
    ),
    materialItemIds: v.optional(v.array(v.id("shoppingListItems"))),
    laborItemIds: v.optional(v.array(v.id("laborItems"))),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { estimationId } = args;
    const estimation = await ctx.db.get(estimationId);
    if (!estimation) throw new Error("Estimation not found");
    const { project, clerkUserId } = await ensureProjectAccess(ctx, estimation.projectId);

    const laborItemIds = args.laborItemIds
      ? deduplicateIds(args.laborItemIds)
      : estimation.laborItemIds;
    const materialItemIds = args.materialItemIds
      ? deduplicateIds(args.materialItemIds)
      : estimation.materialItemIds;
    assertHasAnyItems(laborItemIds, materialItemIds);

    const taxSnapshot = await resolveActiveEstimationTaxSnapshot(ctx, {
      project,
      legacyVatPercent:
        args.vatPercent !== undefined ? args.vatPercent : estimation.vatPercent,
    });
    const vatPercent = taxSnapshot?.taxEnabled ? taxSnapshot.taxRate : 0;
    const discountPercent = 0;

    const plannedStartDate =
      args.plannedStartDate !== undefined
        ? normalizeTimestamp(args.plannedStartDate, "Planned start date")
        : estimation.plannedStartDate;

    const validUntil =
      args.validUntil !== undefined
        ? normalizeTimestamp(args.validUntil, "Valid until date")
        : estimation.validUntil;

    assertValidDateRange(plannedStartDate, validUntil);

    const contactId =
      args.contactId !== undefined ? args.contactId : estimation.contactId;

    const linkedContact = await resolveProjectContact(ctx, {
      projectId: estimation.projectId,
      teamId: estimation.teamId,
      contactId,
    });

    const customerName = hasOwn(args, "customerName")
      ? normalizeOptionalString(args.customerName)
      : normalizeOptionalString(estimation.customerName);
    const customerEmail = hasOwn(args, "customerEmail")
      ? normalizeEmail(args.customerEmail)
      : normalizeEmail(estimation.customerEmail);
    const customerPhone = hasOwn(args, "customerPhone")
      ? normalizeOptionalString(args.customerPhone)
      : normalizeOptionalString(estimation.customerPhone);
    const customerAddress = hasOwn(args, "customerAddress")
      ? normalizeOptionalString(args.customerAddress)
      : normalizeOptionalString(estimation.customerAddress);

    const finalCustomerName = customerName ?? normalizeOptionalString(linkedContact?.name);
    const finalCustomerEmail = customerEmail ?? normalizeEmail(linkedContact?.email);
    const finalCustomerPhone = customerPhone ?? normalizeOptionalString(linkedContact?.phone);
    const finalCustomerAddress = customerAddress ?? buildContactAddress(linkedContact);

    if (!finalCustomerName) {
      throw new Error("Customer name is required. Select contact or fill customer name.");
    }

    const patch: Record<string, unknown> = {
      laborItemIds,
      materialItemIds,
      vatPercent,
      discountPercent,
      plannedStartDate,
      validUntil,
      customerName: finalCustomerName,
      customerEmail: finalCustomerEmail,
      customerPhone: finalCustomerPhone,
      customerAddress: finalCustomerAddress,
      contactId: linkedContact?._id,
      taxSnapshot,
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      patch.title = normalizeRequiredString(args.title, "Title");
    }

    if (args.location !== undefined) {
      patch.location = normalizeOptionalString(args.location);
    }

    if (args.notes !== undefined) {
      patch.notes = normalizeOptionalString(args.notes);
    }

    if (args.status !== undefined) {
      patch.status = args.status;
    }

    if (args.estimationNumber !== undefined) {
      const normalizedNumber = normalizeEstimationNumber(args.estimationNumber);
      if (!normalizedNumber) {
        throw new Error("Estimation number cannot be empty");
      }

      await assertEstimationNumberAvailable(ctx, {
        projectId: estimation.projectId,
        estimationNumber: normalizedNumber,
        excludeEstimationId: estimationId,
      });

      patch.estimationNumber = normalizedNumber;
    }

    const resolvedItems = await resolveEstimationSourceItems(ctx, {
      projectId: estimation.projectId,
      laborItemIds,
      materialItemIds,
    });
    const { laborTotal, materialsTotal, netTotal, discountAmount, vatAmount, grossTotal } =
      calculateEstimationTotalsFromItems(resolvedItems, vatPercent);
    const { laborSnapshots, materialSnapshots } =
      buildEstimationItemSnapshots(resolvedItems);

    patch.laborTotal = laborTotal;
    patch.materialsTotal = materialsTotal;
    patch.netTotal = netTotal;
    patch.discountAmount = discountAmount;
    patch.vatAmount = vatAmount;
    patch.grossTotal = grossTotal;
    patch.laborSnapshots = laborSnapshots;
    patch.materialSnapshots = materialSnapshots;

    await ctx.db.patch(estimationId, patch);

    await ctx.db.insert("activityLog", {
      teamId: estimation.teamId,
      projectId: estimation.projectId,
      userId: clerkUserId,
      actionType: "estimation.update",
      entityId: estimationId,
      entityType: "estimation",
      details: {
        title: patch.title ?? estimation.title,
        updates: Object.keys(patch),
      },
    });

    return estimationId;
  },
});

export const deleteCostEstimation = mutation({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) throw new Error("Estimation not found");
    const { clerkUserId } = await ensureProjectAccess(ctx, estimation.projectId);

    await ctx.db.insert("activityLog", {
      teamId: estimation.teamId,
      projectId: estimation.projectId,
      userId: clerkUserId,
      actionType: "estimation.delete",
      entityId: args.estimationId,
      entityType: "estimation",
      details: {
        title: estimation.title,
      },
    });

    await ctx.db.delete(args.estimationId);

    return args.estimationId;
  },
});

export const updateEstimationStatus = mutation({
  args: {
    estimationId: v.id("costEstimations"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) throw new Error("Estimation not found");
    const { clerkUserId } = await ensureProjectAccess(ctx, estimation.projectId);

    await ctx.db.patch(args.estimationId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activityLog", {
      teamId: estimation.teamId,
      projectId: estimation.projectId,
      userId: clerkUserId,
      actionType: "estimation.status_change",
      entityId: args.estimationId,
      entityType: "estimation",
      details: {
        title: estimation.title,
        fromStatus: estimation.status,
        toStatus: args.status,
      },
    });

    return args.estimationId;
  },
});

// ====== RECALCULATE ESTIMATION ======

export const recalculateEstimation = mutation({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) throw new Error("Estimation not found");
    await ensureProjectAccess(ctx, estimation.projectId);

    const resolvedItems = await resolveEstimationSourceItems(ctx, {
      projectId: estimation.projectId,
      laborItemIds: estimation.laborItemIds,
      materialItemIds: estimation.materialItemIds,
    });
    const { laborTotal, materialsTotal, netTotal, discountAmount, vatAmount, grossTotal } =
      calculateEstimationTotalsFromItems(
        resolvedItems,
        resolveStoredEstimationVatPercent(estimation),
      );
    const { laborSnapshots, materialSnapshots } =
      buildEstimationItemSnapshots(resolvedItems);

    const taxSnapshot =
      estimation.taxSnapshot ??
      (await resolveLegacyEstimationTaxSnapshot(ctx, {
        teamId: estimation.teamId,
        legacyVatPercent: estimation.vatPercent,
      }));

    await ctx.db.patch(args.estimationId, {
      laborTotal,
      materialsTotal,
      netTotal,
      discountAmount,
      vatAmount,
      grossTotal,
      discountPercent: 0,
      taxSnapshot,
      laborSnapshots,
      materialSnapshots,
      updatedAt: Date.now(),
    });

    return {
      laborTotal,
      materialsTotal,
      netTotal,
      discountAmount,
      vatAmount,
      grossTotal,
    };
  },
});

// ====== QUERY HELPERS ======

export const getEstimationsByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await ensureTeamAccess(ctx, args.teamId);

    return await ctx.db
      .query("costEstimations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
  },
});

export const getEstimationsByStatus = query({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);

    const estimations = await ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return estimations.filter((e) => e.status === args.status);
  },
});

export const getEstimationStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);

    const estimations = await ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const stats = {
      total: estimations.length,
      draft: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      totalValue: 0,
      acceptedValue: 0,
    };

    for (const est of estimations) {
      stats[est.status]++;
      stats.totalValue += est.grossTotal || 0;
      if (est.status === "accepted") {
        stats.acceptedValue += est.grossTotal || 0;
      }
    }

    return stats;
  },
});

export const getNextEstimationNumber = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId);

    return await generateNextEstimationNumber(ctx, args.projectId);
  },
});

// ====== HELPER FUNCTIONS ======

interface CalculateTotalsArgs {
  projectId: Id<"projects">;
  laborItemIds: Id<"laborItems">[];
  materialItemIds: Id<"shoppingListItems">[];
}

interface CalculateTotalsResult {
  laborTotal: number;
  materialsTotal: number;
  netTotal: number;
  discountAmount: number;
  vatAmount: number;
  grossTotal: number;
}

interface ResolveProjectContactArgs {
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  contactId?: Id<"contacts">;
}

type ContactSnapshot = {
  _id: Id<"contacts">;
  teamId: Id<"teams">;
  isActive: boolean;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
} | null;

type EstimationTaxSnapshot = {
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  priceDisplay?: OrganizationPriceDisplay;
  source: "organization" | "project" | "legacy_estimation";
};

type ResolvedLaborItem = {
  _id: Id<"laborItems">;
  name: string;
  notes?: string | null;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  projectId: Id<"projects">;
};

type ResolvedMaterialItem = {
  _id: Id<"shoppingListItems">;
  name: string;
  notes?: string | null;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  projectId: Id<"projects">;
};

type ResolvedEstimationItems = {
  laborItems: ResolvedLaborItem[];
  materialItems: ResolvedMaterialItem[];
};

type EstimationLaborSnapshot = {
  sourceItemId?: string;
  name: string;
  notes?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
};

type EstimationMaterialSnapshot = {
  sourceItemId?: string;
  name: string;
  notes?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
};

function hasOwn<T extends object>(obj: T, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeRequiredString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

function normalizeOptionalString(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeEmail(value?: string): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    throw new Error("Customer email is invalid");
  }

  return normalized.toLowerCase();
}

function normalizeTimestamp(value: number | undefined, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} is invalid`);
  }

  return Math.trunc(value);
}

function assertValidDateRange(
  plannedStartDate: number | undefined,
  validUntil: number | undefined
) {
  if (plannedStartDate && validUntil && validUntil < plannedStartDate) {
    throw new Error("Valid until date cannot be earlier than planned start date");
  }
}

function normalizePercent(value: number, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (value < 0 || value > 100) {
    throw new Error(`${fieldName} must be between 0 and 100`);
  }

  return roundCurrency(value);
}

function normalizeEstimationNumber(value?: string): string | undefined {
  const normalized = normalizeOptionalString(value)?.toUpperCase();
  if (!normalized) return undefined;

  if (!ESTIMATION_NUMBER_REGEX.test(normalized)) {
    throw new Error("Estimation number must follow format EST-YYYY-XXX");
  }

  return normalized;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function deduplicateIds<T extends Id<"laborItems"> | Id<"shoppingListItems">>(
  ids: T[]
): T[] {
  return Array.from(new Set(ids));
}

function assertHasAnyItems(
  laborItemIds: Id<"laborItems">[],
  materialItemIds: Id<"shoppingListItems">[]
) {
  if (laborItemIds.length === 0 && materialItemIds.length === 0) {
    throw new Error("Select at least one labor or shopping list item");
  }
}

function buildContactAddress(contact: ContactSnapshot): string | undefined {
  if (!contact) return undefined;

  const addressParts: string[] = [];
  const line1 = normalizeOptionalString(contact.address);
  if (line1) {
    addressParts.push(line1);
  }

  const line2 = [
    normalizeOptionalString(contact.postalCode),
    normalizeOptionalString(contact.city),
  ]
    .filter(Boolean)
    .join(" ");

  if (line2) {
    addressParts.push(line2);
  }

  const country = normalizeOptionalString(contact.country);
  if (country) {
    addressParts.push(country);
  }

  return addressParts.length > 0 ? addressParts.join(", ") : undefined;
}

function extractSequenceForYear(
  estimationNumber: string | undefined,
  year: number
): number {
  if (!estimationNumber) return 0;

  const match = estimationNumber.toUpperCase().match(ESTIMATION_NUMBER_REGEX);
  if (!match) return 0;

  const numberYear = Number(match[1]);
  const sequence = Number(match[2]);
  if (!Number.isFinite(numberYear) || !Number.isFinite(sequence)) {
    return 0;
  }

  return numberYear === year ? sequence : 0;
}

async function resolveProjectContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  args: ResolveProjectContactArgs
): Promise<ContactSnapshot> {
  const contactId = args.contactId;
  if (!contactId) return null;

  const assignment = await ctx.db
    .query("projectContacts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_project_and_contact", (q: any) =>
      q.eq("projectId", args.projectId).eq("contactId", contactId)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!assignment) {
    throw new Error("Selected contact is not assigned to this project");
  }

  const contact = await ctx.db.get(contactId);
  if (!contact || !contact.isActive) {
    throw new Error("Selected contact does not exist or is inactive");
  }

  if (contact.teamId !== args.teamId) {
    throw new Error("Selected contact is not in this team");
  }

  return contact;
}

async function assertEstimationNumberAvailable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  args: {
    projectId: Id<"projects">;
    estimationNumber: string;
    excludeEstimationId?: Id<"costEstimations">;
  }
) {
  const estimations = await ctx.db
    .query("costEstimations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
    .collect();

  const normalizedTarget = args.estimationNumber.toUpperCase();

  const duplicate = estimations.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (estimation: any) =>
      estimation._id !== args.excludeEstimationId &&
      estimation.estimationNumber?.toUpperCase() === normalizedTarget
  );

  if (duplicate) {
    throw new Error(`Estimation number ${args.estimationNumber} already exists`);
  }
}

async function generateNextEstimationNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  projectId: Id<"projects">
): Promise<string> {
  const estimations = await ctx.db
    .query("costEstimations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  const year = new Date().getFullYear();
  let maxSequence = 0;

  for (const estimation of estimations) {
    maxSequence = Math.max(
      maxSequence,
      extractSequenceForYear(estimation.estimationNumber, year)
    );
  }

  return `EST-${year}-${String(maxSequence + 1).padStart(3, "0")}`;
}

async function resolveEstimationSourceItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  args: CalculateTotalsArgs,
): Promise<ResolvedEstimationItems> {
  const laborItems = await Promise.all(
    args.laborItemIds.map((id) => ctx.db.get(id))
  );
  const materialItems = await Promise.all(
    args.materialItemIds.map((id) => ctx.db.get(id))
  );

  const resolvedLaborItems: ResolvedLaborItem[] = [];
  for (let i = 0; i < args.laborItemIds.length; i++) {
    const item = laborItems[i];
    if (!item) {
      throw new Error("Some labor items no longer exist");
    }
    if (item.projectId !== args.projectId) {
      throw new Error("Labor item does not belong to this project");
    }
    resolvedLaborItems.push(item as ResolvedLaborItem);
  }

  const resolvedMaterialItems: ResolvedMaterialItem[] = [];
  for (let i = 0; i < args.materialItemIds.length; i++) {
    const item = materialItems[i];
    if (!item) {
      throw new Error("Some shopping list items no longer exist");
    }
    if (item.projectId !== args.projectId) {
      throw new Error("Shopping list item does not belong to this project");
    }
    resolvedMaterialItems.push(item as ResolvedMaterialItem);
  }

  return {
    laborItems: resolvedLaborItems,
    materialItems: resolvedMaterialItems,
  };
}

function calculateEstimationTotalsFromItems(
  items: ResolvedEstimationItems,
  vatPercent: number,
): CalculateTotalsResult {
  const laborTotal = items.laborItems.reduce(
    (sum, item) => sum + (item.totalPrice || 0),
    0,
  );
  const materialsTotal = items.materialItems.reduce(
    (sum, item) => sum + (item.totalPrice || 0),
    0,
  );

  const netTotal = laborTotal + materialsTotal;
  const discountAmount = 0;
  const vatAmount = netTotal * (vatPercent / 100);
  const grossTotal = netTotal + vatAmount;

  return {
    laborTotal: roundCurrency(laborTotal),
    materialsTotal: roundCurrency(materialsTotal),
    netTotal: roundCurrency(netTotal),
    discountAmount: roundCurrency(discountAmount),
    vatAmount: roundCurrency(vatAmount),
    grossTotal: roundCurrency(grossTotal),
  };
}

function buildEstimationItemSnapshots(
  items: ResolvedEstimationItems,
): {
  laborSnapshots: EstimationLaborSnapshot[];
  materialSnapshots: EstimationMaterialSnapshot[];
} {
  return {
    laborSnapshots: items.laborItems.map((item) => ({
      sourceItemId: String(item._id),
      name: item.name,
      notes: normalizeOptionalString(item.notes ?? undefined),
      quantity: item.quantity,
      unit: normalizeOptionalString(item.unit),
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    materialSnapshots: items.materialItems.map((item) => ({
      sourceItemId: String(item._id),
      name: item.name,
      notes: normalizeOptionalString(item.notes ?? undefined),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
  };
}

async function resolveActiveEstimationTaxSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  args: {
    project: {
      teamId: Id<"teams">;
    };
    legacyVatPercent?: number;
  },
): Promise<EstimationTaxSnapshot | undefined> {
  const organizationTaxSettings = await resolveEstimationPresentationSettings(
    ctx,
    args.project.teamId,
  );

  if (organizationTaxSettings.taxEnabled) {
    return {
      taxEnabled: true,
      taxRate: normalizePercent(organizationTaxSettings.taxRate, "Organization tax"),
      taxLabel: organizationTaxSettings.taxLabel,
      priceDisplay: organizationTaxSettings.priceDisplay,
      source: "organization",
    };
  }

  if (args.legacyVatPercent !== undefined) {
    const legacyTaxRate = normalizePercent(args.legacyVatPercent, "VAT");
    if (legacyTaxRate > 0) {
      return {
        taxEnabled: true,
        taxRate: legacyTaxRate,
        taxLabel: organizationTaxSettings.taxLabel,
        priceDisplay: organizationTaxSettings.priceDisplay,
        source: "legacy_estimation",
      };
    }
  }

  return undefined;
}

async function resolveLegacyEstimationTaxSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  args: {
    teamId: Id<"teams">;
    legacyVatPercent?: number;
  },
): Promise<EstimationTaxSnapshot | undefined> {
  if (args.legacyVatPercent === undefined) {
    return undefined;
  }

  const legacyTaxRate = normalizePercent(args.legacyVatPercent, "VAT");
  if (legacyTaxRate <= 0) {
    return undefined;
  }

  const presentation = await resolveEstimationPresentationSettings(
    ctx,
    args.teamId,
  );

  return {
    taxEnabled: true,
    taxRate: legacyTaxRate,
    taxLabel: presentation.taxLabel,
    priceDisplay: presentation.priceDisplay,
    source: "legacy_estimation",
  };
}

function resolveStoredEstimationVatPercent(
  estimation: {
    vatPercent: number;
    taxSnapshot?: EstimationTaxSnapshot;
  },
): number {
  if (estimation.taxSnapshot?.taxEnabled) {
    return normalizePercent(estimation.taxSnapshot.taxRate, "Tax");
  }

  return normalizePercent(estimation.vatPercent, "VAT");
}

async function resolveEstimationPresentationSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  teamId: Id<"teams">,
): Promise<ReturnType<typeof resolveOrganizationTaxSettings>> {
  const team = await ctx.db.get(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  return resolveOrganizationTaxSettings(
    (team as { organizationTaxSettings?: unknown }).organizationTaxSettings as
      | Parameters<typeof resolveOrganizationTaxSettings>[0]
      | undefined,
  );
}
