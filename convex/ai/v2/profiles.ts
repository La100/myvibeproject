import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { ensureProjectAccess, requireIdentity } from "../access";

const DEFAULT_PROFILE = {
  displayName: "Vibe",
  defaultModel: "gpt-5.4",
  confirmationMode: "always_ask" as const,
  memoryMode: "hybrid" as const,
  enabledTools: ["app", "files"] as const,
  featureFlags: ["responses_api", "reasoning_summary", "group_confirmation"] as const,
};

export const getTeamAssistantProfile = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    teamId: v.id("teams"),
    displayName: v.string(),
    defaultModel: v.string(),
    systemPrompt: v.optional(v.string()),
    confirmationMode: v.union(
      v.literal("always_ask"),
      v.literal("auto_confirm"),
    ),
    memoryMode: v.union(
      v.literal("thread_only"),
      v.literal("project_summary"),
      v.literal("hybrid"),
    ),
    enabledTools: v.array(v.string()),
    featureFlags: v.array(v.string()),
    source: v.union(v.literal("default"), v.literal("saved")),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { project } = await ensureProjectAccess(ctx, args.projectId, identity.subject);

    const profile = await ctx.db
      .query("aiAssistantProfiles")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .unique();

    if (!profile) {
      return {
        teamId: project.teamId,
        ...DEFAULT_PROFILE,
        enabledTools: [...DEFAULT_PROFILE.enabledTools],
        featureFlags: [...DEFAULT_PROFILE.featureFlags],
        source: "default" as const,
      };
    }

    return {
      teamId: profile.teamId,
      displayName: profile.displayName || DEFAULT_PROFILE.displayName,
      defaultModel: profile.defaultModel,
      systemPrompt: profile.systemPrompt,
      confirmationMode: profile.confirmationMode,
      memoryMode: profile.memoryMode,
      enabledTools: [...profile.enabledTools],
      featureFlags: [...profile.featureFlags],
      source: "saved" as const,
    };
  },
});

export const upsertTeamAssistantProfile = mutation({
  args: {
    projectId: v.id("projects"),
    displayName: v.optional(v.string()),
    defaultModel: v.string(),
    systemPrompt: v.optional(v.string()),
    confirmationMode: v.union(
      v.literal("always_ask"),
      v.literal("auto_confirm"),
    ),
    memoryMode: v.union(
      v.literal("thread_only"),
      v.literal("project_summary"),
      v.literal("hybrid"),
    ),
    enabledTools: v.array(
      v.union(
        v.literal("app"),
        v.literal("web_search"),
        v.literal("shell"),
        v.literal("computer"),
        v.literal("mcp"),
        v.literal("files"),
      ),
    ),
    featureFlags: v.array(
      v.union(
        v.literal("responses_api"),
        v.literal("reasoning_summary"),
        v.literal("group_confirmation"),
        v.literal("shell"),
        v.literal("computer_use"),
        v.literal("event_replay"),
      ),
    ),
  },
  returns: v.object({
    teamId: v.id("teams"),
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { project, membership } = await ensureProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );

    if (membership.role !== "admin") {
      throw new Error("Forbidden");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("aiAssistantProfiles")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .unique();

    const patch = {
      displayName: args.displayName?.trim() || undefined,
      defaultModel: args.defaultModel,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      confirmationMode: args.confirmationMode,
      memoryMode: args.memoryMode,
      enabledTools: args.enabledTools,
      featureFlags: args.featureFlags,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { teamId: project.teamId, updated: true };
    }

    await ctx.db.insert("aiAssistantProfiles", {
      teamId: project.teamId,
      ...patch,
      createdAt: now,
    });

    return { teamId: project.teamId, updated: true };
  },
});

export const getProjectAssistantRuntime = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    runtime: v.union(v.literal("v1"), v.literal("v2")),
    teamId: v.id("teams"),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { project } = await ensureProjectAccess(ctx, args.projectId, identity.subject);
    return {
      runtime: project.aiAssistantRuntime || "v1",
      teamId: project.teamId,
    };
  },
});

export const setProjectAssistantRuntime = mutation({
  args: {
    projectId: v.id("projects"),
    runtime: v.union(v.literal("v1"), v.literal("v2")),
  },
  returns: v.object({
    projectId: v.id("projects"),
    runtime: v.union(v.literal("v1"), v.literal("v2")),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { project, membership } = await ensureProjectAccess(
      ctx,
      args.projectId,
      identity.subject,
    );

    if (membership.role !== "admin") {
      throw new Error("Forbidden");
    }

    await ctx.db.patch(project._id, {
      aiAssistantRuntime: args.runtime,
    });

    return {
      projectId: project._id,
      runtime: args.runtime,
    };
  },
});
