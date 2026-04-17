import { v } from "convex/values";
import type { UserIdentity } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export const EXTENSION_SESSION_PREFIX = "mvp_ext_";
export const EXTENSION_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type ExtensionSessionUserDoc = {
  _id: Id<"users">;
  clerkUserId: string;
  email: string;
  name?: string;
  imageUrl?: string;
  clipperConnectedAt?: number;
  extensionSessionTokenHash?: string;
  extensionSessionIssuedAt?: number;
  extensionSessionExpiresAt?: number;
  extensionSessionLastUsedAt?: number;
};

function generateExtensionSessionToken(): string {
  return `${EXTENSION_SESSION_PREFIX}${crypto.randomUUID().replace(/-/g, "")}${crypto
    .randomUUID()
    .replace(/-/g, "")}`;
}

export async function hashExtensionSessionToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function getCurrentUser(
  ctx: any,
  identity: UserIdentity,
): Promise<ExtensionSessionUserDoc | null> {
  return (await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
    .unique()) as ExtensionSessionUserDoc | null;
}

async function getOrCreateCurrentUser(
  ctx: any,
  identity: UserIdentity,
): Promise<ExtensionSessionUserDoc> {
  const existing = await getCurrentUser(ctx, identity);
  if (existing) {
    const userDb = ctx.db as unknown as {
      patch: (id: Id<"users">, value: Record<string, unknown>) => Promise<void>;
    };

    await userDb.patch(existing._id, {
      email: identity.email ?? existing.email,
      name: identity.name ?? existing.name,
      imageUrl: identity.pictureUrl ?? existing.imageUrl,
    });

    return {
      ...existing,
      email: identity.email ?? existing.email,
      name: identity.name ?? existing.name,
      imageUrl: identity.pictureUrl ?? existing.imageUrl,
    };
  }

  const userId = await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    email: identity.email ?? `${identity.subject}@placeholder.local`,
    name: identity.name ?? undefined,
    imageUrl: identity.pictureUrl ?? undefined,
  });

  const user = (await ctx.db.get(userId)) as ExtensionSessionUserDoc | null;
  if (!user) {
    throw new Error("Failed to create user profile");
  }

  return user;
}

export async function resolveActorFromExtensionSessionToken(
  ctx: any,
  extensionToken: string,
): Promise<ExtensionSessionUserDoc> {
  if (
    typeof extensionToken !== "string" ||
    !extensionToken.startsWith(EXTENSION_SESSION_PREFIX)
  ) {
    throw new Error("Invalid extension session");
  }

  const tokenHash = await hashExtensionSessionToken(extensionToken);
  const user = (await ctx.db
    .query("users")
    .withIndex("by_extension_session_token_hash", (q: any) =>
      q.eq("extensionSessionTokenHash", tokenHash),
    )
    .unique()) as ExtensionSessionUserDoc | null;
  if (!user) {
    throw new Error("Extension session expired");
  }

  const expiresAt = user.extensionSessionExpiresAt ?? 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Extension session expired");
  }

  return user;
}

export const createExtensionSession = mutation({
  args: {},
  returns: v.object({
    token: v.string(),
    expiresAt: v.number(),
  }),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getOrCreateCurrentUser(ctx, identity);
    const token = generateExtensionSessionToken();
    const tokenHash = await hashExtensionSessionToken(token);
    const now = Date.now();
    const expiresAt = now + EXTENSION_SESSION_TTL_MS;

    const userDb = ctx.db as unknown as {
      patch: (id: Id<"users">, value: Record<string, unknown>) => Promise<void>;
    };

    await userDb.patch(user._id, {
      extensionSessionTokenHash: tokenHash,
      extensionSessionIssuedAt: now,
      extensionSessionExpiresAt: expiresAt,
      extensionSessionLastUsedAt: now,
      clipperConnectedAt: now,
    });

    return {
      token,
      expiresAt,
    };
  },
});
