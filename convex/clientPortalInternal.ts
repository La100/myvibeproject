import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const generateClientPanelAccessToken = () =>
  crypto.randomUUID().replace(/-/g, "");

export const ensureClientPanelAccessTokenInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.clientPanelAccessToken) {
      return { token: project.clientPanelAccessToken };
    }

    const token = generateClientPanelAccessToken();
    await ctx.db.patch(args.projectId, {
      clientPanelAccessToken: token,
    });

    return { token };
  },
});
