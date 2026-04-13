import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type TourId = "workspace" | "project";
type GuidedTourState = {
  completedTourIds: TourId[];
  skippedTourIds: TourId[];
  dismissedPromptIds: TourId[];
};

const tourIdValidator = v.union(v.literal("workspace"), v.literal("project"));
const guidedTourStateValidator = v.object({
  completedTourIds: v.array(tourIdValidator),
  skippedTourIds: v.array(tourIdValidator),
  dismissedPromptIds: v.array(tourIdValidator),
});

const guidedTourStatusValidator = v.union(
  v.literal("completed"),
  v.literal("skipped"),
  v.literal("dismissed"),
);

const validTourIds: TourId[] = ["workspace", "project"];

const defaultGuidedTourState: GuidedTourState = {
  completedTourIds: [],
  skippedTourIds: [],
  dismissedPromptIds: [],
};

async function getCurrentUserByClerkId(ctx: any, clerkUserId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

async function ensureCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Not authenticated");
  }

  const existingUser = await getCurrentUserByClerkId(ctx, identity.subject);
  if (existingUser) {
    return existingUser;
  }

  const userId = await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    email: identity.email ?? `${identity.subject}@placeholder.local`,
    name: identity.name ?? undefined,
    imageUrl: identity.pictureUrl ?? undefined,
  });

  const createdUser = await ctx.db.get(userId);
  if (!createdUser) {
    throw new Error("Failed to create user profile");
  }

  return createdUser;
}

function normalizeTourIds(value: unknown): TourId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((tourId): tourId is TourId => validTourIds.includes(tourId as TourId));
}

function normalizeGuidedTourState(state: {
  completedTourIds?: unknown;
  skippedTourIds?: unknown;
  dismissedPromptIds?: unknown;
} | null | undefined): GuidedTourState {
  return {
    completedTourIds: normalizeTourIds(state?.completedTourIds),
    skippedTourIds: normalizeTourIds(state?.skippedTourIds),
    dismissedPromptIds: normalizeTourIds(state?.dismissedPromptIds),
  };
}

export const getState = query({
  args: {},
  returns: guidedTourStateValidator,
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return defaultGuidedTourState;
    }

    const user = await getCurrentUserByClerkId(ctx, identity.subject);
    return normalizeGuidedTourState(user?.guidedTours);
  },
});

export const markStatus = mutation({
  args: {
    tourId: tourIdValidator,
    status: guidedTourStatusValidator,
  },
  returns: guidedTourStateValidator,
  async handler(ctx, args) {
    const user = await ensureCurrentUser(ctx);
    const currentState = normalizeGuidedTourState(user.guidedTours);

    const nextState = {
      completedTourIds: currentState.completedTourIds.filter((tourId) => tourId !== args.tourId),
      skippedTourIds: currentState.skippedTourIds.filter((tourId) => tourId !== args.tourId),
      dismissedPromptIds: currentState.dismissedPromptIds.filter((tourId) => tourId !== args.tourId),
    };

    if (args.status === "completed") {
      nextState.completedTourIds.push(args.tourId);
    } else if (args.status === "skipped") {
      nextState.skippedTourIds.push(args.tourId);
    } else {
      nextState.dismissedPromptIds.push(args.tourId);
    }

    await ctx.db.patch(user._id, {
      guidedTours: nextState,
    });

    return nextState;
  },
});

export const replaceState = mutation({
  args: {
    state: guidedTourStateValidator,
  },
  returns: guidedTourStateValidator,
  async handler(ctx, args) {
    const user = await ensureCurrentUser(ctx);
    const nextState = normalizeGuidedTourState(args.state);

    await ctx.db.patch(user._id, {
      guidedTours: nextState,
    });

    return nextState;
  },
});
