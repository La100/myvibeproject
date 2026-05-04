export const signInUrl = "/sign-in";
export const signUpUrl = "/sign-up";
export const postAuthResolverUrl = "/dashboard";
export const selectOrganizationUrl = "/select-organization";

const AUTH_ROUTE_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/session-tasks",
];

const normalizeRedirectTarget = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  const pathname = value.split(/[?#]/, 1)[0] || "/";
  if (
    AUTH_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }

  return value;
};

export const signInFallbackRedirectUrl = normalizeRedirectTarget(
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
  postAuthResolverUrl,
);

export const signUpFallbackRedirectUrl = normalizeRedirectTarget(
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
  signInFallbackRedirectUrl,
);

export const resolveLocalRedirectUrl = (redirectUrl: string | null | undefined, fallback: string) =>
  normalizeRedirectTarget(redirectUrl ?? undefined, fallback);
