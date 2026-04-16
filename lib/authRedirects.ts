export const signInUrl = "/sign-in";
export const signUpUrl = "/sign-up";
export const postAuthResolverUrl = "/dashboard";
export const clerkChooseOrganizationTaskUrl = "/session-tasks/choose-organization";
export const selectOrganizationUrl = "/select-organization";

const normalizeRedirectTarget = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return fallback;
};

export const signInFallbackRedirectUrl = normalizeRedirectTarget(
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
  postAuthResolverUrl,
);

export const signUpFallbackRedirectUrl = normalizeRedirectTarget(
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
  signInFallbackRedirectUrl,
);

export const resolveLocalRedirectUrl = (redirectUrl: string | null | undefined, fallback: string) =>
  normalizeRedirectTarget(redirectUrl ?? undefined, fallback);
