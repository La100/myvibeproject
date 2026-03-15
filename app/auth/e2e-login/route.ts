import { createClerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const ensureBypassEnabled = () => process.env.E2E_AUTH_BYPASS === "1";

const normalizeRedirectTarget = (request: NextRequest, redirectTo: string | null) => {
  if (!redirectTo) {
    return `${request.nextUrl.origin}/dashboard`;
  }

  try {
    const candidate = new URL(redirectTo, request.nextUrl.origin);
    if (candidate.origin !== request.nextUrl.origin) {
      return `${request.nextUrl.origin}/dashboard`;
    }
    return candidate.toString();
  } catch {
    return `${request.nextUrl.origin}/dashboard`;
  }
};

const resolveTargetUserId = async (preferredEmail?: string | null) => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  if (preferredEmail) {
    const preferredUsers = await clerk.users.getUserList({
      emailAddress: [preferredEmail],
      limit: 1,
    });
    if (preferredUsers.data[0]) {
      return preferredUsers.data[0].id;
    }
  }

  const users = await clerk.users.getUserList({ limit: 20 });
  for (const user of users.data) {
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: user.id,
      limit: 1,
    });
    if (memberships.data.length > 0) {
      return user.id;
    }
  }

  return users.data[0]?.id ?? null;
};

export async function GET(request: NextRequest) {
  if (!ensureBypassEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const redirectUrl = normalizeRedirectTarget(
    request,
    request.nextUrl.searchParams.get("redirectTo"),
  );
  const preferredEmail =
    request.nextUrl.searchParams.get("email") ?? process.env.E2E_CLERK_TEST_EMAIL ?? null;
  const userId = await resolveTargetUserId(preferredEmail);

  if (!userId) {
    return NextResponse.json(
      { error: "No Clerk user available for E2E login" },
      { status: 500 },
    );
  }

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const signInToken = await clerk.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 60,
  });
  const signInUrl = new URL("/sign-in", request.nextUrl.origin);
  signInUrl.searchParams.set("__clerk_ticket", signInToken.token);
  signInUrl.searchParams.set("redirect_url", redirectUrl);

  return NextResponse.redirect(signInUrl, { status: 307 });
}
