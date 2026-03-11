import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  buildApprovalDecisionArtifacts,
  buildApprovalSummary,
  buildApprovalUpdateArtifacts,
  buildApprovalVersionRecord,
  buildApprovalViewedPatch,
  buildCreateApprovalRecord,
  filterVisibleApprovals,
} from "../lib/projectApprovals";
const internalAny = require("./_generated/api").internal as any;

const approvalTypeValidator = v.union(
  v.literal("material"),
  v.literal("estimate"),
  v.literal("visualization"),
  v.literal("moodboard"),
  v.literal("scope"),
  v.literal("milestone"),
  v.literal("payment"),
  v.literal("other"),
);

const approvalStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("viewed"),
  v.literal("commented"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired"),
);

const approvalDecisionValidator = v.union(v.literal("approved"), v.literal("rejected"));

const getProjectMembership = async (ctx: any, projectId: Id<"projects">, clerkUserId: string) => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", clerkUserId),
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
    throw new Error("Insufficient permissions to manage approvals");
  }

  if (membership.role === "member" && membership.projectIds?.length > 0) {
    if (!membership.projectIds.includes(projectId)) {
      throw new Error("Insufficient permissions to manage approvals");
    }
  }

  return { project, membership };
};

const mapApprovalWithVersion = (approval: Doc<"projectApprovals">, version: Doc<"projectApprovalVersions"> | null) => ({
  ...approval,
  currentVersionRecord: version,
});

const getCurrentVersion = async (ctx: any, approval: Doc<"projectApprovals">) => {
  return (
    (await ctx.db
      .query("projectApprovalVersions")
      .withIndex("by_approval_and_version", (q: any) =>
        q.eq("approvalId", approval._id).eq("version", approval.currentVersion),
      )
      .unique()) || null
  );
};

const createVersion = async (
  ctx: any,
  args: {
    approvalId: Id<"projectApprovals">;
    projectId: Id<"projects">;
    teamId: Id<"teams">;
    version: number;
    title: string;
    summary?: string;
    details?: string;
    items?: string[];
    referenceIds?: string[];
    dueDate?: number;
    createdBy: string;
  },
) =>
  await ctx.db.insert(
    "projectApprovalVersions",
    buildApprovalVersionRecord(
      {
        approvalId: String(args.approvalId),
        projectId: String(args.projectId),
        teamId: String(args.teamId),
        version: args.version,
        title: args.title,
        summary: args.summary,
        details: args.details,
        items: args.items,
        referenceIds: args.referenceIds,
        dueDate: args.dueDate,
        createdBy: args.createdBy,
      },
      Date.now(),
    ) as any,
  );

export const listProjectApprovals = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { items: [], summary: null };
    }

    await getProjectMembership(ctx, args.projectId, identity.subject);

    const approvals = await ctx.db
      .query("projectApprovals")
      .withIndex("by_project_and_updated", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    const items = await Promise.all(
      approvals.map(async (approval) => {
        const version = await getCurrentVersion(ctx, approval);
        return mapApprovalWithVersion(approval, version);
      }),
    );

    return {
      items,
      summary: buildApprovalSummary(items),
    };
  },
});

export const createProjectApproval = mutation({
  args: {
    projectId: v.id("projects"),
    type: approvalTypeValidator,
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    summary: v.optional(v.union(v.string(), v.null())),
    details: v.optional(v.union(v.string(), v.null())),
    items: v.optional(v.array(v.string())),
    referenceIds: v.optional(v.array(v.string())),
    dueDate: v.optional(v.union(v.number(), v.null())),
    sendNow: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { project } = await getProjectMembership(ctx, args.projectId, identity.subject);
    const now = Date.now();
    const approvalRecord = buildCreateApprovalRecord(
      {
        projectId: String(args.projectId),
        teamId: String(project.teamId),
        type: args.type,
        title: args.title,
        description: args.description,
        summary: args.summary,
        details: args.details,
        items: args.items,
        referenceIds: args.referenceIds,
        dueDate: args.dueDate,
        sendNow: args.sendNow,
        requesterUserId: identity.subject,
      },
      now,
    );
    const approvalId = await ctx.db.insert("projectApprovals", approvalRecord as any);

    await createVersion(ctx, {
      approvalId,
      projectId: args.projectId,
      teamId: project.teamId,
      version: 1,
      title: approvalRecord.title,
      summary: approvalRecord.latestVersionSummary,
      details: approvalRecord.latestVersionDetails,
      items: approvalRecord.latestVersionItems,
      referenceIds: approvalRecord.latestVersionReferenceIds,
      dueDate: approvalRecord.dueDate,
      createdBy: identity.subject,
    });

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: args.projectId,
      actionType: "approval.create",
      details: { title: approvalRecord.title, type: args.type, sent: Boolean(args.sendNow) },
      entityId: String(approvalId),
      entityType: "approval",
    });

    return approvalId;
  },
});

