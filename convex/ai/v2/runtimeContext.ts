import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

const MAX_HISTORY_TURNS = 8;

export const getRuntimeContextInternal = internalQuery({
  args: {
    groupId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .unique();

    if (!group) {
      return null;
    }

    const project = await ctx.db.get(group.projectId);
    if (!project) {
      return null;
    }

    const team = await ctx.db.get(group.teamId);
    const savedProfile = await ctx.db
      .query("aiAssistantProfiles")
      .withIndex("by_team", (q) => q.eq("teamId", group.teamId))
      .unique();

    const previousGroups = await ctx.db
      .query("aiResponseGroups")
      .withIndex("by_thread", (q) => q.eq("threadId", group.threadId))
      .collect();

    const historyGroups = previousGroups
      .filter((entry) => entry.groupId !== args.groupId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_HISTORY_TURNS);

    const history: Array<{
      groupId: string;
      role: "user" | "assistant";
      text: string;
    }> = [];

    for (const historyGroup of historyGroups) {
      const events = await ctx.db
        .query("aiEvents")
        .withIndex("by_group_and_sequence", (q) => q.eq("groupId", historyGroup.groupId))
        .collect();

      for (const event of events) {
        if (
          event.eventType === "message.user" &&
          typeof event.text === "string" &&
          event.text.trim().length > 0
        ) {
          history.push({
            groupId: historyGroup.groupId,
            role: "user",
            text: event.text,
          });
        }

        if (
          event.eventType === "message.assistant.completed" &&
          typeof event.text === "string" &&
          event.text.trim().length > 0
        ) {
          history.push({
            groupId: historyGroup.groupId,
            role: "assistant",
            text: event.text,
          });
        }
      }
    }

    return {
      group: {
        groupId: group.groupId,
        threadId: group.threadId,
        projectId: String(group.projectId),
        teamId: String(group.teamId),
        userClerkId: group.userClerkId,
      },
      project: {
        _id: String(project._id),
        name: project.name,
        customAiPrompt: project.customAiPrompt,
      },
      team: team
        ? {
            _id: String(team._id),
            timezone: team.timezone,
          }
        : null,
      profile: {
        displayName: savedProfile?.displayName || "Vibe",
        defaultModel: savedProfile?.defaultModel || "gpt-5.4",
        systemPrompt: savedProfile?.systemPrompt,
        confirmationMode: savedProfile?.confirmationMode || "always_ask",
        memoryMode: savedProfile?.memoryMode || "hybrid",
        enabledTools: savedProfile?.enabledTools || ["app", "files"],
        featureFlags:
          savedProfile?.featureFlags || [
            "responses_api",
            "reasoning_summary",
            "group_confirmation",
          ],
      },
      history,
    };
  },
});
