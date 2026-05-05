export const signInUrl = "/sign-in";
export const signUpUrl = "/sign-up";
export const postAuthResolverUrl = "/dashboard";
export const selectOrganizationUrl = "/select-organization";

const AUTH_ROUTE_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/sso-callback",
];

const normalizeRedirectTarget = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  let target = value;

  if (!target.startsWith("/") || target.startsWith("//")) {
    try {
      const parsed = new URL(target);
      if (parsed.hostname !== "myvibeproject.com") {
        return fallback;
      }
      target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return fallback;
    }
  }

  const pathname = target.split(/[?#]/, 1)[0] || "/";
  if (
    AUTH_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }

  return target;
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