export const updateProjectApproval = mutation({
  args: {
    approvalId: v.id("projectApprovals"),
    type: v.optional(approvalTypeValidator),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    summary: v.optional(v.union(v.string(), v.null())),
    details: v.optional(v.union(v.string(), v.null())),
    items: v.optional(v.array(v.string())),
    referenceIds: v.optional(v.array(v.string())),
    dueDate: v.optional(v.union(v.number(), v.null())),
    sendNow: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const approval = await ctx.db.get(args.approvalId);
    if (!approval) {
      throw new Error("Approval not found");
    }

    const { project } = await getProjectMembership(ctx, approval.projectId, identity.subject);
    const version = await getCurrentVersion(ctx, approval);
    const now = Date.now();
    const artifacts = buildApprovalUpdateArtifacts(
      {
        ...approval,
        _id: String(approval._id),
      },
      args,
      now,
    );

    await createVersion(ctx, {
      approvalId: args.approvalId,
      projectId: approval.projectId,
      teamId: approval.teamId,
      version: artifacts.versionRecord.version,
      title: artifacts.versionRecord.title,
      summary: artifacts.versionRecord.summary,
      details: artifacts.versionRecord.details,
      items: artifacts.versionRecord.items,
      referenceIds: artifacts.versionRecord.referenceIds,
      dueDate: artifacts.versionRecord.dueDate,
      createdBy: identity.subject,
    });

    await ctx.db.patch(args.approvalId, artifacts.patch);

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: approval.projectId,
      actionType: "approval.update",
      details: {
        title: artifacts.patch.title,
        previousVersion: version?.version || approval.currentVersion,
        currentVersion: artifacts.versionRecord.version,
        sent: Boolean(args.sendNow),
      },
      entityId: String(args.approvalId),
      entityType: "approval",
    });

    return args.approvalId;
  },
});

export const setProjectApprovalStatus = mutation({
  args: {
    approvalId: v.id("projectApprovals"),
    status: approvalStatusValidator,
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const approval = await ctx.db.get(args.approvalId);
    if (!approval) {
      throw new Error("Approval not found");
    }

    const { project } = await getProjectMembership(ctx, approval.projectId, identity.subject);
    await ctx.db.patch(args.approvalId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internalAny.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: approval.projectId,
      actionType: "approval.status",
      details: { title: approval.title, status: args.status },
      entityId: String(args.approvalId),
      entityType: "approval",
    });

    return args.approvalId;
  },
});

export const getPublicProjectApprovalsByAccessToken = query({
  args: {
    accessToken: v.string(),
  },
  async handler(ctx, args) {
    const token = args.accessToken.trim();
    if (!token) {
      return null;
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) => q.eq("clientPanelAccessToken", token))
      .unique();

    if (!project || project.clientPanelPublishedSettings?.showApprovals !== true) {
      return null;
    }

    const approvals = await ctx.db
      .query("projectApprovals")
      .withIndex("by_project_and_updated", (q) => q.eq("projectId", project._id))
      .order("desc")
      .collect();

    const visibleApprovals = filterVisibleApprovals(approvals);

    return {
      approvals: await Promise.all(
        visibleApprovals.map(async (approval) => {
          const version = await getCurrentVersion(ctx, approval);
          return mapApprovalWithVersion(approval, version);
        }),
      ),
    };
  },
});

export const markProjectApprovalViewedByAccessToken = mutation({
  args: {
    accessToken: v.string(),
    approvalId: v.id("projectApprovals"),
    respondentName: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const token = args.accessToken.trim();
    if (!token) {
      throw new Error("Invalid portal link");
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) => q.eq("clientPanelAccessToken", token))
      .unique();

    if (!project || project.clientPanelPublishedSettings?.showApprovals !== true) {
      throw new Error("Approvals are hidden in this portal");
    }

    const approval = await ctx.db.get(args.approvalId);
    if (!approval || approval.projectId !== project._id) {
      throw new Error("Approval not found");
    }

    const patch = buildApprovalViewedPatch(
      {
        ...approval,
        _id: String(approval._id),
      },
      args.respondentName,
      Date.now(),
    );

    if (patch) {
      await ctx.db.patch(args.approvalId, patch);
    }

    return { success: true };
  },
});

export const respondToProjectApprovalByAccessToken = mutation({
  args: {
    accessToken: v.string(),
    approvalId: v.id("projectApprovals"),
    decision: approvalDecisionValidator,
    comment: v.optional(v.union(v.string(), v.null())),
    respondentName: v.optional(v.string()),
    respondentKey: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const token = args.accessToken.trim();
    if (!token) {
      throw new Error("Invalid portal link");
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_client_panel_access_token", (q) => q.eq("clientPanelAccessToken", token))
      .unique();

    if (!project || project.clientPanelPublishedSettings?.showApprovals !== true) {
      throw new Error("Approvals are hidden in this portal");
    }

    const approval = await ctx.db.get(args.approvalId);
    if (!approval || approval.projectId !== project._id) {
      throw new Error("Approval not found");
    }

    const now = Date.now();
    const artifacts = buildApprovalDecisionArtifacts(
      {
        ...approval,
        _id: String(approval._id),
      },
      {
        decision: args.decision,
        comment: args.comment,
        respondentName: args.respondentName,
        respondentKey: args.respondentKey,
      },
      now,
    );

    await ctx.db.patch(args.approvalId, artifacts.patch);

    await ctx.db.insert("activityLog", {
      teamId: project.teamId,
      projectId: project._id,
      userId: artifacts.activity.userId,
      actionType: artifacts.activity.actionType,
      details: artifacts.activity.details,
      entityId: String(args.approvalId),
      entityType: "approval",
    });

    return artifacts.response;
  },
});
